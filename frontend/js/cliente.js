const API_CLIENTE = 'http://localhost:3000/api/cliente';
let clientesCache = [];
let clientesFiltrados = [];
let paginaActual = 1;
const pageSize = 20;
document.addEventListener('DOMContentLoaded', () => {
  cargarClientes();

  const form = document.getElementById('formCliente');
  form.addEventListener('submit', e => {
    e.preventDefault(); // ⛔ evita recargar página
    guardarCliente();
  });
  const buscador = document.getElementById('buscadorCliente');
  if (buscador) {
  buscador.addEventListener('input', filtrarClientes);
  }
});
function guardarCliente() {
  const form = document.getElementById('formCliente');

  // Validación nativa HTML5
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = {
    nombres: document.getElementById('nombres').value.trim(),
    apellidos: document.getElementById('apellidos').value.trim(),
    dui: document.getElementById('dui').value.trim(),
    nit: document.getElementById('nit').value.trim() || null,
    telefono: document.getElementById('telefono').value.trim(),
    direccion: document.getElementById('direccion').value.trim()
  };

  fetch(API_CLIENTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(res => {
      if (!res.ok) throw new Error('Error al guardar');
      return res.text(); // 🔑 NO json()
    })
    .then(() => {
      mostrarMensaje('Cliente guardado correctamente', 'success');
      form.reset();
      cargarClientes();
    })
    .catch(err => {
      console.error(err);
      mostrarMensaje('Error al guardar cliente', 'danger');
    });
}
function cargarClientes() {
  fetch(API_CLIENTE)
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) return;
      clientesCache = data;
      clientesFiltrados = [...clientesCache];
      paginaActual = 1;
      renderClientesPaginado();
      renderPaginacionClientes();
    });
}
function renderClientes(clientes) {
  const tbody = document.getElementById('tablaClientes');
  tbody.innerHTML = '';

  if (!clientes || clientes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted">Sin resultados</td>
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
        <td>${c.telefono || ''}</td>
        <td></td>
      </tr>
    `;
  });
}
function renderClientesPaginado() {
  const inicio = (paginaActual - 1) * pageSize;
  const fin = inicio + pageSize;
  const pagina = clientesFiltrados.slice(inicio, fin);

  renderClientes(pagina);
}

function renderPaginacionClientes() {
  const cont = document.getElementById('paginacionClientes');
  if (!cont) return;

  const total = clientesFiltrados.length;
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) {
    cont.innerHTML = '';
    return;
  }

  let html = '<nav><ul class="pagination pagination-sm mb-0">';

  html += `
    <li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
      <button class="page-link" data-page="${paginaActual - 1}">Anterior</button>
    </li>
  `;

  const desde = Math.max(1, paginaActual - 2);
  const hasta = Math.min(totalPages, paginaActual + 2);

  for (let i = desde; i <= hasta; i++) {
    html += `
      <li class="page-item ${i === paginaActual ? 'active' : ''}">
        <button class="page-link" data-page="${i}">${i}</button>
      </li>
    `;
  }

  html += `
    <li class="page-item ${paginaActual === totalPages ? 'disabled' : ''}">
      <button class="page-link" data-page="${paginaActual + 1}">Siguiente</button>
    </li>
  `;

  html += '</ul></nav>';
  cont.innerHTML = html;
}

function cambiarPaginaClientes(nuevaPagina) {
  const totalPages = Math.ceil(clientesFiltrados.length / pageSize);
  if (nuevaPagina < 1 || nuevaPagina > totalPages) return;

  paginaActual = nuevaPagina;
  renderClientesPaginado();
  renderPaginacionClientes();
}

function mostrarMensaje(texto, tipo) {
  const div = document.getElementById('mensajeCliente');
  if (!div) return;

  div.innerHTML = `
    <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
      ${texto}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;

  setTimeout(() => {
    div.innerHTML = '';
  }, 3000);
}
function filtrarClientes() {
  const texto = document
    .getElementById('buscadorCliente')
    .value
    .toLowerCase();

  clientesFiltrados = clientesCache.filter(c =>
    `${c.nombres} ${c.apellidos}`.toLowerCase().includes(texto)
  );

  paginaActual = 1;
  renderClientesPaginado();
  renderPaginacionClientes();
}

document.addEventListener('click', e => {
  const page = Number(e.target?.dataset?.page || 0);
  if (!page) return;

  const dentroPaginacion = e.target.closest('#paginacionClientes');
  if (!dentroPaginacion) return;

  cambiarPaginaClientes(page);
});

