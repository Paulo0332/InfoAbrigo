import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';

// O selo e o aviso vêm da API, por um lugar do Firebase que o dono do abrigo não
// consegue alterar. O texto diz só o que foi conferido: a instituição existe e está
// ativa. Isso não prova que a pessoa que cadastrou trabalha lá.
export default function SeloAbrigo(props) {
  const { verificacao, alerta } = props.abrigo;

  if (alerta) {
    return (
      <View style={[styles.selo, styles.alerta]}>
        <Ionicons name="warning" size={14} color={colors.supportPink} />

        <Text style={[styles.texto, styles.textoAlerta]}>
          Abrigo denunciado por outras pessoas. Confira antes de doar.
        </Text>
      </View>
    );
  }

  if (verificacao && verificacao.verificado) {
    return (
      <View style={[styles.selo, styles.verificado]}>
        <Ionicons name="shield-checkmark" size={14} color={colors.supportGreen} />

        <Text style={[styles.texto, styles.textoVerificado]}>
          CNPJ ativo na Receita Federal
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 10,
  },

  verificado: {
    backgroundColor: '#E8F3EC',
  },

  alerta: {
    backgroundColor: '#F9E9EF',
  },

  texto: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
  },

  textoVerificado: {
    color: colors.supportGreen,
  },

  textoAlerta: {
    color: colors.supportPink,
  },
});
