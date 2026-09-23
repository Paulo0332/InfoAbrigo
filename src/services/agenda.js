import AsyncStorage from '@react-native-async-storage/async-storage';
import { carregarAtividades } from './activities';

const STORAGE_KEY = '@infoabrigo:agenda';

// A aba se chamava Agenda e entregava um álbum de fotos. Agora ela guarda
// compromissos com hora marcada — visitar o abrigo, levar a doação que
// foi prometida, trabalhar como voluntário, conversar sobre adoção — e a
// câmera passa a ter um lugar que faz sentido: registrar o que aconteceu
// naquele compromisso.
//
// Os registros de foto que já existiam não se perdem. Eles entram aqui
// como compromissos que já aconteceram, com a foto anexada, na data em
// que foram criados.
export const TIPOS = [
  {
    id: 'visita',
    nome: 'Visita ao abrigo',
    icone: 'walk',
    descricao: 'Conhecer o abrigo e as crianças',
  },
  {
    id: 'entrega',
    nome: 'Entrega de doação',
    icone: 'cube',
    descricao: 'Levar o que você se ofereceu para doar',
  },
  {
    id: 'voluntariado',
    nome: 'Trabalho voluntário',
    icone: 'people',
    descricao: 'Ajudar em alguma atividade do abrigo',
  },
  {
    id: 'adocao',
    nome: 'Conversa sobre adoção',
    icone: 'heart',
    descricao: 'Falar com a equipe sobre o processo',
  },
];

export function buscarTipo(id) {
  return TIPOS.find((tipo) => tipo.id === id) || TIPOS[0];
}

export async function carregarAgenda() {
  try {
    const dados = await AsyncStorage.getItem(STORAGE_KEY);

    if (dados != null) {
      return JSON.parse(dados);
    }

    // Primeira abertura depois da mudança: os registros de foto viram
    // compromissos já acontecidos, para ninguém perder o que fotografou.
    const antigas = await migrarAtividades();

    if (antigas.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(antigas));
    }

    return antigas;
  } catch (error) {
    console.log('Erro ao carregar a agenda:', error);

    return [];
  }
}

async function migrarAtividades() {
  try {
    const atividades = await carregarAtividades();

    return atividades.map((atividade) => ({
      id: atividade.id,
      tipo: 'visita',
      abrigoId: null,
      abrigoNome: null,
      // O id vem do Date.now do cadastro, então ele guarda a data em que
      // a foto foi tirada melhor do que o texto já formatado.
      quando: new Date(Number(atividade.id) || Date.now()).toISOString(),
      observacao: '',
      conta: null,
      registro: {
        uri: atividade.uri,
        titulo: atividade.title,
        descricao: atividade.description,
        naGaleria: atividade.saved === true,
      },
    }));
  } catch (error) {
    console.log('Erro ao trazer os registros antigos:', error);

    return [];
  }
}

export async function salvarAgenda(lista) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch (error) {
    console.log('Erro ao salvar a agenda:', error);

    throw error;
  }
}

// A agenda é de quem marcou. Compromissos de antes deste campo não têm
// dono e continuam aparecendo para todos, como o resto do que veio do
// formato de uma conta só.
export function compromissosDaConta(lista, conta) {
  if (conta == null) {
    return lista;
  }

  return lista.filter((item) => item.conta == null || item.conta === conta.email);
}

const DIA = 24 * 60 * 60 * 1000;

function soODia(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

// Diferença em dias inteiros, ignorando a hora: um compromisso às 23h de
// hoje e outro às 1h de amanhã estão a um dia de distância, não a duas
// horas.
export function diasAte(iso) {
  const hoje = soODia(new Date());
  const alvo = soODia(new Date(iso));

  return Math.round((alvo - hoje) / DIA);
}

export function jaPassou(iso) {
  return new Date(iso).getTime() < Date.now();
}

export function ehHoje(iso) {
  return diasAte(iso) === 0;
}

export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function formatarHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// O quanto falta, dito como as pessoas falam. É o que transforma uma data
// numa informação útil de relance.
export function quandoAcontece(iso) {
  const dias = diasAte(iso);

  if (dias === 0) {
    return jaPassou(iso) ? 'Hoje, mais cedo' : 'Hoje às ' + formatarHora(iso);
  }

  if (dias === 1) {
    return 'Amanhã às ' + formatarHora(iso);
  }

  if (dias === -1) {
    return 'Ontem';
  }

  if (dias > 1 && dias <= 7) {
    return 'Em ' + dias + ' dias';
  }

  if (dias < -1 && dias >= -7) {
    return 'Há ' + Math.abs(dias) + ' dias';
  }

  return formatarData(iso);
}

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

export function diaDoMes(iso) {
  return String(new Date(iso).getDate()).padStart(2, '0');
}

export function mesCurto(iso) {
  return MESES[new Date(iso).getMonth()];
}

export function apenasDigitos(texto) {
  return (texto || '').replace(/[^0-9]/g, '');
}

export function formatarCampoData(texto) {
  const d = apenasDigitos(texto).slice(0, 8);

  if (d.length <= 2) {
    return d;
  }

  if (d.length <= 4) {
    return d.slice(0, 2) + '/' + d.slice(2);
  }

  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
}

export function formatarCampoHora(texto) {
  const d = apenasDigitos(texto).slice(0, 4);

  if (d.length <= 2) {
    return d;
  }

  return d.slice(0, 2) + ':' + d.slice(2);
}

// Junta o que foi digitado em dia, mês, ano e hora. Devolve nulo quando
// a data não existe — 31 de fevereiro entra no campo, mas não no
// calendário, e o Date do JavaScript aceita calado, virando 3 de março.
export function montarQuando(data, hora) {
  const d = apenasDigitos(data);
  const h = apenasDigitos(hora);

  if (d.length !== 8 || h.length !== 4) {
    return null;
  }

  const dia = Number(d.slice(0, 2));
  const mes = Number(d.slice(2, 4));
  const ano = Number(d.slice(4));
  const horas = Number(h.slice(0, 2));
  const minutos = Number(h.slice(2));

  if (mes < 1 || mes > 12 || dia < 1 || horas > 23 || minutos > 59) {
    return null;
  }

  const quando = new Date(ano, mes - 1, dia, horas, minutos);

  if (quando.getDate() !== dia || quando.getMonth() !== mes - 1) {
    return null;
  }

  return quando.toISOString();
}

// Atalhos de data para quem está marcando agora: a maior parte dos
// compromissos é para hoje, amanhã ou nos próximos dias.
export function dataDaquiA(dias) {
  const alvo = new Date(Date.now() + dias * DIA);

  return (
    String(alvo.getDate()).padStart(2, '0') + '/' +
    String(alvo.getMonth() + 1).padStart(2, '0') + '/' +
    alvo.getFullYear()
  );
}

// Próximos primeiro, do mais perto para o mais longe; os que já passaram
// vêm depois, do mais recente para o mais antigo.
export function ordenarAgenda(lista) {
  const futuros = lista
    .filter((item) => !jaPassou(item.quando))
    .sort((a, b) => new Date(a.quando) - new Date(b.quando));

  const passados = lista
    .filter((item) => jaPassou(item.quando))
    .sort((a, b) => new Date(b.quando) - new Date(a.quando));

  return { futuros: futuros, passados: passados };
}
