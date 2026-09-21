import { useState } from 'react';
import {
  Alert,
  Keyboard,
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
import { cnpjValido, consultarCnpj, formatarCnpj } from '../services/cnpj';
import { salvarConta } from '../services/auth';
import { colors } from '../theme/colors';

export default function SignUpScreen(props) {

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [perfil, setPerfil] = useState(PERFIS[2].id);
  const [cnpj, setCnpj] = useState('');
  const [instituicao, setInstituicao] = useState(null);
  const [verificando, setVerificando] = useState(false);

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
    const emailLimpo = email.trim();

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

    const conta = {
      nome: nomeLimpo,
      email: emailLimpo,
      senha: senha,
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
            style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}
            onPress={() => props.navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitulo}>Criar conta</Text>

          <View style={styles.voltar} />
        </View>
      </LinearGradient>

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
        <TextInput
          style={styles.input}
          placeholder="Pelo menos 6 caracteres"
          placeholderTextColor="#9A8F7E"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          maxLength={40}
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
  },

  rotulo: {
    fontSize: 13,
    color: colors.textMain,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 14,
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
