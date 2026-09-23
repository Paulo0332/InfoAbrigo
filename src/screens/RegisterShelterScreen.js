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
  celularValido,
  contatosDoAbrigo,
  emailValido,
  fixoValido,
  formatarInstagram,
  formatarTelefone,
  resumirContatos,
} from '../services/contato';
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

// De onde veio o ponto marcado no mapa. A pessoa precisa saber: o ponto
// do CEP costuma cair no meio da via, e às vezes no centro da cidade.
const TEXTO_DA_ORIGEM = {
  endereco: 'Ponto do endereço digitado.',
  cep: 'Ponto aproximado, vindo do CEP. Confira se caiu no lugar certo.',
  gps: 'Ponto do aparelho, onde você está agora.',
};

export default function RegisterShelterScreen(props) {

  // A mesma tela cadastra e edita. Recebendo um abrigo por parâmetro, ela
  // abre preenchida e salva por cima em vez de criar outro.
  const parametros = props.route.params || {};
  const abrigoEditado = parametros.abrigo || null;

  const [nome, setNome] = useState(abrigoEditado ? abrigoEditado.nome : '');
  const [criancas, setCriancas] = useState(
    abrigoEditado ? String(abrigoEditado.criancas) : ''
  );
  // Um contato só não dava conta: quem doa um móvel liga, quem pergunta
  // do horário manda mensagem, a empresa escreve e-mail e quem quer
  // conhecer o trabalho procura o Instagram. O contatosDoAbrigo ainda lê
  // os abrigos antigos, que guardavam tudo num campo de texto livre.
  const contatos = contatosDoAbrigo(abrigoEditado);

  const [celular, setCelular] = useState(contatos.celular);
  const [fixo, setFixo] = useState(contatos.fixo);
  const [email, setEmail] = useState(contatos.email);
  const [instagram, setInstagram] = useState(contatos.instagram);
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
  const [origemPonto, setOrigemPonto] = useState(abrigoEditado ? 'endereco' : null);

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
      setOrigemPonto('gps');
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

  // A máscara roda a cada tecla e corta no décimo primeiro dígito, que é
  // o tamanho do maior telefone brasileiro. Antes dava para digitar um
  // número de quinze dígitos e salvar assim.
  function digitarCelular(texto) {
    setCelular(formatarTelefone(texto));
  }

  function digitarFixo(texto) {
    setFixo(formatarTelefone(texto));
  }

  function contatosAtuais() {
    return {
      celular: celular.trim(),
      fixo: fixo.trim(),
      email: email.trim(),
      instagram: formatarInstagram(instagram),
    };
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

      // A coordenada que vem junto com o CEP é grosseira: às vezes ela
      // aponta para o meio da via, às vezes para o centro da cidade
      // inteira. Tendo o nome da rua em mãos, vale perguntar ao
      // geocodificador, que responde a via certa — e só aceitamos a
      // resposta quando o nome dela bate com o que o CEP trouxe.
      const refinado = await buscarCoordenadas({
        logradouro: dados.logradouro,
        numero: numero.trim(),
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
      });

      if (refinado.situacao === 'encontrado' && refinado.confere) {
        setLocalizacao({
          latitude: refinado.latitude,
          longitude: refinado.longitude,
        });

        setOrigemPonto('endereco');

        return;
      }

      if (dados.situacao === 'sem-coordenada') {
        Alert.alert(
          'Endereço preenchido',
          'Este CEP não tem ponto no mapa. Complete o número e toque em "Localizar pelo endereço".'
        );

        return;
      }

      setLocalizacao({
        latitude: dados.latitude,
        longitude: dados.longitude,
      });

      setOrigemPonto('cep');
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
        confirmarPonto(ponto);

        return;
      }

      if (ponto.situacao === 'nao-encontrado') {
        Alert.alert(
          'Endereço não encontrado',
          'Confira a rua, o número e a cidade. Se o endereço for novo demais para o mapa, use a localização atual estando no abrigo.'
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

  // O geocodificador responde o endereço mais parecido que encontrar, e
  // parecido não é igual: pedindo "Rua das Flores, Curitiba" ele devolve
  // "Rua XV de Novembro", que é a mesma via com o nome oficial. Só que
  // ele responde do mesmo jeito quando a rua não existe na cidade, e aí
  // o abrigo ia parar no lugar errado sem ninguém perceber. Por isso o
  // ponto só é marcado depois de a pessoa ler o que foi achado.
  function confirmarPonto(ponto) {
    const titulo = ponto.confere
      ? 'Confira o endereço'
      : 'O mapa achou outra rua';

    const mensagem = ponto.confere
      ? 'O mapa entendeu assim:\n\n' + ponto.descricao
      : 'A rua digitada não bate com a que o mapa encontrou:\n\n' +
        ponto.descricao +
        '\n\nIsso acontece quando a rua mudou de nome, mas também quando ela não existe nessa cidade.';

    Alert.alert(titulo, mensagem, [
      {
        text: 'Corrigir',
        style: 'cancel',
      },
      {
        text: 'Marcar aqui',
        onPress: () => aplicarPonto(ponto),
      },
    ]);
  }

  // O mapa costuma saber o bairro melhor do que quem digita de memória,
  // mas quem manda é quem cadastra: só preenchemos o que ficou em branco.
  function aplicarPonto(ponto) {
    setLocalizacao({
      latitude: ponto.latitude,
      longitude: ponto.longitude,
    });

    setOrigemPonto('endereco');

    if (!bairro && ponto.bairro) {
      setBairro(ponto.bairro);
    }

    if (!cidade && ponto.cidade) {
      setCidade(ponto.cidade);
    }

    if (!uf && ponto.uf) {
      setUf(ponto.uf);
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

    if (celular.trim() && !celularValido(celular)) {
      Alert.alert(
        'Atenção',
        'O celular precisa ter DDD e nove dígitos. Exemplo: (11) 98765-4321.'
      );

      return;
    }

    if (fixo.trim() && !fixoValido(fixo)) {
      Alert.alert(
        'Atenção',
        'O telefone fixo precisa ter DDD e oito dígitos. Exemplo: (11) 3333-4444.'
      );

      return;
    }

    if (email.trim() && !emailValido(email)) {
      Alert.alert('Atenção', 'Confira o e-mail digitado.');

      return;
    }

    if (!localizacao) {
      Alert.alert(
        'Atenção',
        'Marque o abrigo no mapa pelo endereço ou pela localização atual.'
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
          contatos: contatosAtuais(),
          contato: resumirContatos(contatosAtuais()),
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
          contatos: contatosAtuais(),
          contato: resumirContatos(contatosAtuais()),
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

        <Text style={styles.titulo}>Contatos</Text>

        <Text style={styles.ajuda}>
          Quanto mais formas de falar com o abrigo, melhor. Preencha as que
          existirem — nenhuma é obrigatória.
        </Text>

        <Text style={styles.rotulo}>Celular / WhatsApp</Text>
        <TextInput
          style={styles.input}
          placeholder="(11) 98765-4321"
          placeholderTextColor="#9A8F7E"
          value={celular}
          onChangeText={digitarCelular}
          keyboardType="phone-pad"
          maxLength={15}
        />

        <Text style={styles.rotulo}>Telefone fixo</Text>
        <TextInput
          style={styles.input}
          placeholder="(11) 3333-4444"
          placeholderTextColor="#9A8F7E"
          value={fixo}
          onChangeText={digitarFixo}
          keyboardType="phone-pad"
          maxLength={15}
        />

        <Text style={styles.rotulo}>E-mail</Text>
        <TextInput
          style={styles.input}
          placeholder="contato@abrigo.org.br"
          placeholderTextColor="#9A8F7E"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={60}
        />

        <Text style={styles.rotulo}>Instagram</Text>
        <TextInput
          style={styles.input}
          placeholder="@abrigoesperanca"
          placeholderTextColor="#9A8F7E"
          value={instagram}
          onChangeText={setInstagram}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={40}
        />

        <Text style={styles.titulo}>Endereço</Text>

        <Text style={styles.ajuda}>
          Digite o CEP para preencher automaticamente. Todos os campos podem
          ser corrigidos depois.
        </Text>

        <Text style={styles.rotulo}>CEP</Text>

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

            <View style={styles.blocoLocal}>
              <Text style={styles.textoLocal}>
                Marcado em {localizacao.latitude.toFixed(5)}, {localizacao.longitude.toFixed(5)}
              </Text>

              {origemPonto ? (
                <Text style={styles.origemLocal}>
                  {TEXTO_DA_ORIGEM[origemPonto]}
                </Text>
              ) : null}
            </View>
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

  titulo: {
    fontSize: 17,
    color: colors.textMain,
    fontWeight: 'bold',
    marginTop: 26,
    marginBottom: 6,
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

  // A folga entre as colunas fica na linha, e não na coluna: com a margem
  // na coluna maior, a dupla Cidade/UF saía colada de um lado e afastada
  // do outro, porque nessa linha a coluna maior vem primeiro.
  linha: {
    flexDirection: 'row',
    gap: 10,
  },

  colunaMenor: {
    flex: 1,
  },

  colunaMaior: {
    flex: 2,
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

  blocoLocal: {
    flex: 1,
    marginLeft: 8,
  },

  origemLocal: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginTop: 2,
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
