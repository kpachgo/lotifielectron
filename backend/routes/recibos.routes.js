const express = require('express');
const router = express.Router();

const {
  obtenerReciboPorPago
} = require('../controllers/recibos.controller');

// ===============================
// RECIBO POR ID DE PAGO
// ===============================
// Devuelve los datos listos para imprimir
router.get('/pago/:id_pago', obtenerReciboPorPago);

module.exports = router;
