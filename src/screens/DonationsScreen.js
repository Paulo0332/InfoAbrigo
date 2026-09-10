import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NeedForm from '../components/NeedForm';
import NeedItem from '../components/NeedItem';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';

export default function DonationsScreen() {

  const [needs, setNeeds] = useState([]);

  function addNeed(title) {
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

    setNeeds([newNeed, ...needs]);
  }

  function toggleNeed(id) {
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

  function deleteNeed(id) {
    const newList = needs.filter((need) => need.id !== id);

    setNeeds(newList);
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

  return (
    <SafeAreaView style={globalStyles.container} edges={['top']}>
      <View style={styles.content}>

        <Text style={styles.title}>Doações</Text>
        <Text style={styles.summary}>
          {needs.length} necessidade(s) • {doneCount} atendida(s)
        </Text>

        <NeedForm onAdd={addNeed} />

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
