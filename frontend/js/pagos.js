const API_CONTRATOS = 'http://localhost:3000/api/contratos';
let contextoCalculoPago = null;

function parseFechaISOaLocal(fechaISO) {
  if (!fechaISO) return null;
  const texto = String(fechaISO).trim();

  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return new Date(y, m - 1, d);
  }

  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate()
  );
}

function formatearFechaCorta(fechaISO) {
  const fecha = parseFechaISOaLocal(fechaISO);
  if (!fecha) return '';
  return fecha.toLocaleDateString('es-SV');
}

function formatearFechaInput(fechaISO) {
  const fecha = parseFechaISOaLocal(fechaISO);
  if (!fecha) return '';
  const yy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function fechaHoyYMDLocal() {
  const fecha = new Date();
  const yy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function ajustarFechaDentroLimites(fechaYMD, minYMD, maxYMD) {
  if (!fechaYMD) return fechaYMD;
  if (minYMD && fechaYMD < minYMD) return minYMD;
  if (maxYMD && fechaYMD > maxYMD) return maxYMD;
  return fechaYMD;
}

function actualizarMensajesRango(data, cuotaNumeroMostrada) {
  const leyendaEstado = document.getElementById('estadoCuentaLeyenda');
  const detalleRango = document.getElementById('pagoDetalleRango');
  if (!leyendaEstado && !detalleRango) return;

  const cuotasExigibles = Number(data?.cuotas_exigibles || 0);
  const primeraPendiente = Number(data?.cuota?.numero_cuota || 0);
  const desde = Number(data?.cuota_desde_requerida || 0);
  const hasta = Number(data?.cuota_hasta_requerida || 0);
  const fechaRef = data?.fecha_abono_referencia || fechaHoyYMDLocal();

  let texto = `Cuota pendiente actual: ${primeraPendiente || cuotaNumeroMostrada}.`;

  if (cuotasExigibles > 1 && desde > 0 && hasta > 0) {
    texto =
      `Cuota pendiente actual: ${primeraPendiente}. ` +
      `Por fecha de abono ${fechaRef}, el rango exigible es ${desde}-${hasta}.`;
  }

  if (leyendaEstado) leyendaEstado.textContent = texto;
  if (detalleRango) detalleRango.textContent = texto;
}

function aplicarLimitesFechaPago(limites) {
  const inputAbono = document.getElementById('pagoFecha');
  const inputRecibo = document.getElementById('pagoFechaRecibo');
  if (!inputAbono || !inputRecibo) return;

  const min = limites?.min || '';
  const max = limites?.max || '';

  if (min) {
    inputAbono.min = min;
    inputRecibo.min = min;
  } else {
    inputAbono.removeAttribute('min');
    inputRecibo.removeAttribute('min');
  }

  if (max) {
    inputAbono.max = max;
    inputRecibo.max = max;
  } else {
    inputAbono.removeAttribute('max');
    inputRecibo.removeAttribute('max');
  }
}

async function buscarClientePago() {
  const texto = document.getElementById('buscarClientePago').value.trim();
  if (!texto) return;

  const res = await fetch(`${API_CONTRATOS}/buscar-cliente/${texto}`);
  const clientes = await res.json();

  renderResultadosClientePago(clientes);
}
function renderResultadosClientePago(clientes) {
  const tbody = document.getElementById('tablaResultadosClientePago');
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
          <button class="btn btn-sm btn-secondary"
            onclick="verContratosPago(${c.id_cliente})">
            Ver contratos
          </button>
        </td>
      </tr>
    `;
  });
}
async function verContratosPago(idCliente) {
  const res = await fetch(`${API_CONTRATOS}/cliente/${idCliente}`);
  const contratos = await res.json();

  renderContratosPago(contratos);
}
async function seleccionarContratoPago(idContrato) {

  try {

    const res = await fetch(
      `http://localhost:3000/api/pagos/estado/${idContrato}`
    );

    if (!res.ok) {
      throw new Error('Error al obtener estado de cuenta');
    }

    const data = await res.json();

    document.getElementById('idContratoActivo').value = idContrato;

    renderEstadoCuenta(data);
    actualizarContextoPagoMasivo(idContrato, data.cuota);

  } catch (error) {
    console.error('Error cargando estado:', error);
    alert('Error al actualizar estado de cuenta');
  }
}

function renderContratosPago(contratos) {
  const tbody = document.getElementById('tablaContratosPago');
  tbody.innerHTML = '';

  if (!Array.isArray(contratos) || contratos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted">
          El cliente no tiene contratos
        </td>
      </tr>
    `;
    return;
  }

  contratos.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>${c.id_contrato}</td>
        <td>${c.lotificacion} / ${c.poligono} / Lote ${c.numero_lote}</td>
        <td>${c.plazo_meses} meses</td>
        <td>
          <span class="badge bg-success">${c.estado}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary"
            onclick="seleccionarContratoPago(${c.id_contrato})">
            Ver cuotas
          </button>
        </td>
      </tr>
    `;
  });
}
function renderEstadoCuenta(data) {

  const tbody = document.getElementById('tablaEstadoCuenta');
  tbody.innerHTML = '';
  const limitesFecha = data?.limites_fecha_abono || {
    min: formatearFechaInput(data?.contrato?.fecha_inicio),
    max: formatearFechaInput(data?.contrato?.fecha_vencimiento)
  };
  aplicarLimitesFechaPago(limitesFecha);

  if (!data.cuota) {
    contextoCalculoPago = null;
    const leyendaEstado = document.getElementById('estadoCuentaLeyenda');
    const detalleRango = document.getElementById('pagoDetalleRango');
    if (leyendaEstado) {
      leyendaEstado.textContent = 'Contrato al dia. No hay cuotas exigibles por fecha.';
    }
    if (detalleRango) {
      detalleRango.textContent = 'Contrato al dia. No hay rango exigible.';
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-success">
          Contrato al dÃ­a âœ…
        </td>
      </tr>
    `;
    return;
  }

  const c = data.cuota;
  const cuotasExigibles = Number(data?.cuotas_exigibles || 0);
  const cuotaNumeroMostrada =
    cuotasExigibles > 1 &&
    data?.cuota_desde_requerida &&
    data?.cuota_hasta_requerida
      ? `${data.cuota_desde_requerida}-${data.cuota_hasta_requerida}`
      : c.numero_cuota;
  actualizarMensajesRango(data, cuotaNumeroMostrada);

  const cuotaMostrada = Number(
    data?.total_cuotas_exigibles ?? c.monto_cuota ?? 0
  );
  const cuotaBase = Number(c?.monto_cuota ?? 0);
  const cuotasDelRango = cuotasExigibles > 0 ? cuotasExigibles : 1;
  const capitalCuota = Number(
    data.capital_cuota ?? c.capital_pendiente ?? c.monto_cuota ?? 0
  );
  const cargos = Number(
    data?.mora_global_exigible ?? data?.cargos ?? data?.penalizacion ?? 0
  );
  const totalMostrado = Number(
    data?.total_sugerido_pago_unico ?? (cuotaMostrada + cargos)
  );

  contextoCalculoPago = {
    tipo: data?.contrato?.tipo_financiamiento || '',
    capitalContrato: Number(data?.contrato?.capital_pendiente || 0),
    tasaAnual: Number(data?.contrato?.tasa_interes_anual || 0),
    diasGracia: Number(data?.contrato?.dias_gracia || 0),
    penalizacionFija: Number(data?.contrato?.penalizacion_fija || 0),
    capitalCuota
  };

  tbody.innerHTML = `
    <tr>
      <td>${cuotaNumeroMostrada}</td>
      <td>${formatearFechaCorta(c.fecha_vencimiento)}</td>
      <td>
        $${cuotaMostrada.toFixed(2)}
        <div class="small text-muted">Cuota base: $${cuotaBase.toFixed(2)}${cuotasDelRango > 1 ? ` x ${cuotasDelRango}` : ''}</div>
      </td>
      <td>$${cargos.toFixed(2)}</td>
      <td>
        <span class="badge ${
          data.estado_cuota === 'atrasada'
            ? 'bg-danger'
            : 'bg-warning'
        }">
          ${data.estado_cuota}
        </span>
      </td>
      <td>$${totalMostrado.toFixed(2)}</td>
      <td>
  <button
    class="btn btn-sm btn-success"
    onclick='prepararPago(
      ${c.id_cuota},
      "${cuotaNumeroMostrada}",
      "${c.fecha_vencimiento}",
      ${cuotaMostrada},
      ${cargos},
      ${capitalCuota},
      ${c.id_contrato}
    )'>
    Pagar
  </button>
</td>

    </tr>
  `;
}
function prepararPago(
  idCuota,
  numeroCuota,
  fechaVencimiento,
  montoCuota,
  cargos,
  capitalCuota,
  idContrato
  
)
 {
  document.getElementById('pagoFecha')
  .setAttribute('data-vencimiento', fechaVencimiento);

  document.getElementById('pagoFecha')
  .setAttribute('data-tipo', contextoCalculoPago?.tipo || '');

  document.getElementById('pagoFecha')
  .setAttribute('data-capital', contextoCalculoPago?.capitalContrato || 0);

  document.getElementById('pagoFecha')
  .setAttribute('data-capital-cuota', Number(capitalCuota || 0));

  document.getElementById('pagoFecha')
  .setAttribute('data-tasa', contextoCalculoPago?.tasaAnual || 0);

  document.getElementById('pagoFecha')
  .setAttribute('data-dias-gracia', contextoCalculoPago?.diasGracia || 0);

  document.getElementById('pagoFecha')
  .setAttribute('data-penalizacion', contextoCalculoPago?.penalizacionFija || 0);


  // Guardar IDs
  document.getElementById('idCuotaSeleccionada').value = idCuota;
  document.getElementById('idContratoActivo').value = idContrato;

  // Llenar campos informativos
  document.getElementById('pagoNumeroCuota').value = numeroCuota;
  document.getElementById('pagoVencimiento').value =
    formatearFechaCorta(fechaVencimiento);
  document.getElementById('pagoMontoCuota').value =
    Number(montoCuota).toFixed(2);
  document.getElementById('pagoMora').value =
    Number(cargos).toFixed(2);

  // Sugerir total
  const total = Number(montoCuota || 0) + Number(cargos || 0);
  document.getElementById('pagoMonto').value =
    total.toFixed(2);
  document.getElementById('pagoMonto')
    .setAttribute('data-total-sugerido', total.toFixed(2));

  // Fecha automatica
  const inputFechaAbono = document.getElementById('pagoFecha');
  const minFecha = inputFechaAbono.getAttribute('min') || '';
  const maxFecha = inputFechaAbono.getAttribute('max') || '';
  const fechaSugeridaBase = fechaHoyYMDLocal();
  const fechaSugerida = ajustarFechaDentroLimites(
    fechaSugeridaBase,
    minFecha,
    maxFecha
  );
  inputFechaAbono.value = fechaSugerida;

  // Limpiar editables
  document.getElementById('pagoForma').value = '';
  document.getElementById('pagoBanco').value = '';
  document.getElementById('pagoRecibo').value = '';
  document.getElementById('pagoFechaRecibo').value = fechaSugerida;

  // Habilitar botones
  document.getElementById('btnRegistrarPago').disabled = false;
  document.getElementById('btnAdjuntarComprobante').disabled = false;
  // ðŸ”¹ Scroll suave al formulario
  document
    .getElementById('formPago')
    ?.scrollIntoView({ behavior: 'smooth' });

  // ðŸ”¥ IMPORTANTE: quitar foco del botÃ³n que llamÃ³ esta funciÃ³n
  if (document.activeElement) {
    document.activeElement.blur();
  }
 
}

async function buscarPorCodigoLote() {

  const codigo = document.getElementById('codigoLotePago').value.trim();

  if (!codigo) {
    alert('Ingrese el cÃ³digo del lote');
    return;
  }

  try {

    const res = await fetch(
      'http://localhost:3000/api/pagos/por-codigo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'No se pudo procesar el cÃ³digo');
      return;
    }

    // Mostrar bloque info rÃ¡pida
    document.getElementById('infoPagoRapido')
      .classList.remove('d-none');

    document.getElementById('pagoRapidoCliente')
      .innerText = data.cliente.nombre;

    document.getElementById('pagoRapidoLote')
      .innerText =
      `${data.lote.lotificacion} / ${data.lote.poligono} / Lote ${data.lote.numero_lote}`;

    // Guardar contrato activo
    document.getElementById('idContratoActivo')
      .value = data.contrato.id_contrato;

    // ðŸ‘‡ IMPORTANTE
    renderEstadoCuenta(data);
    actualizarContextoPagoMasivo(data.contrato.id_contrato, data.cuota);

  } catch (err) {
    console.error(err);
    alert('Error de conexiÃ³n con el servidor');
  }
}

async function subirComprobante(idPago) {
  const input = document.getElementById('inputComprobante');

  if (!input.files.length) {
    alert('Seleccione una imagen');
    return;
  }

  const formData = new FormData();
  formData.append('id_pago', idPago);
  formData.append('comprobante', input.files[0]);

  try {
    const res = await fetch(
      'http://localhost:3000/api/documentos/comprobante',
      {
        method: 'POST',
        body: formData
      }
    );

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || 'Error al subir comprobante');
      return;
    }

    // âœ… NO leer ruta_archivo aquÃ­
    alert('Comprobante subido correctamente');

    // cerrar modal
    const modalElement = document.getElementById('modalComprobante');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);

    // Quitar foco del botÃ³n activo
    if (document.activeElement) {
    document.activeElement.blur();
    }
    modalInstance.hide(); 
    // limpiar preview
    document.getElementById('inputComprobante').value = '';
    document.getElementById('previewComprobante').classList.add('d-none');
    document.getElementById('previewPlaceholder').classList.remove('d-none');

  } catch (err) {
    console.error(err);
    alert('Error de conexiÃ³n al subir comprobante');
  }
}
async function verComprobante(idPago) {
  const res = await fetch(
    `http://localhost:3000/api/documentos/comprobante/${idPago}`
  );

  const doc = await res.json();

  if (!doc) {
    alert('Este pago no tiene comprobante');
    return;
  }

  const img = document.getElementById('previewComprobante');
  const placeholder = document.getElementById('previewPlaceholder');

  img.src = `http://localhost:3000/${doc.ruta_archivo}`;
  img.classList.remove('d-none');
  placeholder.classList.add('d-none');

  new bootstrap.Modal(
    document.getElementById('modalComprobante')
  ).show();
}
let idPagoActual = null;

document.getElementById('formPago')
  .addEventListener('submit', async function (e) {

    e.preventDefault();

    const btn = document.getElementById('btnRegistrarPago');
    const idCuota = document.getElementById('idCuotaSeleccionada').value;

    if (!idCuota) {
      alert('Seleccione una cuota');
      return;
    }

    btn.disabled = true;
    btn.innerText = 'Procesando...';

    // ðŸ”Ž Normalizar monto (evitar coma decimal)
const montoInput = document.getElementById('pagoMonto').value
  .trim()
  .replace(',', '.');

const monto = parseFloat(montoInput);

if (isNaN(monto) || monto <= 0) {
  alert('Monto invÃ¡lido');
  btn.disabled = false;
  btn.innerText = 'Registrar Pago';
  return;
}

const numeroCuotaTexto = String(
  document.getElementById('pagoNumeroCuota')?.value || ''
).trim();
const totalSugerido = Number(
  document.getElementById('pagoMonto')?.getAttribute('data-total-sugerido') || 0
);
const esRangoExigible = numeroCuotaTexto.includes('-');
if (esRangoExigible && totalSugerido > 0 && monto < totalSugerido) {
  const confirmar = window.confirm(
    `El monto ingresado ($${monto.toFixed(2)}) no cubre el total sugerido del rango exigible ($${totalSugerido.toFixed(2)}).\n` +
    'Se aplicara primero a mora, luego a interes y despues a capital, quedando saldo pendiente.\n\n' +
    'Desea continuar con el pago parcial?'
  );
  if (!confirmar) {
    btn.disabled = false;
    btn.innerText = 'Registrar Pago';
    return;
  }
}

const data = {
  id_cuota: Number(idCuota),
  monto_pagado: monto,
  fecha_abono: document.getElementById('pagoFecha').value,
  fecha_recibo: document.getElementById('pagoFechaRecibo').value,
  forma_pago: document.getElementById('pagoForma').value,
  banco: document.getElementById('pagoBanco').value || null,
  numero_recibo: document.getElementById('pagoRecibo').value
};


    try {

      const res = await fetch('http://localhost:3000/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      let result;

try {
  result = await res.json();
} catch (err) {
  const text = await res.text();
  console.error("RESPUESTA NO JSON:", text);
  throw new Error("Respuesta invÃ¡lida del servidor");
}


      if (!res.ok) {

  if (result && typeof result.total_necesario !== 'undefined') {

    const totalNecesario = Number(result.total_necesario || 0);
    const excedente = Number(result.excedente || 0);
    const faltante = Number(result.faltante || 0);

    if (faltante > 0) {
      alert(
        `Pago insuficiente.\n` +
        `Monto requerido: $${totalNecesario.toFixed(2)}\n` +
        `Faltante: $${faltante.toFixed(2)}`
      );
    } else if (excedente > 0) {
      alert(
        `Pago excede el saldo.\n` +
        `Monto exacto para finalizar: $${totalNecesario.toFixed(2)}\n` +
        `Excedente: $${excedente.toFixed(2)}`
      );
    } else {
      alert(`Monto sugerido para esta fecha: $${totalNecesario.toFixed(2)}`);
    }

    const inputMonto = document.getElementById('pagoMonto');
    if (inputMonto) inputMonto.value = totalNecesario.toFixed(2);

  } else {
    alert(result?.error || 'Error al registrar pago');
  }

  btn.disabled = false;
  btn.innerText = 'Registrar Pago';
  return;
}


      idPagoActual = result.id_pago;

      document.getElementById('btnImprimirRecibo').disabled = false;
      document.getElementById('modalPagoId').innerText = result.id_pago;
      document.getElementById('modalRecibo').innerText = data.numero_recibo;

      // ðŸ”„ Refrescar estado de cuenta
      const idContrato = document.getElementById('idContratoActivo').value;

      if (idContrato) {
        await seleccionarContratoPago(idContrato);
      }

      // ðŸ§¹ Limpiar formulario
      document.getElementById('formPago').reset();
      document.getElementById('idCuotaSeleccionada').value = '';
      document.getElementById('btnAdjuntarComprobante').disabled = true;

      btn.disabled = true;
      btn.innerText = 'Registrar Pago';

      // ðŸ”µ Abrir modal SIEMPRE
      const modalElement = document.getElementById('modalComprobante');
      const modal = new bootstrap.Modal(modalElement);
      modal.show();

    } catch (error) {

      console.error('ERROR EN SUBMIT:', error);
      alert('Error de conexiÃ³n con el servidor');

      btn.disabled = false;
      btn.innerText = 'Registrar Pago';
    }

  });


document.getElementById('btnAdjuntarComprobante')
  .addEventListener('click', () => {
    if (!idPagoActual) {
      alert('Primero registre el pago');
      return;
    }

    new bootstrap.Modal(
      document.getElementById('modalComprobante')
    ).show();
  });
 document
  .getElementById('btnImprimirRecibo')
  ?.addEventListener('click', function () {

    if (!idPagoActual) {
      alert('No hay pago para imprimir');
      return;
    }

    this.disabled = true;

    window.open(
      `recibo-print.html?id_pago=${idPagoActual}`,
      '_blank'
    );
  });
const inputComprobante = document.getElementById('inputComprobante');
if (inputComprobante) {
  inputComprobante.addEventListener('change', function () {

    const file = this.files[0];
    if (!file) return;

    const img = document.getElementById('previewComprobante');
    const placeholder = document.getElementById('previewPlaceholder');

    const reader = new FileReader();

    reader.onload = function (e) {
      img.src = e.target.result;
      img.classList.remove('d-none');
      placeholder.classList.add('d-none');
    };

    reader.readAsDataURL(file);
  });
}
const modalElement = document.getElementById('modalComprobante');

if (modalElement) {

  // Cuando el modal se termina de ocultar
  modalElement.addEventListener('hidden.bs.modal', function () {

    // Quitar foco de cualquier botÃ³n dentro del modal
    if (document.activeElement) {
      document.activeElement.blur();
    }

    // Opcional: devolver foco al botÃ³n principal
    const btnRegistrar = document.getElementById('btnRegistrarPago');
    if (btnRegistrar) {
      btnRegistrar.focus();
    }
  });
}
const inputFechaAbono = document.getElementById('pagoFecha');

if (inputFechaAbono) {

  inputFechaAbono.addEventListener('change', async function () {
    const fechaAbono = this.value;
    const idContrato = Number(document.getElementById('idContratoActivo')?.value || 0);

    if (!fechaAbono || !idContrato) return;

    const minFecha = this.getAttribute('min') || '';
    const maxFecha = this.getAttribute('max') || '';

    if (minFecha && fechaAbono < minFecha) {
      alert(`La fecha de abono no puede ser menor a ${minFecha}.`);
      this.value = minFecha;
      document.getElementById('btnRegistrarPago').disabled = true;
      return;
    }

    if (maxFecha && fechaAbono > maxFecha) {
      alert(`La fecha de abono no puede ser mayor a ${maxFecha}.`);
      this.value = maxFecha;
      document.getElementById('btnRegistrarPago').disabled = true;
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:3000/api/pagos/estado/${idContrato}?fecha_abono=${encodeURIComponent(fechaAbono)}`
      );
      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || 'No se pudo validar la fecha de abono');
        document.getElementById('btnRegistrarPago').disabled = true;
        return;
      }

      if (!data?.cuota) {
        document.getElementById('btnRegistrarPago').disabled = true;
        return;
      }

      renderEstadoCuenta(data);

      const c = data.cuota;
      const cuotasExigibles = Number(data?.cuotas_exigibles || 0);
      const numeroCuotaMostrada =
        cuotasExigibles > 1 &&
        data?.cuota_desde_requerida &&
        data?.cuota_hasta_requerida
          ? `${data.cuota_desde_requerida}-${data.cuota_hasta_requerida}`
          : c.numero_cuota;
      const cuotaMostrada = Number(
        data?.total_cuotas_exigibles ?? c.monto_cuota ?? 0
      );
      const cargos = Number(
        data?.mora_global_exigible ?? data?.cargos ?? 0
      );
      const total = Number(
        data?.total_sugerido_pago_unico ?? (cuotaMostrada + cargos)
      );

      document.getElementById('idCuotaSeleccionada').value = c.id_cuota;
      document.getElementById('pagoNumeroCuota').value = numeroCuotaMostrada;
      document.getElementById('pagoVencimiento').value = formatearFechaCorta(c.fecha_vencimiento);
      document.getElementById('pagoMontoCuota').value = cuotaMostrada.toFixed(2);
      document.getElementById('pagoMora').value = cargos.toFixed(2);
      document.getElementById('pagoMonto').value = total.toFixed(2);
      document.getElementById('pagoMonto')
        .setAttribute('data-total-sugerido', total.toFixed(2));

      inputFechaAbono.setAttribute('data-vencimiento', c.fecha_vencimiento);
      inputFechaAbono.setAttribute('data-tipo', data?.contrato?.tipo_financiamiento || '');
      inputFechaAbono.setAttribute('data-capital', Number(data?.contrato?.capital_pendiente || 0));
      inputFechaAbono.setAttribute('data-capital-cuota', Number(data?.capital_cuota ?? c.capital_pendiente ?? 0));
      inputFechaAbono.setAttribute('data-tasa', Number(data?.contrato?.tasa_interes_anual || 0));
      inputFechaAbono.setAttribute('data-dias-gracia', Number(data?.contrato?.dias_gracia || 0));
      inputFechaAbono.setAttribute('data-penalizacion', Number(data?.contrato?.penalizacion_fija || 0));

      document.getElementById('btnRegistrarPago').disabled = false;
    } catch (error) {
      console.error('Error validando fecha de abono:', error);
      alert('Error de conexion al validar fecha de abono');
      document.getElementById('btnRegistrarPago').disabled = true;
    }
  });

}

function actualizarContextoPagoMasivo(idContrato, cuotaPendiente) {
  const inputContrato = document.getElementById('pagoMasivoContrato');
  const inputDesde = document.getElementById('pagoMasivoDesde');
  const inputHasta = document.getElementById('pagoMasivoHasta');
  const inputFecha = document.getElementById('pagoMasivoFecha');
  const inputFechaRecibo = document.getElementById('pagoMasivoFechaRecibo');
  const btn = document.getElementById('btnRegistrarPagoMasivo');

  if (!inputContrato || !inputDesde || !inputHasta || !btn) {
    return;
  }

  if (!cuotaPendiente) {
    inputContrato.value = idContrato || '';
    inputDesde.value = '';
    inputHasta.value = '';
    btn.disabled = true;
    document.getElementById('resumenPagoMasivo').innerText =
      'Contrato al dia: no hay cuotas pendientes.';
    return;
  }

  const fechaSugerida =
    formatearFechaInput(cuotaPendiente.fecha_vencimiento) ||
    new Date().toISOString().split('T')[0];

  inputContrato.value = idContrato;
  inputDesde.value = Number(cuotaPendiente.numero_cuota);
  inputHasta.value = Number(cuotaPendiente.numero_cuota);
  inputHasta.min = Number(cuotaPendiente.numero_cuota);

  if (inputFecha) inputFecha.value = fechaSugerida;
  if (inputFechaRecibo) inputFechaRecibo.value = fechaSugerida;

  btn.disabled = false;
  actualizarResumenPagoMasivo();
}

function actualizarResumenPagoMasivo() {
  const elResumen = document.getElementById('resumenPagoMasivo');
  const desde = Number(document.getElementById('pagoMasivoDesde')?.value || 0);
  const hasta = Number(document.getElementById('pagoMasivoHasta')?.value || 0);

  if (!elResumen) return;

  if (!desde || !hasta || hasta < desde) {
    elResumen.innerText = 'Defina un rango valido para pago multiple.';
    return;
  }

  const cuotas = (hasta - desde) + 1;
  elResumen.innerText =
    `Rango: cuota ${desde} a ${hasta} (${cuotas} cuotas). ` +
    'Calculo automatico: mora solo en la primera cuota si hay atraso.';
}

const formPagoMasivo = document.getElementById('formPagoMasivo');
if (formPagoMasivo) {
  formPagoMasivo.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('btnRegistrarPagoMasivo');
    const idContrato = Number(document.getElementById('pagoMasivoContrato').value || 0);
    const cuotaDesde = Number(document.getElementById('pagoMasivoDesde').value || 0);
    const cuotaHasta = Number(document.getElementById('pagoMasivoHasta').value || 0);
    const formaPago = document.getElementById('pagoMasivoForma').value;
    const banco = document.getElementById('pagoMasivoBanco').value.trim();

    if (!idContrato || !cuotaDesde || !cuotaHasta) {
      alert('Seleccione primero un contrato con cuota pendiente');
      return;
    }

    if (cuotaHasta < cuotaDesde) {
      alert('La cuota final no puede ser menor que la cuota inicial');
      return;
    }

    if (formaPago !== 'Efectivo' && !banco) {
      alert('Banco obligatorio para esta forma de pago');
      return;
    }

    const payload = {
      id_contrato: idContrato,
      cuota_desde: cuotaDesde,
      cuota_hasta: cuotaHasta,
      fecha_abono: document.getElementById('pagoMasivoFecha').value,
      fecha_recibo: document.getElementById('pagoMasivoFechaRecibo').value,
      forma_pago: formaPago,
      banco: banco || null,
      numero_recibo: document.getElementById('pagoMasivoRecibo').value.trim()
    };

    if (!payload.fecha_abono || !payload.forma_pago || !payload.numero_recibo) {
      alert('Complete los campos obligatorios del pago multiple');
      return;
    }

    btn.disabled = true;
    btn.innerText = 'Procesando...';

    try {
      const res = await fetch('http://localhost:3000/api/pagos/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || 'Error al registrar pago multiple');
        btn.disabled = false;
        btn.innerText = 'Registrar Pago Multiple';
        return;
      }

      const resumen = result.resumen || {};
      alert(
        `Pago multiple registrado.\n` +
        `Cuotas pagadas: ${resumen.cuotas_pagadas || 0}\n` +
        `Capital: $${Number(resumen.capital_pagado || 0).toFixed(2)}\n` +
        `Mora: $${Number(resumen.mora_pagada || 0).toFixed(2)}\n` +
        `Interes: $${Number(resumen.interes_pagado || 0).toFixed(2)}\n` +
        `Total: $${Number(resumen.monto_total_pagado || 0).toFixed(2)}`
      );

      document.getElementById('pagoMasivoRecibo').value = '';
      document.getElementById('pagoMasivoBanco').value = '';

      await seleccionarContratoPago(idContrato);
    } catch (error) {
      console.error('ERROR PAGO MASIVO:', error);
      alert('Error de conexion con el servidor');
    } finally {
      btn.disabled = false;
      btn.innerText = 'Registrar Pago Multiple';
      actualizarResumenPagoMasivo();
    }
  });

  ['pagoMasivoHasta']
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', actualizarResumenPagoMasivo);
      }
    });
}




