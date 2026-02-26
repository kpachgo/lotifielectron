const express = require('express');
const router = express.Router();
const poligonosController = require('../controllers/poligonos.controller');

router.get('/lotificacion/:id', poligonosController.listarPorLotificacion);
router.post('/', poligonosController.crear);

module.exports = router;
