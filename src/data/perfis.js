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
