// O caminho completo: vários "celulares", cada um com o próprio banco local, falando
// com o emulador do Firebase, com as regras de segurança de verdade.
//
// Precisa do emulador no ar (npm run emulador) e da variável TESTE_FIREBASE=1. Sem
// isso, esta parte fica de fora.
const fetchDoNode = require('./apoio/fetch-node');

const PROJETO = 'demo-infoabrigo';
const descrever = process.env.TESTE_FIREBASE === '1' ? describe : describe.skip;

jest.setTimeout(120000);

// jest.resetModules dá a cada celular um banco, um login e um AsyncStorage novos.
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
    firebase: require('../src/services/firebase'),
    db: require('firebase/database'),
  };
}

function contaNova(celular, email, perfil, sal) {
  return (async () => ({
    nome: 'Pessoa ' + perfil,
    email: email,
    sal: sal,
    senhaResumo: await celular.senha.resumir('senha-' + perfil, sal),
    pergunta: '',
    respostaResumo: '',
    perfil: perfil,
    instituicao: null,
    biometriaAtiva: false,
  }))();
}

async function criarConta(celular, email, perfil) {
  const sal = celular.senha.novoSal();
  const conta = await contaNova(celular, email, perfil, sal);
  const remoto = await celular.remota.registrar(conta, 'senha-' + perfil);

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

function ligarAmbiente() {
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'chave-falsa';
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL =
    'http://127.0.0.1:9000/?ns=' + PROJETO + '-default-rtdb';
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = PROJETO;
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR = '127.0.0.1';
}

function desligarAmbiente() {
  delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  delete process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL;
  delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.EXPO_PUBLIC_FIREBASE_EMULATOR;
}

async function limparEmulador() {
  await fetchDoNode(
    'http://127.0.0.1:9099/emulator/v1/projects/' + PROJETO + '/accounts',
    { method: 'DELETE', headers: { Authorization: 'Bearer owner' } }
  );
  await fetchDoNode(
    'http://127.0.0.1:9000/.json?ns=' + PROJETO + '-default-rtdb',
    {
      method: 'PUT',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: 'null',
    }
  );
}

descrever('sincronização com o Firebase', () => {
  const fetchOriginal = global.fetch;
  let gestor;
  let doador;

  beforeAll(async () => {
    global.fetch = fetchDoNode;
    ligarAmbiente();
    await limparEmulador();
  });

  afterAll(() => {
    global.fetch = fetchOriginal;
    global.__semInternet = false;
    desligarAmbiente();
  });

  test('o abrigo cadastrado num celular aparece no outro', async () => {
    gestor = novoCelular();

    const { remoto } = await criarConta(gestor, 'gestor@teste.com', 'gestor');

    expect(remoto.situacao).toBe('conectada');

    await gestor.abrigos.carregarAbrigos();
    await gestor.abrigos.cadastrarAbrigo({ ...ABRIGO, foto: 'file:///foto-local.jpg' });
    await gestor.necessidades.loadNeeds();
    await gestor.necessidades.saveNeeds([
      { id: 'need-1', title: 'Fraldas', abrigoId: 'abrigo-1', alvo: 10, unidade: 'pacotes', done: false },
    ]);
    await gestor.sync.sincronizar();

    expect(await gestor.banco.contarFila()).toBe(0);

    doador = novoCelular();
    await criarConta(doador, 'doador@teste.com', 'doador');

    const lista = await doador.abrigos.carregarAbrigos();

    expect(lista.map((a) => a.nome)).toEqual(['Casa Lar']);
    expect(lista[0].foto).toMatch(/^data:image\/jpeg;base64,/);
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
    await doador.doacoes.carregarDoacoes();
    await doador.doacoes.registrarDoacao(doacao);
    await doador.sync.sincronizar();

    expect(await doador.banco.contarFila()).toBe(0);

    gestor.sync.esquecerUltimaSincronizacao();

    const vistas = await gestor.necessidades.loadNeeds();

    expect(vistas[0].contribuicoes).toHaveLength(1);

    await gestor.necessidades.saveNeeds(
      vistas.map((need) => ({
        ...need,
        contribuicoes: need.contribuicoes.map((uma) => ({ ...uma, entregue: true })),
      }))
    );
    await gestor.sync.sincronizar();

    doador.sync.esquecerUltimaSincronizacao();

    const minhas = await doador.doacoes.carregarDoacoes();

    expect(minhas[0].situacao).toBe('confirmada');
    expect((await doador.necessidades.loadNeeds())[0].contribuicoes[0].entregue).toBe(true);
  });

  test('sem internet a gravação espera na fila, e sobe quando a conexão volta', async () => {
    global.__semInternet = true;

    const conta = await doador.auth.carregarConta();
    const agenda = await doador.agenda.carregarAgenda();

    await doador.agenda.salvarAgendaDaConta(
      [
        ...agenda,
        { id: 'c-1', tipo: 'visita', quando: '2030-01-10T13:00:00.000Z', conta: 'doador@teste.com' },
      ],
      { email: 'doador@teste.com' }
    );
    await doador.sync.sincronizar();

    const semRede = await doador.sync.estadoDaSincronizacao(conta);

    expect(await doador.banco.contarFila()).toBe(1);
    expect(semRede.pendentes).toBe(1);
    expect(semRede.semConexao).toBe(true);
    expect(await doador.agenda.carregarAgenda()).toHaveLength(1);

    global.__semInternet = false;
    await doador.sync.sincronizar();

    const comRede = await doador.sync.estadoDaSincronizacao(conta);

    expect(await doador.banco.contarFila()).toBe(0);
    expect(comRede.pendentes).toBe(0);
    expect(comRede.semConexao).toBe(false);
  });

  test('a lista velha de uma tela não apaga o que chegou de outro celular', async () => {
    gestor.sync.esquecerUltimaSincronizacao();

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
    expect(finais.find((n) => n.id === 'need-1').contribuicoes).toHaveLength(1);
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

  test('conta criada sem internet sobe no primeiro login conectado', async () => {
    const celular = novoCelular();
    const conta = await contaNova(celular, 'offline@teste.com', 'doador', 'sal-qualquer');

    await celular.auth.gravarContaLocal(conta);

    const entrada = await celular.remota.conectar(conta, 'senha-doador', true);

    expect(entrada.situacao).toBe('conectada');
    expect(await celular.remota.temSessao(conta)).toBe(true);

    // Com a senha errada localmente, o e-mail já existente não vira outra conta.
    const outro = novoCelular();
    const recusada = await outro.remota.conectar(conta, 'outra-senha', true);

    expect(recusada.situacao).toBe('senha-errada');
  });

  test('trocar a senha num celular faz o outro precisar da senha nova', async () => {
    const celular = novoCelular();
    const { conta } = await criarConta(celular, 'troca@teste.com', 'visitante');

    expect((await celular.remota.trocarSenha('senha-errada', 'senha-nova')).situacao).toBe('senha-errada');
    expect((await celular.remota.trocarSenha('senha-visitante', 'senha-nova')).situacao).toBe('conectada');
    expect(conta.email).toBe('troca@teste.com');

    const outro = novoCelular();

    expect((await outro.remota.entrarPorEmail('troca@teste.com', 'senha-visitante')).situacao).toBe('senha-errada');
    expect((await outro.remota.entrarPorEmail('troca@teste.com', 'senha-nova')).situacao).toBe('conectada');
  });

  test('esqueci a senha pede o e-mail, exista a conta ou não', async () => {
    const celular = novoCelular();

    expect((await celular.remota.pedirNovaSenha('doador@teste.com')).situacao).toBe('conectada');
    expect((await celular.remota.pedirNovaSenha('ninguem@teste.com')).situacao).toBe('conectada');
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

    const estado = await celular.sync.estadoDaSincronizacao(entrada.conta);

    expect(await celular.banco.contarFila()).toBe(1);
    expect(estado.pendentes).toBe(0);
    expect((await celular.doacoes.carregarDoacoes()).some((d) => d.id === 'de-outra-conta')).toBe(true);
  });

  describe('regras de segurança', () => {
    let fb;
    let banco;
    let uid;

    beforeAll(async () => {
      fb = novoCelular();

      const entrou = await fb.remota.entrarPorEmail('doador@teste.com', 'senha-doador');

      await fb.auth.entrarNaConta(entrou.conta);

      banco = fb.firebase.obterBanco();
      uid = (await fb.firebase.usuarioAtual()).uid;
    });

    const gravar = (caminho, valor) => fb.db.set(fb.db.ref(banco, caminho), valor);
    const ler = (caminho) => fb.db.get(fb.db.ref(banco, caminho));
    const recusa = { message: expect.stringMatching(/permission/i) };

    test('quem não é dono não altera nem apaga o abrigo', async () => {
      await expect(gravar('abrigos/abrigo-1/nome', 'Roubado')).rejects.toMatchObject(recusa);
      await expect(gravar('abrigos/abrigo-1', null)).rejects.toMatchObject(recusa);
    });

    test('não dá para criar abrigo em nome de outra pessoa', async () => {
      await expect(
        gravar('abrigos/falso', {
          nome: 'Falso',
          latitude: 0,
          longitude: 0,
          dono: 'gestor@teste.com',
          donoUid: 'outro-uid',
        })
      ).rejects.toMatchObject(recusa);
    });

    test('quem doa não muda o título nem cria necessidade em abrigo alheio', async () => {
      await expect(gravar('necessidades/need-1/title', 'Trocado')).rejects.toMatchObject(recusa);
      await expect(
        gravar('necessidades/nova', { id: 'nova', title: 'X', abrigoId: 'abrigo-1', criadoPor: uid })
      ).rejects.toMatchObject(recusa);
    });

    test('quem doa não marca a própria promessa como entregue', async () => {
      await expect(
        gravar('necessidades/need-2/contribuicoes/p1', {
          id: 'p1',
          por: 'doador@teste.com',
          porUid: uid,
          quantidade: 1,
          entregue: true,
        })
      ).rejects.toMatchObject(recusa);
    });

    test('ninguém apaga nem cria promessa em nome de outra pessoa', async () => {
      await expect(
        gravar('necessidades/need-2/contribuicoes/p2', {
          id: 'p2',
          por: 'gestor@teste.com',
          porUid: 'outro-uid',
          quantidade: 1,
        })
      ).rejects.toMatchObject(recusa);
    });

    test('doação, agenda e perfil de outra pessoa não podem ser lidos', async () => {
      await expect(ler('doacoes/outro-uid')).rejects.toMatchObject(recusa);
      await expect(ler('compromissos/outro-uid')).rejects.toMatchObject(recusa);
      await expect(ler('contas/outro-uid')).rejects.toMatchObject(recusa);
    });

    test('selo e alerta só são escritos pela API', async () => {
      await expect(gravar('verificacoes/abrigo-1', { verificado: true })).rejects.toMatchObject(recusa);
      await expect(gravar('alertas/abrigo-1', null)).rejects.toMatchObject(recusa);
      expect((await ler('verificacoes')).exists()).toBe(false);
    });

    test('quem não entrou não lê nada', async () => {
      const anonimo = novoCelular();

      await expect(
        anonimo.db.get(anonimo.db.ref(anonimo.firebase.obterBanco(), 'abrigos'))
      ).rejects.toMatchObject(recusa);
    });
  });

  test('apagar a conta some com os dados dela no Firebase e no aparelho', async () => {
    const celular = novoCelular();
    const { conta } = await criarConta(celular, 'sai@teste.com', 'gestor');

    await celular.abrigos.carregarAbrigos();
    await celular.abrigos.cadastrarAbrigo({ ...ABRIGO, id: 'abrigo-sai', dono: 'sai@teste.com' });
    await celular.sync.sincronizar();

    expect((await celular.remota.apagarDoServidor(conta, 'errada')).situacao).toBe('senha-errada');
    expect((await celular.remota.apagarDoServidor(conta, 'senha-gestor')).situacao).toBe('conectada');

    await celular.limpeza.apagarDadosDaConta(conta.email);
    await celular.remota.limparRastros(conta);

    expect(await celular.auth.carregarConta()).toBeNull();

    const outro = novoCelular();

    expect((await outro.remota.entrarPorEmail('sai@teste.com', 'senha-gestor')).situacao).toBe('senha-errada');

    const entrou = await outro.remota.entrarPorEmail('doador@teste.com', 'senha-doador');

    await outro.auth.entrarNaConta(entrou.conta);

    expect((await outro.abrigos.carregarAbrigos()).some((a) => a.id === 'abrigo-sai')).toBe(false);
  });
});

describe('sem Firebase configurado', () => {
  beforeAll(desligarAmbiente);

  test('tudo continua funcionando só com o aparelho', async () => {
    const celular = novoCelular();
    const { remoto } = await criarConta(celular, 'local@teste.com', 'gestor');

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
