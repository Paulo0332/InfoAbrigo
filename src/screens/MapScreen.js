import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.centralizado}>

        {erro && <Text style={styles.erro}>{erro}</Text>}

        {!erro && !localizacao && (
          <Text style={styles.texto}>Aguarde...</Text>
        )}

        {localizacao && (
          <Text style={styles.texto}>
            {localizacao.latitude.toFixed(5)}, {localizacao.longitude.toFixed(5)}
          </Text>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
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
