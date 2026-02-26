const db = require('../config/db');

// LISTAR POR LOTIFICACION
exports.listarPorLotificacion = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         id_poligono,
         id_lotificacion,
         nombre_poligono AS nombre
       FROM poligonos
       WHERE id_lotificacion = ?
       ORDER BY id_poligono`,
      [req.params.id]
    );

    res.json(rows);
  } catch (error) {
    console.error('ERROR LISTAR POLIGONOS:', error);
    res.status(500).json({ error: 'Error al listar polígonos' });
  }
};


// CREAR POLIGONO
exports.crear = async (req, res) => {
  try {
    const { id_lotificacion, nombre } = req.body;

    const [result] = await db.query(
      'INSERT INTO poligonos (id_lotificacion, nombre_poligono) VALUES (?, ?)',
      [id_lotificacion, nombre]
    );

    res.json({ ok: true, id_poligono: result.insertId });
  } catch (error) {
    console.error('ERROR CREAR POLIGONO:', error);
    res.status(500).json({ error: 'Error al crear polígono' });
  }
};
