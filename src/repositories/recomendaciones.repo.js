/**
 * Consultas especializadas del paradigma de GRAFO:
 *   1. Filtrado colaborativo (similitud de Jaccard entre clientes)
 *   2. Recomendación por objetivo (basada en contenido)
 *   3. "Quienes compraron esto también compraron..."
 *   4. Productos comprados juntos (pares)
 *   5. Camino más corto entre dos clientes (shortestPath)
 *   6. Vecindad de un cliente a N saltos (traversal para visualizar)
 *   7. Clientes más influyentes del programa de referidos (traversal de longitud variable)
 *
 * Nota: los límites (LIMIT) se envían como neo4j.int porque los números de JavaScript
 * viajan como flotantes y LIMIT exige un entero.
 */
const neo4j = require('neo4j-driver');
const { read } = require('../config/db');

const lim = (n, def = 5, max = 50) => neo4j.int(Math.min(Math.max(parseInt(n, 10) || def, 1), max));

// Convierte nodos y relaciones a objetos simples (para dibujar el grafo en el navegador)
const NODO = `{id: elementId(n), etiqueta: labels(n)[0], nombre: coalesce(n.nombre, n.sku)}`;
const REL = `{id: elementId(r), tipo: type(r), desde: elementId(startNode(r)), hasta: elementId(endNode(r))}`;

/** 1. Filtrado colaborativo: productos que compran los clientes más parecidos a mí. */
async function colaborativo(clienteId, limite) {
  return read(
    `
    MATCH (yo:Cliente {id: $clienteId})-[:COMPRO]->(:Producto)<-[:COMPRO]-(otro:Cliente)
    WHERE otro <> yo
    WITH yo, otro, count(*) AS enComun
    WITH yo, otro, enComun,
         COUNT { (yo)-[:COMPRO]->(:Producto) }   AS misCompras,
         COUNT { (otro)-[:COMPRO]->(:Producto) } AS susCompras
    // Similitud de Jaccard = |A ∩ B| / |A ∪ B|
    WITH yo, otro, toFloat(enComun) / (misCompras + susCompras - enComun) AS similitud
    ORDER BY similitud DESC
    LIMIT 10                                   // top-10 vecinos más parecidos
    MATCH (otro)-[:COMPRO]->(rec:Producto)
    WHERE NOT EXISTS { (yo)-[:COMPRO]->(rec) } AND rec.stock > 0
    WITH rec, sum(similitud) AS puntaje, collect(otro.nombre) AS clientesSimilares
    RETURN rec.sku AS sku, rec.nombre AS nombre, rec.precio AS precio,
           round(puntaje, 3) AS puntaje, clientesSimilares[..3] AS porque
    ORDER BY puntaje DESC, nombre
    LIMIT $limite`,
    { clienteId, limite: lim(limite) }
  );
}

/** 2. Basada en contenido: productos que ayudan a los objetivos del cliente y aún no tiene. */
async function porObjetivo(clienteId, limite) {
  return read(
    `
    MATCH (yo:Cliente {id: $clienteId})-[:BUSCA]->(o:Objetivo)<-[:AYUDA_A]-(rec:Producto)
    WHERE NOT EXISTS { (yo)-[:COMPRO]->(rec) } AND rec.stock > 0
    WITH rec, collect(o.nombre) AS objetivos
    RETURN rec.sku AS sku, rec.nombre AS nombre, rec.precio AS precio,
           objetivos, size(objetivos) AS coincidencias,
           COUNT { (:Cliente)-[:COMPRO]->(rec) } AS popularidad
    ORDER BY coincidencias DESC, popularidad DESC, nombre
    LIMIT $limite`,
    { clienteId, limite: lim(limite) }
  );
}

/** 3. Quienes compraron este producto también compraron... (recorrido de 2 saltos). */
async function tambienCompraron(sku, limite) {
  return read(
    `
    MATCH (p:Producto {sku: $sku})<-[:COMPRO]-(c:Cliente)-[:COMPRO]->(otro:Producto)
    WHERE otro <> p
    RETURN otro.sku AS sku, otro.nombre AS nombre, otro.precio AS precio,
           count(DISTINCT c) AS clientes
    ORDER BY clientes DESC, nombre
    LIMIT $limite`,
    { sku, limite: lim(limite) }
  );
}

/** 4. Pares de productos que más se compran juntos (para armar combos/paquetes). */
async function compradosJuntos(limite) {
  return read(
    `
    MATCH (a:Producto)<-[:COMPRO]-(c:Cliente)-[:COMPRO]->(b:Producto)
    WHERE a.sku < b.sku                 // evita contar (A,B) y (B,A) dos veces
    RETURN a.nombre AS productoA, b.nombre AS productoB, count(c) AS veces
    ORDER BY veces DESC, productoA
    LIMIT $limite`,
    { limite: lim(limite, 10) }
  );
}

/**
 * 5. Camino más corto entre dos clientes.
 *    modo = 'referidos' -> solo sigue relaciones REFIRIO en su dirección (cadena de invitaciones)
 *    modo = 'general'   -> cualquier relación, sin dirección (¿cómo se conectan en la tienda?)
 * Los tipos de relación no pueden ir como parámetro en Cypher, por eso se usa una lista blanca.
 */
async function caminoMasCorto(desdeId, hastaId, modo = 'general') {
  const patron = modo === 'referidos' ? '(a)-[:REFIRIO*..10]->(b)' : '(a)-[*..8]-(b)';
  const rows = await read(
    `
    MATCH (a:Cliente {id: $desdeId}), (b:Cliente {id: $hastaId})
    MATCH ruta = shortestPath(${patron})
    RETURN length(ruta) AS saltos,
           [n IN nodes(ruta) | ${NODO}] AS nodos,
           [r IN relationships(ruta) | ${REL}] AS relaciones`,
    { desdeId, hastaId }
  );
  return rows[0] || null;
}

/** 6. Vecindad de un cliente hasta N saltos (1 a 3), lista para dibujarse. */
async function vecindad(clienteId, profundidad = 2) {
  const n = Math.min(Math.max(parseInt(profundidad, 10) || 2, 1), 3); // validado: va dentro del patrón
  const rows = await read(
    `
    MATCH ruta = (c:Cliente {id: $clienteId})-[*1..${n}]-()
    WITH ruta LIMIT 300
    WITH collect(ruta) AS rutas
    UNWIND rutas AS r1 UNWIND nodes(r1) AS n
    WITH rutas, collect(DISTINCT n) AS ns
    UNWIND rutas AS r2 UNWIND relationships(r2) AS r
    WITH ns, collect(DISTINCT r) AS rs
    RETURN [n IN ns | ${NODO}] AS nodos, [r IN rs | ${REL}] AS relaciones`,
    { clienteId }
  );
  return rows[0] || { nodos: [], relaciones: [] };
}

/** 7. Influencia en referidos: a cuántas personas llegó cada cliente directa o indirectamente. */
async function influencers(limite) {
  return read(
    `
    MATCH (c:Cliente)-[:REFIRIO*1..]->(alcanzado:Cliente)
    WITH c, count(DISTINCT alcanzado) AS alcance
    RETURN c.id AS id, c.nombre AS nombre, alcance,
           COUNT { (c)-[:REFIRIO]->(:Cliente) } AS directos
    ORDER BY alcance DESC, nombre
    LIMIT $limite`,
    { limite: lim(limite) }
  );
}

module.exports = {
  colaborativo,
  porObjetivo,
  tambienCompraron,
  compradosJuntos,
  caminoMasCorto,
  vecindad,
  influencers,
};
