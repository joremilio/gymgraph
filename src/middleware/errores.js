/**
 * Manejo centralizado de errores y validaciones sencillas.
 */

// Envuelve controladores async para mandar los errores al middleware de errores
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Lanza 400 si faltan campos obligatorios en el body. */
function requerir(body, campos) {
  const faltan = campos.filter((c) => body[c] === undefined || body[c] === null || body[c] === '');
  if (faltan.length) {
    const err = new Error(`Faltan campos obligatorios: ${faltan.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

/** Convierte "a, b, c" o ["a","b"] en un arreglo limpio. */
function aLista(valor) {
  if (valor === undefined || valor === null) return undefined;
  const arr = Array.isArray(valor) ? valor : String(valor).split(',');
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  // Violación de restricción UNIQUE (email o SKU repetido)
  if (err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
    return res.status(409).json({ error: 'Ya existe un registro con ese identificador único (email o SKU).' });
  }
  // Problemas de red / credenciales con AuraDB
  if (err.code === 'ServiceUnavailable' || err.code === 'SessionExpired') {
    return res.status(503).json({ error: 'No hay conexión con Neo4j AuraDB. Revisa tu internet y el .env.' });
  }
  if (err.code === 'Neo.ClientError.Security.Unauthorized') {
    return res.status(401).json({ error: 'Credenciales de Neo4j inválidas. Revisa NEO4J_USERNAME / NEO4J_PASSWORD.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Error interno' });
}

module.exports = { asyncHandler, requerir, aLista, manejadorErrores };
