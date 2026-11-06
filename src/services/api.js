import axios from 'axios';

// As APIs que o aplicativo consome, todas públicas, gratuitas e sem chave:
//
// - BrasilAPI: endereço pelo CEP e situação do CNPJ na Receita Federal;
// - Nominatim (OpenStreetMap): coordenada de um endereço;
// - Valhalla (OpenStreetMap): o caminho até o abrigo.
//
// Elas já estão na internet, mantidas por quem as publica. Por isso o aplicativo
// funciona em qualquer lugar, sem servidor nenhum ligado. O consumo segue o exemplo
// Task-Manager-API da disciplina: um cliente axios só, com tempo limite.
const cliente = axios.create({
  timeout: 10000,
  // Quem decide o que cada resposta significa é quem chamou: um 404 de CEP, por
  // exemplo, quer dizer "CEP inexistente", e não erro.
  validateStatus: () => true,
});

// Não deu para falar com o serviço: sem internet, ou ele não respondeu a tempo.
export class SemConexao extends Error {}

// Responde no mesmo formato do fetch (status, ok e json), para quem chama tratar a
// resposta do mesmo jeito em todos os serviços.
export async function consultar(url, opcoes = {}) {
  let resposta;

  try {
    resposta = await cliente.request({
      url: url,
      method: opcoes.method || 'GET',
      headers: opcoes.headers,
      data: opcoes.body,
    });
  } catch (error) {
    throw new SemConexao('Não foi possível falar com ' + url.split('/')[2] + '.');
  }

  return {
    status: resposta.status,
    ok: resposta.status >= 200 && resposta.status < 300,
    json: async () =>
      typeof resposta.data === 'string' && resposta.data !== ''
        ? JSON.parse(resposta.data)
        : resposta.data,
  };
}
