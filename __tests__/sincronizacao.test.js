// O caminho completo: dois "celulares", cada um com o próprio banco e cofre,
// falando com a API de verdade, num MongoDB temporário.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PASTA_API = path.join(__dirname, '..', 'backend');
const apiInstalada = fs.existsSync(path.join(PASTA_API, 'node_modules'));
const descrever = apiInstalada ? describe : describe.skip;

jest.setTimeout(120000);

// jest.resetModules dá a cada celular um banco, um cofre e um AsyncStorage novos.
function novoCelular() {
  jest.resetModules();

  return {
    auth: require('../src/services/auth'),
    remota: require('../src/services/contaRemota'),
    senha: require('../src/services/senha'),
    abrigos: require('../src/services/shelters'),
    necessidades: require('../src/services/storage'),
    doacoes: require('../src/services/donations'),
    agenda: require('../src/services/agenda'),
    sync: require('../src/services/sincronizacao'),
    banco: require('../src/services/bancoLocal'),
    limpeza: require('../src/services/limpeza'),
  };
}

async function criarConta(celular, email, perfil, senha) {
  const sal = celular.senha.novoSal();
  const conta = {
    nome: 'Pessoa ' + perfil,
    email: email,
    sal: sal,
    senhaResumo: await celular.senha.resumir(senha, sal),
    pergunta: 'Qual é o seu prato preferido?',
    respostaResumo: await celular.senha.resumirResposta('lasanha', sal),
    perfil: perfil,
    instituicao: null,
    biometriaAtiva: false,
  };
  const remoto = await celular.remota.registrar(conta);

  await celular.auth.salvarConta(conta);

  return { conta, remoto };
}

const ABRIGO = {
  id: 'abrigo-1',
  nome: 'Casa Lar',
  latitude: -22.4,
  longitude: -43.66,
  dono: 'gestor@teste.com',
};

descrever('sincronização com a API', () => {
  let servidor;
  const fetchOriginal = global.fetch;

  beforeAll(async () => {
    servidor = spawn(process.execPath, ['test/servidor-memoria.js'], {
      cwd: PASTA_API,
      env: { ...process.env, PORT: '0', NODE_ENV: 'test', LIMITE_LOGIN: '1000' },
    });

    const porta = await new Promise((resolve, reject) => {
      servidor.stdout.on('data', (dados) => {
        const achado = /PRONTO (\d+)/.exec(String(dados));

        if (achado) {
          resolve(achado[1]);
        }
      });
      servidor.on('exit', () => reject(new Error('A API não subiu.')));
    });

    process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:' + porta;
    global.fetch = require('./apoio/fetch-node');
  });

  afterAll(() => {
    global.fetch = fetchOriginal;
    servidor.removeAllListeners('exit');
    servidor.kill();
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  let gestor;
  let doador;

  test('o abrigo cadastrado num celular aparece no outro', async () => {
    gestor = novoCelular();

    const { remoto } = await criarConta(gestor, 'gestor@teste.com', 'gestor', 'senha-gestor');

    expect(remoto.situacao).toBe('conectada');

    await gestor.abrigos.cadastrarAbrigo({ ...ABRIGO, foto: 'file:///foto-local.jpg' });
    await gestor.necessidades.loadNeeds();
    await gestor.necessidades.saveNeeds([
      { id: 'need-1', title: 'Fraldas', abrigoId: 'abrigo-1', alvo: 10, unidade: 'pacotes', done: false },
    ]);
    await gestor.sync.sincronizar();

    expect(await gestor.banco.contarFila()).toBe(0);

    doador = novoCelular();
    await criarConta(doador, 'doador@teste.com', 'doador', 'senha-doador');

    const lista = await doador.abrigos.carregarAbrigos();

    expect(lista.map((a) => a.nome)).toEqual(['Casa Lar']);
    expect(lista[0].foto).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/arquivos\/[0-9a-f]{24}$/);
    expect((await doador.necessidades.loadNeeds())[0].title).toBe('Fraldas');
  });

  test('promessa e confirmação de entrega passam de um celular ao outro', async () => {
    const doacao = {
      id: 'doacao-1',
      tipo: 'item',
      item: '3 pacotes de Fraldas',
      valor: 0,
      conta: 'doador@teste.com',
      situacao: 'pendente',
    };
    const needs = await doador.necessidades.loadNeeds();

    await doador.necessidades.saveNeeds(
      needs.map((need) => ({
        ...need,
        contribuicoes: [
          { id: 'doacao-1', por: 'doador@teste.com', quantidade: 3, doacaoId: 'doacao-1', entregue: false },
        ],
      }))
    );
    await doador.doacoes.registrarDoacao(doacao);
    await doador.sync.sincronizar();

    gestor.sync.esquecerUltimaSincronizacao();

    const vistas = await gestor.necessidades.loadNeeds();

    expect(vistas[0].contribuicoes).toHaveLength(1);

    await gestor.necessidades.saveNeeds(
      vistas.map((need) => ({
        ...need,
        contribuicoes: need.contribuicoes.map((uma) => ({ ...uma, entregue: true })),
      }))
    );
    await gestor.doacoes.atualizarSituacao('doacao-1', gestor.doacoes.CONFIRMADA);
    await gestor.sync.sincronizar();

    doador.sync.esquecerUltimaSincronizacao();

    const minhas = await doador.doacoes.carregarDoacoes();

    expect(minhas[0].situacao).toBe('confirmada');
    expect((await doador.necessidades.loadNeeds())[0].contribuicoes[0].entregue).toBe(true);
  });

  test('sem internet a gravação espera na fila, e sobe quando a conexão volta', async () => {
    const fetchDeVerdade = global.fetch;

    global.fetch = async () => {
      throw new TypeError('Network request failed');
    };

    const agenda = await doador.agenda.carregarAgenda();

    await doador.agenda.salvarAgendaDaConta(
      [
        ...agenda,
        { id: 'c-1', tipo: 'visita', quando: '2030-01-10T13:00:00.000Z', conta: 'doador@teste.com' },
      ],
      { email: 'doador@teste.com' }
    );
    await doador.sync.sincronizar();

    expect(await doador.banco.contarFila()).toBe(1);
    expect(await doador.agenda.carregarAgenda()).toHaveLength(1);

    global.fetch = fetchDeVerdade;
    await doador.sync.sincronizar();

    expect(await doador.banco.contarFila()).toBe(0);
  });

  test('a lista velha de uma tela não apaga o que chegou de outro celular', async () => {
    // A tela do gestor leu a lista antes de existir a segunda necessidade.
    const naTela = await gestor.necessidades.loadNeeds();
    const outroCelular = novoCelular();
    const entrou = await outroCelular.remota.entrarPorEmail('gestor@teste.com', 'senha-gestor');

    expect(entrou.situacao).toBe('conectada');

    await outroCelular.auth.entrarNaConta(entrou.conta);

    const lidas = await outroCelular.necessidades.loadNeeds();

    await outroCelular.necessidades.saveNeeds([
      ...lidas,
      { id: 'need-2', title: 'Leite', abrigoId: 'abrigo-1', done: false },
    ]);
    await outroCelular.sync.sincronizar();

    await gestor.sync.sincronizar();
    await gestor.necessidades.saveNeeds(
      naTela.map((need) => ({ ...need, title: 'Fraldas G' }))
    );
    await gestor.sync.sincronizar();

    outroCelular.sync.esquecerUltimaSincronizacao();

    const finais = await outroCelular.necessidades.loadNeeds();

    expect(finais.map((n) => n.title).sort()).toEqual(['Fraldas G', 'Leite']);
  });

  test('num celular novo, a pessoa entra pelo e-mail e recebe os próprios dados', async () => {
    const novo = novoCelular();
    const entrou = await novo.remota.entrarPorEmail('doador@teste.com', 'senha-doador');

    expect(entrou.situacao).toBe('conectada');
    expect(entrou.conta.nome).toBe('Pessoa doador');

    await novo.auth.entrarNaConta(entrou.conta);

    expect((await novo.doacoes.carregarDoacoes()).map((d) => d.id)).toEqual(['doacao-1']);
    expect((await novo.agenda.carregarAgenda()).map((c) => c.id)).toEqual(['c-1']);

    const errada = await novoCelular().remota.entrarPorEmail('doador@teste.com', 'errada');

    expect(errada.situacao).toBe('senha-errada');
  });

  test('e-mail desconhecido recebe uma pergunta, sem revelar que não existe', async () => {
    const celular = novoCelular();
    const achado = await celular.remota.buscarParaRecuperar('ninguem@teste.com');

    expect(achado.situacao).toBe('conectada');
    expect(achado.conta.pergunta.length).toBeGreaterThan(0);
  });

  test('trocar a senha num celular faz o outro precisar da senha nova', async () => {
    const atual = await doador.auth.carregarConta();
    const sal = atual.sal;

    await doador.auth.salvarConta({
      ...atual,
      senhaResumo: await doador.senha.resumir('senha-nova', sal),
    });
    await doador.sync.sincronizar();

    expect(await doador.banco.contarFila()).toBe(0);

    const celular = novoCelular();

    expect((await celular.remota.entrarPorEmail('doador@teste.com', 'senha-doador')).situacao).toBe('senha-errada');
    expect((await celular.remota.entrarPorEmail('doador@teste.com', 'senha-nova')).situacao).toBe('conectada');

    // E a sessão do próprio celular continua valendo: o servidor mandou outra.
    doador.sync.esquecerUltimaSincronizacao();
    expect(await doador.remota.temSessao(atual)).toBe(true);
  });

  test('esqueci a senha: a resposta certa troca a senha no servidor', async () => {
    const celular = novoCelular();
    const { conta } = await celular.remota.buscarParaRecuperar('doador@teste.com');

    expect((await celular.remota.recuperar(conta, 'errada', 'nova-2')).situacao).toBe('senha-errada');

    const certa = await celular.remota.recuperar(conta, ' Lasanha ', 'nova-2');

    expect(certa.situacao).toBe('conectada');
    expect((await novoCelular().remota.entrarPorEmail('doador@teste.com', 'nova-2')).situacao).toBe('conectada');
  });

  test('dados de outra conta do aparelho não sobem com a sessão desta', async () => {
    const celular = novoCelular();
    const entrada = await celular.remota.entrarPorEmail('gestor@teste.com', 'senha-gestor');

    await celular.auth.entrarNaConta(entrada.conta);
    await celular.doacoes.carregarDoacoes();
    await celular.doacoes.registrarDoacao({
      id: 'de-outra-conta',
      tipo: 'dinheiro',
      valor: 5,
      conta: 'visitante@teste.com',
    });
    await celular.sync.sincronizar();

    expect(await celular.banco.contarFila()).toBe(1);
    expect((await celular.doacoes.carregarDoacoes()).some((d) => d.id === 'de-outra-conta')).toBe(true);
  });

  test('apagar a conta some com ela no servidor e no aparelho', async () => {
    const celular = novoCelular();
    const { conta } = await criarConta(celular, 'sai@teste.com', 'doador', 'senha-sai');

    await celular.remota.apagarDoServidor(conta);
    await celular.limpeza.apagarDadosDaConta(conta.email);
    await celular.remota.limparRastros(conta);

    expect(await celular.auth.carregarConta()).toBeNull();
    expect((await novoCelular().remota.entrarPorEmail('sai@teste.com', 'senha-sai')).situacao).toBe('senha-errada');
  });
});

describe('sem servidor configurado', () => {
  test('tudo continua funcionando só com o aparelho', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;

    const celular = novoCelular();
    const { remoto } = await criarConta(celular, 'local@teste.com', 'gestor', 'senha');

    expect(remoto.situacao).toBe('sem-rede');

    await celular.abrigos.cadastrarAbrigo({ ...ABRIGO, dono: 'local@teste.com' });

    expect((await celular.abrigos.carregarAbrigos()).map((a) => a.nome)).toEqual(['Casa Lar']);
  });

  test('o que já estava no AsyncStorage é trazido para o banco', async () => {
    jest.resetModules();

    const AsyncStorage = require('@react-native-async-storage/async-storage');

    await (AsyncStorage.default || AsyncStorage).setItem(
      '@infoabrigo:abrigos',
      JSON.stringify([{ ...ABRIGO, id: 'antigo' }])
    );

    const shelters = require('../src/services/shelters');
    const banco = require('../src/services/bancoLocal');

    expect((await shelters.carregarAbrigos()).map((a) => a.id)).toEqual(['antigo']);
    expect(await banco.contarFila()).toBe(1);
  });
});
