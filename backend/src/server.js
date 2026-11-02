import 'dotenv/config';

import { conectarBanco } from './config/db.js';
import { criarApp } from './app.js';

const porta = Number(process.env.PORT || 3000);

await conectarBanco(process.env.MONGODB_URI);

criarApp().listen(porta, () => {
  console.log('API do InfoAbrigo em http://localhost:' + porta);
});
