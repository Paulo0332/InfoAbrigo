import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { ITEM, apagarDoacao, registrarDoacao } from '../services/donations';
import { carregarAbrigos } from '../services/shelters';
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
  const [meuAbrigo, setMeuAbrigo] = useState(null);
  const [filtro, setFiltro] = useState(TODOS);
  const [busca, setBusca] = useState('');

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

      // O gestor cadastra necessidades em nome do abrigo dele. É o
      // primeiro abrigo cujo dono seja a conta atual.
      const meu = ehGestor(contaSalva)
        ? listaAbrigos.find((abrigo) => abrigo.dono === contaSalva.email)
        : null;

      setMeuAbrigo(meu || null);

      // Quem administra um abrigo abre a tela já na lista dele. Depois
      // troca o filtro à vontade, e por isso só na primeira vez. Chegando
      // pelo mapa, quem manda é o abrigo que a pessoa tocou.
      if (primeiraVez && meu && !pedido.abrigoId) {
        setFiltro(meu.id);
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

  function addNeed(title) {
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      Alert.alert('Atenção', 'Digite o nome da necessidade.');

      return;
    }

    const newNeed = {
      id: Date.now().toString(),
      title: cleanTitle,
      done: false,
      // Quem cadastra em nome de um abrigo deixa o vínculo gravado. Sem
      // abrigo, a necessidade fica geral, como eram todas antes.
      abrigoId: meuAbrigo ? meuAbrigo.id : null,
      abrigoNome: meuAbrigo ? meuAbrigo.nome : null,
    };

    gravarLista([newNeed, ...needs], 'Falha ao salvar a necessidade.');
  }

  function toggleNeed(id) {
    const newList = needs.map((need) => {
      if (need.id === id) {
        return {
          ...need,
          done: !need.done,
        };
      }

      return need;
    });

    gravarLista(newList, 'Falha ao atualizar a necessidade.');
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

    return meuAbrigo != null && need.abrigoId === meuAbrigo.id;
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

  function visiveis() {
    const texto = busca.trim().toLowerCase();

    return needs.filter((need) => {
      if (!combinaComFiltro(need)) {
        return false;
      }

      return !texto || need.title.toLowerCase().indexOf(texto) >= 0;
    });
  }

  function minhaReserva(need) {
    return (
      conta != null && need.reserva != null && need.reserva.por === conta.email
    );
  }

  // "Vou doar isto" não marca a necessidade como atendida: quem confirma
  // que o item chegou é o abrigo. O que fica registrado é a reserva, para
  // dois doadores não levarem a mesma coisa e o abrigo saber que alguém
  // está a caminho.
  function confirmarReserva(need) {
    if (conta == null) {
      Alert.alert('Erro', 'Não foi possível ler a sua conta.');

      return;
    }

    Alert.alert(
      'Vou doar este item',
      'O abrigo vai ver que você se ofereceu para levar ' + need.title +
        '. Combine a entrega pelo contato do abrigo, na aba do mapa.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Confirmar',
          onPress: () => reservar(need),
        },
      ]
    );
  }

  async function reservar(need) {
    const doacao = {
      id: Date.now().toString(),
      tipo: ITEM,
      item: need.title,
      abrigo: need.abrigoNome || 'Abrigo não informado',
      valor: 0,
      conta: conta.email,
      data: new Date().toISOString(),
    };

    const novaLista = needs.map((item) => {
      if (item.id !== need.id) {
        return item;
      }

      return {
        ...item,
        reserva: {
          por: conta.email,
          nome: conta.nome || conta.email,
          em: doacao.data,
          doacaoId: doacao.id,
        },
      };
    });

    setNeeds(novaLista);

    try {
      await saveNeeds(novaLista);
      await registrarDoacao(doacao);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar a doação.');
    }
  }

  function confirmarDesistencia(need) {
    Alert.alert(
      'Desistir da doação',
      'O item volta a aparecer como disponível para outra pessoa levar.',
      [
        {
          text: 'Voltar',
          style: 'cancel',
        },
        {
          text: 'Desistir',
          style: 'destructive',
          onPress: () => soltar(need),
        },
      ]
    );
  }

  async function soltar(need) {
    const doacaoId = need.reserva ? need.reserva.doacaoId : null;

    const novaLista = needs.map((item) => {
      if (item.id !== need.id) {
        return item;
      }

      const semReserva = { ...item };

      delete semReserva.reserva;

      return semReserva;
    });

    setNeeds(novaLista);

    try {
      await saveNeeds(novaLista);

      if (doacaoId) {
        await apagarDoacao(doacaoId);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível cancelar a doação.');
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

    if (gerencia) {
      return 'Cadastre acima o que o abrigo está precisando.';
    }

    return 'Nenhum abrigo publicou necessidades ainda.';
  }

  function renderNeed({ item }) {
    return (
      <NeedItem
        need={item}
        onToggle={toggleNeed}
        onDelete={confirmDelete}
        onReservar={confirmarReserva}
        onCancelarReserva={confirmarDesistencia}
        minhaReserva={minhaReserva(item)}
        somenteLeitura={!podeMexer(item)}
      />
    );
  }

  const lista = visiveis();
  const atendidas = lista.filter((need) => need.done).length;
  const reservadas = lista.filter((need) => need.reserva && !need.done).length;

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
              <Pressable onPress={() => setBusca('')}>
                <Ionicons name="close-circle" size={17} color="#9A8F7E" />
              </Pressable>
            ) : null}
          </View>
        )}

        {gerencia && meuAbrigo && (
          <View style={styles.vinculo}>
            <Ionicons name="business" size={14} color={colors.primary} />

            <Text style={styles.vinculoTexto}>
              Cadastrando para {meuAbrigo.nome}
            </Text>
          </View>
        )}

        {gerencia && ehGestor(conta) && !meuAbrigo && (
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

        {gerencia ? (
          <NeedForm onAdd={addNeed} />
        ) : (
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
