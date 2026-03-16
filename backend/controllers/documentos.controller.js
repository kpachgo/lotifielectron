const db = require('../config/db');
const fs = require('node:fs');
const path = require('node:path');
const { uploadDir } = require('../config/uploads');

const TIPOS_DOCUMENTO_CLIENTE = new Set([
  'contrato',
  'dui',
  'nit',
  'foto_cliente',
  'otro'
]);

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function limpiarTexto(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function eliminarArchivoSubido(file) {
  if (!file || !file.path) return;
  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.warn(`No se pudo limpiar archivo temporal: ${error.message}`);
  }
}

function eliminarArchivoDocumento(rutaArchivo) {
  if (!rutaArchivo) return;
  const nombre = path.basename(String(rutaArchivo));
  if (!nombre) return;
  const fullPath = path.join(uploadDir, nombre);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.warn(`No se pudo eliminar archivo ${fullPath}: ${error.message}`);
  }
}

// SUBIR COMPROBANTE DE PAGO
exports.subirComprobante = async (req, res) => {
  try {
    const { id_pago } = req.body;

    if (!req.file || !id_pago) {
      return res.status(400).json({ error: 'Archivo o pago inválido' });
    }

    await db.query(
      `INSERT INTO documentos
      (id_pago, tipo_documento, ruta_archivo, fecha_subida)
      VALUES (?,?,?,NOW())`,
      [
        id_pago,
        'comprobante',
        path.posix.join('uploads', req.file.filename)
      ]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error('ERROR SUBIR COMPROBANTE:', error);
    res.status(500).json({ error: 'Error al subir comprobante' });
  }
};

// OBTENER COMPROBANTE POR PAGO
exports.obtenerComprobantePorPago = async (req, res) => {
  try {
    const { id_pago } = req.params;

    const [rows] = await db.query(
      `SELECT id_documento, ruta_archivo, fecha_subida
       FROM documentos
       WHERE id_pago = ?
       LIMIT 1`,
      [id_pago]
    );

    if (rows.length === 0) {
      return res.json(null);
    }

    res.json(rows[0]);

  } catch (error) {
    console.error('ERROR OBTENER COMPROBANTE:', error);
    res.status(500).json({ error: 'Error al obtener comprobante' });
  }
};

// SUBIR DOCUMENTO DE CLIENTE (NO COMPROBANTE)
exports.subirDocumentoCliente = async (req, res) => {
  try {
    const idCliente = toInt(req.body?.id_cliente);
    const idContrato = req.body?.id_contrato ? toInt(req.body.id_contrato) : null;
    const tipoDocumento = limpiarTexto(req.body?.tipo_documento).toLowerCase();
    const descripcionDocumento = limpiarTexto(req.body?.descripcion_documento);

    if (!req.file) {
      return res.status(400).json({ error: 'Archivo requerido' });
    }
    if (!idCliente) {
      eliminarArchivoSubido(req.file);
      return res.status(400).json({ error: 'id_cliente invalido' });
    }
    if (!TIPOS_DOCUMENTO_CLIENTE.has(tipoDocumento)) {
      eliminarArchivoSubido(req.file);
      return res.status(400).json({ error: 'tipo_documento invalido' });
    }
    if (tipoDocumento === 'otro' && !descripcionDocumento) {
      eliminarArchivoSubido(req.file);
      return res.status(400).json({ error: 'descripcion_documento requerida para tipo otro' });
    }
    if (req.body?.id_contrato && !idContrato) {
      eliminarArchivoSubido(req.file);
      return res.status(400).json({ error: 'id_contrato invalido' });
    }

    const [[cliente]] = await db.query(
      'SELECT id_cliente FROM cliente WHERE id_cliente = ?',
      [idCliente]
    );

    if (!cliente) {
      eliminarArchivoSubido(req.file);
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (idContrato) {
      const [[contrato]] = await db.query(
        `SELECT id_contrato
         FROM contratos
         WHERE id_contrato = ? AND id_cliente = ?`,
        [idContrato, idCliente]
      );

      if (!contrato) {
        eliminarArchivoSubido(req.file);
        return res.status(400).json({ error: 'Contrato no pertenece al cliente' });
      }
    }

    const rutaArchivo = path.posix.join('uploads', req.file.filename);
    const [result] = await db.query(
      `INSERT INTO documentos
       (id_pago, id_cliente, id_contrato, tipo_documento, descripcion_documento, ruta_archivo, fecha_subida)
       VALUES (NULL, ?, ?, ?, ?, ?, NOW())`,
      [
        idCliente,
        idContrato,
        tipoDocumento,
        tipoDocumento === 'otro' ? descripcionDocumento : null,
        rutaArchivo
      ]
    );

    return res.json({
      ok: true,
      id_documento: result.insertId,
      ruta_archivo: rutaArchivo
    });
  } catch (error) {
    eliminarArchivoSubido(req.file);
    console.error('ERROR SUBIR DOCUMENTO CLIENTE:', error);
    return res.status(500).json({ error: 'Error al subir documento de cliente' });
  }
};

// LISTAR DOCUMENTOS DE CLIENTE (EXCLUYE COMPROBANTES)
exports.listarDocumentosCliente = async (req, res) => {
  try {
    const idCliente = toInt(req.params?.id_cliente);
    const idContrato = req.query?.id_contrato ? toInt(req.query.id_contrato) : null;

    if (!idCliente) {
      return res.status(400).json({ error: 'id_cliente invalido' });
    }
    if (req.query?.id_contrato && !idContrato) {
      return res.status(400).json({ error: 'id_contrato invalido' });
    }

    const params = [idCliente];
    let filtroContrato = '';

    if (idContrato) {
      filtroContrato = ' AND d.id_contrato = ? ';
      params.push(idContrato);
    }

    const [rows] = await db.query(
      `
      SELECT
        d.id_documento,
        d.id_cliente,
        d.id_contrato,
        d.tipo_documento,
        d.descripcion_documento,
        d.ruta_archivo,
        d.fecha_subida,
        l.numero_lote,
        p.nombre_poligono AS poligono,
        lo.nombre AS lotificacion
      FROM documentos d
      LEFT JOIN contratos c ON c.id_contrato = d.id_contrato
      LEFT JOIN lotes l ON l.id_lote = c.id_lote
      LEFT JOIN poligonos p ON p.id_poligono = l.id_poligono
      LEFT JOIN lotificaciones lo ON lo.id_lotificacion = p.id_lotificacion
      WHERE d.id_cliente = ?
        AND d.tipo_documento <> 'comprobante'
        ${filtroContrato}
      ORDER BY d.fecha_subida DESC, d.id_documento DESC
      `,
      params
    );

    return res.json(rows);
  } catch (error) {
    console.error('ERROR LISTAR DOCUMENTOS CLIENTE:', error);
    return res.status(500).json({ error: 'Error al listar documentos de cliente' });
  }
};

// ELIMINAR DOCUMENTO DE CLIENTE (NO COMPROBANTE)
exports.eliminarDocumentoCliente = async (req, res) => {
  try {
    const idDocumento = toInt(req.params?.id_documento);
    if (!idDocumento) {
      return res.status(400).json({ error: 'id_documento invalido' });
    }

    const [[doc]] = await db.query(
      `SELECT id_documento, tipo_documento, ruta_archivo
       FROM documentos
       WHERE id_documento = ?`,
      [idDocumento]
    );

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (doc.tipo_documento === 'comprobante') {
      return res.status(409).json({ error: 'No se permite eliminar comprobantes desde este modulo' });
    }

    await db.query('DELETE FROM documentos WHERE id_documento = ?', [idDocumento]);
    eliminarArchivoDocumento(doc.ruta_archivo);

    return res.json({ ok: true });
  } catch (error) {
    console.error('ERROR ELIMINAR DOCUMENTO CLIENTE:', error);
    return res.status(500).json({ error: 'Error al eliminar documento de cliente' });
  }
};
