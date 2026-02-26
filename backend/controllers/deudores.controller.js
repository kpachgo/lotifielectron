const db = require('../config/db');
const MORA_MENSUAL_INTERES_SALDO = 0.035;
const DIAS_BASE_MORA = 30;

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

exports.obtenerDeudores = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        co.id_contrato,
        co.tipo_financiamiento,
        co.capital_pendiente,
        co.tasa_interes_anual,
        co.penalizacion_fija,
        co.dias_gracia,

        c.id_cliente,
        CONCAT(c.nombres, ' ', c.apellidos) AS cliente,

        lo.id_lotificacion,
        lo.nombre AS lotificacion,
        CONCAT('Pol. ', p.nombre_poligono, ' / Lote ', l.numero_lote) AS lote,

        cu.id_cuota,
        cu.monto_cuota,
        cu.capital_pendiente AS capital_pendiente_cuota,
        IFNULL(pm.mora_pagada, 0) AS mora_pagada_cuota,
        GREATEST(DATEDIFF(CURDATE(), cu.fecha_vencimiento), 0) AS dias_atraso

      FROM cuotas cu
      JOIN contratos co ON cu.id_contrato = co.id_contrato
      JOIN cliente c ON co.id_cliente = c.id_cliente
      JOIN lotes l ON co.id_lote = l.id_lote
      JOIN poligonos p ON l.id_poligono = p.id_poligono
      JOIN lotificaciones lo ON p.id_lotificacion = lo.id_lotificacion
      LEFT JOIN (
        SELECT id_cuota, IFNULL(SUM(abono_mora), 0) AS mora_pagada
        FROM pagos
        GROUP BY id_cuota
      ) pm ON pm.id_cuota = cu.id_cuota

      WHERE cu.estado != 'pagada'
        AND cu.capital_pendiente > 0
        AND cu.fecha_vencimiento <= CURDATE()
        AND co.estado = 'activo'

      ORDER BY co.id_contrato, cu.numero_cuota
    `);

    const map = {};

    for (const row of rows) {
      const contractId = Number(row.id_contrato);

      if (!map[contractId]) {
        map[contractId] = {
          id_contrato: row.id_contrato,
          id_lotificacion: row.id_lotificacion,
          cliente: row.cliente,
          lotificacion: row.lotificacion,
          lote: row.lote,
          tipo_financiamiento: row.tipo_financiamiento,
          capital_pendiente: Number(row.capital_pendiente || 0),
          valor_cuota: 0,
          cuotas_vencidas_calendario: 0,
          total_cuotas_vencidas_calendario: 0,
          cuotas_con_mora_gracia: 0,
          total_cuotas_con_mora_gracia: 0,
          dias_mora: 0,
          monto_mora: 0
        };
      }

      const item = map[contractId];
      const cuotaMonto = Number(row.monto_cuota || 0);
      const capitalPendienteCuota = Number(row.capital_pendiente_cuota || 0);
      const moraPagadaCuota = round2(row.mora_pagada_cuota || 0);
      const diasAtraso = Number(row.dias_atraso || 0);
      const diasGracia = Number(row.dias_gracia || 0);
      const superaGracia = diasAtraso > diasGracia;

      item.valor_cuota = Math.max(item.valor_cuota, cuotaMonto);
      item.cuotas_vencidas_calendario += 1;
      item.total_cuotas_vencidas_calendario = round2(
        item.total_cuotas_vencidas_calendario + capitalPendienteCuota
      );
      item.dias_mora = Math.max(item.dias_mora, diasAtraso);

      if (superaGracia) {
        item.cuotas_con_mora_gracia += 1;
        item.total_cuotas_con_mora_gracia = round2(
          item.total_cuotas_con_mora_gracia + capitalPendienteCuota
        );
      }

      if (item.tipo_financiamiento === 'interes_saldo') {
        if (superaGracia) {
          const diasAplicados = Math.max(0, Math.min(diasAtraso, DIAS_BASE_MORA));
          const moraCuotaGenerada = cuotaMonto
            * MORA_MENSUAL_INTERES_SALDO
            * (diasAplicados / DIAS_BASE_MORA);
          const moraCuotaPendiente = Math.max(
            0,
            round2(moraCuotaGenerada) - moraPagadaCuota
          );
          item.monto_mora = round2(item.monto_mora + moraCuotaPendiente);
        }
      } else if (item.tipo_financiamiento === 'penalizacion_fija') {
        if (superaGracia) {
          const moraCuotaPendiente = Math.max(
            0,
            round2(Number(row.penalizacion_fija || 0)) - moraPagadaCuota
          );
          item.monto_mora = round2(
            item.monto_mora + moraCuotaPendiente
          );
        }
      }
    }

    const resultado = Object.values(map)
      .filter((item) => item.dias_mora > 0)
      .map((item) => {
        const esPenalizacion = item.tipo_financiamiento === 'penalizacion_fija';
        return {
          id_contrato: item.id_contrato,
          id_lotificacion: item.id_lotificacion,
          cliente: item.cliente,
          lotificacion: item.lotificacion,
          lote: item.lote,
          tipo_financiamiento: item.tipo_financiamiento,
          cuotas_vencidas: esPenalizacion
            ? item.cuotas_con_mora_gracia
            : item.cuotas_vencidas_calendario,
          cuotas_con_mora_gracia: item.cuotas_con_mora_gracia,
          cuotas_vencidas_calendario: item.cuotas_vencidas_calendario,
          valor_cuota: round2(item.valor_cuota),
          total_cuotas_vencidas: esPenalizacion
            ? round2(item.total_cuotas_con_mora_gracia)
            : round2(item.total_cuotas_vencidas_calendario),
          total_cuotas_con_mora_gracia: round2(item.total_cuotas_con_mora_gracia),
          total_cuotas_vencidas_calendario: round2(item.total_cuotas_vencidas_calendario),
          dias_mora: item.dias_mora,
          monto_mora: round2(item.monto_mora),
          capital_pendiente: round2(item.capital_pendiente)
        };
      })
      .sort((a, b) => b.dias_mora - a.dias_mora);

    res.json(resultado);
  } catch (error) {
    console.error('Error al obtener deudores:', error);
    res.status(500).json({ message: 'Error al obtener deudores' });
  }
};
