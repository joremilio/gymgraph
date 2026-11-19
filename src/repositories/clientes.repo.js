/**
 * CRUD de nodos :Cliente y su relación con :Objetivo (lo que el cliente busca lograr).
 */
const crypto = require('crypto');
const { read, write } = require('../config/db');

// Proyección reutilizable: cliente + objetivos + resumen de compras
const PROYECCION_CLIENTE = `
  c {
    .id, .nombre, .email, .ciudad,
    creadoEn: toString(c.creadoEn),
    objetivos: [(c)-[:BUSCA]->(o:Objetivo) | o.nombre],
    totalCompras: COUNT { (c)-[:COMPRO]->(:Producto) }
  } AS cliente`;

async function listar() {
  const rows = await read(`
    MATCH (c:Cliente)
    RETURN ${PROYECCION_CLIENTE}
    ORDER BY cliente.nombre`);
  return rows.map((r) => r.cliente);
}

async function obtener(id) {
  const rows = await read(
    `
    MATCH (c:Cliente {id: $id})
    OPTIONAL MATCH (c)-[k:COMPRO]->(p:Producto)
    WITH c, collect(CASE WHEN p IS NULL THEN NULL ELSE {
      sku: p.sku, nombre: p.nombre, cantidad: k.cantidad, ultimaFecha: toString(k.ultimaFecha)
    } END) AS compras
    RETURN ${PROYECCION_CLIENTE}, compras`,
    { id }
  );
  if (!rows.length) return null;
  return { ...rows[0].cliente, compras: rows[0].compras };
}

/**
 * Crea un cliente. Los objetivos se enlazan con MERGE para no duplicar nodos :Objetivo.
 * La restricción UNIQUE sobre Cliente.email hace que un correo repetido falle.
 */
async function crear({ nombre, email, ciudad = null, objetivos = [] }) {
  const id = `C-${crypto.randomUUID().slice(0, 8)}`;
  const { records } = await write(
    `
    CREATE (c:Cliente {id: $id, nombre: $nombre, email: $email, ciudad: $ciudad, creadoEn: datetime()})
    FOREACH (nombreObjetivo IN $objetivos |
      MERGE (o:Objetivo {nombre: nombreObjetivo})
      MERGE (c)-[:BUSCA]->(o))
    RETURN c.id AS id`,
    { id, nombre, email, ciudad, objetivos }
  );
  return records[0].id;
}

/**
 * Actualiza propiedades con SET (coalesce conserva el valor anterior si no se envía).
 * Si se envía la lista de objetivos, se reemplazan las relaciones :BUSCA.
 */
async function actualizar(id, { nombre, email, ciudad, objetivos }) {
  const { records } = await write(
    `
    MATCH (c:Cliente {id: $id})
    SET c.nombre = coalesce($nombre, c.nombre),
        c.email  = coalesce($email,  c.email),
        c.ciudad = coalesce($ciudad, c.ciudad)
    WITH c
    // Solo si se envió una lista nueva de objetivos se borran las relaciones anteriores
    OPTIONAL MATCH (c)-[b:BUSCA]->(:Objetivo) WHERE $objetivos IS NOT NULL
    DELETE b
    WITH DISTINCT c
    FOREACH (nombreObjetivo IN coalesce($objetivos, []) |
      MERGE (o:Objetivo {nombre: nombreObjetivo})
      MERGE (c)-[:BUSCA]->(o))
    RETURN c.id AS id`,
    {
      id,
      nombre: nombre ?? null,
      email: email ?? null,
      ciudad: ciudad ?? null,
      objetivos: Array.isArray(objetivos) ? objetivos : null,
    }
  );
  return records.length > 0;
}

/** DETACH DELETE borra el nodo y todas sus relaciones (compras, calificaciones, referidos). */
async function eliminar(id) {
  const { counters } = await write(`MATCH (c:Cliente {id: $id}) DETACH DELETE c`, { id });
  return counters.nodesDeleted > 0;
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
