# Módulo 12: Recursos Nativos, Testes e Publicação

1. **O que este módulo faz**
Fecha o que faltava do plano de ensino: StatusBar, badge, lembrete, calendário do celular, testes automatizados e a configuração para gerar o aplicativo e publicá-lo.

2. **Onde fica no app**
- **StatusBar:** em todas as telas (`App.js` e `LoginScreen.js`).
- **Badge:** o número no ícone do aplicativo, igual ao do sino da aba Início.
- **Lembrete:** uma hora antes de cada compromisso.
- **Calendário:** o ícone de calendário no cartão de cada compromisso futuro.

3. **Conceito da aula aplicado**
StatusBar (aula 11), permissões e recursos nativos (aulas 14 e 15), deploy e publicação (aula 16) e badges e agenda (ementa).

4. **Código comentado**

`expo-notifications` e `expo-calendar` não funcionam no Expo Go, e o primeiro derruba o aplicativo só de ser carregado. Por isso `src/services/recursosNativos.js` só os carrega dentro das funções, e só fora do Expo Go:

```javascript
const noExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function notificacoes() {
  return noExpoGo ? null : require('expo-notifications');
}
```

| Recurso | No Expo Go | No aplicativo instalado |
|---|---|---|
| StatusBar | Funciona | Funciona |
| Badge | Não aparece | Funciona, se o launcher do Android tiver suporte |
| Lembrete | Não aparece | Funciona |
| Calendário | Abre a Agenda do Google | Abre o calendário do celular |

5. **Como testar**

Testes automatizados:

```bash
npm test
```

```bash
cd backend && python -m pytest tests
```

Testes de interface, com o Maestro e o celular ligado por USB, como no exemplo "Exemplos de Teste App" da disciplina. Os fluxos ficam em `maestro/`, e o `README.md` explica como rodar:

```bash
maestro test -e EXPO_URL=exp://192.168.18.124:8081 maestro/infoabrigo-basico.yaml maestro/infoabrigo-cadastro.yaml
```

O Jest confere as regras por dentro, e o Maestro usa o app como uma pessoa: toca nos botões e confere o que aparece na tela.

Badge, lembrete e calendário nativo só podem ser conferidos num aplicativo instalado:

```bash
npx eas-cli build --profile preview --platform android
```

**Publicação, na ordem:**

O InfoAbrigo não será publicado nas lojas. Os passos abaixo ficam só como referência do que a aula 16 pede.

1. **Firebase:** no [console do Firebase](https://console.firebase.google.com), crie um projeto. Ative o **Authentication** com e-mail e senha, crie um **Realtime Database** e cole nele as regras de `database.rules.json`. Registre um aplicativo Web e copie as chaves para o `.env`, nos campos `EXPO_PUBLIC_FIREBASE_*`.
2. **Banco da API:** crie um MySQL 8 hospedado num serviço da sua escolha (o Aiven é uma opção) e rode `backend/banco.sql` nele.
3. **API:** crie uma conta no [Render](https://render.com), escolha **New > Blueprint** e aponte para este repositório. O `render.yaml` já traz a configuração, usando o `Dockerfile`. Preencha os campos pedidos e envie `conta-de-servico.json` como **Secret File**. Ao final, abra `https://SEU-ENDERECO/saude` e confira `{"ok":true}`.
4. **Aplicativo:** crie uma conta na [Expo](https://expo.dev) e rode `npx eas-cli login` e `npx eas-cli init`. Defina as chaves do Firebase e o endereço da API em `eas.json`, dentro de `env` do perfil usado. O endereço precisa ser `https`, porque o Android bloqueia `http` no aplicativo publicado.
5. **APK para testar:** `npx eas-cli build --profile preview --platform android`.
6. **Play Store:** a conta de desenvolvedor do Google é paga. Com ela, gere o pacote com `npx eas-cli build --profile production --platform android` e envie com `npx eas-cli submit --platform android`.
7. **App Store:** a conta da Apple também é paga, e os comandos são os mesmos com `--platform ios`.

Se a API não for publicada, contas e dados continuam funcionando pelo Firebase. Só o selo, as recomendações, o painel e as denúncias ficam de fora. No plano gratuito do Render, a API dorme depois de um tempo parada, e o primeiro acesso pode demorar.

6. **Possíveis perguntas**
- *Por que não colocar o endereço da API no código?*
Ele muda entre o computador da aula e o servidor publicado. No `.env`, nada precisa ser reescrito.
- *O que os testes de sincronização provam?*
Eles simulam vários celulares, cada um com o próprio banco, falando com o emulador do Firebase e as regras de segurança reais. Não substituem o teste num aparelho, porque o SQLite e as permissões nativas são simulados.
- *Por que não há anúncios?*
O AdMob aparece nos materiais da disciplina, mas não no plano de ensino nem no cronograma, e um aplicativo de doação para abrigos não ganha com anúncios. Se o professor exigir, ele pode ser acrescentado com build próprio, porque também não funciona no Expo Go.
