const db = require('../config/db');

// LISTAR LOTES POR POLIGONO
exports.listarPorPoligono = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        id_lote,
        id_poligono,
        numero_lote,
        area,
        unidad_area,
        precio_base,
        precio,
        estado
      FROM lotes
      WHERE id_poligono = ?
      ORDER BY numero_lote`,
      [req.params.id]
    );

    res.json(rows);
  } catch (error) {
    console.error('ERROR LISTAR LOTES:', error);
    res.status(500).json({ error: 'Error al listar lotes' });
  }
};

//CREAR
exports.crear = async (req, res) => {
  try {
    let {
      id_poligono,
      numero_lote,
      area,
      unidad_area,
      precio_base,
      precio,
      estado
    } = req.body;

    // 🔑 Si precio viene vacío, usar NULL
    if (precio === '' || precio === undefined) {
      precio = null;
    }

    const [result] = await db.query(
      `INSERT INTO lotes
       (id_poligono, numero_lote, area, unidad_area, precio_base, precio, estado)
       VALUES (?,?,?,?,?,?,?)`,
      [id_poligono, numero_lote, area, unidad_area, precio_base, precio, estado]
    );

    res.json({ ok: true, id_lote: result.insertId });
  } catch (error) {
    console.error('ERROR CREAR LOTE:', error);
    res.status(500).json({ error: 'Error al crear lote' });
  }
};
// LISTAR LOTES DISPONIBLES POR POLIGONO
exports.listarDisponiblesPorPoligono = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        id_lote,
        numero_lote,
        precio_base
       FROM lotes
       WHERE id_poligono = ?
       AND estado = 'disponible'
       ORDER BY numero_lote`,
      [req.params.idPoligono]
    );

    res.json(rows);
  } catch (error) {
    console.error('ERROR LISTAR LOTES DISPONIBLES:', error);
    res.status(500).json([]);
  }
};
// OBTENER LOTE POR ID (precio + cuotas)
exports.obtenerPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT
        id_lote,
        precio_base,
        prima,
        cuota_5_anios,
        cuota_10_anios,
        cuota_15_anios
      FROM lotes
      WHERE id_lote = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }

    const lote = rows[0];

    res.json({
      precio_total: lote.precio_base,
      prima: lote.prima || 2500,
      cuotas: {
        60: lote.cuota_5_anios,
        120: lote.cuota_10_anios,
        180: lote.cuota_15_anios
      }
    });

  } catch (error) {
    console.error('ERROR OBTENER LOTE:', error);
    res.status(500).json({ error: 'Error al obtener lote' });
  }
};

