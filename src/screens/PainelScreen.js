import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { MOTIVOS_DE_DENUNCIA, buscarDenuncias, buscarPlanilha, buscarRelatorio } from '../services/servicosApi';
import { colors } from '../theme/colors';

function nomeDoMotivo(id) {
  const motivo = MOTIVOS_DE_DENUNCIA.find((item) => item.id === id);

  return motivo ? motivo.nome : id;
}

function quantidade(valor) {
  return String(Number(valor));
}

// O painel do gestor: o que o abrigo pediu, o que foi prometido e o que de fato
// chegou. Serve para prestar contas, e por isso também sai como planilha.
export default function PainelScreen(props) {
  const abrigo = props.route.params.abrigo;

  const [relatorio, setRelatorio] = useState(null);
  const [denuncias, setDenuncias] = useState([]);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setErro(false);

    try {
      const [dados, recebidas] = await Promise.all([
        buscarRelatorio(abrigo.id),
        buscarDenuncias(abrigo.id),
      ]);

      setRelatorio(dados);
      setDenuncias(recebidas);
    } catch (error) {
      console.log('Erro ao buscar o relatório:', error.message);
      setErro(true);
    }
  }

  async function compartilhar() {
    try {
      const planilha = await buscarPlanilha(abrigo.id);

      await Share.share({ title: 'Relatório de ' + abrigo.nome, message: planilha });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível gerar a planilha.');
    }
  }

  function numero(valor, rotulo) {
    return (
      <View style={styles.numero}>
        <Text style={styles.numeroValor}>{quantidade(valor)}</Text>
        <Text style={styles.numeroRotulo}>{rotulo}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <View style={styles.topo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => pressed && styles.pressionado}
          onPress={() => props.navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.titulo} numberOfLines={1}>
          {abrigo.nome}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.conteudo}>
        {erro ? (
          <View style={styles.cartao}>
            <Text style={styles.texto}>
              Não foi possível falar com o servidor agora. Confira a sua internet.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
              onPress={carregar}
            >
              <Text style={styles.textoBotao}>Tentar de novo</Text>
            </Pressable>
          </View>
        ) : relatorio == null ? (
          <Text style={styles.texto}>Carregando...</Text>
        ) : (
          <View>
            <View style={styles.numeros}>
              {numero(relatorio.necessidades, 'Necessidades')}
              {numero(relatorio.atendidas, 'Atendidas')}
              {numero(relatorio.doadores, 'Doadores')}
            </View>

            <View style={styles.numeros}>
              {numero(relatorio.prometido, 'Itens prometidos')}
              {numero(relatorio.recebido, 'Itens recebidos')}
            </View>

            {relatorio.itens.map((item) => (
              <View key={item.titulo} style={styles.cartao}>
                <Text style={styles.itemTitulo}>{item.titulo}</Text>

                <Text style={styles.texto}>
                  {quantidade(item.recebido)} recebidos e {quantidade(item.prometido)} prometidos
                  {item.meta > 0 ? ', de ' + quantidade(item.meta) : ''}
                  {item.unidade ? ' ' + item.unidade : ''}
                </Text>
              </View>
            ))}

            {relatorio.itens.length > 0 && (
              <Pressable
                style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
                onPress={compartilhar}
              >
                <Text style={styles.textoBotao}>Compartilhar a planilha</Text>
              </Pressable>
            )}

            {denuncias.length > 0 && (
              <View style={styles.denuncias}>
                <Text style={styles.subtitulo}>Denúncias recebidas</Text>

                {denuncias.map((denuncia) => (
                  <View key={denuncia.em + denuncia.motivo} style={styles.cartao}>
                    <Text style={styles.itemTitulo}>{nomeDoMotivo(denuncia.motivo)}</Text>

                    {denuncia.detalhe ? (
                      <Text style={styles.texto}>{denuncia.detalhe}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },

  titulo: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  conteudo: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: colors.backgroundLight,
  },

  numeros: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },

  numero: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  numeroValor: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
  },

  numeroRotulo: {
    fontSize: 12,
    color: colors.textMain,
    textAlign: 'center',
  },

  cartao: {
    padding: 14,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  itemTitulo: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 2,
  },

  texto: {
    fontSize: 14,
    color: colors.textMain,
  },

  subtitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  denuncias: {
    marginTop: 20,
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

  pressionado: {
    opacity: 0.6,
  },
});
