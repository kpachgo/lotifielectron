const express = require('express');
const router = express.Router();
const deudoresController = require('../controllers/deudores.controller');

// GET /api/deudores
router.get('/', deudoresController.obtenerDeudores);

module.exports = router;
