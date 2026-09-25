import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  contribuicoesDaNecessidade,
  estaCompleta,
  percentualPrometido,
  percentualRecebido,
  temMeta,
  textoDoQueFalta,
} from '../services/necessidades';
import { colors } from '../theme/colors';

export default function NeedItem(props) {

  const contribuicoes = contribuicoesDaNecessidade(props.need);
  const comMeta = temMeta(props.need);
  const completa = estaCompleta(props.need);

  function minha(contribuicao) {
    return props.email != null && contribuicao.por === props.email;
  }

  // Sem nome visível o cartão fica sem cabeça: sobra o selo de urgente
  // pairando sobre a barra, e ninguém sabe do que a necessidade trata.
  // O cadastro exige o nome, mas se algum registro chegar aqui sem ele é
  // melhor dizer isso do que não dizer nada.
  function nomeDaNecessidade() {
    return (props.need.title || '').trim();
  }

  // Quem já ofereceu não oferece de novo pelo mesmo item; quem administra
  // não doa para o próprio abrigo. E item atendido, ou com tudo já
  // prometido, não precisa de mais ninguém.
  function podeOferecer() {
    if (!props.somenteLeitura || props.need.done) {
      return false;
    }

    if (comMeta && completa) {
      return false;
    }

    return !contribuicoes.some(minha);
  }

  function rotuloDaContribuicao(contribuicao) {
    const quem = minha(contribuicao) ? 'Você' : contribuicao.nome;
    const quanto = comMeta ? ' ' + contribuicao.quantidade : '';

    if (contribuicao.entregue) {
      return quem + (minha(contribuicao) ? ' entregou' : ' entregou') + quanto;
    }

    return quem + ' vai levar' + quanto;
  }

  return (
    <View style={styles.item}>

      {/* Caixa de marcação: mostra o "check" quando a necessidade já foi
          atendida. Quem não administra o abrigo vê o estado, mas não muda. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Marcar como atendida"
        style={[styles.checkbox, props.need.done && styles.checkboxDone]}
        onPress={() => props.onToggle(props.need.id)}
        disabled={props.somenteLeitura}
      >
        {props.need.done && (
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        )}
      </Pressable>

      <View style={styles.content}>
        <View style={styles.linhaTitulo}>
          {/* Urgente precisa ser visto antes de ler o nome, senão não
              adianta existir. */}
          {props.need.urgente && !props.need.done ? (
            <View style={styles.urgente}>
              <Ionicons name="alert-circle" size={11} color="#FFFFFF" />
              <Text style={styles.urgenteTexto}>Urgente</Text>
            </View>
          ) : null}

          <Text
            style={[
              styles.title,
              props.need.done && styles.titleDone,
              !nomeDaNecessidade() && styles.titleSemNome,
            ]}
            numberOfLines={2}
          >
            {nomeDaNecessidade() || 'Necessidade sem nome'}
          </Text>
        </View>

        {/* Quanto ainda falta, que é a pergunta de quem quer ajudar. A
            barra tem duas camadas: o que o abrigo já recebeu, cheia, e o
            que foi prometido e ainda não chegou, clara. Uma promessa não
            é uma entrega, e a barra não deve dizer que é. */}
        {comMeta ? (
          <View style={styles.progresso}>
            <Text
              style={[
                styles.falta,
                completa && styles.faltaCompleta,
                props.need.done && styles.faltaFeita,
              ]}
            >
              {textoDoQueFalta(props.need)}
            </Text>

            <View style={styles.barraFundo}>
              <View
                style={[
                  styles.barraPrometida,
                  { width: percentualPrometido(props.need) + '%' },
                ]}
              />

              <View
                style={[
                  styles.barraRecebida,
                  { width: percentualRecebido(props.need) + '%' },
                ]}
              />
            </View>
          </View>
        ) : null}

        {/* De quem é a necessidade. Com o filtro em "Todos" a lista junta
            os abrigos, e sem isto não dá para saber quem está precisando
            do quê. */}
        <View style={[styles.abrigo, !props.need.abrigoNome && styles.abrigoSolto]}>
          <Ionicons
            name="business"
            size={11}
            color={props.need.abrigoNome ? colors.primary : '#9A8F7E'}
          />

          <Text
            style={[
              styles.abrigoNome,
              !props.need.abrigoNome && styles.abrigoNomeSolto,
            ]}
            numberOfLines={1}
          >
            {props.need.abrigoNome || 'Sem abrigo'}
          </Text>
        </View>

        {/* Quem se ofereceu, quanto, e se já chegou. O abrigo confirma
            cada entrega por aqui: é ele quem sabe que o item chegou. */}
        {contribuicoes.map((contribuicao) => (
          <View key={contribuicao.id} style={styles.contribuicao}>
            <Ionicons
              name={contribuicao.entregue ? 'checkmark-circle' : 'hand-left'}
              size={12}
              color={contribuicao.entregue ? colors.supportGreen : '#9A8F7E'}
            />

            <Text
              style={[
                styles.contribuicaoTexto,
                contribuicao.entregue && styles.contribuicaoEntregue,
              ]}
              numberOfLines={1}
            >
              {rotuloDaContribuicao(contribuicao)}
            </Text>

            {!props.somenteLeitura && !contribuicao.entregue ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirmar que esta doação chegou"
                style={({ pressed }) => [styles.recebi, pressed && styles.pressed]}
                onPress={() => props.onReceber(props.need, contribuicao)}
              >
                <Text style={styles.recebiTexto}>Recebi</Text>
              </Pressable>
            ) : null}

            {minha(contribuicao) && !contribuicao.entregue ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Desistir de doar este item"
                style={({ pressed }) => [styles.desistir, pressed && styles.pressed]}
                onPress={() => props.onCancelarReserva(props.need, contribuicao)}
              >
                <Ionicons name="close-circle-outline" size={17} color={colors.supportPink} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {props.somenteLeitura ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Excluir necessidade"
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          onPress={() => props.onDelete(props.need.id)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.supportPink} />
        </Pressable>
      )}

      {podeOferecer() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Oferecer-se para doar este item"
          style={({ pressed }) => [styles.doar, pressed && styles.pressed]}
          onPress={() => props.onReservar(props.need)}
        >
          <Ionicons name="hand-left-outline" size={14} color={colors.primary} />
          <Text style={styles.doarTexto}>Vou doar</Text>
        </Pressable>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },

  checkboxDone: {
    backgroundColor: colors.primary,
  },

  content: {
    flex: 1,
    marginHorizontal: 12,
  },

  linhaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    flex: 1,
    fontSize: 16,
    color: colors.textMain,
  },

  titleDone: {
    color: '#9A8F7E',
    textDecorationLine: 'line-through',
  },

  titleSemNome: {
    color: '#9A8F7E',
  },

  urgente: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.supportPink,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },

  urgenteTexto: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 3,
  },

  progresso: {
    marginTop: 5,
  },

  falta: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
  },

  faltaCompleta: {
    color: colors.supportGreen,
  },

  faltaFeita: {
    color: '#9A8F7E',
    fontWeight: 'normal',
  },

  barraFundo: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0E9DC',
    overflow: 'hidden',
    marginTop: 5,
  },

  barraPrometida: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD9AE',
  },

  barraRecebida: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.supportGreen,
  },

  abrigo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },

  abrigoSolto: {
    backgroundColor: colors.backgroundLight,
  },

  abrigoNome: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 4,
  },

  abrigoNomeSolto: {
    color: '#9A8F7E',
    fontWeight: 'normal',
  },

  contribuicao: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  contribuicaoTexto: {
    flex: 1,
    fontSize: 12,
    color: '#9A8F7E',
    marginLeft: 5,
  },

  contribuicaoEntregue: {
    color: colors.supportGreen,
    fontWeight: 'bold',
  },

  recebi: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.supportGreen,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginLeft: 6,
  },

  recebiTexto: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.supportGreen,
  },

  desistir: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 4,
  },

  deleteButton: {
    padding: 6,
  },

  doar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  doarTexto: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
    marginLeft: 4,
  },

  pressed: {
    opacity: 0.5,
  },
});
