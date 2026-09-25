// Monta o "copia e cola" do Pix — o BR Code — dentro do aparelho, sem
// servidor nenhum.
//
// O formato é o EMV do Banco Central: uma fila de campos, cada um escrito
// como identificador de dois dígitos, tamanho de dois dígitos e o valor.
// O último campo é a soma de verificação, que o banco confere antes de
// aceitar. Nada disso é segredo nem pede chave de integração: a
// especificação é pública.
//
// O limite honesto: o aplicativo monta o código, quem paga é o banco da
// pessoa. Nada de dinheiro passa por aqui, e é justamente por isso que
// cabe num trabalho sem servidor.

const GUI_PIX = 'BR.GOV.BCB.PIX';

// Sem categoria de comércio: 0000 é o código de "não informado", que é o
// caso de uma doação.
const MCC = '0000';

// 986 é o real, na tabela ISO 4217. 16 é "sem troco".
const MOEDA = '986';

// Cada campo é escrito assim: identificador, tamanho com dois dígitos e o
// conteúdo. O tamanho conta caracteres, então um nome com acento precisa
// ser limpo antes — por isso o semAcento mais abaixo.
function campo(id, valor) {
  const tamanho = String(valor.length).padStart(2, '0');

  return id + tamanho + valor;
}

// O BR Code aceita só o alfabeto básico. Acento e símbolo viram a letra
// sem acento ou somem, senão o banco recusa o código.
export function semAcento(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .-]/g, '')
    .trim();
}

// Soma de verificação CRC-16/CCITT-FALSE: polinômio 0x1021, começando em
// 0xFFFF, sem inverter bit nem resultado. O cálculo entra no próprio
// código, incluindo o "6304" do campo, e o resultado vai em quatro
// dígitos hexadecimais maiúsculos.
export function crc16(texto) {
  let resto = 0xffff;

  for (let i = 0; i < texto.length; i = i + 1) {
    resto = resto ^ (texto.charCodeAt(i) << 8);

    for (let bit = 0; bit < 8; bit = bit + 1) {
      if (resto & 0x8000) {
        resto = ((resto << 1) ^ 0x1021) & 0xffff;
      } else {
        resto = (resto << 1) & 0xffff;
      }
    }
  }

  return resto.toString(16).toUpperCase().padStart(4, '0');
}

// O valor vai com ponto e duas casas, sempre. Vazio significa "o pagador
// escolhe quanto", que também é válido.
function valorFormatado(valor) {
  const numero = Number(valor);

  if (!numero || numero <= 0) {
    return '';
  }

  return numero.toFixed(2);
}

// Monta o código completo. Devolve a string que o banco lê, tanto colada
// no aplicativo do banco quanto desenhada como QR.
export function montarCodigoPix(dados) {
  const chave = (dados.chave || '').trim();

  if (!chave) {
    return '';
  }

  // O nome e a cidade têm limite de 25 e 15 caracteres na especificação.
  const nome = semAcento(dados.nome).slice(0, 25) || 'ABRIGO';
  const cidade = semAcento(dados.cidade).slice(0, 15) || 'BRASIL';

  // O identificador da transação é o que volta no extrato de quem recebe.
  // Só o alfabeto básico, e o *** significa "sem identificador".
  const identificador = semAcento(dados.identificador)
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 25) || '***';

  const conta = campo('00', GUI_PIX) + campo('01', chave);
  const valor = valorFormatado(dados.valor);

  const corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', MCC) +
    campo('53', MOEDA) +
    (valor ? campo('54', valor) : '') +
    campo('58', 'BR') +
    campo('59', nome) +
    campo('60', cidade) +
    campo('62', campo('05', identificador));

  // O "6304" entra na conta da soma de verificação antes de ela existir:
  // é assim que a especificação manda.
  const comCampoDaSoma = corpo + '6304';

  return comCampoDaSoma + crc16(comCampoDaSoma);
}

// Chave Pix é uma de cinco coisas: CPF, CNPJ, telefone, e-mail ou uma
// chave aleatória de 32 caracteres. Conferimos o formato para o gestor
// não cadastrar um texto qualquer e a doação falhar no banco depois.
export function tipoDaChave(texto) {
  const limpo = (texto || '').trim();

  if (!limpo) {
    return null;
  }

  const digitos = limpo.replace(/[^0-9]/g, '');

  if (/^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/.test(limpo)) {
    return 'aleatoria';
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
    return 'email';
  }

  if (limpo.startsWith('+55') && digitos.length === 13) {
    return 'telefone';
  }

  if (digitos === limpo && digitos.length === 11) {
    return 'cpf';
  }

  if (digitos === limpo && digitos.length === 14) {
    return 'cnpj';
  }

  return null;
}

export function chaveValida(texto) {
  return tipoDaChave(texto) != null;
}

export function nomeDoTipo(tipo) {
  if (tipo === 'aleatoria') {
    return 'chave aleatória';
  }

  if (tipo === 'email') {
    return 'e-mail';
  }

  if (tipo === 'telefone') {
    return 'telefone';
  }

  if (tipo === 'cpf') {
    return 'CPF';
  }

  if (tipo === 'cnpj') {
    return 'CNPJ';
  }

  return '';
}
