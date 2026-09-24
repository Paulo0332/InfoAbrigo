import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  TIPOS,
  buscarTipo,
  carregarAgenda,
  compromissosDaConta,
  dataDaquiA,
  diaDoMes,
  formatarCampoData,
  formatarCampoHora,
  formatarHora,
  jaPassou,
  mesCurto,
  montarQuando,
  ordenarAgenda,
  quandoAcontece,
  salvarAgendaDaConta,
} from '../services/agenda';
import { carregarConta } from '../services/auth';
import {
  ITEM,
  carregarDoacoes,
  doacoesDaConta,
  estaPendente,
  tipoDaDoacao,
} from '../services/donations';
import { carregarAbrigos } from '../services/shelters';
import { aviso, deuCerto, toqueLeve } from '../services/tato';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';

export default function ScheduleScreen(props) {

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // O SafeAreaView dentro de Modal remede a folga a cada mudança da
  // janela e entra em laço com o teclado aberto. O hook devolve o mesmo
  // valor sem remedir.
  const areaSegura = useSafeAreaInsets();

  const [agenda, setAgenda] = useState([]);
  const [conta, setConta] = useState(null);
  const [abrigos, setAbrigos] = useState([]);
  const [promessas, setPromessas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState('proximos');

  // Formulário do compromisso.
  const [formVisivel, setFormVisivel] = useState(false);
  const [editando, setEditando] = useState(null);
  const [tipo, setTipo] = useState(TIPOS[0].id);
  const [abrigoEscolhido, setAbrigoEscolhido] = useState(null);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [observacao, setObservacao] = useState('');

  // Câmera: ela continua sendo o módulo de registro, só que agora com um
  // lugar que faz sentido — documentar o que aconteceu num compromisso.
  const [cameraVisivel, setCameraVisivel] = useState(false);
  const [registrandoEm, setRegistrandoEm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  const cameraRef = useRef(null);

  useEffect(() => {
    buscarTudo();

    const inscricao = props.navigation.addListener('focus', buscarTudo);

    return inscricao;
  }, []);

  async function buscarTudo() {
    try {
      const contaSalva = await carregarConta();
      const lista = await carregarAgenda();
      const listaAbrigos = await carregarAbrigos();
      const doacoes = await carregarDoacoes();

      setConta(contaSalva);
      setAbrigos(listaAbrigos);
      setAgenda(compromissosDaConta(lista, contaSalva));

      // O que a pessoa prometeu levar e ainda não entregou. A entrega é
      // justamente o tipo de compromisso que ela vem marcar aqui, e ter
      // de redigitar o que já está registrado noutra tela é trabalho à
      // toa — e é onde se erra o abrigo.
      setPromessas(
        doacoesDaConta(doacoes, contaSalva)
          .filter((doacao) => tipoDaDoacao(doacao) === ITEM)
          .filter(estaPendente)
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível ler a sua agenda.');
    } finally {
      setCarregando(false);
    }
  }

  // Toda alteração passa por aqui, para o estado da tela e o disco nunca
  // saírem de sincronia.
  // A tela mostra só os compromissos desta conta. Quem junta com os das
  // outras antes de gravar é o serviço — se a junção morasse aqui, bastava
  // uma tela esquecer para a agenda das outras contas sumir.
  async function gravar(novaLista) {
    setAgenda(novaLista);

    try {
      await salvarAgendaDaConta(novaLista, conta);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a agenda.');
    }
  }

  // Preenche o formulário a partir de uma promessa de doação: o abrigo
  // vem junto, e a observação já diz o que levar.
  function usarPromessa(promessa) {
    const abrigo = abrigos.find((item) => item.nome === promessa.abrigo);

    setTipo('entrega');

    if (abrigo) {
      setAbrigoEscolhido(abrigo.id);
    }

    setObservacao('Levar: ' + promessa.item);
  }

  function abrirNovo() {
    setEditando(null);
    setTipo(TIPOS[0].id);
    setAbrigoEscolhido(abrigos.length === 1 ? abrigos[0].id : null);
    setData(dataDaquiA(1));
    setHora('14:00');
    setObservacao('');
    setFormVisivel(true);
  }

  function abrirEdicao(item) {
    const quando = new Date(item.quando);

    setEditando(item);
    setTipo(item.tipo);
    setAbrigoEscolhido(item.abrigoId);
    setData(
      String(quando.getDate()).padStart(2, '0') + '/' +
      String(quando.getMonth() + 1).padStart(2, '0') + '/' +
      quando.getFullYear()
    );
    setHora(formatarHora(item.quando));
    setObservacao(item.observacao || '');
    setFormVisivel(true);
  }

  function salvarCompromisso() {
    const quando = montarQuando(data, hora);

    if (quando == null) {
      Alert.alert(
        'Data ou hora inválida',
        'Confira o dia, o mês e a hora. A data precisa existir no calendário.'
      );

      return;
    }

    const abrigo = abrigos.find((item) => item.id === abrigoEscolhido) || null;

    const dados = {
      tipo: tipo,
      abrigoId: abrigo ? abrigo.id : null,
      abrigoNome: abrigo ? abrigo.nome : null,
      quando: quando,
      observacao: observacao.trim(),
    };

    deuCerto();
    setFormVisivel(false);

    if (editando) {
      gravar(
        agenda.map((item) =>
          item.id === editando.id ? { ...item, ...dados } : item
        )
      );

      return;
    }

    gravar([
      {
        id: Date.now().toString(),
        ...dados,
        conta: conta ? conta.email : null,
        registro: null,
      },
      ...agenda,
    ]);
  }

  function confirmarExclusao(item) {
    Alert.alert(
      'Excluir compromisso',
      'Ele sai da sua agenda. A foto registrada nele, se houver, sai junto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            aviso();
            gravar(agenda.filter((uma) => uma.id !== item.id));
          },
        },
      ]
    );
  }

  // ------------------------------------------------------------ câmera

  async function abrirCamera(item) {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();

      if (!granted) {
        Alert.alert(
          'Aviso',
          'Você precisa permitir o acesso à câmera para registrar o que aconteceu.'
        );

        return;
      }
    }

    setRegistrandoEm(item);
    setPhoto(item && item.registro ? item.registro.uri : null);
    setTitle(item && item.registro ? item.registro.titulo : '');
    setDescription(item && item.registro ? item.registro.descricao : '');
    setIsCameraReady(false);
    setCameraVisivel(true);
  }

  async function takePicture() {
    if (cameraRef.current && isCameraReady) {
      try {
        const data = await cameraRef.current.takePictureAsync({ quality: 0.8 });

        toqueLeve();
        setPhoto(data.uri);
      } catch (error) {
        console.log('Error capturing photo:', error);

        Alert.alert('Erro', 'Não foi possível capturar a foto.');
      }
    }
  }

  // Voltar para a câmera não é só limpar a foto: a permissão pode ter
  // sido revogada, e o isCameraReady precisa voltar a false para o botão
  // de disparo só liberar quando a câmera estiver de pé outra vez.
  async function refazerFoto() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();

      if (!granted) {
        Alert.alert('Aviso', 'Você precisa permitir o acesso à câmera para trocar a foto.');

        return;
      }
    }

    setPhoto(null);
    setIsCameraReady(false);
  }

  // Tenta guardar na galeria do aparelho, que é o que o módulo pede.
  // Devolve se conseguiu, porque no Expo Go a permissão às vezes não vem
  // e o registro continua valendo dentro do aplicativo.
  async function guardarNaGaleria(uri) {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);

      if (status !== 'granted') {
        return false;
      }

      await MediaLibrary.saveToLibraryAsync(uri);

      return true;
    } catch (error) {
      console.log('Galeria nativa bloqueada ou inacessível no Expo Go:', error);

      return false;
    }
  }

  async function salvarRegistro() {
    if (!title.trim()) {
      Alert.alert('Aviso', 'Dê um título para o registro.');

      return;
    }

    // Só vai para a galeria de novo quando a foto mudou: reeditar só o
    // título não precisa salvar a mesma imagem outra vez.
    const trocouFoto =
      registrandoEm.registro == null || registrandoEm.registro.uri !== photo;

    const naGaleria = trocouFoto
      ? await guardarNaGaleria(photo)
      : registrandoEm.registro.naGaleria;

    const registro = {
      uri: photo,
      titulo: title.trim(),
      descricao: description.trim(),
      naGaleria: naGaleria,
    };

    gravar(
      agenda.map((item) =>
        item.id === registrandoEm.id ? { ...item, registro: registro } : item
      )
    );

    deuCerto();
    fecharCamera();
  }

  function fecharCamera() {
    setCameraVisivel(false);
    setRegistrandoEm(null);
    setPhoto(null);
    setIsCameraReady(false);
    setTitle('');
    setDescription('');
    setFotoAmpliada(null);
  }

  // Mostra a foto inteira por cima de tudo. É uma camada absoluta, e não
  // outro Modal, porque Modal dentro de Modal se comporta mal no Android.
  function fotoEmTelaCheia() {
    if (!fotoAmpliada) {
      return null;
    }

    return (
      <Pressable style={styles.camadaFoto} onPress={() => setFotoAmpliada(null)}>
        <Image
          source={{ uri: fotoAmpliada }}
          style={styles.fotoInteira}
          resizeMode="contain"
        />

        <Text style={styles.dicaFoto}>Toque em qualquer lugar para fechar</Text>
      </Pressable>
    );
  }

  // ------------------------------------------------------------- lista

  function renderizarCompromisso({ item }) {
    const tipoDele = buscarTipo(item.tipo);
    const passado = jaPassou(item.quando);

    return (
      <View style={styles.cartao}>
        <View style={styles.cartaoTopo}>
          <View style={[styles.calendario, passado && styles.calendarioPassado]}>
            <Text style={styles.dia}>{diaDoMes(item.quando)}</Text>
            <Text style={styles.mes}>{mesCurto(item.quando)}</Text>
          </View>

          <View style={styles.cartaoTexto}>
            <View style={styles.linhaTipo}>
              <Ionicons name={tipoDele.icone} size={14} color={colors.primary} />
              <Text style={styles.tipoNome}>{tipoDele.nome}</Text>
            </View>

            <Text style={styles.abrigoNome} numberOfLines={1}>
              {item.abrigoNome || 'Abrigo não informado'}
            </Text>

            <Text style={[styles.quando, passado && styles.quandoPassado]}>
              {quandoAcontece(item.quando)}
            </Text>

            {item.observacao ? (
              <Text style={styles.observacao} numberOfLines={2}>
                {item.observacao}
              </Text>
            ) : null}

          </View>

          {/* O lápis vale para qualquer data. Antes só o compromisso
              futuro podia ser corrigido, e quem anotasse a hora errada
              numa visita que já passou ficava sem conserto. */}
          <View style={styles.acoesCartao}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mudar o compromisso"
              style={({ pressed }) => [styles.acaoCartao, pressed && styles.pressionado]}
              onPress={() => abrirEdicao(item)}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Excluir compromisso"
              style={({ pressed }) => [styles.acaoCartao, pressed && styles.pressionado]}
              onPress={() => confirmarExclusao(item)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.supportPink} />
            </Pressable>
          </View>
        </View>

        {/* O registro com foto é o que o compromisso deixa depois de
            acontecer. Antes de acontecer não há o que registrar, então o
            botão só aparece quando a hora já passou. */}
        {item.registro ? (
          <Pressable
            style={({ pressed }) => [styles.registro, pressed && styles.pressionado]}
            onPress={() => setFotoAmpliada(item.registro.uri)}
          >
            <Image source={{ uri: item.registro.uri }} style={styles.miniatura} />

            <View style={styles.registroTexto}>
              <Text style={styles.registroTitulo} numberOfLines={1}>
                {item.registro.titulo}
              </Text>

              {item.registro.descricao ? (
                <Text style={styles.registroDescricao} numberOfLines={2}>
                  {item.registro.descricao}
                </Text>
              ) : null}

              <View style={styles.selo}>
                <Ionicons
                  name={item.registro.naGaleria ? 'checkmark-circle' : 'warning'}
                  size={11}
                  color={item.registro.naGaleria ? colors.supportGreen : colors.primary}
                />

                <Text style={styles.seloTexto}>
                  {item.registro.naGaleria ? 'Salva na galeria' : 'Salva no aplicativo'}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar o registro"
              style={({ pressed }) => [styles.editar, pressed && styles.pressionado]}
              onPress={() => abrirCamera(item)}
            >
              <Ionicons name="create-outline" size={17} color={colors.primary} />
            </Pressable>
          </Pressable>
        ) : passado ? (
          <Pressable
            style={({ pressed }) => [styles.botaoRegistrar, pressed && styles.pressionado]}
            onPress={() => abrirCamera(item)}
          >
            <Ionicons name="camera" size={17} color={colors.primary} />
            <Text style={styles.textoRegistrar}>Registrar o que aconteceu</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const separada = ordenarAgenda(agenda);
  const lista = aba === 'proximos' ? separada.futuros : separada.passados;

  if (carregando) {
    return (
      <SafeAreaView style={[globalStyles.container, styles.centralizado]} edges={['top']}>
        <Text style={styles.textoVazio}>Carregando a agenda...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[globalStyles.container, styles.safeArea]} edges={['top']}>
      <View style={styles.corpo}>
        <Text style={styles.titulo}>Agenda</Text>

        <Text style={styles.subtitulo}>
          Marque a visita, a entrega ou o trabalho voluntário — e registre
          com foto o que aconteceu.
        </Text>

        <View style={styles.abas}>
          <Pressable
            style={({ pressed }) => [
              styles.aba,
              aba === 'proximos' && styles.abaAtiva,
              pressed && styles.pressionado,
            ]}
            onPress={() => setAba('proximos')}
          >
            <Text style={[styles.abaTexto, aba === 'proximos' && styles.abaTextoAtivo]}>
              Próximos ({separada.futuros.length})
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.aba,
              aba === 'passados' && styles.abaAtiva,
              pressed && styles.pressionado,
            ]}
            onPress={() => setAba('passados')}
          >
            <Text style={[styles.abaTexto, aba === 'passados' && styles.abaTextoAtivo]}>
              Já aconteceram ({separada.passados.length})
            </Text>
          </Pressable>
        </View>

        <FlatList
          data={lista}
          keyExtractor={(item) => item.id}
          renderItem={renderizarCompromisso}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listaConteudo,
            lista.length === 0 && styles.listaVazia,
          ]}
          ListEmptyComponent={
            <View style={styles.vazio}>
              <View style={styles.vazioIcone}>
                <Ionicons
                  name={aba === 'proximos' ? 'calendar-outline' : 'camera-outline'}
                  size={44}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.vazioTitulo}>
                {aba === 'proximos' ? 'Nada marcado' : 'Nada registrado ainda'}
              </Text>

              <Text style={styles.textoVazio}>
                {aba === 'proximos'
                  ? 'Marque uma visita, uma entrega ou um dia de voluntariado no botão abaixo.'
                  : 'Passada a hora marcada, o compromisso vem para cá e ganha o botão de registrar com foto. Se a visita já aconteceu e você não tinha marcado, marque ela para hoje: ela cai aqui na hora.'}
              </Text>
            </View>
          }
        />

        {/* A agenda tem um caminho só, e ele começa em marcar. A foto
            entra depois, no compromisso que já aconteceu — foi para isso
            que ela existe aqui. O botão de fotografar solto criava um
            compromisso no passado sem abrigo e com o tipo chutado: era
            sobra da tela antiga de álbum, e furava o modelo. */}
        <View style={styles.areaBotao}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Marcar um compromisso"
            style={({ pressed }) => [styles.botaoPrincipal, pressed && styles.pressionado]}
            onPress={abrirNovo}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.botaoGradiente}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.botaoTexto}>Marcar compromisso</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {!cameraVisivel && !formVisivel && fotoEmTelaCheia()}

      {/* ----------------------------------------- marcar ou editar */}
      <Modal
        visible={formVisivel}
        animationType="slide"
        transparent
        onRequestClose={() => setFormVisivel(false)}
      >
        <KeyboardAvoidingView
          style={styles.fundoModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.painel}>
            <View style={styles.painelTopo}>
              <Text style={styles.painelTitulo}>
                {editando ? 'Mudar compromisso' : 'Marcar compromisso'}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                style={({ pressed }) => [styles.fechar, pressed && styles.pressionado]}
                onPress={() => setFormVisivel(false)}
              >
                <Ionicons name="close" size={22} color="#9A8F7E" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.rotulo}>O que é</Text>

              {TIPOS.map((opcao) => (
                <Pressable
                  key={opcao.id}
                  style={({ pressed }) => [
                    styles.opcao,
                    tipo === opcao.id && styles.opcaoAtiva,
                    pressed && styles.pressionado,
                  ]}
                  onPress={() => setTipo(opcao.id)}
                >
                  <Ionicons
                    name={opcao.icone}
                    size={19}
                    color={tipo === opcao.id ? colors.primary : '#9A8F7E'}
                  />

                  <View style={styles.opcaoTexto}>
                    <Text style={styles.opcaoNome}>{opcao.nome}</Text>
                    <Text style={styles.opcaoDescricao}>{opcao.descricao}</Text>
                  </View>

                  <Ionicons
                    name={tipo === opcao.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={tipo === opcao.id ? colors.primary : '#C9BFB1'}
                  />
                </Pressable>
              ))}

              {/* Escolhendo entrega, o que a pessoa já prometeu levar
                  aparece pronto para virar compromisso. Sem isso ela
                  redigitava o que já está registrado na outra tela — e
                  era ali que trocava o abrigo. */}
              {tipo === 'entrega' && promessas.length > 0 ? (
                <View>
                  <Text style={styles.rotulo}>O que você prometeu levar</Text>

                  {promessas.map((promessa) => (
                    <Pressable
                      key={promessa.id}
                      style={({ pressed }) => [styles.promessa, pressed && styles.pressionado]}
                      onPress={() => usarPromessa(promessa)}
                    >
                      <Ionicons name="cube-outline" size={17} color={colors.primary} />

                      <View style={styles.promessaTexto}>
                        <Text style={styles.promessaItem} numberOfLines={1}>
                          {promessa.item}
                        </Text>

                        <Text style={styles.promessaAbrigo} numberOfLines={1}>
                          {promessa.abrigo}
                        </Text>
                      </View>

                      <Text style={styles.promessaUsar}>Usar</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Text style={styles.rotulo}>Com qual abrigo</Text>

              {abrigos.length === 0 ? (
                <Text style={styles.semAbrigo}>
                  Nenhum abrigo cadastrado ainda. Dá para marcar assim mesmo e
                  completar depois.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.abrigos}
                >
                  {abrigos.map((abrigo) => (
                    <Pressable
                      key={abrigo.id}
                      style={({ pressed }) => [
                        styles.chip,
                        abrigoEscolhido === abrigo.id && styles.chipAtivo,
                        pressed && styles.pressionado,
                      ]}
                      onPress={() => setAbrigoEscolhido(abrigo.id)}
                    >
                      <Text
                        style={[
                          styles.chipTexto,
                          abrigoEscolhido === abrigo.id && styles.chipTextoAtivo,
                        ]}
                        numberOfLines={1}
                      >
                        {abrigo.nome}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.rotulo}>Quando</Text>

              {/* A maior parte do que se marca é para hoje, amanhã ou os
                  próximos dias. Os atalhos evitam digitar a data inteira. */}
              <View style={styles.atalhos}>
                {ATALHOS.map((atalho) => (
                  <Pressable
                    key={atalho.rotulo}
                    style={({ pressed }) => [
                      styles.atalho,
                      data === dataDaquiA(atalho.dias) && styles.atalhoAtivo,
                      pressed && styles.pressionado,
                    ]}
                    onPress={() => setData(dataDaquiA(atalho.dias))}
                  >
                    <Text
                      style={[
                        styles.atalhoTexto,
                        data === dataDaquiA(atalho.dias) && styles.atalhoTextoAtivo,
                      ]}
                    >
                      {atalho.rotulo}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.linhaData}>
                <TextInput
                  style={[styles.campo, styles.campoData]}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor="#9A8F7E"
                  value={data}
                  onChangeText={(texto) => setData(formatarCampoData(texto))}
                  keyboardType="number-pad"
                  maxLength={10}
                />

                <TextInput
                  style={[styles.campo, styles.campoHora]}
                  placeholder="hh:mm"
                  placeholderTextColor="#9A8F7E"
                  value={hora}
                  onChangeText={(texto) => setHora(formatarCampoHora(texto))}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>

              <Text style={styles.rotulo}>Observação (opcional)</Text>

              <TextInput
                style={[styles.campo, styles.campoTexto]}
                placeholder="O que combinar, o que levar, com quem falar"
                placeholderTextColor="#9A8F7E"
                value={observacao}
                onChangeText={setObservacao}
                multiline
                textAlignVertical="top"
                maxLength={200}
              />

              <Pressable
                style={({ pressed }) => [styles.botaoSalvar, pressed && styles.pressionado]}
                onPress={salvarCompromisso}
              >
                <Text style={styles.textoSalvar}>
                  {editando ? 'Salvar alterações' : 'Marcar na agenda'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ------------------------------------------- camera e registro */}
      <Modal
        visible={cameraVisivel}
        animationType="slide"
        onRequestClose={fecharCamera}
      >
        <KeyboardAvoidingView
          style={styles.telaCamera}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {!photo ? (
            <View style={styles.areaCamera}>
              <CameraView
                style={styles.camera}
                facing="back"
                ref={cameraRef}
                onCameraReady={() => setIsCameraReady(true)}
              />

              <View style={styles.sobreCamera}>
                <View style={[styles.topoCamera, { paddingTop: areaSegura.top + 20 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fechar a câmera"
                    onPress={fecharCamera}
                    style={styles.botaoVidro}
                  >
                    <Ionicons name="close" size={28} color="#FFFFFF" />
                  </Pressable>
                </View>

                <View style={styles.baseCamera}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tirar a foto"
                    onPress={takePicture}
                    style={[styles.anelDisparo, !isCameraReady && styles.disparoTravado]}
                    disabled={!isCameraReady}
                  >
                    <View style={styles.disparo} />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <ScrollView style={styles.formulario} bounces={false}>
              <View style={styles.previaTopo}>
                <Image source={{ uri: photo }} style={styles.previa} />

                <LinearGradient
                  colors={['rgba(0,0,0,0.6)', 'transparent']}
                  style={styles.previaSombra}
                >
                  <View style={[styles.barraPrevia, { paddingTop: areaSegura.top + 16 }]}>
                    <Pressable onPress={refazerFoto} style={styles.botaoPrevia}>
                      <Ionicons name="camera-reverse" size={18} color="#FFFFFF" />
                      <Text style={styles.textoPrevia}>Refazer foto</Text>
                    </Pressable>

                    <Pressable onPress={() => setFotoAmpliada(photo)} style={styles.botaoPrevia}>
                      <Ionicons name="expand" size={18} color="#FFFFFF" />
                      <Text style={styles.textoPrevia}>Ver inteira</Text>
                    </Pressable>
                  </View>
                </LinearGradient>
              </View>

              <View style={styles.corpoFormulario}>
                <Text style={styles.formTitulo}>O que aconteceu</Text>

                <Text style={styles.formContexto}>
                  {buscarTipo(registrandoEm.tipo).nome}
                  {registrandoEm.abrigoNome ? ' — ' + registrandoEm.abrigoNome : ''}
                </Text>

                <Text style={styles.rotuloForm}>Título</Text>

                <TextInput
                  style={styles.campoForm}
                  placeholder="Ex.: Entrega das fraldas"
                  placeholderTextColor="#9A8F7E"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={50}
                />

                <Text style={styles.rotuloForm}>Descrição (opcional)</Text>

                <TextInput
                  style={[styles.campoForm, styles.campoGrande]}
                  placeholder="Detalhes sobre o que aconteceu..."
                  placeholderTextColor="#9A8F7E"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                  maxLength={300}
                />

                <Pressable
                  style={({ pressed }) => [styles.botaoSalvar, pressed && styles.pressionado]}
                  onPress={salvarRegistro}
                >
                  <Text style={styles.textoSalvar}>Salvar o registro</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {fotoEmTelaCheia()}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// Atalhos de data do formulário. Ficam fora do componente porque não
// mudam nunca.
const ATALHOS = [
  { rotulo: 'Hoje', dias: 0 },
  { rotulo: 'Amanhã', dias: 1 },
  { rotulo: 'Em 3 dias', dias: 3 },
  { rotulo: 'Em 1 semana', dias: 7 },
];

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.backgroundLight,
  },

  centralizado: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  corpo: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  subtitulo: {
    fontSize: 13,
    color: '#9A8F7E',
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 14,
  },

  abas: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },

  aba: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },

  abaAtiva: {
    backgroundColor: colors.primary,
  },

  abaTexto: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#9A8F7E',
  },

  abaTextoAtivo: {
    color: '#FFFFFF',
  },

  listaConteudo: {
    paddingBottom: 100,
  },

  listaVazia: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  vazio: {
    alignItems: 'center',
    paddingBottom: 60,
    paddingHorizontal: 20,
  },

  vazioIcone: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#FFF3E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  vazioTitulo: {
    fontSize: 19,
    fontWeight: 'bold',
    color: colors.textMain,
    marginBottom: 6,
  },

  textoVazio: {
    fontSize: 14,
    color: '#9A8F7E',
    textAlign: 'center',
    lineHeight: 20,
  },

  cartao: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  cartaoTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  calendario: {
    width: 50,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFF3E6',
    alignItems: 'center',
  },

  calendarioPassado: {
    backgroundColor: colors.backgroundLight,
  },

  dia: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },

  mes: {
    fontSize: 11,
    color: '#9A8F7E',
    textTransform: 'uppercase',
  },

  cartaoTexto: {
    flex: 1,
    marginHorizontal: 12,
  },

  linhaTipo: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tipoNome: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 5,
  },

  abrigoNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 2,
  },

  quando: {
    fontSize: 13,
    color: colors.supportBlue,
    fontWeight: 'bold',
    marginTop: 2,
  },

  quandoPassado: {
    color: '#9A8F7E',
    fontWeight: 'normal',
  },

  observacao: {
    fontSize: 13,
    color: '#9A8F7E',
    lineHeight: 18,
    marginTop: 4,
  },

  acoesCartao: {
    flexDirection: 'row',
  },

  acaoCartao: {
    padding: 4,
  },

  botaoRegistrar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    marginTop: 12,
  },

  textoRegistrar: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 6,
  },

  registro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },

  miniatura: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F0E9DC',
  },

  registroTexto: {
    flex: 1,
    marginHorizontal: 10,
  },

  registroTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  registroDescricao: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginTop: 2,
  },

  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  seloTexto: {
    fontSize: 10,
    color: '#9A8F7E',
    marginLeft: 4,
  },

  editar: {
    padding: 6,
  },

  areaBotao: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    left: 16,
    alignItems: 'center',
  },

  botaoPrincipal: {
    borderRadius: 28,
    overflow: 'hidden',

    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  botaoGradiente: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    paddingHorizontal: 26,
  },

  botaoTexto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 9,
  },

  fundoModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  painel: {
    maxHeight: '88%',
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },

  painelTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  painelTitulo: {
    fontSize: 19,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  fechar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rotulo: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 16,
    marginBottom: 8,
  },

  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    padding: 12,
    marginBottom: 8,
  },

  opcaoAtiva: {
    borderColor: colors.primary,
  },

  opcaoTexto: {
    flex: 1,
    marginHorizontal: 10,
  },

  opcaoNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  opcaoDescricao: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 1,
  },

  promessa: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },

  promessaTexto: {
    flex: 1,
    marginHorizontal: 10,
  },

  promessaItem: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  promessaAbrigo: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 1,
  },

  promessaUsar: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
  },

  semAbrigo: {
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
  },

  abrigos: {
    flexGrow: 0,
  },

  chip: {
    maxWidth: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },

  chipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  chipTexto: {
    fontSize: 13,
    color: colors.textMain,
  },

  chipTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  atalhos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },

  atalho: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },

  atalhoAtivo: {
    backgroundColor: '#FFF3E6',
    borderColor: colors.primary,
  },

  atalhoTexto: {
    fontSize: 12,
    color: '#9A8F7E',
  },

  atalhoTextoAtivo: {
    color: colors.primary,
    fontWeight: 'bold',
  },

  linhaData: {
    flexDirection: 'row',
  },

  campo: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textMain,
  },

  campoData: {
    flex: 2,
  },

  campoHora: {
    flex: 1,
    marginLeft: 10,
  },

  campoTexto: {
    height: 86,
    paddingTop: 14,
  },

  botaoSalvar: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },

  textoSalvar: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  telaCamera: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  areaCamera: {
    flex: 1,
    backgroundColor: '#000000',
  },

  camera: {
    flex: 1,
  },

  sobreCamera: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  topoCamera: {
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },

  botaoVidro: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  baseCamera: {
    paddingBottom: 50,
    alignItems: 'center',
  },

  anelDisparo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  disparoTravado: {
    opacity: 0.3,
  },

  disparo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },

  formulario: {
    flex: 1,
  },

  previaTopo: {
    height: 250,
    width: '100%',
  },

  previa: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },

  previaSombra: {
    ...StyleSheet.absoluteFillObject,
  },

  barraPrevia: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },

  botaoPrevia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  textoPrevia: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  corpoFormulario: {
    padding: 24,
    paddingBottom: 60,
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },

  formTitulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  formContexto: {
    fontSize: 13,
    color: '#9A8F7E',
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 12,
  },

  rotuloForm: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 12,
    marginBottom: 8,
  },

  campoForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    padding: 16,
    fontSize: 16,
    color: colors.textMain,
  },

  campoGrande: {
    height: 100,
    paddingTop: 14,
  },

  camadaFoto: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  fotoInteira: {
    width: '100%',
    height: '80%',
  },

  dicaFoto: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 16,
    opacity: 0.7,
  },

  pressionado: {
    opacity: 0.6,
  },
});
