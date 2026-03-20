const db = require('../config/db');
const TIPOS_FINANCIAMIENTO_VALIDOS = new Set([
  'interes_saldo',
  'penalizacion_fija',
  'sin_interes'
]);
const MODO_CALCULO_POR_PLAZO = 'por_plazo';
const MODO_CALCULO_POR_CUOTA = 'por_cuota';
const MODOS_CALCULO_VALIDOS = new Set([
  MODO_CALCULO_POR_PLAZO,
  MODO_CALCULO_POR_CUOTA
]);
const MAX_PLAZO_POR_CUOTA = 180;

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function sumarMesesISO(fechaISO, meses) {
  const [y, m, d] = String(fechaISO).split('-').map(Number);
  if (!y || !m || !d) return fechaISO;

  const base = new Date(y, m - 1, d);
  const day = base.getDate();

  const target = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimoDiaMes = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();

  target.setDate(Math.min(day, ultimoDiaMes));

  const yy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');

  return `${yy}-${mm}-${dd}`;
}

function calcularCuotaPMT(monto, plazoMeses, tasaAnual, tipoFinanciamiento) {
  const P = Number(monto || 0);
  const n = Number(plazoMeses || 0);
  if (P <= 0 || n <= 0) return 0;

  if (
    tipoFinanciamiento === 'penalizacion_fija'
    || tipoFinanciamiento === 'sin_interes'
  ) {
    return round2(P / n);
  }

  const tasa = Number(tasaAnual || 16) / 100;
  const r = tasa / 12;

  if (r <= 0) {
    return round2(P / n);
  }

  const factor = Math.pow(1 + r, n);
  const cuota = P * ((r * factor) / (factor - 1));
  return round2(cuota);
}

function generarPlanCapital({
  montoFinanciado,
  plazoMeses,
  cuotaMensual,
  tipoFinanciamiento,
  tasaInteresAnual
}) {
  const plan = [];
  let saldo = round2(montoFinanciado);
  const n = Number(plazoMeses || 0);
  const cuota = round2(cuotaMensual);
  const tasaMensual = Number(tasaInteresAnual || 16) / 100 / 12;

  for (let i = 1; i <= n; i += 1) {
    if (saldo <= 0) {
      plan.push({
        numero_cuota: i,
        capital_programado: 0
      });
      continue;
    }

    let interesMes = 0;
    if (tipoFinanciamiento === 'interes_saldo') {
      interesMes = round2(saldo * tasaMensual);
    }

    let capitalMes = round2(cuota - interesMes);
    if (
      tipoFinanciamiento === 'penalizacion_fija'
      || tipoFinanciamiento === 'sin_interes'
    ) {
      capitalMes = round2(cuota);
    }

    if (capitalMes <= 0) {
      capitalMes = saldo;
    }

    if (i === n || capitalMes > saldo) {
      capitalMes = saldo;
    }

    saldo = round2(saldo - capitalMes);

    plan.push({
      numero_cuota: i,
      monto_cuota: cuota,
      capital_programado: capitalMes
    });
  }

  return plan;
}

function generarPlanDesdeCuota({
  montoFinanciado,
  cuotaBase,
  tipoFinanciamiento,
  tasaInteresAnual
}) {
  const monto = round2(montoFinanciado);
  const cuota = round2(cuotaBase);

  if (monto <= 0) {
    return {
      ok: false,
      error: 'Monto financiado invalido'
    };
  }

  if (cuota <= 0) {
    return {
      ok: false,
      error: 'Cuota invalida para modo por cuota'
    };
  }

  if (
    tipoFinanciamiento === 'penalizacion_fija'
    || tipoFinanciamiento === 'sin_interes'
  ) {
    const plazo = Math.ceil(monto / cuota);
    if (plazo > MAX_PLAZO_POR_CUOTA) {
      return {
        ok: false,
        error: `El plan supera el maximo permitido de ${MAX_PLAZO_POR_CUOTA} meses`
      };
    }

    const plan = [];
    let saldo = round2(monto);
    for (let i = 1; i <= plazo; i += 1) {
      const montoCuota = i === plazo ? round2(saldo) : cuota;
      const capitalMes = round2(montoCuota);
      saldo = round2(saldo - capitalMes);
      plan.push({
        numero_cuota: i,
        monto_cuota: montoCuota,
        capital_programado: capitalMes
      });
    }

    return {
      ok: true,
      plazoMeses: plazo,
      cuotaContrato: cuota,
      plan
    };
  }

  const tasaMensual = Number(tasaInteresAnual || 16) / 100 / 12;
  if (tasaMensual > 0) {
    const interesPrimerMes = round2(monto * tasaMensual);
    if (cuota <= interesPrimerMes) {
      return {
        ok: false,
        error: 'Cuota demasiado baja para interes_saldo'
      };
    }
  }

  const plan = [];
  let saldo = round2(monto);

  for (let i = 1; i <= MAX_PLAZO_POR_CUOTA; i += 1) {
    const interesMes = tasaMensual > 0 ? round2(saldo * tasaMensual) : 0;
    const capitalMes = round2(cuota - interesMes);

    if (capitalMes <= 0) {
      return {
        ok: false,
        error: 'Cuota demasiado baja para amortizar capital'
      };
    }

    if (capitalMes >= saldo) {
      const montoCuotaFinal = round2(saldo + interesMes);
      plan.push({
        numero_cuota: i,
        monto_cuota: montoCuotaFinal,
        capital_programado: saldo
      });
      saldo = 0;
      break;
    }

    plan.push({
      numero_cuota: i,
      monto_cuota: cuota,
      capital_programado: capitalMes
    });
    saldo = round2(saldo - capitalMes);
  }

  if (saldo > 0) {
    return {
      ok: false,
      error: `El plan supera el maximo permitido de ${MAX_PLAZO_POR_CUOTA} meses`
    };
  }

  return {
    ok: true,
    plazoMeses: plan.length,
    cuotaContrato: cuota,
    plan
  };
}

// BUSCAR CLIENTE
exports.buscarCliente = async (req, res) => {
  try {
    const textoRaw = String(req.params.texto || '').trim();
    const texto = `%${textoRaw}%`;
    const idCliente = Number(textoRaw);
    const tieneIdExacto = Number.isInteger(idCliente) && idCliente > 0;

    const [rows] = await db.query(
      `SELECT id_cliente, nombres, apellidos, dui
       FROM cliente
       WHERE (
         nombres LIKE ?
         OR apellidos LIKE ?
         OR CONCAT(TRIM(nombres), ' ', TRIM(apellidos)) LIKE ?
         OR dui LIKE ?
         OR (? = 1 AND id_cliente = ?)
       )
       ORDER BY nombres`,
      [texto, texto, texto, texto, tieneIdExacto ? 1 : 0, idCliente || 0]
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json([]);
  }
};
// CONTRATOS POR CLIENTE (CORREGIDO)
exports.contratosPorCliente = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        c.id_contrato,
        l.numero_lote,
        p.nombre_poligono AS poligono,
        lo.nombre AS lotificacion,
        c.precio_total,
        c.plazo_meses,
        c.estado
      FROM contratos c
      JOIN lotes l ON l.id_lote = c.id_lote
      JOIN poligonos p ON p.id_poligono = l.id_poligono
      JOIN lotificaciones lo ON lo.id_lotificacion = p.id_lotificacion
      WHERE c.id_cliente = ?`,
      [req.params.id]
    );

    res.json(rows);
  } catch (error) {
    console.error('ERROR contratosPorCliente:', error);
    res.status(500).json([]);
  }
};
exports.obtenerContratoDetalle = async (req, res) => {
  try {
    const { id } = req.params;

    const [[contrato]] = await db.query(
      `
      SELECT
        co.id_contrato,
        CONCAT(c.nombres, ' ', c.apellidos) AS cliente,
        c.dui,
        lo.nombre AS lotificacion,
        p.nombre_poligono AS poligono,
        l.numero_lote,
        co.plazo_meses,
        co.estado
      FROM contratos co
      JOIN cliente c ON co.id_cliente = c.id_cliente
      JOIN lotes l ON co.id_lote = l.id_lote
      JOIN poligonos p ON l.id_poligono = p.id_poligono
      JOIN lotificaciones lo ON p.id_lotificacion = lo.id_lotificacion
      WHERE co.id_contrato = ?
      `,
      [id]
    );

    if (!contrato) {
      return res.status(404).json({ message: 'Contrato no encontrado' });
    }

    res.json(contrato);

  } catch (error) {
    console.error('Error contrato detalle:', error);
    res.status(500).json({ message: 'Error al obtener contrato' });
  }
};
exports.crearContrato = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const {
      id_cliente,
      id_lote,
      tipo_financiamiento,
      modo_calculo,
      precio_total,
      prima,
      monto_financiado,
      plazo_meses,
      cuota,
      fecha_inicio,
      tasa_interes_anual,
      penalizacion_fija,
      dias_gracia
    } = req.body;

    if (!id_cliente || !id_lote) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!tipo_financiamiento) {
      return res.status(400).json({ error: 'Tipo de financiamiento requerido' });
    }
    if (!TIPOS_FINANCIAMIENTO_VALIDOS.has(tipo_financiamiento)) {
      return res.status(400).json({ error: 'Tipo de financiamiento invalido' });
    }

    const modoCalculo = modo_calculo || MODO_CALCULO_POR_PLAZO;
    if (!MODOS_CALCULO_VALIDOS.has(modoCalculo)) {
      return res.status(400).json({ error: 'Modo de calculo invalido' });
    }

    await conn.beginTransaction();

    // Bloquea la fila del lote para evitar contratos duplicados por doble click/request concurrente
    const [[lote]] = await conn.query(
      `
      SELECT estado
      FROM lotes
      WHERE id_lote = ?
      FOR UPDATE
      `,
      [id_lote]
    );

    if (!lote) {
      await conn.rollback();
      return res.status(404).json({ error: 'Lote no encontrado' });
    }

    if (lote.estado !== 'disponible') {
      await conn.rollback();
      return res.status(409).json({ error: 'El lote ya no esta disponible' });
    }

    const montoFinanciadoNum = round2(monto_financiado);
    const plazoMesesInput = Number(plazo_meses || 0);
    const cuotaIngresadaNum = round2(cuota || 0);

    const tasaAnualContrato = tipo_financiamiento === 'interes_saldo'
      ? round2(tasa_interes_anual ?? 16)
      : null;
    const penalizacionFijaContrato = tipo_financiamiento === 'penalizacion_fija'
      ? round2(penalizacion_fija || 0)
      : null;
    const diasGraciaContrato = tipo_financiamiento === 'sin_interes'
      ? 0
      : Number(dias_gracia || 0);

    let plazoMesesFinal = plazoMesesInput;
    let cuotaContrato = 0;
    let planCuotas = [];

    if (modoCalculo === MODO_CALCULO_POR_PLAZO) {
      if (!Number.isInteger(plazoMesesFinal) || plazoMesesFinal <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Plazo de meses invalido' });
      }

      cuotaContrato = calcularCuotaPMT(
        montoFinanciadoNum,
        plazoMesesFinal,
        tasaAnualContrato || 0,
        tipo_financiamiento
      );

      if (montoFinanciadoNum > 0 && cuotaContrato <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'No se pudo calcular la cuota' });
      }

      if (montoFinanciadoNum > 0) {
        planCuotas = generarPlanCapital({
          montoFinanciado: montoFinanciadoNum,
          plazoMeses: plazoMesesFinal,
          cuotaMensual: cuotaContrato,
          tipoFinanciamiento: tipo_financiamiento,
          tasaInteresAnual: tasaAnualContrato || 0
        });
      }
    } else {
      if (montoFinanciadoNum > 0 && cuotaIngresadaNum <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Cuota invalida para modo por cuota' });
      }

      if (montoFinanciadoNum > 0) {
        const resultadoPlan = generarPlanDesdeCuota({
          montoFinanciado: montoFinanciadoNum,
          cuotaBase: cuotaIngresadaNum,
          tipoFinanciamiento: tipo_financiamiento,
          tasaInteresAnual: tasaAnualContrato || 0
        });

        if (!resultadoPlan.ok) {
          await conn.rollback();
          return res.status(400).json({ error: resultadoPlan.error });
        }

        plazoMesesFinal = Number(resultadoPlan.plazoMeses || 0);
        cuotaContrato = round2(resultadoPlan.cuotaContrato || 0);
        planCuotas = Array.isArray(resultadoPlan.plan) ? resultadoPlan.plan : [];
      } else {
        if (!Number.isInteger(plazoMesesFinal) || plazoMesesFinal <= 0) {
          plazoMesesFinal = 1;
        }
        cuotaContrato = cuotaIngresadaNum > 0 ? cuotaIngresadaNum : 0;
      }
    }

    if (!Number.isInteger(plazoMesesFinal) || plazoMesesFinal <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Plazo de meses invalido' });
    }

    const fechaVencimiento = sumarMesesISO(fecha_inicio, plazoMesesFinal);

    // ===============================
    // DEFINIR ESTADOS SEGÚN TIPO DE PAGO
    // ===============================
    let estadoContrato = 'activo';
    let estadoLote = 'promesa_venta';

    if (montoFinanciadoNum <= 0) {
      estadoContrato = 'cancelado';
      estadoLote = 'vendido';
    }

    // ===============================
    // INSERTAR CONTRATO
    // ===============================
    const [result] = await conn.query(`
      INSERT INTO contratos (
        id_cliente,
        id_lote,
        tipo_financiamiento,
        precio_total,
        prima,
        monto_financiado,
        plazo_meses,
        cuota,
        fecha_inicio,
        fecha_vencimiento,
        estado,
        capital_pendiente,
        tasa_interes_anual,
        penalizacion_fija,
        dias_gracia
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      id_cliente,
      id_lote,
      tipo_financiamiento,
      precio_total,
      prima,
      montoFinanciadoNum,
      plazoMesesFinal,
      cuotaContrato,
      fecha_inicio,
      fechaVencimiento,
      estadoContrato,
      montoFinanciadoNum,
      tasaAnualContrato,
      penalizacionFijaContrato,
      diasGraciaContrato
    ]);

    const id_contrato = result.insertId;

    // ===============================
    // ACTUALIZAR ESTADO DEL LOTE
    // ===============================
    await conn.query(`
      UPDATE lotes
      SET estado = ?
      WHERE id_lote = ?
    `, [estadoLote, id_lote]);

    // ===============================
    // GENERAR CUOTAS SOLO SI HAY FINANCIAMIENTO
    // ===============================
    if (montoFinanciadoNum > 0) {
      if (!Array.isArray(planCuotas) || planCuotas.length !== plazoMesesFinal) {
        await conn.rollback();
        return res.status(400).json({ error: 'No se pudo generar el plan de cuotas' });
      }

      for (let i = 1; i <= plazoMesesFinal; i += 1) {
        const fechaFormateada = sumarMesesISO(fecha_inicio, i);
        const tramo = planCuotas[i - 1];
        const montoCuotaTramo = round2(tramo?.monto_cuota || cuotaContrato);
        const capitalProgramado = round2(tramo?.capital_programado || 0);
        await conn.query(`
          INSERT INTO cuotas (
            id_contrato,
            numero_cuota,
            fecha_vencimiento,
            monto_cuota,
            capital_pendiente
          )
          VALUES (?,?,?,?,?)
        `, [
          id_contrato,
          i,
          fechaFormateada,
          montoCuotaTramo,
          capitalProgramado
        ]);
      }
    }

    await conn.commit();

    res.json({
      ok: true,
      modo_calculo: modoCalculo,
      plazo_meses: plazoMesesFinal,
      cuota_calculada: cuotaContrato
    });

  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Error al crear contrato' });
  } finally {
    conn.release();
  }
};




