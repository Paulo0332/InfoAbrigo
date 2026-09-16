import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import DonateScreen from '../screens/DonateScreen';
import AppNavigator from './AppNavigator';

const Stack = createNativeStackNavigator();

// O Stack fica por fora das abas. A primeira tela é o login; a tela
// "Tabs" é o AppNavigator inteiro, então a barra inferior continua
// funcionando exatamente como antes depois que a pessoa entra.
export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Tabs" component={AppNavigator} />
      <Stack.Screen name="Donate" component={DonateScreen} />
    </Stack.Navigator>
  );
}
