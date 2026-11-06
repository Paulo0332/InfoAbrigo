import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

// O banco do aparelho. É ele que mantém o aplicativo funcionando sem internet.
//
// Três tabelas: os registros de cada assunto, a fila do que ainda precisa
// chegar ao servidor e anotações soltas. As telas nunca falam com o servidor
// direto: gravam aqui, e a sincronização leva a fila quando houver conexão.
const ESTRUTURA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS registros (
    colecao TEXT NOT NULL,
    id TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    dados TEXT NOT NULL,
    PRIMARY KEY (colecao, id)
  );
  CREATE TABLE IF NOT EXISTS fila (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    colecao TEXT NOT NULL,
    acao TEXT NOT NULL,
    id TEXT NOT NULL,
    dados TEXT,
    conta TEXT
  );
  CREATE TABLE IF NOT EXISTS anotacoes (
    chave TEXT PRIMARY KEY,
    valor TEXT
  );
`;

// De onde os dados vieram até esta versão: uma lista em JSON por assunto.
const CHAVES_ANTIGAS = {
  necessidades: '@infoabrigo:needs',
  abrigos: '@infoabrigo:abrigos',
  doacoes: '@infoabrigo:doacoes',
  compromissos: '@infoabrigo:agenda',
};

let abertura = null;
let cadeia = Promise.resolve();

// O que cada tela viu na última leitura. Ver gravarLista.
const instantaneos = {};

async function abrir() {
  const banco = await SQLite.openDatabaseAsync('infoabrigo.db');

  await banco.execAsync(ESTRUTURA);
  await trazerDadosAntigos(banco);

  return banco;
}

function obterBanco() {
  if (abertura == null) {
    abertura = abrir().catch((error) => {
      abertura = null;

      throw error;
    });
  }

  return abertura;
}

// Um pedido de cada vez: o SQLite não aceita abrir uma transação dentro de
// outra, e a sincronização grava enquanto as telas também gravam.
function emOrdem(tarefa) {
  const resultado = cadeia.then(async () => tarefa(await obterBanco()));

  cadeia = resultado.catch(() => {});

  return resultado;
}

// Roda uma vez, na primeira abertura depois da atualização. O que já estava no
// aparelho entra na fila: quando a pessoa entrar na conta, sobe para o servidor.
// As chaves antigas não são apagadas: se algo der errado, nada se perdeu.
async function trazerDadosAntigos(banco) {
  const feito = await banco.getAllAsync(
    "SELECT valor FROM anotacoes WHERE chave = 'dados-antigos'"
  );

  if (feito.length > 0) {
    return;
  }

  const listas = {};

  for (const colecao of Object.keys(CHAVES_ANTIGAS)) {
    const texto = await AsyncStorage.getItem(CHAVES_ANTIGAS[colecao]);

    listas[colecao] = texto != null ? JSON.parse(texto) : [];
  }

  await banco.withTransactionAsync(async () => {
    for (const colecao of Object.keys(listas)) {
      let ordem = 0;

      for (const item of listas[colecao]) {
        const id = String(item.id);
        const dados = JSON.stringify(item);

        await banco.runAsync(
          'INSERT OR REPLACE INTO registros (colecao, id, ordem, dados) VALUES (?, ?, ?, ?)',
          [colecao, id, ordem, dados]
        );
        await banco.runAsync(
          "INSERT INTO fila (colecao, acao, id, dados) VALUES (?, 'gravar', ?, ?)",
          [colecao, id, dados]
        );

        ordem += 1;
      }
    }

    await banco.runAsync("INSERT INTO anotacoes (chave, valor) VALUES ('dados-antigos', '1')");
  });
}

async function linhas(banco, colecao) {
  return banco.getAllAsync(
    'SELECT id, dados FROM registros WHERE colecao = ? ORDER BY ordem, id',
    [colecao]
  );
}

function guardarInstantaneo(colecao, lista) {
  const mapa = {};

  lista.forEach((item) => {
    mapa[String(item.id)] = JSON.stringify(item);
  });

  instantaneos[colecao] = mapa;
}

export function lerRegistros(colecao) {
  return emOrdem(async (banco) => {
    const lista = (await linhas(banco, colecao)).map((linha) => JSON.parse(linha.dados));

    guardarInstantaneo(colecao, lista);

    return lista;
  });
}

async function reescrever(banco, colecao, lista) {
  await banco.runAsync('DELETE FROM registros WHERE colecao = ?', [colecao]);

  let ordem = 0;

  for (const item of lista) {
    await banco.runAsync(
      'INSERT INTO registros (colecao, id, ordem, dados) VALUES (?, ?, ?, ?)',
      [colecao, String(item.id), ordem, JSON.stringify(item)]
    );

    ordem += 1;
  }
}

async function enfileirar(banco, colecao, acao, id, dados, conta) {
  // Duas gravações seguidas do mesmo registro valem pela última. A fila não
  // cresce com cada toque, e o servidor não recebe versões já superadas.
  if (acao === 'gravar' || acao === 'apagar') {
    await banco.runAsync(
      "DELETE FROM fila WHERE colecao = ? AND id = ? AND acao = 'gravar'",
      [colecao, id]
    );
  }

  await banco.runAsync(
    'INSERT INTO fila (colecao, acao, id, dados, conta) VALUES (?, ?, ?, ?, ?)',
    [colecao, acao, id, dados == null ? null : JSON.stringify(dados), conta || null]
  );
}

// Grava a lista que a tela mandou e põe na fila só o que ela de fato mudou.
//
// As telas gravam a lista inteira. A comparação é com o que a tela leu, e não
// com o que está no banco agora, porque a sincronização pode ter trazido
// novidades nesse meio-tempo. Comparando com o banco, o registro que chegou de
// outro celular pareceria apagado pela tela, e o apagamento iria ao servidor.
export function gravarLista(colecao, lista) {
  return emOrdem(async (banco) => {
    const vista = instantaneos[colecao] || {};
    const atuais = (await linhas(banco, colecao)).map((linha) => JSON.parse(linha.dados));
    const idsNovos = new Set(lista.map((item) => String(item.id)));
    const mudados = lista.filter(
      (item) => vista[String(item.id)] !== JSON.stringify(item)
    );
    const apagados = Object.keys(vista).filter((id) => !idsNovos.has(id));
    const porId = new Map(atuais.map((item) => [String(item.id), item]));

    // A ordem é a da tela. O que ela não conhecia continua, logo depois.
    const resultado = lista.map((item) => {
      const id = String(item.id);

      return vista[id] === JSON.stringify(item) && porId.has(id) ? porId.get(id) : item;
    });
    const ignorados = new Set(apagados);

    atuais.forEach((item) => {
      const id = String(item.id);

      if (!idsNovos.has(id) && !ignorados.has(id)) {
        resultado.push(item);
      }
    });

    await banco.withTransactionAsync(async () => {
      await reescrever(banco, colecao, resultado);

      for (const item of mudados) {
        await enfileirar(banco, colecao, 'gravar', String(item.id), item);
      }

      for (const id of apagados) {
        await enfileirar(banco, colecao, 'apagar', id, JSON.parse(vista[id]));
      }
    });

    guardarInstantaneo(colecao, resultado);

    return resultado;
  });
}

export function pedirEnvio(colecao, acao, id, dados, conta) {
  return emOrdem((banco) => enfileirar(banco, colecao, acao, String(id), dados, conta));
}

export function lerFila() {
  return emOrdem(async (banco) => {
    const fila = await banco.getAllAsync('SELECT * FROM fila ORDER BY seq');

    return fila.map((op) => ({
      ...op,
      dados: op.dados == null ? null : JSON.parse(op.dados),
    }));
  });
}

export function tirarDaFila(seq) {
  return emOrdem((banco) => banco.runAsync('DELETE FROM fila WHERE seq = ?', [seq]));
}

export function contarFila() {
  return emOrdem(async (banco) => {
    const resultado = await banco.getAllAsync('SELECT COUNT(*) AS total FROM fila');

    return resultado[0].total;
  });
}

// O abrigo ganhou o endereço público da foto: troca no registro e no pedido.
export function trocarDados(seq, colecao, id, dados) {
  return emOrdem(async (banco) => {
    const texto = JSON.stringify(dados);

    await banco.runAsync('UPDATE fila SET dados = ? WHERE seq = ?', [texto, seq]);
    await banco.runAsync(
      'UPDATE registros SET dados = ? WHERE colecao = ? AND id = ?',
      [texto, colecao, id]
    );

    if (instantaneos[colecao] && instantaneos[colecao][id]) {
      instantaneos[colecao][id] = texto;
    }
  });
}

// Coloca aqui o que veio do servidor. Duas coisas ficam como estão: o que ainda
// está na fila (é mais novo que o servidor) e o que a função `manter` disser,
// que é o caso dos registros de outra conta deste mesmo aparelho.
export function receberDoServidor(colecao, lista, manter) {
  return emOrdem(async (banco) => {
    const fila = await banco.getAllAsync(
      "SELECT id FROM fila WHERE colecao = ? AND acao IN ('gravar', 'apagar')",
      [colecao]
    );
    const pendentes = new Set(fila.map((op) => op.id));
    const atuais = (await linhas(banco, colecao)).map((linha) => JSON.parse(linha.dados));
    const ficam = atuais.filter(
      (item) => pendentes.has(String(item.id)) || (manter != null && manter(item))
    );
    const idsQueFicam = new Set(ficam.map((item) => String(item.id)));
    const novos = lista.filter(
      (item) => !idsQueFicam.has(String(item.id)) && !pendentes.has(String(item.id))
    );
    const resultado = [...ficam, ...novos];

    await banco.withTransactionAsync(async () => {
      await reescrever(banco, colecao, resultado);
    });
  });
}

export function esquecerPendencias(apagar) {
  return emOrdem(async (banco) => {
    const fila = await banco.getAllAsync('SELECT * FROM fila');

    for (const op of fila) {
      const dados = op.dados == null ? null : JSON.parse(op.dados);

      if (apagar({ ...op, dados })) {
        await banco.runAsync('DELETE FROM fila WHERE seq = ?', [op.seq]);
      }
    }
  });
}

export function lerAnotacao(chave) {
  return emOrdem(async (banco) => {
    const resultado = await banco.getAllAsync(
      'SELECT valor FROM anotacoes WHERE chave = ?',
      [chave]
    );

    return resultado.length > 0 ? resultado[0].valor : null;
  });
}

export function gravarAnotacao(chave, valor) {
  return emOrdem((banco) =>
    banco.runAsync('INSERT OR REPLACE INTO anotacoes (chave, valor) VALUES (?, ?)', [chave, valor])
  );
}
