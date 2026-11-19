/**
 * Relaciones entre clientes y productos: COMPRO, CALIFICO y REFIRIO (cliente -> cliente).
 * Aquí está la lógica transaccional más importante (control de inventario).
 */
const neo4j = require('neo4j-driver');
const { read, write } = require('../config/db');

class ErrorNegocio extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Registra una compra.
 *  - Bloquea el nodo :Producto (SET de una propiedad temporal) para que dos compras
 *    simultáneas no vendan el mismo stock: Neo4j mantiene el lock hasta el COMMIT.
 *  - Solo descuenta si hay stock suficiente (todo dentro de UNA transacción ACID).
 *  - Usa MERGE: si el cliente ya había comprado el producto, acumula en la misma relación
 *    en lugar de crear relaciones duplicadas (mantiene el grafo compacto).
 */
async function comprar(clienteId, sku, cantidad = 1) {
  const qty = neo4j.int(cantidad);
  const { records } = await write(
    `
    MATCH (c:Cliente {id: $clienteId}), (p:Producto {sku: $sku})
    SET p.__lock = true REMOVE p.__lock
    WITH c, p
    WHERE p.stock >= $cantidad
    SET p.stock = p.stock - $cantidad
    MERGE (c)-[k:COMPRO]->(p)
      ON CREATE SET k.cantidad = $cantidad, k.veces = 1, k.primeraFecha = date(), k.ultimaFecha = date()
      ON MATCH  SET k.cantidad = k.cantidad + $cantidad, k.veces = k.veces + 1, k.ultimaFecha = date()
    RETURN p.stock AS stockRestante, k.cantidad AS cantidadAcumulada`,
    { clienteId, sku, cantidad: qty }
  );
  if (records.length) return records[0];

  // Diagnóstico: ¿no existe el cliente/producto o no hay stock?
  const [diag] = await read(
    `OPTIONAL MATCH (c:Cliente {id: $clienteId})
     OPTIONAL MATCH (p:Producto {sku: $sku})
     RETURN c IS NOT NULL AS hayCliente, p IS NOT NULL AS hayProducto, p.stock AS stock`,
    { clienteId, sku }
  );
  if (!diag.hayCliente) throw new ErrorNegocio('El cliente no existe', 404);
  if (!diag.hayProducto) throw new ErrorNegocio('El producto no existe', 404);
  throw new ErrorNegocio(`Stock insuficiente (disponible: ${diag.stock})`, 409);
}

/** Cancela/devuelve una compra: borra la relación y regresa el stock. */
async function devolver(clienteId, sku) {
  const { records } = await write(
    `
    MATCH (c:Cliente {id: $clienteId})-[k:COMPRO]->(p:Producto {sku: $sku})
    SET p.stock = p.stock + k.cantidad
    WITH p, k, k.cantidad AS devueltos
    DELETE k
    RETURN devueltos, p.stock AS stockActual`,
    { clienteId, sku }
  );
  if (!records.length) throw new ErrorNegocio('No existe esa compra', 404);
  return records[0];
}

/** Solo se puede calificar un producto que el cliente compró. */
async function calificar(clienteId, sku, estrellas) {
  const e = Number(estrellas);
  if (!Number.isInteger(e) || e < 1 || e > 5) throw new ErrorNegocio('Las estrellas deben ser un entero de 1 a 5');
  const { records } = await write(
    `
    MATCH (c:Cliente {id: $clienteId})-[:COMPRO]->(p:Producto {sku: $sku})
    MERGE (c)-[r:CALIFICO]->(p)
    SET r.estrellas = $estrellas, r.fecha = date()
    RETURN r.estrellas AS estrellas`,
    { clienteId, sku, estrellas: neo4j.int(e) }
  );
  if (!records.length) throw new ErrorNegocio('Solo puedes calificar productos que el cliente ya compró', 409);
  return records[0];
}

/** Programa de referidos: un cliente invita a otro (relación dirigida). */
async function referir(referenteId, referidoId) {
  if (referenteId === referidoId) throw new ErrorNegocio('Un cliente no puede referirse a sí mismo');
  const { records } = await write(
    `
    MATCH (a:Cliente {id: $referenteId}), (b:Cliente {id: $referidoId})
    MERGE (a)-[r:REFIRIO]->(b)
      ON CREATE SET r.fecha = date()
    RETURN a.nombre AS referente, b.nombre AS referido`,
    { referenteId, referidoId }
  );
  if (!records.length) throw new ErrorNegocio('Alguno de los clientes no existe', 404);
  return records[0];
}

module.exports = { comprar, devolver, calificar, referir, ErrorNegocio };
