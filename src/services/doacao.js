// As formas pelas quais uma casa de acolhimento recebe doação hoje,
// apuradas no que as próprias instituições publicam nas suas páginas de
// "como ajudar": Pix, transferência com os dados da conta, uma página
// própria para cartão e recorrente, doação de itens, apadrinhamento e a
// destinação do imposto de renda ao fundo da infância.
//
// A separação que importa aqui é entre o que o aplicativo consegue gerar
// e o que ele só consegue levar até. O código Pix é montado no aparelho,
// porque a especificação é pública. Boleto, cartão e doação recorrente
// não: dependem de convênio com banco ou de instituição de pagamento, e
// um boleto inventado não é pago por ninguém. Para esses, o abrigo
// cadastra o endereço da sua própria página e o aplicativo abre.

export const PIX = 'pix';
export const TRANSFERENCIA = 'transferencia';
export const SITE = 'site';

export function temPix(abrigo) {
  return Boolean(abrigo && abrigo.chavePix);
}

export function dadosBancarios(abrigo) {
  const dados = (abrigo && abrigo.banco) || {};

  return {
    instituicao: dados.instituicao || '',
    agencia: dados.agencia || '',
    conta: dados.conta || '',
    titular: dados.titular || '',
    cnpj: dados.cnpj || '',
  };
}

export function temTransferencia(abrigo) {
  const dados = dadosBancarios(abrigo);

  return Boolean(dados.instituicao && dados.agencia && dados.conta);
}

// O bloco de texto que a pessoa cola no aplicativo do banco ou manda
// para alguém. É o mesmo formato que as instituições publicam.
export function textoDaTransferencia(abrigo) {
  const dados = dadosBancarios(abrigo);
  const linhas = [];

  if (dados.titular) {
    linhas.push('Favorecido: ' + dados.titular);
  }

  if (dados.cnpj) {
    linhas.push('CNPJ: ' + dados.cnpj);
  }

  linhas.push('Banco: ' + dados.instituicao);
  linhas.push('Agência: ' + dados.agencia);
  linhas.push('Conta: ' + dados.conta);

  return linhas.join('\n');
}

// Quem digita costuma escrever o endereço sem o começo. Sem isso o
// Linking não abre nada e parece que o botão está quebrado.
export function normalizarLink(texto) {
  const limpo = (texto || '').trim();

  if (!limpo) {
    return '';
  }

  if (/^https?:\/\//i.test(limpo)) {
    return limpo;
  }

  return 'https://' + limpo;
}

// Conferência de formato, não de existência: saber se a página existe
// mesmo exigiria acessá-la, e não é trabalho de um formulário.
export function linkValido(texto) {
  const endereco = normalizarLink(texto);

  return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(endereco);
}

export function temSite(abrigo) {
  return Boolean(abrigo && abrigo.linkDoacao);
}

export function temApadrinhamento(abrigo) {
  return Boolean(abrigo && abrigo.apadrinhamento);
}

// O registro no conselho municipal é o que permite ao abrigo receber
// recursos do fundo da infância. Sem ele a seção do imposto de renda não
// faz sentido para aquele abrigo, e some.
export function temFundoDaInfancia(abrigo) {
  return Boolean(abrigo && abrigo.cmdca);
}

// As formas de doar dinheiro que aquele abrigo realmente oferece. Vazia
// quando ele não cadastrou nenhuma, e aí a tela diz isso em vez de
// mostrar botão que não leva a lugar nenhum.
// O que aquele abrigo ainda não cadastrou. Serve para a tela dizer que
// as outras formas existem: escondendo o que falta, quem doa conclui que
// o aplicativo só sabe fazer Pix, e quem administra o abrigo nunca
// descobre que podia ter cadastrado o resto.
export function formasQueFaltam(abrigo) {
  const faltando = [];

  if (!temPix(abrigo)) {
    faltando.push('Pix');
  }

  if (!temTransferencia(abrigo)) {
    faltando.push('transferência');
  }

  if (!temSite(abrigo)) {
    faltando.push('página para cartão ou boleto');
  }

  return faltando;
}

// Junta a lista do jeito que se fala: "a, b e c".
export function juntarComE(lista) {
  if (lista.length <= 1) {
    return lista.join('');
  }

  return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
}

export function formasDeDinheiro(abrigo) {
  const formas = [];

  if (temPix(abrigo)) {
    formas.push({
      id: PIX,
      nome: 'Pix',
      icone: 'flash',
      descricao: 'Código gerado na hora, com o valor já preenchido',
    });
  }

  if (temTransferencia(abrigo)) {
    formas.push({
      id: TRANSFERENCIA,
      nome: 'Transferência',
      icone: 'business',
      descricao: 'Dados da conta para transferir ou depositar',
    });
  }

  if (temSite(abrigo)) {
    formas.push({
      id: SITE,
      nome: 'Cartão',
      icone: 'card',
      descricao: 'Cartão, boleto ou doação mensal, na página do abrigo',
    });
  }

  return formas;
}
