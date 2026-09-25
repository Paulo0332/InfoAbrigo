import { useState } from 'react';
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
import * as LocalAuthentication from 'expo-local-authentication';
import { PERFIS } from '../data/perfis';
import {
  CNPJ_DEMONSTRACAO,
  cnpjValido,
  consultarCnpj,
  formatarCnpj,
} from '../services/cnpj';
import { carregarContas, emailJaUsado, salvarConta } from '../services/auth';
import { novoSal, resumir, resumirResposta } from '../services/senha';
import { colors } from '../theme/colors';

// Perguntas fixas para a recuperação. Escolher de uma lista é melhor que
// escrever a pergunta: quem escreve costuma criar uma que não lembra
// depois, e a resposta livre já basta para não ser adivinhável.
const PERGUNTAS = [
  'Qual era o nome do seu primeiro animal de estimação?',
  'Em que cidade a sua mãe nasceu?',
  'Qual foi o nome da sua primeira escola?',
  'Qual é o seu prato preferido?',
];

export default function SignUpScreen(props) {

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState(PERFIS[2].id);
  const [cnpj, setCnpj] = useState('');
  const [instituicao, setInstituicao] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const [pergunta, setPergunta] = useState(PERGUNTAS[0]);
  const [resposta, setResposta] = useState('');

  function digitarCnpj(texto) {
    setCnpj(formatarCnpj(texto));

    // Mexeu no número, a verificação anterior não vale mais.
    setInstituicao(null);
  }

  // Duas etapas: a conta dos dígitos, que roda sem internet e derruba
  // erro de digitação, e a consulta pública, que diz se existe e se está
  // ativa na Receita.
  async function verificarInstituicao() {
    if (!cnpjValido(cnpj)) {
      Alert.alert(
        'CNPJ inválido',
        'Confira os números. Os dois dígitos do fim não batem com o resto.'
      );

      return;
    }

    setVerificando(true);

    try {
      const resultado = await consultarCnpj(cnpj);

      setInstituicao(resultado);

      if (resultado.situacao === 'inexistente') {
        Alert.alert(
          'CNPJ não encontrado',
          'Este número não consta na Receita Federal.'
        );
      }

      if (resultado.situacao === 'inativa') {
        Alert.alert(
          'Instituição não está ativa',
          'O cadastro deste CNPJ na Receita não está ativo.'
        );
      }

      if (resultado.situacao === 'indisponivel') {
        Alert.alert(
          'Sem conexão',
          'Não foi possível consultar a Receita agora. O número passou na validação local, mas o cadastro fica marcado como não verificado.'
        );
      }
    } finally {
      setVerificando(false);
    }
  }

  // Mesma validação do adicionarTarefa() do exemplo do professor: limpa
  // os espaços das pontas e, se sobrar vazio, avisa e interrompe.
  async function criarConta() {
    const nomeLimpo = nome.trim();
    // Em minúsculas: o e-mail identifica a conta e marca o dono do
    // abrigo, e "Josue@x.com" e "josue@x.com" são a mesma pessoa em
    // qualquer serviço de e-mail. Sem normalizar, uma diferença de
    // maiúscula fazia o abrigo parecer de outro dono.
    const emailLimpo = email.trim().toLowerCase();

    if (!nomeLimpo || !emailLimpo || !senha) {
      Alert.alert(
        'Atenção',
        'Preencha o nome, o e-mail e a senha.'
      );

      return;
    }

    if (!emailLimpo.includes('@')) {
      Alert.alert(
        'Atenção',
        'Digite um e-mail válido.'
      );

      return;
    }

    if (senha.length < 6) {
      Alert.alert(
        'Atenção',
        'A senha precisa ter pelo menos 6 caracteres.'
      );

      return;
    }

    if (resposta.trim().length < 2) {
      Alert.alert(
        'Atenção',
        'Responda à pergunta de segurança. É por ela que você recupera a conta se esquecer a senha.'
      );

      return;
    }

    // Duas contas com o mesmo e-mail no mesmo aparelho deixariam a tela de
    // entrada sem saber qual das duas conferir.
    const contas = await carregarContas();

    if (emailJaUsado(contas, emailLimpo)) {
      Alert.alert(
        'E-mail já cadastrado',
        'Já existe uma conta com este e-mail neste aparelho. Entre por ela na tela inicial.'
      );

      return;
    }

    // Gestor administra abrigo e publica necessidades em nome de uma
    // instituição. Por isso ele precisa informar o CNPJ dela.
    if (perfil === 'gestor') {
      if (!instituicao) {
        Alert.alert(
          'Atenção',
          'Toque em "Verificar" para confirmar o CNPJ da instituição.'
        );

        return;
      }

      if (instituicao.situacao === 'inexistente' || instituicao.situacao === 'inativa') {
        Alert.alert(
          'Não é possível continuar',
          'O CNPJ precisa existir e estar ativo na Receita Federal.'
        );

        return;
      }
    }

    // A senha não é gravada: o que fica é o resumo dela com um sal
    // próprio da conta. De dentro do resumo não se volta para a senha, e
    // senha é justamente o que as pessoas repetem em outros serviços.
    const sal = novoSal();

    const conta = {
      nome: nomeLimpo,
      email: emailLimpo,
      sal: sal,
      senhaResumo: await resumir(senha, sal),
      pergunta: pergunta,
      respostaResumo: await resumirResposta(resposta, sal),
      perfil: perfil,
      instituicao:
        perfil === 'gestor'
          ? {
              cnpj: cnpj,
              razaoSocial: instituicao.razaoSocial || '',
              municipio: instituicao.municipio || '',
              uf: instituicao.uf || '',
              cnae: instituicao.cnae || '',
              verificado: instituicao.situacao === 'ativa',
              demonstracao: instituicao.situacao === 'demonstracao',
              assistenciaSocial: instituicao.assistenciaSocial === true,
            }
          : null,
      // Começa desligada: quem decide é a pessoa, no aviso logo abaixo.
      biometriaAtiva: false,
    };

    try {
      await salvarConta(conta);

      Keyboard.dismiss();

      pedirBiometria(conta);
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível criar a conta.'
      );
    }
  }

  // As mesmas duas perguntas do BiometricButton: o aparelho tem sensor e
  // tem digital cadastrada? Sem isso não faz sentido nem oferecer.
  async function pedirBiometria(conta) {
    try {
      const temSensor = await LocalAuthentication.hasHardwareAsync();
      const temCadastro = await LocalAuthentication.isEnrolledAsync();

      if (!temSensor || !temCadastro) {
        abrirApp();

        return;
      }
    } catch (error) {
      console.log('Erro ao verificar a biometria:', error);

      abrirApp();

      return;
    }

    Alert.alert(
      'Usar a sua biometria?',
      'Nas próximas vezes você entra com a digital, sem digitar a senha.',
      [
        {
          text: 'Agora não',
          style: 'cancel',
          onPress: abrirApp,
        },
        {
          text: 'Ativar',
          onPress: () => ativarBiometria(conta),
        },
      ]
    );
  }

  // A ativação só vale se a pessoa confirmar a digital na hora: é assim
  // que sabemos que ela consegue mesmo entrar por ali depois.
  async function ativarBiometria(conta) {
    try {
      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme a sua biometria para ativar',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (resultado.success) {
        await salvarConta({ ...conta, biometriaAtiva: true });
      }
    } catch (error) {
      console.log('Erro ao ativar a biometria:', error);
    } finally {
      abrirApp();
    }
  }

  function abrirApp() {
    props.navigation.replace('Tabs');
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
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}
            onPress={() => props.navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitulo}>Criar conta</Text>

          <View style={styles.voltar} />
        </View>
      </LinearGradient>

      {/* Sem isto o teclado sobe por cima do campo que está sendo
          digitado. No iOS o KeyboardAvoidingView empurra o conteúdo; no
          Android o próprio sistema redimensiona a janela, e a folga no fim
          da rolagem garante espaço para o campo subir. */}
      <KeyboardAvoidingView
        style={styles.corpo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={styles.corpo}
        contentContainerStyle={styles.corpoConteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        <Text style={styles.rotulo}>Nome</Text>
        <TextInput
          style={styles.input}
          placeholder="Como podemos te chamar"
          placeholderTextColor="#9A8F7E"
          value={nome}
          onChangeText={setNome}
          maxLength={60}
        />

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

        <View style={styles.campoSenha}>
          <TextInput
            style={styles.entradaSenha}
            placeholder="Pelo menos 6 caracteres"
            placeholderTextColor="#9A8F7E"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry={!verSenha}
            maxLength={40}
          />

          {/* Digitar senha às cegas no celular é o motivo número um de
              erro na hora de entrar. */}
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

        <Text style={styles.rotulo}>Pergunta de segurança</Text>

        <Text style={styles.ajudaPergunta}>
          Sem servidor não existe "enviar link por e-mail". Esta resposta é
          o que devolve o acesso se você esquecer a senha.
        </Text>

        {PERGUNTAS.map((opcao) => (
          <Pressable
            key={opcao}
            style={({ pressed }) => [
              styles.opcaoPergunta,
              pergunta === opcao && styles.opcaoPerguntaAtiva,
              pressed && styles.pressionado,
            ]}
            onPress={() => setPergunta(opcao)}
          >
            <Ionicons
              name={pergunta === opcao ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={pergunta === opcao ? colors.primary : '#9A8F7E'}
            />

            <Text style={styles.textoPergunta}>{opcao}</Text>
          </Pressable>
        ))}

        <TextInput
          style={styles.input}
          placeholder="Sua resposta"
          placeholderTextColor="#9A8F7E"
          value={resposta}
          onChangeText={setResposta}
          autoCapitalize="none"
          maxLength={60}
        />

        <Text style={styles.rotulo}>Como você vai usar o aplicativo</Text>

        {PERFIS.map((opcao) => (
          <Pressable
            key={opcao.id}
            style={({ pressed }) => [
              styles.perfil,
              perfil === opcao.id && styles.perfilEscolhido,
              pressed && styles.pressionado,
            ]}
            onPress={() => setPerfil(opcao.id)}
          >
            <View style={[styles.perfilIcone, { backgroundColor: opcao.cor }]}>
              <Ionicons name={opcao.icone} size={18} color="#FFFFFF" />
            </View>

            <View style={styles.perfilTexto}>
              <Text style={styles.perfilNome}>{opcao.nome}</Text>
              <Text style={styles.perfilDescricao}>{opcao.descricao}</Text>
            </View>

            <Ionicons
              name={perfil === opcao.id ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={perfil === opcao.id ? colors.primary : '#C9BFB1'}
            />
          </Pressable>
        ))}

        {perfil === 'gestor' && (
          <View>
            <Text style={styles.rotulo}>CNPJ da instituição</Text>

            <View style={styles.linhaCnpj}>
              <TextInput
                style={[styles.input, styles.inputCnpj]}
                placeholder="00.000.000/0001-00"
                placeholderTextColor="#9A8F7E"
                value={cnpj}
                onChangeText={digitarCnpj}
                keyboardType="number-pad"
                maxLength={18}
              />

              <Pressable
                style={({ pressed }) => [styles.botaoVerificar, pressed && styles.pressionado]}
                onPress={verificarInstituicao}
                disabled={verificando}
              >
                <Text style={styles.textoVerificar}>
                  {verificando ? '...' : 'Verificar'}
                </Text>
              </Pressable>
            </View>

            {instituicao && instituicao.situacao === 'demonstracao' && (
              <View style={styles.resultado}>
                <View style={styles.resultadoTopo}>
                  <Ionicons name="flask" size={18} color={colors.supportBlue} />

                  <Text style={styles.resultadoNome}>
                    {instituicao.razaoSocial}
                  </Text>
                </View>

                <Text style={styles.resultadoDetalhe}>
                  CNPJ de demonstração. Tudo que for cadastrado com ele aparece
                  marcado como exemplo.
                </Text>
              </View>
            )}

            {instituicao && instituicao.situacao === 'ativa' && (
              <View style={styles.resultado}>
                <View style={styles.resultadoTopo}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.supportGreen}
                  />

                  <Text style={styles.resultadoNome}>
                    {instituicao.razaoSocial}
                  </Text>
                </View>

                <Text style={styles.resultadoDetalhe}>
                  {instituicao.municipio}/{instituicao.uf} • ativa na Receita
                </Text>

                {!instituicao.assistenciaSocial && (
                  <Text style={styles.resultadoAviso}>
                    A atividade registrada é "{instituicao.cnaeDescricao}", que
                    não é de assistência social. Isso acontece com instituições
                    legítimas, mas fica anotado no cadastro.
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.explicacaoCnpj}>
              Conferimos se o CNPJ existe e está ativo na Receita Federal. Isso
              não comprova que você trabalha na instituição — essa checagem
              depende de análise de documentos, que ainda não temos.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.demo, pressed && styles.pressionado]}
              onPress={() => digitarCnpj(CNPJ_DEMONSTRACAO)}
            >
              <Ionicons name="flask-outline" size={14} color={colors.supportBlue} />

              <Text style={styles.demoTexto}>
                Usar o CNPJ de demonstração
              </Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
          onPress={criarConta}
        >
          <Text style={styles.textoBotao}>Criar conta</Text>
        </Pressable>

        <Text style={styles.nota}>
          A conta fica salva apenas neste aparelho. Ainda não existe servidor:
          desinstalar o aplicativo apaga a conta.
        </Text>

      </ScrollView>
      </KeyboardAvoidingView>

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
    padding: 20,
    paddingBottom: 140,
  },

  rotulo: {
    fontSize: 13,
    color: colors.textMain,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 14,
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

  ajudaPergunta: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginBottom: 8,
  },

  opcaoPergunta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    padding: 12,
    marginBottom: 8,
  },

  opcaoPerguntaAtiva: {
    borderColor: colors.primary,
  },

  textoPergunta: {
    flex: 1,
    fontSize: 13,
    color: colors.textMain,
    lineHeight: 18,
    marginLeft: 8,
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

  perfil: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    padding: 12,
    marginBottom: 8,
  },

  perfilEscolhido: {
    borderColor: colors.primary,
    backgroundColor: '#FFF3E6',
  },

  perfilIcone: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  perfilTexto: {
    flex: 1,
    marginHorizontal: 10,
  },

  perfilNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  perfilDescricao: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 1,
  },

  linhaCnpj: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  inputCnpj: {
    flex: 1,
  },

  botaoVerificar: {
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  textoVerificar: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  resultado: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },

  resultadoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  resultadoNome: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMain,
    marginLeft: 8,
  },

  resultadoDetalhe: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 4,
  },

  resultadoAviso: {
    fontSize: 12,
    color: colors.supportPink,
    lineHeight: 17,
    marginTop: 8,
  },

  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },

  demoTexto: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.supportBlue,
    marginLeft: 6,
  },

  explicacaoCnpj: {
    fontSize: 11,
    color: '#9A8F7E',
    lineHeight: 16,
    marginTop: 10,
  },

  botao: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },

  textoBotao: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  nota: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 16,
  },

  pressionado: {
    opacity: 0.6,
  },
});
