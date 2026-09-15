import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = "@infoabrigo:needs";

export async function saveNeeds(list) {
  try {
    const jsonValue = JSON.stringify(list);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (error) {
    console.log("Erro ao salvar necessidades:", error);
    throw error;
  }
}

export async function loadNeeds() {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.log("Erro ao carregar necessidades:", error);
    throw error;
  }
}
