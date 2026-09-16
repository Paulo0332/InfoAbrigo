import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BiometricButton from '../components/BiometricButton';
import { colors } from '../theme/colors';

const ABRIGO = 'Lar Esperança';

const VALORES = [20, 50, 100];

export default function DonateScreen(props) {

  const [valor, setValor] = useState(50);
  const [confirmada, setConfirmada] = useState(false);
  const [temBiometria, setTemBiometria] = useState(true);

  // O BiometricButton avisa por aqui que a identidade foi confirmada.
  // Só depois disso a doação é dada como registrada.
  function registrarDoacao() {
    setConfirmada(true);
  }

  function voltar() {
    props.navigation.goBack();
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
            onPress={voltar}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitulo}>Fazer uma doação</Text>

          <View style={styles.voltar} />
        </View>
      </LinearGradient>

      {confirmada ? (
        <View style={styles.sucesso}>
          <View style={styles.selo}>
            <Ionicons name="checkmark" size={44} color="#FFFFFF" />
          </View>

          <Text style={styles.tituloSucesso}>Doação confirmada</Text>

          <Text style={styles.textoSucesso}>
            R$ {valor},00 para o {ABRIGO}.{'\n'}
            Obrigado por ajudar!
          </Text>

          <Pressable
            style={({ pressed }) => [styles.botaoVoltar, pressed && styles.pressionado]}
            onPress={voltar}
          >
            <Text style={styles.textoBotaoVoltar}>Voltar para as doações</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.corpo}
          contentContainerStyle={styles.corpoConteudo}
          showsVerticalScrollIndicator={false}
        >

          <View style={styles.cartao}>
            <Text style={styles.rotulo}>Abrigo</Text>
            <Text style={styles.valorRotulo}>{ABRIGO}</Text>
          </View>

          <Text style={styles.secao}>Escolha o valor</Text>

          <View style={styles.valores}>
            {VALORES.map((opcao) => (
              <Pressable
                key={opcao}
                style={[styles.opcao, valor === opcao && styles.opcaoAtiva]}
                onPress={() => setValor(opcao)}
              >
                <Text
                  style={[
                    styles.textoOpcao,
                    valor === opcao && styles.textoOpcaoAtiva,
                  ]}
                >
                  R$ {opcao}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.resumo}>
            <Text style={styles.rotulo}>Você vai doar</Text>
            <Text style={styles.total}>R$ {valor},00</Text>
          </View>

          {/* A mensagem vai para a janela do sistema, então a pessoa lê o
              valor exato na hora de encostar o dedo. É o mesmo componente
              da tela de login, só com outro rótulo e outra mensagem. */}
          <BiometricButton
            rotulo="Confirmar com biometria"
            mensagem={'Confirme a doação de R$ ' + valor + ',00'}
            onSuccess={registrarDoacao}
            onVerificado={setTemBiometria}
          />

          {/* Este botão só aparece quando o aparelho não tem biometria.
              Quem tem sensor confirma com o dedo; quem não tem, confirma
              aqui. O abrigo não perde a doação por causa do celular. */}
          {!temBiometria && (
            <Pressable
              style={({ pressed }) => [styles.botaoSimples, pressed && styles.pressionado]}
              onPress={registrarDoacao}
            >
              <Text style={styles.textoBotaoSimples}>Confirmar doação</Text>
            </Pressable>
          )}

          <Text style={styles.aviso}>
            Demonstração acadêmica: nenhum pagamento é processado de verdade.
          </Text>

        </ScrollView>
      )}

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
    padding: 16,
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

  rotulo: {
    fontSize: 12,
    color: '#9A8F7E',
  },

  valorRotulo: {
    fontSize: 16,
    color: colors.textMain,
    marginTop: 4,
  },

  secao: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 20,
    marginBottom: 10,
  },

  valores: {
    flexDirection: 'row',
  },

  opcao: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    marginRight: 8,
  },

  opcaoAtiva: {
    borderColor: colors.primary,
    backgroundColor: '#FFF3E6',
  },

  textoOpcao: {
    fontSize: 16,
    color: colors.textMain,
  },

  textoOpcaoAtiva: {
    color: colors.primary,
    fontWeight: 'bold',
  },

  resumo: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },

  total: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 4,
  },

  botaoSimples: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  textoBotaoSimples: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  aviso: {
    fontSize: 11,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 18,
  },

  sucesso: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.backgroundLight,
  },

  selo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.supportGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tituloSucesso: {
    fontSize: 21,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 16,
  },

  textoSucesso: {
    fontSize: 15,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },

  botaoVoltar: {
    height: 52,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },

  textoBotaoVoltar: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  pressionado: {
    opacity: 0.5,
  },
});
