import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SEGREDO = 'segredo-de-teste';
process.env.LIMITE_LOGIN = '1000';

const { conectarBanco, desconectarBanco } = await import('../src/config/db.js');
const { criarApp } = await import('../src/app.js');
const { juntarContribuicoes } = await import('../src/controllers/registros.controller.js');

const R = (c) => c.repeat(64);
let mongo;
let api;
let gestor;
let doador;

function comToken(token) {
  const pedido = (metodo) => (url) =>
    request(api)[metodo](url).set('Authorization', 'Bearer ' + token);

  return {
    get: pedido('get'),
    put: pedido('put'),
    post: pedido('post'),
    patch: pedido('patch'),
    delete: pedido('delete'),
  };
}

async function criarConta(email, perfil, senha) {
  const resposta = await request(api).post('/auth/cadastro').send({
    email,
    nome: 'Pessoa ' + perfil,
    perfil,
    sal: 'sal-da-conta-' + perfil,
    senhaResumo: R(senha),
    pergunta: 'Qual foi o nome do seu primeiro animal?',
    respostaResumo: R('f'),
  });

  assert.equal(resposta.status, 201);

  return resposta.body.token;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await conectarBanco(mongo.getUri());
  api = criarApp();
  gestor = comToken(await criarConta('gestor@teste.com', 'gestor', 'a'));
  doador = comToken(await criarConta('doador@teste.com', 'doador', 'b'));
});

after(async () => {
  await desconectarBanco();
  await mongo.stop();
});

const ABRIGO = { nome: 'Casa Lar', latitude: -22.4, longitude: -43.6, dono: 'golpe@teste.com' };

test('rota de dados exige login', async () => {
  assert.equal((await request(api).get('/abrigos')).status, 401);
  assert.equal(
    (await request(api).get('/abrigos').set('Authorization', 'Bearer invalido')).status,
    401
  );
});

test('conta não é duplicada, nem com maiúscula diferente', async () => {
  const resposta = await request(api).post('/auth/cadastro').send({
    email: 'GESTOR@teste.com',
    nome: 'Outra',
    perfil: 'doador',
    sal: 'outro-sal-qualquer',
    senhaResumo: R('c'),
  });

  assert.equal(resposta.status, 409);
});

test('login confere a senha e nunca devolve dados de credencial', async () => {
  const certa = await request(api)
    .post('/auth/entrar')
    .send({ email: 'gestor@teste.com', senhaResumo: R('a') });

  assert.equal(certa.status, 200);
  assert.ok(certa.body.token);
  assert.equal(certa.body.conta.senhaProtegida, undefined);
  assert.equal(certa.body.conta.respostaProtegida, undefined);

  const errada = await request(api)
    .post('/auth/entrar')
    .send({ email: 'gestor@teste.com', senhaResumo: R('9') });

  assert.equal(errada.status, 401);
});

test('o sal de e-mail inexistente é estável e não revela que a conta não existe', async () => {
  const pedir = (email) => request(api).post('/auth/sal').send({ email });
  const um = await pedir('ninguem@teste.com');
  const dois = await pedir('ninguem@teste.com');

  assert.equal(um.status, 200);
  assert.ok(um.body.sal);
  assert.equal(um.body.sal, dois.body.sal);
  assert.equal((await pedir('gestor@teste.com')).body.sal, 'sal-da-conta-gestor');
});

test('trocar a senha exige a atual e derruba a sessão antiga', async () => {
  const token = await criarConta('troca@teste.com', 'doador', 'c');
  const conta = comToken(token);

  const semProva = await conta.put('/contas/eu').send({ senhaResumo: R('d') });
  assert.equal(semProva.status, 403);

  const comProva = await conta
    .put('/contas/eu')
    .send({ senhaResumo: R('d'), senhaAtualResumo: R('c') });
  assert.equal(comProva.status, 200);

  assert.equal((await conta.get('/abrigos')).status, 401, 'a sessão antiga deixa de valer');
  assert.equal((await comToken(comProva.body.token).get('/abrigos')).status, 200);

  const nova = await request(api)
    .post('/auth/entrar')
    .send({ email: 'troca@teste.com', senhaResumo: R('d') });
  assert.equal(nova.status, 200);
});

test('recuperar pela pergunta troca a senha só com a resposta certa', async () => {
  const errada = await request(api).post('/auth/recuperar').send({
    email: 'doador@teste.com',
    respostaResumo: R('0'),
    senhaResumoNova: R('e'),
  });
  assert.equal(errada.status, 401);

  const certa = await request(api).post('/auth/recuperar').send({
    email: 'doador@teste.com',
    respostaResumo: R('f'),
    senhaResumoNova: R('b'),
  });
  assert.equal(certa.status, 200);
  doador = comToken(certa.body.token);
});

test('abrigo: o dono vem da sessão, e outra conta não altera nem exclui', async () => {
  const criado = await gestor.put('/abrigos/1').send(ABRIGO);

  assert.equal(criado.status, 200);
  assert.equal(criado.body.dono, 'gestor@teste.com');
  assert.equal(criado.body._id, undefined);

  assert.equal((await doador.put('/abrigos/1').send(ABRIGO)).status, 403);
  assert.equal((await doador.delete('/abrigos/1')).status, 403);

  const lista = await doador.get('/abrigos');

  assert.equal(lista.body.length, 1);
  assert.equal(lista.body[0].nome, 'Casa Lar');
});

test('abrigo sem coordenadas é recusado', async () => {
  assert.equal((await gestor.put('/abrigos/2').send({ nome: 'Sem mapa' })).status, 400);
});

test('campo removido pelo aplicativo some do banco', async () => {
  await gestor.put('/abrigos/3').send({ ...ABRIGO, foto: 'x' });
  const sem = await gestor.put('/abrigos/3').send(ABRIGO);

  assert.equal(sem.body.foto, undefined);
  await gestor.delete('/abrigos/3');
});

test('necessidade: só quem administra cria, e quem doa não muda o título', async () => {
  const NEED = { title: 'Fraldas', abrigoId: '1', alvo: 10, unidade: 'pacotes', done: false };

  assert.equal((await doador.put('/necessidades/n1').send(NEED)).status, 403);
  assert.equal((await gestor.put('/necessidades/n1').send(NEED)).status, 200);

  const promessa = await doador.put('/necessidades/n1').send({
    ...NEED,
    title: 'Título trocado',
    done: true,
    contribuicoes: [
      { id: 'c1', por: 'doador@teste.com', quantidade: 3, doacaoId: 'd1', entregue: true },
    ],
  });

  assert.equal(promessa.status, 200);
  assert.equal(promessa.body.title, 'Fraldas');
  assert.equal(promessa.body.done, false);
  assert.equal(promessa.body.contribuicoes.length, 1);
  assert.equal(promessa.body.contribuicoes[0].entregue, false, 'quem doa não marca como entregue');
});

test('gravação com lista velha não apaga a promessa de outra pessoa', async () => {
  const velha = await gestor.put('/necessidades/n1').send({
    title: 'Fraldas P',
    abrigoId: '1',
    alvo: 10,
    unidade: 'pacotes',
    done: false,
    contribuicoes: [],
  });

  assert.equal(velha.body.title, 'Fraldas P');
  assert.equal(velha.body.contribuicoes.length, 1);
});

test('gestor marca a entrega, e a situação da doação acompanha', async () => {
  await doador
    .put('/doacoes/d1')
    .send({ tipo: 'item', situacao: 'pendente', valor: 0, conta: 'golpe@teste.com' });

  const marcada = await gestor.put('/necessidades/n1').send({
    title: 'Fraldas P',
    abrigoId: '1',
    alvo: 10,
    contribuicoes: [
      { id: 'c1', por: 'doador@teste.com', quantidade: 3, doacaoId: 'd1', entregue: true },
    ],
  });

  assert.equal(marcada.body.contribuicoes[0].entregue, true);
  assert.equal(
    (await gestor.patch('/doacoes/d1/situacao').send({ situacao: 'confirmada' })).status,
    204
  );

  const doacoes = await doador.get('/doacoes');

  assert.equal(doacoes.body[0].conta, 'doador@teste.com');
  assert.equal(doacoes.body[0].situacao, 'confirmada');
  assert.ok(doacoes.body[0].recebidaEm);
});

test('doação e compromisso são privados', async () => {
  assert.equal((await gestor.get('/doacoes')).body.length, 0);
  assert.equal((await gestor.put('/doacoes/d1').send({ tipo: 'item' })).status, 403);
  assert.equal((await gestor.delete('/doacoes/d1')).status, 403);

  await doador.put('/compromissos/a1').send({ quando: new Date().toISOString(), tipo: 'visita' });

  assert.equal((await gestor.get('/compromissos')).body.length, 0);
  assert.equal((await doador.get('/compromissos')).body.length, 1);
  assert.equal(
    (await gestor.put('/compromissos/a1').send({ quando: new Date().toISOString() })).status,
    403
  );
});

test('terceiro não muda a situação de doação alheia', async () => {
  const outro = comToken(await criarConta('outro@teste.com', 'visitante', 'c'));

  assert.equal(
    (await outro.patch('/doacoes/d1/situacao').send({ situacao: 'pendente' })).status,
    403
  );
});

test('foto: aceita imagem real, recusa o resto e serve sem login', async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');
  const texto = Buffer.from('<script>alert(1)</script>').toString('base64');

  assert.equal((await gestor.post('/arquivos').send({ base64: texto })).status, 400);

  const enviada = await gestor.post('/arquivos').send({ base64: jpeg });

  assert.equal(enviada.status, 201);

  const aberta = await request(api).get(enviada.body.caminho);

  assert.equal(aberta.status, 200);
  assert.equal(aberta.type, 'image/jpeg');
  assert.equal(aberta.body.length, 7);
  assert.equal((await request(api).get('/arquivos/abc')).status, 404);
});

test('apagar a conta leva abrigos, necessidades e promessas', async () => {
  const dono = comToken(await criarConta('sai@teste.com', 'gestor', 'c'));

  await dono.put('/abrigos/s1').send(ABRIGO);
  await dono.put('/necessidades/ns1').send({ title: 'Leite', abrigoId: 's1' });
  await dono.put('/necessidades/n1').send({
    title: 'x',
    contribuicoes: [{ id: 'c9', por: 'sai@teste.com', quantidade: 1 }],
  });

  assert.equal((await dono.delete('/contas/eu')).status, 204);

  const necessidades = (await gestor.get('/necessidades')).body;

  assert.equal(necessidades.some((item) => item.id === 'ns1'), false);
  assert.equal(
    necessidades.find((item) => item.id === 'n1').contribuicoes.some((c) => c.id === 'c9'),
    false
  );
  assert.equal((await gestor.get('/abrigos')).body.some((item) => item.id === 's1'), false);
});

test('juntarContribuicoes: quem doa desiste da própria sem mexer nas outras', () => {
  const gravadas = [
    { id: 1, por: 'a@x', quantidade: 1, entregue: false },
    { id: 2, por: 'b@x', quantidade: 2, entregue: true },
  ];

  const resultado = juntarContribuicoes(gravadas, [], 'a@x', false);

  assert.deepEqual(resultado.map((c) => c.id), [2]);
  assert.equal(resultado[0].entregue, true);
});

test('rota inexistente responde em JSON', async () => {
  const faltando = await gestor.get('/nao-existe');

  assert.equal(faltando.status, 404);
  assert.ok(faltando.body.erro);
});
