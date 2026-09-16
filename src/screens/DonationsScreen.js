import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NeedForm from '../components/NeedForm';
import NeedItem from '../components/NeedItem';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';
import { loadNeeds, saveNeeds } from '../services/storage';

export default function DonationsScreen(props) {

  const [needs, setNeeds] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function fetchNeeds() {
      try {
        const storedNeeds = await loadNeeds();
        if (storedNeeds) {
          setNeeds(storedNeeds);
        }
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível carregar a lista de necessidades.');
      } finally {
        setCarregando(false);
      }
    }
    fetchNeeds();
  }, []);

  async function addNeed(title) {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert(
        'Atenção',
        'Digite o nome da necessidade.'
      );

      return;
    }

    const newNeed = {
      id: Date.now().toString(),
      title: cleanTitle,
      done: false,
    };

    const newList = [newNeed, ...needs];
    setNeeds(newList);

    try {
      await saveNeeds(newList);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar a necessidade.');
    }
  }

  async function toggleNeed(id) {
    const newList = needs.map((need) => {
      if (need.id === id) {
        return {
          ...need,
          done: !need.done,
        };
      }

      return need;
    });

    setNeeds(newList);

    try {
      await saveNeeds(newList);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar a necessidade.');
    }
  }

  function confirmDelete(id) {
    Alert.alert(
      'Excluir necessidade',
      'Deseja realmente excluir esta necessidade da lista?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteNeed(id),
        },
      ]
    );
  }

  async function deleteNeed(id) {
    const newList = needs.filter((need) => need.id !== id);

    setNeeds(newList);

    try {
      await saveNeeds(newList);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao excluir a necessidade.');
    }
  }

  function renderNeed({ item }) {
    return (
      <NeedItem
        need={item}
        onToggle={toggleNeed}
        onDelete={confirmDelete}
      />
    );
  }

  const doneCount = needs.filter((need) => need.done).length;

  if (carregando) {
    return (
      <SafeAreaView style={[globalStyles.container, styles.loadingContainer]} edges={['top']}>
        <Text style={styles.loadingText}>Carregando necessidades...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.container} edges={['top']}>
      <View style={styles.content}>

        <Text style={styles.title}>Doações</Text>
        <Text style={styles.summary}>
          {needs.length} necessidade(s) • {doneCount} atendida(s)
        </Text>

        <NeedForm onAdd={addNeed} />

        {/* Porta de entrada da doação em dinheiro (Módulo 3). A lista
            acima é o que o abrigo precisa; aqui a pessoa contribui. */}
        <Pressable
          style={({ pressed }) => [styles.doar, pressed && styles.doarPressionado]}
          onPress={() => props.navigation.navigate('Donate')}
        >
          <View style={styles.doarIcone}>
            <Ionicons name="heart" size={20} color={colors.primary} />
          </View>

          <View style={styles.doarConteudo}>
            <Text style={styles.doarTitulo}>Fazer uma doação em dinheiro</Text>
            <Text style={styles.doarTexto}>Confirmação por biometria</Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
        </Pressable>

        <FlatList
          data={needs}
          keyExtractor={(item) => item.id}
          renderItem={renderNeed}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.list,
            needs.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="gift-outline"
                size={48}
                color={colors.primary}
              />

              <Text style={styles.emptyTitle}>
                Nenhuma necessidade
              </Text>

              <Text style={styles.emptyText}>
                Cadastre acima o que o abrigo está precisando.
              </Text>
            </View>
          }
        />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 16,
    color: colors.textMain,
  },

  title: {
    fontSize: 24,
    color: colors.textMain,
    fontWeight: 'bold',
  },

  summary: {
    fontSize: 14,
    color: '#9A8F7E',
    marginTop: 4,
    marginBottom: 16,
  },

  doar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  doarIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  doarConteudo: {
    flex: 1,
    marginHorizontal: 12,
  },

  doarTitulo: {
    fontSize: 15,
    color: colors.textMain,
  },

  doarTexto: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 2,
  },

  doarPressionado: {
    opacity: 0.6,
  },

  list: {
    paddingBottom: 12,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  empty: {
    alignItems: 'center',
    paddingBottom: 60,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 10,
  },

  emptyText: {
    fontSize: 14,
    color: '#9A8F7E',
    marginTop: 5,
  },
});
