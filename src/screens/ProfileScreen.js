import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { carregarConta } from '../services/auth';
import { colors } from '../theme/colors';

export default function ProfileScreen() {

  const [conta, setConta] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarConta();
  }, []);

  async function buscarConta() {
    try {
      const contaSalva = await carregarConta();

      setConta(contaSalva);
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível ler a conta salva neste aparelho.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // A primeira letra do nome serve de avatar: é o que temos sem foto de
  // perfil, e evita inventar uma imagem que não existe.
  function primeiraLetra(nome) {
    return nome.trim().charAt(0).toUpperCase();
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centralizado}>
          <Text style={styles.nota}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <LinearGradient
        colors={[colors.primary, colors.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitulo}>Perfil</Text>

        {conta && (
          <View style={styles.identificacao}>
            <View style={styles.avatar}>
              <Text style={styles.textoAvatar}>
                {primeiraLetra(conta.nome)}
              </Text>
            </View>

            <View style={styles.identificacaoTexto}>
              <Text style={styles.nome}>{conta.nome}</Text>
              <Text style={styles.email}>{conta.email}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.corpo}
        contentContainerStyle={styles.corpoConteudo}
        showsVerticalScrollIndicator={false}
      >

        {!conta && (
          <View style={styles.cartao}>
            <Text style={styles.textoSemConta}>
              Nenhuma conta gravada neste aparelho.
            </Text>
          </View>
        )}

        <Text style={styles.aviso}>
          Os dados da sua conta ficam apenas neste aparelho. O InfoAbrigo
          ainda não tem servidor.
        </Text>

      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTitulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  identificacao: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textoAvatar: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  identificacaoTexto: {
    flex: 1,
    marginLeft: 14,
  },

  nome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  email: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },

  corpo: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  corpoConteudo: {
    padding: 16,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },

  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  textoSemConta: {
    fontSize: 15,
    color: '#9A8F7E',
  },

  nota: {
    fontSize: 15,
    color: colors.textMain,
  },

  aviso: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 20,
  },
});
