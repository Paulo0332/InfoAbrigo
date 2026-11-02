import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import createError from 'http-errors';

import Conta from '../models/Conta.js';
import { Abrigo, Arquivo, Compromisso, Doacao, Necessidade } from '../models/registros.js';
import { criarToken } from '../middlewares/auth.js';

const derivar = promisify(scrypt);

// As mesmas perguntas de src/data/perguntas.js do aplicativo.
const PERGUNTAS = [
  'Qual era o nome do seu primeiro animal de estimação?',
  'Em que cidade a sua mãe nasceu?',
  'Qual foi o nome da sua primeira escola?',
  'Qual é o seu prato preferido?',
];

async function proteger(resumo) {
  const sal = randomBytes(16).toString('hex');
  const chave = await derivar(resumo, sal, 32);

  return sal + ':' + chave.toString('hex');
}

async function confere(resumo, protegida) {
  if (!resumo || !protegida) {
    return false;
  }

  const [sal, guardada] = protegida.split(':');
  const chave = await derivar(resumo, sal, 32);

  return timingSafeEqual(chave, Buffer.from(guardada, 'hex'));
}

// O que o aplicativo pode saber da conta. A resposta da pergunta nunca sai
// daqui, nem protegida.
function publica(conta) {
  return {
    email: conta.email,
    nome: conta.nome,
    perfil: conta.perfil,
    instituicao: conta.instituicao,
    telefone: conta.telefone,
    sal: conta.sal,
    pergunta: conta.pergunta,
  };
}

function sessao(conta) {
  return { token: criarToken(conta.email, conta.versaoSessao), conta: publica(conta) };
}

// Para e-mail que não existe, responde sal e pergunta falsos, porém sempre os
// mesmos. Responder 404 entregaria quem tem conta para qualquer um que perguntasse.
function falsoEstavel(email) {
  return createHmac('sha256', process.env.JWT_SEGREDO).update(email).digest('hex');
}

function perguntaFalsa(email) {
  return PERGUNTAS[parseInt(falsoEstavel(email).slice(36, 44), 16) % PERGUNTAS.length];
}

export async function pedirSal(req, res) {
  const conta = await Conta.findOne({ email: req.body.email }).lean();

  res.json({
    sal: conta ? conta.sal : falsoEstavel(req.body.email).slice(0, 36),
    pergunta: conta ? conta.pergunta : perguntaFalsa(req.body.email),
  });
}

export async function cadastrar(req, res) {
  const { senhaResumo, respostaResumo, ...dados } = req.body;

  if (await Conta.exists({ email: dados.email })) {
    throw createError(409, 'Já existe uma conta com este e-mail.');
  }

  const conta = await Conta.create({
    ...dados,
    senhaProtegida: await proteger(senhaResumo),
    respostaProtegida: respostaResumo ? await proteger(respostaResumo) : '',
  });

  res.status(201).json(sessao(conta));
}

export async function entrar(req, res) {
  const conta = await Conta.findOne({ email: req.body.email });

  if (!conta || !(await confere(req.body.senhaResumo, conta.senhaProtegida))) {
    throw createError(401, 'E-mail ou senha incorretos.');
  }

  res.json(sessao(conta));
}

export async function recuperar(req, res) {
  const conta = await Conta.findOne({ email: req.body.email });

  if (!conta || !(await confere(req.body.respostaResumo, conta.respostaProtegida))) {
    throw createError(401, 'A resposta não confere com a do cadastro.');
  }

  conta.senhaProtegida = await proteger(req.body.senhaResumoNova);
  conta.versaoSessao += 1;
  await conta.save();

  res.json(sessao(conta));
}

export async function atualizar(req, res) {
  const conta = await Conta.findOne({ email: req.email });
  const { senhaAtualResumo, senhaResumo, respostaResumo, sal, pergunta, ...perfil } = req.body;
  const trocaCredencial = senhaResumo || respostaResumo || sal || pergunta !== undefined;

  if (trocaCredencial && !(await confere(senhaAtualResumo, conta.senhaProtegida))) {
    throw createError(403, 'A senha atual não confere.');
  }

  conta.set(perfil);

  if (sal) {
    conta.sal = sal;
  }

  if (pergunta !== undefined) {
    conta.pergunta = pergunta;
  }

  if (respostaResumo) {
    conta.respostaProtegida = await proteger(respostaResumo);
  }

  if (senhaResumo && senhaResumo !== senhaAtualResumo) {
    conta.senhaProtegida = await proteger(senhaResumo);
    conta.versaoSessao += 1;
  }

  await conta.save();

  res.json(sessao(conta));
}

// Apagar a conta leva o que é dela, inclusive os abrigos: abrigo sem dono
// ficaria no mapa para sempre, sem ninguém que possa corrigir ou retirar.
export async function apagar(req, res) {
  const email = req.email;
  const abrigos = await Abrigo.find({ dono: email }).select('id').lean();

  await Necessidade.deleteMany({
    $or: [
      { abrigoId: { $in: abrigos.map((abrigo) => abrigo.id) } },
      { criadoPor: email, abrigoId: { $in: [null, ''] } },
    ],
  });
  await Necessidade.updateMany({}, { $pull: { contribuicoes: { por: email } } });
  await Abrigo.deleteMany({ dono: email });
  await Doacao.deleteMany({ conta: email });
  await Compromisso.deleteMany({ conta: email });
  await Arquivo.deleteMany({ dono: email });
  await Conta.deleteOne({ email });

  res.status(204).end();
}
