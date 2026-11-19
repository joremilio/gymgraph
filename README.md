# GymGraph — Motor de recomendaciones con Neo4j AuraDB

Aplicación web para una **tienda de productos de gimnasio** que usa una base de datos NoSQL de **grafo (Neo4j AuraDB)** para gestionar clientes, productos y compras, y para generar **recomendaciones** recorriendo las relaciones entre ellos.

Proyecto de *Bases de Datos Avanzadas* — Jorge Emilio León Saucedo (00531336).

## Tecnologías

| Capa | Tecnología |
|---|---|
| Base de datos | Neo4j AuraDB Free (DBaaS en la nube, Neo4j 5) |
| Driver | `neo4j-driver` (driver oficial de Neo4j para JavaScript), protocolo Bolt sobre TLS (`neo4j+s://`) |
| Backend | Node.js 18+ y Express (API REST) |
| Frontend | HTML + CSS + JavaScript, `vis-network` para dibujar el grafo |
| Configuración | Variables de entorno con `dotenv` |

## Requisitos

- Node.js 18 o superior (`node -v`)
- Una cuenta gratuita en <https://console.neo4j.io> con una instancia **AuraDB Free**
- Conexión a internet

## Instalación

### 1. Crear la base de datos en la nube
1. Entra a <https://console.neo4j.io> y crea una instancia **AuraDB Free**.
2. Al crearla se descarga un archivo `Neo4j-xxxxxxxx-Created-....txt` con la URI, el usuario y la contraseña. **Guárdalo:** la contraseña solo se muestra una vez.
3. Espera a que la instancia aparezca como *Running* (1–3 minutos).

### 2. Configurar el proyecto
```bash
git clone <url-del-repo> gymgraph   # o descomprime el .zip
cd gymgraph
npm install
cp .env.example .env               # en Windows: copy .env.example .env
```
Abre `.env` y pega los datos del archivo de Aura:
```env
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=tu_password
NEO4J_DATABASE=neo4j
PORT=3000
```
> El archivo `.env` está en `.gitignore`: las credenciales nunca se suben al repositorio.

### 3. Crear el esquema y cargar los datos iniciales
```bash
npm run check    # prueba la conexión con AuraDB
npm run setup    # = npm run schema (restricciones e índices) + npm run seed (datos de prueba)
```
El seeding **borra** los datos existentes y carga 12 clientes, 24 productos, 10 categorías, 6 marcas, 5 objetivos, 46 compras, 12 calificaciones y 9 referidos.

### 4. Ejecutar
```bash
npm start
```
Abre <http://localhost:3000>. En la esquina superior derecha debe aparecer **● Conectado · xxxxxxxx.databases.neo4j.io**.

## Estructura del repositorio

```
gymgraph/
├── server.js                       # Punto de entrada: verifica la conexión y levanta Express
├── src/
│   ├── app.js                      # Configuración de Express y rutas
│   ├── config/db.js                # Driver de Neo4j, sesiones y transacciones (executeRead/executeWrite)
│   ├── repositories/               # Toda la lógica Cypher
│   │   ├── clientes.repo.js        # CRUD de :Cliente
│   │   ├── productos.repo.js       # CRUD de :Producto (+ categoría, marca, objetivos)
│   │   ├── interacciones.repo.js   # COMPRO, CALIFICO, REFIRIO (control de stock transaccional)
│   │   └── recomendaciones.repo.js # Consultas de grafo: recomendaciones, caminos, vecindad
│   ├── routes/                     # Endpoints REST
│   └── middleware/errores.js       # Validación y manejo centralizado de errores
├── scripts/
│   ├── schema.cypher               # Script de base de datos: restricciones e índices
│   ├── schema.js                   # Ejecuta schema.cypher
│   ├── seed.js                     # Seeding script (datos iniciales)
│   └── check-connection.js         # Prueba de conexión
└── public/                         # Interfaz web (index.html, app.js, styles.css)
```

## Modelo de grafo

```
(:Cliente)-[:COMPRO {cantidad, veces, primeraFecha, ultimaFecha}]->(:Producto)
(:Cliente)-[:CALIFICO {estrellas, fecha}]->(:Producto)
(:Cliente)-[:BUSCA]->(:Objetivo)
(:Cliente)-[:REFIRIO {fecha}]->(:Cliente)
(:Producto)-[:PERTENECE_A]->(:Categoria)
(:Producto)-[:DE_MARCA]->(:Marca)
(:Producto)-[:AYUDA_A]->(:Objetivo)
```

## API REST

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/salud` | Estado de la conexión con AuraDB |
| GET / POST | `/api/clientes` | Listar / crear clientes |
| GET / PUT / DELETE | `/api/clientes/:id` | Leer / actualizar / eliminar un cliente |
| POST | `/api/clientes/:id/compras` | Registrar compra `{sku, cantidad}` |
| DELETE | `/api/clientes/:id/compras/:sku` | Devolver compra (regresa stock) |
| POST | `/api/clientes/:id/calificaciones` | Calificar `{sku, estrellas}` |
| POST | `/api/clientes/:id/referidos` | Registrar referido `{referidoId}` |
| GET / POST | `/api/productos` | Listar (`?categoria=`) / crear productos |
| GET / PUT / DELETE | `/api/productos/:sku` | Leer / actualizar / eliminar un producto |
| GET | `/api/productos/catalogos` | Categorías, marcas y objetivos |
| GET | `/api/recomendaciones/colaborativo/:clienteId` | Filtrado colaborativo (Jaccard) |
| GET | `/api/recomendaciones/objetivo/:clienteId` | Recomendación por objetivos |
| GET | `/api/recomendaciones/tambien-compraron/:sku` | Quienes compraron esto también compraron |
| GET | `/api/recomendaciones/comprados-juntos` | Pares de productos más comprados juntos |
| GET | `/api/recomendaciones/camino?desde=&hasta=&modo=general\|referidos` | Camino más corto (`shortestPath`) |
| GET | `/api/recomendaciones/vecindad/:clienteId?profundidad=1-3` | Vecindad a N saltos |
| GET | `/api/recomendaciones/influencers` | Alcance en la red de referidos |

## Guion sugerido para la demo (4 min)

1. Mostrar el indicador **Conectado** (servidor en la nube) y `npm run check`.
2. **Clientes:** crear un cliente nuevo con objetivo *Ganar masa muscular*; editarlo; mostrar que aparece en la consola de Aura.
3. **Compras:** registrarle una compra de *Proteína Whey Vainilla*; ver que baja el stock. Intentar comprar más del stock disponible → error 409.
4. **Recomendaciones:** seleccionar al nuevo cliente → ver recomendaciones colaborativas y por objetivo.
5. **Explorar grafo:** vecindad de *C001* a 2 saltos; camino más corto *C001 → C012* en modo *Cadena de referidos*.
6. Reiniciar el servidor (`Ctrl+C`, `npm start`) y mostrar que los datos persisten.

## Solución de problemas

| Mensaje | Causa probable |
|---|---|
| `Faltan variables de entorno` | No existe `.env` o le faltan valores |
| `Could not perform discovery` / `ServiceUnavailable` | URI incorrecta, instancia pausada (AuraDB Free se pausa tras 3 días sin uso: reanúdala en la consola) o sin internet |
| `Unauthorized` | Usuario o contraseña incorrectos |
| `Ya existe un registro con ese identificador único` | Email o SKU repetido (restricción UNIQUE) |
