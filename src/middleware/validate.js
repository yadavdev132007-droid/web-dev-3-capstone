// validate(zodSchema, 'body' | 'query' | 'params')
module.exports = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error); // handled in errorHandler
  req[source] = result.data;
  next();
};
