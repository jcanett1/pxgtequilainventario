import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm'
import { getCurrentUser, supabase } from './supabase-client.js'
import { escapeHtml, formatCurrency, formatDate, friendlyError, setTableState, showToast } from './ui-utils.js'

let productoEditando = null

window.addEventListener('DOMContentLoaded', initializeProducts)

async function initializeProducts() {
  try {
    await Promise.all([cargarProductos(), cargarCategorias(), cargarProveedores()])
    document.getElementById('saveProductBtn')?.addEventListener('click', guardarProducto)
    document.getElementById('addStockBtn')?.addEventListener('click', agregarStockExistente)
    document.getElementById('productosTableBody')?.addEventListener('click', handleProductAction)
    document.getElementById('productEntryDate').value = new Date().toISOString().split('T')[0]
    document.getElementById('addProductModal')?.addEventListener('hidden.bs.modal', resetFormularioProducto)
  } catch (error) {
    console.error('Error inicial:', error)
    mostrarError('No se pudo cargar el módulo de productos: ' + friendlyError(error))
  }
}

async function cargarProductos() {
  const { data: productos, error } = await supabase
    .from('productos')
    .select(`id, nombre, precio, cantidad, descripcion, ubicacion, fecha_ingreso, codigo_barras, categoria_id, proveedor_id, categorias:categoria_id(id, nombre), proveedores:proveedor_id(id, nombre)`)
    .order('nombre', { ascending: true })

  if (error) throw error

  const tbody = document.getElementById('productosTableBody')
  if (!tbody) return
  if (!productos?.length) {
    setTableState(tbody, 8, 'No hay productos registrados. Agrega tu primer producto.')
  } else {
    tbody.innerHTML = productos.map(producto => `
      <tr>
        <td><strong>${escapeHtml(producto.nombre)}</strong>${producto.codigo_barras ? `<small class="d-block text-muted">${escapeHtml(producto.codigo_barras)}</small>` : ''}</td>
        <td>${escapeHtml(producto.categorias?.nombre || 'Sin categoría')}</td>
        <td>${formatCurrency(producto.precio)}</td>
        <td><span class="badge ${getStockBadge(producto.cantidad)}">${Number(producto.cantidad) || 0}</span></td>
        <td>${escapeHtml(producto.proveedores?.nombre || 'Sin proveedor')}</td>
        <td>${formatDate(producto.fecha_ingreso)}</td>
        <td>${escapeHtml(producto.ubicacion || 'Sin ubicación')}</td>
        <td class="action-buttons text-nowrap">
          <button class="btn btn-sm btn-info" data-action="edit" data-id="${producto.id}" title="Editar"><i class="fas fa-edit" aria-hidden="true"></i><span class="visually-hidden">Editar</span></button>
          <button class="btn btn-sm btn-success" data-action="stock" data-id="${producto.id}" title="Ajustar stock"><i class="fas fa-plus-minus" aria-hidden="true"></i><span class="visually-hidden">Ajustar stock</span></button>
          <button class="btn btn-sm btn-secondary" data-action="history" data-id="${producto.id}" title="Ver historial"><i class="fas fa-history" aria-hidden="true"></i><span class="visually-hidden">Ver historial</span></button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${producto.id}" title="Eliminar"><i class="fas fa-trash" aria-hidden="true"></i><span class="visually-hidden">Eliminar</span></button>
        </td>
      </tr>
    `).join('')
  }

  const selectProductos = document.getElementById('existingProduct')
  if (selectProductos) {
    selectProductos.innerHTML = '<option value="">Seleccionar producto</option>'
    ;(productos || []).forEach(producto => {
      const option = document.createElement('option')
      option.value = producto.id
      option.textContent = `${producto.nombre} (${Number(producto.cantidad) || 0} en stock)`
      selectProductos.appendChild(option)
    })
  }
}

function getStockBadge(cantidad) {
  const value = Number(cantidad) || 0
  if (value <= 5) return 'bg-danger'
  if (value <= 15) return 'bg-warning text-dark'
  return 'bg-success'
}

async function cargarCategorias() {
  const { data: categorias, error } = await supabase.from('categorias').select('id, nombre').order('nombre')
  if (error) throw error
  document.querySelectorAll('.select-categoria').forEach(select => {
    select.innerHTML = '<option value="">Seleccionar categoría</option>'
    ;(categorias || []).forEach(categoria => {
      const option = document.createElement('option')
      option.value = categoria.id
      option.textContent = categoria.nombre
      select.appendChild(option)
    })
  })
}

async function cargarProveedores() {
  const { data: proveedores, error } = await supabase.from('proveedores').select('id, nombre').order('nombre')
  if (error) throw error
  document.querySelectorAll('.select-proveedor').forEach(select => {
    select.innerHTML = '<option value="">Seleccionar proveedor</option>'
    ;(proveedores || []).forEach(proveedor => {
      const option = document.createElement('option')
      option.value = proveedor.id
      option.textContent = proveedor.nombre
      select.appendChild(option)
    })
  })
}

async function guardarProducto() {
  const form = document.getElementById('addProductForm')
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  const producto = {
    nombre: document.getElementById('productName').value.trim(),
    categoria_id: document.getElementById('productCategory').value || null,
    precio: Number(document.getElementById('productPrice').value),
    cantidad: Number.parseInt(document.getElementById('productQuantity').value, 10) || 0,
    descripcion: document.getElementById('productDescription').value.trim() || null,
    proveedor_id: document.getElementById('productSupplier').value || null,
    ubicacion: document.getElementById('productLocation').value.trim() || null,
    fecha_ingreso: document.getElementById('productEntryDate').value
  }

  if (!producto.nombre) return mostrarError('El nombre del producto es requerido')
  if (!Number.isFinite(producto.precio) || producto.precio <= 0) return mostrarError('El precio debe ser mayor que cero')
  if (producto.cantidad < 0) return mostrarError('La cantidad no puede ser negativa')

  let loading
  try {
    loading = Swal.fire({ title: productoEditando ? 'Actualizando producto...' : 'Guardando producto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    let result
    if (productoEditando) {
      const { data, error } = await supabase.from('productos').update(producto).eq('id', productoEditando.id).select().single()
      if (error) throw error
      result = data
      if (Number(productoEditando.precio) !== producto.precio) {
        const user = await getCurrentUser().catch(() => null)
        const { error: historyError } = await supabase.from('historial_precios').insert({
          producto_id: productoEditando.id,
          precio_anterior: productoEditando.precio,
          precio_nuevo: producto.precio,
          usuario_id: user?.id || null
        })
        if (historyError) console.warn('No se pudo registrar historial de precio:', historyError)
      }
    } else {
      const { data, error } = await supabase.from('productos').insert(producto).select().single()
      if (error) throw error
      result = data
    }

    Swal.close()
    await mostrarExito(`Producto "${result.nombre}" ${productoEditando ? 'actualizado' : 'guardado'} correctamente`)
    bootstrap.Modal.getInstance(document.getElementById('addProductModal'))?.hide()
    resetFormularioProducto()
    await cargarProductos()
  } catch (error) {
    Swal.close()
    console.error('Error guardando producto:', error)
    mostrarError(friendlyError(error), 'Error al guardar')
  }
}

async function agregarStockExistente() {
  const form = document.getElementById('addStockForm')
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  const productoId = document.getElementById('existingProduct').value
  const cantidad = Number.parseInt(document.getElementById('additionalStock').value, 10)
  if (!productoId) return mostrarError('Debe seleccionar un producto')
  if (!Number.isInteger(cantidad) || cantidad <= 0) return mostrarError('La cantidad debe ser mayor que cero')

  let loading
  try {
    loading = Swal.fire({ title: 'Actualizando stock...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
    const { data: producto, error: fetchError } = await supabase.from('productos').select('id, cantidad, nombre').eq('id', productoId).single()
    if (fetchError) throw fetchError

    const currentQuantity = Number(producto.cantidad) || 0
    const { error: updateError } = await supabase.from('productos')
      .update({ cantidad: currentQuantity + cantidad })
      .eq('id', productoId)
      .eq('cantidad', currentQuantity)
    if (updateError) throw updateError

    try {
      await registrarMovimiento(productoId, 'entrada', cantidad, 'Ajuste manual de inventario')
    } catch (movementError) {
      await supabase.from('productos').update({ cantidad: currentQuantity }).eq('id', productoId).eq('cantidad', currentQuantity + cantidad)
      throw movementError
    }

    Swal.close()
    await mostrarExito(`Se agregaron ${cantidad} unidades a "${producto.nombre}"`)
    bootstrap.Modal.getInstance(document.getElementById('addExistingModal'))?.hide()
    form.reset()
    form.classList.remove('was-validated')
    await cargarProductos()
  } catch (error) {
    Swal.close()
    console.error('Error actualizando stock:', error)
    mostrarError(friendlyError(error), 'Error al actualizar stock')
  }
}

async function registrarMovimiento(productoId, tipo, cantidad, motivo) {
  const user = await getCurrentUser().catch(() => null)
  const { error } = await supabase.from('movimientos').insert({ producto_id: productoId, tipo, cantidad, motivo, usuario_id: user?.id || null })
  if (error) throw error
}

function resetFormularioProducto() {
  const form = document.getElementById('addProductForm')
  if (!form) return
  form.reset()
  form.classList.remove('was-validated')
  productoEditando = null
  document.getElementById('addProductModalLabel').textContent = 'Agregar Nuevo Producto'
  document.getElementById('saveProductBtn').textContent = 'Guardar Producto'
  document.getElementById('productEntryDate').value = new Date().toISOString().split('T')[0]
}

async function handleProductAction(event) {
  const button = event.target.closest('button[data-action]')
  if (!button) return
  const id = Number(button.dataset.id)
  if (!Number.isInteger(id)) return
  if (button.dataset.action === 'edit') await editarProducto(id)
  if (button.dataset.action === 'stock') await mostrarModalAjuste(id)
  if (button.dataset.action === 'history') await verHistorial(id)
  if (button.dataset.action === 'delete') await eliminarProducto(id)
}

async function editarProducto(id) {
  try {
    const { data: producto, error } = await supabase.from('productos').select('*').eq('id', id).single()
    if (error) throw error
    productoEditando = producto
    document.getElementById('productName').value = producto.nombre || ''
    document.getElementById('productCategory').value = producto.categoria_id || ''
    document.getElementById('productPrice').value = producto.precio ?? ''
    document.getElementById('productQuantity').value = producto.cantidad ?? 0
    document.getElementById('productDescription').value = producto.descripcion || ''
    document.getElementById('productSupplier').value = producto.proveedor_id || ''
    document.getElementById('productLocation').value = producto.ubicacion || ''
    document.getElementById('productEntryDate').value = producto.fecha_ingreso || ''
    document.getElementById('addProductModalLabel').textContent = 'Editar Producto'
    document.getElementById('saveProductBtn').textContent = 'Actualizar Producto'
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addProductModal')).show()
  } catch (error) {
    mostrarError(friendlyError(error), 'No se pudo cargar el producto')
  }
}

async function mostrarModalAjuste(id) {
  const select = document.getElementById('existingProduct')
  if (select) select.value = String(id)
  bootstrap.Modal.getOrCreateInstance(document.getElementById('addExistingModal')).show()
}

async function eliminarProducto(id) {
  const { data: producto, error: productError } = await supabase.from('productos').select('nombre').eq('id', id).single()
  if (productError) return mostrarError(friendlyError(productError))
  const result = await Swal.fire({
    title: '¿Eliminar producto?',
    html: `¿Estás seguro de eliminar <strong>${escapeHtml(producto.nombre)}</strong>?<br>Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc3545',
    cancelButtonText: 'Cancelar',
    confirmButtonText: 'Sí, eliminar'
  })
  if (!result.isConfirmed) return

  try {
    const { error } = await supabase.from('productos').delete().eq('id', id)
    if (error) throw error
    await mostrarExito(`Producto "${producto.nombre}" eliminado correctamente`)
    await cargarProductos()
  } catch (error) {
    mostrarError(friendlyError(error), 'No se pudo eliminar el producto')
  }
}

async function verHistorial(id) {
  try {
    const { data: producto, error: productError } = await supabase.from('productos').select('nombre').eq('id', id).single()
    if (productError) throw productError
    const { data: movimientos, error } = await supabase.from('movimientos').select('created_at, tipo, cantidad, motivo, destinatario, usuario_id').eq('producto_id', id).order('created_at', { ascending: false })
    if (error) throw error

    const rows = (movimientos || []).map(mov => `
      <tr>
        <td>${formatDate(mov.created_at, true)}</td>
        <td><span class="badge ${mov.tipo === 'entrada' ? 'bg-success' : mov.tipo === 'salida' ? 'bg-danger' : 'bg-warning text-dark'}">${escapeHtml(mov.tipo || 'ajuste')}</span></td>
        <td>${Number(mov.cantidad) || 0}</td>
        <td>${escapeHtml(mov.motivo || '-')}</td>
        <td>${escapeHtml(mov.destinatario || '-')}</td>
      </tr>`).join('')

    await Swal.fire({
      title: `Historial: ${escapeHtml(producto.nombre)}`,
      html: rows ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Destinatario</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="text-muted">No hay movimientos registrados para este producto.</p>',
      width: 900,
      confirmButtonText: 'Cerrar'
    })
  } catch (error) {
    mostrarError(friendlyError(error), 'No se pudo obtener el historial')
  }
}

function mostrarError(message, title = 'Error') {
  return Swal.fire({ icon: 'error', title, text: message })
}

function mostrarExito(message) {
  return Swal.fire({ icon: 'success', title: 'Éxito', text: message, timer: 2200, showConfirmButton: false })
}

// Compatibilidad con enlaces o personalizaciones antiguas.
window.editarProducto = editarProducto
window.mostrarModalAjuste = mostrarModalAjuste
window.verHistorial = verHistorial
window.eliminarProducto = eliminarProducto
