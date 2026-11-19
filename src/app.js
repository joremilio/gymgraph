/**
 * Configuración de Express: middlewares, rutas de la API REST y archivos estáticos.
 */
const path = require('path');
const express = require('express');
const { verifyConnection, DATABASE } = require('./config/db');
const { asyncHandler, manejadorErrores } = require('./middleware/errores');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Estado de la conexión con la base de datos en la nube (útil en la demo)
app.get('/api/salud', asyncHandler(async (req, res) => {
  const info = await verifyConnection();
  res.json({ ok: true, servidor: info.address, version: info.agent, baseDeDatos: DATABASE });
}));

app.use('/api/clientes', require('./routes/clientes.routes'));
app.use('/api/productos', require('./routes/productos.routes'));
app.use('/api/recomendaciones', require('./routes/recomendaciones.routes'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(manejadorErrores);

module.exports = app;
