import { colors } from '../theme/colors';

// Os quatro perfis da seção 2 da documentação. O perfil é escolhido pela
// própria pessoa e guardado na conta: ele decide o que o aplicativo
// oferece, não o que ela pode provar que é. Sem servidor não há como
// validar — quem administra um abrigo de verdade só pode ser confirmado
// quando existir backend.
export const PERFIS = [
  {
    id: 'gestor',
    nome: 'Gestor do abrigo',
    descricao: 'Cadastra o abrigo e mantém a lista de necessidades',
    icone: 'business',
    cor: colors.primary,
  },

  {
    id: 'voluntario',
    nome: 'Voluntário',
    descricao: 'Participa das atividades e registra o que aconteceu',
    icone: 'people',
    cor: colors.supportGreen,
  },

  {
    id: 'doador',
    nome: 'Doador',
    descricao: 'Vê o que os abrigos precisam e contribui',
    icone: 'heart',
    cor: colors.supportPink,
  },

  {
    id: 'visitante',
    nome: 'Visitante',
    descricao: 'Conhece os abrigos da região e agenda visitas',
    icone: 'walk',
    cor: colors.supportBlue,
  },
];

export function buscarPerfil(id) {
  return PERFIS.find((perfil) => perfil.id === id) || null;
}

export function ehGestor(conta) {
  return conta != null && conta.perfil === 'gestor';
}

// Contas criadas antes do campo perfil existir não têm o campo. Tratamos
// essas como gestor, senão quem já usava o app perderia o formulário de
// necessidades sem entender por quê.
export function podeGerenciarNecessidades(conta) {
  if (conta == null) {
    return false;
  }

  return conta.perfil === undefined || conta.perfil === 'gestor';
}

// O que cada perfil faz primeiro. A Home era igual para todo mundo: quem
// só queria doar via "Registrar", que é tarefa de quem trabalha no
// abrigo, e quem administra via "Doar", como se fosse doar para si mesmo.
//
// O destino é o nome da tela. Uns são abas e outros são telas de fora das
// abas, mas o navigate resolve os dois do mesmo jeito.
const ABRIGOS = {
  id: 'abrigos',
  rotulo: 'Abrigos',
  icone: 'location',
  cor: colors.supportBlue,
  destino: 'Mapa',
};

const DOAR = {
  id: 'doar',
  rotulo: 'Doar',
  icone: 'heart',
  cor: colors.supportGreen,
  destino: 'Donate',
};

const REGISTRAR = {
  id: 'registrar',
  rotulo: 'Registrar',
  icone: 'camera',
  cor: colors.supportPink,
  destino: 'Agenda',
};

const NECESSIDADES = {
  id: 'necessidades',
  rotulo: 'Necessidades',
  icone: 'list',
  cor: colors.primary,
  destino: 'Doações',
};

const HISTORICO = {
  id: 'historico',
  rotulo: 'Meu histórico',
  icone: 'time',
  cor: colors.supportPink,
  destino: 'History',
};

const ACOES = {
  gestor: [NECESSIDADES, REGISTRAR, ABRIGOS],
  voluntario: [REGISTRAR, ABRIGOS, DOAR],
  doador: [DOAR, ABRIGOS, HISTORICO],
  visitante: [ABRIGOS, DOAR, NECESSIDADES],
};

export function acoesDoPerfil(conta) {
  if (conta == null || conta.perfil === undefined) {
    return ACOES.gestor;
  }

  return ACOES[conta.perfil] || ACOES.doador;
}
