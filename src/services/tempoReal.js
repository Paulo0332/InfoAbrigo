import { getApps, initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, set } from 'firebase/database';

// O aviso de que algo mudou, pelo Realtime Database do Firebase.
//
// Os dados continuam na API. Por aqui só passa um horário: quem gravou no servidor
// atualiza `novidades/em`, e os outros celulares, que estão escutando esse ponto,
// vão buscar na API na mesma hora. Sem isso, uma promessa de doação só apareceria
// para o gestor quando ele abrisse a tela de novo. E como nenhum dado de pessoa
// passa pelo Firebase, ele não precisa saber quem é quem.
//
// Sem as chaves no .env, o aplicativo funciona igual, só sem o aviso instantâneo.
const configuracao = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const CAMINHO = 'novidades/em';

export function temFirebase() {
  return Boolean(configuracao.apiKey && configuracao.databaseURL);
}

function banco() {
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(configuracao);

  return getDatabase(app);
}

export async function avisarNovidade() {
  if (!temFirebase()) {
    return;
  }

  // O aviso é um extra: se ele falhar, o dado já está salvo na API.
  try {
    await set(ref(banco(), CAMINHO), Date.now());
  } catch (error) {
    console.log('Erro ao avisar a novidade pelo Firebase:', error);
  }
}

// O Firebase entrega o valor atual assim que alguém começa a escutar. Esse primeiro
// valor não é novidade nenhuma, e por isso é ignorado. Devolve a função que para.
export function ouvirNovidades(aoChegar) {
  if (!temFirebase()) {
    return () => {};
  }

  try {
    let primeira = true;

    return onValue(
      ref(banco(), CAMINHO),
      () => {
        if (primeira) {
          primeira = false;

          return;
        }

        aoChegar();
      },
      (error) => {
        console.log('Erro ao escutar o Firebase:', error);
      }
    );
  } catch (error) {
    console.log('Erro ao ligar o Firebase:', error);

    return () => {};
  }
}
