// O axios de verdade, com o transporte trocado: o ambiente de testes não tem o
// XMLHttpRequest do celular. Quem atende é o global.fetch de cada teste.
const axios = require('axios/dist/browser/axios.cjs');
const biblioteca = axios.default || axios;

biblioteca.defaults.adapter = async (config) => {
  let url = config.url;

  if (config.baseURL) {
    url = config.baseURL + url;
  }

  let resposta;

  try {
    resposta = await global.fetch(url, {
      method: config.method.toUpperCase(),
      headers: config.headers.toJSON ? config.headers.toJSON() : config.headers,
      body: config.data,
    });
  } catch (error) {
    throw new biblioteca.AxiosError(error.message, biblioteca.AxiosError.ERR_NETWORK, config);
  }

  return {
    data: await resposta.json().catch(() => ''),
    status: resposta.status,
    statusText: '',
    headers: {},
    config: config,
  };
};

module.exports = axios;
