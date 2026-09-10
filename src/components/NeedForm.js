import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

export default function NeedForm(props) {

  const [text, setText] = useState('');

  // Entrega o texto para a tela e limpa o campo. Quem valida é a tela,
  // seguindo o mesmo desenho do exemplo de aula.
  function handleAdd() {
    props.onAdd(text);
    setText('');
    Keyboard.dismiss();
  }

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="Digite uma necessidade do abrigo"
        placeholderTextColor="#9A8F7E"
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleAdd}
        returnKeyType="done"
        maxLength={100}
      />

      <Pressable
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        onPress={handleAdd}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  input: {
    flex: 1,
    height: 52,
    color: colors.textMain,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 16,
    fontSize: 16,
  },

  addButton: {
    width: 52,
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '500',
  },

  pressed: {
    opacity: 0.7,
  },
});
