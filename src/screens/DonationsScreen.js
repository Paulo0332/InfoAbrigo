import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NeedForm from '../components/NeedForm';
import NeedItem from '../components/NeedItem';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';

export default function DonationsScreen() {

  const [needs, setNeeds] = useState([]);

  function addNeed(title) {
    const cleanTitle = title.trim();

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

  function deleteNeed(id) {
    const newList = needs.filter((need) => need.id !== id);

    setNeeds(newList);
  }

  function renderNeed({ item }) {
    return (
      <NeedItem
        need={item}
        onToggle={toggleNeed}
        onDelete={deleteNeed}
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
          contentContainerStyle={styles.list}
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
});
