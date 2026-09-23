import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';
import {
  apagarConta,
  carregarConta,
  sairDaConta,
  salvarConta,
} from '../services/auth';
import { colors } from '../theme/colors';

const VERSAO = '1.0.0';

export default function ProfileScreen(props) {

  const [conta, setConta] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [temBiometria, setTemBiometria] = useState(false);
  const [permissaoLocalizacao, setPermissaoLocalizacao] = useState(false);

  const [permissaoCamera] = useCameraPermissions();

  useEffect(() => {
    buscarConta();
    verificarBiometria();
    verificarLocalizacao();
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

  // getForegroundPermissions só consulta o que já foi decidido; quem pede
  // de verdade é a tela do mapa, no momento em que precisa.
  async function verificarLocalizacao() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();

      setPermissaoLocalizacao(status === 'granted');
    } catch (error) {
      console.log('Erro ao verificar a localização:', error);

      setPermissaoLocalizacao(false);
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

  // Sair apenas tranca o aplicativo de novo: a conta continua gravada, e
  // a pessoa volta a entrar com a senha ou com a digital. O Perfil é uma
  // aba, e o login mora no Stack que envolve as abas — por isso pedimos ao
  // navegador pai para trocar de tela.
  //
  // O semBiometria avisa o login para não abrir a digital sozinha: quem
  // acabou de sair seria jogado de volta para dentro do app.
  async function sair() {
    // Agora que o aparelho guarda mais de uma conta, sair precisa soltar
    // qual delas está em uso. Sem isso a tela de entrada voltaria já
    // grudada na mesma conta, e trocar de conta ficaria impossível.
    try {
      await sairDaConta();
    } catch (error) {
      console.log('Erro ao sair da conta:', error);
    }

    props.navigation.getParent().replace('Login', { semBiometria: true });
  }

  function confirmarExclusao() {
    Alert.alert(
      'Apagar a conta deste aparelho',
      'Isto remove o seu nome, e-mail e senha daqui. Não existe servidor guardando nada, então não há como recuperar: você teria de criar outra conta.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: apagar,
        },
      ]
    );
  }

  async function apagar() {
    try {
      await apagarConta();

      props.navigation.getParent().replace('Login');
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível apagar a conta.'
      );
    }
  }

  function primeiraLetra(nome) {
    return nome.trim().charAt(0).toUpperCase();
  }

  function renderizarPermissao(icone, titulo, concedida) {
    return (
      <View style={styles.linha}>
        <View style={styles.icone}>
          <Ionicons name={icone} size={20} color={colors.primary} />
        </View>

        <View style={styles.linhaTexto}>
          <Text style={styles.linhaTitulo}>{titulo}</Text>

          <Text style={styles.linhaDescricao}>
            {concedida
              ? 'Permissão concedida'
              : 'Não concedida — o app pede quando precisar'}
          </Text>
        </View>

        <Ionicons
          name={concedida ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={concedida ? colors.supportGreen : '#C9BFB1'}
        />
      </View>
    );
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

            <Text style={styles.grupo}>Permissões</Text>

            <View style={styles.cartao}>
              {renderizarPermissao(
                'camera-outline',
                'Câmera',
                permissaoCamera ? permissaoCamera.granted : false
              )}

              <View style={styles.divisoria} />

              {renderizarPermissao(
                'location-outline',
                'Localização',
                permissaoLocalizacao
              )}
            </View>

            <Text style={styles.grupo}>Privacidade e conta</Text>

            <View style={styles.cartao}>
              <View style={styles.linha}>
                <View style={styles.icone}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTitulo}>Seus dados</Text>

                  <Text style={styles.linhaDescricao}>
                    Nome, e-mail e senha ficam só neste aparelho. A digital
                    nunca chega ao aplicativo.
                  </Text>
                </View>
              </View>

              <View style={styles.divisoria} />

              <Pressable
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                onPress={sair}
              >
                <View style={styles.icone}>
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTitulo}>Sair da conta</Text>

                  <Text style={styles.linhaDescricao}>
                    Volta para o login. A sua conta continua salva aqui.
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
              </Pressable>

              <View style={styles.divisoria} />

              <Pressable
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                onPress={confirmarExclusao}
              >
                <View style={styles.icone}>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.supportPink}
                  />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTituloSair}>
                    Apagar a conta deste aparelho
                  </Text>

                  <Text style={styles.linhaDescricao}>
                    Remove os seus dados. Não há como recuperar.
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
              </Pressable>
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
          InfoAbrigo {VERSAO}
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
    marginTop: 20,
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

  divisoria: {
    height: 1,
    backgroundColor: '#F0E9DC',
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

  linhaTituloSair: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.supportPink,
  },

  linhaDescricao: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 16,
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
    marginTop: 24,
  },

  pressionado: {
    opacity: 0.5,
  },
});
