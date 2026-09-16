import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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

  async function autenticar() {
    try {
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: props.mensagem,
        cancelLabel: 'Cancelar',
        // Com o fallback ligado, quem não conseguir usar a digital ainda
        // consegue entrar com o PIN do próprio aparelho.
        disableDeviceFallback: false,
      });

      // Quem decide o que fazer depois é a tela, não este componente:
      // aqui só avisamos que a identidade foi confirmada.
      if (resultado.success) {
        props.onSuccess();

        return;
      }

      // Cancelar é uma escolha do usuário, não um erro. Nesse caso a
      // pessoa simplesmente continua na tela de entrada.
      if (
        resultado.error === 'user_cancel' ||
        resultado.error === 'app_cancel' ||
        resultado.error === 'system_cancel'
      ) {
        return;
      }

      Alert.alert(
        'Não foi possível entrar',
        'A sua identidade não foi confirmada.'
      );
    } catch (error) {
      console.log('Erro ao autenticar:', error);

      Alert.alert(
        'Erro',
        'Não foi possível iniciar a autenticação.'
      );
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

  return (
    <Pressable
      style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
      onPress={autenticar}
    >
      <Ionicons name="finger-print" size={22} color="#FFFFFF" />

      <Text style={styles.textoBotao}>Entrar com biometria</Text>
    </Pressable>
  );
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

  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 14,
  },

  textoBotao: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },

  pressionado: {
    opacity: 0.7,
  },
});
