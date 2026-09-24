import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
import CameraFoto from '../components/CameraFoto';
import { apagarDadosDaConta } from '../services/limpeza';
import { buscarPerfil } from '../data/perfis';
import { PERGUNTAS } from '../data/perguntas';
import { escolherDoCelular } from '../services/galeria';
import { conferirSenha, novoSal, resumir, resumirResposta } from '../services/senha';
import { abrigosDaConta, carregarAbrigos } from '../services/shelters';
import { deuCerto, deuErrado } from '../services/tato';
import { colors } from '../theme/colors';

const VERSAO = '1.0.0';

export default function ProfileScreen(props) {

  const [conta, setConta] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [temBiometria, setTemBiometria] = useState(false);
  const [permissaoLocalizacao, setPermissaoLocalizacao] = useState(false);

  const [permissaoCamera] = useCameraPermissions();

  // O perfil era só de leitura: quem errasse o nome no cadastro ficava
  // com ele para sempre, e trocar a senha exigia fingir que esqueceu na
  // tela de entrada.
  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [verSenha, setVerSenha] = useState(false);

  // Conta criada antes da pergunta de segurança existir não tinha como
  // recuperar a senha: a tela de entrada avisava que não dava, e ficava
  // nisso. Aqui a pergunta pode ser definida a qualquer momento.
  const [editandoPergunta, setEditandoPergunta] = useState(false);
  const [pergunta, setPergunta] = useState(PERGUNTAS[0]);
  const [resposta, setResposta] = useState('');
  const [senhaDaPergunta, setSenhaDaPergunta] = useState('');

  const [camera, setCamera] = useState(false);
  const [meusAbrigos, setMeusAbrigos] = useState([]);

  useEffect(() => {
    buscarConta();
    verificarBiometria();
    verificarLocalizacao();

    // Ao voltar do cadastro do abrigo, o atalho pode ter mudado.
    const inscricao = props.navigation.addListener('focus', buscarConta);

    return inscricao;
  }, []);

  async function buscarConta() {
    try {
      const contaSalva = await carregarConta();
      const abrigos = await carregarAbrigos();

      setConta(contaSalva);
      setMeusAbrigos(abrigosDaConta(abrigos, contaSalva));
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
      'Some o seu nome, e-mail e senha, e também as suas doações, os seus compromissos e os itens que você prometeu levar. Não existe servidor guardando nada: não há como recuperar.',
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
      // Os dados saem antes do cadastro: apagando a conta primeiro, o
      // e-mail que identifica o que é dela já teria sumido.
      if (conta) {
        await apagarDadosDaConta(conta.email);
      }

      await apagarConta();

      props.navigation.getParent().replace('Login');
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível apagar a conta.'
      );
    }
  }

  // Toda gravação da conta passa por aqui: o salvarConta já junta com a
  // lista de contas do aparelho, então a tela nunca escreve direto.
  async function gravarConta(atualizada) {
    try {
      await salvarConta(atualizada);

      setConta(atualizada);

      return true;
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a alteração.');

      return false;
    }
  }

  function abrirNome() {
    setNovoNome(conta.nome);
    setEditandoNome(true);
  }

  async function salvarNome() {
    const limpo = novoNome.trim();

    if (limpo.length < 2) {
      Alert.alert('Atenção', 'Digite o seu nome.');

      return;
    }

    if (await gravarConta({ ...conta, nome: limpo })) {
      deuCerto();
      setEditandoNome(false);
    }
  }

  function abrirSenha() {
    setSenhaAtual('');
    setSenhaNova('');
    setTrocandoSenha(true);
  }

  // A senha atual é pedida de propósito: sem ela, quem pegasse o aparelho
  // desbloqueado trocaria a senha e tomaria a conta. Não impede muita
  // coisa, mas impede a troca distraída.
  async function salvarSenha() {
    const conferida = await conferirSenha(conta, senhaAtual);

    if (!conferida.confere) {
      deuErrado();

      Alert.alert('Senha incorreta', 'A senha atual não confere.');

      return;
    }

    if (senhaNova.length < 6) {
      Alert.alert('Atenção', 'A senha nova precisa ter pelo menos 6 caracteres.');

      return;
    }

    // O sal continua o mesmo: ele também tempera a resposta da pergunta
    // de segurança, e trocá-lo invalidaria a recuperação.
    const atualizada = { ...conta, senhaResumo: await resumir(senhaNova, conta.sal) };

    delete atualizada.senha;

    if (await gravarConta(atualizada)) {
      deuCerto();
      setTrocandoSenha(false);

      Alert.alert('Senha alterada', 'Da próxima vez, entre com a senha nova.');
    }
  }

  function abrirPergunta() {
    setPergunta(conta.pergunta || PERGUNTAS[0]);
    setResposta('');
    setSenhaDaPergunta('');
    setEditandoPergunta(true);
  }

  // A senha é pedida pelo mesmo motivo da troca de senha: sem ela, quem
  // pegasse o aparelho desbloqueado definiria a própria pergunta e
  // usaria a recuperação para tomar a conta.
  async function salvarPergunta() {
    const conferida = await conferirSenha(conta, senhaDaPergunta);

    if (!conferida.confere) {
      deuErrado();

      Alert.alert('Senha incorreta', 'A sua senha não confere.');

      return;
    }

    if (resposta.trim().length < 2) {
      Alert.alert('Atenção', 'Escreva a resposta.');

      return;
    }

    // Conta antiga pode não ter sal: sem ele não há como temperar o
    // resumo, e é preciso criar um agora. Criando o sal, a senha também
    // precisa ser regravada com ele, senão o login para de funcionar.
    const sal = conta.sal || novoSal();

    const atualizada = {
      ...conta,
      sal: sal,
      senhaResumo: await resumir(senhaDaPergunta, sal),
      pergunta: pergunta,
      respostaResumo: await resumirResposta(resposta, sal),
    };

    delete atualizada.senha;

    if (await gravarConta(atualizada)) {
      deuCerto();
      setEditandoPergunta(false);

      Alert.alert(
        'Pergunta salva',
        'Esquecendo a senha, é por ela que você volta a entrar.'
      );
    }
  }

  async function definirFoto(uri) {
    setCamera(false);

    if (await gravarConta({ ...conta, foto: uri })) {
      deuCerto();
    }
  }

  async function fotoDoCelular() {
    const escolha = await escolherDoCelular();

    if (escolha.situacao === 'escolhida') {
      definirFoto(escolha.uri);

      return;
    }

    if (escolha.situacao === 'sem-permissao') {
      Alert.alert(
        'Sem acesso às fotos',
        'Para escolher uma foto já tirada, permita o acesso às fotos nas configurações do aparelho.'
      );
    }
  }

  function escolherFoto() {
    const opcoes = [
      { text: 'Tirar uma foto', onPress: () => setCamera(true) },
      { text: 'Escolher do celular', onPress: fotoDoCelular },
    ];

    if (conta.foto) {
      opcoes.push({
        text: 'Remover a foto',
        style: 'destructive',
        onPress: () => definirFoto(null),
      });
    }

    opcoes.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert('Foto de perfil', 'De onde vem a sua foto?', opcoes);
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trocar a foto de perfil"
              style={({ pressed }) => [styles.avatarArea, pressed && styles.pressionado]}
              onPress={escolherFoto}
            >
              {conta.foto ? (
                <Image source={{ uri: conta.foto }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.textoAvatar}>{primeiraLetra(conta.nome)}</Text>
                </View>
              )}

              <View style={styles.avatarCamera}>
                <Ionicons name="camera" size={13} color={colors.primary} />
              </View>
            </Pressable>

            <View style={styles.identificacaoTexto}>
              <Text style={styles.nome}>{conta.nome}</Text>
              <Text style={styles.email}>{conta.email}</Text>

              {/* Qual perfil a pessoa escolheu no cadastro. A tela toda
                  muda por causa dele e ele não aparecia em lugar nenhum. */}
              {buscarPerfil(conta.perfil) ? (
                <View style={styles.selo}>
                  <Ionicons
                    name={buscarPerfil(conta.perfil).icone}
                    size={11}
                    color="#FFFFFF"
                  />

                  <Text style={styles.seloTexto}>
                    {buscarPerfil(conta.perfil).nome}
                  </Text>
                </View>
              ) : null}
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
            <Text style={styles.grupo}>Seus dados</Text>

            <View style={styles.cartao}>
              <Pressable
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                onPress={abrirNome}
              >
                <View style={styles.icone}>
                  <Ionicons name="person-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTitulo}>Nome</Text>
                  <Text style={styles.linhaDescricao}>{conta.nome}</Text>
                </View>

                <Ionicons name="create-outline" size={20} color="#9A8F7E" />
              </Pressable>

              <View style={styles.divisoria} />

              <Pressable
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                onPress={escolherFoto}
              >
                <View style={styles.icone}>
                  <Ionicons name="image-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTitulo}>Foto de perfil</Text>

                  <Text style={styles.linhaDescricao}>
                    {conta.foto ? 'Tocar para trocar ou remover' : 'Nenhuma foto escolhida'}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
              </Pressable>

              <View style={styles.divisoria} />

              <Pressable
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                onPress={abrirPergunta}
              >
                <View style={styles.icone}>
                  <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTitulo}>Pergunta de segurança</Text>

                  <Text style={styles.linhaDescricao}>
                    {conta.respostaResumo
                      ? conta.pergunta
                      : 'Não definida — sem ela não dá para recuperar a senha'}
                  </Text>
                </View>

                {conta.respostaResumo ? (
                  <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
                ) : (
                  <Ionicons name="alert-circle" size={20} color={colors.supportPink} />
                )}
              </Pressable>

              <View style={styles.divisoria} />

              <Pressable
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                onPress={abrirSenha}
              >
                <View style={styles.icone}>
                  <Ionicons name="key-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTitulo}>Alterar a senha</Text>

                  <Text style={styles.linhaDescricao}>
                    Pede a senha atual antes de trocar
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
              </Pressable>
            </View>

            {/* Atalhos para o que é da pessoa e mora noutra tela. Sem
                eles, chegar no próprio abrigo exigia procurar no mapa. */}
            <Text style={styles.grupo}>Atalhos</Text>

            <View style={styles.cartao}>
              {meusAbrigos.map((abrigo, indice) => (
                <View key={abrigo.id}>
                  {indice > 0 ? <View style={styles.divisoria} /> : null}

                  <Pressable
                    style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                    onPress={() =>
                      props.navigation.getParent().navigate('RegisterShelter', { abrigo: abrigo })
                    }
                  >
                    <View style={styles.icone}>
                      <Ionicons name="business-outline" size={20} color={colors.primary} />
                    </View>

                    <View style={styles.linhaTexto}>
                      <Text style={styles.linhaTitulo}>{abrigo.nome}</Text>
                      <Text style={styles.linhaDescricao}>Editar o cadastro do abrigo</Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
                  </Pressable>
                </View>
              ))}

              {meusAbrigos.length > 0 ? <View style={styles.divisoria} /> : null}

              <Pressable
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}
                onPress={() => props.navigation.getParent().navigate('History')}
              >
                <View style={styles.icone}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                </View>

                <View style={styles.linhaTexto}>
                  <Text style={styles.linhaTitulo}>Minhas doações</Text>
                  <Text style={styles.linhaDescricao}>O que você já doou e o que falta pagar</Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
              </Pressable>
            </View>

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

      {/* ----------------------------------------------- mudar o nome */}
      <Modal
        visible={editandoNome}
        animationType="fade"
        transparent
        onRequestClose={() => setEditandoNome(false)}
      >
        <KeyboardAvoidingView
          style={styles.fundoModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.painel}>
            <Text style={styles.painelTitulo}>Seu nome</Text>

            <TextInput
              style={styles.campo}
              value={novoNome}
              onChangeText={setNovoNome}
              maxLength={60}
              autoFocus
            />

            <Pressable
              style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
              onPress={salvarNome}
            >
              <Text style={styles.textoBotao}>Salvar</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressionado]}
              onPress={() => setEditandoNome(false)}
            >
              <Text style={styles.textoLink}>Cancelar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------------------------------------------- mudar a senha */}
      <Modal
        visible={trocandoSenha}
        animationType="fade"
        transparent
        onRequestClose={() => setTrocandoSenha(false)}
      >
        <KeyboardAvoidingView
          style={styles.fundoModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.painel}>
            <Text style={styles.painelTitulo}>Alterar a senha</Text>

            <Text style={styles.painelTexto}>
              A senha atual é pedida para ninguém trocar a sua senha num
              aparelho desbloqueado que você deixou na mesa.
            </Text>

            <TextInput
              style={styles.campo}
              placeholder="Senha atual"
              placeholderTextColor="#9A8F7E"
              value={senhaAtual}
              onChangeText={setSenhaAtual}
              secureTextEntry={!verSenha}
              maxLength={40}
            />

            <View style={styles.campoSenha}>
              <TextInput
                style={styles.entradaSenha}
                placeholder="Senha nova, ao menos 6 caracteres"
                placeholderTextColor="#9A8F7E"
                value={senhaNova}
                onChangeText={setSenhaNova}
                secureTextEntry={!verSenha}
                maxLength={40}
              />

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
              onPress={salvarSenha}
            >
              <Text style={styles.textoBotao}>Alterar</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.link, pressed && styles.pressionado]}
              onPress={() => setTrocandoSenha(false)}
            >
              <Text style={styles.textoLink}>Cancelar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ----------------------------------- pergunta de segurança */}
      <Modal
        visible={editandoPergunta}
        animationType="fade"
        transparent
        onRequestClose={() => setEditandoPergunta(false)}
      >
        <KeyboardAvoidingView
          style={styles.fundoModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.painel}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.painelTitulo}>Pergunta de segurança</Text>

              <Text style={styles.painelTexto}>
                Sem servidor não existe "enviar link por e-mail". Esta
                resposta é o que devolve o acesso se você esquecer a senha.
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
                style={styles.campo}
                placeholder="Sua resposta"
                placeholderTextColor="#9A8F7E"
                value={resposta}
                onChangeText={setResposta}
                autoCapitalize="none"
                maxLength={60}
              />

              <TextInput
                style={styles.campo}
                placeholder="Confirme com a sua senha"
                placeholderTextColor="#9A8F7E"
                value={senhaDaPergunta}
                onChangeText={setSenhaDaPergunta}
                secureTextEntry
                maxLength={40}
              />

              <Pressable
                style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
                onPress={salvarPergunta}
              >
                <Text style={styles.textoBotao}>Salvar</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.link, pressed && styles.pressionado]}
                onPress={() => setEditandoPergunta(false)}
              >
                <Text style={styles.textoLink}>Cancelar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CameraFoto
        visivel={camera}
        titulo="Sua foto de perfil"
        aoFechar={() => setCamera(false)}
        aoConfirmar={definirFoto}
      />

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

  avatarArea: {
    width: 60,
    height: 60,
  },

  avatarCamera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
  },

  seloTexto: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 4,
  },

  fundoModal: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  painel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },

  painelTitulo: {
    fontSize: 19,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 6,
  },

  painelTexto: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginBottom: 10,
  },

  opcaoPergunta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    padding: 12,
    marginTop: 8,
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

  campo: {
    height: 52,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textMain,
    marginTop: 8,
  },

  campoSenha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingRight: 8,
    marginTop: 8,
  },

  entradaSenha: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textMain,
  },

  olho: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  botao: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  textoBotao: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  link: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  textoLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9A8F7E',
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
