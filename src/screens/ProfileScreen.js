import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { carregarConta, salvarConta } from '../services/auth';
import { colors } from '../theme/colors';

export default function ProfileScreen() {

  const [conta, setConta] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [temBiometria, setTemBiometria] = useState(false);

  useEffect(() => {
    buscarConta();
    verificarBiometria();
  }, []);

  async function buscarConta() {
    try {
      const contaSalva = await carregarConta();

      setConta(contaSalva);
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível ler a conta salva neste aparelho.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // As mesmas duas perguntas do BiometricButton: sem sensor ou sem digital
  // cadastrada, o switch aparece desligado e não deixa ligar.
  async function verificarBiometria() {
    try {
      const temSensor = await LocalAuthentication.hasHardwareAsync();
      const temCadastro = await LocalAuthentication.isEnrolledAsync();

      setTemBiometria(temSensor && temCadastro);
    } catch (error) {
      console.log('Erro ao verificar a biometria:', error);

      setTemBiometria(false);
    }
  }

  // Ligar exige confirmar a digital na hora, igual ao cadastro: é assim que
  // sabemos que a pessoa consegue mesmo entrar por ali depois.
  async function alternarBiometria(ligar) {
    if (!ligar) {
      gravarPreferencia(false);

      return;
    }

    try {
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme a sua biometria para ativar',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (resultado.success) {
        gravarPreferencia(true);
      }
    } catch (error) {
      console.log('Erro ao ativar a biometria:', error);

      Alert.alert(
        'Erro',
        'Não foi possível ativar a biometria.'
      );
    }
  }

  async function gravarPreferencia(ativa) {
    const atualizada = { ...conta, biometriaAtiva: ativa };

    try {
      await salvarConta(atualizada);

      setConta(atualizada);
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível salvar a preferência.'
      );
    }
  }

  function primeiraLetra(nome) {
    return nome.trim().charAt(0).toUpperCase();
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centralizado}>
          <Text style={styles.nota}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <LinearGradient
        colors={[colors.primary, colors.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitulo}>Perfil</Text>

        {conta && (
          <View style={styles.identificacao}>
            <View style={styles.avatar}>
              <Text style={styles.textoAvatar}>
                {primeiraLetra(conta.nome)}
              </Text>
            </View>

            <View style={styles.identificacaoTexto}>
              <Text style={styles.nome}>{conta.nome}</Text>
              <Text style={styles.email}>{conta.email}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.corpo}
        contentContainerStyle={styles.corpoConteudo}
        showsVerticalScrollIndicator={false}
      >

        {conta ? (
          <View>
            <Text style={styles.grupo}>Acesso</Text>

            <View style={styles.cartao}>
              <View style={styles.linha}>
                <View style={styles.icone}>
                  <Ionicons
                    name="finger-print"
                    size={20}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTitulo}>Entrar com biometria</Text>

                  <Text style={styles.linhaDescricao}>
                    {temBiometria
                      ? 'Entre com a digital em vez de digitar a senha'
                      : 'Este aparelho não tem biometria cadastrada'}
                  </Text>
                </View>

                <Switch
                  value={conta.biometriaAtiva === true}
                  onValueChange={alternarBiometria}
                  disabled={!temBiometria}
                  trackColor={{ true: colors.primaryGradient, false: '#E6DED2' }}
                  thumbColor={conta.biometriaAtiva ? colors.primary : '#FFFFFF'}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.cartao}>
            <Text style={styles.textoSemConta}>
              Nenhuma conta gravada neste aparelho.
            </Text>
          </View>
        )}

        <Text style={styles.aviso}>
          Os dados da sua conta ficam apenas neste aparelho. O InfoAbrigo
          ainda não tem servidor.
        </Text>

      </ScrollView>

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
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTitulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  identificacao: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoAvatar: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  identificacaoTexto: {
    flex: 1,
    marginLeft: 14,
  },

  nome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  email: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },

  corpo: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  corpoConteudo: {
    padding: 16,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },

  grupo: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#9A8F7E',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },

  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },

  icone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  linhaTexto: {
    flex: 1,
    marginHorizontal: 12,
  },

  linhaTitulo: {
    fontSize: 15,
    color: colors.textMain,
  },

  linhaDescricao: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 2,
  },

  textoSemConta: {
    fontSize: 15,
    color: '#9A8F7E',
    paddingVertical: 14,
  },

  nota: {
    fontSize: 15,
    color: colors.textMain,
  },

  aviso: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 20,
  },
});
