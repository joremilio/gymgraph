/**
 * Conexión a Neo4j AuraDB usando el driver oficial (neo4j-driver).
 *
 * - Las credenciales se leen SOLO de variables de entorno (.env), nunca se escriben en el código.
 * - Se crea UN driver por proceso (es thread-safe y mantiene un pool de conexiones Bolt).
 * - Cada operación abre una sesión corta y usa transacciones administradas
 *   (executeRead / executeWrite), que el driver reintenta automáticamente ante
 *   errores transitorios (p. ej. un cambio de líder en el clúster de Aura).
 */
require('dotenv').config();
const neo4j = require('neo4j-driver');

const REQUIRED = ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables de entorno: ${missing.join(', ')}. Copia .env.example a .env y complétalo.`);
  process.exit(1);
}

const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
  {
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 30_000, // ms
    maxTransactionRetryTime: 15_000, // ms de reintentos automáticos
    disableLosslessIntegers: true, // devuelve números de JS en vez de objetos Integer
  }
);

/** Verifica que el servidor en la nube responde y que las credenciales son válidas. */
async function verifyConnection() {
  const info = await driver.getServerInfo({ database: DATABASE });
  return info; // { address, agent, protocolVersion }
}

/** Ejecuta una consulta de SOLO LECTURA y devuelve los registros como objetos planos. */
async function read(cypher, params = {}) {
  const session = driver.session({ database: DATABASE, defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.executeRead((tx) => tx.run(cypher, params));
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

/** Ejecuta una consulta de ESCRITURA dentro de una transacción administrada. */
async function write(cypher, params = {}) {
  const session = driver.session({ database: DATABASE, defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.executeWrite((tx) => tx.run(cypher, params));
    return {
      records: result.records.map((r) => r.toObject()),
      counters: result.summary.counters.updates(),
    };
  } finally {
    await session.close();
  }
}

async function close() {
  await driver.close();
}

module.exports = { driver, read, write, verifyConnection, close, DATABASE };
