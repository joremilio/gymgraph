const router = require('express').Router();
const repo = require('../repositories/productos.repo');
const { asyncHandler, requerir, aLista } = require('../middleware/errores');

// Catálogos (categorías, marcas, objetivos) para la interfaz
router.get('/catalogos', asyncHandler(async (req, res) => res.json(await repo.catalogos())));

// READ (todos, filtro opcional ?categoria=)
router.get('/', asyncHandler(async (req, res) => res.json(await repo.listar({ categoria: req.query.categoria }))));

// READ (uno)
router.get('/:sku', asyncHandler(async (req, res) => {
  const producto = await repo.obtener(req.params.sku);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(producto);
}));

// CREATE
router.post('/', asyncHandler(async (req, res) => {
  requerir(req.body, ['sku', 'nombre', 'precio', 'categoria', 'marca']);
  const sku = await repo.crear({ ...req.body, objetivos: aLista(req.body.objetivos) || [] });
  res.status(201).json({ sku });
}));

// UPDATE
router.put('/:sku', asyncHandler(async (req, res) => {
  const ok = await repo.actualizar(req.params.sku, { ...req.body, objetivos: aLista(req.body.objetivos) });
  if (!ok) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ actualizado: true });
}));

// DELETE
router.delete('/:sku', asyncHandler(async (req, res) => {
  const ok = await repo.eliminar(req.params.sku);
  if (!ok) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ eliminado: true });
}));

module.exports = router;
