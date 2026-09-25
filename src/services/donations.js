import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@infoabrigo:doacoes';

// Uma doação é de dinheiro ou de um item da lista do abrigo. Os dois
// moram no mesmo histórico, porque para quem doa é tudo ajuda; o que
// muda é o que aparece escrito no cartão.
export const DINHEIRO = 'dinheiro';
export const ITEM = 'item';

// Os registros gravados antes deste campo existir eram todos de dinheiro.
export function tipoDaDoacao(doacao) {
  return doacao.tipo || DINHEIRO;
}

export async function carregarDoacoes() {
  try {
    const dados = await AsyncStorage.getItem(STORAGE_KEY);

    return dados != null ? JSON.parse(dados) : [];
  } catch (error) {
    console.log('Erro ao carregar as doações:', error);

    throw error;
  }
}

// Acrescenta uma doação ao histórico. Lê a lista atual, põe a nova na
// frente e grava de volta: é o mesmo spread do Módulo 1, com a diferença
// de que aqui a lista vem do disco em vez do estado da tela.
export async function registrarDoacao(doacao) {
  try {
    const atuais = await carregarDoacoes();
    const nova = [doacao, ...atuais];

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nova));

    return nova;
  } catch (error) {
    console.log('Erro ao registrar a doação:', error);

    throw error;
  }
}

// Usado quando alguém desiste de levar um item que tinha reservado: a
// promessa sai do histórico junto com a reserva.
export async function apagarDoacao(id) {
  try {
    const atuais = await carregarDoacoes();
    const nova = atuais.filter((doacao) => doacao.id !== id);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nova));

    return nova;
  } catch (error) {
    console.log('Erro ao apagar a doação:', error);

    throw error;
  }
}

export function totalEmDinheiro(lista) {
  return lista
    .filter((doacao) => tipoDaDoacao(doacao) === DINHEIRO)
    .reduce((soma, doacao) => soma + Number(doacao.valor || 0), 0);
}

export function totalDeItens(lista) {
  return lista.filter((doacao) => tipoDaDoacao(doacao) === ITEM).length;
}

// O real escrito como as pessoas leem, com ponto no milhar e vírgula nos
// centavos. Feito na mão de propósito: o toLocaleString depende da
// biblioteca de idiomas do aparelho, que nem sempre vem completa no
// Android, e aí o valor sairia diferente de celular para celular.
export function formatarReais(valor) {
  const centavos = Math.round(Number(valor || 0) * 100);
  const inteiro = Math.floor(centavos / 100);
  const resto = String(centavos % 100).padStart(2, '0');
  const comPonto = String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return comPonto + ',' + resto;
}
