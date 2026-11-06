import NetInfo from '@react-native-community/netinfo';
import { get, onValue, ref, set, update } from 'firebase/database';

import { SemConexao } from './api';
import { obterBanco } from './firebase';

// Grava e lê no Realtime Database.
//
// O SDK do Firebase guarda sozinho o que é gravado sem internet, mas a promessa só
// termina quando a gravação chega, o que pode nunca acontecer. Com a fila própria do
// aplicativo, isso seria ruim nos dois sentidos: a sincronização ficaria parada, e a
// faixa de aviso não saberia o que falta. Por isso cada gravação só começa com
// conexão confirmada e tem tempo máximo.
const ESPERA_DA_CONEXAO = 5000;
const ESPERA_DA_GRAVACAO = 8000;

export class RecusadoPeloBanco extends Error {}

export function chaveSegura(texto) {
  return String(texto).replace(/[.#$/[\]]/g, '_');
}

// O banco recusa undefined, e guarda null como "não existe".
function limpo(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function comTempo(promessa) {
  let relogio;

  return Promise.race([
    promessa,
    new Promise((resolve, reject) => {
      relogio = setTimeout(
        () => reject(new SemConexao('O Firebase não respondeu agora.')),
        ESPERA_DA_GRAVACAO
      );
    }),
  ]).finally(() => clearTimeout(relogio));
}

async function garantirConexao() {
  const rede = await NetInfo.fetch();

  if (rede.isConnected === false) {
    throw new SemConexao('Sem internet.');
  }

  await new Promise((resolve, reject) => {
    let parar = () => {};

    const relogio = setTimeout(() => {
      parar();
      reject(new SemConexao('Sem conexão com o Firebase.'));
    }, ESPERA_DA_CONEXAO);

    parar = onValue(ref(obterBanco(), '.info/connected'), (estado) => {
      if (estado.val() === true) {
        clearTimeout(relogio);
        setTimeout(() => parar(), 0);
        resolve();
      }
    });
  });
}

function traduzir(error) {
  if (error instanceof SemConexao) {
    return error;
  }

  const texto = String((error && (error.code || error.message)) || '');

  if (/permission/i.test(texto)) {
    return new RecusadoPeloBanco(texto);
  }

  return new SemConexao(texto);
}

async function executar(tarefa) {
  await garantirConexao();

  try {
    return await comTempo(tarefa());
  } catch (error) {
    throw traduzir(error);
  }
}

function caminho(texto) {
  return ref(obterBanco(), texto);
}

function comoLista(valor) {
  return valor == null ? [] : Object.values(valor).filter(Boolean);
}

async function ler(texto) {
  const dados = await executar(() => get(caminho(texto)));

  return dados.val();
}

// ---------------- Conta ----------------

export function gravarPerfil(uid, campos) {
  return executar(() => update(caminho('contas/' + uid), limpo(campos)));
}

export function lerPerfil(uid) {
  return ler('contas/' + uid);
}

// ---------------- Abrigos ----------------

export function gravarAbrigo(usuario, abrigo) {
  const { verificacao, alerta, ...dados } = abrigo;

  return executar(() =>
    set(
      caminho('abrigos/' + chaveSegura(abrigo.id)),
      limpo({ ...dados, id: String(abrigo.id), dono: usuario.email, donoUid: usuario.uid })
    )
  );
}

// O abrigo leva as necessidades dele: sem abrigo, elas ficariam na lista sem
// ninguém que possa atender ou retirar.
export async function apagarAbrigo(id) {
  const necessidades = comoLista(await ler('necessidades'));
  const trocas = { ['abrigos/' + chaveSegura(id)]: null };

  necessidades
    .filter((necessidade) => String(necessidade.abrigoId) === String(id))
    .forEach((necessidade) => {
      trocas['necessidades/' + chaveSegura(necessidade.id)] = null;
    });

  await executar(() => update(ref(obterBanco()), trocas));
}

// ---------------- Necessidades ----------------

// O celular conhece a necessidade inteira, com a lista de contribuições como ele a
// viu. Regravar tudo apagaria a promessa de quem doou enquanto este estava sem
// internet. Por isso o que muda é escrito campo a campo: cada pessoa só mexe na
// própria contribuição, e só quem administra muda o resto e marca a entrega. As
// regras do banco confirmam isso; aqui é para o pedido já sair correto.
export async function gravarNecessidade(usuario, necessidade) {
  const id = chaveSegura(necessidade.id);
  const base = 'necessidades/' + id;
  const atual = (await ler(base)) || {};
  const abrigoId = atual.abrigoId || necessidade.abrigoId || null;
  const donoDoAbrigo = abrigoId ? await ler('abrigos/' + chaveSegura(abrigoId) + '/donoUid') : null;
  const administra =
    donoDoAbrigo === usuario.uid ||
    (!donoDoAbrigo && (atual.criadoPor || usuario.uid) === usuario.uid);
  const trocas = {};

  if (administra) {
    const { contribuicoes, ...campos } = limpo(necessidade);
    const nomes = new Set([...Object.keys(campos), ...Object.keys(atual)]);

    nomes.delete('contribuicoes');

    nomes.forEach((nome) => {
      trocas[base + '/' + nome] = campos[nome] === undefined ? null : campos[nome];
    });

    trocas[base + '/id'] = String(necessidade.id);
    trocas[base + '/criadoPor'] = atual.criadoPor || usuario.uid;
    trocas[base + '/abrigoId'] = abrigoId;
  }

  const gravadas = atual.contribuicoes || {};
  const vistas = new Set();

  (Array.isArray(necessidade.contribuicoes) ? necessidade.contribuicoes : []).forEach((uma) => {
    const chave = chaveSegura(uma.id);
    const gravada = gravadas[chave];
    const minha = gravada
      ? gravada.porUid === usuario.uid
      : (uma.por || '').trim().toLowerCase() === usuario.email;

    vistas.add(chave);

    if (minha) {
      trocas[base + '/contribuicoes/' + chave] = limpo({
        ...uma,
        por: usuario.email,
        porUid: usuario.uid,
        entregue: administra ? uma.entregue === true : Boolean(gravada && gravada.entregue),
      });
    } else if (administra && gravada && gravada.entregue !== (uma.entregue === true)) {
      trocas[base + '/contribuicoes/' + chave + '/entregue'] = uma.entregue === true;
    }
  });

  Object.keys(gravadas).forEach((chave) => {
    if (!vistas.has(chave) && gravadas[chave].porUid === usuario.uid) {
      trocas[base + '/contribuicoes/' + chave] = null;
    }
  });

  if (Object.keys(trocas).length === 0) {
    return;
  }

  await executar(() => update(ref(obterBanco()), trocas));
}

export function apagarNecessidade(id) {
  return executar(() => set(caminho('necessidades/' + chaveSegura(id)), null));
}

// ---------------- Registros privados ----------------

export function gravarPrivado(colecao, usuario, registro) {
  return executar(() =>
    set(
      caminho(colecao + '/' + usuario.uid + '/' + chaveSegura(registro.id)),
      limpo({ ...registro, id: String(registro.id), conta: usuario.email })
    )
  );
}

export function apagarPrivado(colecao, usuario, id) {
  return executar(() => set(caminho(colecao + '/' + usuario.uid + '/' + chaveSegura(id)), null));
}

// ---------------- Leitura geral ----------------

function aberta(necessidade) {
  return { ...necessidade, contribuicoes: comoLista(necessidade.contribuicoes) };
}

function maisNovosPrimeiro(lista) {
  return [...lista].sort((a, b) => String(b.id).localeCompare(String(a.id), 'en', { numeric: true }));
}

// A situação de uma doação de item vem da entrega marcada pelo abrigo. O abrigo não
// pode gravar na doação de outra pessoa, porque ela é privada; quem doou lê a marca
// na necessidade e atualiza a própria cópia.
function aplicarEntregas(doacoes, necessidades) {
  const entregas = new Map();

  necessidades.forEach((necessidade) => {
    necessidade.contribuicoes.forEach((uma) => {
      if (uma.doacaoId != null) {
        entregas.set(String(uma.doacaoId), uma.entregue === true);
      }
    });
  });

  return doacoes.map((doacao) => {
    if (doacao.tipo !== 'item' || !entregas.has(String(doacao.id))) {
      return doacao;
    }

    return { ...doacao, situacao: entregas.get(String(doacao.id)) ? 'confirmada' : 'pendente' };
  });
}

export async function lerTudo(usuario) {
  const [abrigos, necessidades, doacoes, compromissos, verificacoes, alertas] = await Promise.all([
    ler('abrigos'),
    ler('necessidades'),
    ler('doacoes/' + usuario.uid),
    ler('compromissos/' + usuario.uid),
    ler('verificacoes'),
    ler('alertas'),
  ]);

  const listaDeNecessidades = maisNovosPrimeiro(comoLista(necessidades).map(aberta));

  return {
    // O selo e o alerta são escritos pela API, em nós próprios, e não pelo dono do
    // abrigo. Se morassem dentro do abrigo, ele conseguiria alterá-los.
    abrigos: maisNovosPrimeiro(comoLista(abrigos)).map((abrigo) => {
      const chave = chaveSegura(abrigo.id);
      const extras = {};

      if (verificacoes && verificacoes[chave]) {
        extras.verificacao = verificacoes[chave];
      }

      if (alertas && alertas[chave]) {
        extras.alerta = alertas[chave];
      }

      return { ...abrigo, ...extras };
    }),
    necessidades: listaDeNecessidades,
    doacoes: maisNovosPrimeiro(aplicarEntregas(comoLista(doacoes), listaDeNecessidades)),
    compromissos: maisNovosPrimeiro(comoLista(compromissos)),
  };
}

// Avisa quando outro celular muda abrigos ou necessidades. O banco entrega o valor
// atual assim que alguém começa a escutar, e esse primeiro não é novidade.
export function ouvirMudancas(aoMudar) {
  const paradas = ['abrigos', 'necessidades', 'verificacoes', 'alertas'].map((nome) => {
    let primeira = true;

    return onValue(
      caminho(nome),
      () => {
        if (primeira) {
          primeira = false;

          return;
        }

        aoMudar();
      },
      (error) => console.log('Erro ao escutar o Firebase:', error)
    );
  });

  return () => paradas.forEach((parar) => parar());
}

// Tudo que é da pessoa, de uma vez. As promessas em necessidades de outros abrigos
// saem junto; os abrigos dela levam as necessidades deles.
export async function apagarDadosDaPessoa(usuario) {
  const [abrigos, necessidades] = await Promise.all([ler('abrigos'), ler('necessidades')]);
  const meus = comoLista(abrigos).filter((abrigo) => abrigo.donoUid === usuario.uid);
  const idsDosMeus = new Set(meus.map((abrigo) => String(abrigo.id)));
  const trocas = {
    ['contas/' + usuario.uid]: null,
    ['doacoes/' + usuario.uid]: null,
    ['compromissos/' + usuario.uid]: null,
  };

  comoLista(necessidades).forEach((necessidade) => {
    const chave = chaveSegura(necessidade.id);

    if (
      idsDosMeus.has(String(necessidade.abrigoId)) ||
      (!necessidade.abrigoId && necessidade.criadoPor === usuario.uid)
    ) {
      trocas['necessidades/' + chave] = null;

      return;
    }

    Object.entries(necessidade.contribuicoes || {}).forEach(([id, uma]) => {
      if (uma.porUid === usuario.uid) {
        trocas['necessidades/' + chave + '/contribuicoes/' + id] = null;
      }
    });
  });

  meus.forEach((abrigo) => {
    trocas['abrigos/' + chaveSegura(abrigo.id)] = null;
  });

  await executar(() => update(ref(obterBanco()), trocas));
}
