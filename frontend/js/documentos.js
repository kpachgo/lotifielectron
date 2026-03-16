let clienteSeleccionado = null;
let clientesBusquedaCache = [];

function mostrarMensaje(texto, tipo = 'info') {
  const cont = document.getElementById('mensajeDocumentos');
  if (!cont) return;

  cont.innerHTML = `
    <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
      ${texto}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function limpiarMensaje() {
  const cont = document.getElementById('mensajeDocumentos');
  if (cont) cont.innerHTML = '';
}

function nombreTipoDocumento(tipo) {
  if (tipo === 'contrato') return 'Contrato';
  if (tipo === 'dui') return 'DUI';
  if (tipo === 'nit') return 'NIT';
  if (tipo === 'foto_cliente') return 'Foto cliente';
  if (tipo === 'otro') return 'Otro';
  return tipo || '';
}

function rutaDocumentoUrl(rutaArchivo) {
  if (!rutaArchivo) return '';
  const ruta = String(rutaArchivo).trim();
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return `/${ruta.replace(/^\/+/, '')}`;
}

function esPdfPorRuta(rutaArchivo) {
  return String(rutaArchivo || '').toLowerCase().endsWith('.pdf');
}

function esImagenPorRuta(rutaArchivo) {
  return /\.(jpg|jpeg|png)$/i.test(String(rutaArchivo || ''));
}

function renderClientes(clientes) {
  const tbody = document.getElementById('tablaClientesDoc');
  tbody.innerHTML = '';
  clientesBusquedaCache = Array.isArray(clientes) ? clientes : [];

  if (!Array.isArray(clientes) || clientes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">Sin resultados</td>
      </tr>
    `;
    return;
  }

  clientes.forEach((c) => {
    const nombre = `${c.nombres || ''} ${c.apellidos || ''}`.trim();
    tbody.innerHTML += `
      <tr>
        <td>${c.id_cliente}</td>
        <td>${nombre}</td>
        <td>${c.dui || ''}</td>
        <td>
          <button
            type="button"
            class="btn btn-sm btn-primary btn-seleccionar-cliente-doc"
            data-id="${c.id_cliente}">
            Seleccionar
          </button>
        </td>
      </tr>
    `;
  });
}

async function buscarClientesDocumentos() {
  limpiarMensaje();
  const texto = document.getElementById('buscarClienteDoc').value.trim();

  if (!texto) {
    mostrarMensaje('Ingresa un criterio de busqueda', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/contratos/buscar-cliente/${encodeURIComponent(texto)}`);
    const data = await res.json();
    renderClientes(data);
  } catch (error) {
    console.error(error);
    mostrarMensaje('No se pudieron cargar clientes', 'danger');
  }
}

function llenarSelectContratos(contratos) {
  const selectVinculo = document.getElementById('docContratoVinculo');
  const selectFiltro = document.getElementById('filtroContratoDoc');

  selectVinculo.innerHTML = '<option value="">Sin contrato especifico</option>';
  selectFiltro.innerHTML = '<option value="">Todos los contratos</option>';

  if (!Array.isArray(contratos)) contratos = [];
  contratos.forEach((c) => {
    const label = `#${c.id_contrato} - ${c.lotificacion} / ${c.poligono} / Lote ${c.numero_lote}`;
    selectVinculo.innerHTML += `<option value="${c.id_contrato}">${label}</option>`;
    selectFiltro.innerHTML += `<option value="${c.id_contrato}">${label}</option>`;
  });

  selectVinculo.disabled = false;
  selectFiltro.disabled = false;
}

async function cargarContratosCliente(idCliente) {
  try {
    const res = await fetch(`/api/contratos/cliente/${idCliente}`);
    const contratos = await res.json();
    llenarSelectContratos(contratos);
  } catch (error) {
    console.error(error);
    mostrarMensaje('No se pudieron cargar contratos del cliente', 'warning');
  }
}

function renderDocumentos(rows) {
  const tbody = document.getElementById('tablaDocumentosCliente');
  tbody.innerHTML = '';

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">Sin documentos</td>
      </tr>
    `;
    return;
  }

  rows.forEach((d) => {
    const contratoTexto = d.id_contrato
      ? `#${d.id_contrato} - ${d.lotificacion || ''} / ${d.poligono || ''} / Lote ${d.numero_lote || ''}`
      : 'General cliente';
    const nombreArchivo = String(d.ruta_archivo || '').split('/').pop() || '';
    const fecha = d.fecha_subida ? new Date(d.fecha_subida).toLocaleString('es-SV') : '';

    tbody.innerHTML += `
      <tr>
        <td>${fecha}</td>
        <td>${nombreTipoDocumento(d.tipo_documento)}</td>
        <td>${d.descripcion_documento || '-'}</td>
        <td>${contratoTexto}</td>
        <td>${nombreArchivo}</td>
        <td>
          <button
            type="button"
            class="btn btn-sm btn-outline-primary btn-ver-doc"
            data-ruta="${(d.ruta_archivo || '').replace(/"/g, '&quot;')}">
            Ver
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger btn-eliminar-doc"
            data-id="${d.id_documento}">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  });
}

async function cargarDocumentosCliente() {
  if (!clienteSeleccionado?.id_cliente) return;

  try {
    const filtroContrato = document.getElementById('filtroContratoDoc').value;
    const params = new URLSearchParams();
    if (filtroContrato) {
      params.set('id_contrato', filtroContrato);
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`/api/documentos/cliente/${clienteSeleccionado.id_cliente}${suffix}`);
    const data = await res.json();

    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al consultar documentos', 'danger');
      return;
    }

    renderDocumentos(data);
  } catch (error) {
    console.error(error);
    mostrarMensaje('Error al consultar documentos', 'danger');
  }
}

function actualizarUIClienteSeleccionado() {
  const nameEl = document.getElementById('clienteSeleccionadoDoc');
  const metaEl = document.getElementById('clienteSeleccionadoMetaDoc');

  if (!clienteSeleccionado) {
    nameEl.textContent = 'Ninguno';
    metaEl.textContent = '';
    return;
  }

  nameEl.textContent = clienteSeleccionado.nombre || `Cliente #${clienteSeleccionado.id_cliente}`;
  metaEl.textContent = `ID: ${clienteSeleccionado.id_cliente} | DUI: ${clienteSeleccionado.dui || '-'}`;
}

async function seleccionarClienteDesdeBoton(btn) {
  const idCliente = Number(btn.dataset.id);
  const encontrado = clientesBusquedaCache.find((c) => Number(c.id_cliente) === idCliente) || {};
  const nombre = `${encontrado.nombres || ''} ${encontrado.apellidos || ''}`.trim();

  clienteSeleccionado = {
    id_cliente: idCliente,
    nombre,
    dui: encontrado.dui || ''
  };
  actualizarUIClienteSeleccionado();
  await cargarContratosCliente(clienteSeleccionado.id_cliente);
  await cargarDocumentosCliente();
}

async function subirDocumentoCliente(event) {
  event.preventDefault();
  limpiarMensaje();

  if (!clienteSeleccionado?.id_cliente) {
    mostrarMensaje('Selecciona un cliente antes de subir documentos', 'warning');
    return;
  }

  const tipo = document.getElementById('docTipo').value;
  const descripcion = document.getElementById('docDescripcion').value.trim();
  const idContrato = document.getElementById('docContratoVinculo').value;
  const inputArchivo = document.getElementById('docArchivo');

  if (!inputArchivo.files.length) {
    mostrarMensaje('Selecciona un archivo', 'warning');
    return;
  }
  if (tipo === 'otro' && !descripcion) {
    mostrarMensaje('Describe el documento cuando el tipo es Otro', 'warning');
    return;
  }

  const form = new FormData();
  form.append('id_cliente', String(clienteSeleccionado.id_cliente));
  if (idContrato) form.append('id_contrato', idContrato);
  form.append('tipo_documento', tipo);
  if (tipo === 'otro') form.append('descripcion_documento', descripcion);
  form.append('archivo', inputArchivo.files[0]);

  try {
    const res = await fetch('/api/documentos/cliente', {
      method: 'POST',
      body: form
    });
    const data = await res.json();

    if (!res.ok) {
      mostrarMensaje(data.error || 'No se pudo subir documento', 'danger');
      return;
    }

    document.getElementById('docArchivo').value = '';
    document.getElementById('docDescripcion').value = '';
    mostrarMensaje('Documento subido correctamente', 'success');
    await cargarDocumentosCliente();
  } catch (error) {
    console.error(error);
    mostrarMensaje('Error de conexion al subir documento', 'danger');
  }
}

function toggleDescripcionOtro() {
  const tipo = document.getElementById('docTipo').value;
  const wrap = document.getElementById('docDescripcionWrap');
  wrap.style.display = tipo === 'otro' ? 'block' : 'none';
}

function abrirModalDocumento(rutaArchivo) {
  const url = rutaDocumentoUrl(rutaArchivo);
  const visorPdf = document.getElementById('visorPdfDoc');
  const visorImagen = document.getElementById('visorImagenDoc');
  const visorVacio = document.getElementById('visorVacioDoc');
  const link = document.getElementById('linkAbrirDocumento');

  visorPdf.style.display = 'none';
  visorImagen.style.display = 'none';
  visorVacio.style.display = 'none';
  visorPdf.src = '';
  visorImagen.src = '';

  if (!url) {
    visorVacio.style.display = 'block';
    link.href = '#';
  } else {
    link.href = url;
    if (esPdfPorRuta(rutaArchivo)) {
      visorPdf.style.display = 'block';
      visorPdf.src = url;
    } else if (esImagenPorRuta(rutaArchivo)) {
      visorImagen.style.display = 'block';
      visorImagen.src = url;
    } else {
      visorVacio.style.display = 'block';
    }
  }

  new bootstrap.Modal(document.getElementById('modalVerDocumento')).show();
}

async function eliminarDocumento(idDocumento) {
  const confirmar = window.confirm('Deseas eliminar este documento?');
  if (!confirmar) return;

  try {
    const res = await fetch(`/api/documentos/cliente/${idDocumento}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (!res.ok) {
      mostrarMensaje(data.error || 'No se pudo eliminar documento', 'danger');
      return;
    }

    mostrarMensaje('Documento eliminado', 'success');
    await cargarDocumentosCliente();
  } catch (error) {
    console.error(error);
    mostrarMensaje('Error al eliminar documento', 'danger');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnBuscar = document.getElementById('btnBuscarClienteDoc');
  const inputBuscar = document.getElementById('buscarClienteDoc');
  const formDoc = document.getElementById('formDocumentoCliente');
  const tipoDoc = document.getElementById('docTipo');
  const filtroContrato = document.getElementById('filtroContratoDoc');

  btnBuscar.addEventListener('click', buscarClientesDocumentos);
  inputBuscar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      buscarClientesDocumentos();
    }
  });

  formDoc.addEventListener('submit', subirDocumentoCliente);
  tipoDoc.addEventListener('change', toggleDescripcionOtro);
  filtroContrato.addEventListener('change', cargarDocumentosCliente);

  document.addEventListener('click', (event) => {
    const btnSelect = event.target.closest('.btn-seleccionar-cliente-doc');
    if (btnSelect) {
      seleccionarClienteDesdeBoton(btnSelect);
      return;
    }

    const btnVer = event.target.closest('.btn-ver-doc');
    if (btnVer) {
      abrirModalDocumento(btnVer.dataset.ruta || '');
      return;
    }

    const btnDelete = event.target.closest('.btn-eliminar-doc');
    if (btnDelete) {
      eliminarDocumento(Number(btnDelete.dataset.id));
    }
  });
});
