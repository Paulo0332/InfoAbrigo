// Fala com a API do InfoAbrigo.
//
// O endereço vem do arquivo .env (EXPO_PUBLIC_API_URL). Sem ele o aplicativo
// funciona como sempre funcionou: tudo fica só no aparelho. É assim que ele
// continua abrindo para quem só quer ver as telas, sem servidor nenhum.
const ESPERA_MAXIMA = 8000;

export function enderecoDaApi() {
  return (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
}

export function temServidor() {
  return enderecoDaApi() !== '';
}

// Separa "o servidor recusou" de "não deu para falar com o servidor". A
// primeira é uma resposta; a segunda só quer dizer tentar de novo depois.
export class ErroDaApi extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export class SemConexao extends Error {}

export async function pedir(metodo, caminho, corpo, token) {
  const cancelar = new AbortController();
  const relogio = setTimeout(() => cancelar.abort(), ESPERA_MAXIMA);

  let resposta;

  try {
    resposta = await fetch(enderecoDaApi() + caminho, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: cancelar.signal,
    });
  } catch (error) {
    throw new SemConexao('Não foi possível falar com o servidor.');
  } finally {
    clearTimeout(relogio);
  }

  // Servidor fora do ar responde 5xx, e isso é o mesmo que estar sem conexão:
  // a gravação continua na fila para a próxima tentativa.
  if (resposta.status >= 500 || resposta.status === 429) {
    throw new SemConexao('O servidor não respondeu agora.');
  }

  if (resposta.status === 204) {
    return null;
  }

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    throw new ErroDaApi(resposta.status, (dados && dados.erro) || 'Pedido recusado.');
  }

  return dados;
}
