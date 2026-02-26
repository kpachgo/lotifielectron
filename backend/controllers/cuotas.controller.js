const db = require('../config/db');
const TASA_MORA_DIARIA = 0.035 / 30;


// OBTENER PRIMERA CUOTA PENDIENTE CON MORA CALCULADA
exports.obtenerCuotaPendiente = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        id_cuota,
        id_contrato,
        numero_cuota,
        fecha_vencimiento,
        monto_cuota,
        estado
      FROM cuotas
      WHERE id_contrato = ?
        AND capital_pendiente > 0
      ORDER BY numero_cuota ASC
      LIMIT 1`,
      [req.params.idContrato]
    );

    if (rows.length === 0) {
      return res.json([]);
    }

    const cuota = rows[0];

    const hoy = new Date();
    const vencimiento = new Date(cuota.fecha_vencimiento);

    let diasAtraso = 0;
    let mora = 0;

    if (hoy > vencimiento) {
      const diff = hoy - vencimiento;
      diasAtraso = Math.floor(diff / (1000 * 60 * 60 * 24));
      mora = cuota.monto_cuota * TASA_MORA_DIARIA * diasAtraso;
    }

    const total_pagar =
      Number(cuota.monto_cuota) + Number(mora);

    res.json([{
      ...cuota,
      dias_atraso: diasAtraso,
      mora: Number(mora.toFixed(2)),
      total_pagar: Number(total_pagar.toFixed(2))
    }]);

  } catch (error) {
    console.error('ERROR obtenerCuotaPendiente:', error);
    res.status(500).json([]);
  }
};
exports.obtenerCuotasPorContrato = async (req, res) => {
  try {
    const { idContrato } = req.params;

    const [cuotas] = await db.query(
      `
      SELECT
        cu.id_cuota,
        cu.numero_cuota,
        cu.fecha_vencimiento,
        cu.monto_cuota,

        -- 🔹 CAPITAL PAGADO A ESA CUOTA
        IFNULL(SUM(p.abono_capital), 0) AS capital_pagado,

        -- 🔹 INTERÉS PAGADO A ESA CUOTA
        IFNULL(SUM(p.abono_interes), 0) AS interes_pagado,

        -- 🔹 MORA PAGADA A ESA CUOTA
        IFNULL(SUM(p.abono_mora), 0) AS mora_pagada,

        -- 🔹 TOTAL REAL APLICADO A ESA CUOTA
        IFNULL(SUM(
          p.abono_capital +
          p.abono_interes +
          p.abono_mora
        ), 0) AS total_pagado,

        cu.estado

      FROM cuotas cu
      LEFT JOIN pagos p
        ON p.id_cuota = cu.id_cuota

      WHERE cu.id_contrato = ?

      GROUP BY cu.id_cuota
      ORDER BY cu.numero_cuota
      `,
      [idContrato]
    );

    res.json(cuotas);

  } catch (error) {
    console.error('Error cuotas contrato:', error);
    res.status(500).json({ message: 'Error al obtener cuotas' });
  }
};






