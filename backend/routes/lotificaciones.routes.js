const express = require('express');
const router = express.Router();
const lotificacionesController = require('../controllers/lotificaciones.controller');

router.get('/', lotificacionesController.listar);
router.get('/resumen', lotificacionesController.resumen);
router.post('/', lotificacionesController.crear);
router.get('/:id', lotificacionesController.obtener);

module.exports = router;
