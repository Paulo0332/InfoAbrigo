# Módulo 6: Perfil e Configurações

1. **O que este módulo faz**
Transforma a aba Perfil, que era um placeholder de 14 linhas, na tela de conta do aplicativo: mostra quem está logado, deixa ligar e desligar a entrada por biometria, informa quais permissões o app já tem e permite sair da conta.

2. **Onde fica no app**
Na aba **Perfil**, a última da barra inferior.

3. **Conceito da aula aplicado**
Não é um exemplo novo do professor — é a junção de três que já foram dados:

- **`FUSVE/async-storage`** — ler e gravar a conta, com `useEffect` e estado `carregando`.
- **`FUSVE/LPAH-Biometria`** — `hasHardwareAsync()`, `isEnrolledAsync()` e `authenticateAsync()` para o switch.
- **`FUSVE/LPAH-20221-Camera` e `MAP_GPS`** — consultar o estado das permissões de câmera e localização.

4. **Código comentado**

### 4.1 Ler a conta e decidir o que mostrar

```javascript
useEffect(() => {
  buscarConta();
  verificarBiometria();
  verificarLocalizacao();
}, []);
```

Três perguntas independentes, feitas uma vez quando a tela abre. O `buscarConta` usa o mesmo `carregarConta` do Módulo 3 e o mesmo estado `carregando` do Módulo 2. Sem conta gravada, a tela avisa em vez de quebrar tentando ler `conta.nome`.

O avatar é a **primeira letra do nome**. Sem foto de perfil e sem servidor, é o que dá para mostrar sem inventar uma imagem:

```javascript
function primeiraLetra(nome) {
  return nome.trim().charAt(0).toUpperCase();
}
```

### 4.2 O switch da biometria, e por que ele pede a digital

Este switch resolve uma lacuna que o Módulo 3 deixou registrada: lá a biometria era oferecida **uma única vez**, no cadastro, e quem recusasse ficava sem como voltar atrás.

```javascript
async function alternarBiometria(ligar) {
  if (!ligar) {
    gravarPreferencia(false);

    return;
  }

  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirme a sua biometria para ativar',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false,
  });

  if (resultado.success) {
    gravarPreferencia(true);
  }
}
```

**Desligar não pede nada; ligar pede a digital na hora.** A assimetria é de propósito: se gravássemos `biometriaAtiva: true` sem testar, a pessoa poderia ficar com um botão de login que nunca funciona. Confirmando ali, sabemos que funciona.

E a preferência vai para dentro da própria conta, com o mesmo `salvarConta` do Módulo 3:

```javascript
const atualizada = { ...conta, biometriaAtiva: ativa };

await salvarConta(atualizada);
setConta(atualizada);
```

O `...conta` é o **spread**: copia tudo o que já existia e troca só o campo da biometria. É o mesmo que o `toggleNeed` do Módulo 1 faz com o `done`.

Em aparelho sem sensor, o switch aparece **desabilitado**, com o motivo escrito embaixo — melhor que deixar ligar algo que não vai funcionar.

### 4.3 Consultar permissão é diferente de pedir permissão

```javascript
const [permissaoCamera] = useCameraPermissions();

const { status } = await Location.getForegroundPermissionsAsync();
```

Repare no nome: `getForegroundPermissions`, não `requestForegroundPermissions`. O `get` **consulta** o que já foi decidido; o `request` é que faz aparecer a caixa do sistema.

Essa distinção é importante aqui: uma tela de configurações deve **informar** o estado, não ficar pedindo permissão para quem só entrou para olhar. Quem pede continua sendo a tela que precisa — o mapa, no momento em que vai mostrar a localização; a câmera, no momento em que vai fotografar.

### 4.4 Sair da conta não é apagar a conta

Esta separação nasceu de um erro real, pego no teste. A primeira versão fazia "sair da conta" chamar `apagarConta()` — e o resultado é que a pessoa **nunca mais conseguia entrar**: a tela de login não encontrava conta nenhuma e só oferecia criar outra.

São duas ações com consequências muito diferentes, e agora estão separadas:

```javascript
// Sair: tranca o app de novo. A conta continua gravada.
function sair() {
  props.navigation.getParent().replace('Login');
}

// Apagar: destrutivo, com Alert de confirmação antes.
async function apagar() {
  await apagarConta();

  props.navigation.getParent().replace('Login');
}
```

O **sair** só volta para o login, e de lá a pessoa entra outra vez com a senha ou com a digital. O **apagar** faz `removeItem` na chave da conta, e o alerta avisa sem rodeios que não existe servidor guardando nada, portanto não há como recuperar.

A lição vale para além deste botão: *sair* e *destruir* nunca devem ser a mesma ação, mesmo quando a implementação é parecida.

Um segundo problema apareceu no mesmo teste: depois de sair, a janela da digital abria **sozinha** na tela de login e jogava a pessoa de volta para dentro do app. A culpa era da prop `automatico` do `BiometricButton`, criada no Módulo 3 para o app abrir direto na digital. A saída foi avisar a tela de login de onde a pessoa está vindo:

```javascript
// no Perfil, ao sair
props.navigation.getParent().replace('Login', { semBiometria: true });
```

```javascript
// no login
const parametros = props.route.params || {};
const abrirDigitalSozinha = parametros.semBiometria !== true;
```

Quando o **app abre**, a digital continua abrindo sozinha. Quando a pessoa chega ao login por ter **saído da conta**, o botão espera o toque. É o mesmo componente, com comportamento diferente conforme quem o chamou — e a informação vem por parâmetro de rota, não por estado global.

### 4.5 O `getParent()`

Nos dois casos a navegação é a mesma:

```javascript
props.navigation.getParent().replace('Login');
```

O Perfil é uma **aba**, e a tela de login mora no **Stack** que envolve as abas. O objeto de navegação da aba não conhece a rota `Login`, então pedimos ao navegador pai — o Stack — para fazer a troca. É a mesma relação entre Stack e Tabs montada no Módulo 3.

5. **Como testar**
- Entre no app e vá até a aba **Perfil**.
- O cabeçalho deve mostrar a letra inicial, o nome e o e-mail da conta que você criou.
- **Se a biometria estiver desligada:** ligue o switch → o celular pede a digital → confirmando, ele fica ligado. Feche o app, reabra e confirme que o login agora oferece a digital.
- **Desligue o switch** → não pede nada. Feche e reabra: o login volta a pedir só e-mail e senha.
- Num aparelho sem digital cadastrada, o switch aparece apagado e não deixa ligar, com o aviso embaixo.
- Em **Permissões**, a câmera e a localização mostram o estado real. Se você nunca abriu o mapa, a localização aparece como não concedida; abra a aba Mapa, aceite, volte ao Perfil e reabra o app — agora aparece concedida.
- Toque em **Sair da conta** → volta direto para o login, e ele mostra "Olá, *seu nome*" com os campos, porque a conta continua salva. Entre de novo para confirmar.
- Toque em **Apagar a conta deste aparelho** → o alerta explica que não há como recuperar. Em "Cancelar" nada acontece.
- Confirmando o apagar, o app volta ao login e agora ele oferece **criar conta**, porque não existe mais conta gravada.

6. **Possíveis perguntas**

- *Por que desligar a biometria não pede a digital, e ligar pede?*
Porque as duas ações têm riscos diferentes. Desligar só remove uma comodidade. Ligar promete que a digital vai funcionar no próximo login — e a única forma de ter certeza é testar ali.

- *Por que a tela não pede as permissões, só mostra?*
Porque pedir permissão sem ter o que fazer com ela é ruim: a pessoa entrou para ver configurações, não para autorizar câmera. Quem pede é a tela que precisa, na hora que precisa. Aqui usamos as funções `get...`, que só consultam.

- *Sair da conta apaga meus dados?*
Não. Sair só volta para o login, e a conta continua gravada — você entra de novo com a senha ou com a digital. Quem apaga é a opção "Apagar a conta deste aparelho", que é separada e pede confirmação. A primeira versão desta tela misturava as duas coisas, e o teste mostrou o problema: quem saía não conseguia mais entrar.

- *Por que `getParent()` no lugar de `navigate`?*
Porque a tela de login não é uma aba. Ela está no Stack que envolve o conjunto de abas, então quem sabe chegar até ela é o navegador pai.

- *O switch de tema escuro do mockup não entrou. Por quê?*
Porque o `colors.js` tem a paleta escura, mas fazer o tema funcionar exigiria Context e reescrever o `StyleSheet` das oito telas — e Context não foi dado em aula. Um switch que não muda nada seria pior do que não ter switch.

**Autor:** Dev B (Josué) — Módulo 6
