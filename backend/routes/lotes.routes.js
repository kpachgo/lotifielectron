const express = require('express');
const router = express.Router();
const lotesController = require('../controllers/lotes.controller');

router.get('/:id', lotesController.obtenerPorId);
router.get('/poligono/:id', lotesController.listarPorPoligono);
router.post('/', lotesController.crear);
router.get('/disponibles/:idPoligono', lotesController.listarDisponiblesPorPoligono);


module.exports = router;
