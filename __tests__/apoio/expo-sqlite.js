// O expo-sqlite só existe no celular. Nos testes, o mesmo SQL roda de verdade no
// SQLite que vem com o Node, para os comandos do banco local serem exercitados.
const { DatabaseSync } = require('node:sqlite');

function criar() {
  const banco = new DatabaseSync(':memory:');

  return {
    execAsync: async (sql) => {
      banco.exec(sql);
    },
    runAsync: async (sql, parametros = []) => banco.prepare(sql).run(...parametros),
    getAllAsync: async (sql, parametros = []) =>
      banco.prepare(sql).all(...parametros).map((linha) => ({ ...linha })),
    withTransactionAsync: async (tarefa) => {
      banco.exec('BEGIN');

      try {
        await tarefa();
        banco.exec('COMMIT');
      } catch (error) {
        banco.exec('ROLLBACK');

        throw error;
      }
    },
  };
}

module.exports = { openDatabaseAsync: async () => criar() };
