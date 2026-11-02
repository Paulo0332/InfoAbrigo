const cofre = new Map();

module.exports = {
  getItemAsync: async (chave) => (cofre.has(chave) ? cofre.get(chave) : null),
  setItemAsync: async (chave, valor) => {
    cofre.set(chave, valor);
  },
  deleteItemAsync: async (chave) => {
    cofre.delete(chave);
  },
};
