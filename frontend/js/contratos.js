  const API_CONTRATOS = 'http://localhost:3000/api/contratos';
  let lotificacionSeleccionada = null;
  let poligonoSeleccionado = null;
  let loteSeleccionado = null;
  let isSubmittingContrato = false;

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

  recalcularCuotaAutomatica();
}

function recalcularCuotaAutomatica() {
  const monto = Number(document.getElementById('montoFinanciado')?.value || 0);
  const plazo = Number(document.getElementById('plazoMeses')?.value || 0);
  const cuotaInput = document.getElementById('cuotaMensual');
  if (!cuotaInput) return;

  if (!monto || !plazo || plazo <= 0) {
    cuotaInput.value = '';
    calcularPrecioFinal();
    return;
  }

  const tipoFinanciamiento =
    document.querySelector('input[name="tipoFinanciamiento"]:checked')?.value ||
    'interes_saldo';

  let cuota = 0;

  if (tipoFinanciamiento === 'interes_saldo') {
    const tasaAnual = Number(document.getElementById('tasaInteresAnual')?.value || 16);
    const tasaMensual = (tasaAnual / 100) / 12;

    if (tasaMensual <= 0) {
      cuota = monto / plazo;
    } else {
      const factor = Math.pow(1 + tasaMensual, plazo);
      cuota = monto * ((tasaMensual * factor) / (factor - 1));
    }
  } else {
    cuota = monto / plazo;
  }

  cuotaInput.value = Number(cuota).toFixed(2);
  calcularPrecioFinal();
}
function calcularPrecioFinal() {
  const cuota = Number(document.getElementById('cuotaMensual').value || 0);
  const plazo = Number(document.getElementById('plazoMeses').value || 0);
  const prima = Number(document.getElementById('prima').value || 0);

  if (!cuota || !plazo) {
    document.getElementById('precioFinal').value = '';
    return;
  }

  const total = (cuota * plazo) + prima;

  document.getElementById('precioFinal').value =
    total.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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
  .addEventListener('input', calcularPrecioFinal);

document.getElementById('plazoMeses')
  .addEventListener('input', recalcularCuotaAutomatica);

document.getElementById('prima')
  .addEventListener('input', calcularPrecioFinal);

  document.getElementById('tasaInteresAnual')
    .addEventListener('input', recalcularCuotaAutomatica);

  // ===============================
  // TIPO DE FINANCIAMIENTO
  // ===============================
  const tipoInteres = document.getElementById('tipoInteresSaldo');
  const tipoPenal = document.getElementById('tipoPenalizacion');

  tipoInteres.addEventListener('change', toggleTipo);
  tipoPenal.addEventListener('change', toggleTipo);

  function toggleTipo() {
    const interes = tipoInteres.checked;

    document.getElementById('configInteresSaldo')
      .classList.toggle('d-none', !interes);

    document.getElementById('configPenalizacion')
      .classList.toggle('d-none', interes);

    recalcularCuotaAutomatica();
  }

  toggleTipo();
  recalcularCuotaAutomatica();

  // ===============================
  // FORMULARIO
  // ===============================
  const formContrato = document.getElementById('formContrato');
  const btnSubmitContrato = formContrato.querySelector('button[type="submit"]');
  const textoSubmitOriginal = btnSubmitContrato ? btnSubmitContrato.innerText : 'Crear Contrato';

  formContrato.addEventListener('submit', async e => {
      e.preventDefault();

      if (isSubmittingContrato) return;

      const tipoFinanciamiento =
        document.querySelector('input[name="tipoFinanciamiento"]:checked').value;

      const data = {
        id_cliente: document.getElementById('idClienteSeleccionado').value,
        id_lote: document.getElementById('selectLote').value,
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
          tipoFinanciamiento === 'interes_saldo'
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




