import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from '../theme/colors';

export default function BiometricButton(props) {

  const [temBiometria, setTemBiometria] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    verificarHardware();
  }, []);

  // São duas perguntas diferentes: o aparelho TEM sensor de biometria?
  // E existe digital ou rosto JÁ CADASTRADO nele? Só com as duas
  // respostas positivas adianta oferecer a entrada pela digital.
  async function verificarHardware() {
    try {
      const temSensor = await LocalAuthentication.hasHardwareAsync();
      const temCadastro = await LocalAuthentication.isEnrolledAsync();

      setTemBiometria(temSensor && temCadastro);
    } catch (error) {
      console.log('Erro ao verificar a biometria:', error);

      setTemBiometria(false);
    } finally {
      setVerificando(false);
    }
  }

  if (verificando) {
    return (
      <View style={styles.aviso}>
        <Text style={styles.textoAviso}>Verificando o sensor...</Text>
      </View>
    );
  }

  if (!temBiometria) {
    return (
      <View style={styles.aviso}>
        <Ionicons
          name="alert-circle-outline"
          size={18}
          color={colors.supportPink}
        />

        <Text style={styles.textoAviso}>
          Dispositivo não compatível com biometria
        </Text>
      </View>
    );
  }

  // O botão entra no próximo commit, junto com a função que ele chama.
  return null;
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },

  textoAviso: {
    fontSize: 14,
    color: '#9A8F7E',
    textAlign: 'center',
    marginLeft: 6,
  },
});
