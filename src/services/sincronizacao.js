import * as ImageManipulator from 'expo-image-manipulator';

import { ErroDaApi, SemConexao, enderecoDaApi, pedir, temServidor } from './api';
import {
  gravarAnotacao,
  lerAnotacao,
  lerFila,
  receberDoServidor,
  tirarDaFila,
  trocarDados,
} from './bancoLocal';
import { carregarConta } from './contaAtual';
import { apagarToken, guardarToken, lerToken } from './sessao';

// Leva a fila ao servidor e traz o que mudou por lá.
//
// As telas continuam lendo e gravando no banco do aparelho, como sempre. Por
// isso nada aqui trava o uso: sem internet a fila só espera a próxima tentativa.
const ROTAS = {
  abrigos: '/abrigos',
  necessidades: '/necessidades',
  doacoes: '/doacoes',
  compromissos: '/compromissos',
};

const INTERVALO_MINIMO = 10000;
const ESPERA_DA_TELA = 2500;
const LARGURA_DA_FOTO = 1024;

let emAndamento = null;
let repetir = false;
let ultima = { email: null, em: 0 };
let semConexao = false;

const ouvintes = new Set();

// Para a faixa de aviso saber quando olhar de novo. Devolve a função que para.
export function ouvirSincronizacao(ouvinte) {
  ouvintes.add(ouvinte);

  return () => ouvintes.delete(ouvinte);
}

function avisarOuvintes() {
  ouvintes.forEach((ouvinte) => ouvinte());
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

async function enviarFoto(uri, token) {
  const contexto = ImageManipulator.ImageManipulator.manipulate(uri);

  contexto.resize({ width: LARGURA_DA_FOTO });

  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.6,
    base64: true,
  });
  const resposta = await pedir('POST', '/arquivos', { base64: salva.base64 }, token);

  return enderecoDaApi() + resposta.caminho;
}

// A foto do abrigo nasce como um arquivo deste celular, que nenhum outro
// consegue abrir. Antes de o abrigo subir, ela sobe e vira um endereço público.
async function prepararAbrigo(op, token) {
  const foto = op.dados.foto;

  if (!foto || /^https?:/i.test(foto)) {
    return op.dados;
  }

  try {
    const dados = { ...op.dados, foto: await enviarFoto(foto, token) };

    await trocarDados(op.seq, op.colecao, op.id, dados);

    return dados;
  } catch (error) {
    if (error instanceof SemConexao) {
      throw error;
    }

    // O arquivo sumiu do aparelho: o abrigo sobe sem foto em vez de travar a fila.
    console.log('Erro ao enviar a foto do abrigo:', error);

    return { ...op.dados, foto: null };
  }
}

async function executar(op, conta, token) {
  const caminho = ROTAS[op.colecao] + '/' + encodeURIComponent(op.id);

  if (op.colecao === 'contas') {
    const resposta = await pedir('PUT', '/contas/eu', op.dados, token);

    await guardarToken(conta.email, resposta.token);

    return resposta.token;
  }

  if (op.acao === 'apagar') {
    await pedir('DELETE', caminho, undefined, token);
  } else if (op.acao === 'situacao') {
    await pedir('PATCH', caminho + '/situacao', op.dados, token);
  } else if (op.colecao === 'abrigos') {
    await pedir('PUT', caminho, await prepararAbrigo(op, token), token);
  } else {
    await pedir('PUT', caminho, op.dados, token);
  }

  return token;
}

// Envia na ordem em que aconteceu. Falta de conexão para tudo e tenta depois;
// recusa do servidor descarta só aquele pedido, senão um registro inválido
// seguraria todos os outros para sempre. O que foi recusado volta ao estado do
// servidor no download logo em seguida.
async function enviarFila(conta, tokenInicial) {
  const email = normal(conta.email);
  const abrigosRetidos = new Set();
  let token = tokenInicial;

  for (const op of await lerFila()) {
    if (ehDeOutraConta(op, email, abrigosRetidos)) {
      if (op.colecao === 'abrigos') {
        abrigosRetidos.add(op.id);
      }

      continue;
    }

    try {
      token = await executar(op, conta, token);
    } catch (error) {
      if (error instanceof ErroDaApi && error.status === 401) {
        throw error;
      }

      if (!(error instanceof ErroDaApi)) {
        throw error;
      }

      console.log('Pedido recusado pelo servidor:', op.colecao, op.id, error.message);
    }

    await tirarDaFila(op.seq);
  }

  return token;
}

async function baixar(email, token) {
  const [abrigos, necessidades, doacoes, compromissos] = await Promise.all([
    pedir('GET', ROTAS.abrigos, undefined, token),
    pedir('GET', ROTAS.necessidades, undefined, token),
    pedir('GET', ROTAS.doacoes, undefined, token),
    pedir('GET', ROTAS.compromissos, undefined, token),
  ]);

  // Doação e agenda são privadas: o servidor só devolve as desta conta, e as
  // das outras contas do aparelho continuam guardadas.
  const deOutraConta = (item) => normal(item.conta) !== email;

  await receberDoServidor('abrigos', abrigos);
  await receberDoServidor('necessidades', necessidades);
  await receberDoServidor('doacoes', doacoes, deOutraConta);
  await receberDoServidor('compromissos', compromissos, deOutraConta);
}

async function rodar() {
  const conta = await carregarConta();

  if (conta == null) {
    return;
  }

  const token = await lerToken(conta.email);

  if (token == null) {
    return;
  }

  const email = normal(conta.email);

  try {
    const atual = await enviarFila(conta, token);

    await baixar(email, atual);

    ultima = { email: email, em: Date.now() };
    semConexao = false;

    await gravarAnotacao('ultima-sincronizacao', new Date().toISOString());
  } catch (error) {
    if (error instanceof ErroDaApi && error.status === 401) {
      // Sessão vencida ou senha trocada em outro celular. Os dados ficam no
      // aparelho e voltam a subir quando a pessoa entrar com a senha.
      await apagarToken(conta.email);

      return;
    }

    if (!(error instanceof SemConexao)) {
      throw error;
    }

    semConexao = true;
  }
}

export function sincronizar() {
  if (!temServidor()) {
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
  try {
    do {
      repetir = false;
      await rodar();
    } while (repetir);
  } catch (error) {
    console.log('Erro ao sincronizar:', error);
  } finally {
    emAndamento = null;
    avisarOuvintes();
  }
}

// Chamado depois de cada gravação. Não espera: a tela já mostrou o resultado.
export function avisarMudanca() {
  sincronizar();
}

// Chamado antes de cada leitura. Espera um pouco para a tela já abrir com o
// dado novo, mas nunca muito: com internet ruim, ela abre com o que já tem.
export async function garantirAtualizado() {
  if (!temServidor()) {
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
  if (!temServidor()) {
    return { situacao: 'sem-servidor', pendentes: 0, ultimaEm: null };
  }

  const token = conta ? await lerToken(conta.email) : null;

  return {
    situacao: token ? 'conectada' : 'sem-sessao',
    semConexao: semConexao,
    pendentes: conta ? await contarPendentes(normal(conta.email)) : 0,
    ultimaEm: await lerAnotacao('ultima-sincronizacao'),
  };
}

export function esquecerUltimaSincronizacao() {
  ultima = { email: null, em: 0 };
}
