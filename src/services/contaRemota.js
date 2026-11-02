import { ErroDaApi, SemConexao, pedir, temServidor } from './api';
import { apagarConta, buscarContaPorEmail, gravarContaLocal } from './auth';
import { esquecerPendencias } from './bancoLocal';
import { resumir, resumirResposta } from './senha';
import { apagarToken, guardarToken, lerToken } from './sessao';
import { esquecerUltimaSincronizacao } from './sincronizacao';

// O lado da conta que fala com o servidor. O aplicativo continua conferindo a
// senha sozinho quando está sem internet; com internet, quem decide é o servidor,
// porque a senha pode ter sido trocada em outro celular.

export const CONECTADA = 'conectada';
export const SENHA_ERRADA = 'senha-errada';
export const EMAIL_EM_USO = 'email-em-uso';
export const SEM_REDE = 'sem-rede';
export const RECUSADA = 'recusada';

// O que veio do servidor por cima do que o aparelho já sabia. A preferência de
// biometria e a foto de perfil são deste aparelho e não sobem.
function juntarConta(local, remota, senhaResumo) {
  return {
    biometriaAtiva: false,
    ...(local || {}),
    ...remota,
    senhaResumo: senhaResumo,
  };
}

function dadosDeCadastro(conta) {
  return {
    email: conta.email,
    nome: conta.nome,
    perfil: conta.perfil,
    instituicao: conta.instituicao || null,
    telefone: conta.telefone || '',
    sal: conta.sal,
    senhaResumo: conta.senhaResumo,
    pergunta: conta.pergunta || '',
    respostaResumo: conta.respostaResumo || '',
  };
}

// Traduz os erros esperados em situações. O resto é defeito, e continua sendo
// erro para quem chamou.
async function comSituacao(tarefa, recusado) {
  if (!temServidor()) {
    return { situacao: SEM_REDE };
  }

  try {
    return await tarefa();
  } catch (error) {
    if (error instanceof SemConexao) {
      return { situacao: SEM_REDE };
    }

    if (error instanceof ErroDaApi) {
      return { situacao: recusado };
    }

    throw error;
  }
}

export function registrar(conta) {
  return comSituacao(async () => {
    try {
      const resposta = await pedir('POST', '/auth/cadastro', dadosDeCadastro(conta));

      await guardarToken(conta.email, resposta.token);
      esquecerUltimaSincronizacao();

      return { situacao: CONECTADA };
    } catch (error) {
      if (error instanceof ErroDaApi && error.status !== 409) {
        return { situacao: RECUSADA, mensagem: error.message };
      }

      throw error;
    }
  }, EMAIL_EM_USO);
}

async function tentarEntrar(email, senha) {
  const { sal } = await pedir('POST', '/auth/sal', { email: email });
  const senhaResumo = await resumir(senha, sal);
  const resposta = await pedir('POST', '/auth/entrar', { email: email, senhaResumo: senhaResumo });

  await guardarToken(email, resposta.token);

  return { remota: resposta.conta, senhaResumo: senhaResumo };
}

// Entrar com uma conta que já está no aparelho, depois de a senha conferir ou
// não localmente. `senhaLocalConfere` resolve a conta criada antes de existir
// servidor: ela sobe agora, no primeiro login com internet.
export function conectar(local, senha, senhaLocalConfere) {
  return comSituacao(async () => {
    try {
      const { remota, senhaResumo } = await tentarEntrar(local.email, senha);
      const conta = juntarConta(local, remota, senhaResumo);

      await gravarContaLocal(conta);
      esquecerUltimaSincronizacao();

      return { situacao: CONECTADA, conta: conta };
    } catch (error) {
      if (!(error instanceof ErroDaApi) || !senhaLocalConfere) {
        throw error;
      }
    }

    const resultado = await registrar(local);

    return resultado.situacao === EMAIL_EM_USO
      ? { situacao: SENHA_ERRADA }
      : { ...resultado, conta: local };
  }, SENHA_ERRADA);
}

// O caminho de quem abre o aplicativo num celular novo.
export function entrarPorEmail(email, senha) {
  return comSituacao(async () => {
    const local = await buscarContaPorEmail(email);
    const { remota, senhaResumo } = await tentarEntrar(email, senha);
    const conta = juntarConta(local, remota, senhaResumo);

    await gravarContaLocal(conta);
    esquecerUltimaSincronizacao();

    return { situacao: CONECTADA, conta: conta };
  }, SENHA_ERRADA);
}

// Monta o começo de uma conta para quem esqueceu a senha num celular novo. Não
// grava nada: a conta só entra no aparelho se a resposta conferir.
export function buscarParaRecuperar(email) {
  return comSituacao(async () => {
    const { sal, pergunta } = await pedir('POST', '/auth/sal', { email: email });

    return {
      situacao: CONECTADA,
      conta: { email: email, nome: email, sal: sal, pergunta: pergunta },
    };
  }, SENHA_ERRADA);
}

export function recuperar(conta, resposta, senhaNova) {
  return comSituacao(async () => {
    const senhaResumo = await resumir(senhaNova, conta.sal);
    const retorno = await pedir('POST', '/auth/recuperar', {
      email: conta.email,
      respostaResumo: await resumirResposta(resposta, conta.sal),
      senhaResumoNova: senhaResumo,
    });
    const atualizada = juntarConta(conta, retorno.conta, senhaResumo);

    await guardarToken(conta.email, retorno.token);
    await gravarContaLocal(atualizada);
    esquecerUltimaSincronizacao();

    return { situacao: CONECTADA, conta: atualizada };
  }, SENHA_ERRADA);
}

export async function temSessao(conta) {
  return temServidor() && (await lerToken(conta.email)) != null;
}

// Apagar a conta precisa chegar ao servidor. Sem conexão, recusa em vez de
// apagar só daqui: a pessoa acharia que os dados sumiram, e eles continuariam lá.
export async function apagarDoServidor(conta) {
  const token = await lerToken(conta.email);

  if (!temServidor() || token == null) {
    return;
  }

  try {
    await pedir('DELETE', '/contas/eu', undefined, token);
  } catch (error) {
    if (error instanceof ErroDaApi && error.status === 401) {
      throw new SemConexao('Entre de novo com a senha antes de apagar a conta.');
    }

    throw error;
  }
}

// Depois de apagar: nada do que era dela pode continuar esperando para subir.
export async function limparRastros(conta) {
  const email = (conta.email || '').trim().toLowerCase();
  const dela = (texto) => (texto || '').trim().toLowerCase() === email;

  await esquecerPendencias((op) => {
    const dados = op.dados || {};

    return dela(op.conta) || dela(dados.conta) || dela(dados.dono) || dela(dados.por);
  });
  await apagarToken(conta.email);
  await apagarConta(conta.email);
}
