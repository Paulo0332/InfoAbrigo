import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
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
import { calcularDistancia, carregarAbrigos } from '../services/shelters';
import { colors } from '../theme/colors';

// Nível de aproximação inicial. 14 mostra pouco mais de 3 km.
const ZOOM = 14;

// Cores dos pinos, aplicadas em ordem para os abrigos se distinguirem.
const CORES = [colors.primary, colors.supportGreen, colors.supportBlue];

// Monta a página do mapa que roda dentro do WebView.
//
// Os blocos vêm do servidor do OpenStreetMap, que funciona sem chave e
// sem checar domínio — o CARTO recusa requisição de HTML embutido, que
// não tem origem válida, e devolve um bloco escrito "API KEY REQUIRED".
//
// O estilo padrão do OSM é pesado demais, então um filtro CSS dessatura
// e clareia os blocos. O mapa fica discreto e a paleta do app volta a
// ser a cor que chama atenção na tela.
function montarHtml(localizacao, abrigos) {
  const marcadores = abrigos
    .map(
      (abrigo, indice) => `
        L.marker([${abrigo.latitude}, ${abrigo.longitude}], {
          icon: L.divIcon({
            className: 'vazio',
            html: '<div class="pino" style="background:${CORES[indice % CORES.length]}">'
              + '<div class="pinoDentro"></div></div>',
            iconSize: [30, 42],
            iconAnchor: [15, 42]
          })
        })
          .addTo(mapa)
          .on('click', function () {
            window.ReactNativeWebView.postMessage('${abrigo.id}');
          });
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
    <style>
      html, body, #mapa { height: 100%; margin: 0; padding: 0; }
      body { background: ${colors.backgroundLight}; }

      /* Suaviza os blocos do OSM: menos cor, mais claro, menos contraste.
         Os pinos ficam fora deste painel, então não são afetados. */
      .leaflet-tile-pane {
        filter: saturate(0.5) brightness(1.08) contrast(0.92);
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

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapa);

      L.marker([${localizacao.latitude}, ${localizacao.longitude}], {
        icon: L.divIcon({
          className: 'vazio',
          html: '<div class="eu"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(mapa);

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

  // A referência serve para mandar comandos para dentro da página, como
  // recentralizar o mapa num abrigo.
  const mapaRef = useRef(null);

  useEffect(() => {
    buscarLocalizacao();
    buscarAbrigos();

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

    if (!termo) {
      return abrigos;
    }

    return abrigos.filter((abrigo) => abrigo.nome.toLowerCase().includes(termo));
  }

  function aoTocarNoMapa(evento) {
    const id = evento.nativeEvent.data;
    const abrigo = filtrados().find((item) => item.id === id);

    if (abrigo) {
      selecionar(abrigo);
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

  // Abre o aplicativo de mapas do celular com a rota até o abrigo. Não
  // precisa de chave: é um link que o sistema entrega a quem souber abrir.
  async function tracarRota(abrigo) {
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

  // Só oferecemos ligar quando o contato tem cara de telefone.
  function telefoneDoContato(contato) {
    const digitos = (contato || '').replace(/[^0-9]/g, '');

    return digitos.length >= 8 ? digitos : null;
  }

  async function ligar(abrigo) {
    const telefone = telefoneDoContato(abrigo.contato);

    try {
      await Linking.openURL('tel:' + telefone);
    } catch (error) {
      console.log('Erro ao ligar:', error);

      Alert.alert('Erro', 'Não foi possível iniciar a chamada.');
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
    setAbrigoSelecionado(abrigo);
    centralizarEm(abrigo);
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

          <Pressable
            style={({ pressed }) => [styles.botaoMais, pressed && styles.pressionado]}
            onPress={() => props.navigation.navigate('RegisterShelter')}
          >
            <Ionicons name="add" size={26} color={colors.primary} />
          </Pressable>
        </View>

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
      </LinearGradient>

      <View style={styles.corpo}>

        {erro && (
          <View style={styles.centralizado}>
            <Ionicons name="location-outline" size={44} color={colors.supportPink} />
            <Text style={styles.erro}>{erro}</Text>
          </View>
        )}

        {!erro && !localizacao && (
          <View style={styles.centralizado}>
            <Text style={styles.texto}>Aguarde...</Text>
          </View>
        )}

        {!erro && localizacao && (
          <WebView
            ref={mapaRef}
            style={styles.mapa}
            originWhitelist={['*']}
            source={{ html: montarHtml(localizacao, lista) }}
            onMessage={aoTocarNoMapa}
          />
        )}

        {!erro && localizacao && abrigos.length === 0 && (
          <View style={styles.convite}>
            <Text style={styles.conviteTitulo}>Nenhum abrigo por aqui</Text>

            <Text style={styles.conviteTexto}>
              Os abrigos aparecem no mapa depois de serem cadastrados no
              aplicativo, pela própria instituição.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.conviteBotao, pressed && styles.pressionado]}
              onPress={() => props.navigation.navigate('RegisterShelter')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.conviteBotaoTexto}>Cadastrar um abrigo</Text>
            </Pressable>
          </View>
        )}

        {abrigoSelecionado && (
          <View style={styles.cartao}>
            <View style={styles.cartaoTopo}>
              <Text style={styles.nome}>{abrigoSelecionado.nome}</Text>

              <Pressable
                style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
                onPress={() => setAbrigoSelecionado(null)}
              >
                <Ionicons name="close" size={20} color="#9A8F7E" />
              </Pressable>
            </View>

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

              {abrigoSelecionado.contato ? (
                <View style={styles.dado}>
                  <Ionicons name="call-outline" size={15} color={colors.primary} />
                  <Text style={styles.textoDado}>{abrigoSelecionado.contato}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.acoes}>
              <Pressable
                style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
                onPress={() => tracarRota(abrigoSelecionado)}
              >
                <Ionicons name="navigate" size={20} color={colors.primary} />
                <Text style={styles.textoAcao}>Rota</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
                onPress={() => centralizarEm(abrigoSelecionado)}
              >
                <Ionicons name="locate" size={20} color={colors.primary} />
                <Text style={styles.textoAcao}>Centralizar</Text>
              </Pressable>

              {telefoneDoContato(abrigoSelecionado.contato) ? (
                <Pressable
                  style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
                  onPress={() => ligar(abrigoSelecionado)}
                >
                  <Ionicons name="call" size={20} color={colors.primary} />
                  <Text style={styles.textoAcao}>Ligar</Text>
                </Pressable>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
                onPress={() => compartilhar(abrigoSelecionado)}
              >
                <Ionicons name="share-social" size={20} color={colors.primary} />
                <Text style={styles.textoAcao}>Enviar</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.botaoDoar, pressed && styles.pressionado]}
              onPress={() =>
                props.navigation.navigate('Donate', { abrigo: abrigoSelecionado.nome })
              }
            >
              <Ionicons name="heart" size={18} color="#FFFFFF" />
              <Text style={styles.textoDoar}>Doar para este abrigo</Text>
            </Pressable>
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

  botaoMais: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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

  cartao: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    left: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
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
