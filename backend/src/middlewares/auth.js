import createError from 'http-errors';
import jwt from 'jsonwebtoken';

import Conta from '../models/Conta.js';

const VALIDADE = '180d';

function segredo() {
  if (!process.env.JWT_SEGREDO) {
    throw new Error('Defina JWT_SEGREDO no arquivo .env do backend.');
  }

  return process.env.JWT_SEGREDO;
}

export function criarToken(email, versao) {
  return jwt.sign({ versao: versao }, segredo(), {
    subject: email,
    expiresIn: VALIDADE,
  });
}

// Além da assinatura, confere a versão da sessão na conta: trocar a senha
// precisa derrubar quem estava entrando com a senha antiga.
export async function exigirLogin(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');

  if (tipo !== 'Bearer' || !token) {
    return next(createError(401, 'Faça login para continuar.'));
  }

  let dados;

  try {
    dados = jwt.verify(token, segredo());
  } catch {
    return next(createError(401, 'Sessão expirada. Entre de novo.'));
  }

  const conta = await Conta.findOne({ email: dados.sub }).select('versaoSessao').lean();

  if (!conta || conta.versaoSessao !== dados.versao) {
    return next(createError(401, 'Sessão expirada. Entre de novo.'));
  }

  req.email = dados.sub;

  return next();
}
