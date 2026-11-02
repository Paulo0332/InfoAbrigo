// Sobe a API com um MongoDB temporário, sem instalar nada. Serve para testar e
// demonstrar: os dados somem quando o processo termina.
import { MongoMemoryServer } from 'mongodb-memory-server';

import { conectarBanco } from '../src/config/db.js';
import { criarApp } from '../src/app.js';

process.env.JWT_SEGREDO = process.env.JWT_SEGREDO || 'segredo-so-para-teste';

const mongo = await MongoMemoryServer.create();

await conectarBanco(mongo.getUri());

const servidor = criarApp().listen(Number(process.env.PORT || 3000), () => {
  console.log('PRONTO ' + servidor.address().port);
});

process.on('SIGTERM', async () => {
  servidor.close();
  await mongo.stop();
  process.exit(0);
});
