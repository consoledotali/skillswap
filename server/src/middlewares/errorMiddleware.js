import { normalizeError } from '../utils.js';
function errorMiddleware(error, _req, res, _next) {
  const normalized = normalizeError(error);
  if (normalized.status >= 500) {
    console.error(error);
  }
  res.status(normalized.status).json({ message: normalized.message });
}
export default errorMiddleware;
