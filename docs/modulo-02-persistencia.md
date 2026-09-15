# Módulo 2: Persistência dos Dados

1. **O que este módulo faz**
Salva a lista de necessidades no próprio dispositivo para que os dados não sejam perdidos ao fechar e reabrir o aplicativo.

2. **Onde fica no app**
Aplica-se à aba Doações, garantindo que os itens adicionados, marcados ou excluídos permaneçam registrados localmente.

3. **Conceito da aula aplicado**
Uso da biblioteca AsyncStorage para armazenar dados localmente em formato JSON, utilizando `setItem` e `getItem`, combinado com o hook `useEffect` para carregamento inicial. Padrão baseado no exemplo `FUSVE/async-storage`.

4. **Código comentado**
```javascript
// src/services/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constante com o nome da chave usada para salvar no dispositivo
const STORAGE_KEY = "@infoabrigo:needs";

export async function saveNeeds(list) {
  try {
    // Converte a lista de JavaScript para texto JSON antes de salvar
    const jsonValue = JSON.stringify(list);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (error) {
    console.log("Erro ao salvar necessidades:", error);
    throw error;
  }
}

export async function loadNeeds() {
  try {
    // Lê o texto JSON salvo
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    // Transforma o texto de volta para lista JavaScript, se não for nulo
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.log("Erro ao carregar necessidades:", error);
    throw error;
  }
}
```

5. **Como testar**
- Abra o aplicativo no Expo Go.
- Vá para a aba Doações.
- Adicione uma nova necessidade na lista.
- Feche completamente o aplicativo (remova da memória/multitarefa do celular).
- Abra o aplicativo novamente; a necessidade adicionada deve continuar na lista.
- Durante a rápida leitura de dados na abertura da tela, aparecerá a mensagem "Carregando necessidades...".

6. **Possíveis perguntas**
- *Por que foi usado `JSON.stringify` e `JSON.parse`?*
O AsyncStorage só consegue guardar valores em formato de texto (string). Como nossa lista é um array de objetos, usamos o `stringify` para converter para texto ao salvar e o `parse` para reverter a conversão ao carregar.
- *Onde os dados ficam salvos?*
Eles ficam guardados no armazenamento local do próprio aplicativo no dispositivo do usuário. Se o usuário desinstalar o aplicativo ou limpar seus dados nas configurações do celular, a lista será apagada.

**Autores:**
Dev A (Paulo)
