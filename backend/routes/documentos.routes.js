const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('node:path');
const documentosController = require('../controllers/documentos.controller');
const { uploadDir } = require('../config/uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `pago_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });
router.post(
  '/comprobante',
  upload.single('comprobante'),
  documentosController.subirComprobante
);
router.get('/comprobante/:id_pago', documentosController.obtenerComprobantePorPago);

module.exports = router;
