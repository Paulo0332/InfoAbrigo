// O ambiente de testes do React Native troca o fetch por um falso. Este fala de
// verdade com a API local, com o pouco que src/services/api.js usa.
const http = require('node:http');

module.exports = function fetchDoNode(url, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const pedido = http.request(
      url,
      { method: opcoes.method || 'GET', headers: opcoes.headers },
      (resposta) => {
        const partes = [];

        resposta.on('data', (parte) => partes.push(parte));
        resposta.on('end', () => {
          const texto = Buffer.concat(partes).toString('utf8');

          resolve({
            status: resposta.statusCode,
            ok: resposta.statusCode >= 200 && resposta.statusCode < 300,
            json: async () => JSON.parse(texto),
          });
        });
      }
    );

    pedido.on('error', reject);
    pedido.end(opcoes.body);
  });
};
