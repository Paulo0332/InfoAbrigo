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
  ehHoje,
  jaPassou,
  mesCurto,
  montarQuando,
  ordenarAgenda,
  quandoAcontece,
  salvarAgendaDaConta,
} from '../services/agenda';
import { carregarConta } from '../services/auth';
import { escolherDoCelular, salvarNoCelular } from '../services/galeria';
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

  // O compromisso só tinha tipo, abrigo e hora. Dois do mesmo tipo no
  // mesmo abrigo ficavam idênticos na lista, e a pessoa não lembrava
  // qual era qual — o título é o que diferencia um do outro.
  const [titulo, setTitulo] = useState('');

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

    setTitulo('Entregar ' + promessa.item);
    setObservacao('');
  }

  function abrirNovo() {
    setEditando(null);
    setTipo(TIPOS[0].id);
    setAbrigoEscolhido(abrigos.length === 1 ? abrigos[0].id : null);
    setData(dataDaquiA(1));
    setHora('14:00');
    setObservacao('');
    setTitulo('');
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
    setTitulo(item.titulo || '');
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
      titulo: titulo.trim(),
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

  // A escolha vem antes de abrir, e não como um botão dentro da câmera.
  // Dentro dela o espaço é para enquadrar a foto; de onde vem a imagem é
  // decisão anterior a isso.
  function escolherOrigem(item) {
    Alert.alert('Registro com foto', 'De onde vem a foto?', [
      { text: 'Tirar uma foto', onPress: () => abrirCamera(item) },
      { text: 'Escolher do celular', onPress: () => abrirComFotoDoCelular(item) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function prepararFormulario(item, uri) {
    setRegistrandoEm(item);
    setPhoto(uri);
    setTitle(item && item.registro ? item.registro.titulo : '');
    setDescription(item && item.registro ? item.registro.descricao : '');
    setIsCameraReady(false);
    setCameraVisivel(true);
  }

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

    prepararFormulario(item, null);
  }

  async function abrirComFotoDoCelular(item) {
    const escolha = await escolherDoCelular();

    if (escolha.situacao === 'escolhida') {
      toqueLeve();
      prepararFormulario(item, escolha.uri);

      return;
    }

    if (escolha.situacao === 'sem-permissao') {
      Alert.alert(
        'Sem acesso às fotos',
        'Para escolher uma foto já tirada, permita o acesso às fotos nas configurações do aparelho.'
      );
    }
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

  // Trocar a foto pergunta de novo de onde ela vem — a mesma escolha da
  // entrada, porque trocar é começar o registro da imagem outra vez.
  function trocarFoto() {
    Alert.alert('Trocar a foto', 'De onde vem a nova foto?', [
      { text: 'Tirar uma foto', onPress: voltarParaCamera },
      { text: 'Escolher do celular', onPress: trocarPorFotoDoCelular },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function trocarPorFotoDoCelular() {
    const escolha = await escolherDoCelular();

    if (escolha.situacao === 'escolhida') {
      toqueLeve();
      setPhoto(escolha.uri);
    }
  }

  // Voltar para a câmera não é só limpar a foto: a permissão pode ter
  // sido revogada, e o isCameraReady precisa voltar a false para o botão
  // de disparo só liberar quando a câmera estiver de pé outra vez.
  async function voltarParaCamera() {
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

  // Salva no celular uma foto que já está registrada. Foto tirada dentro
  // do aplicativo mora só nele até ser salva, e some junto se o
  // aplicativo for desinstalado.
  async function salvarFotoDoRegistro(item) {
    const guardou = await salvarNoCelular(item.registro.uri);

    if (!guardou) {
      Alert.alert(
        'Não foi possível salvar',
        'Permita o acesso às fotos nas configurações do aparelho para guardar a imagem na galeria.'
      );

      return;
    }

    deuCerto();

    gravar(
      agenda.map((uma) =>
        uma.id === item.id
          ? { ...uma, registro: { ...uma.registro, naGaleria: true } }
          : uma
      )
    );
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
      ? await salvarNoCelular(photo)
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

  // A foto é tirada no abrigo, durante a visita — não depois dela. Por
  // isso registrar libera no dia, e não quando a hora marcada passa:
  // quem chega dez minutos antes ficava sem conseguir fotografar, e
  // quando o botão enfim aparecia a pessoa já tinha ido embora.
  function podeRegistrar(item) {
    return ehHoje(item.quando) || jaPassou(item.quando);
  }

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
              {item.titulo || item.abrigoNome || 'Abrigo não informado'}
            </Text>

            {item.titulo && item.abrigoNome ? (
              <Text style={styles.abrigoSecundario} numberOfLines={1}>
                {item.abrigoNome}
              </Text>
            ) : null}

            <Text style={[styles.quando, passado && styles.quandoPassado]}>
              {quandoAcontece(item.quando)}
            </Text>

            {item.observacao ? (
              <Text style={styles.observacao} numberOfLines={2}>
                {item.observacao}
              </Text>
            ) : null}

          </View>

          {/* Data e hora só mudam no que ainda vai acontecer. Remarcar
              uma visita que já foi é reescrever o passado: o que vale
              dela é o registro, e esse continua editável no cartão da
              foto. Excluir continua valendo, porque compromisso lançado
              errado precisa poder sumir. */}
          <View style={styles.acoesCartao}>
            {!passado && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mudar o compromisso"
                style={({ pressed }) => [styles.acaoCartao, pressed && styles.pressionado]}
                onPress={() => abrirEdicao(item)}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </Pressable>
            )}

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

              {item.registro.naGaleria ? (
                <View style={styles.selo}>
                  <Ionicons name="checkmark-circle" size={11} color={colors.supportGreen} />
                  <Text style={styles.seloTexto}>Salva na galeria do celular</Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Salvar a foto na galeria do celular"
                  style={({ pressed }) => [styles.salvarFoto, pressed && styles.pressionado]}
                  onPress={() => salvarFotoDoRegistro(item)}
                >
                  <Ionicons name="download-outline" size={12} color={colors.primary} />
                  <Text style={styles.salvarFotoTexto}>Salvar no celular</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar o registro"
              style={({ pressed }) => [styles.editar, pressed && styles.pressionado]}
              onPress={() => escolherOrigem(item)}
            >
              <Ionicons name="create-outline" size={17} color={colors.primary} />
            </Pressable>
          </Pressable>
        ) : podeRegistrar(item) ? (
          <Pressable
            style={({ pressed }) => [styles.botaoRegistrar, pressed && styles.pressionado]}
            onPress={() => escolherOrigem(item)}
          >
            <Ionicons name="camera" size={17} color={colors.primary} />

            <Text style={styles.textoRegistrar}>
              {ehHoje(item.quando) && !passado
                ? 'Está acontecendo? Registre com foto'
                : 'Registrar com foto'}
            </Text>
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
            aba === 'proximos' ? styles.listaConteudo : styles.listaConteudoSolta,
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
                  : 'Passada a hora marcada, o compromisso vem para cá com a foto que você tiver registrado nele.'}
              </Text>
            </View>
          }
        />

        {/* Marcar é ação de quem olha para frente, então o botão vive
            na aba dos próximos. Em "Já aconteceram" não há o que marcar:
            ali o que se faz é registrar, e isso mora no cartão de cada
            compromisso, onde já existe abrigo, tipo e data. */}
        {aba === 'proximos' && (
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
        )}
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

              <Text style={styles.rotulo}>Título</Text>

              <TextInput
                style={styles.campo}
                placeholder="Ex.: Entrega das fraldas de março"
                placeholderTextColor="#9A8F7E"
                value={titulo}
                onChangeText={setTitulo}
                maxLength={60}
              />

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
                    <Pressable onPress={trocarFoto} style={styles.botaoPrevia}>
                      <Ionicons name="camera-reverse" size={18} color="#FFFFFF" />
                      <Text style={styles.textoPrevia}>Trocar a foto</Text>
                    </Pressable>

                    <Pressable onPress={() => setFotoAmpliada(photo)} style={styles.botaoPrevia}>
                      <Ionicons name="expand" size={18} color="#FFFFFF" />
                      <Text style={styles.textoPrevia}>Ver inteira</Text>
                    </Pressable>
                  </View>
                </LinearGradient>
              </View>

              <View style={styles.corpoFormulario}>
                <Text style={styles.formTitulo}>Registro da visita</Text>

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

  listaConteudoSolta: {
    paddingBottom: 20,
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

  abrigoSecundario: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 1,
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
    paddingBottom: 34,
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

  salvarFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 5,
  },

  salvarFotoTexto: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 4,
  },

  botaoPrevia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
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
