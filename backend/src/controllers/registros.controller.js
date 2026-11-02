import createError from 'http-errors';

import { Abrigo, Arquivo, Compromisso, Doacao, Necessidade } from '../models/registros.js';

const INTERNOS = ['_id', 'createdAt', 'updatedAt'];

// O registro sem os campos internos do banco, que o aplicativo não conhece.
function limpo(registro) {
  const copia = { ...registro };

  INTERNOS.forEach((campo) => delete copia[campo]);

  return copia;
}

// Regrava o documento inteiro. Um "set" comum manteria os campos que o
// aplicativo removeu, e a foto apagada voltaria na sincronização seguinte.
async function gravar(Modelo, id, dados) {
  return Modelo.findOneAndReplace(
    { id: id },
    { ...limpo(dados), id: id },
    { upsert: true, returnDocument: 'after', lean: true }
  );
}

async function listar(Modelo, filtro, res) {
  const lista = await Modelo.find(filtro).sort({ createdAt: -1, _id: -1 }).lean();

  res.json(lista.map(limpo));
}

// ---------------- Abrigos ----------------

export async function listarAbrigos(req, res) {
  await listar(Abrigo, {}, res);
}

export async function gravarAbrigo(req, res) {
  const atual = await Abrigo.findOne({ id: req.params.id }).lean();

  if (atual && atual.dono !== req.email) {
    throw createError(403, 'Só quem cadastrou o abrigo pode alterá-lo.');
  }

  const salvo = await gravar(Abrigo, req.params.id, { ...req.body, dono: req.email });

  res.json(limpo(salvo));
}

export async function apagarAbrigo(req, res) {
  const atual = await Abrigo.findOne({ id: req.params.id }).lean();

  if (atual && atual.dono !== req.email) {
    throw createError(403, 'Só quem cadastrou o abrigo pode excluí-lo.');
  }

  await Necessidade.deleteMany({ abrigoId: req.params.id });
  await Abrigo.deleteOne({ id: req.params.id });

  res.status(204).end();
}

// ---------------- Necessidades ----------------

async function administra(necessidade, email) {
  if (necessidade.abrigoId) {
    const abrigo = await Abrigo.findOne({ id: necessidade.abrigoId }).lean();

    if (abrigo) {
      return abrigo.dono === email;
    }
  }

  return (necessidade.criadoPor || email) === email;
}

// Junta as contribuições do que está gravado com o que chegou.
//
// O celular envia a necessidade inteira, com a lista como ele a conhecia. Se
// isso substituísse o que está no banco, quem doou enquanto o outro estava sem
// internet teria a promessa apagada sem saber. A regra: cada pessoa só mexe na
// própria contribuição, e só quem administra marca que algo foi entregue.
export function juntarContribuicoes(gravadas, recebidas, email, ehGestor) {
  const lista = [];

  gravadas.forEach((gravada) => {
    const nova = recebidas.find((item) => String(item.id) === String(gravada.id));

    if (gravada.por === email) {
      if (nova) {
        lista.push({
          ...nova,
          por: email,
          entregue: ehGestor ? nova.entregue === true : gravada.entregue === true,
        });
      }

      return;
    }

    lista.push(
      ehGestor && nova ? { ...gravada, entregue: nova.entregue === true } : gravada
    );
  });

  recebidas.forEach((nova) => {
    const jaExiste = gravadas.some((item) => String(item.id) === String(nova.id));

    if (!jaExiste && nova.por === email) {
      lista.push({ ...nova, entregue: ehGestor && nova.entregue === true });
    }
  });

  return lista;
}

export async function listarNecessidades(req, res) {
  await listar(Necessidade, {}, res);
}

export async function gravarNecessidade(req, res) {
  const atual = await Necessidade.findOne({ id: req.params.id }).lean();
  // O id da doação sempre como texto: é por ele que o abrigo a encontra depois.
  const recebidas = (req.body.contribuicoes || []).map((item) =>
    item.doacaoId == null ? item : { ...item, doacaoId: String(item.doacaoId) }
  );

  if (!atual) {
    if (!(await administra({ abrigoId: req.body.abrigoId }, req.email))) {
      throw createError(403, 'Só quem administra o abrigo pode criar necessidades nele.');
    }

    const nova = await gravar(Necessidade, req.params.id, {
      ...req.body,
      criadoPor: req.email,
      contribuicoes: juntarContribuicoes([], recebidas, req.email, true),
    });

    return res.json(limpo(nova));
  }

  const ehGestor = await administra(atual, req.email);
  const contribuicoes = juntarContribuicoes(
    atual.contribuicoes || [],
    recebidas,
    req.email,
    ehGestor
  );

  // Quem não administra só altera a própria contribuição: título, meta e
  // situação da necessidade continuam como estão no banco.
  const base = ehGestor
    ? { ...req.body, criadoPor: atual.criadoPor, abrigoId: atual.abrigoId ?? req.body.abrigoId }
    : atual;

  const salva = await gravar(Necessidade, req.params.id, { ...base, contribuicoes });

  return res.json(limpo(salva));
}

export async function apagarNecessidade(req, res) {
  const atual = await Necessidade.findOne({ id: req.params.id }).lean();

  if (atual && !(await administra(atual, req.email))) {
    throw createError(403, 'Só quem administra o abrigo pode excluir a necessidade.');
  }

  await Necessidade.deleteOne({ id: req.params.id });

  res.status(204).end();
}

// ---------------- Doações ----------------

export async function listarDoacoes(req, res) {
  await listar(Doacao, { conta: req.email }, res);
}

export async function gravarDoacao(req, res) {
  const atual = await Doacao.findOne({ id: req.params.id }).lean();

  if (atual && atual.conta !== req.email) {
    throw createError(403, 'Esta doação é de outra pessoa.');
  }

  const salva = await gravar(Doacao, req.params.id, { ...req.body, conta: req.email });

  res.json(limpo(salva));
}

export async function apagarDoacao(req, res) {
  const atual = await Doacao.findOne({ id: req.params.id }).lean();

  if (atual && atual.conta !== req.email) {
    throw createError(403, 'Esta doação é de outra pessoa.');
  }

  await Doacao.deleteOne({ id: req.params.id });

  res.status(204).end();
}

// A situação pode ser mudada por quem doou ou por quem recebeu: é o abrigo que
// sabe que o item chegou. Quem recebeu é descoberto pela necessidade que tem
// aquela doação como contribuição.
export async function mudarSituacao(req, res) {
  const atual = await Doacao.findOne({ id: req.params.id }).lean();

  if (!atual) {
    return res.status(204).end();
  }

  if (atual.conta !== req.email) {
    const necessidade = await Necessidade.findOne({
      'contribuicoes.doacaoId': req.params.id,
    }).lean();

    if (!necessidade || !(await administra(necessidade, req.email))) {
      throw createError(403, 'Só quem doou ou o abrigo podem mudar esta situação.');
    }
  }

  const trocas = { situacao: req.body.situacao };
  const operacao = { $set: trocas };

  if (req.body.situacao === 'confirmada') {
    trocas.recebidaEm = new Date().toISOString();
  } else {
    operacao.$unset = { recebidaEm: '' };
  }

  await Doacao.updateOne({ id: req.params.id }, operacao);

  return res.status(204).end();
}

// ---------------- Compromissos ----------------

export async function listarCompromissos(req, res) {
  await listar(Compromisso, { conta: req.email }, res);
}

export async function gravarCompromisso(req, res) {
  const atual = await Compromisso.findOne({ id: req.params.id }).lean();

  if (atual && atual.conta !== req.email) {
    throw createError(403, 'Este compromisso é de outra pessoa.');
  }

  const salvo = await gravar(Compromisso, req.params.id, { ...req.body, conta: req.email });

  res.json(limpo(salvo));
}

export async function apagarCompromisso(req, res) {
  const atual = await Compromisso.findOne({ id: req.params.id }).lean();

  if (atual && atual.conta !== req.email) {
    throw createError(403, 'Este compromisso é de outra pessoa.');
  }

  await Compromisso.deleteOne({ id: req.params.id });

  res.status(204).end();
}

// ---------------- Fotos ----------------

// O tipo vem dos primeiros bytes, e não do que o aplicativo declara: é o que
// impede guardar outra coisa disfarçada de imagem num endereço público.
function tipoDaImagem(dados) {
  if (dados[0] === 0xff && dados[1] === 0xd8 && dados[2] === 0xff) {
    return 'image/jpeg';
  }

  if (dados.subarray(0, 4).toString('latin1') === '\x89PNG') {
    return 'image/png';
  }

  return null;
}

export async function enviarArquivo(req, res) {
  const dados = Buffer.from(req.body.base64, 'base64');
  const mime = tipoDaImagem(dados);

  if (!mime) {
    throw createError(400, 'Envie uma imagem JPEG ou PNG.');
  }

  const arquivo = await Arquivo.create({ dono: req.email, mime, dados });

  res.status(201).json({ caminho: '/arquivos/' + arquivo._id });
}

export async function verArquivo(req, res) {
  const arquivo = /^[0-9a-f]{24}$/.test(req.params.id)
    ? await Arquivo.findById(req.params.id)
    : null;

  if (!arquivo) {
    throw createError(404, 'Imagem não encontrada.');
  }

  res.set('Cache-Control', 'public, max-age=86400').type(arquivo.mime).send(arquivo.dados);
}
