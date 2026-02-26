const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: '192.168.1.35',
  user: 'root',
  password: 'D@nielito100pre',
  database: 'lotifi',
  waitForConnections: true,
  connectionLimit: 10
});

// 🔎 Verificación de conexión
(async () => {
  try {
    const conn = await db.getConnection();
    console.log('✅ MySQL conectado a lotifi');
    conn.release();
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error);
  }
})();

module.exports = db;
