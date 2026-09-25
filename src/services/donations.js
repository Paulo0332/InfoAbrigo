import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@infoabrigo:doacoes';

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
