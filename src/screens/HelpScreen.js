import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  contatosDoAbrigo,
  linkEmail,
  linkInstagram,
  linkTelefone,
  linkWhatsapp,
} from '../services/contato';
import {
  formasDeDinheiro,
  linkValido,
  normalizarLink,
  temApadrinhamento,
  temFundoDaInfancia,
} from '../services/doacao';
import { carregarAbrigos } from '../services/shelters';
import { colors } from '../theme/colors';

export default function HelpScreen(props) {

  const parametros = props.route.params || {};

  const [abrigo, setAbrigo] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarAbrigo();
  }, []);

  async function buscarAbrigo() {
    try {
      const lista = await carregarAbrigos();

      setAbrigo(lista.find((item) => item.id === parametros.abrigoId) || null);
    } catch (error) {
      console.log('Erro ao ler o abrigo:', error);
    } finally {
      setCarregando(false);
    }
  }

  async function abrir(url, aviso) {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('Erro ao abrir o endereço:', error);

      Alert.alert('Erro', aviso);
    }
  }

  // O apadrinhamento é um programa da própria instituição, com processo
  // dela. O campo aceita tanto o endereço da página quanto o telefone de
  // quem explica, então descobrimos aqui o que fazer com o que veio.
  function abrirApadrinhamento() {
    const texto = abrigo.apadrinhamento;

    if (linkValido(texto)) {
      abrir(normalizarLink(texto), 'Não foi possível abrir a página.');

      return;
    }

    const digitos = texto.replace(/[^0-9]/g, '');

    if (digitos.length >= 10) {
      abrir(linkTelefone(texto), 'Não foi possível iniciar a chamada.');

      return;
    }

    Alert.alert('Apadrinhamento', texto);
  }

  // Não sabemos o site do conselho de cada município, e inventar um
  // endereço seria pior do que não ter botão. O que dá para fazer é levar
  // a busca já escrita, com o nome da cidade do abrigo.
  function procurarConselho() {
    const endereco = abrigo.enderecoDados || {};
    const cidade = endereco.cidade || '';

    const busca =
      'CMDCA ' + cidade + ' destinação imposto de renda fundo da infância';

    abrir(
      'https://www.google.com/search?q=' + encodeURIComponent(busca),
      'Não foi possível abrir a busca.'
    );
  }

  function canais() {
    const contatos = contatosDoAbrigo(abrigo);
    const lista = [];

    if (contatos.celular) {
      lista.push({
        id: 'whatsapp',
        icone: 'logo-whatsapp',
        nome: 'WhatsApp',
        url: linkWhatsapp(
          contatos.celular,
          'Olá! Encontrei o ' + abrigo.nome + ' no InfoAbrigo e gostaria de ajudar.'
        ),
        aviso: 'Não foi possível abrir o WhatsApp.',
      });
    }

    const paraLigar = contatos.fixo || contatos.celular;

    if (paraLigar) {
      lista.push({
        id: 'telefone',
        icone: 'call',
        nome: 'Ligar',
        url: linkTelefone(paraLigar),
        aviso: 'Não foi possível iniciar a chamada.',
      });
    }

    if (contatos.email) {
      lista.push({
        id: 'email',
        icone: 'mail',
        nome: 'E-mail',
        url: linkEmail(contatos.email, 'Quero ajudar o ' + abrigo.nome),
        aviso: 'Não foi possível abrir o e-mail.',
      });
    }

    if (contatos.instagram) {
      lista.push({
        id: 'instagram',
        icone: 'logo-instagram',
        nome: 'Instagram',
        url: linkInstagram(contatos.instagram),
        aviso: 'Não foi possível abrir o Instagram.',
      });
    }

    return lista;
  }

  function cartao(icone, cor, titulo, texto, aoTocar, rotuloAcao) {
    return (
      <Pressable
        style={({ pressed }) => [styles.cartao, pressed && styles.pressionado]}
        onPress={aoTocar}
      >
        <View style={[styles.cartaoIcone, { backgroundColor: cor }]}>
          <Ionicons name={icone} size={20} color="#FFFFFF" />
        </View>

        <View style={styles.cartaoTexto}>
          <Text style={styles.cartaoTitulo}>{titulo}</Text>
          <Text style={styles.cartaoDescricao}>{texto}</Text>

          {rotuloAcao ? (
            <Text style={styles.cartaoAcao}>{rotuloAcao}</Text>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
      </Pressable>
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
        <View style={styles.headerTopo}>
          <Pressable
            style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}
            onPress={() => props.navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitulo}>Como ajudar</Text>

          <View style={styles.voltar} />
        </View>

        {abrigo ? (
          <Text style={styles.headerAbrigo} numberOfLines={2}>
            {abrigo.nome}
          </Text>
        ) : null}
      </LinearGradient>

      <ScrollView
        style={styles.corpo}
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        {carregando ? (
          <Text style={styles.aviso}>Carregando...</Text>
        ) : abrigo == null ? (
          <Text style={styles.aviso}>
            Este abrigo não está mais cadastrado neste aparelho.
          </Text>
        ) : (
          <View>
            <Text style={styles.secao}>Doar</Text>

            {formasDeDinheiro(abrigo).length > 0
              ? cartao(
                  'cash',
                  colors.supportGreen,
                  'Dinheiro',
                  formasDeDinheiro(abrigo).map((forma) => forma.nome).join(', '),
                  () =>
                    props.navigation.navigate('Donate', {
                      abrigo: abrigo.nome,
                      abrigoId: abrigo.id,
                    }),
                  null
                )
              : null}

            {cartao(
              'cube',
              colors.primary,
              'Itens',
              'Alimentos, higiene, roupas, material escolar — o abrigo publica o que está faltando.',
              () =>
                props.navigation.navigate('Tabs', {
                  screen: 'Doações',
                  params: { abrigoId: abrigo.id, momento: Date.now() },
                }),
              'Ver a lista deste abrigo'
            )}

            {temApadrinhamento(abrigo)
              ? cartao(
                  'people',
                  colors.supportPink,
                  'Apadrinhamento',
                  'Contribuição mensal com vínculo a uma criança. O processo é da instituição.',
                  abrirApadrinhamento,
                  abrigo.apadrinhamento
                )
              : null}

            {/* A destinação ao fundo da infância é o caminho que não custa
                nada a quem doa: é imposto que já seria pago de qualquer
                jeito, redirecionado. Só aparece para abrigo com registro
                no conselho, porque sem ele não vale. */}
            {temFundoDaInfancia(abrigo) && (
              <View>
                <Text style={styles.secao}>Doar sem gastar nada</Text>

                <View style={styles.imposto}>
                  <View style={styles.impostoTopo}>
                    <Ionicons name="receipt" size={20} color={colors.supportBlue} />

                    <Text style={styles.impostoTitulo}>
                      Destine parte do seu imposto de renda
                    </Text>
                  </View>

                  <Text style={styles.impostoTexto}>
                    Quem declara imposto de renda pode destinar uma parte do
                    imposto devido ao Fundo da Infância e Adolescência do
                    município, em vez de deixar tudo ir para o caixa geral.
                    Pessoa física deduz até 3% do imposto devido, dentro do
                    limite de 6% somado aos outros incentivos; empresa no
                    lucro real, até 1%.
                  </Text>

                  <Text style={styles.impostoTexto}>
                    Não é dinheiro a mais do seu bolso: é imposto que você
                    já pagaria, escolhido para ir à infância da sua cidade.
                    Quem administra o fundo é o conselho municipal, que
                    repassa às instituições com projeto aprovado.
                  </Text>

                  <View style={styles.registro}>
                    <Text style={styles.registroRotulo}>
                      Registro deste abrigo no conselho
                    </Text>

                    <Text style={styles.registroValor}>{abrigo.cmdca}</Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.botaoImposto, pressed && styles.pressionado]}
                    onPress={procurarConselho}
                  >
                    <Ionicons name="search" size={17} color="#FFFFFF" />

                    <Text style={styles.textoBotaoImposto}>
                      Procurar o conselho da cidade
                    </Text>
                  </Pressable>

                  <Text style={styles.impostoAviso}>
                    A destinação é feita ao fundo do município, não ao abrigo
                    direto, e cada conselho tem o seu procedimento. Confirme
                    os limites com quem faz a sua declaração.
                  </Text>
                </View>
              </View>
            )}

            {canais().length > 0 && (
              <View>
                <Text style={styles.secao}>Falar com o abrigo</Text>

                <View style={styles.canais}>
                  {canais().map((canal) => (
                    <Pressable
                      key={canal.id}
                      style={({ pressed }) => [styles.canal, pressed && styles.pressionado]}
                      onPress={() => abrir(canal.url, canal.aviso)}
                    >
                      <Ionicons name={canal.icone} size={18} color={colors.primary} />
                      <Text style={styles.canalTexto}>{canal.nome}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.rodape}>
              O InfoAbrigo não recebe nem processa dinheiro. Ele mostra os
              caminhos que o abrigo cadastrou, e o pagamento acontece no seu
              banco ou na página da instituição.
            </Text>
          </View>
        )}
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

  headerAbrigo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginTop: 4,
  },

  corpo: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  conteudo: {
    padding: 16,
    paddingBottom: 60,
  },

  aviso: {
    fontSize: 14,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 40,
  },

  secao: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 12,
    marginBottom: 10,
  },

  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  cartaoIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartaoTexto: {
    flex: 1,
    marginHorizontal: 12,
  },

  cartaoTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  cartaoDescricao: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginTop: 2,
  },

  cartaoAcao: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },

  imposto: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  impostoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  impostoTitulo: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textMain,
    marginLeft: 8,
  },

  impostoTexto: {
    fontSize: 13,
    color: colors.textMain,
    lineHeight: 19,
    marginBottom: 10,
  },

  registro: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  registroRotulo: {
    fontSize: 11,
    color: '#9A8F7E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  registroValor: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 3,
  },

  botaoImposto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.supportBlue,
  },

  textoBotaoImposto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  impostoAviso: {
    fontSize: 11,
    color: '#9A8F7E',
    lineHeight: 16,
    marginTop: 12,
  },

  canais: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  canal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
  },

  canalTexto: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textMain,
    marginLeft: 6,
  },

  rodape: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 18,
  },

  pressionado: {
    opacity: 0.6,
  },
});
