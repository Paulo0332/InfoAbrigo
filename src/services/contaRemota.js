import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
} from 'firebase/auth';

import { pedir, temServidor } from './api';
import { apagarConta, buscarContaPorEmail, gravarContaLocal } from './auth';
import { esquecerPendencias } from './bancoLocal';
import { apagarDadosDaPessoa, gravarPerfil, lerPerfil } from './bancoRemoto';
import { obterAuth, temFirebase, usuarioAtual } from './firebase';
import { novoSal, resumir } from './senha';
import { esquecerUltimaSincronizacao } from './sincronizacao';

// O lado da conta que fala com o Firebase Authentication. O aplicativo continua
// conferindo a senha sozinho quando está sem internet; com internet, quem decide é
// o Firebase, porque a senha pode ter sido trocada em outro celular.

export const CONECTADA = 'conectada';
export const SENHA_ERRADA = 'senha-errada';
export const EMAIL_EM_USO = 'email-em-uso';
export const SEM_REDE = 'sem-rede';
export const RECUSADA = 'recusada';
export const ENTRAR_DE_NOVO = 'entrar-de-novo';

function situacaoDoErro(error) {
  const codigo = (error && error.code) || '';

  if (codigo === 'auth/email-already-in-use') {
    return { situacao: EMAIL_EM_USO };
  }

  if (
    codigo === 'auth/invalid-credential' ||
    codigo === 'auth/wrong-password' ||
    codigo === 'auth/user-not-found'
  ) {
    return { situacao: SENHA_ERRADA };
  }

  if (codigo === 'auth/requires-recent-login') {
    return { situacao: ENTRAR_DE_NOVO };
  }

  if (codigo === 'auth/weak-password') {
    return { situacao: RECUSADA, mensagem: 'A senha precisa ter pelo menos 6 caracteres.' };
  }

  if (codigo === 'auth/invalid-email') {
    return { situacao: RECUSADA, mensagem: 'Confira o e-mail digitado.' };
  }

  if (codigo === 'auth/too-many-requests') {
    return { situacao: RECUSADA, mensagem: 'Muitas tentativas. Aguarde alguns minutos.' };
  }

  // O resto (sem rede, serviço fora do ar): o aplicativo segue com o que tem aqui.
  return { situacao: SEM_REDE };
}

async function comSituacao(tarefa) {
  if (!temFirebase()) {
    return { situacao: SEM_REDE };
  }

  try {
    return await tarefa();
  } catch (error) {
    if (error && error.code) {
      return situacaoDoErro(error);
    }

    console.log('Erro ao falar com o Firebase:', error);

    return { situacao: SEM_REDE };
  }
}

function perfilDe(conta) {
  return {
    email: conta.email.trim().toLowerCase(),
    nome: conta.nome,
    perfil: conta.perfil,
    instituicao: conta.instituicao || null,
    telefone: conta.telefone || '',
  };
}

// A conta local guarda o resumo da senha para entrar sem internet. Ela é refeita a
// cada login conectado, e por isso a senha trocada em outro celular chega aqui.
async function juntarConta(local, remota, senha, email) {
  const sal = (local && local.sal) || novoSal();

  return {
    biometriaAtiva: false,
    ...(local || {}),
    ...(remota || {}),
    email: (local && local.email) || email,
    sal: sal,
    senhaResumo: await resumir(senha, sal),
  };
}

export function registrar(conta, senha) {
  return comSituacao(async () => {
    const criada = await createUserWithEmailAndPassword(
      obterAuth(),
      conta.email.trim().toLowerCase(),
      senha
    );

    await gravarPerfil(criada.user.uid, perfilDe(conta));
    esquecerUltimaSincronizacao();

    return { situacao: CONECTADA };
  });
}

async function entrarNoFirebase(email, senha) {
  const entrada = await signInWithEmailAndPassword(obterAuth(), email, senha);

  esquecerUltimaSincronizacao();

  return entrada.user;
}

// Entrar com uma conta que já está no aparelho. `senhaLocalConfere` resolve a conta
// criada antes do Firebase ou sem internet: ela sobe agora, no primeiro login
// conectado. Se o e-mail já existir por lá, a senha digitada estava mesmo errada.
export function conectar(local, senha, senhaLocalConfere) {
  return comSituacao(async () => {
    const email = local.email.trim().toLowerCase();

    try {
      const usuario = await entrarNoFirebase(email, senha);
      const remota = await lerPerfil(usuario.uid);
      const conta = await juntarConta(local, remota, senha, email);

      await gravarContaLocal(conta);

      return { situacao: CONECTADA, conta: conta };
    } catch (error) {
      const situacao = situacaoDoErro(error).situacao;

      if (situacao !== SENHA_ERRADA || !senhaLocalConfere) {
        throw error;
      }
    }

    const resultado = await registrar(local, senha);

    return resultado.situacao === EMAIL_EM_USO
      ? { situacao: SENHA_ERRADA }
      : { ...resultado, conta: local };
  });
}

// O caminho de quem abre o aplicativo num celular novo.
export function entrarPorEmail(email, senha) {
  return comSituacao(async () => {
    const local = await buscarContaPorEmail(email);
    const usuario = await entrarNoFirebase(email, senha);
    const remota = await lerPerfil(usuario.uid);
    const conta = await juntarConta(local, remota, senha, email);

    await gravarContaLocal(conta);

    return { situacao: CONECTADA, conta: conta };
  });
}

// A tela diz a mesma coisa exista a conta ou não: revelar quem tem conta ajudaria
// quem está tentando entrar na dos outros.
export function pedirNovaSenha(email) {
  return comSituacao(async () => {
    try {
      await sendPasswordResetEmail(obterAuth(), email.trim().toLowerCase());
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    return { situacao: CONECTADA };
  });
}

export async function temSessao(conta) {
  const usuario = await usuarioAtual();

  return usuario != null && usuario.email === conta.email.trim().toLowerCase();
}

export function trocarSenha(senhaAtual, senhaNova) {
  return comSituacao(async () => {
    const usuario = await usuarioAtual();

    if (usuario == null) {
      return { situacao: ENTRAR_DE_NOVO };
    }

    await reauthenticateWithCredential(
      usuario,
      EmailAuthProvider.credential(usuario.email, senhaAtual)
    );
    await updatePassword(usuario, senhaNova);

    return { situacao: CONECTADA };
  });
}

// Apagar a conta precisa chegar ao servidor. Sem conexão, recusa em vez de apagar só
// daqui: a pessoa acharia que os dados sumiram, e eles continuariam lá. A senha
// renova o login, porque o Firebase só deixa excluir um login recente. Os dados saem
// antes do login: sem ele, ninguém mais teria permissão para apagá-los.
export function apagarDoServidor(conta, senha) {
  return comSituacao(async () => {
    const usuario = await usuarioAtual();

    if (usuario == null || !(await temSessao(conta))) {
      return { situacao: ENTRAR_DE_NOVO };
    }

    await reauthenticateWithCredential(
      usuario,
      EmailAuthProvider.credential(usuario.email, senha)
    );

    if (temServidor()) {
      await pedir('DELETE', '/contas/eu', undefined, await usuario.getIdToken());
    }

    await apagarDadosDaPessoa(usuario);
    await deleteUser(usuario);

    return { situacao: CONECTADA };
  });
}

// Depois de apagar: nada do que era dela pode continuar esperando para subir.
export async function limparRastros(conta) {
  const email = (conta.email || '').trim().toLowerCase();
  const dela = (texto) => (texto || '').trim().toLowerCase() === email;

  await esquecerPendencias((op) => {
    const dados = op.dados || {};

    return dela(op.conta) || dela(dados.conta) || dela(dados.dono) || dela(dados.por);
  });
  await apagarConta(conta.email);
}
