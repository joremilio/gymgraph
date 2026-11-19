/**
 * Ejecuta scripts/schema.cypher contra la instancia de AuraDB configurada en .env
 * Uso: npm run schema
 */
const fs = require('fs');
const path = require('path');
const { write, close } = require('../src/config/db');

async function main() {
  const texto = fs.readFileSync(path.join(__dirname, 'schema.cypher'), 'utf8');
  const sentencias = texto
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('//'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const s of sentencias) {
    await write(s);
    console.log('✔', s.split('\n')[0]);
  }
  console.log(`Esquema aplicado (${sentencias.length} sentencias).`);
}

main()
  .catch((err) => {
    console.error('Error aplicando el esquema:', err.message);
    process.exitCode = 1;
  })
  .finally(close);
