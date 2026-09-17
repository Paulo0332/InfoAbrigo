import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { montarAbrigos } from '../data/shelters';
import { colors } from '../theme/colors';

// Quanto do mapa cabe na tela. 0.03 grau é pouco mais de 3 km, o
// suficiente para ver a vizinhança de quem abriu o aplicativo.
const ZOOM = 0.03;

export default function MapScreen() {

  const [localizacao, setLocalizacao] = useState(null);
  const [erro, setErro] = useState(null);
  const [abrigoSelecionado, setAbrigoSelecionado] = useState(null);

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

  // O marcador avisa qual abrigo foi tocado; quem decide mostrar o cartão
  // é a tela, do mesmo jeito que o NeedItem avisa a lista no Módulo 1.
  function selecionarAbrigo(abrigo) {
    setAbrigoSelecionado(abrigo);
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

  // Os abrigos só existem depois da coordenada, porque é a partir dela
  // que cada um recebe a sua posição e a distância até o usuário.
  const abrigos = montarAbrigos(localizacao);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <MapView
        style={styles.mapa}
        loadingEnabled
        region={{
          latitude: localizacao.latitude,
          longitude: localizacao.longitude,
          latitudeDelta: ZOOM,
          longitudeDelta: ZOOM,
        }}
      >
        <Marker
          coordinate={{
            latitude: localizacao.latitude,
            longitude: localizacao.longitude,
          }}
          title="Você está aqui"
          pinColor={colors.supportPink}
        />

        {abrigos.map((abrigo) => (
          <Marker
            key={abrigo.id}
            coordinate={{
              latitude: abrigo.latitude,
              longitude: abrigo.longitude,
            }}
            title={abrigo.nome}
            description={abrigo.criancas + ' crianças acolhidas'}
            pinColor={abrigo.cor}
            onPress={() => selecionarAbrigo(abrigo)}
          />
        ))}
      </MapView>

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
