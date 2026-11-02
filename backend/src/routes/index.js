import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import * as contas from '../controllers/contas.controller.js';
import * as registros from '../controllers/registros.controller.js';
import { exigirLogin } from '../middlewares/auth.js';
import { validar } from '../middlewares/validar.js';
import * as esquemas from '../validators/esquemas.js';

const rotas = Router();

// Limite por endereço nas rotas que conferem senha: sem ele, dá para testar
// senhas e respostas de segurança à vontade.
const limiteDeLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LIMITE_LOGIN || 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
});

rotas.get('/saude', (req, res) => res.json({ ok: true }));

rotas.post('/auth/sal', limiteDeLogin, validar(esquemas.pedirSal), contas.pedirSal);
rotas.post('/auth/cadastro', limiteDeLogin, validar(esquemas.cadastro), contas.cadastrar);
rotas.post('/auth/entrar', limiteDeLogin, validar(esquemas.entrar), contas.entrar);
rotas.post('/auth/recuperar', limiteDeLogin, validar(esquemas.recuperar), contas.recuperar);

rotas.get('/arquivos/:id', registros.verArquivo);

rotas.use(exigirLogin);

rotas.put('/contas/eu', validar(esquemas.atualizarConta), contas.atualizar);
rotas.delete('/contas/eu', contas.apagar);

rotas.get('/abrigos', registros.listarAbrigos);
rotas.put('/abrigos/:id', validar(esquemas.abrigo), registros.gravarAbrigo);
rotas.delete('/abrigos/:id', registros.apagarAbrigo);

rotas.get('/necessidades', registros.listarNecessidades);
rotas.put('/necessidades/:id', validar(esquemas.necessidade), registros.gravarNecessidade);
rotas.delete('/necessidades/:id', registros.apagarNecessidade);

rotas.get('/doacoes', registros.listarDoacoes);
rotas.put('/doacoes/:id', validar(esquemas.doacao), registros.gravarDoacao);
rotas.patch('/doacoes/:id/situacao', validar(esquemas.situacao), registros.mudarSituacao);
rotas.delete('/doacoes/:id', registros.apagarDoacao);

rotas.get('/compromissos', registros.listarCompromissos);
rotas.put('/compromissos/:id', validar(esquemas.compromisso), registros.gravarCompromisso);
rotas.delete('/compromissos/:id', registros.apagarCompromisso);

rotas.post(
  '/arquivos',
  express.json({ limit: '3mb' }),
  validar(esquemas.arquivo),
  registros.enviarArquivo
);

export default rotas;
