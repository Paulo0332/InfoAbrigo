import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../src/screens/HomeScreen';
import LoginScreen from '../src/screens/LoginScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import ScheduleScreen from '../src/screens/ScheduleScreen';
import SignUpScreen from '../src/screens/SignUpScreen';
import * as avisos from '../src/services/avisos';
import { salvarConta } from '../src/services/auth';
import { adicionarAoCalendario, atualizarBadge } from '../src/services/recursosNativos';
import { salvarAgendaDaConta } from '../src/services/agenda';
import { resumir } from '../src/services/senha';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efeito) => require('react').useEffect(efeito, []),
  useIsFocused: () => true,
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../src/services/recursosNativos', () => ({
  adicionarAoCalendario: jest.fn(async () => {}),
  atualizarBadge: jest.fn(async () => true),
  reprogramarLembretes: jest.fn(async () => {}),
}));

const area = {
  frame: { x: 0, y: 0, width: 390, height: 800 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function navegacao() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
    addListener: jest.fn(() => () => {}),
    getParent: jest.fn(() => ({ replace: jest.fn() })),
  };
}

async function abrir(Tela, params) {
  return render(
    <SafeAreaProvider initialMetrics={area}>
      <Tela navigation={navegacao()} route={{ params: params }} />
    </SafeAreaProvider>
  );
}

async function criarConta() {
  await salvarConta({
    nome: 'Ana Souza',
    email: 'ana@teste.com',
    sal: 'sal-de-teste',
    senhaResumo: await resumir('segredo', 'sal-de-teste'),
    perfil: 'doador',
    instituicao: null,
    biometriaAtiva: false,
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('telas', () => {
  test('entrada sem conta oferece criar uma', async () => {
    await abrir(LoginScreen);

    expect(await screen.findByText('Criar conta')).toBeTruthy();
    expect(screen.queryByText('Já tenho conta em outro celular')).toBeNull();
  });

  test('entrada com conta confere a senha do aparelho sem servidor', async () => {
    await criarConta();
    await abrir(LoginScreen);

    expect(await screen.findByText('Olá, Ana Souza!')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('Sua senha'), 'errada');
    await fireEvent.press(screen.getByText('Entrar'));

    await fireEvent.changeText(screen.getByPlaceholderText('Sua senha'), 'segredo');
    await fireEvent.press(screen.getByText('Entrar'));
  });

  test('entrada mostra a opção de outro celular quando há servidor', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:9';

    try {
      await abrir(LoginScreen);

      await fireEvent.press(await screen.findByText('Já tenho conta em outro celular'));

      expect(screen.getByPlaceholderText('O e-mail da sua conta')).toBeTruthy();
    } finally {
      delete process.env.EXPO_PUBLIC_API_URL;
    }
  });

  test('cadastro abre', async () => {
    await abrir(SignUpScreen);

    expect(await screen.findByText(/apenas neste aparelho/)).toBeTruthy();
  });

  test('início abre e leva os avisos novos para o ícone do aplicativo', async () => {
    jest.spyOn(avisos, 'carregarVistos').mockResolvedValue([]);
    await criarConta();
    await abrir(HomeScreen);

    await waitFor(() => expect(atualizarBadge).toHaveBeenCalled());
  });

  test('agenda abre e leva o compromisso para o calendário do celular', async () => {
    await criarConta();
    await salvarAgendaDaConta(
      [
        {
          id: 'c1',
          tipo: 'visita',
          abrigoNome: 'Casa Lar',
          quando: new Date(Date.now() + 86400000).toISOString(),
          conta: 'ana@teste.com',
        },
      ],
      { email: 'ana@teste.com' }
    );
    await abrir(ScheduleScreen);

    const botao = await screen.findByLabelText('Adicionar ao calendário do celular');

    await fireEvent.press(botao);

    expect(adicionarAoCalendario).toHaveBeenCalledWith(
      'Visita ao abrigo — Casa Lar',
      expect.any(String),
      '',
      undefined
    );
  });

  test('perfil abre e diz onde os dados estão', async () => {
    await criarConta();
    await abrir(ProfileScreen);

    expect(await screen.findByText(/ficam só neste aparelho/)).toBeTruthy();
  });
});
