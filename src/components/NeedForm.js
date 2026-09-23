import { useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function NeedForm(props) {

  const [text, setText] = useState('');

  // "Fraldas" não diz quantas nem se é para hoje. Quem vai doar precisa
  // dos dois para decidir, e quem administra o abrigo precisa dos dois
  // para a lista significar alguma coisa.
  const [quantidade, setQuantidade] = useState('');
  const [urgente, setUrgente] = useState(false);

  // Entrega o que foi digitado para a tela e limpa os campos. Quem valida
  // é a tela, seguindo o mesmo desenho do exemplo de aula.
  function handleAdd() {
    props.onAdd(text, {
      quantidade: quantidade.trim(),
      urgente: urgente,
    });

    setText('');
    setQuantidade('');
    setUrgente(false);
    Keyboard.dismiss();
  }

  return (
    <View style={styles.area}>
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

      <View style={styles.detalhes}>
        <TextInput
          style={styles.quantidade}
          placeholder="Quanto? Ex.: 10 pacotes"
          placeholderTextColor="#9A8F7E"
          value={quantidade}
          onChangeText={setQuantidade}
          maxLength={30}
        />

        <Pressable
          style={({ pressed }) => [
            styles.urgente,
            urgente && styles.urgenteAtivo,
            pressed && styles.pressed,
          ]}
          onPress={() => setUrgente(!urgente)}
        >
          <Ionicons
            name={urgente ? 'alert-circle' : 'alert-circle-outline'}
            size={16}
            color={urgente ? '#FFFFFF' : colors.supportPink}
          />

          <Text style={[styles.urgenteTexto, urgente && styles.urgenteTextoAtivo]}>
            Urgente
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    marginBottom: 16,
  },

  form: {
    flexDirection: 'row',
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

  detalhes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  quantidade: {
    flex: 1,
    height: 44,
    color: colors.textMain,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 14,
    fontSize: 14,
  },

  urgente: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.supportPink,
    paddingHorizontal: 12,
    marginLeft: 8,
  },

  urgenteAtivo: {
    backgroundColor: colors.supportPink,
  },

  urgenteTexto: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.supportPink,
    marginLeft: 5,
  },

  urgenteTextoAtivo: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.7,
  },
});
