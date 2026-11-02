import * as SecureStore from 'expo-secure-store';

// O token da sessão dá acesso à conta, então fica no cofre do aparelho, e não
// junto dos dados comuns. É um por conta, porque o aparelho guarda mais de uma.
function chave(email) {
  return 'infoabrigo.sessao.' + email.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
}

export async function lerToken(email) {
  try {
    return await SecureStore.getItemAsync(chave(email));
  } catch (error) {
    console.log('Erro ao ler a sessão:', error);

    return null;
  }
}

export async function guardarToken(email, token) {
  await SecureStore.setItemAsync(chave(email), token);
}

export async function apagarToken(email) {
  try {
    await SecureStore.deleteItemAsync(chave(email));
  } catch (error) {
    console.log('Erro ao apagar a sessão:', error);
  }
}
