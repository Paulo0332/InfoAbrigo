import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { naoEncontrado, tratarErro } from './middlewares/error.js';
import rotas from './routes/index.js';

export function criarApp() {
  const app = express();

  // A hospedagem fica atrás de um proxy: sem isto, o limite de tentativas
  // veria todo mundo vindo do mesmo endereço.
  app.set('trust proxy', 1);

  // A foto do abrigo é aberta pelo aplicativo, em outra origem.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('tiny'));
  }

  // O envio de foto tem limite próprio e maior; por isso fica fora daqui.
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/arquivos') {
      return next();
    }

    return express.json({ limit: '256kb' })(req, res, next);
  });

  app.use(rotas);
  app.use(naoEncontrado);
  app.use(tratarErro);

  return app;
}
