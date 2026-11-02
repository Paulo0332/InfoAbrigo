import Joi from 'joi';

const email = Joi.string().trim().lowercase().email({ tlds: false }).max(200).required();
const resumo = Joi.string().hex().length(64);
const PERFIS = ['gestor', 'voluntario', 'doador', 'visitante'];

export const pedirSal = Joi.object({ email });

export const cadastro = Joi.object({
  email,
  nome: Joi.string().trim().min(2).max(120).required(),
  perfil: Joi.string().valid(...PERFIS).required(),
  instituicao: Joi.object().unknown(true).allow(null),
  telefone: Joi.string().allow('').max(40),
  sal: Joi.string().min(8).max(100).required(),
  senhaResumo: resumo.required(),
  pergunta: Joi.string().allow('').max(200),
  respostaResumo: resumo.allow(''),
});

export const entrar = Joi.object({ email, senhaResumo: resumo.required() });

export const recuperar = Joi.object({
  email,
  respostaResumo: resumo.required(),
  senhaResumoNova: resumo.required(),
});

export const atualizarConta = Joi.object({
  nome: Joi.string().trim().min(2).max(120),
  perfil: Joi.string().valid(...PERFIS),
  instituicao: Joi.object().unknown(true).allow(null),
  telefone: Joi.string().allow('').max(40),
  // Trocar credencial exige provar a senha atual: sem isso, uma sessão
  // esquecida num celular bastaria para tomar a conta.
  senhaAtualResumo: resumo,
  sal: Joi.string().min(8).max(100),
  senhaResumo: resumo,
  pergunta: Joi.string().allow('').max(200),
  respostaResumo: resumo.allow(''),
});

const texto = Joi.string().max(200);

export const abrigo = Joi.object({
  nome: Joi.string().trim().min(1).max(200).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
}).unknown(true);

export const necessidade = Joi.object({
  abrigoId: texto.allow(null, ''),
  contribuicoes: Joi.array().items(
    Joi.object({
      id: Joi.alternatives(Joi.string(), Joi.number()).required(),
      por: texto.required(),
      quantidade: Joi.number().min(0).required(),
    }).unknown(true)
  ),
}).unknown(true);

export const doacao = Joi.object({ tipo: texto, valor: Joi.number().min(0) }).unknown(true);

export const situacao = Joi.object({
  situacao: Joi.string().valid('pendente', 'confirmada').required(),
});

export const compromisso = Joi.object({
  quando: Joi.string().isoDate().required(),
}).unknown(true);

export const arquivo = Joi.object({ base64: Joi.string().base64().required() });
