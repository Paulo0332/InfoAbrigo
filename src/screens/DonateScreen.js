import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import BiometricButton from '../components/BiometricButton';
import { contatosDoAbrigo, linkEmail, linkWhatsapp } from '../services/contato';
import PixQrCode from '../components/PixQrCode';
import { carregarConta } from '../services/auth';
import {
  DINHEIRO,
  PENDENTE,
  confirmarPagamento,
  formatarReais,
  registrarDoacao,
} from '../services/donations';
import {
  PIX,
  SITE,
  TRANSFERENCIA,
  formasDeDinheiro,
  formasQueFaltam,
  juntarComE,
  textoDaTransferencia,
} from '../services/doacao';
import { montarCodigoPix } from '../services/pix';
import { deuCerto, deuErrado, toqueLeve } from '../services/tato';
import { conferirSenha } from '../services/senha';
import { carregarAbrigos } from '../services/shelters';
import { colors } from '../theme/colors';

// Atalhos de valor, em centavos. Continuam existindo porque a maioria doa
// um valor redondo, mas agora são atalhos para o campo, e não a única
// forma de escolher.
const ATALHOS = [2000, 5000, 10000];

export default function DonateScreen(props) {

  // O abrigo vem por parâmetro quando a doação começa pelo mapa ou pela
  // lista. Chegando pela ação rápida da Home não há abrigo escolhido, e a
  // tela diz isso em vez de inventar um nome.
  const parametros = props.route.params || {};
  const abrigo = parametros.abrigo || null;

  // O valor mora em centavos, que é número inteiro: guardar reais em
  // ponto flutuante faz 0,1 + 0,2 dar 0,30000000000000004, e isso
  // apareceria no comprovante.
  const [centavos, setCentavos] = useState(5000);
  const [confirmada, setConfirmada] = useState(false);
  const [temBiometria, setTemBiometria] = useState(true);
  const [conta, setConta] = useState(null);
  const [senha, setSenha] = useState('');
  const [abrigoCompleto, setAbrigoCompleto] = useState(null);
  const [codigoPix, setCodigoPix] = useState('');
  const [copiado, setCopiado] = useState(false);

  // A forma escolhida para doar. Começa na primeira que o abrigo
  // oferece, porque ficar sem nenhuma marcada faria o botão de confirmar
  // não saber o que fazer.
  const [forma, setForma] = useState(PIX);

  // O registro fica pendente ate a pessoa dizer que pagou. Guardamos o
  // identificador dele para poder marcar como pago sem sair da tela.
  const [doacaoId, setDoacaoId] = useState(null);
  const [paga, setPaga] = useState(false);

  useEffect(() => {
    buscarConta();
    buscarAbrigo();
  }, []);

  // A conta é lida aqui porque, em aparelho sem biometria, a confirmação
  // é feita com a mesma senha que a pessoa cadastrou.
  async function buscarConta() {
    try {
      const contaSalva = await carregarConta();

      setConta(contaSalva);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível ler a conta salva neste aparelho.');
    }
  }

  // O cadastro inteiro do abrigo é lido para pegar a chave Pix e a cidade,
  // que entram no código de pagamento. Vem por id quando existe; pelo nome
  // quando a doação começou por uma tela que só sabia o nome.
  async function buscarAbrigo() {
    if (!abrigo) {
      return;
    }

    try {
      const lista = await carregarAbrigos();

      const achado = lista.find((item) => {
        return parametros.abrigoId
          ? item.id === parametros.abrigoId
          : item.nome === abrigo;
      });

      setAbrigoCompleto(achado || null);

      const formas = formasDeDinheiro(achado);

      if (formas.length > 0) {
        setForma(formas[0].id);
      }
    } catch (error) {
      console.log('Erro ao ler o abrigo da doação:', error);
    }
  }

  // O campo de valor recebe só dígitos e vai preenchendo da direita para a
  // esquerda, como a máquina do cartão. Digitar 2550 mostra R$ 25,50.
  function digitarValor(texto) {
    const digitos = texto.replace(/[^0-9]/g, '').slice(0, 9);

    setCentavos(Number(digitos || 0));
  }

  function emReais() {
    return centavos / 100;
  }

  // Monta o código Pix do abrigo com o valor já preenchido. Sem chave
  // cadastrada devolve vazio, e a tela de sucesso explica o que falta.
  function gerarCodigoPix() {
    if (abrigoCompleto == null || !abrigoCompleto.chavePix) {
      return '';
    }

    const endereco = abrigoCompleto.enderecoDados || {};

    return montarCodigoPix({
      chave: abrigoCompleto.chavePix,
      nome: abrigoCompleto.nome,
      cidade: endereco.cidade || '',
      valor: emReais(),
      identificador: 'INFOABRIGO',
    });
  }

  // O BiometricButton avisa por aqui que a identidade foi confirmada.
  // Só depois disso a doação é gravada no histórico e a tela troca para
  // o código de pagamento.
  async function confirmarDoacao() {
    // Sem abrigo escolhido não há para quem doar, e gravar abrigo null
    // faria a tela de sucesso dizer "para o null".
    if (!abrigo) {
      Alert.alert('Atenção', 'Escolha um abrigo no mapa antes de confirmar a doação.');

      return;
    }

    if (centavos <= 0) {
      Alert.alert('Atenção', 'Digite quanto você quer doar.');

      return;
    }

    const doacao = {
      id: Date.now().toString(),
      tipo: DINHEIRO,
      valor: emReais(),
      abrigo: abrigo,
      abrigoId: abrigoCompleto ? abrigoCompleto.id : null,
      forma: forma,
      // O histórico é de quem doou, e o aparelho guarda mais de uma conta.
      conta: conta ? conta.email : null,
      // Confirmar a identidade não é pagar. A biometria diz que foi você
      // quem pediu o código; quem cobra é o banco, no passo seguinte.
      situacao: PENDENTE,
      data: new Date().toISOString(),
    };

    try {
      await registrarDoacao(doacao);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar a doação.');

      return;
    }

    // O código só é montado quando a forma escolhida é Pix. Nas outras a
    // tela seguinte mostra os dados da conta ou abre a página do abrigo.
    deuCerto();

    setDoacaoId(doacao.id);
    setCodigoPix(forma === PIX ? gerarCodigoPix() : '');
    setConfirmada(true);
  }

  // A senha deixou de ser guardada como texto: agora fica só o resumo
  // dela, e quem compara é o mesmo serviço que a tela de entrada usa.
  async function confirmarComSenha() {
    if (!conta) {
      Alert.alert('Erro', 'Não foi possível ler a sua conta.');

      return;
    }

    if (!senha) {
      Alert.alert('Atenção', 'Digite a sua senha para confirmar.');

      return;
    }

    const conferida = await conferirSenha(conta, senha);

    if (!conferida.confere) {
      deuErrado();

      Alert.alert('Não confirmado', 'Senha incorreta.');

      return;
    }

    Keyboard.dismiss();

    confirmarDoacao();
  }

  async function copiar(texto) {
    try {
      await Clipboard.setStringAsync(texto);

      toqueLeve();
      setCopiado(true);
    } catch (error) {
      console.log('Erro ao copiar:', error);

      Alert.alert('Erro', 'Não foi possível copiar.');
    }
  }

  // Cartão, boleto e doação mensal dependem de uma instituição de
  // pagamento, e o aplicativo não emite nenhum dos três. O que ele faz é
  // levar até a página que o abrigo cadastrou para isso.
  async function abrirPagina() {
    try {
      await Linking.openURL(abrigoCompleto.linkDoacao);
    } catch (error) {
      console.log('Erro ao abrir a página de doação:', error);

      Alert.alert('Erro', 'Não foi possível abrir a página do abrigo.');
    }
  }

  async function enviarCodigo() {
    try {
      await Share.share({
        message:
          'Doação para o ' + abrigo + ' — R$ ' + formatarReais(emReais()) +
          '\n\nCódigo Pix copia e cola:\n' + codigoPix,
      });
    } catch (error) {
      console.log('Erro ao enviar o código:', error);
    }
  }

  // O aplicativo não tem como saber se o pagamento aconteceu: não há
  // servidor nem aviso do banco chegando aqui. Quem sabe é a pessoa, e é
  // ela quem marca — só então a doação entra na soma do histórico.
  async function marcarComoPaga() {
    try {
      await confirmarPagamento(doacaoId);

      deuCerto();
      setPaga(true);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar o pagamento.');
    }
  }

  // Marcar como paga é anotação pessoal: o aplicativo não confere nada, e
  // o abrigo não fica sabendo por causa dela. Quem faz o abrigo saber é o
  // comprovante do banco, e é assim que acontece fora daqui — a pessoa
  // manda o comprovante no WhatsApp da instituição. A tela oferece esse
  // caminho no lugar de fingir que a marcação vale como aviso.
  function podeAvisar() {
    if (abrigoCompleto == null) {
      return false;
    }

    const contatos = contatosDoAbrigo(abrigoCompleto);

    return Boolean(contatos.celular || contatos.email);
  }

  async function avisarAbrigo() {
    const contatos = contatosDoAbrigo(abrigoCompleto);

    const mensagem =
      'Olá! Fiz uma doação de R$ ' + formatarReais(emReais()) + ' para o ' +
      abrigoCompleto.nome + '. Envio o comprovante do banco em seguida.';

    const url = contatos.celular
      ? linkWhatsapp(contatos.celular, mensagem)
      : linkEmail(contatos.email, 'Doação para o ' + abrigoCompleto.nome);

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('Erro ao avisar o abrigo:', error);

      Alert.alert('Erro', 'Não foi possível abrir o contato do abrigo.');
    }
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
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}
            onPress={voltar}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitulo}>
            {confirmada ? 'Pagamento' : 'Fazer uma doação'}
          </Text>

          <View style={styles.voltar} />
        </View>
      </LinearGradient>

      {confirmada ? (
        <ScrollView
          style={styles.corpo}
          contentContainerStyle={styles.sucessoConteudo}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.selo, !paga && styles.seloPendente]}>
            <Ionicons
              name={paga ? 'checkmark' : 'time-outline'}
              size={40}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.tituloSucesso}>
            {paga ? 'Doação concluída' : 'Falta pagar'}
          </Text>

          <Text style={styles.textoSucesso}>
            R$ {formatarReais(emReais())} para o {abrigo}.
            {paga
              ? ' Obrigado por ajudar!'
              : ' A biometria confirmou que foi você quem pediu o código — quem cobra é o seu banco, no passo abaixo.'}
          </Text>

          {codigoPix ? (
            <View style={styles.pagamento}>
              <Text style={styles.secaoPagamento}>
                Agora é só pagar no seu banco
              </Text>

              <Text style={styles.explicacaoPagamento}>
                Abra o aplicativo do seu banco, escolha Pix e leia o código
                abaixo — ou copie e cole. O valor já vai preenchido.
              </Text>

              <PixQrCode codigo={codigoPix} />

              <Text style={styles.rotuloCodigo}>Código copia e cola</Text>

              <Text style={styles.codigo} selectable numberOfLines={3}>
                {codigoPix}
              </Text>

              <Pressable
                style={({ pressed }) => [styles.botaoCopiar, pressed && styles.pressionado]}
                onPress={() => copiar(codigoPix)}
              >
                <Ionicons
                  name={copiado ? 'checkmark' : 'copy-outline'}
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.textoBotaoCopiar}>
                  {copiado ? 'Código copiado' : 'Copiar código Pix'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.botaoEnviar, pressed && styles.pressionado]}
                onPress={enviarCodigo}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.primary} />
                <Text style={styles.textoBotaoEnviar}>Enviar para alguém</Text>
              </Pressable>

              {/* O aplicativo monta o código, quem paga é o banco. E a
                  chave é a que o abrigo cadastrou: sem servidor não há
                  como conferir que ela pertence mesmo à instituição, e
                  esconder isso seria pior do que dizer. */}
              <Text style={styles.avisoPagamento}>
                O código é montado neste aparelho e o pagamento acontece no
                aplicativo do seu banco. O InfoAbrigo não recebe nem
                processa dinheiro. A chave é a que o abrigo cadastrou —
                confira o nome que aparecer no seu banco antes de pagar.
              </Text>
            </View>
          ) : forma === TRANSFERENCIA ? (
            <View style={styles.pagamento}>
              <Text style={styles.secaoPagamento}>
                Dados para a transferência
              </Text>

              <Text style={styles.explicacaoPagamento}>
                Copie e cole no aplicativo do seu banco. Confira o nome do
                favorecido antes de confirmar.
              </Text>

              <Text style={styles.codigo} selectable>
                {textoDaTransferencia(abrigoCompleto)}
              </Text>

              <Pressable
                style={({ pressed }) => [styles.botaoCopiar, pressed && styles.pressionado]}
                onPress={() => copiar(textoDaTransferencia(abrigoCompleto))}
              >
                <Ionicons
                  name={copiado ? 'checkmark' : 'copy-outline'}
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.textoBotaoCopiar}>
                  {copiado ? 'Dados copiados' : 'Copiar os dados'}
                </Text>
              </Pressable>

              <Text style={styles.avisoPagamento}>
                A transferência acontece no aplicativo do seu banco. O
                InfoAbrigo não recebe nem processa dinheiro, e os dados são
                os que o abrigo cadastrou.
              </Text>
            </View>
          ) : forma === SITE ? (
            <View style={styles.pagamento}>
              <Text style={styles.secaoPagamento}>Continue na página do abrigo</Text>

              <Text style={styles.explicacaoPagamento}>
                Cartão, boleto e doação mensal precisam de uma instituição de
                pagamento por trás, e o aplicativo não emite nenhum dos três.
                Quem cuida disso é a página do próprio abrigo.
              </Text>

              <Pressable
                style={({ pressed }) => [styles.botaoCopiar, pressed && styles.pressionado]}
                onPress={abrirPagina}
              >
                <Ionicons name="open-outline" size={19} color="#FFFFFF" />
                <Text style={styles.textoBotaoCopiar}>Abrir a página de doação</Text>
              </Pressable>

              <Text style={styles.avisoPagamento}>
                O endereço é o que o abrigo cadastrou. Confira de quem é a
                página antes de informar dados do seu cartão.
              </Text>
            </View>
          ) : (
            <View style={styles.semChave}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />

              <Text style={styles.semChaveTexto}>
                Este abrigo ainda não cadastrou nenhuma forma de receber
                dinheiro. A doação ficou registrada no seu histórico; combine
                a entrega pelo contato do abrigo, na aba do mapa.
              </Text>
            </View>
          )}

          {/* O aplicativo não tem como saber se o dinheiro saiu: não há
              servidor nem aviso do banco chegando aqui. Quem sabe é a
              pessoa, e é ela quem marca — só então a doação entra na soma
              do histórico. Dar como feita na hora enchia o histórico de
              dinheiro que talvez nunca tivesse saído. */}
          {!paga && doacaoId ? (
            <Pressable
              style={({ pressed }) => [styles.botaoPaguei, pressed && styles.pressionado]}
              onPress={marcarComoPaga}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.textoBotaoPaguei}>Já fiz o pagamento</Text>
            </Pressable>
          ) : null}

          {paga && podeAvisar() ? (
            <Pressable
              style={({ pressed }) => [styles.botaoEnviar, styles.botaoAvisar, pressed && styles.pressionado]}
              onPress={avisarAbrigo}
            >
              <Ionicons name="paper-plane-outline" size={18} color={colors.primary} />
              <Text style={styles.textoBotaoEnviar}>Enviar o comprovante ao abrigo</Text>
            </Pressable>
          ) : null}

          {paga ? (
            <Text style={styles.avisoPendente}>
              Esta marcação é a sua anotação: o aplicativo não confere
              pagamento, e o abrigo não fica sabendo por ela. Quem avisa o
              abrigo é o comprovante do seu banco.
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.botaoVoltar, pressed && styles.pressionado]}
            onPress={voltar}
          >
            <Text style={styles.textoBotaoVoltar}>
              {paga ? 'Concluir' : 'Pagar depois'}
            </Text>
          </Pressable>

          {!paga ? (
            <Text style={styles.avisoPendente}>
              Se sair agora, a doação fica aguardando no seu histórico, e
              você marca como paga por lá quando quiser.
            </Text>
          ) : null}
        </ScrollView>
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {abrigo ? (
            <View style={styles.cartao}>
              <Text style={styles.rotulo}>Abrigo</Text>
              <Text style={styles.valorRotulo}>{abrigo}</Text>

              {abrigoCompleto && abrigoCompleto.chavePix ? (
                <View style={styles.seloPix}>
                  <Ionicons name="flash" size={13} color={colors.supportGreen} />
                  <Text style={styles.seloPixTexto}>Aceita Pix</Text>
                </View>
              ) : null}
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

          {/* As formas que aquele abrigo realmente oferece. Nada de botão
              para caminho que não existe: quem não cadastrou Pix não
              mostra Pix. A seção aparece mesmo com uma forma só, porque
              escondê-la fazia parecer que o aplicativo só sabe fazer Pix. */}
          {formasDeDinheiro(abrigoCompleto).length > 0 && (
            <View>
              <Text style={styles.secao}>Como você quer doar</Text>

              {formasDeDinheiro(abrigoCompleto).map((opcao) => (
                <Pressable
                  key={opcao.id}
                  style={({ pressed }) => [
                    styles.forma,
                    forma === opcao.id && styles.formaAtiva,
                    pressed && styles.pressionado,
                  ]}
                  onPress={() => setForma(opcao.id)}
                >
                  <View
                    style={[
                      styles.formaIcone,
                      forma === opcao.id && styles.formaIconeAtivo,
                    ]}
                  >
                    <Ionicons
                      name={opcao.icone}
                      size={19}
                      color={forma === opcao.id ? '#FFFFFF' : colors.primary}
                    />
                  </View>

                  <View style={styles.formaTexto}>
                    <Text style={styles.formaNome}>{opcao.nome}</Text>
                    <Text style={styles.formaDescricao}>{opcao.descricao}</Text>
                  </View>

                  <Ionicons
                    name={forma === opcao.id ? 'radio-button-on' : 'radio-button-off'}
                    size={19}
                    color={forma === opcao.id ? colors.primary : '#C9BFB1'}
                  />
                </Pressable>
              ))}

              {formasQueFaltam(abrigoCompleto).length > 0 ? (
                <Text style={styles.faltam}>
                  Este abrigo ainda não cadastrou{' '}
                  {juntarComE(formasQueFaltam(abrigoCompleto))}. Quem
                  administra o abrigo acrescenta no cadastro dele.
                </Text>
              ) : null}
            </View>
          )}

          <Text style={styles.secao}>Quanto você quer doar</Text>

          <View style={styles.campoValor}>
            <Text style={styles.cifrao}>R$</Text>

            <TextInput
              style={styles.entradaValor}
              value={formatarReais(emReais())}
              onChangeText={digitarValor}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>

          <View style={styles.valores}>
            {ATALHOS.map((opcao) => (
              <Pressable
                key={opcao}
                style={[styles.opcao, centavos === opcao && styles.opcaoAtiva]}
                onPress={() => setCentavos(opcao)}
              >
                <Text
                  style={[
                    styles.textoOpcao,
                    centavos === opcao && styles.textoOpcaoAtiva,
                  ]}
                >
                  R$ {opcao / 100}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* A mensagem vai para a janela do sistema, então a pessoa lê o
              valor exato na hora de encostar o dedo. É o mesmo componente
              da tela de login, só com outro rótulo e outra mensagem. */}
          <View style={styles.espaco}>
            <BiometricButton
              rotulo="Confirmar com biometria"
              mensagem={'Confirme a doação de R$ ' + formatarReais(emReais())}
              onSuccess={confirmarDoacao}
              onVerificado={setTemBiometria}
            />
          </View>

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
            A confirmação serve para o código de pagamento não ser gerado sem
            você querer. Quem cobra é o seu banco, no passo seguinte.
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

  seloPix: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  seloPixTexto: {
    fontSize: 12,
    color: colors.supportGreen,
    fontWeight: 'bold',
    marginLeft: 4,
  },

  secao: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 20,
    marginBottom: 10,
  },

  forma: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    padding: 12,
    marginBottom: 8,
  },

  formaAtiva: {
    borderColor: colors.primary,
  },

  formaIcone: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  formaIconeAtivo: {
    backgroundColor: colors.primary,
  },

  formaTexto: {
    flex: 1,
    marginHorizontal: 12,
  },

  formaNome: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  formaDescricao: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginTop: 1,
  },

  faltam: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 4,
  },

  campoValor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  cifrao: {
    fontSize: 20,
    color: '#9A8F7E',
    marginRight: 8,
  },

  entradaValor: {
    flex: 1,
    height: 64,
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.textMain,
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

  espaco: {
    marginTop: 24,
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

  sucessoConteudo: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 60,
  },

  botaoPaguei: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.supportGreen,
    marginTop: 24,
  },

  textoBotaoPaguei: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  avisoPendente: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 12,
  },

  seloPendente: {
    backgroundColor: colors.primary,
  },

  selo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.supportGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  tituloSucesso: {
    fontSize: 21,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 14,
  },

  textoSucesso: {
    fontSize: 15,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 6,
  },

  pagamento: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 26,
  },

  secaoPagamento: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  explicacaoPagamento: {
    fontSize: 13,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 16,
  },

  rotuloCodigo: {
    fontSize: 12,
    color: '#9A8F7E',
    alignSelf: 'flex-start',
    marginTop: 20,
    marginBottom: 6,
  },

  codigo: {
    alignSelf: 'stretch',
    fontSize: 12,
    color: colors.textMain,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    padding: 12,
    lineHeight: 17,
  },

  botaoCopiar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 12,
  },

  textoBotaoCopiar: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  botaoAvisar: {
    marginTop: 24,
  },

  botaoEnviar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: 10,
  },

  textoBotaoEnviar: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  avisoPagamento: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 16,
  },

  semChave: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 24,
  },

  semChaveTexto: {
    flex: 1,
    fontSize: 13,
    color: colors.textMain,
    lineHeight: 19,
    marginLeft: 10,
  },

  botaoVoltar: {
    alignSelf: 'stretch',
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
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
