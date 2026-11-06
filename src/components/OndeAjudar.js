import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { apiDisponivel, buscarRecomendacoes } from '../services/servicosApi';
import { colors } from '../theme/colors';

function textoDoQueFalta(item) {
  if (!item.faltam) {
    return item.titulo;
  }

  const unidade = item.unidade ? ' ' + item.unidade : '';

  return item.titulo + ': faltam ' + Number(item.faltam) + unidade;
}

// "Onde sua ajuda vale mais". Quem calcula é a API, porque ela enxerga todos os
// abrigos de uma vez. Se ela estiver fora do ar, o bloco simplesmente não aparece:
// recomendação é um extra, e a tela continua inteira sem ela.
export default function OndeAjudar(props) {
  const [lista, setLista] = useState([]);

  const latitude = props.localizacao ? props.localizacao.latitude : null;
  const longitude = props.localizacao ? props.localizacao.longitude : null;

  useEffect(() => {
    if (!apiDisponivel()) {
      return undefined;
    }

    let ativo = true;

    buscarRecomendacoes(props.localizacao)
      .then((recebidas) => {
        if (ativo) {
          setLista(Array.isArray(recebidas) ? recebidas.slice(0, 3) : []);
        }
      })
      .catch((error) => console.log('Recomendações indisponíveis:', error.message));

    return () => {
      ativo = false;
    };
  }, [latitude, longitude, props.atualizarEm]);

  if (lista.length === 0) {
    return null;
  }

  return (
    <View style={styles.area}>
      <Text style={styles.titulo}>Onde sua ajuda vale mais</Text>

      {lista.map((item) => (
        <Pressable
          key={item.necessidadeId}
          accessibilityRole="button"
          style={({ pressed }) => [styles.item, pressed && styles.pressionado]}
          onPress={() => props.aoEscolher(item)}
        >
          <View style={[styles.icone, item.urgente && styles.iconeUrgente]}>
            <Ionicons
              name={item.urgente ? 'alert-circle' : 'heart'}
              size={18}
              color={item.urgente ? colors.supportPink : colors.primary}
            />
          </View>

          <View style={styles.texto}>
            <Text style={styles.nome} numberOfLines={1}>
              {textoDoQueFalta(item)}
            </Text>

            <Text style={styles.abrigo} numberOfLines={1}>
              {item.abrigoNome}
            </Text>

            {item.motivo ? (
              <Text style={styles.motivo} numberOfLines={1}>
                {item.motivo}
              </Text>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={18} color="#9A8F7E" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    marginBottom: 16,
  },

  titulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 10,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  pressionado: {
    opacity: 0.6,
  },

  icone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },

  iconeUrgente: {
    backgroundColor: '#F9E9EF',
  },

  texto: {
    flex: 1,
  },

  nome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  abrigo: {
    fontSize: 13,
    color: colors.textMain,
    marginTop: 2,
  },

  motivo: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 2,
  },
});
