// O ambiente de testes do React Native troca o fetch por um falso. Este fala de
// verdade com a API local e com o emulador do Firebase.
const http = require('node:http');

module.exports = function fetchDoNode(url, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const cabecalhos = {};

    if (opcoes.headers && typeof opcoes.headers.forEach === 'function') {
      opcoes.headers.forEach((valor, nome) => {
        cabecalhos[nome] = valor;
      });
    } else {
      Object.assign(cabecalhos, opcoes.headers);
    }

    const pedido = http.request(
      String(url),
      { method: opcoes.method || 'GET', headers: cabecalhos },
      (resposta) => {
        const partes = [];

        resposta.on('data', (parte) => partes.push(parte));
        resposta.on('end', () => {
          const texto = Buffer.concat(partes).toString('utf8');

          resolve({
            status: resposta.statusCode,
            ok: resposta.statusCode >= 200 && resposta.statusCode < 300,
            headers: { get: (nome) => resposta.headers[nome.toLowerCase()] || null },
            json: async () => JSON.parse(texto),
            text: async () => texto,
          });
        });
      }
    );

    pedido.on('error', reject);
    pedido.end(opcoes.body);
  });
};
