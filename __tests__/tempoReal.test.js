// O Firebase é simulado: o que se testa é a regra de quando avisar e quando buscar.
const mockEscutas = [];
const mockGravar = jest.fn(async () => {});

jest.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: () => ({}),
}));

jest.mock('firebase/database', () => ({
  getDatabase: () => ({}),
  ref: (banco, caminho) => caminho,
  set: (...args) => mockGravar(...args),
  onValue: (caminho, aoMudar) => {
    mockEscutas.push(aoMudar);

    return () => {};
  },
}));

function carregar(comChaves) {
  jest.resetModules();

  if (comChaves) {
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'chave';
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL = 'https://exemplo.firebaseio.com';
  } else {
    delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    delete process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL;
  }

  return require('../src/services/tempoReal');
}

beforeEach(() => {
  mockEscutas.length = 0;
  mockGravar.mockClear();
});

afterAll(() => {
  carregar(false);
});

test('sem as chaves, nada acontece e nada quebra', async () => {
  const tempoReal = carregar(false);
  const aoChegar = jest.fn();

  expect(tempoReal.temFirebase()).toBe(false);

  await tempoReal.avisarNovidade();
  tempoReal.ouvirNovidades(aoChegar)();

  expect(mockGravar).not.toHaveBeenCalled();
  expect(mockEscutas).toHaveLength(0);
});

test('avisar grava só um horário, sem nenhum dado de pessoa', async () => {
  const tempoReal = carregar(true);

  await tempoReal.avisarNovidade();

  expect(mockGravar).toHaveBeenCalledWith('novidades/em', expect.any(Number));
});

test('o valor que já estava lá não conta como novidade', () => {
  const tempoReal = carregar(true);
  const aoChegar = jest.fn();

  tempoReal.ouvirNovidades(aoChegar);

  mockEscutas[0]();
  expect(aoChegar).not.toHaveBeenCalled();

  mockEscutas[0]();
  expect(aoChegar).toHaveBeenCalledTimes(1);
});

test('falha no Firebase não derruba quem gravou', async () => {
  const tempoReal = carregar(true);

  mockGravar.mockRejectedValueOnce(new Error('sem permissão'));

  await expect(tempoReal.avisarNovidade()).resolves.toBeUndefined();
});
