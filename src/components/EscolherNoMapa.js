import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { toqueLeve } from '../services/tato';
import { colors } from '../theme/colors';

// Marcar o abrigo tocando no mapa.
//
// As outras duas formas são aproximações: o CEP aponta para a via, às
// vezes para o centro da cidade, e o geocodificador acerta a rua mas erra
// o lado e o número. Para quem conhece o lugar, apontar no mapa é a única
// forma exata — e é o que todo aplicativo de entrega faz.
//
// O ponto de partida é o que já estiver marcado; sem nada marcado, é onde
// a pessoa está; sem isso, o centro do país, para o mapa nunca abrir no
// oceano.
const CENTRO_DO_PAIS = { latitude: -15.79, longitude: -47.88 };

function montarHtml(inicial, temMarca) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html, body, #mapa { height: 100%; margin: 0; padding: 0; }

      .pino {
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${colors.primary};
        border: 3px solid #FFFFFF;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
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

      .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7); }
      .leaflet-control-zoom { border: none !important; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
      .leaflet-control-zoom a { color: ${colors.textMain}; border-radius: 10px !important; }
    </style>
  </head>

  <body>
    <div id="mapa"></div>

    <script>
      var mapa = L.map('mapa', { zoomControl: true, attributionControl: true })
        .setView([${inicial.latitude}, ${inicial.longitude}], ${temMarca ? 17 : 13});

      // Atenção à ordem: a Esri usa {z}/{y}/{x}, e não {z}/{x}/{y}.
      var blocos = L.tileLayer(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap' }
      );

      var reserva = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      });

      var falhas = 0;
      var trocou = false;

      blocos.on('tileerror', function () {
        falhas = falhas + 1;

        if (falhas >= 4 && !trocou) {
          trocou = true;
          mapa.removeLayer(blocos);
          reserva.addTo(mapa);
        }
      });

      blocos.addTo(mapa);

      var icone = L.divIcon({
        className: 'vazio',
        html: '<div class="pino"><div class="pinoDentro"></div></div>',
        iconSize: [30, 42],
        iconAnchor: [15, 42]
      });

      var marca = ${temMarca}
        ? L.marker([${inicial.latitude}, ${inicial.longitude}], { icon: icone, draggable: true }).addTo(mapa)
        : null;

      function avisar(ponto) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ latitude: ponto.lat, longitude: ponto.lng })
        );
      }

      function marcar(ponto) {
        if (marca) {
          marca.setLatLng(ponto);
        } else {
          marca = L.marker(ponto, { icon: icone, draggable: true }).addTo(mapa);
          marca.on('dragend', function () { avisar(marca.getLatLng()); });
        }

        avisar(ponto);
      }

      // Tocar marca; arrastar o pino ajusta fino, que é o gesto de quem
      // quer acertar a entrada do prédio e não o meio da quadra.
      mapa.on('click', function (evento) { marcar(evento.latlng); });

      if (marca) {
        marca.on('dragend', function () { avisar(marca.getLatLng()); });
      }

      // Chamada de fora, pelo botão de centralizar.
      function irPara(latitude, longitude) {
        mapa.setView([latitude, longitude], 17);
      }
    </script>
  </body>
</html>`;
}

export default function EscolherNoMapa(props) {

  const areaSegura = useSafeAreaInsets();
  const mapaRef = useRef(null);

  const [ponto, setPonto] = useState(props.inicial || null);
  const [carregando, setCarregando] = useState(true);

  // Reabrindo depois de o endereço ter mudado, o mapa precisa começar do
  // ponto novo — senão volta para o que estava marcado da vez passada.
  useEffect(() => {
    if (props.visivel) {
      setPonto(props.inicial || null);
      setCarregando(true);
    }
  }, [props.visivel]);

  function aoTocarNoMapa(evento) {
    try {
      const recebido = JSON.parse(evento.nativeEvent.data);

      toqueLeve();
      setPonto({ latitude: recebido.latitude, longitude: recebido.longitude });
    } catch (error) {
      console.log('Recado do mapa fora do formato:', error);
    }
  }

  function centralizarEmMim() {
    if (props.localizacao == null || mapaRef.current == null) {
      return;
    }

    mapaRef.current.injectJavaScript(
      'irPara(' + props.localizacao.latitude + ',' + props.localizacao.longitude + '); true;'
    );
  }

  const inicial = props.inicial || props.localizacao || CENTRO_DO_PAIS;

  return (
    <Modal visible={props.visivel} animationType="slide" onRequestClose={props.aoFechar}>
      <View style={styles.tela}>
        <View style={[styles.topo, { paddingTop: areaSegura.top + 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
            onPress={props.aoFechar}
          >
            <Ionicons name="close" size={24} color={colors.textMain} />
          </Pressable>

          <Text style={styles.titulo}>Toque no mapa para marcar</Text>
        </View>

        <View style={styles.areaMapa}>
          <WebView
            ref={mapaRef}
            style={styles.mapa}
            originWhitelist={['*']}
            source={{ html: montarHtml(inicial, props.inicial != null) }}
            onMessage={aoTocarNoMapa}
            onLoadEnd={() => setCarregando(false)}
          />

          {carregando && (
            <View style={styles.carregando}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.textoCarregando}>Desenhando o mapa...</Text>
            </View>
          )}

          {props.localizacao ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Centralizar onde você está"
              style={({ pressed }) => [styles.botaoMim, pressed && styles.pressionado]}
              onPress={centralizarEmMim}
            >
              <Ionicons name="locate" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.base, { paddingBottom: areaSegura.bottom + 16 }]}>
          {ponto ? (
            <Text style={styles.coordenada}>
              Marcado em {ponto.latitude.toFixed(5)}, {ponto.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.dica}>
              Toque onde fica o abrigo. Depois dá para arrastar o pino para
              acertar a entrada.
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.botao,
              !ponto && styles.botaoTravado,
              pressed && ponto && styles.pressionado,
            ]}
            onPress={() => props.aoConfirmar(ponto)}
            disabled={!ponto}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.textoBotao}>Usar este ponto</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  fechar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titulo: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginLeft: 4,
  },

  areaMapa: {
    flex: 1,
  },

  mapa: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  carregando: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },

  textoCarregando: {
    fontSize: 14,
    color: '#9A8F7E',
    marginTop: 10,
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

  base: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  coordenada: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMain,
    textAlign: 'center',
  },

  dica: {
    fontSize: 13,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 19,
  },

  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.primary,
    marginTop: 14,
  },

  botaoTravado: {
    backgroundColor: '#C9BFB1',
  },

  textoBotao: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },

  pressionado: {
    opacity: 0.6,
  },
});
