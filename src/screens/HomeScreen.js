import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { acoesDoPerfil, ehGestor } from '../data/perfis';
import { carregarConta } from '../services/auth';
import { calcularDistancia, carregarAbrigos } from '../services/shelters';
import { loadNeeds } from '../services/storage';
import { carregarAtividades } from '../services/activities';
import { carregarVistos, marcarVistos } from '../services/avisos';
import {
  ITEM,
  carregarDoacoes,
  doacoesDaConta,
  estaPendente,
  formatarReais,
  tipoDaDoacao,
  totalEmDinheiro,
} from '../services/donations';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';

export default function HomeScreen(props) {

  const [conta, setConta] = useState(null);
  const [necessidades, setNecessidades] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [doacoes, setDoacoes] = useState([]);
  const [abrigos, setAbrigos] = useState([]);
  const [localizacao, setLocalizacao] = useState(null);
  const [avisosVisiveis, setAvisosVisiveis] = useState(false);

  // Os avisos não são mensagens que chegaram: são lidos do que está
  // gravado, a cada vez que a tela abre. Por isso a memória de quais já
  // foram lidos precisa ficar do lado de fora deles.
  const [vistos, setVistos] = useState([]);

  // A lista congelada no instante em que o painel abriu. Sem congelar,
  // marcar como lido esvaziaria o painel na frente da pessoa.
  const [avisosDoPainel, setAvisosDoPainel] = useState([]);
  const [atualizando, setAtualizando] = useState(false);

  // Além de buscar quando a tela monta, buscamos de novo a cada vez que a
  // aba volta a ficar em foco. Sem isso, cadastrar uma necessidade na aba
  // Doações não apareceria aqui até o app ser reaberto.
  useEffect(() => {
    buscarDados();
    buscarLocalizacao();

    const inscricao = props.navigation.addListener('focus', buscarDados);

    return inscricao;
  }, []);

  async function buscarDados() {
    try {
      const contaSalva = await carregarConta();
      const listaNecessidades = await loadNeeds();
      const listaAtividades = await carregarAtividades();
      const listaDoacoes = await carregarDoacoes();
      const listaAbrigos = await carregarAbrigos();
      const listaVistos = await carregarVistos();

      setVistos(listaVistos);
      setConta(contaSalva);
      setNecessidades(listaNecessidades || []);
      setAtividades(listaAtividades);
      // O contador é do que esta conta doou, não do que passou pelo
      // aparelho: agora mais de uma conta mora aqui.
      setDoacoes(doacoesDaConta(listaDoacoes, contaSalva));
      setAbrigos(listaAbrigos);
    } catch (error) {
      console.log('Erro ao carregar os dados da home:', error);
    }
  }

  // Puxar a lista para baixo relê tudo. É o reflexo de qualquer pessoa
  // numa tela de resumo, e a seção 4.3 lista isso como diretriz.
  async function atualizar() {
    setAtualizando(true);

    await buscarDados();

    setAtualizando(false);
  }

  // Consultamos a permissão em vez de pedir. Quem pede é a aba do mapa,
  // onde a localização é o assunto da tela; aqui ela é um extra, e abrir
  // a janela de permissão logo na abertura do aplicativo seria invasivo.
  async function buscarLocalizacao() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        return;
      }

      const posicao = await Location.getCurrentPositionAsync({});

      setLocalizacao(posicao.coords);
    } catch (error) {
      console.log('Erro ao obter a localização na home:', error);
    }
  }

  function distanciaAte(abrigo) {
    return calcularDistancia(
      localizacao.latitude,
      localizacao.longitude,
      abrigo.latitude,
      abrigo.longitude
    );
  }

  // Estar perto é o argumento mais forte do aplicativo: quem vai levar
  // uma doação escolhe pelo que dá para ir a pé. Sem permissão de
  // localização não há como saber, e aí o cartão simplesmente não aparece.
  function abrigoMaisProximo() {
    if (localizacao == null || abrigos.length === 0) {
      return null;
    }

    return abrigos
      .slice()
      .sort((a, b) => distanciaAte(a) - distanciaAte(b))[0];
  }

  function textoDaDistancia(abrigo) {
    const km = distanciaAte(abrigo);

    if (km < 1) {
      return Math.round(km * 1000) + ' m de você';
    }

    return km.toFixed(1).replace('.', ',') + ' km de você';
  }

  function saudacao() {
    const hora = new Date().getHours();

    if (hora < 12) {
      return 'Bom dia,';
    }

    if (hora < 18) {
      return 'Boa tarde,';
    }

    return 'Boa noite,';
  }

  function primeiroNome(nome) {
    return nome.trim().split(' ')[0];
  }

  // Só o dinheiro entra na soma: item doado não tem valor em reais, e
  // somar os dois daria um número que não quer dizer nada.
  function totalDoado() {
    return totalEmDinheiro(doacoes);
  }

  // Os avisos não são inventados: cada um é uma leitura do que está
  // gravado no aparelho. Sem dado, não há aviso.
  function montarAvisos() {
    const avisos = [];

    // As urgentes primeiro: uma necessidade marcada como urgente entrando
    // no fim da fila é o mesmo que não ter sido marcada.
    const emOrdem = abertas()
      .slice()
      .sort((a, b) => (b.urgente === true) - (a.urgente === true));

    for (const necessidade of emOrdem) {
      avisos.push({
        id: 'n' + necessidade.id,
        icone: 'alert-circle',
        cor: necessidade.urgente ? colors.supportPink : colors.primary,
        titulo:
          (necessidade.urgente ? 'Urgente: ' : 'O abrigo precisa de ') +
          necessidade.title +
          (necessidade.quantidade ? ' (' + necessidade.quantidade + ')' : ''),
        texto: necessidade.abrigoNome
          ? 'Para o ' + necessidade.abrigoNome
          : 'Cadastrado na aba Doações e ainda não atendido',
        destino: 'Doações',
      });
    }

    if (atividades.length > 0) {
      avisos.push({
        id: 'a' + atividades[0].id,
        icone: 'camera',
        cor: colors.supportBlue,
        titulo: 'Última atividade: ' + atividades[0].title,
        texto: atividades[0].date,
        destino: 'Agenda',
      });
    }

    // A última doação vira aviso. Enquanto ela estiver aguardando
    // pagamento o aviso diz isso, e leva ao histórico, que é onde dá para
    // marcar como paga.
    if (doacoes.length > 0) {
      const ultima = doacoes[0];
      const aguardando = estaPendente(ultima);
      const ehItem = tipoDaDoacao(ultima) === ITEM;

      avisos.push({
        id: 'd' + ultima.id,
        icone: aguardando ? 'time-outline' : ehItem ? 'cube' : 'heart',
        cor: aguardando || ehItem ? colors.primary : colors.supportGreen,
        titulo: ehItem
          ? (aguardando ? 'Você vai levar ' : 'Você entregou ') + ultima.item
          : aguardando
          ? 'Falta pagar R$ ' + formatarReais(ultima.valor)
          : 'Você doou R$ ' + formatarReais(ultima.valor),
        texto:
          aguardando && !ehItem
            ? 'Para o ' + ultima.abrigo + ' — toque para marcar como paga'
            : 'Para o ' + ultima.abrigo,
        destino: aguardando && !ehItem ? 'History' : 'Doações',
      });
    }

    return avisos;
  }

  function abertas() {
    return necessidades.filter((necessidade) => !necessidade.done);
  }

  function atendidas() {
    return necessidades.filter((necessidade) => necessidade.done);
  }

  // Quanto da barra preencher, de 0 a 100. Sem necessidade nenhuma a
  // divisao daria NaN, por isso o zero antes da conta.
  function percentualAtendido() {
    if (necessidades.length === 0) {
      return 0;
    }

    return Math.round((atendidas().length / necessidades.length) * 100);
  }

  function naoVistos() {
    return montarAvisos().filter((aviso) => vistos.indexOf(aviso.id) < 0);
  }

  // Tocar no sino agora registra que a pessoa viu. Antes ele só abria o
  // painel: a conta era refeita do zero no instante seguinte, com o mesmo
  // resultado, e a bolinha nunca saía.
  async function abrirAvisos() {
    setAvisosDoPainel(naoVistos());
    setAvisosVisiveis(true);

    const marcados = await marcarVistos(montarAvisos().map((aviso) => aviso.id));

    setVistos(marcados);
  }

  function irPara(destino) {
    setAvisosVisiveis(false);

    props.navigation.navigate(destino);
  }

  function executarAcao(acao) {
    if (acao.destino === 'Donate') {
      doar();

      return;
    }

    irPara(acao.destino);
  }

  // Doar sem abrigo escolhido caía numa tela que respondia "escolha um
  // abrigo no mapa": três toques para descobrir que se começou pelo lugar
  // errado. Agora, quando dá para saber qual é o abrigo, a tela já abre
  // nele; quando não dá, o caminho é o mapa, que é onde se escolhe.
  function doar() {
    const escolhido = abrigoMaisProximo() || (abrigos.length === 1 ? abrigos[0] : null);

    setAvisosVisiveis(false);

    if (escolhido) {
      props.navigation.navigate('Donate', {
        abrigo: escolhido.nome,
        abrigoId: escolhido.id,
      });

      return;
    }

    props.navigation.navigate('Mapa');
  }

  function verNoMapa(abrigo) {
    props.navigation.navigate('Mapa', {
      abrigoId: abrigo.id,
      momento: Date.now(),
    });
  }

  const avisos = montarAvisos();
  const novos = naoVistos();
  const necessidadesAbertas = abertas();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={atualizar}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >

        <LinearGradient
          colors={[colors.primary, colors.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{saudacao()}</Text>

              <Text style={styles.userName}>
                {conta ? primeiroNome(conta.nome) + '!' : 'bem-vindo(a)!'}
              </Text>
            </View>

            {/* O sino tem a bolinha com o número, mas o número sozinho
                não diz o que ele é. O rótulo diz. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                novos.length === 0
                  ? 'Avisos, nenhum novo'
                  : novos.length === 1
                  ? 'Avisos, 1 novo'
                  : 'Avisos, ' + novos.length + ' novos'
              }
              style={({ pressed }) => [styles.notificationBtn, pressed && styles.pressionado]}
              onPress={abrirAvisos}
            >
              <Ionicons
                name={novos.length > 0 ? 'notifications' : 'notifications-outline'}
                size={24}
                color="#FFF"
              />

              {novos.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.textoBadge}>{novos.length}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.statsContainer}>
            <Pressable
              style={({ pressed }) => [styles.statBox, pressed && styles.pressionado]}
              onPress={() => irPara('Doações')}
            >
              <Text style={styles.statValue}>{necessidadesAbertas.length}</Text>
              <Text style={styles.statLabel}>necessidades</Text>
            </Pressable>

            <View style={styles.statDivider} />

            {/* Atividade é assunto de quem trabalha no abrigo. Para quem
                chega para doar ou conhecer, o número que interessa é
                quantos abrigos existem para visitar. */}
            {ehGestor(conta) ? (
              <Pressable
                style={({ pressed }) => [styles.statBox, pressed && styles.pressionado]}
                onPress={() => irPara('Agenda')}
              >
                <Text style={styles.statValue}>{atividades.length}</Text>
                <Text style={styles.statLabel}>atividades</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.statBox, pressed && styles.pressionado]}
                onPress={() => irPara('Mapa')}
              >
                <Text style={styles.statValue}>{abrigos.length}</Text>
                <Text style={styles.statLabel}>abrigos</Text>
              </Pressable>
            )}

            <View style={styles.statDivider} />

            <Pressable
              style={({ pressed }) => [styles.statBox, pressed && styles.pressionado]}
              onPress={() => props.navigation.navigate('History')}
            >
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                R$ {formatarReais(totalDoado())}
              </Text>
              <Text style={styles.statLabel}>doado</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.content}>

          <Text style={styles.sectionTitle}>Ações Rápidas</Text>

          <View style={styles.quickActions}>
            {acoesDoPerfil(conta).map((acao) => (
              <Pressable
                key={acao.id}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressionado]}
                onPress={() => executarAcao(acao)}
              >
                <View style={[styles.actionIcon, { backgroundColor: acao.cor }]}>
                  <Ionicons name={acao.icone} size={24} color="#FFF" />
                </View>

                <Text style={styles.actionText}>{acao.rotulo}</Text>
              </Pressable>
            ))}
          </View>

          {/* O argumento mais forte do aplicativo é a proximidade, e ele
              não aparecia em lugar nenhum da tela de abertura. */}
          {abrigoMaisProximo() && (
            <Pressable
              style={({ pressed }) => [styles.perto, pressed && styles.pressionado]}
              onPress={() => verNoMapa(abrigoMaisProximo())}
            >
              <View style={styles.pertoIcone}>
                <Ionicons name="navigate" size={20} color={colors.supportBlue} />
              </View>

              <View style={styles.pertoTexto}>
                <Text style={styles.pertoRotulo}>Mais perto de você</Text>

                <Text style={styles.pertoNome} numberOfLines={1}>
                  {abrigoMaisProximo().nome}
                </Text>

                <Text style={styles.pertoDistancia}>
                  {textoDaDistancia(abrigoMaisProximo())}
                  {'  •  '}{abrigoMaisProximo().criancas} crianças
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
            </Pressable>
          )}

          {/* Sem abrigo nenhum cadastrado a tela mostrava três zeros e não
              dizia o que fazer com eles. */}
          {abrigos.length === 0 && (
            <Pressable
              style={({ pressed }) => [styles.vazio, pressed && styles.pressionado]}
              onPress={() =>
                ehGestor(conta)
                  ? props.navigation.navigate('RegisterShelter')
                  : irPara('Mapa')
              }
            >
              <Ionicons name="business-outline" size={26} color={colors.primary} />

              <View style={styles.pertoTexto}>
                <Text style={styles.pertoNome}>Nenhum abrigo cadastrado</Text>

                <Text style={styles.pertoDistancia}>
                  {ehGestor(conta)
                    ? 'Cadastre o seu abrigo para ele aparecer no mapa'
                    : 'Os abrigos aparecem aqui quando as instituições se cadastram'}
                </Text>
              </View>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>
            {ehGestor(conta) ? 'Avisos do seu abrigo' : 'O que os abrigos precisam'}
          </Text>

          {necessidadesAbertas.length > 0 ? (
            <Pressable
              style={({ pressed }) => [
                globalStyles.card,
                styles.warningCard,
                pressed && styles.pressionado,
              ]}
              onPress={() => irPara('Doações')}
            >
              <Ionicons name="alert-circle" size={28} color={colors.primary} />

              <View style={styles.warningTextContainer}>
                <Text style={styles.warningTitle}>
                  {necessidadesAbertas.length === 1
                    ? '1 necessidade em aberto'
                    : necessidadesAbertas.length + ' necessidades em aberto'}
                </Text>

                <Text style={styles.warningDesc}>
                  A mais recente: {necessidadesAbertas[0].title}
                </Text>

                <View style={styles.barraFundo}>
                  <View
                    style={[styles.barraCheia, { width: percentualAtendido() + '%' }]}
                  />
                </View>

                <Text style={styles.barraTexto}>
                  {atendidas().length} de {necessidades.length} atendidas
                  {'  •  '}{percentualAtendido()}%
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                globalStyles.card,
                styles.warningCard,
                pressed && styles.pressionado,
              ]}
              onPress={() => irPara('Doações')}
            >
              <Ionicons name="checkmark-circle" size={28} color={colors.supportGreen} />

              <View style={styles.warningTextContainer}>
                <Text style={styles.warningTitle}>Nada pendente</Text>

                <Text style={styles.warningDesc}>
                  {ehGestor(conta)
                    ? 'Cadastre o que o abrigo está precisando'
                    : 'Nenhum abrigo publicou necessidades agora'}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>Últimas Atividades</Text>

          {atividades.length > 0 ? (
            <Pressable
              style={({ pressed }) => [globalStyles.card, pressed && styles.pressionado]}
              onPress={() => irPara('Agenda')}
            >
              <View style={styles.activityHeader}>
                <Text style={styles.activityDate}>{atividades[0].date}</Text>

                <View style={styles.badgeTag}>
                  <Text style={styles.badgeText}>{atividades[0].tag}</Text>
                </View>
              </View>

              <Text style={styles.activityTitle}>{atividades[0].title}</Text>

              <View style={styles.activityLocation}>
                <Ionicons name="images-outline" size={16} color="#666" />

                <Text style={styles.activityLocationText}>
                  {atividades.length === 1
                    ? '1 atividade registrada'
                    : atividades.length + ' atividades registradas'}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [globalStyles.card, pressed && styles.pressionado]}
              onPress={() => irPara('Agenda')}
            >
              <Text style={styles.activityTitle}>Nenhuma atividade ainda</Text>

              <View style={styles.activityLocation}>
                <Ionicons name="camera-outline" size={16} color="#666" />

                <Text style={styles.activityLocationText}>
                  Toque para registrar a primeira
                </Text>
              </View>
            </Pressable>
          )}

        </View>
      </ScrollView>

      <Modal
        visible={avisosVisiveis}
        animationType="slide"
        transparent
        onRequestClose={() => setAvisosVisiveis(false)}
      >
        <View style={styles.fundoModal}>
          <View style={styles.painel}>

            <View style={styles.painelTopo}>
              <Text style={styles.painelTitulo}>Avisos</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar os avisos"
                style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
                onPress={() => setAvisosVisiveis(false)}
              >
                <Ionicons name="close" size={22} color="#9A8F7E" />
              </Pressable>
            </View>

            {avisosDoPainel.length === 0 ? (
              <Text style={styles.painelVazio}>
                {avisos.length === 0
                  ? 'Nenhum aviso por enquanto. Eles aparecem conforme você usa o aplicativo: necessidades cadastradas, atividades registradas e doações confirmadas.'
                  : 'Nada novo por aqui. O que você já leu continua nas abas de sempre — as necessidades em Doações, os registros na Agenda.'}
              </Text>
            ) : (
              <ScrollView style={styles.painelLista}>
                {avisosDoPainel.map((aviso) => (
                  <Pressable
                    key={aviso.id}
                    style={({ pressed }) => [styles.aviso, pressed && styles.pressionado]}
                    onPress={() => irPara(aviso.destino)}
                  >
                    <View style={[styles.avisoIcone, { backgroundColor: aviso.cor }]}>
                      <Ionicons name={aviso.icone} size={18} color="#FFFFFF" />
                    </View>

                    <View style={styles.avisoTexto}>
                      <Text style={styles.avisoTitulo}>{aviso.titulo}</Text>
                      <Text style={styles.avisoDescricao}>{aviso.texto}</Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color="#9A8F7E" />
                  </Pressable>
                ))}
              </ScrollView>
            )}

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },

  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.supportPink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
  },

  statBox: {
    flex: 1,
    alignItems: 'center',
  },

  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },

  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  content: {
    padding: 20,
    marginTop: -20,
  },

  perto: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  pertoIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pertoTexto: {
    flex: 1,
    marginHorizontal: 12,
  },

  pertoRotulo: {
    fontSize: 11,
    color: '#9A8F7E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  pertoNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 2,
  },

  pertoDistancia: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginTop: 2,
  },

  vazio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 16,
    marginTop: 8,
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  actionBtn: {
    alignItems: 'center',
  },

  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  actionText: {
    fontSize: 14,
    color: colors.textMain,
    fontWeight: '500',
  },

  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },

  warningTextContainer: {
    marginLeft: 12,
    flex: 1,
  },

  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 4,
  },

  warningDesc: {
    fontSize: 14,
    color: '#666',
  },

  barraFundo: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F0E9DC',
    overflow: 'hidden',
    marginTop: 10,
  },

  barraCheia: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.supportGreen,
  },

  barraTexto: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 5,
  },

  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  activityDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },

  badgeTag: {
    backgroundColor: 'rgba(78, 158, 114, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  badgeText: {
    fontSize: 12,
    color: colors.supportGreen,
    fontWeight: 'bold',
  },

  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 8,
  },

  activityLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  activityLocationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },

  fundoModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  painel: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
    maxHeight: '75%',
  },

  painelTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  painelTitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  fechar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  painelVazio: {
    fontSize: 14,
    color: '#9A8F7E',
    lineHeight: 20,
    paddingBottom: 10,
  },

  painelLista: {
    marginBottom: 4,
  },

  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  avisoIcone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avisoTexto: {
    flex: 1,
    marginHorizontal: 12,
  },

  avisoTitulo: {
    fontSize: 15,
    color: colors.textMain,
  },

  avisoDescricao: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 2,
  },

  pressionado: {
    opacity: 0.6,
  },
});
