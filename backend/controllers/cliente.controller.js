const db = require('../config/db');

// LISTAR
exports.listar = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM cliente ORDER BY id_cliente DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('ERROR LISTAR CLIENTE:', error);
    res.status(500).json(error);
  }
};

// CREAR
exports.crear = async (req, res) => {
  try {
    const { nombres, apellidos, dui, nit, telefono, direccion } = req.body;
    const nitNormalizado =
      typeof nit === 'string' ? (nit.trim() || null) : (nit || null);

    const [result] = await db.query(
      `INSERT INTO cliente 
       (nombres, apellidos, dui, nit, telefono, direccion)
       VALUES (?,?,?,?,?,?)`,
      [nombres, apellidos, dui, nitNormalizado, telefono, direccion]
    );

    res.json({ ok: true, id_cliente: result.insertId });
  } catch (error) {
    console.error('ERROR CREAR CLIENTE:', error);
    res.status(500).json(error);
  }
};

// OBTENER
exports.obtener = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM cliente WHERE id_cliente = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json(error);
  }
};

// ACTUALIZAR
exports.actualizar = async (req, res) => {
  try {
    const { nombres, apellidos, dui, nit, telefono, direccion } = req.body;
    const nitNormalizado =
      typeof nit === 'string' ? (nit.trim() || null) : (nit || null);

    await db.query(
      `UPDATE cliente SET
        nombres=?, apellidos=?, dui=?, nit=?, telefono=?, direccion=?
       WHERE id_cliente=?`,
      [nombres, apellidos, dui, nitNormalizado, telefono, direccion, req.params.id]
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json(error);
  }
};

// ELIMINAR
exports.eliminar = async (req, res) => {
  try {
    await db.query(
      'DELETE FROM cliente WHERE id_cliente = ?',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json(error);
  }
};
