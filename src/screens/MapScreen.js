import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ehGestor } from '../data/perfis';
import { carregarConta } from '../services/auth';
import {
  contatosDoAbrigo,
  linkEmail,
  linkInstagram,
  linkTelefone,
  linkWhatsapp,
} from '../services/contato';
import {
  MODOS,
  buscarRota,
  formatarDistancia,
  formatarDuracao,
} from '../services/rota';
import { calcularDistancia, carregarAbrigos } from '../services/shelters';
import { colors } from '../theme/colors';

// Nível de aproximação inicial. 14 mostra pouco mais de 3 km.
const ZOOM = 14;

// Cores dos pinos, aplicadas em ordem para os abrigos se distinguirem.
const CORES = [colors.primary, colors.supportGreen, colors.supportBlue];

// A rota não usa o laranja da marca, e isso é de propósito. O mapa base
// desenha as avenidas em salmão, então uma linha laranja por cima some no
// meio delas justamente na olhada rápida, que é quando ela mais precisa
// ser achada. Comparando as duas sobre os mesmos blocos, o azul é a única
// cor fria num mapa quente e o olho encontra na hora.
//
// O contorno branco por baixo é o que separa a linha da rua: sem ele a
// rota encosta no traçado da via e as duas viram uma coisa só.
// Distâncias do filtro, em quilômetros. Quem vai levar uma doação
// escolhe pelo que dá para ir, e um abrigo a 40 km não é candidato.
const RAIOS = [5, 10, 25];

const COR_ROTA = '#1A73E8';
const COR_CONTORNO_ROTA = '#FFFFFF';
const PESO_ROTA = 6;
const PESO_CONTORNO_ROTA = 11;

// Monta a página do mapa que roda dentro do WebView.
//
// Os blocos preferidos são o World Street Map da Esri: colorido, com
// ruas claras, parques verdes e água azul, no espírito do Google Maps, e
// com os rótulos de bairro e rua já embutidos. Não pede chave e vai até
// o zoom 19.
//
// O Light Gray Canvas, tentado antes, era bonito mas vinha sem nomes: na
// Esri os rótulos moram num serviço separado, e um mapa sem bairro nem
// rua não serve para encontrar abrigo.
//
// Mas provedor de bloco é traiçoeiro: o CARTO respondia HTTP 200 com uma
// imagem escrita "API KEY REQUIRED", porque recusa requisição de HTML
// embutido, que não tem domínio de origem. Por isso existe uma troca
// automática: se os blocos da Esri falharem, a página cai para o
// OpenStreetMap, que sempre funciona, com filtro preto e branco para
// manter o visual minimalista.
function montarHtml(localizacao, abrigos) {
  // Cada pino fica guardado pelo id do abrigo. Sem isso não dava para
  // destacar o escolhido depois: os marcadores nasciam soltos e a página
  // esquecia deles no instante seguinte.
  const marcadores = abrigos
    .map(
      (abrigo, indice) => `
        criarPino(
          '${abrigo.id}',
          ${abrigo.latitude},
          ${abrigo.longitude},
          '${CORES[indice % CORES.length]}'
        );
      `
    )
    .join('\n');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

    <!-- Agrupa pinos que caem quase no mesmo ponto. Se o arquivo não
         carregar, a página segue sem ele e os pinos entram soltos no
         mapa: agrupar é conforto, não é requisito. -->
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
    />
    <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
    <style>
      html, body, #mapa { height: 100%; margin: 0; padding: 0; }
      body { background: ${colors.backgroundLight}; }

      /* O mapa colorido não leva filtro: mexer na cor faria ele parecer
         defeituoso em vez de intencional. */

      /* Aplicado quando a página cai para o OpenStreetMap: aí o filtro
         precisa ser forte, porque o estilo original é carregado. */
      body.reserva .leaflet-tile-pane {
        filter: grayscale(1) sepia(0.18) brightness(1.12) contrast(0.85);
      }

      /* Pino em gota, na cor da paleta, com furo branco no meio. */
      .pino {
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid #FFFFFF;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pinoDentro {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #FFFFFF;
      }

      /* O pino escolhido cresce e ganha um anel. Antes o cartão abria e o
         mapa não mudava em nada: não dava para saber qual daqueles pinos
         era o abrigo que estava sendo lido. */
      .pino.escolhido {
        width: 38px;
        height: 38px;
        border-width: 3px;
        box-shadow: 0 0 0 5px rgba(224,122,31,0.28), 0 3px 7px rgba(0,0,0,0.35);
      }

      .pino.escolhido .pinoDentro {
        width: 12px;
        height: 12px;
      }

      /* Bolha do agrupamento, no lugar do visual padrão do plugin. */
      .grupo {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: ${colors.primary};
        border: 3px solid #FFFFFF;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFFFFF;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        font-weight: bold;
      }

      /* Ponto de "você está aqui", com halo suave. */
      .eu {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${colors.supportBlue};
        border: 3px solid #FFFFFF;
        box-shadow: 0 0 0 6px rgba(79,143,209,0.25);
      }

      /* A atribuição é obrigatória pela licença, mas pode ser discreta. */
      .leaflet-control-attribution {
        font-size: 9px;
        background: rgba(255,255,255,0.7);
      }

      .leaflet-control-zoom {
        border: none !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      }

      .leaflet-control-zoom a {
        color: ${colors.textMain};
        border-radius: 10px !important;
      }
    </style>
  </head>

  <body>
    <div id="mapa"></div>

    <script>
      var mapa = L.map('mapa', { zoomControl: true, attributionControl: true })
        .setView([${localizacao.latitude}, ${localizacao.longitude}], ${ZOOM});

      // Atenção à ordem: a Esri usa {z}/{y}/{x}, e não {z}/{x}/{y}.
      var blocosEsri = L.tileLayer(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap' }
      );

      var blocosOsm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      });

      var falhas = 0;
      var trocou = false;

      // Bloco perdido acontece em qualquer mapa; a troca só vale a pena
      // quando o provedor está realmente recusando.
      blocosEsri.on('tileerror', function () {
        falhas = falhas + 1;

        if (falhas >= 4 && !trocou) {
          trocou = true;

          mapa.removeLayer(blocosEsri);
          blocosOsm.addTo(mapa);
          document.body.className = 'reserva';
        }
      });

      // Os dois provedores falhando seguido quer dizer que não é o
      // provedor: é a internet. Sem este aviso o mapa ficava em branco
      // sem explicar nada, e parecia defeito do aplicativo.
      var falhasReserva = 0;

      blocosOsm.on('tileerror', function () {
        falhasReserva = falhasReserva + 1;

        if (falhasReserva === 4) {
          window.ReactNativeWebView.postMessage('sem-rede');
        }
      });

      blocosOsm.on('tileload', function () {
        falhasReserva = 0;
      });

      blocosEsri.addTo(mapa);

      L.marker([${localizacao.latitude}, ${localizacao.longitude}], {
        icon: L.divIcon({
          className: 'vazio',
          html: '<div class="eu"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(mapa);

      // Os pinos moram num grupo que junta os que caem quase no mesmo
      // ponto. Sem o plugin carregado o grupo é o próprio mapa, e tudo
      // funciona igual, só sem agrupar.
      var grupo = typeof L.markerClusterGroup === 'function'
        ? L.markerClusterGroup({
            maxClusterRadius: 45,
            showCoverageOnHover: false,
            iconCreateFunction: function (agrupado) {
              return L.divIcon({
                className: 'vazio',
                html: '<div class="grupo">' + agrupado.getChildCount() + '</div>',
                iconSize: [38, 38]
              });
            }
          })
        : null;

      if (grupo) {
        mapa.addLayer(grupo);
      }

      var pinos = {};
      var escolhido = null;

      function corpoDoPino(cor, destacado) {
        return '<div class="pino' + (destacado ? ' escolhido' : '') + '"'
          + ' style="background:' + cor + '">'
          + '<div class="pinoDentro"></div></div>';
      }

      function iconeDoPino(cor, destacado) {
        var lado = destacado ? 38 : 30;

        return L.divIcon({
          className: 'vazio',
          html: corpoDoPino(cor, destacado),
          iconSize: [lado, lado + 12],
          iconAnchor: [lado / 2, lado + 12]
        });
      }

      function criarPino(id, latitude, longitude, cor) {
        var marcador = L.marker([latitude, longitude], {
          icon: iconeDoPino(cor, false)
        }).on('click', function () {
          window.ReactNativeWebView.postMessage(id);
        });

        marcador.corDoPino = cor;
        pinos[id] = marcador;

        if (grupo) {
          grupo.addLayer(marcador);
        } else {
          marcador.addTo(mapa);
        }
      }

      // Chamada de fora ao abrir o cartão de um abrigo.
      function destacarPino(id) {
        if (escolhido && pinos[escolhido]) {
          pinos[escolhido].setIcon(iconeDoPino(pinos[escolhido].corDoPino, false));
        }

        escolhido = id;

        if (id && pinos[id]) {
          pinos[id].setIcon(iconeDoPino(pinos[id].corDoPino, true));
        }
      }

      var contornoRota = null;
      var linhaRota = null;

      // Chamadas de fora, pelo injectJavaScript. São duas linhas no mesmo
      // caminho: a branca mais grossa por baixo, que abre espaço na rua, e
      // a colorida por cima. O mapa se ajusta para mostrar o caminho
      // inteiro, que é o que todo aplicativo de mapa faz.
      function desenharRota(pontos) {
        limparRota();

        contornoRota = L.polyline(pontos, {
          color: '${COR_CONTORNO_ROTA}',
          weight: ${PESO_CONTORNO_ROTA},
          opacity: 1,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(mapa);

        linhaRota = L.polyline(pontos, {
          color: '${COR_ROTA}',
          weight: ${PESO_ROTA},
          opacity: 1,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(mapa);

        mapa.fitBounds(linhaRota.getBounds(), { padding: [40, 40] });
      }

      function limparRota() {
        if (contornoRota) {
          mapa.removeLayer(contornoRota);
          contornoRota = null;
        }

        if (linhaRota) {
          mapa.removeLayer(linhaRota);
          linhaRota = null;
        }
      }

      ${marcadores}
    </script>
  </body>
</html>`;
}

export default function MapScreen(props) {

  const [localizacao, setLocalizacao] = useState(null);
  const [erro, setErro] = useState(null);
  const [abrigos, setAbrigos] = useState([]);
  const [abrigoSelecionado, setAbrigoSelecionado] = useState(null);
  const [busca, setBusca] = useState('');
  const [conta, setConta] = useState(null);
  const [modoLista, setModoLista] = useState(false);
  const [carregandoMapa, setCarregandoMapa] = useState(true);
  const [rota, setRota] = useState(null);
  const [modoRota, setModoRota] = useState('auto');
  const [buscandoRota, setBuscandoRota] = useState(false);
  const [verPassos, setVerPassos] = useState(false);
  const [raio, setRaio] = useState(null);
  const [semRede, setSemRede] = useState(false);

  // A referência serve para mandar comandos para dentro da página, como
  // recentralizar o mapa num abrigo.
  const mapaRef = useRef(null);

  // A Home manda o abrigo junto quando alguém toca no cartão do mais
  // próximo. Guardamos o instante do último pedido atendido: sem isso, a
  // aba reabriria o cartão daquele abrigo a cada vez que voltasse ao
  // foco, mesmo depois de a pessoa ter fechado.
  const pedido = props.route.params || {};
  const ultimoPedido = useRef(null);

  useEffect(() => {
    if (!pedido.abrigoId || pedido.momento === ultimoPedido.current) {
      return;
    }

    const abrigo = abrigos.find((item) => item.id === pedido.abrigoId);

    if (abrigo) {
      ultimoPedido.current = pedido.momento;

      selecionar(abrigo);
    }
  }, [pedido.momento, abrigos]);

  useEffect(() => {
    buscarLocalizacao();
    buscarAbrigos();
    buscarConta().then(setConta).catch(() => setConta(null));

    // Ao voltar do cadastro, a lista precisa ser lida de novo.
    const inscricao = props.navigation.addListener('focus', buscarAbrigos);

    return inscricao;
  }, []);

  // Primeiro pede a permissão, depois pergunta a posição. A ordem importa:
  // sem a permissão concedida, o getCurrentPositionAsync nem funciona.
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

  async function buscarConta() {
    return carregarConta();
  }

  async function buscarAbrigos() {
    try {
      const lista = await carregarAbrigos();

      setAbrigos(lista);
      setAbrigoSelecionado(null);
    } catch (error) {
      console.log('Erro ao carregar os abrigos:', error);
    }
  }

  // A busca filtra por nome, sem diferenciar maiúscula de minúscula. O
  // mapa recebe apenas os que passaram pelo filtro.
  function filtrados() {
    const termo = busca.trim().toLowerCase();

    return abrigos.filter((abrigo) => {
      if (termo && !abrigo.nome.toLowerCase().includes(termo)) {
        return false;
      }

      // Sem saber onde a pessoa está não dá para medir distância, e aí o
      // filtro por raio simplesmente não se aplica.
      if (raio == null || localizacao == null) {
        return true;
      }

      return distanciaEmKm(abrigo) <= raio;
    });
  }

  // A página manda dois tipos de recado: o id do abrigo tocado e o aviso
  // de que os blocos pararam de chegar.
  function aoTocarNoMapa(evento) {
    const recado = evento.nativeEvent.data;

    if (recado === 'sem-rede') {
      setSemRede(true);

      return;
    }

    const abrigo = filtrados().find((item) => item.id === recado);

    if (abrigo) {
      selecionar(abrigo);
    }
  }

  // Manda a página engordar o pino do abrigo escolhido. Antes o cartão
  // abria e o mapa não mudava em nada: não dava para saber qual daqueles
  // pinos era o abrigo que estava sendo lido.
  function destacar(id) {
    if (!mapaRef.current) {
      return;
    }

    const alvo = id ? JSON.stringify(id) : 'null';

    mapaRef.current.injectJavaScript('destacarPino(' + alvo + '); true;');
  }

  function recarregarMapa() {
    setSemRede(false);

    if (mapaRef.current) {
      mapaRef.current.reload();
    }
  }

  // Manda a página recentralizar e aproximar no abrigo escolhido. É o que
  // qualquer app de mapa faz ao selecionar um ponto.
  function centralizarEm(abrigo) {
    const comando =
      'mapa.setView([' + abrigo.latitude + ',' + abrigo.longitude + '], 17); true;';

    if (mapaRef.current) {
      mapaRef.current.injectJavaScript(comando);
    }
  }

  // Traça a rota dentro do aplicativo: pede o caminho ao serviço, desenha
  // a linha por cima do mapa e guarda os passos para a pessoa ler. Antes
  // daqui a única opção era sair do aplicativo.
  async function tracarRota(abrigo, modo) {
    if (!localizacao) {
      Alert.alert(
        'Sem a sua localização',
        'O aplicativo precisa saber de onde você sai para traçar o caminho.'
      );

      return;
    }

    setBuscandoRota(true);
    setModoRota(modo);

    try {
      const achada = await buscarRota(localizacao, abrigo, modo);

      if (achada.situacao === 'sem-caminho') {
        Alert.alert(
          'Sem caminho',
          'Não foi possível traçar um caminho até esse ponto. Confira se o abrigo está marcado no lugar certo.'
        );

        return;
      }

      if (achada.situacao !== 'encontrada') {
        Alert.alert(
          'Não deu para traçar agora',
          'O serviço de rotas não respondeu. Você ainda pode abrir o mapa do celular.'
        );

        return;
      }

      setRota({ ...achada, abrigoId: abrigo.id, modo: modo });
      setVerPassos(false);

      desenharNoMapa(achada.linha);
    } finally {
      setBuscandoRota(false);
    }
  }

  function desenharNoMapa(linha) {
    if (mapaRef.current) {
      mapaRef.current.injectJavaScript(
        'desenharRota(' + JSON.stringify(linha) + '); true;'
      );
    }
  }

  function limparRota() {
    setRota(null);
    setVerPassos(false);

    if (mapaRef.current) {
      mapaRef.current.injectJavaScript('limparRota(); true;');
    }
  }

  // A página é montada de novo sempre que a lista de abrigos muda — a
  // busca por nome, por exemplo, refaz o HTML. Sem redesenhar aqui, a
  // rota sumiria do mapa sem ninguém ter pedido.
  function aoTerminarDeCarregar() {
    setCarregandoMapa(false);

    if (rota) {
      desenharNoMapa(rota.linha);
    }

    if (abrigoSelecionado) {
      destacar(abrigoSelecionado.id);
    }
  }

  // Abre o aplicativo de mapas do celular. Fica como a segunda opção: a
  // navegação com voz, que refaz o caminho quando a pessoa erra a
  // esquina, é coisa que o aplicativo não faz e não promete.
  async function abrirNoMapaDoCelular(abrigo) {
    const url =
      'https://www.google.com/maps/dir/?api=1&destination=' +
      abrigo.latitude + ',' + abrigo.longitude;

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('Erro ao abrir a rota:', error);

      Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mapas.');
    }
  }

  // Os canais que o abrigo tem, na ordem em que as pessoas procuram. A
  // lista sai vazia quando ninguém preencheu contato nenhum, e aí a
  // linha inteira some do cartão.
  function canais(abrigo) {
    const contatos = contatosDoAbrigo(abrigo);
    const lista = [];

    if (contatos.celular) {
      lista.push({
        nome: 'whatsapp',
        icone: 'logo-whatsapp',
        rotulo: 'WhatsApp',
        url: linkWhatsapp(
          contatos.celular,
          'Olá! Encontrei o ' + abrigo.nome + ' no InfoAbrigo e gostaria de ajudar.'
        ),
        aviso: 'Não foi possível abrir o WhatsApp.',
      });
    }

    // O fixo é o número de ligar por natureza; o celular só entra aqui
    // quando o abrigo não informou um fixo.
    const paraLigar = contatos.fixo || contatos.celular;

    if (paraLigar) {
      lista.push({
        nome: 'telefone',
        icone: 'call',
        rotulo: 'Ligar',
        url: linkTelefone(paraLigar),
        aviso: 'Não foi possível iniciar a chamada.',
      });
    }

    if (contatos.email) {
      lista.push({
        nome: 'email',
        icone: 'mail',
        rotulo: 'E-mail',
        url: linkEmail(contatos.email, 'Doação para o ' + abrigo.nome),
        aviso: 'Não foi possível abrir o aplicativo de e-mail.',
      });
    }

    if (contatos.instagram) {
      lista.push({
        nome: 'instagram',
        icone: 'logo-instagram',
        rotulo: 'Instagram',
        url: linkInstagram(contatos.instagram),
        aviso: 'Não foi possível abrir o Instagram.',
      });
    }

    return lista;
  }

  // Antes o cartão adivinhava o contato: se o texto tivesse oito dígitos
  // virava telefone, e era só isso que dava para fazer. Agora o abrigo
  // guarda cada canal no seu campo, e cada um vira um botão que abre o
  // aplicativo certo do celular.
  async function abrirCanal(url, aviso) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('Erro ao abrir o contato:', error);

      Alert.alert('Erro', aviso);
    }
  }

  async function compartilhar(abrigo) {
    const link =
      'https://www.google.com/maps/search/?api=1&query=' +
      abrigo.latitude + ',' + abrigo.longitude;

    try {
      await Share.share({
        message:
          abrigo.nome + ' acolhe ' + abrigo.criancas +
          ' crianças e está aceitando doações.\n' + link,
      });
    } catch (error) {
      console.log('Erro ao compartilhar:', error);
    }
  }

  function selecionar(abrigo) {
    // A rota desenhada é a de outro abrigo: deixá-la na tela faria o
    // cartão novo mostrar a distância de um caminho que não é o dele.
    if (rota && rota.abrigoId !== abrigo.id) {
      limparRota();
    }

    setAbrigoSelecionado(abrigo);
    destacar(abrigo.id);
    centralizarEm(abrigo);
  }

  // Fechar o cartão não apaga a rota. Quem fecha o cartão faz isso
  // justamente para olhar o mapa sem ele em cima — apagar o caminho aí
  // era o contrário do que a pessoa pediu. A rota só sai quando alguém
  // toca no fechar do painel dela, ou quando outro abrigo é escolhido.
  function fecharCartao() {
    setAbrigoSelecionado(null);
    destacar(null);
  }

  // Com o cartão fechado e a rota no mapa, a faixa de baixo é o que
  // sobra dela: mostra distância e tempo, traz o cartão de volta ao ser
  // tocada e tem o seu próprio fechar.
  function abrigoDaRota() {
    if (rota == null) {
      return null;
    }

    return abrigos.find((abrigo) => abrigo.id === rota.abrigoId) || null;
  }

  // Reabrir pela faixa não recentraliza no abrigo: isso desfaria o
  // enquadramento do caminho inteiro, que é o que a pessoa está vendo.
  function reabrirCartao() {
    const abrigo = abrigoDaRota();

    if (abrigo) {
      setAbrigoSelecionado(abrigo);
    }
  }

  function rotaDoAbrigo(abrigo) {
    return rota != null && rota.abrigoId === abrigo.id ? rota : null;
  }

  // Só quem cadastrou o abrigo pode editar ou excluir. É separação de
  // interface, não de segurança: sem servidor ninguém valida nada.
  function souDono(abrigo) {
    return conta != null && abrigo.dono === conta.email;
  }

  function centralizarEmMim() {
    const comando =
      'mapa.setView([' + localizacao.latitude + ',' + localizacao.longitude +
      '], 15); true;';

    if (mapaRef.current) {
      mapaRef.current.injectJavaScript(comando);
    }
  }

  // A lista mostra do mais perto para o mais longe, que é a ordem útil
  // para quem quer doar: o abrigo do lado vem primeiro.
  function ordenadosPorDistancia() {
    const lista = filtrados().slice();

    if (!localizacao) {
      return lista;
    }

    return lista.sort((a, b) => distanciaEmKm(a) - distanciaEmKm(b));
  }

  function distanciaEmKm(abrigo) {
    return calcularDistancia(
      localizacao.latitude,
      localizacao.longitude,
      abrigo.latitude,
      abrigo.longitude
    );
  }

  // Quem negou a permissão sem querer ficava sem a aba para sempre. Estas
  // duas saídas resolvem: tentar de novo, ou abrir as configurações do
  // aparelho, onde a decisão pode ser mudada.
  function tentarNovamente() {
    setErro(null);
    buscarLocalizacao();
  }

  async function abrirConfiguracoes() {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.log('Erro ao abrir as configurações:', error);
    }
  }

  function escolherDaLista(abrigo) {
    setModoLista(false);
    selecionar(abrigo);
  }

  function renderizarDaLista({ item }) {
    return (
      <Pressable
        style={({ pressed }) => [styles.itemLista, pressed && styles.pressionado]}
        onPress={() => escolherDaLista(item)}
      >
        <View style={styles.itemIcone}>
          <Ionicons name="business" size={18} color={colors.primary} />
        </View>

        <View style={styles.itemTexto}>
          <Text style={styles.itemNome}>{item.nome}</Text>

          {item.endereco ? (
            <Text style={styles.itemEndereco} numberOfLines={1}>
              {item.endereco}
            </Text>
          ) : null}

          <Text style={styles.itemDados}>
            {distanciaAte(item)} • {item.criancas} crianças
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#9A8F7E" />
      </Pressable>
    );
  }

  function distanciaAte(abrigo) {
    const km = calcularDistancia(
      localizacao.latitude,
      localizacao.longitude,
      abrigo.latitude,
      abrigo.longitude
    );

    if (km < 1) {
      return Math.round(km * 1000) + ' m';
    }

    return km.toFixed(1).replace('.', ',') + ' km';
  }

  const lista = localizacao ? filtrados() : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <LinearGradient
        colors={[colors.primary, colors.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopo}>
          <View>
            <Text style={styles.headerTitulo}>Abrigos</Text>

            <Text style={styles.headerSubtitulo}>
              {abrigos.length === 0
                ? 'Nenhum abrigo cadastrado ainda'
                : abrigos.length === 1
                ? '1 abrigo cadastrado'
                : abrigos.length + ' abrigos cadastrados'}
            </Text>
          </View>

          <View style={styles.acoesTopo}>
            {abrigos.length > 0 && (
              <Pressable
                style={({ pressed }) => [styles.botaoTopo, pressed && styles.pressionado]}
                onPress={() => setModoLista(!modoLista)}
              >
                <Ionicons
                  name={modoLista ? 'map' : 'list'}
                  size={22}
                  color={colors.primary}
                />
              </Pressable>
            )}

            {ehGestor(conta) && (
              <Pressable
                style={({ pressed }) => [
                  styles.botaoTopo,
                  styles.botaoTopoEspaco,
                  pressed && styles.pressionado,
                ]}
                onPress={() => props.navigation.navigate('RegisterShelter')}
              >
                <Ionicons name="add" size={26} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </View>

        {semRede && (
          <View style={styles.semRede}>
            <Ionicons name="cloud-offline-outline" size={17} color={colors.primary} />

            <Text style={styles.semRedeTexto}>
              O mapa parou de carregar. Confira a internet.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.semRedeBotao, pressed && styles.pressionado]}
              onPress={recarregarMapa}
            >
              <Text style={styles.semRedeBotaoTexto}>Tentar</Text>
            </Pressable>
          </View>
        )}

        {abrigos.length > 0 && (
          <View style={styles.busca}>
            <Ionicons name="search" size={18} color="#9A8F7E" />

            <TextInput
              style={styles.buscaInput}
              placeholder="Buscar abrigo pelo nome"
              placeholderTextColor="#9A8F7E"
              value={busca}
              onChangeText={setBusca}
            />

            {busca.length > 0 && (
              <Pressable onPress={() => setBusca('')}>
                <Ionicons name="close-circle" size={18} color="#9A8F7E" />
              </Pressable>
            )}
          </View>
        )}

        {/* Quem vai levar uma doação escolhe pelo que dá para ir, e um
            abrigo a quarenta quilômetros não é candidato. Sem saber onde a
            pessoa está não há distância para filtrar, e a linha some. */}
        {localizacao && abrigos.length > 1 && (
          <View style={styles.raios}>
            <Pressable
              style={({ pressed }) => [
                styles.raio,
                raio == null && styles.raioAtivo,
                pressed && styles.pressionado,
              ]}
              onPress={() => setRaio(null)}
            >
              <Text style={[styles.raioTexto, raio == null && styles.raioTextoAtivo]}>
                Todos
              </Text>
            </Pressable>

            {RAIOS.map((opcao) => (
              <Pressable
                key={opcao}
                style={({ pressed }) => [
                  styles.raio,
                  raio === opcao && styles.raioAtivo,
                  pressed && styles.pressionado,
                ]}
                onPress={() => setRaio(opcao)}
              >
                <Text style={[styles.raioTexto, raio === opcao && styles.raioTextoAtivo]}>
                  {opcao} km
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </LinearGradient>

      <View style={styles.corpo}>

        {erro && (
          <View style={styles.centralizado}>
            <Ionicons name="location-outline" size={44} color={colors.supportPink} />

            <Text style={styles.erro}>{erro}</Text>

            <Text style={styles.erroAjuda}>
              O mapa precisa saber onde você está para mostrar os abrigos por
              perto e calcular a distância.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.botaoErro, pressed && styles.pressionado]}
              onPress={tentarNovamente}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.textoBotaoErro}>Tentar de novo</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.linkErro, pressed && styles.pressionado]}
              onPress={abrirConfiguracoes}
            >
              <Text style={styles.textoLinkErro}>
                Abrir as configurações do aparelho
              </Text>
            </Pressable>
          </View>
        )}

        {!erro && !localizacao && (
          <View style={styles.centralizado}>
            <Text style={styles.texto}>Aguarde...</Text>
          </View>
        )}

        {!erro && localizacao && !modoLista && (
          <View style={styles.mapa}>
            <WebView
              ref={mapaRef}
              style={styles.mapa}
              originWhitelist={['*']}
              source={{ html: montarHtml(localizacao, lista) }}
              onMessage={aoTocarNoMapa}
              onLoadEnd={aoTerminarDeCarregar}
            />

            {carregandoMapa && (
              <View style={styles.carregandoMapa}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.textoCarregando}>Desenhando o mapa...</Text>
              </View>
            )}
          </View>
        )}

        {!erro && localizacao && modoLista && (
          <FlatList
            style={styles.mapa}
            data={ordenadosPorDistancia()}
            keyExtractor={(item) => item.id}
            renderItem={renderizarDaLista}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centralizado}>
                <Text style={styles.texto}>
                  {busca
                    ? 'Nenhum abrigo com esse nome.'
                    : 'Nenhum abrigo cadastrado ainda.'}
                </Text>
              </View>
            }
          />
        )}

        {!erro && localizacao && abrigos.length === 0 && (
          <View style={styles.convite}>
            <Text style={styles.conviteTitulo}>Nenhum abrigo por aqui</Text>

            <Text style={styles.conviteTexto}>
              Os abrigos aparecem no mapa depois de serem cadastrados no
              aplicativo, pela própria instituição.
            </Text>

            {ehGestor(conta) && (
              <Pressable
                style={({ pressed }) => [styles.conviteBotao, pressed && styles.pressionado]}
                onPress={() => props.navigation.navigate('RegisterShelter')}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.conviteBotaoTexto}>Cadastrar um abrigo</Text>
              </Pressable>
            )}
          </View>
        )}

        {!erro && localizacao && !modoLista && (
          <Pressable
            style={({ pressed }) => [
              styles.botaoMim,
              rota && !abrigoSelecionado && styles.botaoMimSobreFaixa,
              abrigoSelecionado && styles.botaoMimAcima,
              pressed && styles.pressionado,
            ]}
            onPress={centralizarEmMim}
          >
            <Ionicons name="locate" size={22} color={colors.primary} />
          </Pressable>
        )}

        {!abrigoSelecionado && rota && abrigoDaRota() && (
          <View style={styles.faixaRota}>
            <Pressable
              style={({ pressed }) => [styles.faixaToque, pressed && styles.pressionado]}
              onPress={reabrirCartao}
            >
              <Ionicons name="navigate-circle" size={22} color={COR_ROTA} />

              <View style={styles.faixaTexto}>
                <Text style={styles.faixaResumo}>
                  {formatarDistancia(rota.distanciaKm)}
                  {'  •  '}
                  {formatarDuracao(rota.minutos)}
                </Text>

                <Text style={styles.faixaAbrigo} numberOfLines={1}>
                  até {abrigoDaRota().nome}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.faixaFechar, pressed && styles.pressionado]}
              onPress={limparRota}
            >
              <Ionicons name="close" size={19} color="#9A8F7E" />
            </Pressable>
          </View>
        )}

        {abrigoSelecionado && (
          <View style={styles.cartao}>
            <ScrollView
              contentContainerStyle={styles.cartaoConteudo}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
            <View style={styles.cartaoTopo}>
              <Text style={styles.nome}>{abrigoSelecionado.nome}</Text>

              <Pressable
                style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
                onPress={fecharCartao}
              >
                <Ionicons name="close" size={20} color="#9A8F7E" />
              </Pressable>
            </View>

            {abrigoSelecionado.endereco ? (
              <Text style={styles.endereco}>{abrigoSelecionado.endereco}</Text>
            ) : null}

            {abrigoSelecionado.enderecoDados &&
            abrigoSelecionado.enderecoDados.referencia ? (
              <Text style={styles.referencia}>
                Referência: {abrigoSelecionado.enderecoDados.referencia}
              </Text>
            ) : null}

            <View style={styles.dados}>
              <View style={styles.dado}>
                <Ionicons name="navigate-outline" size={15} color={colors.primary} />
                <Text style={styles.textoDado}>{distanciaAte(abrigoSelecionado)}</Text>
              </View>

              <View style={styles.dado}>
                <Ionicons name="people-outline" size={15} color={colors.primary} />

                <Text style={styles.textoDado}>
                  {abrigoSelecionado.criancas} crianças
                </Text>
              </View>
            </View>

            {canais(abrigoSelecionado).length > 0 && (
              <View style={styles.contatos}>
                {canais(abrigoSelecionado).map((canal) => (
                  <Pressable
                    key={canal.nome}
                    style={({ pressed }) => [
                      styles.contato,
                      pressed && styles.pressionado,
                    ]}
                    onPress={() => abrirCanal(canal.url, canal.aviso)}
                  >
                    <Ionicons name={canal.icone} size={17} color={colors.primary} />
                    <Text style={styles.textoContato}>{canal.rotulo}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.acoes}>
              <Pressable
                style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
                onPress={() => tracarRota(abrigoSelecionado, modoRota)}
                disabled={buscandoRota}
              >
                <Ionicons
                  name={buscandoRota ? 'ellipsis-horizontal' : 'navigate'}
                  size={20}
                  color={colors.primary}
                />

                <Text style={styles.textoAcao}>
                  {buscandoRota ? 'Traçando' : 'Rota'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
                onPress={() => centralizarEm(abrigoSelecionado)}
              >
                <Ionicons name="locate" size={20} color={colors.primary} />
                <Text style={styles.textoAcao}>Centralizar</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
                onPress={() => compartilhar(abrigoSelecionado)}
              >
                <Ionicons name="share-social" size={20} color={colors.primary} />
                <Text style={styles.textoAcao}>Enviar</Text>
              </Pressable>

              {souDono(abrigoSelecionado) && (
                <Pressable
                  style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
                  onPress={() =>
                    props.navigation.navigate('RegisterShelter', {
                      abrigo: abrigoSelecionado,
                    })
                  }
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <Text style={styles.textoAcao}>Editar</Text>
                </Pressable>
              )}
            </View>

            {rotaDoAbrigo(abrigoSelecionado) && (
              <View style={styles.rota}>
                <View style={styles.rotaTopo}>
                  <Ionicons name="navigate-circle" size={20} color={COR_ROTA} />

                  <Text style={styles.rotaResumo}>
                    {formatarDistancia(rotaDoAbrigo(abrigoSelecionado).distanciaKm)}
                    {'  •  '}
                    {formatarDuracao(rotaDoAbrigo(abrigoSelecionado).minutos)}
                  </Text>

                  <Pressable
                    style={({ pressed }) => [styles.rotaFechar, pressed && styles.pressionado]}
                    onPress={limparRota}
                  >
                    <Ionicons name="close" size={17} color="#9A8F7E" />
                  </Pressable>
                </View>

                {/* De carro, a pé e de bike dão caminhos e tempos
                    diferentes de verdade — quem vai levar uma doação a pé
                    não faz o trajeto do carro. */}
                <View style={styles.modos}>
                  {MODOS.map((modo) => (
                    <Pressable
                      key={modo.id}
                      style={({ pressed }) => [
                        styles.modo,
                        modoRota === modo.id && styles.modoAtivo,
                        pressed && styles.pressionado,
                      ]}
                      onPress={() => tracarRota(abrigoSelecionado, modo.id)}
                      disabled={buscandoRota}
                    >
                      <Ionicons
                        name={modo.icone}
                        size={15}
                        color={modoRota === modo.id ? '#FFFFFF' : colors.textMain}
                      />

                      <Text
                        style={[
                          styles.modoTexto,
                          modoRota === modo.id && styles.modoTextoAtivo,
                        ]}
                      >
                        {modo.nome}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={({ pressed }) => [styles.rotaLink, pressed && styles.pressionado]}
                  onPress={() => setVerPassos(!verPassos)}
                >
                  <Text style={styles.rotaLinkTexto}>
                    {verPassos ? 'Esconder o passo a passo' : 'Ver o passo a passo'}
                  </Text>

                  <Ionicons
                    name={verPassos ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={colors.primary}
                  />
                </Pressable>

                {verPassos && (
                  <View style={styles.passos}>
                    {rotaDoAbrigo(abrigoSelecionado).passos.map((passo, indice) => (
                      <View key={passo.id} style={styles.passo}>
                        <Text style={styles.passoNumero}>{indice + 1}</Text>

                        <Text style={styles.passoTexto}>
                          {passo.instrucao}
                          {passo.metros > 0 ? '  (' + passo.metros + ' m)' : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [styles.rotaExterna, pressed && styles.pressionado]}
                  onPress={() => abrirNoMapaDoCelular(abrigoSelecionado)}
                >
                  <Ionicons name="open-outline" size={16} color="#9A8F7E" />

                  <Text style={styles.rotaExternaTexto}>
                    Navegar com voz no mapa do celular
                  </Text>
                </Pressable>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.botaoVer, pressed && styles.pressionado]}
              onPress={() =>
                props.navigation.navigate('Doações', {
                  abrigoId: abrigoSelecionado.id,
                  // O instante faz o pedido ser sempre novo. Sem ele, tocar
                  // duas vezes no mesmo abrigo não mexeria no filtro, porque
                  // os parâmetros seriam iguais aos da vez anterior.
                  momento: Date.now(),
                })
              }
            >
              <Ionicons name="list-outline" size={17} color={colors.primary} />
              <Text style={styles.textoVer}>Ver o que o abrigo precisa</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.botaoVer, pressed && styles.pressionado]}
              onPress={() =>
                props.navigation.navigate('Help', { abrigoId: abrigoSelecionado.id })
              }
            >
              <Ionicons name="hand-left-outline" size={17} color={colors.primary} />
              <Text style={styles.textoVer}>Todas as formas de ajudar</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.botaoDoar, pressed && styles.pressionado]}
              onPress={() =>
                props.navigation.navigate('Donate', {
                  abrigo: abrigoSelecionado.nome,
                  abrigoId: abrigoSelecionado.id,
                })
              }
            >
              <Ionicons name="heart" size={18} color="#FFFFFF" />
              <Text style={styles.textoDoar}>Doar para este abrigo</Text>
            </Pressable>
            </ScrollView>
          </View>
        )}

      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  headerSubtitulo: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },

  acoesTopo: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  botaoTopo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoTopoEspaco: {
    marginLeft: 8,
  },

  carregandoMapa: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },

  textoCarregando: {
    fontSize: 14,
    color: '#9A8F7E',
    marginTop: 10,
  },

  lista: {
    padding: 16,
  },

  itemLista: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  itemIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemTexto: {
    flex: 1,
    marginHorizontal: 12,
  },

  itemNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  itemEndereco: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 2,
  },

  itemDados: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 3,
  },

  erroAjuda: {
    fontSize: 13,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },

  botaoErro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 22,
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 20,
  },

  textoBotaoErro: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  linkErro: {
    paddingVertical: 14,
  },

  textoLinkErro: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },

  semRede: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 12,
  },

  semRedeTexto: {
    flex: 1,
    fontSize: 12,
    color: colors.textMain,
    lineHeight: 17,
    marginLeft: 8,
  },

  semRedeBotao: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  semRedeBotaoTexto: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },

  raios: {
    flexDirection: 'row',
    marginTop: 10,
  },

  raio: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 7,
  },

  raioAtivo: {
    backgroundColor: '#FFFFFF',
  },

  raioTexto: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  raioTextoAtivo: {
    color: colors.primary,
  },

  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 14,
  },

  buscaInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.textMain,
    marginLeft: 8,
  },

  corpo: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  mapa: {
    flex: 1,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  texto: {
    fontSize: 15,
    color: colors.textMain,
  },

  erro: {
    fontSize: 15,
    color: colors.supportPink,
    textAlign: 'center',
    marginTop: 10,
  },

  convite: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    left: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },

  conviteTitulo: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  conviteTexto: {
    fontSize: 13,
    color: '#9A8F7E',
    lineHeight: 19,
    marginTop: 6,
  },

  conviteBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 14,
  },

  conviteBotaoTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  botaoMim: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  botaoMimAcima: {
    bottom: 210,
  },

  // A faixa da rota é bem mais baixa que o cartão, então o botão sobe só
  // o que ela ocupa.
  botaoMimSobreFaixa: {
    bottom: 104,
  },

  faixaRota: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 6,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },

  faixaToque: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  faixaTexto: {
    flex: 1,
    marginLeft: 10,
  },

  faixaResumo: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  faixaAbrigo: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 1,
  },

  faixaFechar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartao: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    left: 16,
    maxHeight: '74%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },

  cartaoConteudo: {
    padding: 16,
  },

  cartaoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  nome: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  fechar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  endereco: {
    fontSize: 13,
    color: '#9A8F7E',
    marginTop: 4,
  },

  referencia: {
    fontSize: 12,
    color: '#9A8F7E',
    fontStyle: 'italic',
    marginTop: 2,
  },

  dados: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },

  dado: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 4,
  },

  textoDado: {
    fontSize: 13,
    color: '#9A8F7E',
    marginLeft: 5,
  },

  contatos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },

  contato: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginTop: 6,
  },

  textoContato: {
    fontSize: 13,
    color: colors.textMain,
    fontWeight: 'bold',
    marginLeft: 6,
  },

  acoes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F0E9DC',
    marginTop: 12,
    paddingTop: 10,
  },

  acao: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  textoAcao: {
    fontSize: 11,
    color: colors.textMain,
    marginTop: 3,
  },

  rota: {
    borderTopWidth: 1,
    borderTopColor: '#F0E9DC',
    marginTop: 12,
    paddingTop: 12,
  },

  rotaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rotaResumo: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textMain,
    marginLeft: 8,
  },

  rotaFechar: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modos: {
    flexDirection: 'row',
    marginTop: 10,
  },

  modo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginRight: 7,
  },

  modoAtivo: {
    backgroundColor: COR_ROTA,
  },

  modoTexto: {
    fontSize: 12,
    color: colors.textMain,
    marginLeft: 5,
  },

  modoTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  rotaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  rotaLinkTexto: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COR_ROTA,
    marginRight: 4,
  },

  passos: {
    marginBottom: 6,
  },

  passo: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  passoNumero: {
    width: 20,
    fontSize: 12,
    fontWeight: 'bold',
    color: COR_ROTA,
  },

  passoTexto: {
    flex: 1,
    fontSize: 13,
    color: colors.textMain,
    lineHeight: 18,
  },

  rotaExterna: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },

  rotaExternaTexto: {
    fontSize: 12,
    color: '#9A8F7E',
    marginLeft: 6,
  },

  botaoVer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: 12,
  },

  textoVer: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 7,
  },

  botaoDoar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 14,
  },

  textoDoar: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  pressionado: {
    opacity: 0.6,
  },
});
