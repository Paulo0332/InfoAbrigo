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

  // A meta é um número e uma unidade, separados. Guardar "10 pacotes"
  // como texto solto não permitia dizer que três chegaram e faltam sete —
  // e é isso que quem quer ajudar precisa saber antes de decidir.
  const [alvo, setAlvo] = useState('');
  const [unidade, setUnidade] = useState('');
  const [urgente, setUrgente] = useState(false);

  // Entrega o que foi digitado para a tela e limpa os campos. Quem valida
  // é a tela, seguindo o mesmo desenho do exemplo de aula.
  function handleAdd() {
    props.onAdd(text, {
      alvo: Number(alvo.replace(/[^0-9]/g, '')) || null,
      unidade: unidade.trim(),
      urgente: urgente,
    });

    setText('');
    setAlvo('');
    setUnidade('');
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
          style={styles.alvo}
          placeholder="10"
          placeholderTextColor="#9A8F7E"
          value={alvo}
          onChangeText={setAlvo}
          keyboardType="number-pad"
          maxLength={5}
        />

        <TextInput
          style={styles.unidade}
          placeholder="pacotes"
          placeholderTextColor="#9A8F7E"
          value={unidade}
          onChangeText={setUnidade}
          maxLength={20}
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

  alvo: {
    width: 64,
    height: 44,
    color: colors.textMain,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 12,
    fontSize: 14,
    textAlign: 'center',
  },

  unidade: {
    flex: 1,
    height: 44,
    color: colors.textMain,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 14,
    fontSize: 14,
    marginLeft: 8,
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
