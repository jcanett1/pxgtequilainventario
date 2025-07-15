import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Variables globales
let proveedorEditando = null

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Verificar sesión activa
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      // Si no hay sesión, usar autenticación anónima
      const { error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) throw anonError
    }

    // Cargar datos iniciales
    await cargarProveedores()
    
    // Configurar event listeners
    document.getElementById('saveProviderBtn').addEventListener('click', guardarProveedor)
    
    // Inicializar tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

  } catch (error) {
    console.error('Error inicial:', error)
    mostrarError('Error al cargar la página. Por favor recargue.')
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

    const tbody = document.getElementById('proveedoresTableBody')
    tbody.innerHTML = ''

    if (proveedores.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            No hay proveedores registrados. Agrega tu primer proveedor.
          </td>
        </tr>
      `
      return
    }

    proveedores.forEach(proveedor => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td>${proveedor.nombre}</td>
        <td>${proveedor.contacto || 'N/A'}</td>
        <td>${proveedor.telefono || 'N/A'}</td>
        <td>${proveedor.email || 'N/A'}</td>
        <td>${proveedor.direccion || 'N/A'}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-info" data-bs-toggle="tooltip" title="Editar" 
            onclick="editarProveedor(${proveedor.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" data-bs-toggle="tooltip" title="Eliminar" 
            onclick="eliminarProveedor(${proveedor.id}, '${proveedor.nombre.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `
      tbody.appendChild(tr)
    })

  } catch (error) {
    console.error('Error cargando proveedores:', error)
    mostrarError('No se pudieron cargar los proveedores. Por favor recargue la página.')
  }
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
      direccion: document.getElementById('providerAddress').value.trim() || null
    }

    // Validaciones adicionales
    if (!proveedor.nombre) throw new Error('El nombre del proveedor es requerido')
    if (proveedor.email && !/^\S+@\S+\.\S+$/.test(proveedor.email)) {
      throw new Error('El email no tiene un formato válido')
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
      const { data, error } = await supabase
        .from('proveedores')
        .insert([proveedor])
        .select()
      
      if (error) throw error
      result = data[0]
    }

    loading.close()
    
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
  document.getElementById('addEditProviderModalLabel').textContent = 'Agregar Nuevo Proveedor'
  document.getElementById('saveProviderBtn').textContent = 'Guardar Proveedor'
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
  if (error.message.includes('duplicate key')) return 'Ya existe un proveedor con ese nombre.'
  return error.message || 'Ocurrió un error inesperado. Intente nuevamente.'
}

// ========== FUNCIONES GLOBALES (window) ==========

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
    document.getElementById('saveProviderBtn').textContent = 'Actualizar Proveedor'

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

    loading.close()

    if (error) throw error

    mostrarExito(`Proveedor "${nombre}" eliminado correctamente`)
    await cargarProveedores()

  } catch (error) {
    console.error('Error eliminando proveedor:', error)
    mostrarError('No se pudo eliminar el proveedor')
  }
}
