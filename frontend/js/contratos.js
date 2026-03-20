  const API_CONTRATOS = 'http://localhost:3000/api/contratos';
  let lotificacionSeleccionada = null;
  let poligonoSeleccionado = null;
  let loteSeleccionado = null;
  let isSubmittingContrato = false;
  const MODO_CALCULO_POR_PLAZO = 'por_plazo';
  const MODO_CALCULO_POR_CUOTA = 'por_cuota';
  const MAX_PLAZO_POR_CUOTA = 180;

function round2(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getTipoFinanciamiento() {
  return (
    document.querySelector('input[name="tipoFinanciamiento"]:checked')?.value
    || 'interes_saldo'
  );
}

function getModoCalculo() {
  return (
    document.querySelector('input[name="modoCalculo"]:checked')?.value
    || MODO_CALCULO_POR_PLAZO
  );
}

function seleccionarModoCalculo(modo) {
  const radio = document.querySelector(`input[name="modoCalculo"][value="${modo}"]`);
  if (!radio) return false;
  radio.checked = true;
  return true;
}

  // BUSCAR CLIENTE
async function buscarCliente() {
    const texto = document.getElementById('buscarClienteInput').value.trim();
    if (!texto) return;

    const res = await fetch(`${API_CONTRATOS}/buscar-cliente/${texto}`);
    const clientes = await res.json();

    renderResultados(clientes);
}
  // RENDER RESULTADOS
function renderResultados(clientes) {
    const tbody = document.getElementById('tablaResultadosCliente');
    tbody.innerHTML = '';

    if (!Array.isArray(clientes) || clientes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted">
            No se encontraron clientes
          </td>
        </tr>
      `;
      return;
    }

    clientes.forEach(c => {
      tbody.innerHTML += `
        <tr>
          <td>${c.id_cliente}</td>
          <td>${c.nombres} ${c.apellidos}</td>
          <td>${c.dui || ''}</td>
          <td>
            <button class="btn btn-sm btn-success"
              onclick="seleccionarCliente(
                ${c.id_cliente},
                '${c.nombres} ${c.apellidos}'
              )">
              Seleccionar
            </button>

            <button class="btn btn-sm btn-secondary ms-1"
              onclick="verContratos(${c.id_cliente})">
              Ver Contratos
            </button>
          </td>
        </tr>
      `;
    });
}
// VER CONTRATOS
async function verContratos(idCliente) {
    const res = await fetch(`${API_CONTRATOS}/cliente/${idCliente}`);
    const contratos = await res.json();

    if (contratos.length === 0) {
      new bootstrap.Modal(
        document.getElementById('modalSinContratos')
      ).show();
      return;
    }

    const tbody = document.getElementById('tablaContratosModal');
    tbody.innerHTML = '';

    contratos.forEach(c => {
      tbody.innerHTML += `
        <tr>
          <td>${c.id_contrato}</td>
          <td>${c.lotificacion} / Lote ${c.numero_lote}</td>
          <td>$${Number(c.precio_total).toLocaleString()}</td>
          <td>${c.plazo_meses} meses</td>
          <td>
            <span class="badge bg-success">${c.estado}</span>
          </td>
        </tr>
      `;
    });

    new bootstrap.Modal(
      document.getElementById('modalContratos')
    ).show();
}
function seleccionarCliente(idCliente, nombreCompleto) {
    // guardar ID
    document.getElementById('idClienteSeleccionado').value = idCliente;
    // mostrar nombre
    document.getElementById('clienteSeleccionado').value = nombreCompleto;

    // feedback visual opcional
    document.getElementById('clienteSeleccionado')
      .classList.add('is-valid');

    // scroll al formulario
    document.getElementById('formContrato')
      .scrollIntoView({ behavior: 'smooth' });
}
async function cargarLotificacionesContrato() {
    const res = await fetch('http://localhost:3000/api/lotificaciones');
    const data = await res.json();

    const select = document.getElementById('selectLotificacion');
    select.innerHTML = '<option value="">Seleccione</option>';

    data.forEach(l => {
      select.innerHTML += `
        <option value="${l.id_lotificacion}">
          ${l.nombre}
        </option>
      `;
    });

    document.getElementById('selectPoligono').disabled = true;
    document.getElementById('selectLote').disabled = true;
}
function calcularFinanciado() {
  const precio = Number(document.getElementById('precioTotal')?.value || 0);
  const prima = Number(document.getElementById('prima')?.value || 0);

  let monto = precio - prima;

  if (monto < 0) monto = 0;

  document.getElementById('montoFinanciado').value =
    monto.toFixed(2);

  recalcularPlanContrato();
}

function setInfoUltimaCuota(message, isError = false) {
  const info = document.getElementById('infoUltimaCuota');
  if (!info) return;

  info.textContent = message || '';
  info.classList.toggle('text-danger', Boolean(message && isError));
  info.classList.toggle('text-muted', !message || !isError);
}

function setPrecioFinal(totalSinPrima) {
  const prima = Number(document.getElementById('prima').value || 0);
  const precioFinalInput = document.getElementById('precioFinal');

  if (!precioFinalInput) return;
  if (!totalSinPrima || totalSinPrima <= 0) {
    precioFinalInput.value = '';
    return;
  }

  const total = round2(totalSinPrima + prima);
  precioFinalInput.value = total.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function calcularCuotaPorPlazo({
  monto,
  plazo,
  tipoFinanciamiento,
  tasaAnual
}) {
  const P = Number(monto || 0);
  const n = Number(plazo || 0);
  if (P <= 0 || n <= 0) return 0;

  if (
    tipoFinanciamiento === 'penalizacion_fija'
    || tipoFinanciamiento === 'sin_interes'
  ) {
    return round2(P / n);
  }

  const tasaMensual = Number(tasaAnual || 16) / 100 / 12;
  if (tasaMensual <= 0) {
    return round2(P / n);
  }

  const factor = Math.pow(1 + tasaMensual, n);
  const cuota = P * ((tasaMensual * factor) / (factor - 1));
  return round2(cuota);
}

function calcularPlanPorCuota({
  monto,
  cuotaBase,
  tipoFinanciamiento,
  tasaAnual
}) {
  const P = round2(monto);
  const cuota = round2(cuotaBase);

  if (P <= 0) {
    return {
      ok: false,
      error: 'Monto financiado invalido'
    };
  }

  if (cuota <= 0) {
    return {
      ok: false,
      error: 'Ingrese una cuota valida'
    };
  }

  if (
    tipoFinanciamiento === 'penalizacion_fija'
    || tipoFinanciamiento === 'sin_interes'
  ) {
    const plazo = Math.ceil(P / cuota);
    if (plazo > MAX_PLAZO_POR_CUOTA) {
      return {
        ok: false,
        error: `El plan supera el maximo permitido de ${MAX_PLAZO_POR_CUOTA} meses`
      };
    }

    const ultimaCuota = round2(P - (cuota * (plazo - 1)));
    const totalSinPrima = round2((cuota * (plazo - 1)) + ultimaCuota);
    return {
      ok: true,
      plazo,
      cuotaBase: cuota,
      ultimaCuota,
      totalSinPrima
    };
  }

  const tasaMensual = Number(tasaAnual || 16) / 100 / 12;
  if (tasaMensual > 0) {
    const interesPrimerMes = round2(P * tasaMensual);
    if (cuota <= interesPrimerMes) {
      return {
        ok: false,
        error: 'La cuota es demasiado baja para cubrir el interes mensual'
      };
    }
  }

  let saldo = round2(P);
  let totalSinPrima = 0;

  for (let i = 1; i <= MAX_PLAZO_POR_CUOTA; i += 1) {
    const interesMes = tasaMensual > 0 ? round2(saldo * tasaMensual) : 0;
    const capitalMes = round2(cuota - interesMes);

    if (capitalMes <= 0) {
      return {
        ok: false,
        error: 'La cuota es demasiado baja para amortizar capital'
      };
    }

    if (capitalMes >= saldo) {
      const ultimaCuota = round2(saldo + interesMes);
      totalSinPrima = round2(totalSinPrima + ultimaCuota);
      return {
        ok: true,
        plazo: i,
        cuotaBase: cuota,
        ultimaCuota,
        totalSinPrima
      };
    }

    saldo = round2(saldo - capitalMes);
    totalSinPrima = round2(totalSinPrima + cuota);
  }

  return {
    ok: false,
    error: `El plan supera el maximo permitido de ${MAX_PLAZO_POR_CUOTA} meses`
  };
}

function actualizarModoCalculoUI() {
  const modo = getModoCalculo();
  const cuotaInput = document.getElementById('cuotaMensual');
  const plazoInput = document.getElementById('plazoMeses');
  const tieneSelectorModo =
    Boolean(document.getElementById('modoCalculoPlazo'))
    && Boolean(document.getElementById('modoCalculoCuota'));

  if (!cuotaInput || !plazoInput) return;
  if (!tieneSelectorModo) {
    cuotaInput.readOnly = false;
    plazoInput.readOnly = false;
    return;
  }

  cuotaInput.readOnly = modo === MODO_CALCULO_POR_PLAZO;
  plazoInput.readOnly = modo === MODO_CALCULO_POR_CUOTA;
}

function recalcularPlanContrato() {
  const monto = Number(document.getElementById('montoFinanciado')?.value || 0);
  const cuotaInput = document.getElementById('cuotaMensual');
  const plazoInput = document.getElementById('plazoMeses');
  if (!cuotaInput || !plazoInput) return;

  actualizarModoCalculoUI();

  const modo = getModoCalculo();
  const tipoFinanciamiento = getTipoFinanciamiento();
  const tasaAnual = Number(document.getElementById('tasaInteresAnual')?.value || 16);

  if (!monto || monto <= 0) {
    if (modo === MODO_CALCULO_POR_PLAZO) {
      cuotaInput.value = '';
    } else {
      plazoInput.value = '';
    }
    setPrecioFinal(0);
    setInfoUltimaCuota('');
    return;
  }

  if (modo === MODO_CALCULO_POR_PLAZO) {
    const plazo = Number(plazoInput.value || 0);
    if (!plazo || plazo <= 0) {
      cuotaInput.value = '';
      setPrecioFinal(0);
      setInfoUltimaCuota('');
      return;
    }

    const cuota = calcularCuotaPorPlazo({
      monto,
      plazo,
      tipoFinanciamiento,
      tasaAnual
    });

    if (!cuota || cuota <= 0) {
      cuotaInput.value = '';
      setPrecioFinal(0);
      setInfoUltimaCuota('No se pudo calcular una cuota valida', true);
      return;
    }

    cuotaInput.value = cuota.toFixed(2);
    setPrecioFinal(round2(cuota * plazo));
    setInfoUltimaCuota('');
    return;
  }

  const cuotaIngresada = Number(cuotaInput.value || 0);
  if (!cuotaIngresada || cuotaIngresada <= 0) {
    plazoInput.value = '';
    setPrecioFinal(0);
    setInfoUltimaCuota('');
    return;
  }

  const planPorCuota = calcularPlanPorCuota({
    monto,
    cuotaBase: cuotaIngresada,
    tipoFinanciamiento,
    tasaAnual
  });

  if (!planPorCuota.ok) {
    plazoInput.value = '';
    setPrecioFinal(0);
    setInfoUltimaCuota(planPorCuota.error, true);
    return;
  }

  cuotaInput.value = round2(planPorCuota.cuotaBase).toFixed(2);
  plazoInput.value = String(planPorCuota.plazo);
  setPrecioFinal(planPorCuota.totalSinPrima);

  if (Math.abs(planPorCuota.ultimaCuota - planPorCuota.cuotaBase) >= 0.01) {
    setInfoUltimaCuota(`Ultima cuota estimada: $${planPorCuota.ultimaCuota.toFixed(2)}`);
  } else {
    setInfoUltimaCuota('');
  }
}
async function onLotificacionChange(e) {
    console.log('🔥 onLotificacionChange ejecutado', e.target.value);

    const id = e.target.value;
    const poligonoSelect = document.getElementById('selectPoligono');
    const loteSelect = document.getElementById('selectLote');

    poligonoSelect.innerHTML = '<option value="">Seleccione</option>';
    loteSelect.innerHTML = '<option value="">Seleccione</option>';

    poligonoSelect.disabled = true;
    loteSelect.disabled = true;

    document.getElementById('precioTotal').value = '';
    calcularFinanciado();

    if (!id) return;

    const res = await fetch(
      `http://localhost:3000/api/poligonos/lotificacion/${id}`
    );
    const poligonos = await res.json();

    console.log('🧪 poligonos recibidos:', poligonos);

    poligonos.forEach(p => {
      poligonoSelect.innerHTML += `
        <option value="${p.id_poligono}">
          ${p.nombre}
        </option>
      `;
    });

    console.log('🟢 habilitando selectPoligono');
    poligonoSelect.disabled = false;
}
async function onPoligonoChange(e) {
    const id = e.target.value;
    const loteSelect = document.getElementById('selectLote');

    loteSelect.innerHTML = '<option value="">Seleccione</option>';
    loteSelect.disabled = true;

    document.getElementById('precioTotal').value = '';
    calcularFinanciado();

    if (!id) return;

    const res = await fetch(
      `http://localhost:3000/api/lotes/disponibles/${id}`
    );
    const lotes = await res.json();

    if (lotes.length === 0) {
      loteSelect.innerHTML = '<option value="">Sin lotes disponibles</option>';
      return;
    }

    lotes.forEach(l => {
      loteSelect.innerHTML += `
        <option value="${l.id_lote}" data-precio="${l.precio_base}">
          Lote ${l.numero_lote} ($${Number(l.precio_base).toLocaleString()})
        </option>
      `;
    });

    loteSelect.disabled = false;
}
function onLoteChange(e) {
  const option = e.target.selectedOptions[0];
  if (!option) return;

  const precio = Number(option.getAttribute('data-precio'));

  const precioInput = document.getElementById('precioTotal');
  const primaInput = document.getElementById('prima');

  precioInput.value = precio;

  // ⚠️ SOLO poner prima por defecto si está vacía o en 0
  if (!primaInput.value || Number(primaInput.value) === 0) {
    primaInput.value = 2500;
  }

  calcularFinanciado(); // 🔥 esto recalcula monto + cuota
}
document.addEventListener('DOMContentLoaded', () => {

  // ===============================
  // CARGA INICIAL
  // ===============================
  cargarLotificacionesContrato();

  // ===============================
  // SELECTORES EN CASCADA
  // ===============================
  document.getElementById('selectLotificacion')
    .addEventListener('change', onLotificacionChange);

  document.getElementById('selectPoligono')
    .addEventListener('change', onPoligonoChange);

  document.getElementById('selectLote')
    .addEventListener('change', onLoteChange);

  // ===============================
  // CÁLCULO FINANCIADO
  // ===============================
  document.getElementById('prima')
    .addEventListener('input', calcularFinanciado);

  document.getElementById('precioTotal')
    .addEventListener('input', calcularFinanciado);

  document.getElementById('cuotaMensual')
    .addEventListener('input', recalcularPlanContrato);

  document.getElementById('plazoMeses')
    .addEventListener('input', recalcularPlanContrato);

  document.getElementById('cuotaMensual')
    .addEventListener('focus', () => {
      if (getModoCalculo() !== MODO_CALCULO_POR_CUOTA) {
        if (seleccionarModoCalculo(MODO_CALCULO_POR_CUOTA)) {
          recalcularPlanContrato();
        }
      }
    });

  document.getElementById('plazoMeses')
    .addEventListener('focus', () => {
      if (getModoCalculo() !== MODO_CALCULO_POR_PLAZO) {
        if (seleccionarModoCalculo(MODO_CALCULO_POR_PLAZO)) {
          recalcularPlanContrato();
        }
      }
    });

  const modoPlazo = document.getElementById('modoCalculoPlazo');
  const modoCuota = document.getElementById('modoCalculoCuota');
  if (modoPlazo) {
    modoPlazo.addEventListener('change', recalcularPlanContrato);
  }
  if (modoCuota) {
    modoCuota.addEventListener('change', recalcularPlanContrato);
  }

  document.getElementById('tasaInteresAnual')
    .addEventListener('input', recalcularPlanContrato);

  // ===============================
  // TIPO DE FINANCIAMIENTO
  // ===============================
  const tipoInteres = document.getElementById('tipoInteresSaldo');
  const tipoPenal = document.getElementById('tipoPenalizacion');
  const tipoSinInteres = document.getElementById('tipoSinInteres');

  tipoInteres.addEventListener('change', toggleTipo);
  tipoPenal.addEventListener('change', toggleTipo);
  tipoSinInteres.addEventListener('change', toggleTipo);

  function toggleTipo() {
    const tipo = getTipoFinanciamiento();
    const interes = tipo === 'interes_saldo';
    const penalizacion = tipo === 'penalizacion_fija';

    document.getElementById('configInteresSaldo')
      .classList.toggle('d-none', !interes);

    document.getElementById('configPenalizacion')
      .classList.toggle('d-none', !penalizacion);

    recalcularPlanContrato();
  }

  toggleTipo();
  recalcularPlanContrato();

  // ===============================
  // FORMULARIO
  // ===============================
  const formContrato = document.getElementById('formContrato');
  const btnSubmitContrato = formContrato.querySelector('button[type="submit"]');
  const textoSubmitOriginal = btnSubmitContrato ? btnSubmitContrato.innerText : 'Crear Contrato';

  formContrato.addEventListener('submit', async e => {
      e.preventDefault();

      if (isSubmittingContrato) return;

      recalcularPlanContrato();

      const tipoFinanciamiento = getTipoFinanciamiento();
      const modoCalculo = getModoCalculo();

      const data = {
        id_cliente: document.getElementById('idClienteSeleccionado').value,
        id_lote: document.getElementById('selectLote').value,
        modo_calculo: modoCalculo,
        tipo_financiamiento: tipoFinanciamiento,
        precio_total: Number(document.getElementById('precioTotal').value),
        prima: Number(document.getElementById('prima').value),
        monto_financiado: Number(document.getElementById('montoFinanciado').value),
        plazo_meses: Number(document.getElementById('plazoMeses').value),
        cuota: Number(document.getElementById('cuotaMensual').value),
        fecha_inicio: document.getElementById('fechaInicio').value,
        tasa_interes_anual:
          tipoFinanciamiento === 'interes_saldo'
            ? Number(document.getElementById('tasaInteresAnual').value)
            : null,
        penalizacion_fija:
          tipoFinanciamiento === 'penalizacion_fija'
            ? Number(document.getElementById('penalizacionFija').value)
            : null,
        dias_gracia:
          tipoFinanciamiento === 'sin_interes'
            ? 0
            : tipoFinanciamiento === 'interes_saldo'
              ? Number(document.getElementById('diasGracia').value)
              : Number(document.getElementById('diasGraciaPenal').value)
      };

      if (!data.id_cliente || !data.id_lote) {
        alert('Seleccione cliente y lote');
        return;
      }

      if (!data.cuota || data.cuota <= 0) {
        alert('No se pudo calcular una cuota valida');
        return;
      }

      if (!data.plazo_meses || data.plazo_meses <= 0) {
        alert('No se pudo calcular un plazo valido');
        return;
      }

      if (modoCalculo === MODO_CALCULO_POR_CUOTA && data.plazo_meses > MAX_PLAZO_POR_CUOTA) {
        alert(`El plan supera el maximo permitido de ${MAX_PLAZO_POR_CUOTA} meses`);
        return;
      }

      const infoUltima = document.getElementById('infoUltimaCuota');
      if (infoUltima?.classList.contains('text-danger') && infoUltima.textContent) {
        alert(infoUltima.textContent);
        return;
      }

      if (!data.fecha_inicio) {
        alert('Seleccione la fecha de inicio');
        return;
      }

      isSubmittingContrato = true;
      if (btnSubmitContrato) {
        btnSubmitContrato.disabled = true;
        btnSubmitContrato.innerText = 'Creando...';
      }

      try {
        const res = await fetch('http://localhost:3000/api/contratos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!res.ok) {
          let mensaje = 'Error al crear contrato';

          try {
            const body = await res.json();
            if (body?.error) mensaje = body.error;
          } catch (_) {}

          alert(mensaje);
          return;
        }

        alert('Contrato creado correctamente');
        formContrato.reset();
        if (modoPlazo) {
          modoPlazo.checked = true;
        }
        toggleTipo();
        recalcularPlanContrato();
        setInfoUltimaCuota('');
      } catch (error) {
        console.error('Error creando contrato:', error);
        alert('Error de conexion al crear contrato');
      } finally {
        isSubmittingContrato = false;
        if (btnSubmitContrato) {
          btnSubmitContrato.disabled = false;
          btnSubmitContrato.innerText = textoSubmitOriginal;
        }
      }
    });

});




