import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import * as Location from 'expo-location';
import { carregarConta } from '../services/auth';
import {
  buscarCep,
  buscarCoordenadas,
  cepValido,
  formatarCep,
  montarEndereco,
} from '../services/endereco';
import {
  apagarAbrigo,
  atualizarAbrigo,
  cadastrarAbrigo,
} from '../services/shelters';
import { colors } from '../theme/colors';

export default function RegisterShelterScreen(props) {

  // A mesma tela cadastra e edita. Recebendo um abrigo por parâmetro, ela
  // abre preenchida e salva por cima em vez de criar outro.
  const parametros = props.route.params || {};
  const abrigoEditado = parametros.abrigo || null;

  const [nome, setNome] = useState(abrigoEditado ? abrigoEditado.nome : '');
  const [criancas, setCriancas] = useState(
    abrigoEditado ? String(abrigoEditado.criancas) : ''
  );
  const [contato, setContato] = useState(
    abrigoEditado ? abrigoEditado.contato : ''
  );
  const [localizacao, setLocalizacao] = useState(
    abrigoEditado
      ? { latitude: abrigoEditado.latitude, longitude: abrigoEditado.longitude }
      : null
  );
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // O endereço é guardado campo a campo, e não como um texto só: assim dá
  // para corrigir o que o CEP trouxe errado, preencher à mão quando o CEP
  // é genérico e não devolve rua, e ainda montar a busca da coordenada.
  const detalhes = (abrigoEditado && abrigoEditado.enderecoDados) || {};

  const [cep, setCep] = useState(detalhes.cep || '');
  const [logradouro, setLogradouro] = useState(detalhes.logradouro || '');
  const [numero, setNumero] = useState(detalhes.numero || '');
  const [complemento, setComplemento] = useState(detalhes.complemento || '');
  const [bairro, setBairro] = useState(detalhes.bairro || '');
  const [cidade, setCidade] = useState(detalhes.cidade || '');
  const [uf, setUf] = useState(detalhes.uf || '');
  const [referencia, setReferencia] = useState(detalhes.referencia || '');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [localizando, setLocalizando] = useState(false);

  // A localização do abrigo é a do aparelho no momento do cadastro. É o
  // mesmo par de chamadas do mapa: pede a permissão, depois a posição.
  async function usarLocalizacaoAtual() {
    setBuscando(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permissão negada',
          'Sem a localização não é possível marcar o abrigo no mapa.'
        );

        return;
      }

      const posicao = await Location.getCurrentPositionAsync({});

      setLocalizacao(posicao.coords);
    } catch (error) {
      console.log('Erro ao obter a localização:', error);

      Alert.alert(
        'Erro',
        'Não foi possível obter a localização.'
      );
    } finally {
      setBuscando(false);
    }
  }

  function digitarCep(texto) {
    setCep(formatarCep(texto));
  }

  function enderecoAtual() {
    return {
      cep: cep,
      logradouro: logradouro.trim(),
      numero: numero.trim(),
      complemento: complemento.trim(),
      bairro: bairro.trim(),
      cidade: cidade.trim(),
      uf: uf.trim().toUpperCase(),
      referencia: referencia.trim(),
    };
  }

  // Alternativa ao GPS: quem cadastra de casa ou do escritório informa o
  // CEP, e a consulta devolve o endereço junto com a coordenada.
  async function procurarPeloCep() {
    if (!cepValido(cep)) {
      Alert.alert('CEP inválido', 'O CEP precisa ter oito dígitos.');

      return;
    }

    setBuscandoCep(true);

    try {
      const dados = await buscarCep(cep);

      if (dados.situacao === 'inexistente') {
        Alert.alert('CEP não encontrado', 'Confira o número digitado.');

        return;
      }

      if (dados.situacao === 'indisponivel') {
        Alert.alert(
          'Sem conexão',
          'Não foi possível consultar o CEP agora. Você ainda pode usar a localização atual.'
        );

        return;
      }

      // O CEP preenche os campos; daqui em diante eles são editáveis.
      setLogradouro(dados.logradouro);
      setBairro(dados.bairro);
      setCidade(dados.cidade);
      setUf(dados.uf);

      if (dados.situacao === 'sem-coordenada') {
        Alert.alert(
          'Endereço preenchido',
          'Este CEP não tem coordenada cadastrada. Complete o endereço e toque em "Localizar no mapa".'
        );

        return;
      }

      setLocalizacao({
        latitude: dados.latitude,
        longitude: dados.longitude,
      });
    } finally {
      setBuscandoCep(false);
    }
  }

  // Procura a coordenada do endereço completo, com número. É mais preciso
  // que a do CEP, que aponta para o meio da via.
  async function localizarNoMapa() {
    const dados = enderecoAtual();

    if (!dados.logradouro || !dados.cidade) {
      Alert.alert(
        'Atenção',
        'Preencha ao menos a rua e a cidade para localizar no mapa.'
      );

      return;
    }

    setLocalizando(true);

    try {
      const ponto = await buscarCoordenadas(dados);

      if (ponto.situacao === 'encontrado') {
        setLocalizacao({
          latitude: ponto.latitude,
          longitude: ponto.longitude,
        });

        Alert.alert('Pronto', 'Endereço localizado no mapa.');

        return;
      }

      if (ponto.situacao === 'nao-encontrado') {
        Alert.alert(
          'Endereço não encontrado',
          'Confira a rua e a cidade. Se o endereço for novo, use a localização atual estando no abrigo.'
        );

        return;
      }

      Alert.alert(
        'Sem conexão',
        'Não foi possível localizar agora. Tente de novo ou use a localização atual.'
      );
    } finally {
      setLocalizando(false);
    }
  }

  // Mesma validação do exemplo do professor: trim nas pontas, Alert quando
  // falta campo e return para interromper antes de gravar.
  async function salvar() {
    const nomeLimpo = nome.trim();
    const quantidade = parseInt(criancas, 10);

    if (!nomeLimpo) {
      Alert.alert('Atenção', 'Digite o nome do abrigo.');

      return;
    }

    if (!criancas.trim() || isNaN(quantidade) || quantidade < 0) {
      Alert.alert('Atenção', 'Digite quantas crianças o abrigo acolhe.');

      return;
    }

    if (!localizacao) {
      Alert.alert(
        'Atenção',
        'Toque em "Usar a localização atual" para marcar o abrigo no mapa.'
      );

      return;
    }

    setSalvando(true);

    try {
      if (abrigoEditado) {
        await atualizarAbrigo({
          ...abrigoEditado,
          nome: nomeLimpo,
          criancas: quantidade,
          contato: contato.trim(),
          endereco: montarEndereco(enderecoAtual()),
          enderecoDados: enderecoAtual(),
          latitude: localizacao.latitude,
          longitude: localizacao.longitude,
        });
      } else {
        // O dono é a conta que cadastrou. É por ele que a tela do mapa
        // decide quem pode editar e excluir aquele abrigo.
        const conta = await carregarConta();

        await cadastrarAbrigo({
          id: Date.now().toString(),
          nome: nomeLimpo,
          criancas: quantidade,
          contato: contato.trim(),
          endereco: montarEndereco(enderecoAtual()),
          enderecoDados: enderecoAtual(),
          latitude: localizacao.latitude,
          longitude: localizacao.longitude,
          dono: conta ? conta.email : '',
          cadastradoEm: new Date().toISOString(),
        });
      }

      Keyboard.dismiss();

      props.navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o abrigo.');
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert(
      'Excluir abrigo',
      'O abrigo deixa de aparecer no mapa. Esta ação não pode ser desfeita.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: excluir,
        },
      ]
    );
  }

  async function excluir() {
    try {
      await apagarAbrigo(abrigoEditado.id);

      props.navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível excluir o abrigo.');
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

          <Text style={styles.headerTitulo}>
            {abrigoEditado ? 'Editar abrigo' : 'Cadastrar abrigo'}
          </Text>

          <View style={styles.voltar} />
        </View>
      </LinearGradient>

      {/* Sem isto o teclado sobe por cima do campo que está sendo
          digitado. No iOS o KeyboardAvoidingView empurra o conteúdo; no
          Android o próprio sistema redimensiona a janela, e a folga no fim
          da rolagem garante espaço para o campo subir. */}
      <KeyboardAvoidingView
        style={styles.corpo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        style={styles.corpo}
        contentContainerStyle={styles.corpoConteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {!abrigoEditado && (
          <Text style={styles.explicacao}>
            O abrigo aparece no mapa para quem quer doar. Cadastre apenas
            instituições que você administra ou que autorizaram aparecer.
          </Text>
        )}

        <Text style={styles.rotulo}>Nome do abrigo</Text>
        <TextInput
          style={styles.input}
          placeholder="Como o abrigo é conhecido"
          placeholderTextColor="#9A8F7E"
          value={nome}
          onChangeText={setNome}
          maxLength={60}
        />

        <Text style={styles.rotulo}>Crianças acolhidas</Text>
        <TextInput
          style={styles.input}
          placeholder="Quantas crianças moram no abrigo"
          placeholderTextColor="#9A8F7E"
          value={criancas}
          onChangeText={setCriancas}
          keyboardType="number-pad"
          maxLength={4}
        />

        <Text style={styles.rotulo}>Contato (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Telefone ou e-mail para doações"
          placeholderTextColor="#9A8F7E"
          value={contato}
          onChangeText={setContato}
          maxLength={60}
        />

        <Text style={styles.rotulo}>Endereço</Text>

        <Text style={styles.ajuda}>
          Digite o CEP para preencher automaticamente. Todos os campos podem
          ser corrigidos depois.
        </Text>

        <View style={styles.linhaCep}>
          <TextInput
            style={[styles.input, styles.inputCep]}
            placeholder="00000-000"
            placeholderTextColor="#9A8F7E"
            value={cep}
            onChangeText={digitarCep}
            keyboardType="number-pad"
            maxLength={9}
          />

          <Pressable
            style={({ pressed }) => [styles.botaoBuscar, pressed && styles.pressionado]}
            onPress={procurarPeloCep}
            disabled={buscandoCep}
          >
            <Ionicons
              name={buscandoCep ? 'ellipsis-horizontal' : 'search'}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <Text style={styles.rotulo}>Rua</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome da rua ou avenida"
          placeholderTextColor="#9A8F7E"
          value={logradouro}
          onChangeText={setLogradouro}
          maxLength={80}
        />

        <View style={styles.linha}>
          <View style={styles.colunaMenor}>
            <Text style={styles.rotulo}>Número</Text>
            <TextInput
              style={styles.input}
              placeholder="123"
              placeholderTextColor="#9A8F7E"
              value={numero}
              onChangeText={setNumero}
              keyboardType="number-pad"
              maxLength={8}
            />
          </View>

          <View style={styles.colunaMaior}>
            <Text style={styles.rotulo}>Complemento</Text>
            <TextInput
              style={styles.input}
              placeholder="Bloco, casa, fundos"
              placeholderTextColor="#9A8F7E"
              value={complemento}
              onChangeText={setComplemento}
              maxLength={40}
            />
          </View>
        </View>

        <Text style={styles.rotulo}>Bairro</Text>
        <TextInput
          style={styles.input}
          placeholder="Bairro"
          placeholderTextColor="#9A8F7E"
          value={bairro}
          onChangeText={setBairro}
          maxLength={60}
        />

        <View style={styles.linha}>
          <View style={styles.colunaMaior}>
            <Text style={styles.rotulo}>Cidade</Text>
            <TextInput
              style={styles.input}
              placeholder="Cidade"
              placeholderTextColor="#9A8F7E"
              value={cidade}
              onChangeText={setCidade}
              maxLength={60}
            />
          </View>

          <View style={styles.colunaMenor}>
            <Text style={styles.rotulo}>UF</Text>
            <TextInput
              style={styles.input}
              placeholder="SP"
              placeholderTextColor="#9A8F7E"
              value={uf}
              onChangeText={setUf}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>

        <Text style={styles.rotulo}>Ponto de referência (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Perto do quê? Ajuda quem vai levar a doação"
          placeholderTextColor="#9A8F7E"
          value={referencia}
          onChangeText={setReferencia}
          maxLength={80}
        />

        <Text style={styles.rotulo}>Ponto no mapa</Text>

        <Pressable
          style={({ pressed }) => [styles.botaoLocal, pressed && styles.pressionado]}
          onPress={localizarNoMapa}
          disabled={localizando}
        >
          <Ionicons name="navigate" size={20} color={colors.primary} />

          <Text style={styles.textoBotaoLocal}>
            {localizando ? 'Localizando...' : 'Localizar pelo endereço'}
          </Text>
        </Pressable>

        <Text style={styles.ou}>ou</Text>

        <Pressable
          style={({ pressed }) => [styles.botaoLocal, pressed && styles.pressionado]}
          onPress={usarLocalizacaoAtual}
          disabled={buscando}
        >
          <Ionicons name="location" size={20} color={colors.primary} />

          <Text style={styles.textoBotaoLocal}>
            {buscando ? 'Buscando...' : 'Usar a localização atual'}
          </Text>
        </Pressable>

        {localizacao && (
          <View style={styles.cartaoLocal}>
            <Ionicons name="checkmark-circle" size={20} color={colors.supportGreen} />

            <Text style={styles.textoLocal}>
              Marcado em {localizacao.latitude.toFixed(5)}, {localizacao.longitude.toFixed(5)}
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}
          onPress={salvar}
          disabled={salvando}
        >
          <Text style={styles.textoBotao}>
            {salvando
              ? 'Salvando...'
              : abrigoEditado
              ? 'Salvar alterações'
              : 'Cadastrar abrigo'}
          </Text>
        </Pressable>

        {abrigoEditado && (
          <Pressable
            style={({ pressed }) => [styles.botaoExcluir, pressed && styles.pressionado]}
            onPress={confirmarExclusao}
          >
            <Ionicons name="trash-outline" size={18} color={colors.supportPink} />
            <Text style={styles.textoExcluir}>Excluir abrigo</Text>
          </Pressable>
        )}

        <Text style={styles.aviso}>
          O cadastro fica apenas neste aparelho. Ainda não existe servidor
          para compartilhar entre usuários.
        </Text>

      </ScrollView>
      </KeyboardAvoidingView>

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
    paddingBottom: 140,
  },

  explicacao: {
    fontSize: 13,
    color: '#9A8F7E',
    lineHeight: 19,
    marginBottom: 8,
  },

  rotulo: {
    fontSize: 13,
    color: colors.textMain,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 16,
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

  botaoLocal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  textoBotaoLocal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 8,
  },

  ajuda: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginBottom: 8,
  },

  linhaCep: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  inputCep: {
    flex: 1,
  },

  linha: {
    flexDirection: 'row',
  },

  colunaMenor: {
    flex: 1,
  },

  colunaMaior: {
    flex: 2,
    marginLeft: 10,
  },

  botaoBuscar: {
    width: 52,
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  ou: {
    fontSize: 12,
    color: '#9A8F7E',
    textAlign: 'center',
    marginVertical: 10,
  },

  cartaoLocal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },

  textoLocal: {
    fontSize: 14,
    color: colors.textMain,
    marginLeft: 8,
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

  botaoExcluir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginTop: 12,
  },

  textoExcluir: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.supportPink,
    marginLeft: 8,
  },

  aviso: {
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
