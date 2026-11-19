const router = require('express').Router();
const repo = require('../repositories/clientes.repo');
const interacciones = require('../repositories/interacciones.repo');
const { asyncHandler, requerir, aLista } = require('../middleware/errores');

// READ (todos)
router.get('/', asyncHandler(async (req, res) => res.json(await repo.listar())));

// READ (uno, con sus compras)
router.get('/:id', asyncHandler(async (req, res) => {
  const cliente = await repo.obtener(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(cliente);
}));

// CREATE
router.post('/', asyncHandler(async (req, res) => {
  requerir(req.body, ['nombre', 'email']);
  const id = await repo.crear({ ...req.body, objetivos: aLista(req.body.objetivos) || [] });
  res.status(201).json({ id });
}));

// UPDATE
router.put('/:id', asyncHandler(async (req, res) => {
  const ok = await repo.actualizar(req.params.id, { ...req.body, objetivos: aLista(req.body.objetivos) });
  if (!ok) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ actualizado: true });
}));

// DELETE
router.delete('/:id', asyncHandler(async (req, res) => {
  const ok = await repo.eliminar(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ eliminado: true });
}));

// --- Relaciones del cliente ---
router.post('/:id/compras', asyncHandler(async (req, res) => {
  requerir(req.body, ['sku']);
  const r = await interacciones.comprar(req.params.id, req.body.sku, parseInt(req.body.cantidad, 10) || 1);
  res.status(201).json(r);
}));

router.delete('/:id/compras/:sku', asyncHandler(async (req, res) => {
  res.json(await interacciones.devolver(req.params.id, req.params.sku));
}));

router.post('/:id/calificaciones', asyncHandler(async (req, res) => {
  requerir(req.body, ['sku', 'estrellas']);
  res.json(await interacciones.calificar(req.params.id, req.body.sku, req.body.estrellas));
}));

router.post('/:id/referidos', asyncHandler(async (req, res) => {
  requerir(req.body, ['referidoId']);
  res.status(201).json(await interacciones.referir(req.params.id, req.body.referidoId));
}));

module.exports = router;
