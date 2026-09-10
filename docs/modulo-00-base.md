# Módulo 0: Base do Projeto

1. **O que este módulo faz**
Configura a estrutura inicial do aplicativo, incluindo a paleta de cores, estilos globais e a navegação principal por abas (Bottom Tabs).

2. **Onde fica no app**
Aplica-se em todo o aplicativo. A navegação inferior permite transitar entre Início, Mapa, Doações, Agenda e Perfil, enquanto as cores definem a aparência visual padrão.

3. **Conceito da aula aplicado**
Uso do React Navigation (conceito complementar) e configuração de `SafeAreaView` e `StyleSheet` centralizados, preparando o terreno para os próximos módulos.

4. **Código comentado**
```javascript
// App.js
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    // SafeAreaProvider garante que a interface não sobreponha a barra de status ou o notch do celular
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
```

5. **Como testar**
- Execute `npx expo start` ou `npm start`.
- Abra o aplicativo no Expo Go.
- Verifique se o menu inferior exibe as cinco abas e se a navegação entre elas ocorre suavemente e se os títulos refletem a aba ativa.

6. **Possíveis perguntas**
- *Por que as cores estão centralizadas em `colors.js`?*
Para garantir a consistência visual em todo o app. Se a marca mudar, basta alterar a cor neste arquivo.
- *Por que usar `SafeAreaProvider`?*
Ele evita que os componentes encostem nas bordas físicas dos aparelhos mais novos (como o entalhe da câmera e a barra inferior do iOS), mantendo o layout organizado e visível.

**Autores:**
Dev A (Cores e Estrutura) e Dev B (Navegação)
