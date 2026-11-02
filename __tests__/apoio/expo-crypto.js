const { createHash, randomUUID } = require('node:crypto');

module.exports = {
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  randomUUID: () => randomUUID(),
  digestStringAsync: async (algoritmo, texto) =>
    createHash('sha256').update(texto).digest('hex'),
};
