const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');

// GET /api/reportes/contratos
router.get('/contratos', reportesController.obtenerReporteContratos);
router.get('/resumen/:idContrato', reportesController.resumenContrato);

module.exports = router;
