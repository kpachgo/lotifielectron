const db = require('../config/db');

// LISTAR LOTIFICACIONES
exports.listar = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM lotificaciones ORDER BY id_lotificacion DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('ERROR LISTAR LOTIFICACIONES:', error);
    res.status(500).json({ error: 'Error al listar lotificaciones' });
  }
};

// CREAR LOTIFICACION
exports.crear = async (req, res) => {
  try {
    const { nombre, ubicacion, descripcion } = req.body;

    const [result] = await db.query(
      `INSERT INTO lotificaciones (nombre, ubicacion, descripcion)
       VALUES (?,?,?)`,
      [nombre, ubicacion, descripcion]
    );

    res.json({ ok: true, id_lotificacion: result.insertId });
  } catch (error) {
    console.error('ERROR CREAR LOTIFICACION:', error);
    res.status(500).json({ error: 'Error al crear lotificación' });
  }
};

// OBTENER UNA LOTIFICACION
exports.obtener = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM lotificaciones WHERE id_lotificacion = ?',
      [req.params.id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('ERROR OBTENER LOTIFICACION:', error);
    res.status(500).json({ error: 'Error al obtener lotificación' });
  }
};
