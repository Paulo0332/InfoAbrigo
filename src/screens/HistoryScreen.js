import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { carregarDoacoes } from '../services/donations';
import { colors } from '../theme/colors';

export default function HistoryScreen(props) {

  const [doacoes, setDoacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarDoacoes();
  }, []);

  async function buscarDoacoes() {
    try {
      const lista = await carregarDoacoes();

      setDoacoes(lista);
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível ler o histórico de doações.'
      );
    } finally {
      setCarregando(false);
    }
  }

  function total() {
    return doacoes.reduce((soma, doacao) => soma + doacao.valor, 0);
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

  function renderizarDoacao({ item }) {
    return (
      <View style={styles.item}>
        <View style={styles.itemIcone}>
          <Ionicons name="heart" size={20} color={colors.supportGreen} />
        </View>

        <View style={styles.itemTexto}>
          <Text style={styles.itemValor}>R$ {item.valor},00</Text>
          <Text style={styles.itemAbrigo}>{item.abrigo}</Text>
          <Text style={styles.itemData}>{formatarData(item.data)}</Text>
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
            <Text style={styles.resumoRotulo}>Total doado</Text>
            <Text style={styles.resumoValor}>R$ {total()},00</Text>

            <Text style={styles.resumoRotulo}>
              {doacoes.length === 1
                ? '1 doação registrada'
                : doacoes.length + ' doações registradas'}
            </Text>
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
