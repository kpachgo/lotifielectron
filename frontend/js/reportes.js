let contratosCache = [];
let pageActual = 1;
const pageSize = 20;


async function verDetalleReporte(idContrato) {
  try {
    const modal = new bootstrap.Modal(
      document.getElementById('modalDetalleReporte')
    );
    modal.show();

    document.getElementById('tablaEstadoCuentaReporte').innerHTML =
      `<tr><td colspan="6" class="text-center text-muted">Cargando...</td></tr>`;

    document.getElementById('tablaPagosReporte').innerHTML =
      `<tr><td colspan="6" class="text-center text-muted">Cargando...</td></tr>`;

    // =========================
    // CONTRATO
    // =========================
    const resContrato = await fetch(`/api/contratos/detalle/${idContrato}`);
    const contrato = await resContrato.json();

    document.getElementById('repClienteNombre').innerText = contrato.cliente;
    document.getElementById('repClienteDui').innerText = contrato.dui;
    document.getElementById('repLote').innerText =
      `${contrato.lotificacion} / ${contrato.poligono} / Lote ${contrato.numero_lote}`;
    document.getElementById('repPlazo').innerText =
      `${contrato.plazo_meses} meses`;
    document.getElementById('repEstadoContrato').innerText = contrato.estado;

    // =========================
    // CUOTAS
    // =========================
    const resCuotas = await fetch(`/api/cuotas/contrato/${idContrato}`);
    const cuotas = await resCuotas.json();
    renderEstadoCuentaReporte(cuotas);

    // =========================
    // PAGOS
    // =========================
    const resPagos = await fetch(`/api/pagos/contrato/${idContrato}`);
    const pagos = await resPagos.json();
    renderPagosReporte(pagos);
    // =========================
// RESUMEN FINANCIERO
// =========================
    const resResumen = await fetch(`/api/reportes/resumen/${idContrato}`);
    const resumen = await resResumen.json();

    document.getElementById('resPrecioTotal').innerText =
    `$${Number(resumen.precio_total).toFixed(2)}`;
    document.getElementById('resPrima').innerText =
    `$${Number(resumen.prima).toFixed(2)}`;
    document.getElementById('resMontoFinanciado').innerText =
    `$${Number(resumen.monto_financiado).toFixed(2)}`;
    document.getElementById('resCapitalPagado').innerText =
    `$${Number(resumen.capital_pagado).toFixed(2)}`;
    document.getElementById('resInteresPagado').innerText =
    `$${Number(resumen.interes_pagado).toFixed(2)}`;
    document.getElementById('resMoraPagada').innerText =
    `$${Number(resumen.mora_pagada).toFixed(2)}`;
    document.getElementById('resTotalAbonado').innerText =
    `$${Number(resumen.total_abonado).toFixed(2)}`;
    document.getElementById('resSaldoPendiente').innerText =
    `$${Number(resumen.saldo_pendiente).toFixed(2)}`;
    document.getElementById('resSaldoAcumulado').innerText =
    `$${Number(resumen.saldo_acumulado).toFixed(2)}`;
  } catch (err) {
    console.error(err);
    alert('Error cargando detalle del reporte');
  }
}
function renderEstadoCuentaReporte(cuotas) {
  const tbody = document.getElementById('tablaEstadoCuentaReporte');
  tbody.innerHTML = '';

  if (!cuotas || cuotas.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="6" class="text-center text-muted">Sin cuotas</td></tr>`;
    return;
  }

  cuotas.forEach(c => {

    const capital = Number(c.capital_pagado || 0);
    const interes = Number(c.interes_pagado || 0);
    const mora = Number(c.mora_pagada || 0);

    const pagadoReal = capital + interes; // 🔹 sin incluir mora

    tbody.innerHTML += `
      <tr>
        <td>${c.numero_cuota}</td>
        <td>${new Date(c.fecha_vencimiento).toLocaleDateString()}</td>
        <td>$${Number(c.monto_cuota).toFixed(2)}</td>

        <!-- 🔹 Lo aplicado a cuota -->
        <td>$${pagadoReal.toFixed(2)}</td>

        <!-- 🔹 Mora pagada -->
        <td>$${mora.toFixed(2)}</td>

        <td>
          <span class="badge ${
            c.estado === 'pagada'
              ? 'bg-success'
              : 'bg-warning'
          }">
            ${c.estado}
          </span>
        </td>
      </tr>
    `;
  });
}
function renderPagosReporte(pagos) {
  const tbody = document.getElementById('tablaPagosReporte');
  tbody.innerHTML = '';

  if (!pagos || pagos.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="6" class="text-center text-muted">Sin pagos</td></tr>`;
    return;
  }

  pagos.forEach(p => {
  tbody.innerHTML += `
    <tr>
      <td>${new Date(p.fecha_abono).toLocaleDateString()}</td>
      <td>$${Number(p.monto_total).toFixed(2)}</td>
      <td>${p.forma_pago || '—'}</td>
      <td>${p.banco || '—'}</td>
      <td>${p.fecha_recibo ? new Date(p.fecha_recibo).toLocaleDateString() : '—'}</td>

      <!-- COMPROBANTE -->
      <td class="text-center">
        ${
          p.ruta_archivo
            ? `<button
                 class="btn btn-sm btn-outline-primary btn-ver-comprobante"
                 data-ruta="${p.ruta_archivo}">
                 Ver
               </button>`
            : '—'
        }
      </td>

      <!-- IMPRIMIR -->
      <td class="text-center">
        <button
          class="btn btn-sm btn-success"
          onclick="imprimirPago(${p.id_pago})">
          🖨️
        </button>
      </td>
    </tr>
  `;
});
}
function imprimirPago(idPago) {
  if (!idPago) {
    alert('No se encontró el pago para imprimir');
    return;
  }

  window.open(
    `recibo-print.html?id_pago=${idPago}`,
    '_blank'
  );
}
async function cargarReporte() {
  try {
    const cliente = document.getElementById('filtroCliente').value;
    const lote = document.getElementById('filtroLote').value;
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    const estado = document.getElementById('filtroEstado').value;

    const params = new URLSearchParams({
      cliente,
      lote,
      desde,
      hasta,
      estado
    });

    const res = await fetch(`/api/reportes/contratos?${params.toString()}`);
    const data = await res.json();

   contratosCache = Array.isArray(data.contratos) ? data.contratos : [];
pageActual = 1;

renderResumen(data.resumen);
renderTablaReportesPaginada();
renderPaginacion();


  } catch (error) {
    console.error('Error cargando reporte:', error);
    alert('Error al cargar el reporte');
  }
}
function renderResumen(r) {
  document.getElementById('repTotalPagado').innerText =
    `$${Number(r.total_pagado).toFixed(2)}`;

  document.getElementById('repTotalPendiente').innerText =
    `$${Number(r.total_pendiente).toFixed(2)}`;

  document.getElementById('repTotalContratos').innerText =
    r.contratos;

  document.getElementById('repCuotasMora').innerText =
    r.cuotas_mora;
}
function renderTablaReportes(contratos) {
  const tbody = document.getElementById('tablaReportes');
  tbody.innerHTML = '';

  if (!contratos || contratos.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="7" class="text-center text-muted">Sin resultados</td></tr>`;
    return;
  }

  contratos.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>${c.cliente}</td>
        <td>${c.lote}</td>
        <td>#${c.id_contrato}</td>
        <td>${new Date(c.fecha_inicio).toLocaleDateString()}</td>
        <td>$${Number(c.precio_total).toFixed(2)}</td>
        <td>
          <span class="badge ${
            c.estado === 'activo'
              ? 'bg-success'
              : c.estado === 'finalizado'
              ? 'bg-secondary'
              : 'bg-warning'
          }">${c.estado}</span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary"
            onclick="verDetalleReporte(${c.id_contrato})">
            Ver detalle
          </button>
        </td>
      </tr>
    `;
  });
}
function renderTablaReportesPaginada() {
  const start = (pageActual - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = contratosCache.slice(start, end);

  renderTablaReportes(pageItems); // reutiliza tu función existente
}

function renderPaginacion() {
  const cont = document.getElementById('paginacionReportes');
  if (!cont) return;

  const total = contratosCache.length;
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) {
    cont.innerHTML = '';
    return;
  }

  let html = `<nav><ul class="pagination pagination-sm justify-content-end">`;

  html += `
    <li class="page-item ${pageActual === 1 ? 'disabled' : ''}">
      <button class="page-link" onclick="cambiarPagina(${pageActual - 1})">«</button>
    </li>
  `;

  const start = Math.max(1, pageActual - 2);
  const end = Math.min(totalPages, pageActual + 2);

  for (let i = start; i <= end; i++) {
    html += `
      <li class="page-item ${i === pageActual ? 'active' : ''}">
        <button class="page-link" onclick="cambiarPagina(${i})">${i}</button>
      </li>
    `;
  }

  html += `
    <li class="page-item ${pageActual === totalPages ? 'disabled' : ''}">
      <button class="page-link" onclick="cambiarPagina(${pageActual + 1})">»</button>
    </li>
  `;

  html += `</ul></nav>`;
  cont.innerHTML = html;
}

function cambiarPagina(nueva) {
  const totalPages = Math.ceil(contratosCache.length / pageSize);
  if (nueva < 1 || nueva > totalPages) return;

  pageActual = nueva;
  renderTablaReportesPaginada();
  renderPaginacion();
}

function verComprobante(ruta) {
  const img = document.getElementById('imgComprobante');
  const modalEl = document.getElementById('modalComprobante');

  if (!img || !modalEl) {
    console.warn('Modal de comprobante no existe');
    return;
  }

  const archivo = ruta.split(/[/\\]/).pop();
  img.src = `/uploads/${archivo}`;

  new bootstrap.Modal(modalEl).show();
}
function abrirModalImpresion() {
  new bootstrap.Modal(
    document.getElementById('modalImpresion')
  ).show();
}
function prepararImpresion() {
  const chkEstado = document.getElementById('chkEstadoCuenta').checked;
  const chkPagos = document.getElementById('chkHistorialPagos').checked;

  if (!chkEstado && !chkPagos) {
    alert('Debe seleccionar al menos una opción para imprimir');
    return;
  }

  document.getElementById('printCliente').innerText =
    document.getElementById('repClienteNombre').innerText;

  document.getElementById('printDui').innerText =
    document.getElementById('repClienteDui').innerText;

  document.getElementById('printLote').innerText =
    document.getElementById('repLote').innerText;

  document.getElementById('printPlazo').innerText =
    document.getElementById('repPlazo').innerText;

  document.getElementById('printEstado').innerText =
    document.getElementById('repEstadoContrato').innerText;

  const printTablaCuotas = document.getElementById('printTablaCuotas');
  const printTablaPagos = document.getElementById('printTablaPagos');

  document.getElementById('printEstadoCuenta').style.display =
    chkEstado ? 'block' : 'none';

  document.getElementById('printHistorialPagos').style.display =
    chkPagos ? 'block' : 'none';

  printTablaCuotas.innerHTML = '';
  printTablaPagos.innerHTML = '';

  if (chkEstado) {
    document
      .querySelectorAll('#tablaEstadoCuentaReporte tr')
      .forEach(tr => printTablaCuotas.appendChild(tr.cloneNode(true)));
  }

  if (chkPagos) {
    document
      .querySelectorAll('#tablaPagosReporte tr')
      .forEach(tr => printTablaPagos.appendChild(tr.cloneNode(true)));
  }

  setTimeout(() => window.print(), 300);
}
// EVENTOS
document.addEventListener('DOMContentLoaded', () => {
  cargarReporte();
  document.getElementById('btnBuscarReporte')
    .addEventListener('click', cargarReporte);
});
document.addEventListener('click', e => {
  if (e.target.classList.contains('btn-ver-comprobante')) {
    verComprobante(e.target.dataset.ruta);
  }
});


