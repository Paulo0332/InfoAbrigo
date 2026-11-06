// Os testes simulam ficar sem internet ligando global.__semInternet.
module.exports = {
  __esModule: true,
  default: {
    fetch: async () => ({ isConnected: global.__semInternet !== true }),
    addEventListener: (ouvinte) => {
      ouvinte({ isConnected: global.__semInternet !== true });

      return () => {};
    },
  },
};
