const router = require('express').Router();
const repo = require('../repositories/recomendaciones.repo');
const { asyncHandler } = require('../middleware/errores');

router.get('/colaborativo/:clienteId', asyncHandler(async (req, res) =>
  res.json(await repo.colaborativo(req.params.clienteId, req.query.limite))));

router.get('/objetivo/:clienteId', asyncHandler(async (req, res) =>
  res.json(await repo.porObjetivo(req.params.clienteId, req.query.limite))));

router.get('/tambien-compraron/:sku', asyncHandler(async (req, res) =>
  res.json(await repo.tambienCompraron(req.params.sku, req.query.limite))));

router.get('/comprados-juntos', asyncHandler(async (req, res) =>
  res.json(await repo.compradosJuntos(req.query.limite))));

router.get('/camino', asyncHandler(async (req, res) => {
  const { desde, hasta, modo } = req.query;
  if (!desde || !hasta) return res.status(400).json({ error: 'Indica ?desde=ID&hasta=ID' });
  if (desde === hasta) return res.status(400).json({ error: 'Elige dos clientes distintos' });
  const camino = await repo.caminoMasCorto(desde, hasta, modo);
  if (!camino) return res.status(404).json({ error: 'No existe un camino entre esos clientes' });
  res.json(camino);
}));

router.get('/vecindad/:clienteId', asyncHandler(async (req, res) =>
  res.json(await repo.vecindad(req.params.clienteId, req.query.profundidad))));

router.get('/influencers', asyncHandler(async (req, res) =>
  res.json(await repo.influencers(req.query.limite))));

module.exports = router;
