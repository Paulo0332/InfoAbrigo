import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

// O Firebase é o banco do aplicativo: contas pelo Authentication e dados pelo
// Realtime Database. As chaves vêm do .env. Sem elas, tudo fica só no aparelho, e
// é assim que o aplicativo continua abrindo para quem só quer ver as telas.
const configuracao = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Endereço do computador com o emulador do Firebase, só para testar.
const emulador = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR;

let servicos = null;

export function temFirebase() {
  return Boolean(configuracao.apiKey && configuracao.databaseURL);
}

function iniciar() {
  if (servicos != null) {
    return servicos;
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(configuracao);

  // A persistência é o que mantém a pessoa conectada depois de fechar o aplicativo.
  const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  const banco = getDatabase(app);

  if (emulador) {
    connectAuthEmulator(auth, 'http://' + emulador + ':9099', { disableWarnings: true });
    connectDatabaseEmulator(banco, emulador, 9000);
  }

  servicos = { auth, banco };

  return servicos;
}

export function obterAuth() {
  return iniciar().auth;
}

export function obterBanco() {
  return iniciar().banco;
}

// A sessão salva é lida do disco sem pressa: sem esperar, um aplicativo recém-aberto
// acharia que ninguém entrou.
export async function usuarioAtual() {
  if (!temFirebase()) {
    return null;
  }

  const auth = obterAuth();

  await auth.authStateReady();

  return auth.currentUser;
}
