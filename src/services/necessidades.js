// Quanto ainda falta, de verdade.
//
// A necessidade nasceu tudo-ou-nada: ou estava atendida ou não estava, e
// a quantidade era um texto solto, "10 pacotes". Com isso não dava para
// dizer que três chegaram e faltam sete — e é isso que quem quer ajudar
// precisa saber antes de decidir o que levar.
//
// Agora ela tem uma meta em número, uma unidade e uma lista de
// contribuições que somam. Duas somas saem daí, e elas são coisas
// diferentes: o que foi prometido e o que o abrigo confirmou ter
// recebido. Misturar as duas faria a lista dizer que a doação chegou
// quando ela ainda está no carro de alguém.

// As necessidades antigas guardavam a quantidade como texto livre. Em vez
// de descartá-las, lemos o número de dentro do texto: "10 pacotes" vira
// meta 10 na unidade "pacotes".
function lerQuantidadeAntiga(texto) {
  const encontrado = /^\s*(\d+)\s*(.*)$/.exec(texto || '');

  if (encontrado == null) {
    return { alvo: null, unidade: (texto || '').trim() };
  }

  return {
    alvo: Number(encontrado[1]),
    unidade: encontrado[2].trim(),
  };
}

export function alvoDaNecessidade(need) {
  if (need.alvo != null) {
    return Number(need.alvo);
  }

  return lerQuantidadeAntiga(need.quantidade).alvo;
}

export function unidadeDaNecessidade(need) {
  if (need.unidade) {
    return need.unidade;
  }

  return lerQuantidadeAntiga(need.quantidade).unidade;
}

export function temMeta(need) {
  const alvo = alvoDaNecessidade(need);

  return alvo != null && alvo > 0;
}

// As necessidades de antes desta mudança tinham uma reserva só, de uma
// pessoa, pelo item inteiro. Ela é lida como a primeira contribuição.
export function contribuicoesDaNecessidade(need) {
  if (Array.isArray(need.contribuicoes)) {
    return need.contribuicoes;
  }

  if (need.reserva == null) {
    return [];
  }

  return [
    {
      id: need.reserva.doacaoId || need.reserva.em,
      por: need.reserva.por,
      nome: need.reserva.nome,
      quantidade: alvoDaNecessidade(need) || 1,
      em: need.reserva.em,
      doacaoId: need.reserva.doacaoId,
      entregue: need.done === true,
    },
  ];
}

function somar(lista) {
  return lista.reduce((total, item) => total + Number(item.quantidade || 0), 0);
}

export function prometido(need) {
  return somar(contribuicoesDaNecessidade(need));
}

export function recebido(need) {
  return somar(contribuicoesDaNecessidade(need).filter((item) => item.entregue));
}

// O que ainda ninguém se ofereceu para levar. Nunca negativo: se alguém
// levou mais do que o pedido, falta zero, não falta menos que nada.
export function faltam(need) {
  const alvo = alvoDaNecessidade(need);

  if (alvo == null) {
    return null;
  }

  return Math.max(0, alvo - prometido(need));
}

export function estaCompleta(need) {
  return temMeta(need) && faltam(need) === 0;
}

// Quanto da barra preencher, de 0 a 100, pelo que já foi recebido.
export function percentualRecebido(need) {
  const alvo = alvoDaNecessidade(need);

  if (alvo == null || alvo === 0) {
    return need.done ? 100 : 0;
  }

  return Math.min(100, Math.round((recebido(need) / alvo) * 100));
}

export function percentualPrometido(need) {
  const alvo = alvoDaNecessidade(need);

  if (alvo == null || alvo === 0) {
    return need.done ? 100 : 0;
  }

  return Math.min(100, Math.round((prometido(need) / alvo) * 100));
}

// A linha que o cartão mostra. Sem meta, a necessidade continua sendo
// tudo-ou-nada, e a frase muda junto.
export function textoDoQueFalta(need) {
  if (!temMeta(need)) {
    return need.done ? 'Atendida' : 'Sem quantidade definida';
  }

  const alvo = alvoDaNecessidade(need);
  const unidade = unidadeDaNecessidade(need);
  const sufixo = unidade ? ' ' + unidade : '';
  const recebidos = recebido(need);

  if (recebidos >= alvo) {
    return 'Completa — ' + alvo + sufixo + ' recebidos';
  }

  const restam = faltam(need);

  if (restam === 0) {
    // Tudo prometido e nada entregue ainda. O zero é verdade, mas
    // responde a outra pergunta: quem acabou de completar a meta quer
    // ver o total que vem vindo, e um "0 de 10" ali parece defeito.
    if (recebidos === 0) {
      return 'Tudo prometido — ' + alvo + sufixo + ' a caminho';
    }

    return 'Tudo prometido — ' + recebidos + ' de ' + alvo + sufixo + ' já chegaram';
  }

  return 'Faltam ' + restam + ' de ' + alvo + sufixo;
}

export function quantidadeValida(texto, need) {
  const numero = Number((texto || '').replace(/[^0-9]/g, ''));

  if (!numero || numero <= 0) {
    return false;
  }

  return !temMeta(need) || numero <= faltam(need);
}
