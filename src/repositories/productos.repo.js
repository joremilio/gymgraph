/**
 * CRUD de nodos :Producto y sus relaciones con :Categoria, :Marca y :Objetivo.
 */
const { read, write } = require('../config/db');

// Calcula el promedio de estrellas con reduce() y devuelve el producto con sus relaciones
const PROYECCION_PRODUCTO = `
  WITH p, [(:Cliente)-[r:CALIFICO]->(p) | r.estrellas] AS estrellas
  RETURN p {
    .sku, .nombre, .precio, .stock, .descripcion,
    categoria: head([(p)-[:PERTENECE_A]->(cat:Categoria) | cat.nombre]),
    marca:     head([(p)-[:DE_MARCA]->(m:Marca) | m.nombre]),
    objetivos: [(p)-[:AYUDA_A]->(o:Objetivo) | o.nombre],
    compradores: COUNT { (:Cliente)-[:COMPRO]->(p) },
    calificacion: CASE size(estrellas) WHEN 0 THEN 0
                  ELSE round(toFloat(reduce(s = 0, e IN estrellas | s + e)) / size(estrellas), 1) END
  } AS producto`;

async function listar({ categoria } = {}) {
  const rows = await read(
    `
    MATCH (p:Producto)
    WHERE $categoria IS NULL OR (p)-[:PERTENECE_A]->(:Categoria {nombre: $categoria})
    ${PROYECCION_PRODUCTO}
    ORDER BY producto.nombre`,
    { categoria: categoria || null }
  );
  return rows.map((r) => r.producto);
}

async function obtener(sku) {
  const rows = await read(`MATCH (p:Producto {sku: $sku}) ${PROYECCION_PRODUCTO}`, { sku });
  return rows[0]?.producto || null;
}

/** Crea el producto y enlaza (o crea con MERGE) su categoría, marca y objetivos. */
async function crear({ sku, nombre, precio, stock = 0, descripcion = '', categoria, marca, objetivos = [] }) {
  const { records } = await write(
    `
    CREATE (p:Producto {sku: $sku, nombre: $nombre, precio: toFloat($precio),
                        stock: toInteger($stock), descripcion: $descripcion})
    MERGE (cat:Categoria {nombre: $categoria})
    MERGE (m:Marca {nombre: $marca})
    MERGE (p)-[:PERTENECE_A]->(cat)
    MERGE (p)-[:DE_MARCA]->(m)
    FOREACH (nombreObjetivo IN $objetivos |
      MERGE (o:Objetivo {nombre: nombreObjetivo})
      MERGE (p)-[:AYUDA_A]->(o))
    RETURN p.sku AS sku`,
    { sku, nombre, precio, stock, descripcion, categoria, marca, objetivos }
  );
  return records[0].sku;
}

/**
 * Actualiza propiedades y, si se envían, reemplaza la categoría, la marca o los objetivos.
 */
async function actualizar(sku, { nombre, precio, stock, descripcion, categoria, marca, objetivos }) {
  const { records } = await write(
    `
    MATCH (p:Producto {sku: $sku})
    SET p.nombre      = coalesce($nombre, p.nombre),
        p.precio      = coalesce(toFloat($precio), p.precio),
        p.stock       = coalesce(toInteger($stock), p.stock),
        p.descripcion = coalesce($descripcion, p.descripcion)
    WITH p
    // --- categoría ---
    OPTIONAL MATCH (p)-[rc:PERTENECE_A]->() WHERE $categoria IS NOT NULL
    DELETE rc
    WITH DISTINCT p
    FOREACH (_ IN CASE WHEN $categoria IS NULL THEN [] ELSE [1] END |
      MERGE (cat:Categoria {nombre: $categoria})
      MERGE (p)-[:PERTENECE_A]->(cat))
    WITH p
    // --- marca ---
    OPTIONAL MATCH (p)-[rm:DE_MARCA]->() WHERE $marca IS NOT NULL
    DELETE rm
    WITH DISTINCT p
    FOREACH (_ IN CASE WHEN $marca IS NULL THEN [] ELSE [1] END |
      MERGE (m:Marca {nombre: $marca})
      MERGE (p)-[:DE_MARCA]->(m))
    WITH p
    // --- objetivos ---
    OPTIONAL MATCH (p)-[ro:AYUDA_A]->() WHERE $objetivos IS NOT NULL
    DELETE ro
    WITH DISTINCT p
    FOREACH (nombreObjetivo IN coalesce($objetivos, []) |
      MERGE (o:Objetivo {nombre: nombreObjetivo})
      MERGE (p)-[:AYUDA_A]->(o))
    RETURN p.sku AS sku`,
    {
      sku,
      nombre: nombre ?? null,
      precio: precio ?? null,
      stock: stock ?? null,
      descripcion: descripcion ?? null,
      categoria: categoria || null,
      marca: marca || null,
      objetivos: Array.isArray(objetivos) ? objetivos : null,
    }
  );
  return records.length > 0;
}

async function eliminar(sku) {
  const { counters } = await write(`MATCH (p:Producto {sku: $sku}) DETACH DELETE p`, { sku });
  return counters.nodesDeleted > 0;
}

/** Catálogos auxiliares para llenar los <select> de la interfaz. */
async function catalogos() {
  const [row] = await read(`
    RETURN
      COLLECT { MATCH (c:Categoria) RETURN c.nombre ORDER BY c.nombre } AS categorias,
      COLLECT { MATCH (m:Marca)     RETURN m.nombre ORDER BY m.nombre } AS marcas,
      COLLECT { MATCH (o:Objetivo)  RETURN o.nombre ORDER BY o.nombre } AS objetivos`);
  return row;
}

module.exports = { listar, obtener, crear, actualizar, eliminar, catalogos };
