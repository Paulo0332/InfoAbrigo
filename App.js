import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';

// Chamado fora do componente, de propósito: a tela de abertura precisa
// ficar de pé desde antes de o React montar qualquer coisa. Sem isto ela
// some assim que o pacote termina de carregar, e a pessoa vê um piscar
// de tela vazia enquanto a entrada ainda lê as contas do aparelho.
//
// Quem a esconde é a tela de entrada, quando termina de ler — assim o
// primeiro quadro que aparece já é o aplicativo pronto.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Chamada depois de a tela já ter sumido sozinha, o que não é
  // problema nenhum: o resultado é o mesmo.
});

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
