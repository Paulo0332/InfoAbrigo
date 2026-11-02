import createError from 'http-errors';

export function naoEncontrado(req, res, next) {
  next(createError(404, 'Rota não encontrada.'));
}

// Erro inesperado responde 500 sem detalhes: mensagem interna do banco não
// deve chegar a quem usa o aplicativo.
// eslint-disable-next-line no-unused-vars
export function tratarErro(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    erro: status >= 500 ? 'Erro interno do servidor.' : err.message,
  });
}
