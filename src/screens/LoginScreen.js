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
import { buscarPerfil } from '../data/perfis';
import { carregarConta, carregarContas, entrarNaConta, salvarConta } from '../services/auth';
import { conferirResposta, conferirSenha, novoSal, resumir } from '../services/senha';
import { deuErrado } from '../services/tato';
import { colors } from '../theme/colors';

export default function LoginScreen(props) {

  const [contas, setContas] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [escolheuNaMao, setEscolheuNaMao] = useState(false);

  // Recuperação: a pergunta que a pessoa escolheu no cadastro, a resposta
  // e a senha nova.
  const [recuperando, setRecuperando] = useState(false);
  const [resposta, setResposta] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  // Quando o app abre, a janela da digital pode abrir sozinha. Quando a
  // pessoa chega aqui por ter saído da conta, não pode: ela seria levada
  // de volta para dentro do aplicativo sem ter pedido isso.
  const parametros = props.route.params || {};
  const abrirDigitalSozinha = parametros.semBiometria !== true && !escolheuNaMao;

  useEffect(() => {
    buscarContas();
  }, []);

  // A tela lista as contas criadas neste aparelho e já deixa escolhida a
  // última que esteve em uso. Antes existia uma conta só, e para ver o
  // aplicativo pelo lado do gestor e pelo lado de quem doa era preciso
  // apagar e criar outra.
  async function buscarContas() {
    try {
      const lista = await carregarContas();
      const atual = await carregarConta();

      setContas(lista);

      if (lista.length === 0) {
        return;
      }

      const anterior = atual
        ? lista.find((item) => item.email === atual.email)
        : null;

      setSelecionada(anterior || lista[0]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível ler as contas deste aparelho.');
    } finally {
      setCarregando(false);
    }
  }

  function escolher(conta) {
    setSelecionada(conta);
    setSenha('');
    setResposta('');
    setNovaSenha('');
    setRecuperando(false);
    setEscolheuNaMao(true);
  }

  // Usamos replace, e não navigate, para a tela de entrada sair da pilha:
  // depois de entrar, o botão voltar não deve trazer a pessoa de volta.
  async function abrirApp() {
    try {
      await entrarNaConta(selecionada);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir a conta.');

      return;
    }

    Keyboard.dismiss();

    props.navigation.replace('Tabs');
  }

  async function entrar() {
    if (!senha) {
      Alert.alert('Atenção', 'Digite a sua senha.');

      return;
    }

    const conferida = await conferirSenha(selecionada, senha);

    if (!conferida.confere) {
      deuErrado();

      Alert.alert('Não foi possível entrar', 'Senha incorreta.');

      return;
    }

    // Conta criada antes de a senha passar a ser guardada como resumo.
    // A conversão acontece agora, no primeiro acerto, sem pedir nada a
    // quem usa — e a senha em texto some do aparelho.
    if (conferida.precisaConverter) {
      await converterParaResumo();
    }

    abrirApp();
  }

  async function converterParaResumo() {
    try {
      const sal = novoSal();

      const atualizada = { ...selecionada, sal: sal, senhaResumo: await resumir(senha, sal) };

      delete atualizada.senha;

      await salvarConta(atualizada);

      setSelecionada(atualizada);
    } catch (error) {
      console.log('Erro ao converter a senha da conta:', error);
    }
  }

  function podeRecuperar() {
    return selecionada != null && Boolean(selecionada.respostaResumo);
  }

  function abrirRecuperacao() {
    if (!podeRecuperar()) {
      Alert.alert(
        'Sem recuperação para esta conta',
        selecionada && selecionada.biometriaAtiva
          ? 'Esta conta foi criada antes da pergunta de segurança. Entre pela biometria e, se precisar, crie outra conta.'
          : 'Esta conta foi criada antes da pergunta de segurança, e sem servidor não há como redefinir a senha. Será preciso criar outra conta.'
      );

      return;
    }

    setRecuperando(true);
  }

  async function redefinirSenha() {
    if (!(await conferirResposta(selecionada, resposta))) {
      Alert.alert('Resposta incorreta', 'A resposta não confere com a do cadastro.');

      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert('Atenção', 'A senha nova precisa ter pelo menos 6 caracteres.');

      return;
    }

    try {
      // O sal continua o mesmo de propósito: ele também tempera a
      // resposta da pergunta, e trocá-lo invalidaria a recuperação.
      const atualizada = {
        ...selecionada,
        senhaResumo: await resumir(novaSenha, selecionada.sal),
      };

      delete atualizada.senha;

      await salvarConta(atualizada);

      setSelecionada(atualizada);
      setRecuperando(false);
      setSenha('');

      Alert.alert('Senha alterada', 'Pronto. Entre com a senha nova.');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível alterar a senha.');
    }
  }

  function marca() {
    return (
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
    );
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

        {marca()}

        {contas.length === 0 ? (
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
        ) : (
          <View>
            {/* Com mais de uma conta no aparelho, a escolha vem antes da
                senha. É o que permite mostrar o aplicativo pelo lado do
                gestor e pelo lado de quem doa sem apagar nada. */}
            {contas.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.contas}
                contentContainerStyle={styles.contasConteudo}
              >
                {contas.map((item) => (
                  <Pressable
                    key={item.email}
                    style={({ pressed }) => [
                      styles.conta,
                      selecionada.email === item.email && styles.contaAtiva,
                      pressed && styles.pressionado,
                    ]}
                    onPress={() => escolher(item)}
                  >
                    <View
                      style={[
                        styles.inicial,
                        selecionada.email === item.email && styles.inicialAtiva,
                      ]}
                    >
                      <Text
                        style={[
                          styles.textoInicial,
                          selecionada.email === item.email && styles.textoInicialAtiva,
                        ]}
                      >
                        {item.nome.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <Text style={styles.contaNome} numberOfLines={1}>
                      {item.nome.trim().split(' ')[0]}
                    </Text>

                    <Text style={styles.contaPerfil} numberOfLines={1}>
                      {buscarPerfil(item.perfil) ? buscarPerfil(item.perfil).nome : 'Conta'}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Text style={styles.ola}>Olá, {selecionada.nome}!</Text>

            <Text style={styles.email}>{selecionada.email}</Text>

            {recuperando ? (
              <View>
                <Text style={styles.rotulo}>{selecionada.pergunta}</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Sua resposta"
                  placeholderTextColor="#9A8F7E"
                  value={resposta}
                  onChangeText={setResposta}
                  autoCapitalize="none"
                  maxLength={60}
                />

                <Text style={styles.rotulo}>Senha nova</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Pelo menos 6 caracteres"
                  placeholderTextColor="#9A8F7E"
                  value={novaSenha}
                  onChangeText={setNovaSenha}
                  secureTextEntry={!verSenha}
                  maxLength={40}
                />

                <Pressable
                  style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
                  onPress={redefinirSenha}
                >
                  <Text style={styles.textoBotao}>Alterar a senha</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.link, pressed && styles.pressionado]}
                  onPress={() => setRecuperando(false)}
                >
                  <Text style={styles.textoLink}>Voltar para a senha</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.rotulo}>Senha</Text>

                <View style={styles.campoSenha}>
                  <TextInput
                    style={styles.entradaSenha}
                    placeholder="Sua senha"
                    placeholderTextColor="#9A8F7E"
                    value={senha}
                    onChangeText={setSenha}
                    onSubmitEditing={entrar}
                    returnKeyType="done"
                    secureTextEntry={!verSenha}
                    maxLength={40}
                  />

                  {/* Digitar senha às cegas no celular é o motivo número
                      um de erro na hora de entrar. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mostrar ou esconder a senha"
                    style={({ pressed }) => [styles.olho, pressed && styles.pressionado]}
                    onPress={() => setVerSenha(!verSenha)}
                  >
                    <Ionicons
                      name={verSenha ? 'eye-off-outline' : 'eye-outline'}
                      size={21}
                      color="#9A8F7E"
                    />
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
                  onPress={entrar}
                >
                  <Text style={styles.textoBotao}>Entrar</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.link, pressed && styles.pressionado]}
                  onPress={abrirRecuperacao}
                >
                  <Text style={styles.textoLink}>Esqueci a senha</Text>
                </Pressable>

                {/* O botão só aparece para quem ativou a biometria no
                    cadastro. A prop automatico faz a janela da digital
                    abrir sozinha ao chegar na tela; quem cancelar continua
                    com o campo acima para digitar. */}
                {selecionada.biometriaAtiva && (
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
            )}

            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressionado]}
              onPress={() => props.navigation.navigate('SignUp')}
            >
              <Text style={styles.textoLink}>Criar outra conta neste aparelho</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.nota}>
          A biometria é conferida pelo seu aparelho. O InfoAbrigo nunca recebe
          a sua digital, e a sua senha é guardada como resumo, não como texto.
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
    marginBottom: 24,
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

  contas: {
    flexGrow: 0,
    marginBottom: 18,
  },

  contasConteudo: {
    paddingRight: 8,
  },

  conta: {
    width: 96,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginRight: 10,
  },

  contaAtiva: {
    borderColor: colors.primary,
  },

  inicial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inicialAtiva: {
    backgroundColor: colors.primary,
  },

  textoInicial: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  textoInicialAtiva: {
    color: '#FFFFFF',
  },

  contaNome: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 6,
  },

  contaPerfil: {
    fontSize: 10,
    color: '#9A8F7E',
    marginTop: 1,
  },

  ola: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  email: {
    fontSize: 13,
    color: '#9A8F7E',
    marginTop: 2,
    marginBottom: 6,
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

  campoSenha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingRight: 8,
  },

  entradaSenha: {
    flex: 1,
    height: 52,
    color: colors.textMain,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  olho: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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

  link: {
    alignItems: 'center',
    paddingVertical: 14,
  },

  textoLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },

  ou: {
    fontSize: 13,
    color: '#9A8F7E',
    textAlign: 'center',
    marginVertical: 10,
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
    marginTop: 20,
  },

  pressionado: {
    opacity: 0.6,
  },
});
