import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm'
import { getCurrentUser, supabase } from './supabase-client.js'
import { escapeHtml, formatDate, formatMovementUnit, formatProductSelectOption, formatProductStock, friendlyError, getProductPresentation, localDateInputValue, setTableState, showToast } from './ui-utils.js?v=20260826-presentation-2'

let productosDisponibles = []

window.addEventListener('DOMContentLoaded', initializeMovements)

async function initializeMovements() {
  try {
    await Promise.all([cargarProductos(), cargarMovimientos()])
    document.getElementById('salidaFecha').value = localDateInputValue()
    document.getElementById('entradaFecha').value = localDateInputValue()
    document.getElementById('entradaProducto')?.addEventListener('change', actualizarResumenEntrada)
    document.getElementById('salidaProducto')?.addEventListener('change', actualizarEtiquetasSalida)
    document.getElementById('movementProduct')?.addEventListener('change', actualizarEtiquetasMovimiento)
    document.getElementById('registrarEntradaBtn')?.addEventListener('click', registrarEntrada)
    document.getElementById('registrarSalidaBtn')?.addEventListener('click', registrarSalida)
    document.getElementById('saveMovementBtn')?.addEventListener('click', guardarMovimiento)
    document.getElementById('updateMovementBtn')?.addEventListener('click', actualizarMovimiento)
    document.getElementById('confirmarDevolucionBtn')?.addEventListener('click', confirmarDevolucion)
    document.getElementById('movementsTableBody')?.addEventListener('click', manejarAccionMovimiento)
  } catch (error) {
    console.error('Error inicial:', error)
    showToast(Swal, 'No se pudo cargar el módulo de movimientos: ' + friendlyError(error), 'error')
  }
}

async function cargarProductos() {
  const presentationFields = 'id, nombre, cantidad, tipo_presentacion, piezas_por_caja, proveedor_id, proveedores:proveedor_id(id, nombre)'
  let response = await supabase.from('productos').select(presentationFields).order('nombre')
  if (response.error && /tipo_presentacion|piezas_por_caja|column/i.test(response.error.message || '')) {
    response = await supabase.from('productos').select('id, nombre, cantidad, proveedor_id, proveedores:proveedor_id(id, nombre)').order('nombre')
  }
  if (response.error) throw response.error
  productosDisponibles = response.data || []

  const selects = ['salidaProducto', 'entradaProducto', 'movementProduct', 'editMovementProduct']
  selects.forEach(id => {
    const select = document.getElementById(id)
    if (!select) return
    select.innerHTML = '<option value="">Seleccionar producto</option>'
    productosDisponibles.forEach(producto => {
      const option = new Option(formatProductSelectOption(producto), producto.id)
      select.add(option)
    })
  })
  actualizarResumenEntrada()
  actualizarEtiquetasSalida()
  actualizarEtiquetasMovimiento()
}

function actualizarResumenEntrada() {
  const select = document.getElementById('entradaProducto')
  const summary = document.getElementById('entradaResumen')
  if (!select || !summary) return

  const producto = productosDisponibles.find(item => String(item.id) === String(select.value))
  if (!producto) {
    summary.className = 'movement-entry-summary'
    summary.innerHTML = '<i class="fas fa-circle-info me-2" aria-hidden="true"></i><span>Selecciona un producto para consultar su existencia actual.</span>'
    actualizarEtiquetaEntrada(null)
    actualizarCampoProveedor(null)
    return
  }

  const presentation = getProductPresentation(producto)
  summary.className = 'movement-entry-summary is-selected'
  summary.innerHTML = `<i class="fas fa-boxes-stacked me-2" aria-hidden="true"></i><span><strong>${escapeHtml(producto.nombre)}</strong> tiene actualmente <strong>${escapeHtml(formatProductStock(producto))}</strong>. La nueva entrada se sumará como ${presentation.type === 'caja' ? 'cajas completas' : 'piezas individuales'}.</span>`
  actualizarEtiquetaEntrada(producto)
  actualizarCampoProveedor(producto)
}

function actualizarCampoProveedor(producto) {
  const input = document.getElementById('entradaProveedor')
  if (!input) return
  const proveedorNombre = producto?.proveedores?.nombre || ''
  input.value = proveedorNombre
  input.placeholder = proveedorNombre ? '' : 'El producto no tiene proveedor registrado'
}

function actualizarEtiquetaEntrada(producto) {
  const label = document.getElementById('entradaCantidadLabel')
  const hint = document.getElementById('entradaUnidadHint')
  const input = document.getElementById('entradaCantidad')
  if (!label || !hint || !input) return
  const isBox = producto?.tipo_presentacion === 'caja'
  label.textContent = isBox ? 'Cantidad de cajas recibidas' : 'Cantidad de piezas recibidas'
  hint.textContent = isBox
    ? `Cada caja contiene ${getProductPresentation(producto).piecesPerBox} piezas. Captura cuántas cajas completas recibiste.`
    : 'Captura cuántas piezas individuales recibiste.'
  input.placeholder = isBox ? 'Ej. 5 cajas' : 'Ej. 10 piezas'
}

function actualizarEtiquetasMovimiento() {
  const select = document.getElementById('movementProduct')
  const label = document.getElementById('movementQuantityLabel')
  const hint = document.getElementById('movementUnitHint')
  if (!select || !label || !hint) return
  const producto = productosDisponibles.find(item => String(item.id) === String(select.value))
  const isBox = producto?.tipo_presentacion === 'caja'
  label.textContent = isBox ? 'Cantidad de cajas' : 'Cantidad de piezas'
  hint.textContent = producto
    ? isBox ? `La caja contiene ${getProductPresentation(producto).piecesPerBox} piezas.` : 'El movimiento se registrará por piezas individuales.'
    : 'La cantidad se registrará según la presentación del producto.'
}

function actualizarEtiquetasSalida() {
  const select = document.getElementById('salidaProducto')
  const label = document.getElementById('salidaCantidadLabel')
  const hint = document.getElementById('salidaUnidadHint')
  if (!select || !label || !hint) return
  const producto = productosDisponibles.find(item => String(item.id) === String(select.value))
  const isBox = producto?.tipo_presentacion === 'caja'
  label.textContent = isBox ? 'Cantidad de cajas a entregar' : 'Cantidad de piezas a entregar'
  hint.textContent = producto
    ? isBox ? `Cada caja contiene ${getProductPresentation(producto).piecesPerBox} piezas.` : 'La salida se descontará por piezas individuales.'
    : 'Selecciona un producto para conocer la unidad.'
}

async function cargarMovimientos() {
  let response = await supabase
    .from('movimientos')
    .select('id, tipo, cantidad, motivo, destinatario, proveedor, created_at, producto_id, usuario_id, productos:producto_id(id, nombre, tipo_presentacion, piezas_por_caja)')
    .order('created_at', { ascending: false })
  if (response.error && /tipo_presentacion|piezas_por_caja/i.test(response.error.message || '')) {
    response = await supabase
      .from('movimientos')
      .select('id, tipo, cantidad, motivo, destinatario, proveedor, created_at, producto_id, usuario_id, productos:producto_id(id, nombre)')
      .order('created_at', { ascending: false })
  }
  const {  movimientos, error } = response
  if (error) throw error

  const tableBody = document.getElementById('movementsTableBody')
  if (!tableBody) return
  if (!movimientos?.length) {
    setTableState(tableBody, 8, 'No hay movimientos registrados.')
    return
  }

  tableBody.innerHTML = movimientos.map(movimiento => `
    <tr>
      <td>${escapeHtml(movimiento.id)}</td>
      <td>${escapeHtml(movimiento.productos?.nombre || 'Producto eliminado')}</td>
      <td><span class="badge ${getBadgeClass(movimiento.tipo)}">${escapeHtml(capitalizar(movimiento.tipo))}</span></td>
        <td>${Number(movimiento.cantidad) || 0} ${formatMovementUnit(movimiento.productos || {}, movimiento.cantidad)}</td>
      <td>${escapeHtml(movimiento.motivo || '-')}</td>
      <td>${escapeHtml(movimiento.destinatario || '-')}</td>
      <td>${escapeHtml(movimiento.proveedor || '-')}</td>
      <td>${escapeHtml(movimiento.usuario_id ? `${movimiento.usuario_id.slice(0, 8)}…` : 'Sistema')}</td>
      <td>${formatDate(movimiento.created_at, true)}</td>
    </tr>
  `).join('')
}

function capitalizar(texto = '') {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function getBadgeClass(tipo) {
  if (tipo === 'entrada') return 'bg-success'
  if (tipo === 'salida') return 'bg-danger'
  if (tipo === 'ajuste') return 'bg-warning text-dark'
  return 'bg-secondary'
}

async function registrarSalida() {
  const form = document.getElementById('salidaForm')
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  const productoId = document.getElementById('salidaProducto').value
  const cantidad = Number.parseInt(document.getElementById('salidaCantidad').value, 10)
  const destinatario = document.getElementById('salidaDestinatario').value.trim()
  const motivo = document.getElementById('salidaMotivo').value.trim()
  const fecha = document.getElementById('salidaFecha').value

  if (!productoId || !Number.isInteger(cantidad) || cantidad <= 0) return showToast(Swal, 'La cantidad debe ser un entero mayor que cero.', 'error')
  if (!destinatario) return showToast(Swal, 'El destinatario es requerido.', 'error')

  await registrarMovimientoConStock({
    productoId,
    tipo: 'salida',
    cantidad,
    motivo,
    destinatario,
    createdAt: fecha ? `${fecha}T12:00:00` : undefined,
    onSuccess: async () => {
      showToast(Swal, 'Salida registrada correctamente.', 'success')
      form.reset()
      form.classList.remove('was-validated')
      document.getElementById('salidaFecha').value = localDateInputValue()
      await Promise.all([cargarProductos(), cargarMovimientos()])
    }
  })
}

async function registrarEntrada() {
  const form = document.getElementById('entradaForm')
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    form.reportValidity()
    return
  }

  const productoId = document.getElementById('entradaProducto').value
  const cantidad = Number.parseInt(document.getElementById('entradaCantidad').value, 10)
  const motivo = document.getElementById('entradaMotivo').value.trim()
  const proveedor = document.getElementById('entradaProveedor').value.trim() || null
  const producto = productosDisponibles.find(item => String(item.id) === String(productoId))
  const fecha = document.getElementById('entradaFecha').value

  if (!productoId || !producto || !Number.isInteger(cantidad) || cantidad <= 0) {
    return showToast(Swal, 'Selecciona un producto y captura una cantidad entera mayor que cero.', 'error')
  }

  await registrarMovimientoConStock({
    productoId,
    tipo: 'entrada',
    cantidad,
    motivo: motivo || 'Entrada de inventario',
    proveedor,
    createdAt: fecha ? `${fecha}T12:00:00` : undefined,
    onSuccess: async () => {
      await showToast(Swal, `Entrada registrada: ${cantidad} ${formatMovementUnit(producto, cantidad)} de ${producto.nombre}. El stock fue actualizado.`, 'success')
      form.reset()
      form.classList.remove('was-validated')
      document.getElementById('entradaFecha').value = localDateInputValue()
      actualizarResumenEntrada()
      await Promise.all([cargarProductos(), cargarMovimientos()])
    }
  })
}

async function guardarMovimiento() {
  const form = document.getElementById('movementForm')
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  const productoId = document.getElementById('movementProduct').value
  const tipo = document.getElementById('movementType').value
  const cantidad = Number.parseInt(document.getElementById('movementQuantity').value, 10)
  const motivo = document.getElementById('movementReason').value.trim()
  const producto = productosDisponibles.find(item => String(item.id) === String(productoId))

  if (!productoId || !producto || !['entrada', 'salida', 'ajuste'].includes(tipo) || !Number.isInteger(cantidad) || cantidad <= 0) {
    return showToast(Swal, 'Completa correctamente el producto, tipo y cantidad.', 'error')
  }

  await registrarMovimientoConStock({
    productoId,
    tipo,
    cantidad,
    motivo,
    onSuccess: async () => {
      showToast(Swal, `Movimiento registrado: ${cantidad} ${formatMovementUnit(producto, cantidad)}.`, 'success')
      bootstrap.Modal.getInstance(document.getElementById('addMovementModal'))?.hide()
      form.reset()
      form.classList.remove('was-validated')
      await Promise.all([cargarProductos(), cargarMovimientos()])
    }
  })
}

async function registrarMovimientoConStock({ productoId, tipo, cantidad, motivo, destinatario = null, proveedor = null, createdAt, onSuccess }) {
  Swal.fire({ title: 'Guardando movimiento...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
  let producto
  let updatedQuantity
  try {
    const { data, error: productError } = await supabase.from('productos').select('id, nombre, cantidad').eq('id', productoId).single()
    if (productError) throw productError
    producto = data

    const currentQuantity = Number(producto.cantidad) || 0
    const delta = tipo === 'salida' ? -cantidad : cantidad
    updatedQuantity = currentQuantity + delta
    if (updatedQuantity < 0) throw new Error(`Stock insuficiente. Disponible: ${currentQuantity}`)

    const {  updated, error: updateError } = await supabase
      .from('productos')
      .update({ cantidad: updatedQuantity })
      .eq('id', productoId)
      .eq('cantidad', currentQuantity)
      .select('id, cantidad')
      .single()
    if (updateError || !updated) throw updateError || new Error('El stock cambió mientras se guardaba. Intenta nuevamente.')

    const user = await getCurrentUser().catch(() => null)
    const { error: movementError } = await supabase.from('movimientos').insert({
      producto_id: productoId,
      tipo,
      cantidad,
      motivo: motivo || null,
      destinatario,
      proveedor,
      usuario_id: user?.id || null,
      ...(createdAt ? { created_at: createdAt } : {})
    })
    if (movementError) {
      await supabase.from('productos').update({ cantidad: currentQuantity }).eq('id', productoId).eq('cantidad', updatedQuantity)
      throw movementError
    }

    Swal.close()
    await onSuccess?.()
  } catch (error) {
    Swal.close()
    console.error('Error registrando movimiento:', error)
    showToast(Swal, friendlyError(error), 'error')
  }
}

async function actualizarMovimiento() {
  const form = document.getElementById('editMovementForm')
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }
  const movementId = document.getElementById('editMovementId').value
  if (!movementId) return showToast(Swal, 'No se encontró el movimiento a editar.', 'error')
  showToast(Swal, 'La edición de movimientos existentes requiere recalcular el stock y quedará habilitada en la siguiente versión.', 'info')
}

async function confirmarDevolucion() {
  const movementId = document.getElementById('devolucionMovimientoId').value
  const cantidad = Number.parseInt(document.getElementById('devolucionCantidad').value, 10)
  const motivo = document.getElementById('devolucionMotivo').value.trim()
  if (!movementId || !Number.isInteger(cantidad) || cantidad <= 0 || !motivo) {
    return showToast(Swal, 'Completa la cantidad y el motivo de devolución.', 'error')
  }
  showToast(Swal, 'La devolución se debe vincular a un movimiento de salida para mantener la trazabilidad; esta acción quedará habilitada al completar ese flujo.', 'info')
}

function manejarAccionMovimiento(event) {
  const actionButton = event.target.closest('[data-action]')
  if (!actionButton) return
  showToast(Swal, `Acción ${actionButton.dataset.action} disponible próximamente.`, 'info')
}

window.cargarMovimientos = cargarMovimientos
window.registrarSalida = registrarSalida
window.registrarEntrada = registrarEntrada
