import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  ITEM,
  carregarDoacoes,
  confirmarPagamento,
  desfazerPagamento,
  doacoesDaConta,
  estaPendente,
  formatarReais,
  tipoDaDoacao,
  totalDeItens,
  totalEmDinheiro,
  totalPendente,
} from '../services/donations';
import { carregarConta } from '../services/auth';
import { colors } from '../theme/colors';

export default function HistoryScreen(props) {

  const [doacoes, setDoacoes] = useState([]);
  const [conta, setConta] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarDoacoes();

    // O histórico muda em outras telas: reservar um item na lista de
    // doações entra aqui, e desistir sai.
    const inscricao = props.navigation.addListener('focus', buscarDoacoes);

    return inscricao;
  }, []);

  async function buscarDoacoes() {
    try {
      const contaSalva = await carregarConta();
      const lista = await carregarDoacoes();

      setConta(contaSalva);

      // O histórico é de quem doou, não do aparelho. Sem isto o gestor
      // entraria e veria as doações de quem usou o celular antes dele.
      setDoacoes(doacoesDaConta(lista, contaSalva));
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível ler o histórico de doações.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // Só o dinheiro entra na soma. Os itens são contados à parte, porque
  // somar uma caixa de fraldas com cinquenta reais não diz nada.
  function total() {
    return totalEmDinheiro(doacoes);
  }

  function itens() {
    return totalDeItens(doacoes);
  }

  function pendentes() {
    return totalPendente(doacoes);
  }

  // Quem sabe se o dinheiro saiu é quem pagou: não há servidor nem aviso
  // do banco chegando aqui. Marcar por aqui é a saída de quem fechou a
  // tela do pagamento antes de confirmar.
  async function marcarComoPaga(doacao) {
    try {
      const nova = await confirmarPagamento(doacao.id);

      setDoacoes(doacoesDaConta(nova, conta));
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar o pagamento.');
    }
  }

  // Marcar por engano é comum, e desfazer precisa ser tão fácil quanto
  // marcar. Sem isto a anotação errada ficava para sempre.
  function confirmarDesfazer(doacao) {
    Alert.alert(
      'Desmarcar o pagamento',
      'A doação volta a aparecer como aguardando, e sai da soma do total.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Desmarcar',
          onPress: () => desmarcar(doacao),
        },
      ]
    );
  }

  async function desmarcar(doacao) {
    try {
      const nova = await desfazerPagamento(doacao.id);

      setDoacoes(doacoesDaConta(nova, conta));
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível desmarcar.');
    }
  }

  // A data é gravada em ISO, que é bom para ordenar e ruim para ler. Aqui
  // ela vira o formato brasileiro, com a hora.
  function formatarData(iso) {
    const data = new Date(iso);

    return data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Dinheiro e item dividem o mesmo histórico, porque para quem doa é
  // tudo ajuda. O que muda é a primeira linha do cartão: um mostra o
  // valor, o outro mostra o que foi prometido levar.
  function renderizarDoacao({ item }) {
    const ehItem = tipoDaDoacao(item) === ITEM;
    const aguardando = estaPendente(item);

    return (
      <View style={styles.item}>
        <View style={styles.itemIcone}>
          <Ionicons
            name={aguardando ? 'time-outline' : ehItem ? 'cube' : 'heart'}
            size={20}
            color={aguardando ? colors.primary : ehItem ? colors.primary : colors.supportGreen}
          />
        </View>

        <View style={styles.itemTexto}>
          <Text style={styles.itemValor}>
            {ehItem ? item.item : 'R$ ' + formatarReais(item.valor)}
          </Text>

          <Text style={styles.itemAbrigo}>{item.abrigo}</Text>
          <Text style={styles.itemData}>{formatarData(item.data)}</Text>

          {aguardando && !ehItem ? (
            <Pressable
              style={({ pressed }) => [styles.pagar, pressed && styles.pressionado]}
              onPress={() => marcarComoPaga(item)}
            >
              <Ionicons name="checkmark-circle-outline" size={15} color={colors.supportGreen} />
              <Text style={styles.pagarTexto}>Marcar como paga</Text>
            </Pressable>
          ) : null}

          {/* "Você marcou", e não "confirmada": o aplicativo não confere
              pagamento nenhum, e escrever confirmada daria a entender que
              alguém conferiu. */}
          {!aguardando && !ehItem && item.pagaEm ? (
            <Pressable
              style={({ pressed }) => [styles.marcada, pressed && styles.pressionado]}
              onPress={() => confirmarDesfazer(item)}
            >
              <Text style={styles.marcadaTexto}>
                Você marcou como paga em {formatarData(item.pagaEm)}
              </Text>

              <Text style={styles.desmarcar}>Desmarcar</Text>
            </Pressable>
          ) : null}

          {aguardando && ehItem ? (
            <Text style={styles.aguardando}>Combinado, aguardando a entrega</Text>
          ) : null}

          {/* Quem confirma que o item chegou é o abrigo, marcando a
              necessidade como atendida. É o fim do ciclo que começou no
              "vou doar". */}
          {!aguardando && ehItem ? (
            <Text style={styles.entregue}>
              Entregue
              {item.recebidaEm ? ' em ' + formatarData(item.recebidaEm) : ''}
            </Text>
          ) : null}
        </View>
      </View>
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

          <Text style={styles.headerTitulo}>Minhas doações</Text>

          <View style={styles.voltar} />
        </View>

        {doacoes.length > 0 && (
          <View style={styles.resumo}>
            <Text style={styles.resumoRotulo}>Total já pago</Text>
            <Text style={styles.resumoValor}>R$ {formatarReais(total())}</Text>

            <Text style={styles.resumoRotulo}>
              {doacoes.length === 1
                ? '1 doação registrada'
                : doacoes.length + ' doações registradas'}
              {itens() > 0
                ? ', sendo ' + (itens() === 1 ? '1 item' : itens() + ' itens')
                : ''}
            </Text>

            {pendentes() > 0 && (
              <Text style={styles.resumoPendente}>
                {pendentes() === 1
                  ? '1 aguardando pagamento ou entrega'
                  : pendentes() + ' aguardando pagamento ou entrega'}
              </Text>
            )}
          </View>
        )}
      </LinearGradient>

      <View style={styles.corpo}>
        {carregando ? (
          <View style={styles.centralizado}>
            <Text style={styles.texto}>Carregando...</Text>
          </View>
        ) : (
          <FlatList
            data={doacoes}
            keyExtractor={(item) => item.id}
            renderItem={renderizarDoacao}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              doacoes.length > 0 ? (
                <Text style={styles.rodape}>
                  Este histórico é a sua anotação neste aparelho. O
                  aplicativo não confere pagamento e não emite recibo —
                  quem emite recibo, inclusive para deduzir no imposto, é a
                  própria instituição.
                </Text>
              ) : null
            }
            contentContainerStyle={[
              styles.lista,
              doacoes.length === 0 && styles.listaVazia,
            ]}
            ListEmptyComponent={
              <View style={styles.vazio}>
                <Ionicons name="heart-outline" size={48} color={colors.primary} />

                <Text style={styles.tituloVazio}>Nenhuma doação ainda</Text>

                <Text style={styles.textoVazio}>
                  As doações que você confirmar aparecem aqui.
                </Text>

                <Pressable
                  style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
                  onPress={() => props.navigation.navigate('Donate')}
                >
                  <Text style={styles.textoBotao}>Fazer uma doação</Text>
                </Pressable>
              </View>
            }
          />
        )}
      </View>

      <Text style={styles.aviso}>
        Demonstração acadêmica: nenhum pagamento é processado de verdade.
      </Text>

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

  resumo: {
    alignItems: 'center',
    marginTop: 8,
  },

  resumoRotulo: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },

  resumoPendente: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: 'bold',
    marginTop: 6,
  },

  pagar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.supportGreen,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },

  pagarTexto: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.supportGreen,
    marginLeft: 5,
  },

  rodape: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 18,
    paddingHorizontal: 8,
  },

  marcada: {
    marginTop: 6,
  },

  marcadaTexto: {
    fontSize: 12,
    color: '#9A8F7E',
  },

  desmarcar: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 2,
  },

  pressionado: {
    opacity: 0.6,
  },

  entregue: {
    fontSize: 12,
    color: colors.supportGreen,
    fontWeight: 'bold',
    marginTop: 6,
  },

  aguardando: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
    marginTop: 6,
  },

  resumoValor: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: 2,
  },

  corpo: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  texto: {
    fontSize: 15,
    color: colors.textMain,
  },

  lista: {
    padding: 16,
  },

  listaVazia: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  item: {
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

  itemIcone: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemTexto: {
    flex: 1,
    marginLeft: 12,
  },

  itemValor: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  itemAbrigo: {
    fontSize: 14,
    color: colors.textMain,
    marginTop: 2,
  },

  itemData: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 2,
  },

  vazio: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },

  tituloVazio: {
    fontSize: 19,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 12,
  },

  textoVazio: {
    fontSize: 14,
    color: '#9A8F7E',
    textAlign: 'center',
    marginTop: 6,
  },

  botao: {
    height: 52,
    paddingHorizontal: 24,
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

  aviso: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    backgroundColor: colors.backgroundLight,
    paddingBottom: 10,
  },

  pressionado: {
    opacity: 0.5,
  },
});
