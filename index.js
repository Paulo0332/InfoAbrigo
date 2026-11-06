import { registerRootComponent } from 'expo';

import App from './App';

// Os console.log servem para quem desenvolve. No aplicativo instalado eles só
// gastariam bateria e poderiam mostrar dados nos registros do aparelho. Avisos e
// erros (console.warn e console.error) continuam.
if (!__DEV__) {
  console.log = () => {};
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
