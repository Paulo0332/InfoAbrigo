# Módulo 3: Conta, Login e Biometria

1. **O que este módulo faz**
Dá ao aplicativo uma porta de entrada. A pessoa cria uma conta no aparelho e, logo depois, o app pergunta se ela quer usar a digital para entrar. Quem aceita entra encostando o dedo nas próximas vezes; quem não aceita — ou não tem sensor — entra digitando e-mail e senha. A mesma dupla confirma a doação em dinheiro.

2. **Onde fica no app**
O login é a **primeira tela**, antes das abas. O cadastro abre a partir dele. A confirmação da doação fica na aba **Doações**, no cartão "Fazer uma doação em dinheiro".

3. **Conceito da aula aplicado**
Dois exemplos do professor, combinados:

- **App Biometria** (`FUSVE/LPAH-Biometria`) — `expo-local-authentication`, com `hasHardwareAsync()`, `isEnrolledAsync()` e `authenticateAsync()`. Inclusive a ideia de disparar a autenticação dentro do `useEffect`, que é como ele faz na `TelaSegura`.
- **App async-storage** (`FUSVE/async-storage`) — `setItem`/`getItem` com `JSON.stringify`/`JSON.parse` para guardar a conta, a validação de campo com `trim()` + `Alert` do `adicionarTarefa()`, e o `Alert` de duas opções do `confirmarExclusao()`.

O módulo também traz o **Stack Navigator** (`@react-navigation/native-stack`), porque login e cadastro não são abas: vêm antes delas. O mesmo Stack será reaproveitado pela câmera no Módulo 5.

4. **Código comentado**

### 4.1 O Stack e as quatro rotas

```javascript
// src/navigation/RootNavigator.js
<Stack.Navigator screenOptions={{ headerShown: false }}>
  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="SignUp" component={SignUpScreen} />
  <Stack.Screen name="Tabs" component={AppNavigator} />
  <Stack.Screen name="Donate" component={DonateScreen} />
</Stack.Navigator>
```

A **primeira** tela declarada é a rota inicial, então o login aparece antes das abas sem precisar de nenhum `if` no `App.js`. E a tela `"Tabs"` é o `AppNavigator` **inteiro** — a barra inferior continua funcionando exatamente como antes.

### 4.2 `replace` no login, `navigate` na doação

```javascript
props.navigation.replace('Tabs');   // login e cadastro
props.navigation.navigate('Donate'); // aba Doações
```

- `navigate` **empilha**: a tela anterior fica embaixo e o voltar traz a pessoa de volta. É o que a doação quer.
- `replace` **troca** a tela atual pela nova. É o que o login quer — depois de entrar, o voltar do Android não pode devolver a pessoa para o login nem para o cadastro.

### 4.3 O serviço da conta

```javascript
// src/services/auth.js
const STORAGE_KEY = '@infoabrigo:conta';

export async function salvarConta(conta) {
  try {
    const dados = JSON.stringify(conta);

    await AsyncStorage.setItem(STORAGE_KEY, dados);
  } catch (error) {
    console.log('Erro ao salvar a conta:', error);

    throw error;
  }
}

export async function carregarConta() {
  try {
    const dados = await AsyncStorage.getItem(STORAGE_KEY);

    return dados != null ? JSON.parse(dados) : null;
  } catch (error) {
    console.log('Erro ao carregar a conta:', error);

    throw error;
  }
}
```

Mesmo desenho do `storage.js` do Módulo 2 — chave em constante no topo, `stringify` para gravar, `parse` para ler. O detalhe importante é o **`null`**: quando ninguém criou conta ainda, o `getItem` devolve `null`, e é por ele que a tela de login sabe se mostra o cadastro ou os campos de entrada.

A conta guardada tem quatro campos:

```javascript
{ nome, email, senha, biometriaAtiva }
```

### 4.4 Criar conta, com a validação da aula

```javascript
if (!nomeLimpo || !emailLimpo || !senha) {
  Alert.alert('Atenção', 'Preencha o nome, o e-mail e a senha.');

  return;
}

if (!emailLimpo.includes('@')) { /* ... */ }
if (senha.length < 6) { /* ... */ }
```

O `trim()` seguido de `Alert` e `return` é exatamente o `adicionarTarefa()` do exemplo do professor: digitar só espaço conta como vazio, e o `return` interrompe antes de gravar qualquer coisa.

### 4.5 Pedir a biometria — a "permissão"

O `expo-local-authentication` não tem um pedido de permissão separado como a câmera: quem pergunta é o próprio sistema, na hora de usar. Então a permissão aqui é uma **escolha do usuário**, feita uma vez, logo depois do cadastro:

```javascript
// src/screens/SignUpScreen.js
Alert.alert(
  'Usar a sua biometria?',
  'Nas próximas vezes você entra com a digital, sem digitar a senha.',
  [
    { text: 'Agora não', style: 'cancel', onPress: abrirApp },
    { text: 'Ativar', onPress: () => ativarBiometria(conta) },
  ]
);
```

É o mesmo `Alert` de duas opções que o professor usa para confirmar a exclusão. E a ativação só vale se a digital for confirmada **na hora**:

```javascript
async function ativarBiometria(conta) {
  try {
    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirme a sua biometria para ativar',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });

    if (resultado.success) {
      await salvarConta({ ...conta, biometriaAtiva: true });
    }
  } catch (error) {
    console.log('Erro ao ativar a biometria:', error);
  } finally {
    abrirApp();
  }
}
```

Isso evita um problema real: se a gente só gravasse `biometriaAtiva: true` sem testar, a pessoa poderia ficar com um botão que nunca funciona. Confirmando na hora, sabemos que ela consegue mesmo entrar por ali depois. O `finally` garante que, dando certo ou não, o app abre.

Antes de perguntar qualquer coisa, a tela faz as mesmas duas checagens do `BiometricButton` — sem sensor ou sem digital cadastrada, a pergunta nem aparece.

### 4.6 As duas perguntas ao aparelho

```javascript
// src/components/BiometricButton.js
const temSensor = await LocalAuthentication.hasHardwareAsync();
const temCadastro = await LocalAuthentication.isEnrolledAsync();

disponivel = temSensor && temCadastro;
```

- `hasHardwareAsync()` — este aparelho **tem** leitor de digital ou câmera de rosto?
- `isEnrolledAsync()` — existe alguma digital ou rosto **já cadastrado** nele?

Um celular pode ter o sensor e ninguém ter cadastrado nada. Se chamássemos a autenticação nesse caso, ela falharia com o erro `not_enrolled`.

### 4.7 A prop `automatico`

```javascript
if (disponivel && props.automatico) {
  autenticar();
}
```

Para quem ativou a biometria, a janela da digital abre **sozinha** ao chegar na tela de login — não precisa tocar em nada. É o mesmo desenho da `TelaSegura` do professor, que chama o `authenticateAsync()` dentro do `useEffect` assim que a tela monta.

E se a pessoa cancelar, nada trava: os campos de e-mail e senha continuam ali, logo acima.

### 4.8 A autenticação, e por que cancelar não é erro

```javascript
if (resultado.success) {
  props.onSuccess();

  return;
}

if (
  resultado.error === 'user_cancel' ||
  resultado.error === 'app_cancel' ||
  resultado.error === 'system_cancel'
) {
  return;
}

Alert.alert('Não foi possível entrar', 'A sua identidade não foi confirmada.');
```

O `authenticateAsync()` abre a janela do **sistema operacional**, não uma tela nossa. O app nunca vê a digital: recebe só `{ success: true }` ou `{ success: false, error: '...' }`.

Cancelar é uma **escolha**, não uma falha — por isso esses três erros não geram alerta. Só as falhas de verdade avisam.

### 4.9 Por que aqui a biometria não é enfeite

Esse é o ponto que dá sentido ao módulo. A biometria **substitui a senha**, não dispensa a autenticação:

| Situação | Como a pessoa entra |
|---|---|
| Ativou a biometria | Encosta o dedo (a janela abre sozinha) |
| Não ativou | Digita e-mail e senha |
| Aparelho sem sensor | Digita e-mail e senha |

Não existe nenhum botão que entre no app sem provar nada. O caminho alternativo é a senha, que é o caminho normal de qualquer aplicativo.

### 4.10 A doação: digital ou senha

```javascript
// src/screens/DonateScreen.js
<BiometricButton
  rotulo="Confirmar com biometria"
  mensagem={'Confirme a doação de R$ ' + valor + ',00'}
  onSuccess={registrarDoacao}
  onVerificado={setTemBiometria}
/>

{!temBiometria && ( /* campo de senha + "Confirmar com a senha" */ )}
```

O `BiometricButton` não sabe o que está confirmando — ele só avisa `onSuccess()`. No login isso significa "entra"; aqui significa "registra a doação". A `mensagem` leva o **valor exato** para a janela do sistema, então a pessoa lê quanto está confirmando antes de encostar o dedo.

O `onVerificado` é o "filho avisa o pai" do Módulo 1: o componente devolve para a tela se o aparelho tem biometria e, **só quando não tem**, a tela pede a senha da conta:

```javascript
if (senha !== conta.senha) {
  Alert.alert('Não confirmado', 'Senha incorreta.');

  return;
}
```

Assim a doação nunca é confirmada sem nenhuma conferência, e ao mesmo tempo ninguém deixa de doar por causa do celular que tem.

### 4.11 O plugin no `app.json`

```json
[
  "expo-local-authentication",
  {
    "faceIDPermission": "Permitir que o $(PRODUCT_NAME) use o Face ID para entrar no aplicativo."
  }
]
```

No iOS o sistema exige uma frase explicando **por que** o app quer o Face ID; sem ela o iOS nem pede o rosto, cai direto no PIN.

### 4.12 A ressalva de segurança

A senha fica gravada em **texto puro** no AsyncStorage. Isso é consequência direta de usarmos só as bibliotecas dadas em aula, e precisa ser dito: num aplicativo de verdade a senha nunca ficaria assim. Ela iria para o servidor guardada com *hash*, e o que ficasse no aparelho seria um token de sessão dentro do `expo-secure-store`, que grava no cofre do sistema (Keystore no Android, Keychain no iOS). A seção 3.1 da documentação já prevê essa biblioteca para quando existir backend.

5. **Como testar**

**Primeira abertura (sem conta):**
- Rode `npx expo start` e abra no Expo Go.
- O login diz "Você ainda não tem uma conta neste aparelho" → toque em **Criar conta**.
- Toque em **Criar conta** com tudo vazio → aviso "Preencha o nome, o e-mail e a senha".
- E-mail sem arroba → "Digite um e-mail válido". Senha de 3 letras → aviso dos 6 caracteres.
- Preencha tudo certo → aparece a pergunta **"Usar a sua biometria?"**.
- Toque em **Ativar** → o celular pede a digital → confirme → entra nas abas.
- Aperte o **voltar** do Android → **não** volta para o cadastro.

**Reabrindo com a biometria ativa:**
- Feche o app de verdade (tire da multitarefa) e abra de novo.
- A janela da digital deve abrir **sozinha**, sem você tocar em nada.
- Encoste o dedo → entra direto.
- Abra de novo e **cancele** a janela → continua no login, sem alerta, com os campos de e-mail e senha prontos. Digite a senha certa → entra.
- Encoste um dedo **não** cadastrado → alerta "Não foi possível entrar".

**Recusando a biometria (dá para testar apagando os dados do app):**
- Refaça o cadastro e escolha **Agora não** → entra direto, sem pedir digital.
- Feche e reabra → o login mostra **só** os campos de e-mail e senha, sem o botão da digital.
- Senha errada → "E-mail ou senha incorretos.". Senha certa → entra.

**A doação:**
- Aba **Doações** → cartão "Fazer uma doação em dinheiro".
- Escolha **R$ 100** → a borda laranja muda e o resumo acompanha.
- **Com biometria:** toque em "Confirmar com biometria" → a janela deve dizer "Confirme a doação de R$ 100,00" → confirme → selo verde. Cancelando, a doação **não** é registrada.
- **Sem biometria:** no lugar do botão aparece o campo de senha. Senha errada → "Senha incorreta.". Senha certa → selo verde.
- Use o voltar → aqui ele **deve** funcionar e devolver para a aba Doações.

**Regressão:** as cinco abas navegam, e a lista de necessidades continua sendo salva ao fechar e reabrir (Módulo 2).

6. **Possíveis perguntas**

- *O app fica com a minha digital guardada?*
Não. O `authenticateAsync()` entrega o pedido ao sistema operacional, que compara dentro do hardware seguro do aparelho. O app recebe só `true` ou `false`.

- *Se dá para entrar sem biometria, para que ela serve?*
Ela **substitui a senha**, não dispensa a autenticação. Quem não ativou ou não tem sensor digita e-mail e senha — o caminho normal de qualquer aplicativo. Não existe botão que entre sem provar nada.

- *Por que pedir a digital na hora de ativar, se a pessoa já disse que quer?*
Para não gravar uma preferência que não funciona. Se a pessoa não conseguir usar o sensor naquele momento, é melhor descobrir ali do que deixá-la presa depois num botão que nunca passa.

- *E se eu mudar de ideia sobre a biometria?*
Hoje a escolha é feita uma vez, no cadastro. Ligar e desligar depois seria na tela de Configurações (4.4.10 do documento), que ainda não foi implementada.

- *Onde a conta é validada?*
No próprio aparelho, comparando com o que foi gravado no AsyncStorage. Não há servidor — a seção 5.2 marca o backend como "a definir".

- *E a senha, fica guardada como?*
Em texto puro, porque usamos só as bibliotecas dadas em aula. Num aplicativo real ela iria para o servidor com hash, e a sessão local usaria o `expo-secure-store`. É uma limitação conhecida e assumida do trabalho.

- *Por que o mesmo componente serve para entrar e para doar?*
Porque ele não decide nada: verifica o sensor, autentica e avisa `onSuccess()`. Quem decide é cada tela. O que muda são as props `rotulo`, `mensagem`, `onSuccess`, `onVerificado` e `automatico`.

- *Qual a diferença entre `navigate` e `replace`?*
`navigate` empilha a tela nova e mantém a anterior embaixo; `replace` troca a atual pela nova. Usamos `replace` no login e no cadastro, e `navigate` na doação.

- *Por que verificar `isEnrolledAsync()` se já verifiquei `hasHardwareAsync()`?*
Porque ter o sensor não significa ter digital cadastrada. Sem a segunda verificação, ofereceríamos um botão que sempre falharia com `not_enrolled`.

- *Por que o Face ID não funciona no meu iPhone?*
O Expo Go não suporta Face ID no iOS. É limitação do Expo Go, não do nosso código; no Android a digital funciona normalmente.

- *A doação é real?*
Não. Não há Pix, cartão nem gateway — a confirmação acontece só na interface, e a tela avisa isso.

- *Se eu fechar e abrir, pede login de novo?*
Pede. Este módulo não guarda sessão. Persistir a sessão é assunto de um módulo futuro, com `expo-secure-store`.

**Autor:** Dev B (Josué) — Módulo 3
