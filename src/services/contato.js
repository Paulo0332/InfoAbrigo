// Um abrigo não tem um contato só. Quem vai doar um móvel prefere ligar,
// quem quer perguntar do horário manda mensagem, quem representa uma
// empresa escreve e-mail e quem só quer conhecer o trabalho procura o
// Instagram. Guardar tudo num campo de texto livre obrigava a adivinhar
// o que a pessoa digitou — daí estes campos separados, cada um com a sua
// máscara e o seu link.

// Telefone brasileiro tem 10 dígitos (fixo) ou 11 (celular, com o nove
// na frente). Passar disso é engano de digitação, e cortar aqui evita o
// número quebrado que não abre no discador.
const MAXIMO_DIGITOS = 11;

export function apenasDigitos(texto) {
  return (texto || '').replace(/[^0-9]/g, '');
}

// A máscara é aplicada a cada tecla, então ela precisa funcionar também
// com o número pela metade e ao apagar de trás para frente.
export function formatarTelefone(texto) {
  const d = apenasDigitos(texto).slice(0, MAXIMO_DIGITOS);

  if (d.length <= 2) {
    return d;
  }

  const ddd = '(' + d.slice(0, 2) + ') ';

  if (d.length <= 6) {
    return ddd + d.slice(2);
  }

  // O traço fica sempre antes dos quatro últimos dígitos: assim ele anda
  // sozinho conforme o número é fixo (10) ou celular (11).
  const corte = d.length > 10 ? 7 : 6;

  return ddd + d.slice(2, corte) + '-' + d.slice(corte);
}

export function telefoneValido(texto) {
  const tamanho = apenasDigitos(texto).length;

  return tamanho === 10 || tamanho === 11;
}

// Celular no Brasil tem onze dígitos: dois de DDD e nove do número. Fixo
// tem dez. Separar as duas contas deixa o aviso específico, em vez do
// genérico "telefone inválido" que não diz o que corrigir.
export function celularValido(texto) {
  return apenasDigitos(texto).length === 11;
}

export function fixoValido(texto) {
  return apenasDigitos(texto).length === 10;
}

// Uma expressão que aceite todo e-mail válido do mundo é enorme e ainda
// erra. Esta barra só o engano óbvio: sem arroba, sem ponto depois dela
// ou com espaço no meio.
export function emailValido(texto) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((texto || '').trim());
}

// A pessoa cola o link inteiro, escreve com arroba ou digita só o nome.
// Os três viram a mesma coisa: o nome do perfil, sem enfeite.
export function formatarInstagram(texto) {
  let limpo = (texto || '').trim().toLowerCase();

  limpo = limpo.replace(/^https?:\/\//, '');
  limpo = limpo.replace(/^www\./, '');
  limpo = limpo.replace(/^instagram\.com\//, '');
  limpo = limpo.replace(/^@/, '');
  limpo = limpo.replace(/[/?#].*$/, '');

  return limpo.replace(/[^a-z0-9._]/g, '');
}

export function linkTelefone(texto) {
  return 'tel:' + apenasDigitos(texto);
}

// O WhatsApp espera o número com o código do país na frente, e sem
// parêntese nem traço.
export function linkWhatsapp(texto, mensagem) {
  const url = 'https://wa.me/55' + apenasDigitos(texto);

  if (!mensagem) {
    return url;
  }

  return url + '?text=' + encodeURIComponent(mensagem);
}

export function linkEmail(texto, assunto) {
  const endereco = (texto || '').trim();

  if (!assunto) {
    return 'mailto:' + endereco;
  }

  return 'mailto:' + endereco + '?subject=' + encodeURIComponent(assunto);
}

export function linkInstagram(texto) {
  return 'https://instagram.com/' + formatarInstagram(texto);
}

const VAZIO = { celular: '', fixo: '', email: '', instagram: '' };

// Os abrigos cadastrados antes destes campos guardavam tudo num texto
// só. Em vez de perder o dado, ele é lido como está: com arroba vira
// e-mail, com cara de número vira telefone.
export function contatosDoAbrigo(abrigo) {
  if (abrigo == null) {
    return { ...VAZIO };
  }

  if (abrigo.contatos) {
    return { ...VAZIO, ...abrigo.contatos };
  }

  const antigo = (abrigo.contato || '').trim();

  if (emailValido(antigo)) {
    return { ...VAZIO, email: antigo };
  }

  if (telefoneValido(antigo)) {
    const campo = apenasDigitos(antigo).length === 11 ? 'celular' : 'fixo';

    return { ...VAZIO, [campo]: formatarTelefone(antigo) };
  }

  return { ...VAZIO };
}

export function temAlgumContato(contatos) {
  return Boolean(
    contatos.celular || contatos.fixo || contatos.email || contatos.instagram
  );
}

// Linha curta para o cartão do mapa: o primeiro contato que existir, na
// ordem em que as pessoas costumam procurar.
export function resumirContatos(contatos) {
  if (contatos.celular) {
    return contatos.celular;
  }

  if (contatos.fixo) {
    return contatos.fixo;
  }

  if (contatos.email) {
    return contatos.email;
  }

  if (contatos.instagram) {
    return '@' + contatos.instagram;
  }

  return '';
}
