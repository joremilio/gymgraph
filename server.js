/**
 * Punto de entrada: verifica la conexión con Neo4j AuraDB y levanta el servidor web.
 */
const app = require('./src/app');
const { verifyConnection, close } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    const info = await verifyConnection();
    console.log(`✔ Conectado a Neo4j en la nube: ${info.address} (${info.agent})`);
  } catch (err) {
    console.error('✘ No se pudo conectar a Neo4j AuraDB:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => console.log(`GymGraph listo en http://localhost:${PORT}`));

  // Cierre ordenado: libera el pool de conexiones del driver
  const apagar = async () => {
    console.log('\nCerrando conexiones...');
    server.close();
    await close();
    process.exit(0);
  };
  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);
}

main();
