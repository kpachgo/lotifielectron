let deudoresOriginal = [];
let deudoresFiltrados = [];
let paginaActual = 1;
const pageSize = 20;

// 🔹 Obtener deudores del backend
function cargarDeudores() {
  fetch('/api/deudores')
    .then(res => res.json())
    .then(data => {

      // Ya viene agrupado desde el backend
      deudoresOriginal = data;
      deudoresFiltrados = Array.isArray(data) ? data : [];
      paginaActual = 1;

      renderDeudoresPaginado();
      renderPaginacion();
    })
    .catch(err => {
      console.error(err);
      const pag = document.getElementById('paginacionDeudores');
      if (pag) pag.innerHTML = '';
      document.getElementById('tablaDeudores').innerHTML = `
        <tr>
          <td colspan="10" class="text-center text-danger">
            Error al cargar deudores
          </td>
        </tr>
      `;
    });
}
function renderDeudores(lista) {
  const tbody = document.getElementById('tablaDeudores');
  tbody.innerHTML = '';

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center text-success">
          🎉 No hay clientes en mora
        </td>
      </tr>
    `;
    return;
  }

  lista.forEach(item => {
    const esPenalizacion = item.tipo_financiamiento === 'penalizacion_fija';
    const valorCuota = Number(item.valor_cuota || 0);
    const cuotasVencidasMostradas = esPenalizacion
      ? Number(item.cuotas_con_mora_gracia ?? item.cuotas_vencidas ?? 0)
      : Number(item.cuotas_vencidas || 0);
    const totalCuotasMostrado = esPenalizacion
      ? Number(
        item.total_cuotas_con_mora_gracia ??
        (cuotasVencidasMostradas * valorCuota)
      )
      : Number(item.total_cuotas_vencidas || 0);

    const total =
      totalCuotasMostrado +
      Number(item.monto_mora || 0);

    const badgeTipo =
      item.tipo_financiamiento === 'interes_saldo'
        ? '<span class="badge bg-primary">Interés</span>'
        : '<span class="badge bg-info text-dark">Penalización</span>';

    tbody.innerHTML += `
      <tr>
        <td>${item.cliente}</td>
        <td>${item.lotificacion}</td>
        <td>${item.lote}</td>
        <td>${badgeTipo}</td>
                <td class="text-center">${cuotasVencidasMostradas}</td>
        <td class="text-end">$${valorCuota.toFixed(2)}</td>
        <td class="text-end">$${totalCuotasMostrado.toFixed(2)}</td>
        <td class="text-center">${item.dias_mora}</td>
        <td class="text-end text-danger fw-bold">
          $${Number(item.monto_mora).toFixed(2)}
        </td>
        <td class="text-end fw-bold">
          $${Number(total).toFixed(2)}
        </td>
      </tr>
    `;
  });
}
function renderDeudoresPaginado() {
  const inicio = (paginaActual - 1) * pageSize;
  const fin = inicio + pageSize;
  const pagina = deudoresFiltrados.slice(inicio, fin);

  renderDeudores(pagina);
}

function renderPaginacion() {
  const contenedor = document.getElementById('paginacionDeudores');
  if (!contenedor) return;

  const total = deudoresFiltrados.length;
  const totalPaginas = Math.ceil(total / pageSize);

  if (totalPaginas <= 1) {
    contenedor.innerHTML = '';
    return;
  }

  let html = '<nav><ul class="pagination pagination-sm mb-0">';

  html += `
    <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
      <button class="page-link" data-page="${paginaActual - 1}">Anterior</button>
    </li>
  `;

  const desde = Math.max(1, paginaActual - 2);
  const hasta = Math.min(totalPaginas, paginaActual + 2);

  for (let i = desde; i <= hasta; i++) {
    html += `
      <li class="page-item ${i === paginaActual ? 'active' : ''}">
        <button class="page-link" data-page="${i}">${i}</button>
      </li>
    `;
  }

  html += `
    <li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
      <button class="page-link" data-page="${paginaActual + 1}">Siguiente</button>
    </li>
  `;

  html += '</ul></nav>';
  contenedor.innerHTML = html;
}

function cambiarPagina(nuevaPagina) {
  const totalPaginas = Math.ceil(deudoresFiltrados.length / pageSize);
  if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;

  paginaActual = nuevaPagina;
  renderDeudoresPaginado();
  renderPaginacion();
}

function agruparDeudores(data) {
  const mapa = {};

  data.forEach(cuota => {
    const key = cuota.id_contrato;

    if (!mapa[key]) {
      mapa[key] = {
        id_cliente: cuota.id_cliente,
        id_lotificacion: cuota.id_lotificacion, // ✅ AQUI
        cliente: cuota.cliente,
        lotificacion: cuota.lotificacion || '—',
        lote: cuota.lote || '—',
        cuotas_vencidas: 0,
        dias_atraso: cuota.dias_mora,
        monto_mora: 0
      };
    }

    mapa[key].cuotas_vencidas += 1;
    mapa[key].monto_mora += Number(cuota.monto_cuota);

    if (cuota.dias_mora > mapa[key].dias_atraso) {
      mapa[key].dias_atraso = cuota.dias_mora;
    }
  });

  return Object.values(mapa);
}
// 🔹 Filtros
function aplicarFiltros() {
  const texto = document.getElementById('filtroCliente').value.toLowerCase();
  const idLotificacion = document.getElementById('filtroLotificacion').value;

  deudoresFiltrados = deudoresOriginal.filter(d =>
    d.cliente.toLowerCase().includes(texto) &&
    (idLotificacion === '' || String(d.id_lotificacion || '') === String(idLotificacion))
  );

  paginaActual = 1;
  renderDeudoresPaginado();
  renderPaginacion();
}
function cargarLotificacionesDesdeBD() {
  fetch('/api/lotificaciones')
    .then(res => res.json())
    .then(data => {
      const select = document.getElementById('filtroLotificacion');
      select.innerHTML = '<option value="">Todas</option>';

      data.forEach(l => {
        const option = document.createElement('option');
        option.value = l.id_lotificacion;   // 👈 ID REAL
        option.textContent = l.nombre;
        select.appendChild(option);
      });
    })
    .catch(err => console.error('Error cargando lotificaciones:', err));
}

// 🔹 Al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  cargarDeudores();
  cargarLotificacionesDesdeBD();

  document.getElementById('btnBuscar').addEventListener('click', aplicarFiltros);
  document.getElementById('paginacionDeudores').addEventListener('click', e => {
    const page = Number(e.target?.dataset?.page || 0);
    if (!page) return;
    cambiarPagina(page);
  });
});


