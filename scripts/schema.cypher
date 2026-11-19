// =====================================================================
//  GymGraph — Script de base de datos (esquema)
//  Motor: Neo4j 5 (AuraDB).  Ejecutar con:  npm run schema
//  También se puede pegar en Neo4j Browser / Query de la consola de Aura.
// =====================================================================

// --- Restricciones de unicidad (crean automáticamente un índice) ---
CREATE CONSTRAINT cliente_id IF NOT EXISTS
FOR (c:Cliente) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT cliente_email IF NOT EXISTS
FOR (c:Cliente) REQUIRE c.email IS UNIQUE;

CREATE CONSTRAINT producto_sku IF NOT EXISTS
FOR (p:Producto) REQUIRE p.sku IS UNIQUE;

CREATE CONSTRAINT categoria_nombre IF NOT EXISTS
FOR (c:Categoria) REQUIRE c.nombre IS UNIQUE;

CREATE CONSTRAINT marca_nombre IF NOT EXISTS
FOR (m:Marca) REQUIRE m.nombre IS UNIQUE;

CREATE CONSTRAINT objetivo_nombre IF NOT EXISTS
FOR (o:Objetivo) REQUIRE o.nombre IS UNIQUE;

// --- Índices adicionales para búsquedas frecuentes ---
CREATE INDEX producto_nombre IF NOT EXISTS
FOR (p:Producto) ON (p.nombre);

CREATE INDEX cliente_nombre IF NOT EXISTS
FOR (c:Cliente) ON (c.nombre);
