import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MOTIVOS_DE_DENUNCIA, denunciarAbrigo } from '../services/comunidade';
import { colors } from '../theme/colors';

// Quem doa por Pix confia na chave que o abrigo cadastrou. Esta é a forma de avisar
// quando algo parece errado. O aviso público só aparece com três pessoas diferentes,
// para uma denúncia isolada não prejudicar um abrigo de verdade.
export default function DenunciarAbrigo(props) {
  const [motivo, setMotivo] = useState(null);
  const [detalhe, setDetalhe] = useState('');
  const [enviando, setEnviando] = useState(false);

  function fechar() {
    setMotivo(null);
    setDetalhe('');
    props.aoFechar();
  }

  async function enviar() {
    if (motivo == null) {
      Alert.alert('Atenção', 'Escolha o motivo da denúncia.');

      return;
    }

    setEnviando(true);

    try {
      await denunciarAbrigo(props.abrigo.id, motivo, detalhe.trim());

      fechar();

      Alert.alert('Denúncia enviada', 'Obrigado por avisar. Quem denuncia não é identificado.');
    } catch (error) {
      Alert.alert(
        'Não foi possível enviar',
        error.status ? error.message : 'Confira a sua internet e tente de novo.'
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={props.visivel} animationType="fade" transparent onRequestClose={fechar}>
      <KeyboardAvoidingView
        style={styles.fundo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.painel}>
          <Text style={styles.titulo}>Denunciar este abrigo</Text>

          {MOTIVOS_DE_DENUNCIA.map((opcao) => (
            <Pressable
              key={opcao.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: motivo === opcao.id }}
              style={({ pressed }) => [styles.opcao, pressed && styles.pressionado]}
              onPress={() => setMotivo(opcao.id)}
            >
              <Ionicons
                name={motivo === opcao.id ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={motivo === opcao.id ? colors.primary : '#9A8F7E'}
              />

              <Text style={styles.textoOpcao}>{opcao.nome}</Text>
            </Pressable>
          ))}

          <TextInput
            style={styles.campo}
            placeholder="Conte o que aconteceu (opcional)"
            placeholderTextColor="#9A8F7E"
            value={detalhe}
            onChangeText={setDetalhe}
            maxLength={500}
            multiline
          />

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
            onPress={enviar}
            disabled={enviando}
          >
            <Text style={styles.textoBotao}>{enviando ? 'Enviando...' : 'Enviar denúncia'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.link, pressed && styles.pressionado]}
            onPress={fechar}
          >
            <Text style={styles.textoLink}>Cancelar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  painel: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 12,
  },

  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },

  textoOpcao: {
    flex: 1,
    fontSize: 14,
    color: colors.textMain,
  },

  campo: {
    minHeight: 70,
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    textAlignVertical: 'top',
    color: colors.textMain,
    backgroundColor: colors.backgroundLight,
  },

  botao: {
    alignItems: 'center',
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  textoBotao: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  link: {
    alignItems: 'center',
    padding: 12,
  },

  textoLink: {
    fontSize: 14,
    color: '#9A8F7E',
  },

  pressionado: {
    opacity: 0.6,
  },
});
