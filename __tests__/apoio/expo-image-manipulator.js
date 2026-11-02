// Devolve sempre um JPEG mínimo: o que interessa nos testes é a foto subir.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

module.exports = {
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize() {
        return this;
      },
      renderAsync: async () => ({
        saveAsync: async () => ({ base64: JPEG }),
      }),
    }),
  },
};
