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

// RESUMEN DE LOTIFICACIONES + ESTADOS DE LOTES
exports.resumen = async (req, res) => {
  try {
    const estado = String(req.query.estado || 'todos').trim().toLowerCase();
    const q = String(req.query.q || '').trim();
    const estadosPermitidos = ['todos', 'disponible', 'promesa_venta', 'vendido', 'reservado'];

    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado de filtro no valido' });
    }

    const whereParts = [];
    const params = [];

    if (q) {
      whereParts.push('(l.nombre LIKE ? OR l.ubicacion LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    if (estado !== 'todos') {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM poligonos p2
        JOIN lotes lt2 ON lt2.id_poligono = p2.id_poligono
        WHERE p2.id_lotificacion = l.id_lotificacion
          AND lt2.estado = ?
      )`);
      params.push(estado);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [rows] = await db.query(
      `
      SELECT
        l.id_lotificacion,
        l.nombre,
        l.ubicacion,
        COUNT(lt.id_lote) AS total_lotes,
        SUM(CASE WHEN lt.estado = 'disponible' THEN 1 ELSE 0 END) AS lotes_disponibles,
        SUM(CASE WHEN lt.estado = 'promesa_venta' THEN 1 ELSE 0 END) AS lotes_promesa_venta,
        SUM(CASE WHEN lt.estado = 'vendido' THEN 1 ELSE 0 END) AS lotes_vendidos,
        SUM(CASE WHEN lt.estado = 'reservado' THEN 1 ELSE 0 END) AS lotes_reservados
      FROM lotificaciones l
      LEFT JOIN poligonos p ON p.id_lotificacion = l.id_lotificacion
      LEFT JOIN lotes lt ON lt.id_poligono = p.id_poligono
      ${whereSql}
      GROUP BY l.id_lotificacion, l.nombre, l.ubicacion
      ORDER BY l.id_lotificacion DESC
      `,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error('ERROR RESUMEN LOTIFICACIONES:', error);
    res.status(500).json({ error: 'Error al obtener resumen de lotificaciones' });
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
