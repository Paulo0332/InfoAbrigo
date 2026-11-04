import * as ImageManipulator from 'expo-image-manipulator';
import NetInfo from '@react-native-community/netinfo';

import { enderecoDaApi, pedir, SemConexao, temServidor } from './api';
import {
  gravarAnotacao,
  lerAnotacao,
  lerFila,
  receberDoServidor,
  tirarDaFila,
  trocarDados,
} from './bancoLocal';
import {
  RecusadoPeloBanco,
  apagarAbrigo,
  apagarNecessidade,
  apagarPrivado,
  gravarAbrigo,
  gravarNecessidade,
  gravarPerfil,
  gravarPrivado,
  lerTudo,
  ouvirMudancas,
} from './bancoRemoto';
import { carregarConta } from './contaAtual';
import { temFirebase, usuarioAtual } from './firebase';

// Leva a fila ao Firebase e traz o que mudou por lá.
//
// As telas continuam lendo e gravando no banco do aparelho, como sempre. Por isso
// nada aqui trava o uso: sem internet a fila só espera a próxima tentativa. É o
// mesmo desenho do exemplo LPAH-2026-SQLITE-FIREBASE da disciplina.
const INTERVALO_MINIMO = 10000;
const ESPERA_DA_TELA = 2500;
const LARGURA_DA_FOTO = 1024;

let emAndamento = null;
let repetir = false;
let ultima = { email: null, em: 0 };
let semConexao = false;
let sincronizando = false;

const ouvintes = new Set();
const ouvintesDeNovidades = new Set();

export function estaSincronizando() {
  return sincronizando;
}

// Para a faixa de aviso saber quando olhar de novo. Devolve a função que para.
export function ouvirSincronizacao(ouvinte) {
  ouvintes.add(ouvinte);

  return () => ouvintes.delete(ouvinte);
}

function avisarOuvintes() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

// Para as telas abertas lerem de novo quando outro celular mudou algo. É separado
// do ouvinte acima de propósito: ler de novo já dispara uma sincronização, e reagir
// ao fim de toda sincronização faria as duas coisas se chamarem sem parar.
export function ouvirNovidadesDeFora(ouvinte) {
  ouvintesDeNovidades.add(ouvinte);

  return () => ouvintesDeNovidades.delete(ouvinte);
}

// Liga o que acorda a sincronização sem ninguém tocar na tela: a conexão voltando e
// a mudança feita por outro celular. Devolve a função que desliga.
export function acompanharMudancas() {
  const pararConexao = NetInfo.addEventListener((estado) => {
    const conectado = Boolean(estado.isConnected);

    if (!conectado && !semConexao) {
      semConexao = true;
      avisarOuvintes();
    } else if (conectado && semConexao) {
      sincronizar();
    }
  });

  let desligado = false;
  let pararMudancas = () => {};

  usuarioAtual()
    .then((usuario) => {
      if (usuario != null && !desligado) {
        pararMudancas = ouvirMudancas(async () => {
          esquecerUltimaSincronizacao();
          await sincronizar();
          ouvintesDeNovidades.forEach((ouvinte) => ouvinte());
        });
      }
    })
    .catch((error) => console.log('Erro ao escutar o Firebase:', error));

  return () => {
    desligado = true;
    pararConexao();
    pararMudancas();
  };
}

function normal(texto) {
  return (texto || '').trim().toLowerCase();
}

// O aparelho guarda mais de uma conta, mas a sessão é de uma só. O que é de
// outra conta fica na fila até ela entrar: enviado agora, viraria dado desta.
//
// A necessidade não tem dono próprio: ela só espera se o abrigo dela também
// estiver esperando. Prometer um item em abrigo alheio é justamente o caso comum.
function ehDeOutraConta(op, email, abrigosRetidos) {
  if (op.conta) {
    return normal(op.conta) !== email;
  }

  const dados = op.dados || {};

  if (op.colecao === 'abrigos') {
    return Boolean(dados.dono) && normal(dados.dono) !== email;
  }

  if (op.colecao === 'doacoes' || op.colecao === 'compromissos') {
    return Boolean(dados.conta) && normal(dados.conta) !== email;
  }

  if (op.colecao === 'necessidades') {
    return abrigosRetidos.has(String(dados.abrigoId));
  }

  return false;
}

async function compactar(uri) {
  const contexto = ImageManipulator.ImageManipulator.manipulate(uri);

  contexto.resize({ width: LARGURA_DA_FOTO });

  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.6,
    base64: true,
  });

  return salva.base64;
}

// A foto do abrigo nasce como um arquivo deste celular, que nenhum outro consegue
// abrir. Antes de o abrigo subir, ela vira algo que todos abrem. O lugar dela é a
// API, porque o Storage do Firebase exige o plano pago. Com a API fora do ar, a foto
// segue junto do abrigo, em texto, para o cadastro não ficar preso esperando.
async function prepararAbrigo(op, usuario) {
  const foto = op.dados.foto;

  if (!foto || /^(https?|data):/i.test(foto)) {
    return op.dados;
  }

  let base64;

  try {
    base64 = await compactar(foto);
  } catch (error) {
    // O arquivo sumiu do aparelho: o abrigo sobe sem foto em vez de travar a fila.
    console.log('Erro ao preparar a foto do abrigo:', error);

    return { ...op.dados, foto: null };
  }

  let endereco = 'data:image/jpeg;base64,' + base64;

  if (temServidor()) {
    try {
      const resposta = await pedir('POST', '/arquivos', { base64 }, await usuario.getIdToken());

      endereco = enderecoDaApi() + resposta.caminho;
    } catch (error) {
      console.log('A foto seguiu sem passar pela API:', error.message);
    }
  }

  const dados = { ...op.dados, foto: endereco };

  await trocarDados(op.seq, op.colecao, op.id, dados);

  return dados;
}

// O selo é decidido pela API: se fosse o próprio celular, poderia ser falsificado.
// Falhar aqui não atrapalha nada, e a próxima gravação do abrigo tenta de novo.
async function pedirVerificacao(abrigo, conta, usuario) {
  const cnpj = conta.instituicao && conta.instituicao.cnpj;

  if (!temServidor() || !cnpj) {
    return;
  }

  try {
    await pedir(
      'POST',
      '/verificacoes',
      { abrigoId: String(abrigo.id), cnpj: cnpj },
      await usuario.getIdToken()
    );
  } catch (error) {
    console.log('Verificação da instituição adiada:', error.message);
  }
}

async function executar(op, conta, usuario) {
  if (op.colecao === 'contas') {
    await gravarPerfil(usuario.uid, op.dados);

    return;
  }

  // Pedido de uma versão anterior do aplicativo. A entrega agora é lida na necessidade.
  if (op.acao === 'situacao') {
    return;
  }

  if (op.acao === 'apagar') {
    if (op.colecao === 'abrigos') {
      await apagarAbrigo(op.id);
    } else if (op.colecao === 'necessidades') {
      await apagarNecessidade(op.id);
    } else {
      await apagarPrivado(op.colecao, usuario, op.id);
    }

    return;
  }

  if (op.colecao === 'abrigos') {
    const dados = await prepararAbrigo(op, usuario);

    await gravarAbrigo(usuario, dados);
    await pedirVerificacao(dados, conta, usuario);
  } else if (op.colecao === 'necessidades') {
    await gravarNecessidade(usuario, op.dados);
  } else {
    await gravarPrivado(op.colecao, usuario, op.dados);
  }
}

// Envia na ordem em que aconteceu. Falta de conexão para tudo e tenta depois; recusa
// do banco descarta só aquele pedido, senão um registro inválido seguraria todos os
// outros para sempre. O que foi recusado volta ao estado do banco logo em seguida.
async function enviarFila(conta, usuario) {
  const email = normal(usuario.email);
  const abrigosRetidos = new Set();

  for (const op of await lerFila()) {
    if (ehDeOutraConta(op, email, abrigosRetidos)) {
      if (op.colecao === 'abrigos') {
        abrigosRetidos.add(op.id);
      }

      continue;
    }

    try {
      await executar(op, conta, usuario);
    } catch (error) {
      if (!(error instanceof RecusadoPeloBanco)) {
        throw error;
      }

      console.log('Pedido recusado pelo Firebase:', op.colecao, op.id, error.message);
    }

    await tirarDaFila(op.seq);
  }
}

async function baixar(email, usuario) {
  const tudo = await lerTudo(usuario);

  // Doação e agenda são privadas: só vêm as desta conta, e as das outras contas do
  // aparelho continuam guardadas.
  const deOutraConta = (item) => normal(item.conta) !== email;

  await receberDoServidor('abrigos', tudo.abrigos);
  await receberDoServidor('necessidades', tudo.necessidades);
  await receberDoServidor('doacoes', tudo.doacoes, deOutraConta);
  await receberDoServidor('compromissos', tudo.compromissos, deOutraConta);
}

async function rodar() {
  const conta = await carregarConta();

  if (conta == null) {
    return;
  }

  const usuario = await usuarioAtual();
  const email = normal(conta.email);

  // Entrou pela digital em outra conta do aparelho: a sessão do Firebase é de outra
  // pessoa. Os dados ficam aqui até ela entrar com a senha.
  if (usuario == null || normal(usuario.email) !== email) {
    return;
  }

  try {
    await enviarFila(conta, usuario);
    await baixar(email, usuario);

    ultima = { email: email, em: Date.now() };
    semConexao = false;

    await gravarAnotacao('ultima-sincronizacao', new Date().toISOString());
  } catch (error) {
    if (error instanceof RecusadoPeloBanco) {
      console.log('Leitura recusada pelo Firebase:', error.message);

      return;
    }

    if (!(error instanceof SemConexao)) {
      throw error;
    }

    semConexao = true;
  }
}

export function sincronizar() {
  if (!temFirebase()) {
    return Promise.resolve();
  }

  if (emAndamento != null) {
    repetir = true;

    return emAndamento;
  }

  emAndamento = rodarAteFicarEmDia();

  return emAndamento;
}

// O que foi gravado durante uma rodada só vai na seguinte. Quem espera por
// sincronizar() precisa saber que tudo chegou, e não só o que havia no início.
async function rodarAteFicarEmDia() {
  sincronizando = true;
  avisarOuvintes();

  try {
    do {
      repetir = false;
      await rodar();
    } while (repetir);
  } catch (error) {
    console.log('Erro ao sincronizar:', error);
  } finally {
    emAndamento = null;
    sincronizando = false;
    avisarOuvintes();
  }
}

// Chamado depois de cada gravação. Não espera: a tela já mostrou o resultado.
export function avisarMudanca() {
  sincronizar();
}

// Chamado antes de cada leitura. Espera um pouco para a tela já abrir com o dado
// novo, mas nunca muito: com internet ruim, ela abre com o que já tem.
export async function garantirAtualizado() {
  if (!temFirebase()) {
    return;
  }

  const conta = await carregarConta();

  if (conta == null) {
    return;
  }

  const recente =
    ultima.email === normal(conta.email) && Date.now() - ultima.em < INTERVALO_MINIMO;

  if (recente) {
    return;
  }

  await Promise.race([
    sincronizar(),
    new Promise((resolve) => setTimeout(resolve, ESPERA_DA_TELA)),
  ]);
}

// Só conta o que é desta conta: o que é de outra conta do aparelho está esperando
// ela entrar, e não a conexão voltar.
async function contarPendentes(email) {
  const abrigosRetidos = new Set();
  let total = 0;

  for (const op of await lerFila()) {
    if (!ehDeOutraConta(op, email, abrigosRetidos)) {
      total += 1;
    } else if (op.colecao === 'abrigos') {
      abrigosRetidos.add(op.id);
    }
  }

  return total;
}

// O que o Perfil e a faixa de aviso mostram para a pessoa saber onde os dados dela estão.
export async function estadoDaSincronizacao(conta) {
  if (!temFirebase()) {
    return { situacao: 'sem-servidor', pendentes: 0, ultimaEm: null };
  }

  const usuario = await usuarioAtual();
  const email = conta ? normal(conta.email) : '';

  return {
    situacao: usuario != null && normal(usuario.email) === email ? 'conectada' : 'sem-sessao',
    semConexao: semConexao,
    pendentes: conta ? await contarPendentes(email) : 0,
    ultimaEm: await lerAnotacao('ultima-sincronizacao'),
  };
}

export function esquecerUltimaSincronizacao() {
  ultima = { email: null, em: 0 };
}
