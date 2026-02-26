const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'backend/uploads/comprobantes');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nombre = `pago_${Date.now()}${ext}`;
    cb(null, nombre);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'));
    }
    cb(null, true);
  }
});

module.exports = upload;
