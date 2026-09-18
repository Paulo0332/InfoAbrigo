# Módulo 4: Mapa dos Abrigos

1. **O que este módulo faz**
Mostra num mapa onde a pessoa está e quais abrigos existem por perto. Tocando num abrigo, aparece um cartão com o nome, a distância até ele e quantas crianças ele acolhe.

2. **Onde fica no app**
Na aba **Mapa**. Antes deste módulo ela era só um placeholder com o título.

3. **Conceito da aula aplicado**
Vem do **App Mapa (GPS)** (`FUSVE/LPAH-20221-MAP_GPS`), que tem duas partes:

- **`expo-location`** — usado exatamente como na aula: `requestForegroundPermissionsAsync()` e `getCurrentPositionAsync()`.
- **`react-native-maps`** — **não pôde ser usado.** O motivo está na seção 4.2, e é a parte mais importante deste módulo.

4. **Código comentado**

### 4.1 A ordem importa: permissão primeiro

```javascript
async function buscarLocalizacao() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      setErro('Permissão da localização negada!');

      return;
    }

    const posicao = await Location.getCurrentPositionAsync({});

    setLocalizacao(posicao.coords);
  } catch (error) {
    console.log('Erro ao obter a localização:', error);

    setErro('Não foi possível obter a sua localização.');
  }
}
```

São duas etapas, e a segunda depende da primeira. O `requestForegroundPermissionsAsync()` é o que faz o sistema mostrar a caixa perguntando se o app pode usar a localização; ele devolve um objeto com `status`. Só quando o status é `'granted'` faz sentido chamar o `getCurrentPositionAsync()` — sem permissão ele nem funciona.

O "foreground" do nome quer dizer **com o app aberto**. A permissão de segundo plano, que o projeto não usa, exige justificativa e development build.

O `getCurrentPositionAsync` devolve um objeto com `coords` dentro; guardamos só o `coords`, que é onde ficam `latitude` e `longitude`.

**Esta parte é idêntica ao exemplo do professor e funciona.**

### 4.2 Por que o mapa não é o `react-native-maps`

Esta é a pergunta que a banca vai fazer, então vale a resposta completa.

O módulo foi escrito primeiro com `MapView` e `Marker`, exatamente como o exemplo da aula. No aparelho, o resultado foi uma **tela preta com a logo do Google no canto inferior esquerdo**: a view do mapa monta, mas nenhum bloco desenha. Reproduziu igual em dois celulares físicos diferentes.

A causa é uma mudança do Expo Go, não do nosso código. A autorização do Google Maps falha no lado nativo do próprio Expo Go, com erro de token inválido. Existe relato público da quebra exatamente na passagem do **SDK 54 para o 55**, junto com `react-native-maps` **1.20.1 para 1.27.2**:

> github.com/react-native-maps/react-native-maps/issues/5888

E é por isso que **o exemplo do professor funciona e o nosso não**: o dele é SDK 54 com a 1.20.1; o nosso é SDK 57 com a 1.27.2, que é a versão que o `npx expo install` instala. O material da aula está do lado antigo da linha. O código é o mesmo.

O que foi testado e **descartado** antes de trocar de abordagem:

| Tentativa | Resultado |
|---|---|
| `newArchEnabled` ligado e desligado | continuou preto |
| Cache do Metro limpo, app reaberto do zero | continuou preto |
| `npx expo install --fix` (dependências alinhadas) | continuou preto |
| Blocos do OpenStreetMap por `UrlTile` + `mapType="none"` | o overlay também não desenha |
| Chave do Google no `app.json` | a documentação do Expo diz que o Expo Go a ignora |
| `expo-maps` | a documentação diz que não roda no Expo Go |

Sobraram dois caminhos: gerar um **development build** (onde o `react-native-maps` funciona, com chave do Google) ou desenhar o mapa de outra forma. Para o trabalho rodar no Expo Go, como todos os outros módulos, seguimos pelo segundo.

### 4.3 O mapa dentro de um WebView

```javascript
<WebView
  style={styles.mapa}
  originWhitelist={['*']}
  source={{ html: montarHtml(localizacao, abrigos) }}
  onMessage={aoTocarNoMapa}
/>
```

O `WebView` é uma janela de navegador dentro do app. Dentro dela roda uma página HTML que o próprio JavaScript monta, com a biblioteca **Leaflet** desenhando o mapa e os blocos vindo do **OpenStreetMap** — que é gratuito e não pede chave de API.

A função `montarHtml` recebe a coordenada e a lista de abrigos e devolve a página pronta, já com os marcadores nas posições certas.

### 4.4 Como o toque volta para o app

Aqui está a única diferença conceitual em relação ao `react-native-maps`. Antes, o `Marker` tinha `onPress`. Agora o toque acontece **dentro da página**, e ela precisa avisar o app:

```javascript
// dentro do HTML, no clique do marcador
window.ReactNativeWebView.postMessage('${abrigo.id}');
```

```javascript
// na tela, do lado do React Native
function aoTocarNoMapa(evento) {
  const id = evento.nativeEvent.data;
  const abrigo = abrigos.find((item) => item.id === id);

  if (abrigo) {
    setAbrigoSelecionado(abrigo);
  }
}
```

A página manda o **id** do abrigo; a tela procura na lista e mostra o cartão. É o mesmo *elevar o estado* do `NeedItem` no Módulo 1 e do `BiometricButton` no Módulo 3: quem foi tocado só avisa, quem decide é a tela. Muda o mensageiro — `postMessage` no lugar do `onPress` — não a ideia.

### 4.5 A distância, calculada de verdade

```javascript
const RAIO_TERRA_KM = 6371;

function calcularDistancia(latitudeA, longitudeA, latitudeB, longitudeB) {
  const deltaLatitude = grausParaRadianos(latitudeB - latitudeA);
  const deltaLongitude = grausParaRadianos(longitudeB - longitudeA);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(grausParaRadianos(latitudeA)) *
      Math.cos(grausParaRadianos(latitudeB)) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return RAIO_TERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

É a **fórmula de haversine**, que calcula a distância em linha reta entre dois pontos de uma esfera. Não dá para subtrair latitudes e chamar de distância: um grau de longitude vale 111 km no equador e quase nada perto dos polos, então a conta precisa levar em conta a curvatura — é o que o `Math.cos` no meio da fórmula faz.

O resultado sai em quilômetros e é o que aparece no cartão como "a 0,8 km". É distância em linha reta, não de percurso.

### 4.6 Os dados dos abrigos ainda são provisórios

Isto precisa estar escrito, porque é uma pendência conhecida e não um descuido.

Hoje o `shelters.js` tem três abrigos fictícios, e cada um guarda um **deslocamento** em graus em vez de uma coordenada fixa. A posição nasce da localização de quem abriu o app, o que faz a tela funcionar em qualquer cidade — necessário para demonstrar o módulo sem servidor.

```javascript
{
  id: '1',
  nome: 'Lar Esperança',
  criancas: 24,
  cor: colors.primary,
  deslocamento: { latitude: 0.006, longitude: 0.004 },
}
```

**Isso não pode ir para uma loja de aplicativos assim**, e por dois motivos diferentes:

- **Os dados são inventados.** Nome, número de crianças e posição não correspondem a nada real.
- **Mapear abrigos de crianças é assunto sensível.** Muitos serviços de acolhimento não divulgam endereço de propósito, porque parte das crianças está protegida de familiares. O ECA protege a segurança de quem está acolhido. Publicar essas localizações sem autorização da instituição pode causar dano real.

O modelo correto é o inverso de uma varredura de bases: **a instituição se cadastra e decide o que publicar**, que é justamente o perfil de Gestor do abrigo já previsto na documentação. Isso resolve o consentimento, a precisão e a segurança de uma vez — e depende do backend da seção 5.2.

Enquanto o backend não existe, o `shelters.js` cumpre o papel de fonte de dados provisória. Quando existir, a tela não muda: só troca de onde vem a lista.

5. **Como testar**
- Rode `npx expo start` e abra no Expo Go, **num aparelho com GPS**.
- Vá até a aba **Mapa**.
- Na primeira vez o sistema pergunta se o app pode usar a localização.
- **Aceite** → aparece "Aguarde..." por um instante e depois o mapa desenhado, centralizado em você.
- O círculo **rosa** é você; os três coloridos são os abrigos, entre 780 m e 1,2 km.
- **Toque num círculo colorido** → sobe o cartão com o nome, a distância e o número de crianças.
- Toque no **X** → o cartão fecha. Toque em outro abrigo → o conteúdo troca.
- Arraste e dê pinça no mapa → funciona normalmente.
- **Recuse a permissão** (ou negue nas configurações e reabra) → aparece "Permissão da localização negada!" e a tela não trava.
- **Regressão:** as outras quatro abas continuam funcionando, o login continua pedindo a entrada e a lista de necessidades continua salva.

Atenção: o mapa depende de internet no aparelho, porque o Leaflet e os blocos do OpenStreetMap vêm da rede. Sem internet, a área do mapa fica em branco.

6. **Possíveis perguntas**

- *Por que não usaram o `react-native-maps` da aula?*
Usamos primeiro, e o mapa não desenha dentro do Expo Go no SDK 57 — é uma falha de autorização do Google Maps no lado nativo do Expo Go, com relato público (issue 5888). O exemplo da aula funciona porque é SDK 54 com a versão 1.20.1; o nosso é SDK 57 com a 1.27.2. O código é o mesmo.

- *Então metade da aula ficou de fora?*
Não. O `expo-location`, que é a metade do GPS — permissão e coordenadas — está igual ao exemplo e funcionando em aparelho real. O que trocou foi quem desenha o mapa.

- *Dá para voltar a usar o Google Maps?*
Sim, com um **development build** e uma chave da Maps SDK for Android. O relato da issue confirma que nesse cenário funciona. O custo é abandonar o Expo Go, que é como todos os outros módulos são testados.

- *O que é `postMessage`?*
É como a página dentro do `WebView` conversa com o app. Ela chama `window.ReactNativeWebView.postMessage(...)` com o id do abrigo tocado, e o `onMessage` da tela recebe. É a ponte entre os dois mundos.

- *A distância é calculada ou está escrita no código?*
É calculada por haversine, a partir da posição real do usuário. Muda se você andar e reabrir a tela.

- *Os abrigos são reais?*
Ainda não. São três exemplos provisórios, posicionados ao redor do usuário para a tela poder ser demonstrada sem servidor. A seção 4.6 explica por que substituir isso não é só achar uma base de dados, e qual é o modelo correto.

- *Por que pedir permissão e buscar a posição em duas etapas?*
Porque são coisas diferentes: a primeira é o sistema perguntando ao usuário se autoriza; a segunda é o aparelho consultando o GPS. Sem a autorização, a segunda falha.

- *E se a pessoa negar a permissão?*
A tela mostra "Permissão da localização negada!" e para por aí, sem quebrar. O resto do aplicativo continua funcionando.

**Autor:** Dev B (Josué) — Módulo 4
