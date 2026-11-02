import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHAVE_ATUAL = '@infoabrigo:conta';

export async function carregarConta() {
  try {
    const dados = await AsyncStorage.getItem(CHAVE_ATUAL);

    // Sem conta em uso o getItem devolve null, e é assim que a tela de
    // entrada sabe que precisa oferecer a lista ou o cadastro.
    return dados != null ? JSON.parse(dados) : null;
  } catch (error) {
    console.log('Erro ao carregar a conta:', error);

    throw error;
  }
}
