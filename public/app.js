/* Interfaz web de GymGraph: consume la API REST de Express. */

// ---------- utilidades ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (n) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

async function api(url, opciones = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
  return datos;
}

function aviso(msg, error = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `visible ${error ? 'error' : ''}`;
  clearTimeout(aviso.timer);
  aviso.timer = setTimeout(() => (t.className = ''), 3000);
}

const intentar = (fn) => async (...args) => {
  try { await fn(...args); } catch (e) { aviso(e.message, true); }
};

// ---------- estado ----------
let clientes = [];
let productos = [];
let catalogos = { categorias: [], marcas: [], objetivos: [] };

// ---------- pestañas ----------
$$('.tab').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.remove('activo'));
    $$('.panel').forEach((x) => x.classList.remove('activo'));
    b.classList.add('activo');
    $(`#${b.dataset.tab}`).classList.add('activo');
    if (b.dataset.tab === 'recomendaciones') cargarRecomendaciones();
    if (b.dataset.tab === 'compras') cargarHistorial();
  })
);

// ---------- carga general ----------
async function cargarTodo() {
  [clientes, productos, catalogos] = await Promise.all([
    api('/api/clientes'),
    api('/api/productos'),
    api('/api/productos/catalogos'),
  ]);
  pintarClientes();
  pintarProductos();
  pintarSelects();
  pintarChecks();
}

function pintarSelects() {
  $$('.sel-cliente').forEach((s) => {
    const previo = s.value;
    s.innerHTML = clientes.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)} (${esc(c.id)})</option>`).join('');
    if (previo) s.value = previo;
  });
  $$('.sel-producto').forEach((s) => {
    const previo = s.value;
    s.innerHTML = productos.map((p) => `<option value="${esc(p.sku)}">${esc(p.nombre)}</option>`).join('');
    if (previo) s.value = previo;
  });
  if ($('#sel-hasta').options.length > 1 && $('#sel-hasta').selectedIndex === 0) $('#sel-hasta').selectedIndex = clientes.length - 1;
  $('#lista-categorias').innerHTML = catalogos.categorias.map((c) => `<option value="${esc(c)}">`).join('');
  $('#lista-marcas').innerHTML = catalogos.marcas.map((m) => `<option value="${esc(m)}">`).join('');
}

function pintarChecks() {
  const html = (prefijo) =>
    catalogos.objetivos.map((o) => `<label><input type="checkbox" name="objetivos" value="${esc(o)}" id="${prefijo}-${esc(o)}"> ${esc(o)}</label>`).join('');
  $('#chk-objetivos-cliente').innerHTML = html('oc');
  $('#chk-objetivos-producto').innerHTML = html('op');
}

const marcados = (form) => [...form.querySelectorAll('input[name=objetivos]:checked')].map((i) => i.value);
const marcar = (form, lista) => form.querySelectorAll('input[name=objetivos]').forEach((i) => (i.checked = lista.includes(i.value)));
const etiquetas = (lista) => lista.map((x) => `<span class="tag">${esc(x)}</span>`).join('');

// ---------- CLIENTES (CRUD) ----------
function pintarClientes() {
  $('#total-clientes').textContent = clientes.length;
  $('#tabla-clientes').innerHTML = clientes.map((c) => `
    <tr>
      <td>${esc(c.id)}</td><td>${esc(c.nombre)}<br><span class="sub">${esc(c.email)}</span></td>
      <td>${esc(c.ciudad || '')}</td><td>${etiquetas(c.objetivos)}</td><td>${c.totalCompras}</td>
      <td class="acciones-celda">
        <button class="mini" data-editar-cliente="${esc(c.id)}">Editar</button>
        <button class="mini borrar" data-borrar-cliente="${esc(c.id)}">Eliminar</button>
      </td>
    </tr>`).join('');
}

function resetFormCliente() {
  const f = $('#form-cliente');
  f.reset(); f.id.value = '';
  $('#titulo-form-cliente').textContent = 'Nuevo cliente';
}

$('#form-cliente').addEventListener('submit', intentar(async (e) => {
  e.preventDefault();
  const f = e.target;
  const datos = { nombre: f.nombre.value, email: f.email.value, ciudad: f.ciudad.value, objetivos: marcados(f) };
  if (f.id.value) {
    await api(`/api/clientes/${f.id.value}`, { method: 'PUT', body: datos });
    aviso('Cliente actualizado');
  } else {
    const { id } = await api('/api/clientes', { method: 'POST', body: datos });
    aviso(`Cliente creado: ${id}`);
  }
  resetFormCliente();
  await cargarTodo();
}));
$('#cancelar-cliente').addEventListener('click', resetFormCliente);

$('#tabla-clientes').addEventListener('click', intentar(async (e) => {
  const idEditar = e.target.dataset.editarCliente;
  const idBorrar = e.target.dataset.borrarCliente;
  if (idEditar) {
    const c = await api(`/api/clientes/${idEditar}`);
    const f = $('#form-cliente');
    f.id.value = c.id; f.nombre.value = c.nombre; f.email.value = c.email; f.ciudad.value = c.ciudad || '';
    marcar(f, c.objetivos);
    $('#titulo-form-cliente').textContent = `Editando ${c.id}`;
  }
  if (idBorrar && confirm(`¿Eliminar al cliente ${idBorrar} y todas sus relaciones?`)) {
    await api(`/api/clientes/${idBorrar}`, { method: 'DELETE' });
    aviso('Cliente eliminado');
    await cargarTodo();
  }
}));

// ---------- PRODUCTOS (CRUD) ----------
function pintarProductos() {
  $('#total-productos').textContent = productos.length;
  $('#tabla-productos').innerHTML = productos.map((p) => `
    <tr>
      <td>${esc(p.sku)}</td><td>${esc(p.nombre)}<br><span class="sub">${esc(p.marca || '')}</span></td>
      <td>${esc(p.categoria || '')}</td><td>${dinero(p.precio)}</td><td>${p.stock}</td>
      <td>${p.calificacion || '–'}</td>
      <td class="acciones-celda">
        <button class="mini" data-editar-producto="${esc(p.sku)}">Editar</button>
        <button class="mini borrar" data-borrar-producto="${esc(p.sku)}">Eliminar</button>
      </td>
    </tr>`).join('');
}

function resetFormProducto() {
  const f = $('#form-producto');
  f.reset(); f.editando.value = ''; f.sku.disabled = false;
  $('#titulo-form-producto').textContent = 'Nuevo producto';
}

$('#form-producto').addEventListener('submit', intentar(async (e) => {
  e.preventDefault();
  const f = e.target;
  const datos = {
    sku: f.sku.value, nombre: f.nombre.value, precio: Number(f.precio.value), stock: Number(f.stock.value),
    categoria: f.categoria.value, marca: f.marca.value, descripcion: f.descripcion.value, objetivos: marcados(f),
  };
  if (f.editando.value) {
    await api(`/api/productos/${f.editando.value}`, { method: 'PUT', body: datos });
    aviso('Producto actualizado');
  } else {
    await api('/api/productos', { method: 'POST', body: datos });
    aviso('Producto creado');
  }
  resetFormProducto();
  await cargarTodo();
}));
$('#cancelar-producto').addEventListener('click', resetFormProducto);

$('#tabla-productos').addEventListener('click', intentar(async (e) => {
  const skuEditar = e.target.dataset.editarProducto;
  const skuBorrar = e.target.dataset.borrarProducto;
  if (skuEditar) {
    const p = await api(`/api/productos/${skuEditar}`);
    const f = $('#form-producto');
    f.editando.value = p.sku; f.sku.value = p.sku; f.sku.disabled = true;
    f.nombre.value = p.nombre; f.precio.value = p.precio; f.stock.value = p.stock;
    f.categoria.value = p.categoria || ''; f.marca.value = p.marca || ''; f.descripcion.value = p.descripcion || '';
    marcar(f, p.objetivos);
    $('#titulo-form-producto').textContent = `Editando ${p.sku}`;
  }
  if (skuBorrar && confirm(`¿Eliminar el producto ${skuBorrar}?`)) {
    await api(`/api/productos/${skuBorrar}`, { method: 'DELETE' });
    aviso('Producto eliminado');
    await cargarTodo();
  }
}));

// ---------- COMPRAS, CALIFICACIONES, REFERIDOS ----------
$('#form-compra').addEventListener('submit', intentar(async (e) => {
  e.preventDefault();
  const f = e.target;
  const r = await api(`/api/clientes/${f.cliente.value}/compras`, {
    method: 'POST', body: { sku: f.sku.value, cantidad: Number(f.cantidad.value) },
  });
  aviso(`Compra registrada · stock restante: ${r.stockRestante}`);
  await cargarTodo();
  $('#sel-historial').value = f.cliente.value;
  cargarHistorial();
}));

$('#form-calificacion').addEventListener('submit', intentar(async (e) => {
  e.preventDefault();
  const f = e.target;
  await api(`/api/clientes/${f.cliente.value}/calificaciones`, {
    method: 'POST', body: { sku: f.sku.value, estrellas: Number(f.estrellas.value) },
  });
  aviso('Calificación guardada');
  await cargarTodo();
}));

$('#form-referido').addEventListener('submit', intentar(async (e) => {
  e.preventDefault();
  const f = e.target;
  const r = await api(`/api/clientes/${f.referente.value}/referidos`, { method: 'POST', body: { referidoId: f.referido.value } });
  aviso(`${r.referente} refirió a ${r.referido}`);
}));

const cargarHistorial = intentar(async () => {
  const id = $('#sel-historial').value;
  if (!id) return;
  const c = await api(`/api/clientes/${id}`);
  $('#tabla-historial').innerHTML = c.compras.length
    ? c.compras.map((k) => `
      <tr><td>${esc(k.sku)}</td><td>${esc(k.nombre)}</td><td>${k.cantidad}</td><td>${esc(k.ultimaFecha)}</td>
      <td class="acciones-celda"><button class="mini borrar" data-devolver="${esc(k.sku)}">Devolver</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="vacio">Sin compras</td></tr>';
});
$('#sel-historial').addEventListener('change', cargarHistorial);
$('#tabla-historial').addEventListener('click', intentar(async (e) => {
  const sku = e.target.dataset.devolver;
  if (!sku) return;
  const r = await api(`/api/clientes/${$('#sel-historial').value}/compras/${sku}`, { method: 'DELETE' });
  aviso(`Devueltas ${r.devueltos} unidades · stock: ${r.stockActual}`);
  await cargarTodo();
  cargarHistorial();
}));

// ---------- RECOMENDACIONES ----------
const item = (titulo, sub, score) => `<li><div>${esc(titulo)}<div class="sub">${sub}</div></div><span class="score">${score}</span></li>`;
const pintarLista = (sel, filas, fn) => ($(sel).innerHTML = filas.length ? filas.map(fn).join('') : '<li class="vacio">Sin resultados</li>');

const cargarRecoCliente = intentar(async () => {
  const id = $('#sel-reco-cliente').value;
  if (!id) return;
  const [colab, obj] = await Promise.all([
    api(`/api/recomendaciones/colaborativo/${id}?limite=5`),
    api(`/api/recomendaciones/objetivo/${id}?limite=5`),
  ]);
  pintarLista('#reco-colaborativo', colab, (r) => item(r.nombre, `${dinero(r.precio)} · porque lo compraron ${r.porque.map(esc).join(', ')}`, r.puntaje));
  pintarLista('#reco-objetivo', obj, (r) => item(r.nombre, `${dinero(r.precio)} · ${r.objetivos.map(esc).join(', ')}`, `${r.popularidad} compradores`));
});

const cargarRecoProducto = intentar(async () => {
  const sku = $('#sel-reco-producto').value;
  if (!sku) return;
  const tambien = await api(`/api/recomendaciones/tambien-compraron/${sku}?limite=5`);
  pintarLista('#reco-tambien', tambien, (r) => item(r.nombre, dinero(r.precio), `${r.clientes} clientes`));
});

const cargarRecoGlobal = intentar(async () => {
  const [juntos, infl] = await Promise.all([
    api('/api/recomendaciones/comprados-juntos?limite=5'),
    api('/api/recomendaciones/influencers?limite=5'),
  ]);
  pintarLista('#reco-juntos', juntos, (r) => item(`${r.productoA} + ${r.productoB}`, 'comprados por el mismo cliente', `${r.veces}×`));
  pintarLista('#reco-influencers', infl, (r) => item(r.nombre, `${r.directos} referidos directos`, `alcance ${r.alcance}`));
});

function cargarRecomendaciones() { cargarRecoCliente(); cargarRecoProducto(); cargarRecoGlobal(); }
$('#sel-reco-cliente').addEventListener('change', cargarRecoCliente);
$('#sel-reco-producto').addEventListener('change', cargarRecoProducto);

// ---------- GRAFO (vis-network) ----------
const COLORES = { Cliente: '#4c8dff', Producto: '#18b37e', Categoria: '#f2b84b', Marca: '#c678dd', Objetivo: '#e5534b' };
$('#leyenda').innerHTML = Object.entries(COLORES).map(([k, c]) => `<span style="--c:${c}">${k}</span>`).join('');
let red;

function dibujar({ nodos, relaciones }, resaltarCamino = false) {
  const data = {
    nodes: new vis.DataSet(nodos.map((n) => ({
      id: n.id, label: n.nombre, group: n.etiqueta,
      color: { background: COLORES[n.etiqueta] || '#888', border: '#0b0d11' },
      shape: n.etiqueta === 'Cliente' ? 'dot' : n.etiqueta === 'Producto' ? 'box' : 'ellipse',
      font: { color: n.etiqueta === 'Producto' || n.etiqueta === 'Cliente' ? '#fff' : '#111', size: 13 },
    }))),
    edges: new vis.DataSet(relaciones.map((r) => ({
      id: r.id, from: r.desde, to: r.hasta, label: r.tipo, arrows: 'to',
      font: { color: '#9aa3b2', size: 10, strokeWidth: 0 },
      color: { color: resaltarCamino ? '#18b37e' : '#3a4150' }, width: resaltarCamino ? 3 : 1,
    }))),
  };
  const opciones = {
    physics: { stabilization: true, barnesHut: { springLength: 140 } },
    nodes: { size: 16, margin: 8 },
    interaction: { hover: true },
  };
  if (red) red.destroy();
  red = new vis.Network($('#lienzo'), data, opciones);
}

$('#btn-vecindad').addEventListener('click', intentar(async () => {
  const id = $('#sel-vecindad').value;
  const g = await api(`/api/recomendaciones/vecindad/${id}?profundidad=${$('#sel-profundidad').value}`);
  $('#info-grafo').textContent = `${g.nodos.length} nodos y ${g.relaciones.length} relaciones alrededor de ${id}`;
  dibujar(g);
}));

$('#btn-camino').addEventListener('click', intentar(async () => {
  const desde = $('#sel-desde').value;
  const hasta = $('#sel-hasta').value;
  const modo = $('#sel-modo').value;
  try {
    const c = await api(`/api/recomendaciones/camino?desde=${desde}&hasta=${hasta}&modo=${modo}`);
    $('#info-grafo').textContent = `Camino de ${c.saltos} saltos: ${c.nodos.map((n) => n.nombre).join(' → ')}`;
    dibujar(c, true);
  } catch (e) {
    $('#info-grafo').textContent = e.message;
    if (red) red.destroy();
    throw e;
  }
}));

// ---------- arranque ----------
(async () => {
  try {
    const s = await api('/api/salud');
    $('#estado').textContent = `● Conectado · ${s.servidor}`;
    $('#estado').className = 'estado ok';
  } catch (e) {
    $('#estado').textContent = `● Sin conexión: ${e.message}`;
    $('#estado').className = 'estado error';
    return;
  }
  await intentar(cargarTodo)();
})();
