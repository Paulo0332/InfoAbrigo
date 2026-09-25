import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NeedForm from '../components/NeedForm';
import NeedItem from '../components/NeedItem';
import { colors } from '../theme/colors';
import { globalStyles } from '../theme/styles';
import { ehGestor, podeGerenciarNecessidades } from '../data/perfis';
import { carregarConta } from '../services/auth';
import {
  CONFIRMADA,
  ITEM,
  PENDENTE,
  apagarDoacao,
  atualizarSituacao,
  registrarDoacao,
} from '../services/donations';
import {
  contribuicoesDaNecessidade,
  faltam,
  quantidadeValida,
  recebido,
  temMeta,
} from '../services/necessidades';
import { abrigosDaConta, carregarAbrigos } from '../services/shelters';
import { aviso, deuCerto, toqueLeve } from '../services/tato';
import { loadNeeds, saveNeeds } from '../services/storage';

// Os dois filtros que não são um abrigo específico.
const TODOS = 'todos';
const SEM_ABRIGO = 'sem-abrigo';

export default function DonationsScreen(props) {

  const [needs, setNeeds] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [conta, setConta] = useState(null);
  const [abrigos, setAbrigos] = useState([]);
  const [meusAbrigos, setMeusAbrigos] = useState([]);
  const [filtro, setFiltro] = useState(TODOS);
  const [busca, setBusca] = useState('');

  // Quem toca em "Vou doar" numa necessidade com meta precisa dizer
  // quanto vai levar: é isso que faz o que falta diminuir de verdade.
  const [oferecendo, setOferecendo] = useState(null);
  const [quantoVouLevar, setQuantoVouLevar] = useState('');

  // O cartão do mapa manda o abrigo junto quando alguém toca em "Ver o
  // que o abrigo precisa". Sem ler isto aqui, aquele botão abria a lista
  // inteira, de todos os abrigos: dizia uma coisa e entregava outra.
  const pedido = props.route.params || {};

  useEffect(() => {
    if (pedido.abrigoId) {
      setFiltro(pedido.abrigoId);
      setBusca('');
    }
  }, [pedido.momento]);

  useEffect(() => {
    carregarTudo(true);

    // Ao voltar do cadastro de abrigo, o vínculo e a lista podem ter
    // mudado.
    const inscricao = props.navigation.addListener('focus', () => {
      carregarTudo(false);
    });

    return inscricao;
  }, []);

  // Uma leitura só para tudo que a tela mostra: a conta diz o perfil, os
  // abrigos alimentam o filtro e as necessidades são a lista.
  async function carregarTudo(primeiraVez) {
    try {
      const contaSalva = await carregarConta();
      const listaAbrigos = await carregarAbrigos();
      const listaNecessidades = await loadNeeds();

      setConta(contaSalva);
      setAbrigos(listaAbrigos);
      setNeeds(listaNecessidades || []);

      // Quem administra pode administrar mais de um abrigo. Guardar só o
      // primeiro fazia toda necessidade cair nele, qualquer que fosse o
      // filtro escolhido — e o segundo abrigo nunca recebia nada.
      const meus = ehGestor(contaSalva)
        ? abrigosDaConta(listaAbrigos, contaSalva)
        : [];

      setMeusAbrigos(meus);

      // Quem administra um abrigo abre a tela já na lista dele. Depois
      // troca o filtro à vontade, e por isso só na primeira vez. Chegando
      // pelo mapa, quem manda é o abrigo que a pessoa tocou.
      if (primeiraVez && meus.length > 0 && !pedido.abrigoId) {
        setFiltro(meus[0].id);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar a lista de necessidades.');
    } finally {
      setCarregando(false);
    }
  }

  async function atualizar() {
    setAtualizando(true);

    await carregarTudo(false);

    setAtualizando(false);
  }

  // Toda alteração na lista passa por aqui, para o estado da tela e o
  // disco nunca saírem de sincronia.
  async function gravarLista(novaLista, aviso) {
    setNeeds(novaLista);

    try {
      await saveNeeds(novaLista);
    } catch (error) {
      Alert.alert('Erro', aviso);
    }
  }

  function abrigoDoFiltro() {
    return abrigos.find((abrigo) => abrigo.id === filtro) || null;
  }

  // Para qual abrigo a necessidade vai. Quem manda é o filtro: estando
  // num abrigo específico, é para ele — e se ele não for meu, eu não
  // cadastro nele, ponto.
  //
  // O atalho de "um abrigo só, então é esse" vale apenas com o filtro em
  // Todos. Deixar esse atalho valer sempre foi o erro da correção
  // anterior: com o filtro num abrigo de outro dono, ele silenciosamente
  // mandava a necessidade para o meu primeiro abrigo, e por fora parecia
  // que o filtro estava sendo ignorado.
  function abrigoDoCadastro() {
    if (filtro !== TODOS && filtro !== SEM_ABRIGO) {
      const doFiltro = abrigoDoFiltro();

      // Abrigo sem dono gravado foi cadastrado sem conta aberta. Deixá-lo
      // sem ninguém que possa mexer seria condenar a lista dele a nunca
      // mudar, e qualquer gestor consegue arrumar isso.
      if (doFiltro != null && !doFiltro.dono) {
        return doFiltro;
      }

      return meusAbrigos.find((abrigo) => abrigo.id === filtro) || null;
    }

    return meusAbrigos.length === 1 ? meusAbrigos[0] : null;
  }

  // O filtro está num abrigo que existe, mas que não é meu. Nesse caso a
  // tela não oferece o formulário: publicar necessidade em nome de um
  // abrigo alheio não é coisa que deva acontecer calada.
  function abrigoDeOutro() {
    const doFiltro = abrigoDoFiltro();

    return doFiltro != null && abrigoDoCadastro() == null;
  }

  function addNeed(title, detalhes) {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert('Atenção', 'Digite o nome da necessidade.');

      return;
    }

    const destino = abrigoDoCadastro();

    if (destino == null && meusAbrigos.length > 1) {
      Alert.alert(
        'Para qual abrigo?',
        'Você administra mais de um abrigo. Escolha acima em qual deles cadastrar esta necessidade.'
      );

      return;
    }

    const newNeed = {
      id: Date.now().toString(),
      title: cleanTitle,
      done: false,
      // A meta em número e a unidade, separadas: é o que permite somar as
      // contribuições e dizer quanto ainda falta.
      alvo: detalhes ? detalhes.alvo : null,
      unidade: detalhes ? detalhes.unidade : '',
      urgente: detalhes ? detalhes.urgente === true : false,
      contribuicoes: [],
      // Quem cadastra em nome de um abrigo deixa o vínculo gravado. Sem
      // abrigo, a necessidade fica geral, como eram todas antes.
      abrigoId: destino ? destino.id : null,
      abrigoNome: destino ? destino.nome : null,
    };

    toqueLeve();

    gravarLista([newNeed, ...needs], 'Falha ao salvar a necessidade.');
  }

  // Marcar atendida é o abrigo dizendo que o item chegou. Quando alguém
  // tinha se oferecido para levar, isso fecha o ciclo: a promessa daquela
  // pessoa deixa de ficar "a caminho" no histórico dela e passa a
  // entregue. Desmarcar desfaz as duas coisas.
  async function toggleNeed(id) {
    const alvo = needs.find((need) => need.id === id);

    if (alvo == null) {
      return;
    }

    const recebendo = !alvo.done;

    const newList = needs.map((need) => {
      if (need.id !== id) {
        return need;
      }

      const atualizada = { ...need, done: recebendo };

      // Marcar a necessidade inteira vale por todas as entregas que
      // estavam pendentes nela: é o atalho de quem recebeu tudo de uma vez.
      atualizada.contribuicoes = contribuicoesDaNecessidade(need).map((uma) => ({
        ...uma,
        entregue: recebendo,
      }));

      if (recebendo) {
        atualizada.recebidoEm = new Date().toISOString();
      } else {
        delete atualizada.recebidoEm;
      }

      return atualizada;
    });

    if (recebendo) {
      deuCerto();
    }

    gravarLista(newList, 'Falha ao atualizar a necessidade.');

    for (const contribuicao of contribuicoesDaNecessidade(alvo)) {
      if (!contribuicao.doacaoId) {
        continue;
      }

      try {
        await atualizarSituacao(
          contribuicao.doacaoId,
          recebendo ? CONFIRMADA : PENDENTE
        );
      } catch (error) {
        console.log('Erro ao fechar o ciclo da doação:', error);
      }
    }
  }

  function confirmDelete(id) {
    Alert.alert(
      'Excluir necessidade',
      'Deseja realmente excluir esta necessidade da lista?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteNeed(id),
        },
      ]
    );
  }

  function deleteNeed(id) {
    aviso();

    gravarLista(
      needs.filter((need) => need.id !== id),
      'Falha ao excluir a necessidade.'
    );
  }

  // Quem administra o abrigo mantém a lista; os outros perfis veem o que
  // os abrigos precisam, que é justamente o propósito do aplicativo.
  const gerencia = podeGerenciarNecessidades(conta);

  // E administrar não é administrar tudo: cada gestor mexe só na lista do
  // abrigo dele, senão um apaga a necessidade do outro. As necessidades
  // antigas, cadastradas antes do vínculo existir, não têm abrigo nenhum
  // — essas continuam abertas a qualquer gestor, senão ficariam presas
  // sem ninguém para arrumar.
  function podeMexer(need) {
    if (!gerencia) {
      return false;
    }

    if (!need.abrigoId) {
      return true;
    }

    if (meusAbrigos.some((abrigo) => abrigo.id === need.abrigoId)) {
      return true;
    }

    // Necessidade de abrigo sem dono gravado: pela mesma razão do
    // cadastro, qualquer gestor pode arrumar.
    const dela = abrigos.find((abrigo) => abrigo.id === need.abrigoId);

    return dela != null && !dela.dono;
  }

  function combinaComFiltro(need) {
    if (filtro === TODOS) {
      return true;
    }

    if (filtro === SEM_ABRIGO) {
      return !need.abrigoId;
    }

    return need.abrigoId === filtro;
  }

  // A ordem é a da utilidade: o que falta vem antes do que já chegou, e
  // dentro do que falta o urgente vem primeiro. Com a lista em ordem de
  // cadastro, uma necessidade urgente entrava no fim e ficava invisível.
  function pesoNaLista(need) {
    if (need.done) {
      return 2;
    }

    return need.urgente ? 0 : 1;
  }

  function visiveis() {
    const texto = busca.trim().toLowerCase();

    return needs
      .filter((need) => {
        if (!combinaComFiltro(need)) {
          return false;
        }

        return !texto || need.title.toLowerCase().indexOf(texto) >= 0;
      })
      .sort((a, b) => pesoNaLista(a) - pesoNaLista(b));
  }

  // Troca a necessidade na lista e grava, sem repetir o map em cada
  // função que mexe numa só.
  function trocarNecessidade(id, mudar, aviso) {
    const nova = needs.map((need) => (need.id === id ? mudar(need) : need));

    gravarLista(nova, aviso);

    return nova;
  }

  // "Vou doar" não marca a necessidade como atendida: quem confirma que o
  // item chegou é o abrigo. O que fica registrado é a promessa — e com
  // quanto, para o que falta diminuir de verdade e dois doadores não
  // levarem a mesma coisa.
  function confirmarReserva(need) {
    if (conta == null) {
      Alert.alert('Erro', 'Não foi possível ler a sua conta.');

      return;
    }

    // Sem meta não há quanto perguntar: a necessidade é o item inteiro.
    if (!temMeta(need)) {
      Alert.alert(
        'Vou doar este item',
        'O abrigo vai ver que você se ofereceu para levar ' + need.title +
          '. Combine a entrega pelo contato do abrigo, na aba do mapa.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => contribuir(need, 1) },
        ]
      );

      return;
    }

    setQuantoVouLevar(String(faltam(need)));
    setOferecendo(need);
  }

  function confirmarQuantidade() {
    const need = oferecendo;

    if (!quantidadeValida(quantoVouLevar, need)) {
      Alert.alert(
        'Quantidade inválida',
        'Digite um número entre 1 e ' + faltam(need) + '.'
      );

      return;
    }

    const quanto = Number(quantoVouLevar.replace(/[^0-9]/g, ''));

    setOferecendo(null);
    setQuantoVouLevar('');

    contribuir(need, quanto);
  }

  async function contribuir(need, quanto) {
    const agora = new Date().toISOString();

    const descricao = temMeta(need)
      ? quanto + ' ' + (need.unidade || 'un') + ' de ' + need.title
      : need.title;

    const doacao = {
      id: Date.now().toString(),
      tipo: ITEM,
      item: descricao,
      abrigo: need.abrigoNome || 'Abrigo não informado',
      valor: 0,
      conta: conta.email,
      data: agora,
    };

    const contribuicao = {
      id: doacao.id,
      por: conta.email,
      nome: conta.nome || conta.email,
      quantidade: quanto,
      em: agora,
      doacaoId: doacao.id,
      entregue: false,
    };

    deuCerto();

    trocarNecessidade(
      need.id,
      (item) => ({
        ...item,
        contribuicoes: [...contribuicoesDaNecessidade(item), contribuicao],
      }),
      'Não foi possível registrar a doação.'
    );

    try {
      await registrarDoacao(doacao);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar a doação.');
    }
  }

  function confirmarDesistencia(need, contribuicao) {
    Alert.alert(
      'Desistir da doação',
      'O que você prometeu volta a aparecer como faltando, para outra pessoa levar.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Desistir',
          style: 'destructive',
          onPress: () => soltar(need, contribuicao),
        },
      ]
    );
  }

  async function soltar(need, contribuicao) {
    trocarNecessidade(
      need.id,
      (item) => ({
        ...item,
        contribuicoes: contribuicoesDaNecessidade(item).filter(
          (uma) => uma.id !== contribuicao.id
        ),
      }),
      'Não foi possível cancelar a doação.'
    );

    try {
      if (contribuicao.doacaoId) {
        await apagarDoacao(contribuicao.doacaoId);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível cancelar a doação.');
    }
  }

  // O abrigo confirmando que aquela entrega chegou. É por aqui que o
  // recebido cresce — e ele é diferente do prometido, que já tinha
  // crescido quando a pessoa se ofereceu.
  async function receberContribuicao(need, contribuicao) {
    deuCerto();

    trocarNecessidade(
      need.id,
      (item) => {
        const atualizadas = contribuicoesDaNecessidade(item).map((uma) =>
          uma.id === contribuicao.id ? { ...uma, entregue: true } : uma
        );

        const comAsNovas = { ...item, contribuicoes: atualizadas };

        // Chegando tudo que foi pedido, a necessidade se dá por atendida
        // sozinha: exigir mais um toque do abrigo seria burocracia.
        if (temMeta(comAsNovas) && recebido(comAsNovas) >= comAsNovas.alvo) {
          comAsNovas.done = true;
          comAsNovas.recebidoEm = new Date().toISOString();
        }

        return comAsNovas;
      },
      'Não foi possível confirmar o recebimento.'
    );

    try {
      if (contribuicao.doacaoId) {
        await atualizarSituacao(contribuicao.doacaoId, CONFIRMADA);
      }
    } catch (error) {
      console.log('Erro ao fechar o ciclo da doação:', error);
    }
  }

  // As opções do filtro: todos, um por abrigo cadastrado e, só quando
  // existirem, as necessidades soltas de antes do vínculo.
  function opcoesDoFiltro() {
    const lista = [{ id: TODOS, nome: 'Todos' }];

    abrigos.forEach((abrigo) => {
      lista.push({ id: abrigo.id, nome: abrigo.nome });
    });

    if (needs.some((need) => !need.abrigoId)) {
      lista.push({ id: SEM_ABRIGO, nome: 'Sem abrigo' });
    }

    return lista;
  }

  // Com o filtro num abrigo, a doação em dinheiro já vai para ele, e a
  // pessoa não precisa voltar ao mapa só para escolher.
  function abrigoEscolhido() {
    const escolhido = abrigos.find((abrigo) => abrigo.id === filtro);

    if (!escolhido) {
      return undefined;
    }

    return { abrigo: escolhido.nome, abrigoId: escolhido.id };
  }

  function textoDoVazio() {
    if (busca) {
      return 'Nenhuma necessidade com esse nome nesta lista.';
    }

    // Sem o formulário na tela, mandar cadastrar acima seria apontar para
    // um campo que não existe.
    if (abrigoDeOutro()) {
      return 'Este abrigo ainda não publicou o que está precisando.';
    }

    if (gerencia) {
      return 'Cadastre acima o que o abrigo está precisando.';
    }

    return 'Nenhum abrigo publicou necessidades ainda.';
  }

  function renderNeed({ item }) {
    return (
      <NeedItem
        need={item}
        email={conta ? conta.email : null}
        onToggle={toggleNeed}
        onDelete={confirmDelete}
        onReservar={confirmarReserva}
        onCancelarReserva={confirmarDesistencia}
        onReceber={receberContribuicao}
        somenteLeitura={!podeMexer(item)}
      />
    );
  }

  const lista = visiveis();
  const atendidas = lista.filter((need) => need.done).length;
  const reservadas = lista.filter(
    (need) => !need.done && contribuicoesDaNecessidade(need).length > 0
  ).length;

  if (carregando) {
    return (
      <SafeAreaView style={[globalStyles.container, styles.loadingContainer]} edges={['top']}>
        <Text style={styles.loadingText}>Carregando necessidades...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.container} edges={['top']}>
      <View style={styles.content}>

        <Text style={styles.title}>Doações</Text>

        <Text style={styles.summary}>
          {lista.length} necessidade(s) • {atendidas} atendida(s)
          {reservadas > 0 ? ' • ' + reservadas + ' a caminho' : ''}
        </Text>

        {/* O filtro por abrigo é o que separa uma lista da outra. Sem ele
            as necessidades de todos os abrigos apareciam misturadas. */}
        {opcoesDoFiltro().length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtros}
            contentContainerStyle={styles.filtrosConteudo}
          >
            {opcoesDoFiltro().map((opcao) => (
              <Pressable
                key={opcao.id}
                style={({ pressed }) => [
                  styles.filtro,
                  filtro === opcao.id && styles.filtroAtivo,
                  pressed && styles.doarPressionado,
                ]}
                onPress={() => setFiltro(opcao.id)}
              >
                <Text
                  style={[
                    styles.filtroTexto,
                    filtro === opcao.id && styles.filtroTextoAtivo,
                  ]}
                  numberOfLines={1}
                >
                  {opcao.nome}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {needs.length > 4 && (
          <View style={styles.buscaCaixa}>
            <Ionicons name="search" size={17} color="#9A8F7E" />

            <TextInput
              style={styles.buscaInput}
              placeholder="Procurar na lista"
              placeholderTextColor="#9A8F7E"
              value={busca}
              onChangeText={setBusca}
              maxLength={40}
            />

            {busca ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Limpar a busca" onPress={() => setBusca('')}>
                <Ionicons name="close-circle" size={17} color="#9A8F7E" />
              </Pressable>
            ) : null}
          </View>
        )}

        {gerencia && abrigoDoCadastro() && (
          <View style={styles.vinculo}>
            <Ionicons name="business" size={14} color={colors.primary} />

            <Text style={styles.vinculoTexto}>
              Cadastrando para {abrigoDoCadastro().nome}
            </Text>
          </View>
        )}

        {/* Com mais de um abrigo e o filtro em "Todos", não há como
            adivinhar o destino — e mandar para o primeiro da lista era
            exatamente o que fazia o segundo abrigo nunca receber nada. */}
        {gerencia && !abrigoDoCadastro() && !abrigoDeOutro() && meusAbrigos.length > 1 && (
          <View style={styles.vinculo}>
            <Ionicons name="alert-circle" size={14} color={colors.supportPink} />

            <Text style={styles.vinculoEscolha}>
              Escolha acima para qual dos seus abrigos cadastrar
            </Text>
          </View>
        )}

        {/* Sem esta explicação, a pessoa trocava o filtro, cadastrava e a
            necessidade aparecia noutro abrigo sem nenhum aviso. */}
        {gerencia && abrigoDeOutro() && (
          <View style={styles.alheio}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.supportPink} />

            <Text style={styles.alheioTexto}>
              A lista do {abrigoDoFiltro().nome} é mantida por quem
              administra aquele abrigo
              {abrigoDoFiltro().dono ? ' (' + abrigoDoFiltro().dono + ')' : ''}.
              Você está nesta conta como {conta ? conta.email : 'visitante'}.
            </Text>
          </View>
        )}

        {gerencia && ehGestor(conta) && meusAbrigos.length === 0 && (
          <Pressable
            style={({ pressed }) => [styles.vinculoAviso, pressed && styles.doarPressionado]}
            onPress={() => props.navigation.navigate('RegisterShelter')}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.supportPink} />

            <Text style={styles.vinculoAvisoTexto}>
              Cadastre o seu abrigo no mapa para as necessidades ficarem
              ligadas a ele
            </Text>
          </Pressable>
        )}

        {gerencia && !abrigoDeOutro() ? (
          <NeedForm onAdd={addNeed} />
        ) : gerencia ? null : (
          <View style={styles.leitura}>
            <Ionicons name="hand-left-outline" size={16} color="#9A8F7E" />

            <Text style={styles.leituraTexto}>
              Esta é a lista que os abrigos publicaram. Toque em Vou doar
              para avisar que você leva o item.
            </Text>
          </View>
        )}

        {/* Porta de entrada da doação em dinheiro (Módulo 3). A lista
            acima é o que o abrigo precisa; aqui a pessoa contribui. */}
        <Pressable
          style={({ pressed }) => [styles.doar, pressed && styles.doarPressionado]}
          onPress={() => props.navigation.navigate('Donate', abrigoEscolhido())}
        >
          <View style={styles.doarIcone}>
            <Ionicons name="heart" size={20} color={colors.primary} />
          </View>

          <View style={styles.doarConteudo}>
            <Text style={styles.doarTitulo}>Fazer uma doação em dinheiro</Text>

            <Text style={styles.doarTexto}>
              Pix, transferência ou a página do abrigo
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#9A8F7E" />
        </Pressable>

        {/* Dinheiro e itens não são as únicas formas: existe apadrinhamento
            e existe a destinação do imposto de renda ao fundo da infância,
            que não custa nada a quem doa. Tudo isso mora na tela do abrigo
            escolhido, que só faz sentido quando há um escolhido. */}
        {abrigoEscolhido() && (
          <Pressable
            style={({ pressed }) => [styles.ajudar, pressed && styles.doarPressionado]}
            onPress={() => props.navigation.navigate('Help', { abrigoId: filtro })}
          >
            <Ionicons name="hand-left-outline" size={17} color={colors.primary} />

            <Text style={styles.ajudarTexto}>
              Todas as formas de ajudar este abrigo
            </Text>

            <Ionicons name="chevron-forward" size={17} color="#9A8F7E" />
          </Pressable>
        )}

        <FlatList
          data={lista}
          keyExtractor={(item) => item.id}
          renderItem={renderNeed}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={atualizar}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            styles.list,
            lista.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="gift-outline" size={48} color={colors.primary} />

              <Text style={styles.emptyTitle}>
                {busca ? 'Nada encontrado' : 'Nenhuma necessidade'}
              </Text>

              <Text style={styles.emptyText}>{textoDoVazio()}</Text>
            </View>
          }
        />

      </View>

      {/* Perguntar quanto é o que faz o "falta" diminuir de verdade. Sem
          isso, uma pessoa oferecendo um pacote zerava uma necessidade de
          dez. O campo já vem com o que falta, porque é o palpite mais
          provável de quem tocou. */}
      <Modal
        visible={oferecendo != null}
        animationType="fade"
        transparent
        onRequestClose={() => setOferecendo(null)}
      >
        <View style={styles.fundoModal}>
          <View style={styles.painel}>
            <Text style={styles.painelTitulo}>Quanto você vai levar?</Text>

            {oferecendo ? (
              <Text style={styles.painelTexto}>
                {oferecendo.title} — faltam {faltam(oferecendo)}
                {oferecendo.unidade ? ' ' + oferecendo.unidade : ''}
              </Text>
            ) : null}

            <TextInput
              style={styles.painelInput}
              value={quantoVouLevar}
              onChangeText={setQuantoVouLevar}
              keyboardType="number-pad"
              selectTextOnFocus
              maxLength={5}
            />

            <Pressable
              style={({ pressed }) => [styles.painelBotao, pressed && styles.doarPressionado]}
              onPress={confirmarQuantidade}
            >
              <Text style={styles.painelBotaoTexto}>Confirmar</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.painelLink, pressed && styles.doarPressionado]}
              onPress={() => setOferecendo(null)}
            >
              <Text style={styles.painelLinkTexto}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 16,
    color: colors.textMain,
  },

  title: {
    fontSize: 24,
    color: colors.textMain,
    fontWeight: 'bold',
  },

  summary: {
    fontSize: 14,
    color: '#9A8F7E',
    marginTop: 4,
    marginBottom: 12,
  },

  filtros: {
    flexGrow: 0,
    marginBottom: 12,
  },

  filtrosConteudo: {
    paddingRight: 16,
  },

  filtro: {
    maxWidth: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },

  filtroAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filtroTexto: {
    fontSize: 13,
    color: colors.textMain,
  },

  filtroTextoAtivo: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  buscaCaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  buscaInput: {
    flex: 1,
    height: 44,
    color: colors.textMain,
    fontSize: 15,
    marginHorizontal: 8,
  },

  vinculo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  vinculoTexto: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
    marginLeft: 5,
  },

  alheio: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },

  alheioTexto: {
    flex: 1,
    fontSize: 12,
    color: colors.textMain,
    lineHeight: 17,
    marginLeft: 8,
  },

  vinculoEscolha: {
    flex: 1,
    fontSize: 12,
    color: colors.supportPink,
    fontWeight: 'bold',
    marginLeft: 5,
  },

  vinculoAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  vinculoAvisoTexto: {
    flex: 1,
    fontSize: 12,
    color: colors.textMain,
    lineHeight: 17,
    marginLeft: 8,
  },

  leitura: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },

  leituraTexto: {
    flex: 1,
    fontSize: 12,
    color: '#9A8F7E',
    lineHeight: 17,
    marginLeft: 8,
  },

  doar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,

    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  doarIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  doarConteudo: {
    flex: 1,
    marginHorizontal: 12,
  },

  doarTitulo: {
    fontSize: 15,
    color: colors.textMain,
  },

  doarTexto: {
    fontSize: 12,
    color: '#9A8F7E',
    marginTop: 2,
  },

  doarPressionado: {
    opacity: 0.6,
  },

  ajudar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: -6,
    marginBottom: 16,
  },

  ajudarTexto: {
    flex: 1,
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
    marginHorizontal: 8,
  },

  fundoModal: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  painel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },

  painelTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textMain,
  },

  painelTexto: {
    fontSize: 13,
    color: '#9A8F7E',
    lineHeight: 19,
    marginTop: 4,
  },

  painelInput: {
    height: 64,
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0E9DC',
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textMain,
    textAlign: 'center',
    marginTop: 14,
  },

  painelBotao: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  painelBotaoTexto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  painelLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  painelLinkTexto: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9A8F7E',
  },

  list: {
    paddingBottom: 12,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  empty: {
    alignItems: 'center',
    paddingBottom: 60,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: colors.textMain,
    marginTop: 10,
  },

  emptyText: {
    fontSize: 14,
    color: '#9A8F7E',
    marginTop: 5,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
