import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BiometricButton from '../components/BiometricButton';
import { carregarConta } from '../services/auth';
import { colors } from '../theme/colors';

export default function LoginScreen(props) {

  const [conta, setConta] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Quando o app abre, a janela da digital pode abrir sozinha. Quando a
  // pessoa chega aqui por ter saído da conta, não pode: ela seria levada
  // de volta para dentro do aplicativo sem ter pedido isso.
  const parametros = props.route.params || {};
  const abrirDigitalSozinha = parametros.semBiometria !== true;

  useEffect(() => {
    buscarConta();
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

  // Usamos replace, e não navigate, para a tela de entrada sair da pilha:
  // depois de entrar, o botão voltar não deve trazer a pessoa de volta.
  function abrirApp() {
    Keyboard.dismiss();

    props.navigation.replace('Tabs');
  }

  function entrar() {
    const emailLimpo = email.trim();

    if (!emailLimpo || !senha) {
      Alert.alert(
        'Atenção',
        'Preencha o e-mail e a senha.'
      );

      return;
    }

    // A comparação é com a conta gravada no próprio aparelho. Não existe
    // servidor para consultar: é o que o Módulo 2 ensinou, aplicado aqui.
    const emailConfere =
      emailLimpo.toLowerCase() === conta.email.toLowerCase();

    if (!emailConfere || senha !== conta.senha) {
      Alert.alert(
        'Não foi possível entrar',
        'E-mail ou senha incorretos.'
      );

      return;
    }

    abrirApp();
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centralizado}>
          <Text style={styles.nota}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Sem isto o teclado sobe por cima do campo que está sendo
          digitado. No iOS o KeyboardAvoidingView empurra o conteúdo; no
          Android o próprio sistema redimensiona a janela, e a folga no fim
          da rolagem garante espaço para o campo subir. */}
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.marcaArea}>
          <LinearGradient
            colors={[colors.primary, colors.primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.marca}
          >
            <Ionicons name="heart" size={40} color="#FFFFFF" />
          </LinearGradient>

          <Text style={styles.titulo}>InfoAbrigo</Text>

          <Text style={styles.subtitulo}>
            Os abrigos da sua região, e o que eles precisam hoje.
          </Text>
        </View>

        {conta ? (
          <View>
            <Text style={styles.ola}>Olá, {conta.nome}!</Text>

            <Text style={styles.rotulo}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="voce@email.com"
              placeholderTextColor="#9A8F7E"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              maxLength={80}
            />

            <Text style={styles.rotulo}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor="#9A8F7E"
              value={senha}
              onChangeText={setSenha}
              onSubmitEditing={entrar}
              returnKeyType="done"
              secureTextEntry
              maxLength={40}
            />

            <Pressable
              style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
              onPress={entrar}
            >
              <Text style={styles.textoBotao}>Entrar</Text>
            </Pressable>

            {/* O botão só aparece para quem ativou a biometria no
                cadastro. A prop automatico faz a janela da digital abrir
                sozinha ao chegar na tela; quem cancelar continua com os
                campos acima para digitar. */}
            {conta.biometriaAtiva && (
              <View>
                <Text style={styles.ou}>ou</Text>

                <BiometricButton
                  rotulo="Entrar com biometria"
                  mensagem="Entre no InfoAbrigo com a sua biometria"
                  onSuccess={abrirApp}
                  automatico={abrirDigitalSozinha}
                />
              </View>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.semConta}>
              Você ainda não tem uma conta neste aparelho.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
              onPress={() => props.navigation.navigate('SignUp')}
            >
              <Text style={styles.textoBotao}>Criar conta</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.nota}>
          A biometria é conferida pelo seu aparelho. O InfoAbrigo nunca recebe
          a sua digital.
        </Text>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  conteudo: {
    flexGrow: 1,
    paddingBottom: 140,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  marcaArea: {
    alignItems: 'center',
    marginBottom: 28,
  },

  marca: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 16,
  },

  subtitulo: {
    fontSize: 14,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },

  ola: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 8,
  },

  rotulo: {
    fontSize: 13,
    color: colors.textMain,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 12,
  },

  input: {
    height: 52,
    color: colors.textMain,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 16,
    fontSize: 16,
  },

  botao: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },

  textoBotao: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  ou: {
    fontSize: 13,
    color: '#9A8F7E',
    textAlign: 'center',
    marginVertical: 14,
  },

  semConta: {
    fontSize: 15,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 21,
  },

  nota: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 24,
  },

  pressionado: {
    opacity: 0.6,
  },
});
