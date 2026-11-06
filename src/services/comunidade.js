import { DENUNCIAS_PARA_ALERTA, gravarDenuncia, lerDenuncias } from './bancoRemoto';
import { temFirebase, usuarioAtual } from './firebase';
import { calcularDistancia, carregarAbrigosDoAparelho, ehDono } from './shelters';
import { loadNeeds } from './storage';

// O que a comunidade faz junto: denunciar um abrigo suspeito, saber onde a ajuda vale
// mais e prestar contas do que chegou. Tudo é calculado no celular, com os dados que
// já vieram do Firebase, e as denúncias são gravadas lá. Nada depende de servidor
// próprio ligado.

export { DENUNCIAS_PARA_ALERTA };

export const MOTIVOS_DE_DENUNCIA = [
  { id: 'chave-pix-suspeita', nome: 'A chave Pix parece não ser do abrigo' },
  { id: 'abrigo-inexistente', nome: 'Este abrigo não existe' },
  { id: 'dados-errados', nome: 'Endereço ou contatos estão errados' },
  { id: 'outro', nome: 'Outro motivo' },
];

// Denúncia e painel precisam de conta no Firebase. Sem ele, os dados são só deste
// celular e não há comunidade para avisar.
export function servicosDisponiveis() {
  return temFirebase();
}

function comoLista(valor) {
  if (!valor) {
    return [];
  }

  return (Array.isArray(valor) ? valor : Object.values(valor)).filter(Boolean);
}

function numero(valor) {
  const convertido = Number(valor);

  return Number.isFinite(convertido) ? convertido : 0;
}

function somar(lista, campo) {
  return lista.reduce((total, item) => total + numero(item[campo]), 0);
}

// ---------------- Recomendações ----------------

// A nota junta três coisas: o abrigo marcou como urgente, falta muito do que foi
// pedido e o abrigo está perto. O peso maior é da urgência, porque é o próprio abrigo
// dizendo o que não pode esperar.
export function notaDaNecessidade(necessidade, km) {
  const alvo = numero(necessidade.alvo);
  const prometido = somar(comoLista(necessidade.contribuicoes), 'quantidade');
  const falta = alvo > 0 ? Math.max(0, alvo - prometido) : null;

  if (falta === 0) {
    return null;
  }

  let nota = necessidade.urgente ? 50 : 0;

  nota = nota + (alvo > 0 ? 30 * (falta / alvo) : 15);

  if (km != null) {
    nota = nota + 20 / (1 + km / 10);
  }

  return { nota: nota, falta: falta };
}

function explicar(necessidade, km) {
  const partes = [];

  if (necessidade.urgente) {
    partes.push('urgente');
  }

  if (km != null) {
    partes.push(km >= 1 ? 'a ' + km.toFixed(1).replace('.', ',') + ' km de você' : 'muito perto de você');
  }

  if (comoLista(necessidade.contribuicoes).length === 0) {
    partes.push('ninguém se ofereceu ainda');
  }

  return partes.join(', ');
}

// Separada da leitura dos dados para ser fácil de testar.
export function recomendar(abrigos, necessidades, localizacao, limite = 5) {
  const porId = new Map(abrigos.map((abrigo) => [String(abrigo.id), abrigo]));
  const lista = [];

  necessidades.forEach((necessidade) => {
    const abrigo = porId.get(String(necessidade.abrigoId));

    // Abrigo denunciado continua no mapa, mas o aplicativo não empurra doação para ele.
    if (necessidade.done || !abrigo || abrigo.alerta) {
      return;
    }

    const km = localizacao
      ? calcularDistancia(
          localizacao.latitude,
          localizacao.longitude,
          numero(abrigo.latitude),
          numero(abrigo.longitude)
        )
      : null;
    const avaliada = notaDaNecessidade(necessidade, km);

    if (avaliada == null) {
      return;
    }

    lista.push({
      necessidadeId: necessidade.id,
      abrigoId: abrigo.id,
      abrigoNome: abrigo.nome,
      titulo: necessidade.title,
      faltam: avaliada.falta,
      unidade: necessidade.unidade || '',
      urgente: Boolean(necessidade.urgente),
      distanciaKm: km != null ? Math.round(km * 10) / 10 : null,
      motivo: explicar(necessidade, km),
      nota: Math.round(avaliada.nota * 10) / 10,
    });
  });

  return lista.sort((a, b) => b.nota - a.nota).slice(0, limite);
}

export async function buscarRecomendacoes(localizacao) {
  const [abrigos, necessidades] = await Promise.all([carregarAbrigosDoAparelho(), loadNeeds()]);

  return recomendar(abrigos, necessidades, localizacao);
}

// ---------------- Painel do gestor ----------------

export function montarRelatorio(abrigoId, necessidades) {
  const doAbrigo = necessidades.filter((item) => String(item.abrigoId) === String(abrigoId));
  const doadores = new Set();

  const itens = doAbrigo.map((necessidade) => {
    const contribuicoes = comoLista(necessidade.contribuicoes);

    contribuicoes.forEach((uma) => doadores.add(uma.porUid || uma.por));

    return {
      titulo: necessidade.title || '',
      unidade: necessidade.unidade || '',
      meta: numero(necessidade.alvo),
      prometido: somar(contribuicoes, 'quantidade'),
      recebido: somar(contribuicoes.filter((uma) => uma.entregue), 'quantidade'),
      atendida: Boolean(necessidade.done),
    };
  });

  return {
    necessidades: itens.length,
    atendidas: itens.filter((item) => item.atendida).length,
    doadores: doadores.size,
    prometido: somar(itens, 'prometido'),
    recebido: somar(itens, 'recebido'),
    itens: itens,
  };
}

// Separado por ponto e vírgula, que é o que o Excel em português espera.
export function montarPlanilha(relatorio) {
  const celula = (valor) => {
    const texto = String(valor);

    return /[;"\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  };
  const linhas = [['Necessidade', 'Unidade', 'Meta', 'Prometido', 'Recebido', 'Atendida']];

  relatorio.itens.forEach((item) => {
    linhas.push([
      item.titulo,
      item.unidade,
      item.meta,
      item.prometido,
      item.recebido,
      item.atendida ? 'sim' : 'não',
    ]);
  });

  return linhas.map((linha) => linha.map(celula).join(';')).join('\n');
}

export async function buscarRelatorio(abrigoId) {
  return montarRelatorio(abrigoId, await loadNeeds());
}

export async function buscarPlanilha(abrigoId) {
  return montarPlanilha(await buscarRelatorio(abrigoId));
}

// ---------------- Denúncias ----------------

// Um erro com status é uma recusa que a tela mostra como está; sem status, a tela
// pede para conferir a internet.
function recusa(mensagem) {
  const erro = new Error(mensagem);

  erro.status = 400;

  return erro;
}

export async function denunciarAbrigo(abrigoId, motivo, detalhe) {
  const usuario = await usuarioAtual();

  if (usuario == null) {
    throw recusa('É preciso entrar na conta para denunciar.');
  }

  if (!MOTIVOS_DE_DENUNCIA.some((item) => item.id === motivo)) {
    throw recusa('Escolha um dos motivos da lista.');
  }

  const abrigo = (await carregarAbrigosDoAparelho()).find((item) => String(item.id) === String(abrigoId));

  if (abrigo && ehDono(abrigo, { email: usuario.email })) {
    throw recusa('Não é possível denunciar o próprio abrigo.');
  }

  await gravarDenuncia(usuario, abrigoId, {
    motivo: motivo,
    detalhe: String(detalhe || '').slice(0, 500),
    em: new Date().toISOString(),
  });
}

// O gestor vê o motivo e a data, nunca quem denunciou.
export async function buscarDenuncias(abrigoId) {
  const lista = await lerDenuncias(abrigoId);

  return lista
    .map((uma) => ({ motivo: uma.motivo, detalhe: uma.detalhe || '', em: uma.em || '' }))
    .sort((a, b) => String(b.em).localeCompare(String(a.em)));
}
