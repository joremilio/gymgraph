/**
 * Prueba rápida de conexión con AuraDB. Uso: npm run check
 */
const { verifyConnection, read, close } = require('../src/config/db');

(async () => {
  try {
    const info = await verifyConnection();
    console.log(`✔ Conectado a ${info.address} (${info.agent})`);
    const conteo = await read('MATCH (n) RETURN labels(n)[0] AS etiqueta, count(*) AS total ORDER BY etiqueta');
    if (!conteo.length) console.log('La base está vacía. Ejecuta: npm run setup');
    conteo.forEach((r) => console.log(`  ${r.etiqueta}: ${r.total}`));
  } catch (err) {
    console.error('✘ Error de conexión:', err.message);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
