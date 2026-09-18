import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { montarAbrigos } from '../data/shelters';
import { colors } from '../theme/colors';

// Nível de aproximação do mapa. 14 mostra pouco mais de 3 km, o suficiente
// para ver a vizinhança de quem abriu o aplicativo.
const ZOOM = 14;

// Monta a página do mapa que roda dentro do WebView. O Leaflet desenha e os
// blocos vêm do OpenStreetMap, sem precisar de chave de API.
function montarHtml(localizacao, abrigos) {
  const marcadores = abrigos
    .map(
      (abrigo) => `
        L.circleMarker([${abrigo.latitude}, ${abrigo.longitude}], {
          radius: 11,
          color: '#FFFFFF',
          weight: 3,
          fillColor: '${abrigo.cor}',
          fillOpacity: 1
        })
          .addTo(mapa)
          .bindTooltip('${abrigo.nome}')
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
    </style>
  </head>

  <body>
    <div id="mapa"></div>

    <script>
      var mapa = L.map('mapa').setView(
        [${localizacao.latitude}, ${localizacao.longitude}],
        ${ZOOM}
      );

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapa);

      L.circleMarker([${localizacao.latitude}, ${localizacao.longitude}], {
        radius: 9,
        color: '#FFFFFF',
        weight: 3,
        fillColor: '${colors.supportPink}',
        fillOpacity: 1
      })
        .addTo(mapa)
        .bindTooltip('Você está aqui');

      ${marcadores}
    </script>
  </body>
</html>`;
}

export default function MapScreen() {

  const [localizacao, setLocalizacao] = useState(null);
  const [erro, setErro] = useState(null);
  const [abrigoSelecionado, setAbrigoSelecionado] = useState(null);

  // Os abrigos só existem depois da coordenada, porque é a partir dela que
  // cada um recebe a sua posição e a distância até o usuário.
  const abrigos = localizacao ? montarAbrigos(localizacao) : [];

  useEffect(() => {
    buscarLocalizacao();
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

  // A página avisa qual abrigo foi tocado mandando o id por postMessage.
  // Quem decide mostrar o cartão é a tela, do mesmo jeito que o NeedItem
  // avisa a lista no Módulo 1.
  function aoTocarNoMapa(evento) {
    const id = evento.nativeEvent.data;
    const abrigo = abrigos.find((item) => item.id === id);

    if (abrigo) {
      setAbrigoSelecionado(abrigo);
    }
  }

  function fecharCartao() {
    setAbrigoSelecionado(null);
  }

  function formatarDistancia(distancia) {
    return distancia.toFixed(1).replace('.', ',');
  }

  if (erro) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centralizado}>
          <Text style={styles.erro}>{erro}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!localizacao) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centralizado}>
          <Text style={styles.texto}>Aguarde...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <WebView
        style={styles.mapa}
        originWhitelist={['*']}
        source={{ html: montarHtml(localizacao, abrigos) }}
        onMessage={aoTocarNoMapa}
      />

      {abrigoSelecionado && (
        <View style={styles.cartao}>
          <View style={styles.cartaoTopo}>
            <Text style={styles.nome}>{abrigoSelecionado.nome}</Text>

            <Pressable
              style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
              onPress={fecharCartao}
            >
              <Ionicons name="close" size={20} color="#9A8F7E" />
            </Pressable>
          </View>

          <View style={styles.dados}>
            <View style={styles.dado}>
              <Ionicons name="navigate-outline" size={16} color={colors.primary} />

              <Text style={styles.textoDado}>
                a {formatarDistancia(abrigoSelecionado.distancia)} km
              </Text>
            </View>

            <View style={styles.dado}>
              <Ionicons name="people-outline" size={16} color={colors.primary} />

              <Text style={styles.textoDado}>
                {abrigoSelecionado.criancas} crianças acolhidas
              </Text>
            </View>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    textAlign: 'center',
  },

  erro: {
    fontSize: 15,
    color: colors.supportPink,
    textAlign: 'center',
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
    marginTop: 8,
  },

  dado: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 4,
  },

  textoDado: {
    fontSize: 14,
    color: '#9A8F7E',
    marginLeft: 5,
  },

  pressionado: {
    opacity: 0.5,
  },
});
