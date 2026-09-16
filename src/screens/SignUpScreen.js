import { useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { salvarConta } from '../services/auth';
import { colors } from '../theme/colors';

export default function SignUpScreen(props) {

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Mesma validação do adicionarTarefa() do exemplo do professor: limpa
  // os espaços das pontas e, se sobrar vazio, avisa e interrompe.
  async function criarConta() {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();

    if (!nomeLimpo || !emailLimpo || !senha) {
      Alert.alert(
        'Atenção',
        'Preencha o nome, o e-mail e a senha.'
      );

      return;
    }

    if (!emailLimpo.includes('@')) {
      Alert.alert(
        'Atenção',
        'Digite um e-mail válido.'
      );

      return;
    }

    if (senha.length < 6) {
      Alert.alert(
        'Atenção',
        'A senha precisa ter pelo menos 6 caracteres.'
      );

      return;
    }

    const conta = {
      nome: nomeLimpo,
      email: emailLimpo,
      senha: senha,
    };

    try {
      await salvarConta(conta);

      Keyboard.dismiss();

      props.navigation.replace('Tabs');
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível criar a conta.'
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>

      <LinearGradient
        colors={[colors.primary, colors.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopo}>
          <Pressable
            style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}
            onPress={() => props.navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitulo}>Criar conta</Text>

          <View style={styles.voltar} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.corpo}
        contentContainerStyle={styles.corpoConteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        <Text style={styles.rotulo}>Nome</Text>
        <TextInput
          style={styles.input}
          placeholder="Como podemos te chamar"
          placeholderTextColor="#9A8F7E"
          value={nome}
          onChangeText={setNome}
          maxLength={60}
        />

        <Text style={styles.rotulo}>E-mail</Text>
        <TextInput
          style={styles.input}
          placeholder="voce@email.com"
          placeholderTextColor="#9A8F7E"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          maxLength={80}
        />

        <Text style={styles.rotulo}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Pelo menos 6 caracteres"
          placeholderTextColor="#9A8F7E"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          maxLength={40}
        />

        <Pressable
          style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
          onPress={criarConta}
        >
          <Text style={styles.textoBotao}>Criar conta</Text>
        </Pressable>

        <Text style={styles.nota}>
          A conta fica salva apenas neste aparelho. Ainda não existe servidor:
          desinstalar o aplicativo apaga a conta.
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
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  voltar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  corpo: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  corpoConteudo: {
    padding: 20,
  },

  rotulo: {
    fontSize: 13,
    color: colors.textMain,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 14,
  },

  input: {
    height: 52,
    color: colors.textMain,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 16,
    fontSize: 16,
  },

  botao: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },

  textoBotao: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  nota: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 16,
  },

  pressionado: {
    opacity: 0.6,
  },
});
