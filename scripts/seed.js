/**
 * Seeding script: borra los datos actuales y carga un conjunto inicial de prueba.
 * Uso: npm run seed      (o "npm run setup" para esquema + datos)
 *
 * Los datos están diseñados para que las consultas de recomendación den resultados
 * interesantes: hay grupos de clientes con hábitos de compra parecidos y una cadena
 * de referidos de varios niveles.
 */
const neo4j = require('neo4j-driver');
const { write, read, close } = require('../src/config/db');

const objetivos = ['Ganar masa muscular', 'Perder grasa', 'Mejorar resistencia', 'Aumentar fuerza', 'Recuperación'];

// [sku, nombre, precio MXN, stock, categoría, marca, objetivos que apoya, descripción]
const productos = [
  ['PRO-001', 'Proteína Whey Vainilla 2 lb', 799, 40, 'Proteínas', 'IronLab', ['Ganar masa muscular', 'Recuperación'], 'Proteína de suero concentrada, 24 g por porción'],
  ['PRO-002', 'Proteína Whey Chocolate 5 lb', 1499, 25, 'Proteínas', 'IronLab', ['Ganar masa muscular', 'Recuperación'], 'Presentación grande sabor chocolate'],
  ['PRO-003', 'Proteína Isolada Fresa 2 lb', 1099, 20, 'Proteínas', 'NutriMax', ['Perder grasa', 'Recuperación'], 'Aislado bajo en carbohidratos y grasa'],
  ['PRO-004', 'Proteína Vegana Cacao 2 lb', 949, 15, 'Proteínas', 'GreenFuel', ['Ganar masa muscular'], 'Mezcla de chícharo y arroz'],
  ['GAN-001', 'Ganador de Peso 6 lb', 1199, 18, 'Proteínas', 'PowerZone', ['Ganar masa muscular'], 'Alto en calorías y carbohidratos'],
  ['CRE-001', 'Creatina Monohidratada 300 g', 549, 50, 'Creatina', 'IronLab', ['Ganar masa muscular', 'Aumentar fuerza'], 'Creatina micronizada sin sabor'],
  ['CRE-002', 'Creatina HCL 120 caps', 649, 30, 'Creatina', 'PowerZone', ['Aumentar fuerza'], 'Creatina clorhidrato en cápsulas'],
  ['PRE-001', 'Pre-entreno Explosive Frutos Rojos', 699, 35, 'Pre-entreno', 'PowerZone', ['Aumentar fuerza', 'Mejorar resistencia'], 'Cafeína, beta-alanina y citrulina'],
  ['PRE-002', 'Pre-entreno sin estimulantes', 749, 20, 'Pre-entreno', 'NutriMax', ['Mejorar resistencia'], 'Bombeo muscular sin cafeína'],
  ['QUE-001', 'Quemador Termogénico 90 caps', 599, 30, 'Control de peso', 'NutriMax', ['Perder grasa'], 'Termogénico con té verde'],
  ['QUE-002', 'L-Carnitina Líquida Limón', 459, 40, 'Control de peso', 'FitCore', ['Perder grasa', 'Mejorar resistencia'], 'L-carnitina 3000 mg'],
  ['AMI-001', 'BCAA 2:1:1 Mango 400 g', 529, 35, 'Aminoácidos', 'FitCore', ['Recuperación', 'Mejorar resistencia'], 'Aminoácidos de cadena ramificada'],
  ['AMI-002', 'Glutamina 300 g', 449, 30, 'Aminoácidos', 'IronLab', ['Recuperación'], 'L-glutamina pura'],
  ['ELE-001', 'Electrolitos en Polvo Naranja', 299, 60, 'Hidratación', 'FitCore', ['Mejorar resistencia'], 'Sodio, potasio y magnesio'],
  ['VIT-001', 'Multivitamínico Deportivo 60 tabs', 389, 45, 'Vitaminas y salud', 'GreenFuel', ['Recuperación'], 'Vitaminas y minerales esenciales'],
  ['VIT-002', 'Omega 3 1000 mg 120 caps', 349, 50, 'Vitaminas y salud', 'GreenFuel', ['Recuperación', 'Perder grasa'], 'Aceite de pescado EPA/DHA'],
  ['SNK-001', 'Barras de Proteína Caja 12 pzas', 459, 40, 'Snacks', 'FitCore', ['Ganar masa muscular', 'Perder grasa'], '20 g de proteína por barra'],
  ['SNK-002', 'Crema de Cacahuate Natural 1 kg', 229, 50, 'Snacks', 'GreenFuel', ['Ganar masa muscular'], 'Sin azúcar añadida'],
  ['ACC-001', 'Shaker 700 ml', 149, 100, 'Accesorios', 'IronLab', [], 'Vaso mezclador con compartimento'],
  ['ACC-002', 'Guantes de Entrenamiento', 299, 30, 'Accesorios', 'PowerZone', ['Aumentar fuerza'], 'Con muñequera ajustable'],
  ['ACC-003', 'Cinturón de Levantamiento', 699, 15, 'Accesorios', 'PowerZone', ['Aumentar fuerza'], 'Cuero, 10 cm de ancho'],
  ['ACC-004', 'Cuerda para Saltar con Rodamientos', 199, 40, 'Accesorios', 'FitCore', ['Perder grasa', 'Mejorar resistencia'], 'Cable de acero ajustable'],
  ['ACC-005', 'Bandas de Resistencia Set 5', 349, 25, 'Accesorios', 'FitCore', ['Recuperación', 'Perder grasa'], 'Cinco niveles de tensión'],
  ['ROP-001', 'Playera Dry-Fit Negra', 329, 60, 'Ropa deportiva', 'AthleticWear MX', [], 'Tela transpirable'],
];

// [id, nombre, email, ciudad, objetivos]
const clientes = [
  ['C001', 'Ana Martínez', 'ana.martinez@mail.com', 'Mérida', ['Ganar masa muscular']],
  ['C002', 'Luis Pérez', 'luis.perez@mail.com', 'Mérida', ['Ganar masa muscular', 'Aumentar fuerza']],
  ['C003', 'Sofía Gómez', 'sofia.gomez@mail.com', 'Cancún', ['Perder grasa']],
  ['C004', 'Diego Hernández', 'diego.hernandez@mail.com', 'Mérida', ['Aumentar fuerza']],
  ['C005', 'Valeria Ruiz', 'valeria.ruiz@mail.com', 'Campeche', ['Perder grasa', 'Mejorar resistencia']],
  ['C006', 'Carlos López', 'carlos.lopez@mail.com', 'Mérida', ['Ganar masa muscular']],
  ['C007', 'Fernanda Castro', 'fernanda.castro@mail.com', 'Cancún', ['Mejorar resistencia']],
  ['C008', 'Javier Torres', 'javier.torres@mail.com', 'Progreso', ['Recuperación', 'Mejorar resistencia']],
  ['C009', 'Mariana Flores', 'mariana.flores@mail.com', 'Mérida', ['Perder grasa']],
  ['C010', 'Ricardo Sánchez', 'ricardo.sanchez@mail.com', 'Valladolid', ['Aumentar fuerza', 'Ganar masa muscular']],
  ['C011', 'Daniela Vargas', 'daniela.vargas@mail.com', 'Mérida', ['Recuperación']],
  ['C012', 'Emilio Navarro', 'emilio.navarro@mail.com', 'Cancún', ['Ganar masa muscular', 'Recuperación']],
];

// [clienteId, sku, cantidad]
const compras = [
  // Grupo "masa muscular"
  ['C001', 'PRO-001', 2], ['C001', 'CRE-001', 1], ['C001', 'ACC-001', 1],
  ['C002', 'PRO-002', 1], ['C002', 'CRE-001', 2], ['C002', 'PRE-001', 1], ['C002', 'ACC-003', 1],
  ['C006', 'PRO-001', 1], ['C006', 'CRE-001', 1], ['C006', 'GAN-001', 1], ['C006', 'SNK-002', 2],
  ['C010', 'PRO-002', 1], ['C010', 'CRE-002', 1], ['C010', 'PRE-001', 2], ['C010', 'ACC-002', 1], ['C010', 'ACC-003', 1],
  ['C012', 'PRO-001', 1], ['C012', 'AMI-002', 1], ['C012', 'SNK-001', 1], ['C012', 'CRE-001', 1],
  // Grupo "fuerza"
  ['C004', 'CRE-001', 1], ['C004', 'PRE-001', 1], ['C004', 'ACC-002', 1],
  // Grupo "perder grasa"
  ['C003', 'PRO-003', 1], ['C003', 'QUE-001', 1], ['C003', 'ACC-004', 1],
  ['C005', 'PRO-003', 1], ['C005', 'QUE-002', 2], ['C005', 'ELE-001', 3], ['C005', 'ACC-004', 1],
  ['C009', 'QUE-001', 1], ['C009', 'QUE-002', 1], ['C009', 'SNK-001', 1], ['C009', 'ACC-005', 1], ['C009', 'ACC-001', 1],
  // Grupo "resistencia / recuperación"
  ['C007', 'ELE-001', 2], ['C007', 'AMI-001', 1], ['C007', 'PRE-002', 1],
  ['C008', 'AMI-001', 1], ['C008', 'AMI-002', 1], ['C008', 'VIT-001', 1], ['C008', 'ELE-001', 1],
  ['C011', 'VIT-001', 1], ['C011', 'VIT-002', 1], ['C011', 'AMI-002', 1], ['C011', 'ROP-001', 2],
];

// [clienteId, sku, estrellas]
const calificaciones = [
  ['C001', 'PRO-001', 5], ['C001', 'CRE-001', 4], ['C002', 'PRO-002', 5], ['C002', 'PRE-001', 4],
  ['C003', 'QUE-001', 3], ['C005', 'QUE-002', 4], ['C006', 'GAN-001', 4], ['C007', 'ELE-001', 5],
  ['C008', 'AMI-001', 4], ['C009', 'SNK-001', 5], ['C010', 'ACC-003', 5], ['C012', 'PRO-001', 4],
];

// Cadena de referidos: [quien refiere, a quién refiere]
const referidos = [
  ['C001', 'C002'], ['C001', 'C006'], ['C002', 'C010'], ['C002', 'C004'],
  ['C010', 'C012'], ['C003', 'C005'], ['C005', 'C009'], ['C007', 'C008'], ['C008', 'C011'],
];

const int = (n) => neo4j.int(n);

async function main() {
  console.log('Limpiando la base de datos...');
  await write('MATCH (n) DETACH DELETE n');

  console.log('Creando objetivos...');
  await write('UNWIND $objetivos AS nombre MERGE (:Objetivo {nombre: nombre})', { objetivos });

  console.log('Creando productos, categorías y marcas...');
  await write(
    `
    UNWIND $productos AS row
    CREATE (p:Producto {sku: row.sku, nombre: row.nombre, precio: toFloat(row.precio),
                        stock: row.stock, descripcion: row.descripcion})
    MERGE (cat:Categoria {nombre: row.categoria})
    MERGE (m:Marca {nombre: row.marca})
    MERGE (p)-[:PERTENECE_A]->(cat)
    MERGE (p)-[:DE_MARCA]->(m)
    FOREACH (o IN row.objetivos |
      MERGE (obj:Objetivo {nombre: o})
      MERGE (p)-[:AYUDA_A]->(obj))`,
    {
      productos: productos.map(([sku, nombre, precio, stock, categoria, marca, objs, descripcion]) => ({
        sku, nombre, precio, stock: int(stock), categoria, marca, objetivos: objs, descripcion,
      })),
    }
  );

  console.log('Creando clientes...');
  await write(
    `
    UNWIND $clientes AS row
    CREATE (c:Cliente {id: row.id, nombre: row.nombre, email: row.email, ciudad: row.ciudad,
                       creadoEn: datetime() - duration({days: row.antiguedad})})
    FOREACH (o IN row.objetivos |
      MERGE (obj:Objetivo {nombre: o})
      MERGE (c)-[:BUSCA]->(obj))`,
    {
      clientes: clientes.map(([id, nombre, email, ciudad, objs], i) => ({
        id, nombre, email, ciudad, objetivos: objs, antiguedad: int(200 - i * 12),
      })),
    }
  );

  console.log('Registrando compras (y descontando stock)...');
  await write(
    `
    UNWIND $compras AS row
    MATCH (c:Cliente {id: row.cliente}), (p:Producto {sku: row.sku})
    SET p.stock = p.stock - row.cantidad
    MERGE (c)-[k:COMPRO]->(p)
      ON CREATE SET k.cantidad = row.cantidad, k.veces = 1,
                    k.primeraFecha = date() - duration({days: row.hace}), k.ultimaFecha = date() - duration({days: row.hace})`,
    {
      compras: compras.map(([cliente, sku, cantidad], i) => ({
        cliente, sku, cantidad: int(cantidad), hace: int((i * 7) % 90),
      })),
    }
  );

  console.log('Registrando calificaciones...');
  await write(
    `
    UNWIND $calificaciones AS row
    MATCH (c:Cliente {id: row.cliente})-[:COMPRO]->(p:Producto {sku: row.sku})
    MERGE (c)-[r:CALIFICO]->(p)
    SET r.estrellas = row.estrellas, r.fecha = date()`,
    { calificaciones: calificaciones.map(([cliente, sku, e]) => ({ cliente, sku, estrellas: int(e) })) }
  );

  console.log('Registrando referidos...');
  await write(
    `
    UNWIND $referidos AS row
    MATCH (a:Cliente {id: row.de}), (b:Cliente {id: row.a})
    MERGE (a)-[r:REFIRIO]->(b)
    ON CREATE SET r.fecha = date()`,
    { referidos: referidos.map(([de, a]) => ({ de, a })) }
  );

  const resumen = await read(`
    MATCH (n) WITH count(n) AS nodos
    MATCH ()-[r]->()
    RETURN nodos, count(r) AS relaciones`);
  console.log(`✔ Seeding terminado: ${resumen[0].nodos} nodos y ${resumen[0].relaciones} relaciones.`);
}

main()
  .catch((err) => {
    console.error('Error en el seeding:', err.message);
    process.exitCode = 1;
  })
  .finally(close);
