import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../src/screens/HomeScreen';
import AvisoConexao, { textoDoAviso } from '../src/components/AvisoConexao';
import CameraFoto from '../src/components/CameraFoto';
import LoginScreen from '../src/screens/LoginScreen';
import MapScreen from '../src/screens/MapScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import ScheduleScreen from '../src/screens/ScheduleScreen';
import SignUpScreen from '../src/screens/SignUpScreen';
import * as avisos from '../src/services/avisos';
import { salvarConta } from '../src/services/auth';
import { adicionarAoCalendario, atualizarBadge } from '../src/services/recursosNativos';
import { salvarAgendaDaConta } from '../src/services/agenda';
import { temFirebase } from '../src/services/firebase';
import { resumir } from '../src/services/senha';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (efeito) => require('react').useEffect(efeito, []),
  useIsFocused: () => true,
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('../src/services/firebase', () => ({
  ...jest.requireActual('../src/services/firebase'),
  temFirebase: jest.fn(() => false),
}));

jest.mock('expo-camera', () => {
  const { View } = require('react-native');

  return {
    CameraView: (props) => <View testID="camera" facing={props.facing} />,
    useCameraPermissions: () => [{ granted: true }, jest.fn(async () => ({ granted: true }))],
  };
});

jest.mock('react-native-webview', () => {
  const { View } = require('react-native');

  return { WebView: (props) => <View testID="mapa" {...props} /> };
});

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getLastKnownPositionAsync: jest.fn(async () => ({
    coords: { latitude: -22.4, longitude: -43.66 },
  })),
  getCurrentPositionAsync: jest.fn(() => new Promise(() => {})),
}));

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

async function abrir(Tela, params, extras) {
  return render(
    <SafeAreaProvider initialMetrics={area}>
      <Tela navigation={navegacao()} route={{ params: params }} {...extras} />
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

  test('com o Firebase, a entrada oferece a conta de outro celular', async () => {
    temFirebase.mockReturnValue(true);

    try {
      await abrir(LoginScreen);

      await fireEvent.press(await screen.findByText('Já tenho conta em outro celular'));

      expect(screen.getByPlaceholderText('O e-mail da sua conta')).toBeTruthy();
    } finally {
      temFirebase.mockReturnValue(false);
    }
  });

  test('com o Firebase, o cadastro não pede a pergunta de segurança', async () => {
    temFirebase.mockReturnValue(true);

    try {
      await abrir(SignUpScreen);

      expect(await screen.findByText(/guardada no Firebase/)).toBeTruthy();
      expect(screen.queryByText('Pergunta de segurança')).toBeNull();
    } finally {
      temFirebase.mockReturnValue(false);
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

  test('o mapa abre com a posição guardada, sem esperar o GPS nem a internet', async () => {
    await criarConta();
    await abrir(MapScreen);

    const pagina = (await screen.findByTestId('mapa')).props.source.html;

    expect(pagina).toContain('-22.4');
    expect(pagina).toContain('L.markerClusterGroup');
    expect(pagina).not.toContain('unpkg.com');
  });

  test('a faixa avisa quando há alteração esperando conexão', () => {
    const base = { situacao: 'conectada', semConexao: true };

    expect(textoDoAviso({ ...base, pendentes: 1 })).toBe(
      'Aguardando conexão: 1 alteração aguardando envio.'
    );
    expect(textoDoAviso({ ...base, pendentes: 3 })).toContain('3 alterações');
    expect(textoDoAviso({ ...base, pendentes: 0 })).toBeNull();
    expect(textoDoAviso({ ...base, pendentes: 2, semConexao: false })).toBeNull();
    expect(textoDoAviso({ situacao: 'sem-sessao', pendentes: 1 })).toContain('Entre com a senha');
    expect(AvisoConexao).toBeDefined();
  });

  test('a câmera alterna entre a traseira e a frontal', async () => {
    await abrir(CameraFoto, undefined, { visivel: true, aoFechar: jest.fn(), aoConfirmar: jest.fn() });

    expect(screen.getByTestId('camera').props.facing).toBe('back');

    await fireEvent.press(screen.getByLabelText('Alternar entre a câmera frontal e a traseira'));

    expect(screen.getByTestId('camera').props.facing).toBe('front');
  });

  test('perfil abre e diz onde os dados estão', async () => {
    await criarConta();
    await abrir(ProfileScreen);

    expect(await screen.findByText(/ficam só neste aparelho/)).toBeTruthy();
  });
});
