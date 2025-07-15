
// Cambia la importación de Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'

// Inicializa Supabase correctamente
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async function() {
  // Cargar datos iniciales
  await cargarProductos()
  await cargarCategorias()
  await cargarProveedores()
  
  // Configurar event listeners
  document.getElementById('saveProductBtn').addEventListener('click', guardarProducto)
  document.getElementById('addStockBtn').addEventListener('click', agregarStockExistente)
  
  // Inicializar tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
})

// Función para cargar productos en la tabla
async function cargarProductos() {
  try {
    const { data: productos, error } = await supabase
      .from('productos')
      .select(`
        id,
        nombre,
        precio,
        cantidad,
        ubicacion,
        fecha_ingreso,
        categorias: categoria_id (nombre),
        proveedores: proveedor_id (nombre)
      `)
      .order('nombre', { ascending: true })

    if (error) throw error

    const tbody = document.getElementById('productosTableBody')
    tbody.innerHTML = ''

    productos.forEach(producto => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td>${producto.nombre}</td>
        <td>${producto.categorias?.nombre || 'N/A'}</td>
        <td>$${producto.precio.toFixed(2)}</td>
        <td>${producto.cantidad}</td>
        <td>${producto.proveedores?.nombre || 'N/A'}</td>
        <td>${new Date(producto.fecha_ingreso).toLocaleDateString()}</td>
        <td>${producto.ubicacion || 'N/A'}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-info" data-bs-toggle="tooltip" title="Editar" onclick="editarProducto(${producto.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-success" data-bs-toggle="tooltip" title="Ajustar cantidad" onclick="mostrarModalAjuste(${producto.id})">
            <i class="fas fa-plus-minus"></i>
          </button>
          <button class="btn btn-sm btn-secondary" data-bs-toggle="tooltip" title="Ver historial" onclick="verHistorial(${producto.id})">
            <i class="fas fa-history"></i>
          </button>
          <button class="btn btn-sm btn-danger" data-bs-toggle="tooltip" title="Eliminar" onclick="eliminarProducto(${producto.id})">
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
      option.textContent = producto.nombre
      selectProductos.appendChild(option)
    })

  } catch (error) {
    console.error('Error cargando productos:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudieron cargar los productos. Por favor recargue la página.'
    })
  }
}

// Función para cargar categorías en los selects
async function cargarCategorias() {
  try {
    const { data: categorias, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error

    const selectCategoria = document.getElementById('productCategory')
    selectCategoria.innerHTML = '<option value="">Seleccionar categoría</option>'
    
    categorias.forEach(categoria => {
      const option = document.createElement('option')
      option.value = categoria.id
      option.textContent = categoria.nombre
      selectCategoria.appendChild(option)
    })

  } catch (error) {
    console.error('Error cargando categorías:', error)
  }
}

// Función para cargar proveedores en los selects
async function cargarProveedores() {
  try {
    const { data: proveedores, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error

    const selectProveedor = document.getElementById('productSupplier')
    selectProveedor.innerHTML = '<option value="">Seleccionar proveedor</option>'
    
    proveedores.forEach(proveedor => {
      const option = document.createElement('option')
      option.value = proveedor.id
      option.textContent = proveedor.nombre
      selectProveedor.appendChild(option)
    })

  } catch (error) {
    console.error('Error cargando proveedores:', error)
  }
}

// Función para guardar un nuevo producto
async function guardarProducto() {
  const form = document.getElementById('addProductForm')
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }

  try {
    const producto = {
      nombre: document.getElementById('productName').value,
      categoria_id: document.getElementById('productCategory').value,
      precio: parseFloat(document.getElementById('productPrice').value),
      cantidad: parseInt(document.getElementById('productQuantity').value),
      descripcion: document.getElementById('productDescription').value,
      proveedor_id: document.getElementById('productSupplier').value || null,
      ubicacion: document.getElementById('productLocation').value,
      fecha_ingreso: document.getElementById('productEntryDate').value
    }

    const { error } = await supabase
      .from('productos')
      .insert([producto])

    if (error) throw error

    Swal.fire({
      icon: 'success',
      title: 'Éxito',
      text: 'Producto guardado correctamente'
    })

    // Cerrar modal y recargar datos
    const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'))
    modal.hide()
    form.reset()
    await cargarProductos()

  } catch (error) {
    console.error('Error guardando producto:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo guardar el producto. Por favor intente de nuevo.'
    })
  }
}

// Función para agregar stock a producto existente
async function agregarStockExistente() {
  const form = document.getElementById('addStockForm')
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }

  try {
    const productoId = document.getElementById('existingProduct').value
    const cantidad = parseInt(document.getElementById('additionalStock').value)

    // Obtener cantidad actual
    const { data: producto, error: fetchError } = await supabase
      .from('productos')
      .select('cantidad')
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

    Swal.fire({
      icon: 'success',
      title: 'Éxito',
      text: 'Stock actualizado correctamente'
    })

    // Cerrar modal y recargar datos
    const modal = bootstrap.Modal.getInstance(document.getElementById('addExistingModal'))
    modal.hide()
    form.reset()
    await cargarProductos()

  } catch (error) {
    console.error('Error actualizando stock:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo actualizar el stock. Por favor intente de nuevo.'
    })
  }
}

// Función auxiliar para registrar movimientos
async function registrarMovimiento(productoId, tipo, cantidad, motivo) {
  try {
    const { error } = await supabase
      .from('movimientos')
      .insert([{
        producto_id: productoId,
        tipo,
        cantidad,
        motivo
      }])

    if (error) throw error

  } catch (error) {
    console.error('Error registrando movimiento:', error)
  }
}

// Funciones para acciones adicionales (editar, eliminar, etc.)
window.editarProducto = async function(id) {
  try {
    const { data: producto, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    // Llenar formulario de edición (podrías crear un modal similar al de agregar)
    console.log('Editar producto:', producto)
    // Aquí implementarías la lógica para mostrar un modal de edición

  } catch (error) {
    console.error('Error obteniendo producto:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo cargar el producto para editar.'
    })
  }
}

window.eliminarProducto = async function(id) {
  try {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "¡No podrás revertir esto!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8b0000',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    })

    if (!result.isConfirmed) return

    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id)

    if (error) throw error

    Swal.fire({
      icon: 'success',
      title: 'Eliminado',
      text: 'El producto ha sido eliminado.'
    })

    await cargarProductos()

  } catch (error) {
    console.error('Error eliminando producto:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo eliminar el producto.'
    })
  }
}

window.mostrarModalAjuste = function(id) {
  // Implementar lógica para mostrar un modal de ajuste de cantidad
  console.log('Ajustar cantidad para producto ID:', id)
}

window.verHistorial = async function(id) {
  try {
    const { data: movimientos, error } = await supabase
      .from('movimientos')
      .select('*')
      .eq('producto_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Mostrar historial en un modal o ventana
    console.log('Historial de movimientos:', movimientos)
    // Aquí implementarías la lógica para mostrar el historial

  } catch (error) {
    console.error('Error obteniendo historial:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo obtener el historial del producto.'
    })
  }
}
