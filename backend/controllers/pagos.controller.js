const db = require('../config/db');

const MORA_MENSUAL_INTERES_SALDO = 0.035;
const DIAS_BASE_MORA = 30;

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Number(toNumber(value).toFixed(2));
}

function normalizarFechaYMD(valor) {
  if (!valor) return null;

  if (typeof valor === 'string') {
    const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 10);
}

function fechaHoyYMD() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYMD(fechaYMD) {
  const match = String(fechaYMD || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function esFechaYMDValida(fechaYMD) {
  const match = String(fechaYMD || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const fecha = new Date(y, m - 1, d);

  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.getFullYear() === y &&
    fecha.getMonth() === (m - 1) &&
    fecha.getDate() === d
  );
}

function calcularDiasAtraso(fechaPagoYMD, fechaVencimientoYMD) {
  const pago = parseYMD(normalizarFechaYMD(fechaPagoYMD));
  const venc = parseYMD(normalizarFechaYMD(fechaVencimientoYMD));

  if (!pago || !venc) return 0;
  if (pago <= venc) return 0;

  return Math.floor((pago - venc) / (1000 * 60 * 60 * 24));
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

function tasaMensualContrato(contrato) {
  if (contrato.tipo_financiamiento !== 'interes_saldo') return 0;
  const tasaAnual = toNumber(contrato.tasa_interes_anual, 16) / 100;
  return tasaAnual / 12;
}

function calcularInteresPeriodo(contrato, saldoContrato) {
  if (contrato.tipo_financiamiento !== 'interes_saldo') return 0;
  return round2(toNumber(saldoContrato) * tasaMensualContrato(contrato));
}

function calcularMoraTotal({ contrato, cuota, diasAtraso, aplicarMora }) {
  if (!aplicarMora) return 0;

  const diasGracia = toNumber(contrato.dias_gracia, 0);
  if (diasAtraso <= diasGracia) return 0;

  if (contrato.tipo_financiamiento === 'penalizacion_fija') {
    return round2(contrato.penalizacion_fija);
  }

  if (contrato.tipo_financiamiento === 'interes_saldo') {
    const cuotaMonto = toNumber(cuota.monto_cuota, 0);
    const diasAplicados = Math.max(0, Math.min(diasAtraso, DIAS_BASE_MORA));
    return round2(
      cuotaMonto * MORA_MENSUAL_INTERES_SALDO * (diasAplicados / DIAS_BASE_MORA)
    );
  }

  return 0;
}

function estadoCuotaSegunFecha(nuevoCapital, fechaRefYMD, fechaVencimientoYMD) {
  if (toNumber(nuevoCapital) <= 0) return 'pagada';
  return calcularDiasAtraso(fechaRefYMD, fechaVencimientoYMD) > 0
    ? 'atrasada'
    : 'pendiente';
}

async function obtenerPagosPreviosCuota(conn, idCuota) {
  const [[rows]] = await conn.query(
    `
    SELECT
      IFNULL(SUM(abono_interes),0) AS interes_pagado,
      IFNULL(SUM(abono_mora),0) AS mora_pagada
    FROM pagos
    WHERE id_cuota = ?
    `,
    [idCuota]
  );

  return {
    interes_pagado: round2(rows?.interes_pagado || 0),
    mora_pagada: round2(rows?.mora_pagada || 0)
  };
}

async function calcularDetalleCuota(conn, {
  contrato,
  cuota,
  fechaAbonoYMD,
  aplicarMora = true,
  saldoContratoBase = null
}) {
  const pagosPrevios = await obtenerPagosPreviosCuota(conn, cuota.id_cuota);
  const diasAtraso = calcularDiasAtraso(fechaAbonoYMD, cuota.fecha_vencimiento);

  const moraTotal = calcularMoraTotal({
    contrato,
    cuota,
    diasAtraso,
    aplicarMora
  });

  const moraPendiente = round2(Math.max(0, moraTotal - pagosPrevios.mora_pagada));

  const saldoBase = saldoContratoBase === null
    ? toNumber(contrato.capital_pendiente)
    : toNumber(saldoContratoBase);
  const interesTotal = calcularInteresPeriodo(contrato, saldoBase);
  const interesPendiente = round2(
    Math.max(0, interesTotal - pagosPrevios.interes_pagado)
  );

  const capitalPendiente = round2(cuota.capital_pendiente);
  const cuotaSugerida = round2(capitalPendiente + interesPendiente);
  const cargos = round2(moraPendiente);
  const total = round2(cuotaSugerida + cargos);

  return {
    dias_atraso: diasAtraso,
    interes_total: interesTotal,
    interes_pendiente: interesPendiente,
    mora_total: moraTotal,
    mora_pendiente: moraPendiente,
    cuota_sugerida: cuotaSugerida,
    cargos,
    capital_pendiente: capitalPendiente,
    total
  };
}

function cuotaVencidaALaFecha(cuota, fechaYMD) {
  const venc = normalizarFechaYMD(cuota.fecha_vencimiento);
  return Boolean(venc && fechaYMD && venc <= fechaYMD);
}

function calcularTotalCuotasExigibles(cuotasExigibles) {
  return round2(
    cuotasExigibles.reduce(
      (acc, c) => acc + toNumber(c.monto_cuota, 0),
      0
    )
  );
}

function calcularMoraGlobalPagoUnico(contrato, cuotasExigibles, fechaAbonoYMD) {
  if (!cuotasExigibles.length) return 0;

  const diasGracia = toNumber(contrato.dias_gracia, 0);
  if (contrato.tipo_financiamiento === 'interes_saldo') {
    const moraTotal = cuotasExigibles.reduce((acc, cuota) => {
      const diasAtraso = calcularDiasAtraso(
        fechaAbonoYMD,
        cuota.fecha_vencimiento
      );
      if (diasAtraso <= diasGracia) return acc;

      const diasAplicados = Math.max(0, Math.min(diasAtraso, DIAS_BASE_MORA));
      const moraCuota = toNumber(cuota.monto_cuota, 0)
        * MORA_MENSUAL_INTERES_SALDO
        * (diasAplicados / DIAS_BASE_MORA);

      return acc + moraCuota;
    }, 0);

    return round2(moraTotal);
  }

  if (contrato.tipo_financiamiento === 'penalizacion_fija') {
    const cuotasConMora = cuotasExigibles.filter((c) => {
      const dias = calcularDiasAtraso(fechaAbonoYMD, c.fecha_vencimiento);
      return dias > diasGracia;
    }).length;
    return round2(toNumber(contrato.penalizacion_fija, 0) * cuotasConMora);
  }

  return 0;
}

function calcularTotalSugeridoPagoUnico(contrato, cuotasExigibles, fechaAbonoYMD) {
  const totalCuotas = calcularTotalCuotasExigibles(cuotasExigibles);
  const moraGlobal = calcularMoraGlobalPagoUnico(contrato, cuotasExigibles, fechaAbonoYMD);
  return {
    total_cuotas_exigibles: totalCuotas,
    mora_global: moraGlobal,
    total_sugerido: round2(totalCuotas + moraGlobal)
  };
}

async function construirPlanPagoExigible(conn, {
  contrato,
  cuotasExigibles,
  fechaAbonoYMD
}) {
  if (!Array.isArray(cuotasExigibles) || cuotasExigibles.length === 0) {
    return {
      plan_aplicacion: [],
      total_capital: 0,
      total_interes: 0,
      mora_global: 0,
      total_requerido: 0
    };
  }

  const planAplicacion = [];
  let saldoBaseIteracion = toNumber(contrato.capital_pendiente);

  for (let i = 0; i < cuotasExigibles.length; i += 1) {
    const cuotaPlan = cuotasExigibles[i];
    const detallePlan = await calcularDetalleCuota(conn, {
      contrato: {
        ...contrato,
        capital_pendiente: saldoBaseIteracion
      },
      cuota: cuotaPlan,
      fechaAbonoYMD,
      aplicarMora: true,
      saldoContratoBase: saldoBaseIteracion
    });

    const abonoCapital = round2(toNumber(cuotaPlan.capital_pendiente));
    const abonoInteres = round2(detallePlan.interes_pendiente);
    const abonoMora = round2(detallePlan.mora_pendiente);
    const montoTotal = round2(abonoCapital + abonoInteres + abonoMora);

    planAplicacion.push({
      cuota: cuotaPlan,
      abono_capital: abonoCapital,
      abono_interes: abonoInteres,
      abono_mora: abonoMora,
      monto_total: montoTotal
    });

    saldoBaseIteracion = round2(saldoBaseIteracion - abonoCapital);
  }

  const totalCapital = round2(
    planAplicacion.reduce((acc, p) => acc + p.abono_capital, 0)
  );
  const totalInteres = round2(
    planAplicacion.reduce((acc, p) => acc + p.abono_interes, 0)
  );
  const moraGlobal = round2(
    planAplicacion.reduce((acc, p) => acc + p.abono_mora, 0)
  );
  const totalRequerido = round2(
    planAplicacion.reduce((acc, p) => acc + p.monto_total, 0)
  );

  return {
    plan_aplicacion: planAplicacion,
    total_capital: totalCapital,
    total_interes: totalInteres,
    mora_global: round2(moraGlobal),
    total_requerido: totalRequerido
  };
}

function obtenerLimitesFechaContrato(contrato) {
  const fechaInicio = normalizarFechaYMD(contrato?.fecha_inicio);
  const fechaVencimiento = normalizarFechaYMD(
    contrato?.fecha_vencimiento
  ) || (
    fechaInicio && toNumber(contrato?.plazo_meses, 0) > 0
      ? sumarMesesISO(fechaInicio, Number(contrato.plazo_meses))
      : null
  );

  return { fechaInicio, fechaVencimiento };
}

function validarFechaEnContrato({
  fechaYMD,
  contrato,
  ultimaFechaAbono = null,
  etiqueta = 'La fecha de abono'
}) {
  if (!fechaYMD || !esFechaYMDValida(fechaYMD)) {
    return `${etiqueta} es invalida. Use formato YYYY-MM-DD.`;
  }

  const { fechaInicio, fechaVencimiento } = obtenerLimitesFechaContrato(contrato);

  if (fechaInicio && fechaYMD < fechaInicio) {
    return `${etiqueta} no puede ser menor a la fecha de inicio del contrato (${fechaInicio}).`;
  }

  if (fechaVencimiento && fechaYMD > fechaVencimiento) {
    return `${etiqueta} no puede ser mayor a la fecha de vencimiento del contrato (${fechaVencimiento}).`;
  }

  if (ultimaFechaAbono && fechaYMD < ultimaFechaAbono) {
    return `${etiqueta} no puede ser menor al ultimo pago registrado (${ultimaFechaAbono}).`;
  }

  return null;
}

async function actualizarContratoYLote(conn, contrato, nuevoCapitalContrato) {
  await conn.query(
    `
    UPDATE contratos
    SET capital_pendiente = ?
    WHERE id_contrato = ?
    `,
    [nuevoCapitalContrato, contrato.id_contrato]
  );

  if (nuevoCapitalContrato === 0) {
    await conn.query(
      `UPDATE contratos SET estado = 'cancelado' WHERE id_contrato = ?`,
      [contrato.id_contrato]
    );

    await conn.query(
      `UPDATE lotes SET estado = 'vendido' WHERE id_lote = ?`,
      [contrato.id_lote]
    );
  }
}

exports.estadoCuentaContrato = async (req, res) => {
  const { idContrato } = req.params;
  const fechaAbonoRaw = req.query?.fecha_abono;
  const fechaAbonoQuery = fechaAbonoRaw
    ? normalizarFechaYMD(fechaAbonoRaw)
    : null;
  const conn = await db.getConnection();

  try {
    const [[contrato]] = await conn.query(
      `
      SELECT *
      FROM contratos
      WHERE id_contrato = ?
      `,
      [idContrato]
    );

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (typeof fechaAbonoRaw !== 'undefined') {
      const errorFecha = validarFechaEnContrato({
        fechaYMD: fechaAbonoQuery,
        contrato,
        etiqueta: 'La fecha de abono'
      });

      if (errorFecha) {
        return res.status(400).json({ error: errorFecha });
      }
    }

    const limitesFecha = obtenerLimitesFechaContrato(contrato);

    if (toNumber(contrato.capital_pendiente) <= 0) {
      return res.json({
        contrato,
        cuota: null,
        limites_fecha_abono: {
          min: limitesFecha.fechaInicio,
          max: limitesFecha.fechaVencimiento
        }
      });
    }

    const [cuotasPendientes] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND capital_pendiente > 0
        AND estado != 'pagada'
      ORDER BY numero_cuota
      `,
      [idContrato]
    );

    const cuota = cuotasPendientes[0];
    if (!cuota) {
      return res.json({
        contrato,
        cuota: null,
        limites_fecha_abono: {
          min: limitesFecha.fechaInicio,
          max: limitesFecha.fechaVencimiento
        }
      });
    }

    const fechaRef = fechaAbonoQuery || fechaHoyYMD();
    const cuotasExigibles = cuotasPendientes.filter((c) =>
      cuotaVencidaALaFecha(c, fechaRef)
    );
    const detalle = await calcularDetalleCuota(conn, {
      contrato,
      cuota,
      fechaAbonoYMD: fechaRef,
      aplicarMora: true
    });

    let subtotalExigible = round2(detalle.capital_pendiente + detalle.interes_pendiente);
    let moraGlobalExigible = round2(detalle.mora_pendiente);
    let totalSugerido = round2(detalle.total);
    let interesGlobalExigible = round2(detalle.interes_pendiente);
    let capitalGlobalExigible = round2(detalle.capital_pendiente);

    if (cuotasExigibles.length > 1) {
      const planExigible = await construirPlanPagoExigible(conn, {
        contrato,
        cuotasExigibles,
        fechaAbonoYMD: fechaRef
      });

      capitalGlobalExigible = round2(planExigible.total_capital);
      interesGlobalExigible = round2(planExigible.total_interes);
      subtotalExigible = round2(capitalGlobalExigible + interesGlobalExigible);
      moraGlobalExigible = round2(planExigible.mora_global);
      totalSugerido = round2(planExigible.total_requerido);
    }

    res.json({
      contrato,
      cuota,
      interes: detalle.interes_pendiente,
      mora: detalle.mora_pendiente,
      cargos: detalle.cargos,
      penalizacion: detalle.cargos,
      cuota_sugerida: detalle.cuota_sugerida,
      capital_cuota: detalle.capital_pendiente,
      dias_atraso: detalle.dias_atraso,
      estado_cuota: estadoCuotaSegunFecha(
        cuota.capital_pendiente,
        fechaRef,
        cuota.fecha_vencimiento
      ),
      total: detalle.total,
      fecha_abono_referencia: fechaRef,
      requiere_pago_masivo: cuotasExigibles.length > 1,
      cuota_desde_requerida: cuotasExigibles.length > 1
        ? Number(cuotasExigibles[0].numero_cuota)
        : null,
      cuota_hasta_requerida: cuotasExigibles.length > 1
        ? Number(cuotasExigibles[cuotasExigibles.length - 1].numero_cuota)
        : null,
      cuotas_exigibles: cuotasExigibles.length,
      capital_global_exigible: capitalGlobalExigible,
      interes_global_exigible: interesGlobalExigible,
      total_cuotas_exigibles: subtotalExigible,
      mora_global_exigible: moraGlobalExigible,
      total_sugerido_pago_unico: totalSugerido,
      limites_fecha_abono: {
        min: limitesFecha.fechaInicio,
        max: limitesFecha.fechaVencimiento
      }
    });
  } catch (error) {
    console.error('Error calculando estado de cuenta:', error);
    res.status(500).json({ error: 'Error calculando estado de cuenta' });
  } finally {
    conn.release();
  }
};

exports.registrarPago = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const {
      id_cuota,
      monto_pagado,
      fecha_abono,
      fecha_recibo,
      forma_pago,
      banco,
      numero_recibo
    } = req.body;

    const fechaAbonoYMD = normalizarFechaYMD(fecha_abono);
    if (!id_cuota || !monto_pagado || !fecha_abono || !forma_pago) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!fechaAbonoYMD || !esFechaYMDValida(fechaAbonoYMD)) {
      return res.status(400).json({
        error: 'La fecha de abono es invalida. Use formato YYYY-MM-DD.'
      });
    }

    if (forma_pago !== 'Efectivo' && !banco) {
      return res.status(400).json({
        error: 'Banco obligatorio para esta forma de pago'
      });
    }

    const montoPagadoNum = round2(monto_pagado);
    if (montoPagadoNum <= 0) {
      return res.status(400).json({ error: 'Monto invalido' });
    }

    await conn.beginTransaction();

    const [[cuota]] = await conn.query(
      `SELECT * FROM cuotas WHERE id_cuota = ? FOR UPDATE`,
      [id_cuota]
    );
    if (!cuota) {
      await conn.rollback();
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    if (toNumber(cuota.capital_pendiente) <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'La cuota ya no tiene saldo pendiente' });
    }

    const [[contrato]] = await conn.query(
      `SELECT * FROM contratos WHERE id_contrato = ? FOR UPDATE`,
      [cuota.id_contrato]
    );
    if (!contrato) {
      await conn.rollback();
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (toNumber(contrato.capital_pendiente) <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Este contrato ya no tiene saldo pendiente' });
    }

    const [[ultimoPagoContrato]] = await conn.query(
      `
      SELECT DATE_FORMAT(MAX(p.fecha_abono), '%Y-%m-%d') AS ultima_fecha_abono
      FROM pagos p
      JOIN cuotas cu ON cu.id_cuota = p.id_cuota
      WHERE cu.id_contrato = ?
      `,
      [contrato.id_contrato]
    );

    const errorFechaAbono = validarFechaEnContrato({
      fechaYMD: fechaAbonoYMD,
      contrato,
      ultimaFechaAbono: ultimoPagoContrato?.ultima_fecha_abono || null,
      etiqueta: 'La fecha de abono'
    });

    if (errorFechaAbono) {
      await conn.rollback();
      return res.status(400).json({ error: errorFechaAbono });
    }

    const [cuotasPendientesContrato] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND capital_pendiente > 0
        AND estado != 'pagada'
      ORDER BY numero_cuota
      FOR UPDATE
      `,
      [contrato.id_contrato]
    );

    const primeraPendiente = cuotasPendientesContrato[0];
    if (!primeraPendiente) {
      await conn.rollback();
      return res.status(400).json({ error: 'No hay cuotas pendientes' });
    }

    if (Number(primeraPendiente.id_cuota) !== Number(cuota.id_cuota)) {
      await conn.rollback();
      return res.status(400).json({
        error: `Debe pagar primero la cuota ${primeraPendiente.numero_cuota}`
      });
    }

    const cuotasExigibles = cuotasPendientesContrato.filter((c) =>
      cuotaVencidaALaFecha(c, fechaAbonoYMD)
    );

    const fechaReciboYMD = normalizarFechaYMD(fecha_recibo) || fechaAbonoYMD;
    let capitalContratoActual = round2(toNumber(contrato.capital_pendiente));
    let capitalAplicadoTotal = 0;
    let restante = montoPagadoNum;
    let pagoPrincipalId = null;
    let numeroCuotaLimiteExtras = Number(cuota.numero_cuota);
    const pagosAplicados = [];
    const pagosExtra = [];
    let detalleRespuesta = {
      abono_capital: 0,
      abono_interes: 0,
      abono_mora: 0
    };

    if (cuotasExigibles.length > 1) {
      const planExigible = await construirPlanPagoExigible(conn, {
        contrato,
        cuotasExigibles,
        fechaAbonoYMD
      });

      const planAplicacion = planExigible.plan_aplicacion;
      const totalRequerido = round2(planExigible.total_requerido);
      const pagoParcialExigible = montoPagadoNum < totalRequerido;
      const cuotaDesde = Number(cuotasExigibles[0].numero_cuota);
      const cuotaHasta = Number(cuotasExigibles[cuotasExigibles.length - 1].numero_cuota);
      restante = montoPagadoNum;
      let ultimaCuotaProcesada = Number(cuota.numero_cuota);

      const aplicacionPorCuota = planAplicacion.map((p) => ({
        ...p,
        aplicado_mora: 0,
        aplicado_interes: 0,
        aplicado_capital: 0
      }));

      const aplicarBucket = (campoPendiente, campoAplicado) => {
        for (let i = 0; i < aplicacionPorCuota.length; i += 1) {
          if (restante <= 0) break;
          const cuotaAplicacion = aplicacionPorCuota[i];
          const pendiente = round2(
            toNumber(cuotaAplicacion[campoPendiente]) - toNumber(cuotaAplicacion[campoAplicado])
          );
          if (pendiente <= 0) continue;

          const abono = round2(Math.min(restante, pendiente));
          cuotaAplicacion[campoAplicado] = round2(
            toNumber(cuotaAplicacion[campoAplicado]) + abono
          );
          restante = round2(restante - abono);
        }
      };

      // Regla estricta para rango exigible:
      // 1) Toda la mora del rango, 2) todo el interes del rango, 3) capital.
      aplicarBucket('abono_mora', 'aplicado_mora');
      aplicarBucket('abono_interes', 'aplicado_interes');
      aplicarBucket('abono_capital', 'aplicado_capital');

      for (let i = 0; i < aplicacionPorCuota.length; i += 1) {
        const p = aplicacionPorCuota[i];
        const abonoMora = round2(p.aplicado_mora);
        const abonoInteres = round2(p.aplicado_interes);
        const abonoCapital = round2(p.aplicado_capital);
        const totalAplicadoCuota = round2(abonoMora + abonoInteres + abonoCapital);
        if (totalAplicadoCuota <= 0) continue;

        const nuevoCapitalCuota = round2(
          toNumber(p.cuota.capital_pendiente) - abonoCapital
        );

        await conn.query(
          `
          UPDATE cuotas
          SET capital_pendiente = ?,
              estado = ?
          WHERE id_cuota = ?
          `,
          [
            nuevoCapitalCuota,
            estadoCuotaSegunFecha(
              nuevoCapitalCuota,
              fechaAbonoYMD,
              p.cuota.fecha_vencimiento
            ),
            p.cuota.id_cuota
          ]
        );

        const numeroReciboLinea = numero_recibo
          ? `${numero_recibo}-C${p.cuota.numero_cuota}`
          : null;

        const [insertResult] = await conn.query(
          `
          INSERT INTO pagos
          (id_cuota, fecha_abono, fecha_recibo,
           forma_pago, banco,
           abono_capital, abono_interes, abono_mora,
           monto_total, numero_recibo)
          VALUES (?,?,?,?,?,?,?,?,?,?)
          `,
          [
            p.cuota.id_cuota,
            fechaAbonoYMD,
            fechaReciboYMD,
            forma_pago,
            banco || null,
            abonoCapital,
            abonoInteres,
            abonoMora,
            totalAplicadoCuota,
            numeroReciboLinea
          ]
        );

        if (!pagoPrincipalId) {
          pagoPrincipalId = insertResult.insertId;
        }

        pagosAplicados.push({
          id_pago: insertResult.insertId,
          id_cuota: p.cuota.id_cuota,
          numero_cuota: p.cuota.numero_cuota,
          abono_capital: abonoCapital,
          abono_interes: abonoInteres,
          abono_mora: abonoMora,
          monto_total: totalAplicadoCuota
        });

        capitalAplicadoTotal = round2(capitalAplicadoTotal + abonoCapital);
        capitalContratoActual = round2(capitalContratoActual - abonoCapital);
        ultimaCuotaProcesada = Number(p.cuota.numero_cuota);
      }

      if (!pagosAplicados.length) {
        await conn.rollback();
        return res.status(400).json({
          error: 'No se pudo aplicar el pago a las cuotas exigibles'
        });
      }

      numeroCuotaLimiteExtras = pagoParcialExigible
        ? ultimaCuotaProcesada
        : Number(cuotasExigibles[cuotasExigibles.length - 1].numero_cuota);

      detalleRespuesta = {
        abono_capital: round2(
          pagosAplicados.reduce((acc, p) => acc + toNumber(p.abono_capital), 0)
        ),
        abono_interes: round2(
          pagosAplicados.reduce((acc, p) => acc + toNumber(p.abono_interes), 0)
        ),
        abono_mora: round2(
          pagosAplicados.reduce((acc, p) => acc + toNumber(p.abono_mora), 0)
        ),
        total_requerido_rango: totalRequerido,
        pago_parcial_rango: pagoParcialExigible,
        cuota_desde_requerida: cuotaDesde,
        cuota_hasta_requerida: cuotaHasta,
        faltante_rango: pagoParcialExigible
          ? round2(totalRequerido - montoPagadoNum)
          : 0
      };
    } else {
      const detalle = await calcularDetalleCuota(conn, {
        contrato,
        cuota,
        fechaAbonoYMD,
        aplicarMora: true,
        saldoContratoBase: toNumber(contrato.capital_pendiente)
      });

      const abono_mora = round2(Math.min(restante, detalle.mora_pendiente));
      restante = round2(restante - abono_mora);

      const abono_interes = round2(Math.min(restante, detalle.interes_pendiente));
      restante = round2(restante - abono_interes);

      const abono_capital = round2(Math.min(restante, toNumber(cuota.capital_pendiente)));
      restante = round2(restante - abono_capital);

      const totalAplicadoPrincipal = round2(abono_mora + abono_interes + abono_capital);
      if (totalAplicadoPrincipal <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'No se pudo aplicar el pago a la cuota seleccionada' });
      }

      const nuevoCapitalCuota = round2(toNumber(cuota.capital_pendiente) - abono_capital);
      await conn.query(
        `
        UPDATE cuotas
        SET capital_pendiente = ?,
            estado = ?
        WHERE id_cuota = ?
        `,
        [
          nuevoCapitalCuota,
          estadoCuotaSegunFecha(nuevoCapitalCuota, fechaAbonoYMD, cuota.fecha_vencimiento),
          cuota.id_cuota
        ]
      );

      const [pagoPrincipalResult] = await conn.query(
        `
        INSERT INTO pagos
        (id_cuota, fecha_abono, fecha_recibo,
         forma_pago, banco,
         abono_capital, abono_interes, abono_mora,
         monto_total, numero_recibo)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        `,
        [
          cuota.id_cuota,
          fechaAbonoYMD,
          fechaReciboYMD,
          forma_pago,
          banco || null,
          abono_capital,
          abono_interes,
          abono_mora,
          totalAplicadoPrincipal,
          numero_recibo || null
        ]
      );

      pagoPrincipalId = pagoPrincipalResult.insertId;
      capitalAplicadoTotal = abono_capital;
      capitalContratoActual = round2(
        toNumber(contrato.capital_pendiente) - capitalAplicadoTotal
      );
      numeroCuotaLimiteExtras = Number(cuota.numero_cuota);
      detalleRespuesta = {
        abono_capital,
        abono_interes,
        abono_mora
      };

      pagosAplicados.push({
        id_pago: pagoPrincipalResult.insertId,
        id_cuota: cuota.id_cuota,
        numero_cuota: cuota.numero_cuota,
        abono_capital,
        abono_interes,
        abono_mora,
        monto_total: totalAplicadoPrincipal
      });
    }

    if (restante > 0) {
      const [cuotasFuturas] = await conn.query(
        `
        SELECT *
        FROM cuotas
        WHERE id_contrato = ?
          AND capital_pendiente > 0
          AND estado != 'pagada'
          AND numero_cuota > ?
        ORDER BY numero_cuota
        FOR UPDATE
        `,
        [contrato.id_contrato, numeroCuotaLimiteExtras]
      );

      for (const cuotaFutura of cuotasFuturas) {
        if (restante <= 0) break;

        const abonoCapitalExtra = round2(
          Math.min(restante, toNumber(cuotaFutura.capital_pendiente))
        );
        if (abonoCapitalExtra <= 0) continue;

        const nuevoCapitalFuturo = round2(
          toNumber(cuotaFutura.capital_pendiente) - abonoCapitalExtra
        );

        await conn.query(
          `
          UPDATE cuotas
          SET capital_pendiente = ?,
              estado = ?
          WHERE id_cuota = ?
          `,
          [
            nuevoCapitalFuturo,
            estadoCuotaSegunFecha(
              nuevoCapitalFuturo,
              fechaAbonoYMD,
              cuotaFutura.fecha_vencimiento
            ),
            cuotaFutura.id_cuota
          ]
        );

        const numeroReciboExtra = numero_recibo
          ? `${numero_recibo}-EX-C${cuotaFutura.numero_cuota}`
          : null;

        const [pagoExtraResult] = await conn.query(
          `
          INSERT INTO pagos
          (id_cuota, fecha_abono, fecha_recibo,
           forma_pago, banco,
           abono_capital, abono_interes, abono_mora,
           monto_total, numero_recibo)
          VALUES (?,?,?,?,?,?,?,?,?,?)
          `,
          [
            cuotaFutura.id_cuota,
            fechaAbonoYMD,
            fechaReciboYMD,
            forma_pago,
            banco || null,
            abonoCapitalExtra,
            0,
            0,
            abonoCapitalExtra,
            numeroReciboExtra
          ]
        );

        pagosExtra.push({
          id_pago: pagoExtraResult.insertId,
          id_cuota: cuotaFutura.id_cuota,
          numero_cuota: cuotaFutura.numero_cuota,
          abono_capital: abonoCapitalExtra
        });

        restante = round2(restante - abonoCapitalExtra);
        capitalAplicadoTotal = round2(capitalAplicadoTotal + abonoCapitalExtra);
        capitalContratoActual = round2(capitalContratoActual - abonoCapitalExtra);
      }
    }

    if (restante > 0) {
      const totalNecesario = round2(montoPagadoNum - restante);
      await conn.rollback();
      return res.status(400).json({
        error: 'Monto excede el saldo. Debe pagar el monto exacto para finalizar.',
        total_necesario: totalNecesario,
        excedente: restante
      });
    }

    if (capitalContratoActual < 0) {
      capitalContratoActual = 0;
    }

    await actualizarContratoYLote(conn, contrato, capitalContratoActual);
    await conn.commit();

    res.json({
      ok: true,
      id_pago: pagoPrincipalId,
      detalle: detalleRespuesta,
      pagos_aplicados: pagosAplicados,
      extras: pagosExtra,
      capital_pendiente_contrato: capitalContratoActual
    });
  } catch (error) {
    await conn.rollback();
    console.error('ERROR REGISTRAR PAGO:', error);
    res.status(500).json({ error: 'Error al registrar pago' });
  } finally {
    conn.release();
  }
};

exports.registrarPagoMasivo = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const {
      id_contrato,
      cuota_desde,
      cuota_hasta,
      fecha_abono,
      fecha_recibo,
      forma_pago,
      banco,
      numero_recibo
    } = req.body;

    const fechaAbonoBaseYMD = normalizarFechaYMD(fecha_abono);
    if (!id_contrato || !cuota_hasta || !fecha_abono || !forma_pago) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    if (!fechaAbonoBaseYMD || !esFechaYMDValida(fechaAbonoBaseYMD)) {
      return res.status(400).json({
        error: 'La fecha inicial de abono es invalida. Use formato YYYY-MM-DD.'
      });
    }

    if (forma_pago !== 'Efectivo' && !banco) {
      return res.status(400).json({
        error: 'Banco obligatorio para esta forma de pago'
      });
    }

    const idContrato = Number(id_contrato);
    const cuotaDesdeSolicitada = Number(cuota_desde || 0);
    const cuotaHasta = Number(cuota_hasta);
    if (!Number.isInteger(cuotaHasta) || cuotaHasta <= 0) {
      return res.status(400).json({ error: 'Cuota final invalida' });
    }

    await conn.beginTransaction();

    const [[contrato]] = await conn.query(
      `SELECT * FROM contratos WHERE id_contrato = ? FOR UPDATE`,
      [idContrato]
    );
    if (!contrato) {
      await conn.rollback();
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (toNumber(contrato.capital_pendiente) <= 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Este contrato ya no tiene saldo pendiente' });
    }

    const [[ultimoPagoContrato]] = await conn.query(
      `
      SELECT DATE_FORMAT(MAX(p.fecha_abono), '%Y-%m-%d') AS ultima_fecha_abono
      FROM pagos p
      JOIN cuotas cu ON cu.id_cuota = p.id_cuota
      WHERE cu.id_contrato = ?
      `,
      [idContrato]
    );

    const errorFechaBase = validarFechaEnContrato({
      fechaYMD: fechaAbonoBaseYMD,
      contrato,
      ultimaFechaAbono: ultimoPagoContrato?.ultima_fecha_abono || null,
      etiqueta: 'La fecha inicial de abono'
    });

    if (errorFechaBase) {
      await conn.rollback();
      return res.status(400).json({ error: errorFechaBase });
    }

    const [[primeraPendiente]] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND estado IN ('pendiente', 'atrasada')
        AND capital_pendiente > 0
      ORDER BY numero_cuota
      LIMIT 1
      FOR UPDATE
      `,
      [idContrato]
    );

    if (!primeraPendiente) {
      await conn.rollback();
      return res.status(400).json({
        error: 'No existen cuotas pendientes para este contrato'
      });
    }

    const cuotaDesdeReal = Number(primeraPendiente.numero_cuota);
    if (cuotaDesdeSolicitada && cuotaDesdeSolicitada !== cuotaDesdeReal) {
      await conn.rollback();
      return res.status(400).json({
        error: `Debe iniciar desde la primera cuota pendiente (${cuotaDesdeReal})`
      });
    }

    if (cuotaHasta < cuotaDesdeReal) {
      await conn.rollback();
      return res.status(400).json({
        error: `La cuota final debe ser mayor o igual a ${cuotaDesdeReal}`
      });
    }

    const [cuotasRango] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND numero_cuota BETWEEN ? AND ?
      ORDER BY numero_cuota
      FOR UPDATE
      `,
      [idContrato, cuotaDesdeReal, cuotaHasta]
    );

    if (!cuotasRango.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'No hay cuotas en el rango solicitado' });
    }

    const limitesFechaContrato = obtenerLimitesFechaContrato(contrato);
    const fechaAbonoUltima = sumarMesesISO(
      fechaAbonoBaseYMD,
      cuotasRango.length - 1
    );

    if (
      limitesFechaContrato.fechaVencimiento &&
      fechaAbonoUltima > limitesFechaContrato.fechaVencimiento
    ) {
      await conn.rollback();
      return res.status(400).json({
        error:
          'La fecha inicial de abono hace que el rango exceda la fecha de vencimiento del contrato ' +
          `(${limitesFechaContrato.fechaVencimiento}).`
      });
    }

    let esperada = cuotaDesdeReal;
    for (const cuota of cuotasRango) {
      if (Number(cuota.numero_cuota) !== esperada) {
        await conn.rollback();
        return res.status(400).json({
          error: `No se permiten saltos de cuotas. Falta la cuota ${esperada}`
        });
      }

      if (cuota.estado === 'pagada' || toNumber(cuota.capital_pendiente) <= 0) {
        await conn.rollback();
        return res.status(400).json({
          error: 'El rango contiene cuotas ya pagadas; no se puede dejar huecos'
        });
      }

      esperada += 1;
    }

    const pagosInsertados = [];
    let capitalContratoActual = round2(contrato.capital_pendiente);
    let capitalTotalAplicado = 0;
    let totalMoraAplicada = 0;
    let totalInteresAplicado = 0;
    let montoTotalPagado = 0;

    for (let i = 0; i < cuotasRango.length; i += 1) {
      const cuota = cuotasRango[i];
      const fechaAbonoFila = sumarMesesISO(fechaAbonoBaseYMD, i);
      const fechaReciboBase = normalizarFechaYMD(fecha_recibo) || fechaAbonoBaseYMD;
      const fechaReciboFila = sumarMesesISO(fechaReciboBase, i);

      const detalle = await calcularDetalleCuota(conn, {
        contrato: { ...contrato, capital_pendiente: capitalContratoActual },
        cuota,
        fechaAbonoYMD: fechaAbonoFila,
        aplicarMora: i === 0,
        saldoContratoBase: capitalContratoActual
      });

      const capitalCuota = round2(cuota.capital_pendiente);
      const abonoInteres = round2(detalle.interes_pendiente);
      const abonoMora = round2(detalle.mora_pendiente);
      const montoTotalFila = round2(capitalCuota + abonoInteres + abonoMora);

      const numeroReciboFila = numero_recibo
        ? `${numero_recibo}-C${cuota.numero_cuota}`
        : null;

      const [pagoResult] = await conn.query(
        `
        INSERT INTO pagos
        (id_cuota, fecha_abono, fecha_recibo,
         forma_pago, banco,
         abono_capital, abono_interes, abono_mora,
         monto_total, numero_recibo)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        `,
        [
          cuota.id_cuota,
          fechaAbonoFila,
          fechaReciboFila,
          forma_pago,
          banco || null,
          capitalCuota,
          abonoInteres,
          abonoMora,
          montoTotalFila,
          numeroReciboFila
        ]
      );

      await conn.query(
        `
        UPDATE cuotas
        SET capital_pendiente = 0,
            estado = 'pagada'
        WHERE id_cuota = ?
        `,
        [cuota.id_cuota]
      );

      capitalContratoActual = round2(capitalContratoActual - capitalCuota);
      capitalTotalAplicado = round2(capitalTotalAplicado + capitalCuota);
      totalMoraAplicada = round2(totalMoraAplicada + abonoMora);
      totalInteresAplicado = round2(totalInteresAplicado + abonoInteres);
      montoTotalPagado = round2(montoTotalPagado + montoTotalFila);

      pagosInsertados.push({
        id_pago: pagoResult.insertId,
        id_cuota: cuota.id_cuota,
        numero_cuota: cuota.numero_cuota,
        abono_capital: capitalCuota,
        abono_interes: abonoInteres,
        abono_mora: abonoMora,
        monto_total: montoTotalFila
      });
    }

    if (capitalContratoActual < 0) {
      capitalContratoActual = 0;
    }

    await actualizarContratoYLote(conn, contrato, capitalContratoActual);
    await conn.commit();

    res.json({
      ok: true,
      resumen: {
        id_contrato: idContrato,
        cuota_desde: cuotaDesdeReal,
        cuota_hasta: cuotaHasta,
        cuotas_pagadas: cuotasRango.length,
        capital_pagado: capitalTotalAplicado,
        mora_pagada: totalMoraAplicada,
        interes_pagado: totalInteresAplicado,
        monto_total_pagado: montoTotalPagado,
        capital_pendiente_contrato: capitalContratoActual
      },
      pagos: pagosInsertados
    });
  } catch (error) {
    await conn.rollback();
    console.error('ERROR REGISTRAR PAGO MASIVO:', error);
    res.status(500).json({ error: 'Error al registrar pago masivo' });
  } finally {
    conn.release();
  }
};

exports.buscarPorCodigoLote = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const codigoRaw = req.body?.codigo;
    const codigo = String(codigoRaw || '')
      .toUpperCase()
      .replace(/\s+/g, '');

    if (!codigo) {
      return res.status(400).json({ error: 'Codigo requerido' });
    }

    const match = codigo.match(/^(\d+)([A-Z]+)(\d+)$/);
    if (!match) {
      return res.status(400).json({
        error: 'Formato invalido. Ej: 001A1'
      });
    }

    const id_lotificacion = Number(match[1].replace(/^0+/, '') || '0');
    const nombre_poligono = match[2];
    const numero_lote = Number(match[3]);

    if (!id_lotificacion || !numero_lote) {
      return res.status(400).json({
        error: 'Codigo invalido. Revise lotificacion y numero de lote'
      });
    }

    const [[lote]] = await conn.query(
      `
      SELECT
        l.id_lote,
        l.numero_lote,
        lo.nombre AS lotificacion,
        p.nombre_poligono AS poligono
      FROM lotes l
      JOIN poligonos p ON p.id_poligono = l.id_poligono
      JOIN lotificaciones lo ON lo.id_lotificacion = p.id_lotificacion
      WHERE p.id_lotificacion = ?
        AND (
          UPPER(REPLACE(TRIM(p.nombre_poligono), ' ', '')) = ?
          OR UPPER(REPLACE(REPLACE(TRIM(p.nombre_poligono), 'POL.', ''), ' ', '')) = ?
          OR UPPER(REPLACE(REPLACE(TRIM(p.nombre_poligono), 'POL', ''), ' ', '')) = ?
        )
        AND l.numero_lote = ?
      `,
      [
        id_lotificacion,
        nombre_poligono,
        nombre_poligono,
        nombre_poligono,
        numero_lote
      ]
    );

    if (!lote) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }

    const [[contrato]] = await conn.query(
      `
      SELECT *
      FROM contratos
      WHERE id_lote = ?
        AND estado = 'activo'
      `,
      [lote.id_lote]
    );

    if (!contrato) {
      return res.status(404).json({ error: 'El lote no tiene contrato activo' });
    }

    const [[cliente]] = await conn.query(
      `
      SELECT
        id_cliente,
        CONCAT(nombres, ' ', apellidos) AS nombre
      FROM cliente
      WHERE id_cliente = ?
      `,
      [contrato.id_cliente]
    );

    const [cuotasPendientes] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND estado != 'pagada'
        AND capital_pendiente > 0
      ORDER BY numero_cuota
      `,
      [contrato.id_contrato]
    );
    const cuota = cuotasPendientes[0];

    const limitesFecha = obtenerLimitesFechaContrato(contrato);

    if (!cuota) {
      return res.status(200).json({
        cliente,
        lote,
        contrato,
        cuota: null,
        mensaje: 'Contrato al dia',
        limites_fecha_abono: {
          min: limitesFecha.fechaInicio,
          max: limitesFecha.fechaVencimiento
        }
      });
    }

    const fechaRef = fechaHoyYMD();
    const cuotasExigibles = cuotasPendientes.filter((c) =>
      cuotaVencidaALaFecha(c, fechaRef)
    );

    const detalle = await calcularDetalleCuota(conn, {
      contrato,
      cuota,
      fechaAbonoYMD: fechaRef,
      aplicarMora: true
    });

    let subtotalExigible = round2(detalle.capital_pendiente + detalle.interes_pendiente);
    let moraGlobalExigible = round2(detalle.mora_pendiente);
    let totalSugerido = round2(detalle.total);
    let interesGlobalExigible = round2(detalle.interes_pendiente);
    let capitalGlobalExigible = round2(detalle.capital_pendiente);

    if (cuotasExigibles.length > 1) {
      const planExigible = await construirPlanPagoExigible(conn, {
        contrato,
        cuotasExigibles,
        fechaAbonoYMD: fechaRef
      });

      capitalGlobalExigible = round2(planExigible.total_capital);
      interesGlobalExigible = round2(planExigible.total_interes);
      subtotalExigible = round2(capitalGlobalExigible + interesGlobalExigible);
      moraGlobalExigible = round2(planExigible.mora_global);
      totalSugerido = round2(planExigible.total_requerido);
    }

    return res.json({
      cliente,
      lote,
      contrato,
      cuota,
      interes: detalle.interes_pendiente,
      mora: detalle.mora_pendiente,
      cargos: detalle.cargos,
      penalizacion: detalle.cargos,
      cuota_sugerida: detalle.cuota_sugerida,
      capital_cuota: detalle.capital_pendiente,
      dias_atraso: detalle.dias_atraso,
      estado_cuota: estadoCuotaSegunFecha(
        cuota.capital_pendiente,
        fechaRef,
        cuota.fecha_vencimiento
      ),
      total: detalle.total,
      total_pagar: totalSugerido,
      requiere_pago_masivo: cuotasExigibles.length > 1,
      cuota_desde_requerida: cuotasExigibles.length > 1
        ? Number(cuotasExigibles[0].numero_cuota)
        : null,
      cuota_hasta_requerida: cuotasExigibles.length > 1
        ? Number(cuotasExigibles[cuotasExigibles.length - 1].numero_cuota)
        : null,
      cuotas_exigibles: cuotasExigibles.length,
      capital_global_exigible: capitalGlobalExigible,
      interes_global_exigible: interesGlobalExigible,
      total_cuotas_exigibles: subtotalExigible,
      mora_global_exigible: moraGlobalExigible,
      total_sugerido_pago_unico: totalSugerido,
      limites_fecha_abono: {
        min: limitesFecha.fechaInicio,
        max: limitesFecha.fechaVencimiento
      }
    });
  } catch (error) {
    console.error('ERROR BUSCAR POR CODIGO:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    conn.release();
  }
};

exports.pagosPorContrato = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'ID de contrato requerido' });
    }

    const [rows] = await db.query(
      `
      SELECT
        p.id_pago,
        p.fecha_abono,
        p.monto_total,
        p.abono_capital,
        p.abono_interes,
        p.abono_mora,
        p.forma_pago,
        p.banco,
        p.fecha_recibo,
        cu.numero_cuota,
        d.ruta_archivo
      FROM pagos p
      JOIN cuotas cu ON p.id_cuota = cu.id_cuota
      LEFT JOIN documentos d
        ON d.id_pago = p.id_pago
        AND d.tipo_documento = 'comprobante'
      WHERE cu.id_contrato = ?
      ORDER BY p.fecha_abono DESC, p.id_pago DESC
      `,
      [id]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    return res.status(500).json({ error: 'Error al obtener pagos' });
  }
};

exports.estadoContrato = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;

    const [[contrato]] = await conn.query(
      `
      SELECT *
      FROM contratos
      WHERE id_contrato = ?
      `,
      [id]
    );

    if (!contrato) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    if (toNumber(contrato.capital_pendiente) <= 0) {
      return res.status(400).json({
        error: 'Este contrato ya no tiene saldo pendiente.'
      });
    }

    const [[cuota]] = await conn.query(
      `
      SELECT *
      FROM cuotas
      WHERE id_contrato = ?
        AND estado IN ('pendiente','atrasada')
        AND capital_pendiente > 0
      ORDER BY numero_cuota
      LIMIT 1
      `,
      [id]
    );

    if (!cuota) {
      return res.json({ contrato, cuota: null });
    }

    return res.json({ contrato, cuota });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al obtener estado' });
  } finally {
    conn.release();
  }
};
