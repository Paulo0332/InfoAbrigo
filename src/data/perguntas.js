// Perguntas fixas para a recuperação de senha.
//
// Escolher de uma lista é melhor que escrever a própria pergunta: quem
// escreve costuma criar uma que não lembra meses depois, e a resposta
// livre já basta para não ser adivinhável.
//
// A lista mora aqui porque duas telas precisam dela: o cadastro, que
// pede a pergunta na criação da conta, e o perfil, que permite definir
// ou trocar depois — sem isso, conta criada antes desta funcionalidade
// existir ficava sem nenhuma forma de recuperar a senha.
export const PERGUNTAS = [
  'Qual era o nome do seu primeiro animal de estimação?',
  'Em que cidade a sua mãe nasceu?',
  'Qual foi o nome da sua primeira escola?',
  'Qual é o seu prato preferido?',
];
