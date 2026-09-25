import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@infoabrigo:atividades';

export async function salvarAtividades(lista) {
  try {
    const dados = JSON.stringify(lista);

    await AsyncStorage.setItem(STORAGE_KEY, dados);
  } catch (error) {
    console.log('Erro ao salvar as atividades:', error);

    throw error;
  }
}

export async function carregarAtividades() {
  try {
    const dados = await AsyncStorage.getItem(STORAGE_KEY);

    // Sem nada gravado devolvemos lista vazia, e não null: quem chama
    // sempre recebe algo que pode percorrer com map ou filter.
    return dados != null ? JSON.parse(dados) : [];
  } catch (error) {
    console.log('Erro ao carregar as atividades:', error);

    throw error;
  }
}
