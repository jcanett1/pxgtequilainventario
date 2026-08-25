import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm'
import { supabase } from './supabase-client.js'
import { escapeHtml, friendlyError } from './ui-utils.js'

// Variables globales
let proveedorEditando = null

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Verificar conexión con Supabase
    const { error: testError } = await supabase
      .from('proveedores')
      .select('id')
      .limit(1)
      
    if (testError) throw testError
    
    // Cargar datos iniciales
    await cargarProveedores()
    
    // Configurar event listeners
    document.getElementById('saveProviderBtn').addEventListener('click', guardarProveedor)
    document.getElementById('providersTableBody')?.addEventListener('click', manejarAccionProveedor)
    document.getElementById('newProviderBtn')?.addEventListener('click', nuevoProveedor)
    
    // Inicializar tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

  } catch (error) {
    console.error('Error inicial:', error)
    mostrarError('Error al cargar la página: ' + friendlyError(error))
  }
})

// ========== FUNCIONES PRINCIPALES ==========

// Cargar proveedores en la tabla
async function cargarProveedores() {
  try {
    const { data: proveedores, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error

    const tbody = document.getElementById('providersTableBody')
    tbody.innerHTML = ''

    if (proveedores.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted py-4">
            No hay proveedores registrados. Agrega tu primer proveedor.
          </td>
        </tr>
      `
      return
    }

    tbody.innerHTML = proveedores.map(proveedor => `
      <tr>
        <td>${escapeHtml(proveedor.id)}</td>
        <td><strong>${escapeHtml(proveedor.nombre)}</strong></td>
        <td>${escapeHtml(proveedor.contacto || 'N/A')}</td>
        <td>${escapeHtml(proveedor.telefono || 'N/A')}</td>
        <td>${escapeHtml(proveedor.email || 'N/A')}</td>
        <td>${escapeHtml(proveedor.direccion || 'N/A')}</td>
        <td>${formatearFecha(proveedor.created_at)}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-primary me-1" data-provider-action="edit" data-provider-id="${escapeHtml(proveedor.id)}" title="Editar">
            <i class="fas fa-edit" aria-hidden="true"></i><span class="visually-hidden">Editar</span>
          </button>
          <button class="btn btn-sm btn-danger" data-provider-action="delete" data-provider-id="${escapeHtml(proveedor.id)}" data-provider-name="${escapeHtml(proveedor.nombre)}" title="Eliminar">
            <i class="fas fa-trash" aria-hidden="true"></i><span class="visually-hidden">Eliminar</span>
          </button>
        </td>
      </tr>
    `).join('')

  } catch (error) {
    console.error('Error cargando proveedores:', error)
    mostrarError('No se pudieron cargar los proveedores: ' + friendlyError(error))
  }
}

function manejarAccionProveedor(event) {
  const button = event.target.closest('[data-provider-action]')
  if (!button) return
  const id = Number(button.dataset.providerId)
  if (!Number.isInteger(id)) return
  if (button.dataset.providerAction === 'edit') window.editarProveedor(id)
  if (button.dataset.providerAction === 'delete') window.eliminarProveedor(id, button.dataset.providerName || 'este proveedor')
}

// Guardar proveedor (nuevo o edición)
async function guardarProveedor() {
  const form = document.getElementById('providerForm')
  
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    return
  }

  try {
    const proveedor = {
      nombre: document.getElementById('providerName').value.trim(),
      contacto: document.getElementById('providerContact').value.trim() || null,
      telefono: document.getElementById('providerPhone').value.trim() || null,
      email: document.getElementById('providerEmail').value.trim() || null,
      direccion: document.getElementById('providerAddress').value.trim() || null,
      updated_at: new Date().toISOString()
    }

    // Validaciones adicionales
    if (!proveedor.nombre) throw new Error('El nombre del proveedor es requerido')
    if (proveedor.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proveedor.email)) {
      throw new Error('Por favor ingrese un email válido')
    }

    const loading = mostrarLoading(proveedorEditando ? 'Actualizando proveedor...' : 'Guardando proveedor...')

    let result
    if (proveedorEditando) {
      // Editar proveedor existente
      const { data, error } = await supabase
        .from('proveedores')
        .update(proveedor)
        .eq('id', proveedorEditando.id)
        .select()
      
      if (error) throw error
      result = data[0]
    } else {
      // Crear nuevo proveedor
      proveedor.created_at = new Date().toISOString()
      
      const { data, error } = await supabase
        .from('proveedores')
        .insert([proveedor])
        .select()
      
      if (error) throw error
      result = data[0]
    }

    Swal.close()
    
    mostrarExito(`Proveedor "${result.nombre}" ${proveedorEditando ? 'actualizado' : 'guardado'} correctamente`)
    
    // Cerrar modal y recargar datos
    const modal = bootstrap.Modal.getInstance(document.getElementById('addEditProviderModal'))
    modal.hide()
    resetFormularioProveedor()
    await cargarProveedores()

  } catch (error) {
    console.error('Error guardando proveedor:', error)
    mostrarError(obtenerMensajeError(error), 'Error al guardar')
  }
}

// ========== FUNCIONES SECUNDARIAS ==========

// Resetear formulario de proveedor
function resetFormularioProveedor() {
  const form = document.getElementById('providerForm')
  form.reset()
  form.classList.remove('was-validated')
  proveedorEditando = null
  document.getElementById('providerId').value = ''
  document.getElementById('addEditProviderModalLabel').textContent = 'Agregar Proveedor'
  document.getElementById('saveProviderBtn').textContent = 'Guardar'
}

// Formatear fecha para visualización
function formatearFecha(fecha) {
  if (!fecha) return 'N/A'
  return new Date(fecha).toLocaleDateString('es-MX', {
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
  if (error.code === '42501') return 'No tiene permisos para realizar esta acción.'
  if (error.code === '23505') return 'Ya existe un proveedor con ese nombre.'
  if (error.message.includes('violates not-null constraint')) return 'Faltan campos requeridos.'
  return error.message || 'Ocurrió un error inesperado. Intente nuevamente.'
}

// ========== FUNCIONES GLOBALES (window) ==========

// Función para nuevo proveedor
window.nuevoProveedor = function() {
  resetFormularioProveedor()
  const modal = new bootstrap.Modal(document.getElementById('addEditProviderModal'))
  modal.show()
}

// Editar proveedor
window.editarProveedor = async function(id) {
  try {
    const { data: proveedor, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    // Llenar formulario
    document.getElementById('providerId').value = proveedor.id
    document.getElementById('providerName').value = proveedor.nombre
    document.getElementById('providerContact').value = proveedor.contacto || ''
    document.getElementById('providerPhone').value = proveedor.telefono || ''
    document.getElementById('providerEmail').value = proveedor.email || ''
    document.getElementById('providerAddress').value = proveedor.direccion || ''

    // Configurar para edición
    proveedorEditando = proveedor
    document.getElementById('addEditProviderModalLabel').textContent = 'Editar Proveedor'
    document.getElementById('saveProviderBtn').textContent = 'Actualizar'

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('addEditProviderModal'))
    modal.show()

  } catch (error) {
    console.error('Error obteniendo proveedor:', error)
    mostrarError('No se pudo cargar el proveedor para editar')
  }
}

// Eliminar proveedor
window.eliminarProveedor = async function(id, nombre) {
  try {
    const result = await Swal.fire({
      title: '¿Eliminar proveedor?',
      html: `¿Estás seguro de eliminar <strong>${nombre}</strong>?<br>Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    })

    if (!result.isConfirmed) return

    const loading = mostrarLoading('Eliminando proveedor...')

    const { error } = await supabase
      .from('proveedores')
      .delete()
      .eq('id', id)

    Swal.close()

    if (error) throw error

    mostrarExito(`Proveedor "${nombre}" eliminado correctamente`)
    await cargarProveedores()

  } catch (error) {
    console.error('Error eliminando proveedor:', error)
    mostrarError('No se pudo eliminar el proveedor')
  }
}
