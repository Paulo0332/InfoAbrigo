import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';

// Quanto do mapa cabe na tela. 0.03 grau é pouco mais de 3 km, o
// suficiente para ver a vizinhança de quem abriu o aplicativo.
const ZOOM = 0.03;

export default function MapScreen() {

  const [localizacao, setLocalizacao] = useState(null);
  const [erro, setErro] = useState(null);

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
      </MapView>
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
});
