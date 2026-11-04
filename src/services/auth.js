import AsyncStorage from '@react-native-async-storage/async-storage';

import { pedirEnvio } from './bancoLocal';
import { CHAVE_ATUAL, carregarConta } from './contaAtual';
import { usuarioAtual } from './firebase';
import { avisarMudanca } from './sincronizacao';

// Duas chaves, com papéis diferentes: uma guarda todas as contas criadas
// neste aparelho, a outra diz qual delas está em uso agora.
//
// Antes existia só a segunda, e com ela uma conta por aparelho. Para ver
// o aplicativo pelo lado do gestor e pelo lado de quem doa era preciso
// apagar a conta e criar outra — perdendo tudo no caminho.
const CHAVE_CONTAS = '@infoabrigo:contas';

export { carregarConta };

function mesmoEmail(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

export async function carregarContas() {
  try {
    const dados = await AsyncStorage.getItem(CHAVE_CONTAS);

    if (dados != null) {
      return JSON.parse(dados);
    }

    // Aparelho que já usava a versão de uma conta só: ela vira a primeira
    // da lista, e ninguém perde o cadastro na atualização.
    const antiga = await AsyncStorage.getItem(CHAVE_ATUAL);

    if (antiga == null) {
      return [];
    }

    const lista = [JSON.parse(antiga)];

    await AsyncStorage.setItem(CHAVE_CONTAS, JSON.stringify(lista));

    return lista;
  } catch (error) {
    console.log('Erro ao carregar as contas:', error);

    throw error;
  }
}

// O que mudou na conta e precisa chegar ao banco. A preferência de biometria e a
// foto de perfil são deste aparelho e ficam de fora, e a senha é assunto do Firebase
// Authentication, nunca do banco.
export function mudancasDaConta(anterior, conta) {
  const mudou = (campo) =>
    JSON.stringify(anterior[campo] ?? null) !== JSON.stringify(conta[campo] ?? null);
  const campos = {};

  ['nome', 'perfil', 'instituicao', 'telefone'].forEach((campo) => {
    if (mudou(campo)) {
      campos[campo] = conta[campo] ?? null;
    }
  });

  return campos;
}

// Salva a conta alterada por uma tela e deixa o pedido na fila do servidor.
export async function salvarConta(conta) {
  const anterior = await buscarContaPorEmail(conta.email);

  await gravarContaLocal(conta);

  const usuario = await usuarioAtual();

  if (anterior == null || usuario == null || usuario.email !== conta.email.trim().toLowerCase()) {
    return;
  }

  const campos = mudancasDaConta(anterior, conta);

  if (Object.keys(campos).length > 0) {
    await pedirEnvio('contas', 'conta', 'eu', campos, conta.email);
    avisarMudanca();
  }
}

// Grava a conta na lista — trocando no lugar se já existir uma com o
// mesmo e-mail — e deixa ela como a conta em uso.
export async function gravarContaLocal(conta) {
  try {
    const contas = await carregarContas();
    const jaExiste = contas.some((item) => mesmoEmail(item.email, conta.email));

    const nova = jaExiste
      ? contas.map((item) => (mesmoEmail(item.email, conta.email) ? conta : item))
      : [conta, ...contas];

    await AsyncStorage.setItem(CHAVE_CONTAS, JSON.stringify(nova));
    await AsyncStorage.setItem(CHAVE_ATUAL, JSON.stringify(conta));
  } catch (error) {
    console.log('Erro ao salvar a conta:', error);

    throw error;
  }
}

// Entrar só troca qual conta está em uso. Diferente do salvarConta, que
// regrava o cadastro inteiro: aqui nada do que está guardado muda.
export async function entrarNaConta(conta) {
  try {
    await AsyncStorage.setItem(CHAVE_ATUAL, JSON.stringify(conta));
  } catch (error) {
    console.log('Erro ao entrar na conta:', error);

    throw error;
  }
}

// Sair não apaga nada: a conta continua na lista, só deixa de ser a que
// está em uso. É o que separa "sair" de "apagar a conta deste aparelho".
export async function sairDaConta() {
  try {
    await AsyncStorage.removeItem(CHAVE_ATUAL);
  } catch (error) {
    console.log('Erro ao sair da conta:', error);

    throw error;
  }
}

// Sem e-mail, apaga a conta em uso. É a chamada que a tela de perfil já
// fazia antes de existir mais de uma conta.
export async function apagarConta(email) {
  try {
    const atual = await carregarConta();
    const alvo = email || (atual ? atual.email : null);

    if (alvo == null) {
      return;
    }

    const contas = await carregarContas();
    const nova = contas.filter((item) => !mesmoEmail(item.email, alvo));

    await AsyncStorage.setItem(CHAVE_CONTAS, JSON.stringify(nova));

    if (atual && mesmoEmail(atual.email, alvo)) {
      await AsyncStorage.removeItem(CHAVE_ATUAL);
    }
  } catch (error) {
    console.log('Erro ao apagar a conta:', error);

    throw error;
  }
}

export async function buscarContaPorEmail(email) {
  const contas = await carregarContas();

  return contas.find((item) => mesmoEmail(item.email, email)) || null;
}

export function emailJaUsado(contas, email) {
  return contas.some((item) => mesmoEmail(item.email, email));
}
