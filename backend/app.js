require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { uploadDir, legacyUploadDirs } = require('./config/uploads');

const app = express();

app.use(cors());
app.use(express.json());

// =======================
// 🔹 RUTAS API PRIMERO
// =======================

// Clientes
app.use('/api/cliente', require('./routes/cliente.routes'));

// Lotificaciones
app.use('/api/lotificaciones', require('./routes/lotificaciones.routes'));

// Polígonos
app.use('/api/poligonos', require('./routes/poligonos.routes'));

// Lotes
app.use('/api/lotes', require('./routes/lotes.routes'));

// Contratos
app.use('/api/contratos', require('./routes/contratos.routes'));

// Cuotas
app.use('/api/cuotas', require('./routes/cuotas.routes'));


// Pagos
app.use('/api/pagos', require('./routes/pagos.routes'));

// Documentos
app.use('/api/documentos', require('./routes/documentos.routes'));

// Deudores
app.use('/api/deudores', require('./routes/deudores.routes'));

// Reportes
app.use('/api/reportes', require('./routes/reportes.routes'));

// Subida de archivos
app.use('/uploads', express.static(uploadDir));
legacyUploadDirs.forEach((dir) => {
  app.use('/uploads', express.static(dir));
});

const recibosRoutes = require('./routes/recibos.routes');
app.use('/api/recibos', recibosRoutes);

// =======================
// 🔹 FRONTEND AL FINAL
// =======================
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

module.exports = app;

