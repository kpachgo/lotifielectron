const express = require('express');
const router = express.Router();
const cuotasController = require('../controllers/cuotas.controller');

// SOLO ESTA RUTA
router.get('/contrato/:idContrato', cuotasController.obtenerCuotasPorContrato);

router.get('/pendiente/:idContrato', cuotasController.obtenerCuotaPendiente);

module.exports = router;
