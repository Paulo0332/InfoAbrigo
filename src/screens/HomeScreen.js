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
import { carregarConta } from '../services/auth';
import { loadNeeds } from '../services/storage';
import { carregarAtividades } from '../services/activities';
import { carregarDoacoes } from '../services/donations';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';

export default function HomeScreen(props) {

  const [conta, setConta] = useState(null);
  const [necessidades, setNecessidades] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [doacoes, setDoacoes] = useState([]);
  const [avisosVisiveis, setAvisosVisiveis] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  // Além de buscar quando a tela monta, buscamos de novo a cada vez que a
  // aba volta a ficar em foco. Sem isso, cadastrar uma necessidade na aba
  // Doações não apareceria aqui até o app ser reaberto.
  useEffect(() => {
    buscarDados();

    const inscricao = props.navigation.addListener('focus', buscarDados);

    return inscricao;
  }, []);

  async function buscarDados() {
    try {
      const contaSalva = await carregarConta();
      const listaNecessidades = await loadNeeds();
      const listaAtividades = await carregarAtividades();
      const listaDoacoes = await carregarDoacoes();

      setConta(contaSalva);
      setNecessidades(listaNecessidades || []);
      setAtividades(listaAtividades);
      setDoacoes(listaDoacoes);
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

  function totalDoado() {
    return doacoes.reduce((soma, doacao) => soma + doacao.valor, 0);
  }

  // Os avisos não são inventados: cada um é uma leitura do que está
  // gravado no aparelho. Sem dado, não há aviso.
  function montarAvisos() {
    const avisos = [];

    for (const necessidade of abertas()) {
      avisos.push({
        id: 'n' + necessidade.id,
        icone: 'alert-circle',
        cor: colors.primary,
        titulo: 'O abrigo precisa de ' + necessidade.title,
        texto: 'Cadastrado na aba Doações e ainda não atendido',
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

    if (doacoes.length > 0) {
      avisos.push({
        id: 'd' + doacoes[0].id,
        icone: 'heart',
        cor: colors.supportGreen,
        titulo: 'Você doou R$ ' + doacoes[0].valor + ',00',
        texto: 'Para o ' + doacoes[0].abrigo,
        destino: 'Doações',
      });
    }

    return avisos;
  }

  function abertas() {
    return necessidades.filter((necessidade) => !necessidade.done);
  }

  function irPara(destino) {
    setAvisosVisiveis(false);

    props.navigation.navigate(destino);
  }

  const avisos = montarAvisos();
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

            <Pressable
              style={({ pressed }) => [styles.notificationBtn, pressed && styles.pressionado]}
              onPress={() => setAvisosVisiveis(true)}
            >
              <Ionicons name="notifications-outline" size={24} color="#FFF" />

              {avisos.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.textoBadge}>{avisos.length}</Text>
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

            <Pressable
              style={({ pressed }) => [styles.statBox, pressed && styles.pressionado]}
              onPress={() => irPara('Agenda')}
            >
              <Text style={styles.statValue}>{atividades.length}</Text>
              <Text style={styles.statLabel}>atividades</Text>
            </Pressable>

            <View style={styles.statDivider} />

            <Pressable
              style={({ pressed }) => [styles.statBox, pressed && styles.pressionado]}
              onPress={() => props.navigation.navigate('History')}
            >
              <Text style={styles.statValue}>R$ {totalDoado()}</Text>
              <Text style={styles.statLabel}>doado</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.content}>

          <Text style={styles.sectionTitle}>Ações Rápidas</Text>

          <View style={styles.quickActions}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressionado]}
              onPress={() => props.navigation.navigate('Donate')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.supportGreen }]}>
                <Ionicons name="heart" size={24} color="#FFF" />
              </View>

              <Text style={styles.actionText}>Doar</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressionado]}
              onPress={() => irPara('Mapa')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.supportBlue }]}>
                <Ionicons name="location" size={24} color="#FFF" />
              </View>

              <Text style={styles.actionText}>Abrigos</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressionado]}
              onPress={() => irPara('Agenda')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.supportPink }]}>
                <Ionicons name="camera" size={24} color="#FFF" />
              </View>

              <Text style={styles.actionText}>Registrar</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Avisos do Abrigo</Text>

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
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
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
                  Cadastre o que o abrigo está precisando
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
                style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
                onPress={() => setAvisosVisiveis(false)}
              >
                <Ionicons name="close" size={22} color="#9A8F7E" />
              </Pressable>
            </View>

            {avisos.length === 0 ? (
              <Text style={styles.painelVazio}>
                Nenhum aviso por enquanto. Eles aparecem conforme você usa o
                aplicativo: necessidades cadastradas, atividades registradas e
                doações confirmadas.
              </Text>
            ) : (
              <ScrollView style={styles.painelLista}>
                {avisos.map((aviso) => (
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
