const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('node:path');
const documentosController = require('../controllers/documentos.controller');
const { uploadDir } = require('../config/uploads');

const MIMES_PERMITIDOS_CLIENTE = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
]);

const storageComprobante = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `pago_${Date.now()}${ext}`);
  }
});

const storageCliente = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    const idCliente = String(req.body?.id_cliente || '0').replace(/\D/g, '') || '0';
    const random = Math.random().toString(16).slice(2, 8);
    cb(null, `cliente_${idCliente}_${Date.now()}_${random}${ext || '.bin'}`);
  }
});

const uploadComprobante = multer({ storage: storageComprobante });
const uploadDocumentoCliente = multer({
  storage: storageCliente,
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    const validoMime = MIMES_PERMITIDOS_CLIENTE.has(String(file.mimetype || '').toLowerCase());
    const validoExt = ['.pdf', '.jpg', '.jpeg', '.png'].includes(ext);

    if (validoMime && validoExt) {
      cb(null, true);
      return;
    }

    const err = new Error('Formato no permitido. Solo PDF/JPG/JPEG/PNG');
    err.code = 'FILE_TYPE_NOT_ALLOWED';
    cb(err);
  }
});

function ejecutarUpload(uploadSingle) {
  return (req, res, next) => {
    uploadSingle(req, res, (err) => {
      if (!err) {
        next();
        return;
      }

      if (err.code === 'FILE_TYPE_NOT_ALLOWED') {
        res.status(400).json({ error: err.message });
        return;
      }

      res.status(400).json({ error: err.message || 'Error al procesar archivo' });
    });
  };
}

router.post(
  '/comprobante',
  ejecutarUpload(uploadComprobante.single('comprobante')),
  documentosController.subirComprobante
);
router.get('/comprobante/:id_pago', documentosController.obtenerComprobantePorPago);
router.post(
  '/cliente',
  ejecutarUpload(uploadDocumentoCliente.single('archivo')),
  documentosController.subirDocumentoCliente
);
router.get('/cliente/:id_cliente', documentosController.listarDocumentosCliente);
router.delete('/cliente/:id_documento', documentosController.eliminarDocumentoCliente);

module.exports = router;
