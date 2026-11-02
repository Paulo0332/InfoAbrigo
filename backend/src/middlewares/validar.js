import createError from 'http-errors';

export function validar(esquema) {
  return (req, res, next) => {
    const { error, value } = esquema.validate(req.body);

    if (error) {
      return next(createError(400, error.details[0].message));
    }

    req.body = value;

    return next();
  };
}
