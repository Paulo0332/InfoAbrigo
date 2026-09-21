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
import { registrarDoacao } from '../services/donations';
import { colors } from '../theme/colors';

const VALORES = [20, 50, 100];

export default function DonateScreen(props) {

  // O abrigo vem por parâmetro quando a doação começa pelo mapa. Chegando
  // pela ação rápida da Home não há abrigo escolhido, e a tela diz isso em
  // vez de inventar um nome.
  const parametros = props.route.params || {};
  const abrigo = parametros.abrigo || null;

  const [valor, setValor] = useState(50);
  const [confirmada, setConfirmada] = useState(false);
  const [temBiometria, setTemBiometria] = useState(true);
  const [conta, setConta] = useState(null);
  const [senha, setSenha] = useState('');

  useEffect(() => {
    buscarConta();
  }, []);

  // A conta é lida aqui porque, em aparelho sem biometria, a confirmação
  // é feita com a mesma senha que a pessoa cadastrou.
  async function buscarConta() {
    try {
      const contaSalva = await carregarConta();

      setConta(contaSalva);
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível ler a conta salva neste aparelho.'
      );
    }
  }

  // O BiometricButton avisa por aqui que a identidade foi confirmada.
  // Só depois disso a doação é gravada no histórico e a tela troca para
  // o selo de confirmada.
  async function confirmarDoacao() {
    // Sem abrigo escolhido não há para quem doar, e gravar abrigo null
    // faria a tela de sucesso dizer "para o null".
    if (!abrigo) {
      Alert.alert(
        'Atenção',
        'Escolha um abrigo no mapa antes de confirmar a doação.'
      );

      return;
    }

    const doacao = {
      id: Date.now().toString(),
      valor: valor,
      abrigo: abrigo,
      data: new Date().toISOString(),
    };

    try {
      await registrarDoacao(doacao);
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível registrar a doação.'
      );

      return;
    }

    setConfirmada(true);
  }

  function confirmarComSenha() {
    if (!conta) {
      Alert.alert(
        'Erro',
        'Não foi possível ler a sua conta.'
      );

      return;
    }

    if (!senha) {
      Alert.alert(
        'Atenção',
        'Digite a sua senha para confirmar.'
      );

      return;
    }

    if (senha !== conta.senha) {
      Alert.alert(
        'Não confirmado',
        'Senha incorreta.'
      );

      return;
    }

    Keyboard.dismiss();

    confirmarDoacao();
  }

  function voltar() {
    props.navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <LinearGradient
        colors={[colors.primary, colors.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopo}>
          <Pressable
            style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}
            onPress={voltar}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitulo}>Fazer uma doação</Text>

          <View style={styles.voltar} />
        </View>
      </LinearGradient>

      {confirmada ? (
        <View style={styles.sucesso}>
          <View style={styles.selo}>
            <Ionicons name="checkmark" size={44} color="#FFFFFF" />
          </View>

          <Text style={styles.tituloSucesso}>Doação confirmada</Text>

          <Text style={styles.textoSucesso}>
            R$ {valor},00 para o {abrigo}.{'\n'}
            Obrigado por ajudar!
          </Text>

          <Pressable
            style={({ pressed }) => [styles.botaoVoltar, pressed && styles.pressionado]}
            onPress={voltar}
          >
            <Text style={styles.textoBotaoVoltar}>Voltar para as doações</Text>
          </Pressable>
        </View>
      ) : (
        // Sem isto o teclado sobe por cima do campo de senha. No iOS o
        // KeyboardAvoidingView empurra o conteúdo; no Android o sistema
        // redimensiona a janela, e a folga no fim da rolagem dá espaço.
        <KeyboardAvoidingView
          style={styles.corpo}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <ScrollView
          style={styles.corpo}
          contentContainerStyle={styles.corpoConteudo}
          showsVerticalScrollIndicator={false}
        >

          {abrigo ? (
            <View style={styles.cartao}>
              <Text style={styles.rotulo}>Abrigo</Text>
              <Text style={styles.valorRotulo}>{abrigo}</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.cartao, pressed && styles.pressionado]}
              onPress={() => props.navigation.navigate('Tabs', { screen: 'Mapa' })}
            >
              <Text style={styles.rotulo}>Abrigo</Text>

              <Text style={styles.valorRotulo}>
                Escolha um abrigo no mapa
              </Text>
            </Pressable>
          )}

          <Text style={styles.secao}>Escolha o valor</Text>

          <View style={styles.valores}>
            {VALORES.map((opcao) => (
              <Pressable
                key={opcao}
                style={[styles.opcao, valor === opcao && styles.opcaoAtiva]}
                onPress={() => setValor(opcao)}
              >
                <Text
                  style={[
                    styles.textoOpcao,
                    valor === opcao && styles.textoOpcaoAtiva,
                  ]}
                >
                  R$ {opcao}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.resumo}>
            <Text style={styles.rotulo}>Você vai doar</Text>
            <Text style={styles.total}>R$ {valor},00</Text>
          </View>

          {/* A mensagem vai para a janela do sistema, então a pessoa lê o
              valor exato na hora de encostar o dedo. É o mesmo componente
              da tela de login, só com outro rótulo e outra mensagem. */}
          <BiometricButton
            rotulo="Confirmar com biometria"
            mensagem={'Confirme a doação de R$ ' + valor + ',00'}
            onSuccess={confirmarDoacao}
            onVerificado={setTemBiometria}
          />

          {/* Só aparece em aparelho sem biometria. A confirmação continua
              existindo, feita com a senha da conta: quem não tem sensor
              não fica sem doar, e a doação não é confirmada sozinha. */}
          {!temBiometria && (
            <View>
              <Text style={styles.rotuloSenha}>
                Confirme com a senha da sua conta
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Sua senha"
                placeholderTextColor="#9A8F7E"
                value={senha}
                onChangeText={setSenha}
                onSubmitEditing={confirmarComSenha}
                returnKeyType="done"
                secureTextEntry
                maxLength={40}
              />

              <Pressable
                style={({ pressed }) => [styles.botaoSimples, pressed && styles.pressionado]}
                onPress={confirmarComSenha}
              >
                <Text style={styles.textoBotaoSimples}>Confirmar com a senha</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.aviso}>
            Demonstração acadêmica: nenhum pagamento é processado de verdade.
          </Text>

        </ScrollView>
        </KeyboardAvoidingView>
      )}

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
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  voltar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  corpo: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  corpoConteudo: {
    padding: 16,
    paddingBottom: 140,
  },

  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  rotulo: {
    fontSize: 12,
    color: '#9A8F7E',
  },

  valorRotulo: {
    fontSize: 16,
    color: colors.textMain,
    marginTop: 4,
  },

  secao: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 20,
    marginBottom: 10,
  },

  valores: {
    flexDirection: 'row',
  },

  opcao: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    marginRight: 8,
  },

  opcaoAtiva: {
    borderColor: colors.primary,
    backgroundColor: '#FFF3E6',
  },

  textoOpcao: {
    fontSize: 16,
    color: colors.textMain,
  },

  textoOpcaoAtiva: {
    color: colors.primary,
    fontWeight: 'bold',
  },

  resumo: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },

  total: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 4,
  },

  rotuloSenha: {
    fontSize: 13,
    color: colors.textMain,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 6,
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

  botaoSimples: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  textoBotaoSimples: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  aviso: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 18,
  },

  sucesso: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.backgroundLight,
  },

  selo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.supportGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tituloSucesso: {
    fontSize: 21,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 16,
  },

  textoSucesso: {
    fontSize: 15,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },

  botaoVoltar: {
    height: 52,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },

  textoBotaoVoltar: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  pressionado: {
    opacity: 0.5,
  },
});
