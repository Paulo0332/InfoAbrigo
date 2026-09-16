import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppNavigator from './AppNavigator';

const Stack = createNativeStackNavigator();

// O Stack fica por fora das abas. A tela "Tabs" é o AppNavigator inteiro,
// então a barra inferior continua funcionando exatamente como antes.
// As telas registradas aqui abrem por cima das abas, com voltar próprio.
export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AppNavigator} />
    </Stack.Navigator>
  );
}
