import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@infoabrigo:conta';

export async function salvarConta(conta) {
  try {
    // O AsyncStorage só guarda texto, então o objeto da conta vira JSON.
    const dados = JSON.stringify(conta);

    await AsyncStorage.setItem(STORAGE_KEY, dados);
  } catch (error) {
    console.log('Erro ao salvar a conta:', error);

    throw error;
  }
}

export async function carregarConta() {
  try {
    const dados = await AsyncStorage.getItem(STORAGE_KEY);

    // Sem conta gravada o getItem devolve null, e é assim que a tela de
    // login sabe que precisa oferecer o cadastro em vez da entrada.
    return dados != null ? JSON.parse(dados) : null;
  } catch (error) {
    console.log('Erro ao carregar a conta:', error);

    throw error;
  }
}

export async function apagarConta() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.log('Erro ao apagar a conta:', error);

    throw error;
  }
}
