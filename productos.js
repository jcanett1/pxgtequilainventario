import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Variables globales
let productoEditando = null

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Verificar conexión con Supabase
    const { data, error } = await supabase
      .from('productos')
      .select('id')
      .limit(1)
      
    if (error) throw error
    
    // Cargar datos iniciales
    await Promise.all([
      cargarProductos(),
      cargarCategorias(),
      cargarProveedores()
    ])
    
    // Configurar event listeners
    document.getElementById('saveProductBtn').addEventListener('click', guardarProducto)
    document.getElementById('addStockBtn').addEventListener('click', agregarStockExistente)
    
    // Inicializar tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
    
    // Configurar fecha por defecto en el modal
    document.getElementById('productEntryDate').value = new Date().toISOString().split('T')[0]
    
  } catch (error) {
    console.error('Error inicial:', error)
    mostrarError('Error al conectar con la base de datos. Por favor recargue la página.')
  }
})

// ========== FUNCIONES PRINCIPALES ==========

// Cargar productos en la tabla
async function cargarProductos() {
  try {
    const { data: productos, error } = await supabase
      .from('productos')
      .select(`
        id,
        nombre,
        precio,
        cantidad,
        descripcion,
        ubicacion,
        fecha_ingreso,
        codigo_barras,
        categorias: categoria_id (id, nombre),
        proveedores: proveedor_id (id, nombre)
      `)
      .order('nombre', { ascending: true })

    if (error) throw error

    const tbody = document.getElementById('productosTableBody')
    tbody.innerHTML = ''

    if (productos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted py-4">
            No hay productos registrados. Agrega tu primer producto.
          </td>
        </tr>
      `
      return
    }

    productos.forEach(producto => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td>${producto.nombre}</td>
        <td>${producto.categorias?.nombre || 'N/A'}</td>
        <td>$${producto.precio.toFixed(2)}</td>
        <td>${producto.cantidad}</td>
        <td>${producto.proveedores?.nombre || 'N/A'}</td>
        <td>${formatearFecha(producto.fecha_ingreso)}</td>
        <td>${producto.ubicacion || 'N/A'}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-info" data-bs-toggle="tooltip" title="Editar" onclick="editarProducto(${producto.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-success" data-bs-toggle="tooltip" title="Ajustar stock" 
            onclick="mostrarModalAjuste(${producto.id}, '${producto.nombre}')">
            <i class="fas fa-plus-minus"></i>
          </button>
          <button class="btn btn-sm btn-secondary" data-bs-toggle="tooltip" title="Ver historial" 
            onclick="verHistorial(${producto.id}, '${producto.nombre}')">
            <i class="fas fa-history"></i>
          </button>
          <button class="btn btn-sm btn-danger" data-bs-toggle="tooltip" title="Eliminar" 
            onclick="eliminarProducto(${producto.id}, '${producto.nombre.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `
      tbody.appendChild(tr)
    })

    // Actualizar opciones del modal "Agregar Existente"
    const selectProductos = document.getElementById('existingProduct')
    selectProductos.innerHTML = '<option value="">Seleccionar producto</option>'
    productos.forEach(producto => {
      const option = document.createElement('option')
      option.value = producto.id
      option.textContent = `${producto.nombre} (${producto.cantidad} en stock)`
      selectProductos.appendChild(option)
    })

  } catch (error) {
    console.error('Error cargando productos:', error)
    mostrarError('No se pudieron cargar los productos. Por favor recargue la página.')
  }
}

// Cargar categorías en los selects
async function cargarCategorias() {
  try {
    const { data: categorias, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error

    const selects = document.querySelectorAll('.select-categoria')
    selects.forEach(select => {
      select.innerHTML = '<option value="">Seleccionar categoría</option>'
      categorias.forEach(categoria => {
        const option = document.createElement('option')
        option.value = categoria.id
        option.textContent = categoria.nombre
        select.appendChild(option)
      })
    })

  } catch (error) {
    console.error('Error cargando categorías:', error)
    mostrarError('No se pudieron cargar las categorías', 'error')
  }
}

// Cargar proveedores en los selects
async function cargarProveedores() {
  try {
    const { data: proveedores, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error

    const selects = document.querySelectorAll('.select-proveedor')
    selects.forEach(select => {
      select.innerHTML = '<option value="">Seleccionar proveedor</option>'
      proveedores.forEach(proveedor => {
        const option = document.createElement('option')
        option.value = proveedor.id
        option.textContent = proveedor.nombre
        select.appendChild(option)
      })
    })

  } catch (error) {
    console.error('Error cargando proveedores:', error)
    mostrarError('No se pudieron cargar los proveedores', 'error')
  }
}

// Guardar producto (nuevo o edición)
async function guardarProducto() {
  const form = document.getElementById('addProductForm')
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  try {
    const producto = {
      nombre: document.getElementById('productName').value.trim(),
      categoria_id: document.getElementById('productCategory').value || null,
      precio: parseFloat(document.getElementById('productPrice').value),
      cantidad: parseInt(document.getElementById('productQuantity').value) || 0,
      descripcion: document.getElementById('productDescription').value.trim(),
      proveedor_id: document.getElementById('productSupplier').value || null,
      ubicacion: document.getElementById('productLocation').value.trim(),
      fecha_ingreso: document.getElementById('productEntryDate').value
    }

    // Validaciones adicionales
    if (producto.precio <= 0) throw new Error('El precio debe ser mayor que cero')
    if (producto.cantidad < 0) throw new Error('La cantidad no puede ser negativa')
    if (!producto.nombre) throw new Error('El nombre del producto es requerido')

    const loading = mostrarLoading('Guardando producto...')

    let result
    if (productoEditando) {
      // Editar producto existente
      const { data, error } = await supabase
        .from('productos')
        .update(producto)
        .eq('id', productoEditando.id)
        .select()
      
      if (error) throw error
      result = data[0]
    } else {
      // Crear nuevo producto
      const { data, error } = await supabase
        .from('productos')
        .insert([producto])
        .select()
      
      if (error) throw error
      result = data[0]
    }

    loading.close()
    
    mostrarExito(`Producto "${result.nombre}" ${productoEditando ? 'actualizado' : 'guardado'} correctamente`)
    
    // Cerrar modal y recargar datos
    const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'))
    modal.hide()
    resetFormularioProducto()
    await cargarProductos()

  } catch (error) {
    console.error('Error guardando producto:', error)
    mostrarError(obtenerMensajeError(error), 'Error al guardar')
  }
}

// Agregar stock a producto existente
async function agregarStockExistente() {
  const form = document.getElementById('addStockForm')
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  try {
    const productoId = document.getElementById('existingProduct').value
    const cantidad = parseInt(document.getElementById('additionalStock').value)
    
    if (!productoId) throw new Error('Debe seleccionar un producto')
    if (cantidad <= 0) throw new Error('La cantidad debe ser mayor que cero')

    const loading = mostrarLoading('Actualizando stock...')

    // Obtener cantidad actual
    const { data: producto, error: fetchError } = await supabase
      .from('productos')
      .select('cantidad, nombre')
      .eq('id', productoId)
      .single()

    if (fetchError) throw fetchError

    // Actualizar cantidad
    const { error } = await supabase
      .from('productos')
      .update({ cantidad: producto.cantidad + cantidad })
      .eq('id', productoId)

    if (error) throw error

    // Registrar movimiento
    await registrarMovimiento(productoId, 'entrada', cantidad, 'Ajuste manual de inventario')

    loading.close()
    
    mostrarExito(`Se agregaron ${cantidad} unidades al producto "${producto.nombre}"`)
    
    // Cerrar modal y recargar datos
    const modal = bootstrap.Modal.getInstance(document.getElementById('addExistingModal'))
    modal.hide()
    form.reset()
    form.classList.remove('was-validated')
    await cargarProductos()

  } catch (error) {
    console.error('Error actualizando stock:', error)
    mostrarError(obtenerMensajeError(error), 'Error al actualizar stock')
  }
}

// ========== FUNCIONES SECUNDARIAS ==========

// Registrar movimiento de inventario
async function registrarMovimiento(productoId, tipo, cantidad, motivo) {
  try {
    const { error } = await supabase
      .from('movimientos')
      .insert([{
        producto_id: productoId,
        tipo,
        cantidad,
        motivo,
        usuario_id: (await supabase.auth.getUser()).data.user?.id || null
      }])

    if (error) throw error

  } catch (error) {
    console.error('Error registrando movimiento:', error)
    throw new Error('No se pudo registrar el movimiento')
  }
}

// Resetear formulario de producto
function resetFormularioProducto() {
  const form = document.getElementById('addProductForm')
  form.reset()
  form.classList.remove('was-validated')
  productoEditando = null
  document.getElementById('addProductModalLabel').textContent = 'Agregar Nuevo Producto'
  document.getElementById('saveProductBtn').textContent = 'Guardar Producto'
  document.getElementById('productEntryDate').value = new Date().toISOString().split('T')[0]
}

// Formatear fecha para visualización
function formatearFecha(fecha) {
  if (!fecha) return 'N/A'
  return new Date(fecha).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Mostrar loading
function mostrarLoading(titulo) {
  return Swal.fire({
    title: titulo,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  })
}

// Mostrar mensaje de éxito
function mostrarExito(mensaje) {
  return Swal.fire({
    icon: 'success',
    title: 'Éxito',
    text: mensaje,
    timer: 2000,
    showConfirmButton: false
  })
}

// Mostrar mensaje de error
function mostrarError(mensaje, titulo = 'Error') {
  return Swal.fire({
    icon: 'error',
    title: titulo,
    text: mensaje
  })
}

// Obtener mensaje de error amigable
function obtenerMensajeError(error) {
  if (error.message.includes('JWT expired')) return 'La sesión ha expirado. Recargue la página.'
  if (error.message.includes('permission denied')) return 'No tiene permisos para esta acción.'
  if (error.message.includes('duplicate key')) return 'Ya existe un producto con esos datos.'
  return error.message || 'Ocurrió un error inesperado. Intente nuevamente.'
}

// ========== FUNCIONES GLOBALES (window) ==========

// Editar producto
window.editarProducto = async function(id) {
  try {
    const { data: producto, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    // Llenar formulario
    document.getElementById('productName').value = producto.nombre
    document.getElementById('productCategory').value = producto.categoria_id || ''
    document.getElementById('productPrice').value = producto.precio
    document.getElementById('productQuantity').value = producto.cantidad
    document.getElementById('productDescription').value = producto.descripcion || ''
    document.getElementById('productSupplier').value = producto.proveedor_id || ''
    document.getElementById('productLocation').value = producto.ubicacion || ''
    document.getElementById('productEntryDate').value = producto.fecha_ingreso

    // Configurar para edición
    productoEditando = producto
    document.getElementById('addProductModalLabel').textContent = 'Editar Producto'
    document.getElementById('saveProductBtn').textContent = 'Actualizar Producto'

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('addProductModal'))
    modal.show()

  } catch (error) {
    console.error('Error obteniendo producto:', error)
    mostrarError('No se pudo cargar el producto para editar')
  }
}

// Eliminar producto
window.eliminarProducto = async function(id, nombre) {
  try {
    const result = await Swal.fire({
      title: '¿Eliminar producto?',
      html: `¿Estás seguro de eliminar <strong>${nombre}</strong>?<br>Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    })

    if (!result.isConfirmed) return

    const loading = mostrarLoading('Eliminando producto...')

    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id)

    loading.close()

    if (error) throw error

    mostrarExito(`Producto "${nombre}" eliminado correctamente`)
    await cargarProductos()

  } catch (error) {
    console.error('Error eliminando producto:', error)
    mostrarError('No se pudo eliminar el producto')
  }
}

// Mostrar modal para ajustar stock
window.mostrarModalAjuste = function(id, nombre) {
  document.getElementById('existingProduct').value = id
  document.getElementById('addExistingModalLabel').textContent = `Ajustar Stock: ${nombre}`
  const modal = new bootstrap.Modal(document.getElementById('addExistingModal'))
  modal.show()
}

// Ver historial de movimientos
window.verHistorial = async function(id, nombre) {
  try {
    const loading = mostrarLoading('Cargando historial...')

    const { data: movimientos, error } = await supabase
      .from('movimientos')
      .select(`
        *,
        usuarios: usuario_id (email)
      `)
      .eq('producto_id', id)
      .order('created_at', { ascending: false })

    loading.close()

    if (error) throw error

    if (movimientos.length === 0) {
      return Swal.fire({
        title: `Historial: ${nombre}`,
        html: '<p class="text-muted">No hay movimientos registrados para este producto.</p>',
        confirmButtonText: 'Cerrar'
      })
    }

    let html = `
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Motivo</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
    `

    movimientos.forEach(mov => {
      html += `
        <tr>
          <td>${formatearFecha(mov.created_at)}</td>
          <td>
            <span class="badge ${mov.tipo === 'entrada' ? 'bg-success' : 'bg-danger'}">
              ${mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}
            </span>
          </td>
          <td>${mov.cantidad}</td>
          <td>${mov.motivo}</td>
          <td>${mov.usuarios?.email || 'Sistema'}</td>
        </tr>
      `
    })

    html += `
          </tbody>
        </table>
      </div>
    `

    Swal.fire({
      title: `Historial: ${nombre}`,
      html,
      width: '800px',
      confirmButtonText: 'Cerrar'
    })

  } catch (error) {
    console.error('Error obteniendo historial:', error)
    mostrarError('No se pudo obtener el historial del producto')
  }
}
