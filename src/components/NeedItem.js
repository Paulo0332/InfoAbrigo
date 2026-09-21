import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function NeedItem(props) {
  return (
    <View style={styles.item}>

      {/* Caixa de marcação: mostra o "check" quando a necessidade já foi
          atendida. Quem não administra o abrigo vê o estado, mas não muda. */}
      <Pressable
        style={[styles.checkbox, props.need.done && styles.checkboxDone]}
        onPress={() => props.onToggle(props.need.id)}
        disabled={props.somenteLeitura}
      >
        {props.need.done && (
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        )}
      </Pressable>

      {/* Tocar no texto também marca ou desmarca */}
      <Pressable
        style={styles.content}
        onPress={() => props.onToggle(props.need.id)}
        disabled={props.somenteLeitura}
      >
        <Text style={[styles.title, props.need.done && styles.titleDone]}>
          {props.need.title}
        </Text>

        {/* Necessidade cadastrada por um gestor carrega o nome do abrigo.
            As antigas, de antes deste campo existir, não têm — e a etiqueta
            simplesmente não aparece. */}
        {props.need.abrigoNome ? (
          <View style={styles.abrigo}>
            <Ionicons name="business-outline" size={11} color="#9A8F7E" />
            <Text style={styles.abrigoNome}>{props.need.abrigoNome}</Text>
          </View>
        ) : null}
      </Pressable>

      {props.somenteLeitura ? null : (
        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          onPress={() => props.onDelete(props.need.id)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.supportPink} />
        </Pressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
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

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxDone: {
    backgroundColor: colors.primary,
  },

  content: {
    flex: 1,
    marginHorizontal: 12,
    paddingVertical: 5,
  },

  title: {
    fontSize: 16,
    color: colors.textMain,
  },

  abrigo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },

  abrigoNome: {
    fontSize: 11,
    color: '#9A8F7E',
    marginLeft: 4,
  },

  titleDone: {
    color: '#9A8F7E',
    textDecorationLine: 'line-through',
  },

  deleteButton: {
    padding: 6,
  },

  pressed: {
    opacity: 0.5,
  },
});
