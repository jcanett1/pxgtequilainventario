import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'

// Inicializar Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', async function() {
  await cargarProveedores()
  document.getElementById('saveProviderBtn').addEventListener('click', guardarProveedor)
  
  // Tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
})

// Cargar proveedores
async function cargarProveedores() {
  try {
    const { data: proveedores, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error

    const tbody = document.getElementById('providersTableBody')
    tbody.innerHTML = ''

    proveedores.forEach(proveedor => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td>${proveedor.id}</td>
        <td>${proveedor.nombre}</td>
        <td>${proveedor.contacto || 'N/A'}</td>
        <td>${proveedor.telefono || 'N/A'}</td>
        <td>${proveedor.email || 'N/A'}</td>
        <td>${proveedor.direccion ? proveedor.direccion.substring(0, 30) + (proveedor.direccion.length > 30 ? '...' : '') : 'N/A'}</td>
        <td>${new Date(proveedor.created_at).toLocaleDateString()}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-info" data-bs-toggle="tooltip" title="Editar" onclick="editarProveedor(${proveedor.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" data-bs-toggle="tooltip" title="Eliminar" onclick="eliminarProveedor(${proveedor.id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `
      tbody.appendChild(tr)
    })

  } catch (error) {
    console.error('Error cargando proveedores:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudieron cargar los proveedores. Por favor recargue la página.'
    })
  }
}

// Guardar o actualizar proveedor
async function guardarProveedor() {
  const form = document.getElementById('providerForm')
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }

  try {
    const proveedor = {
      nombre: document.getElementById('providerName').value,
      contacto: document.getElementById('providerContact').value || null,
      telefono: document.getElementById('providerPhone').value || null,
      email: document.getElementById('providerEmail').value || null,
      direccion: document.getElementById('providerAddress').value || null
    }

    const providerId = document.getElementById('providerId').value
    let operation

    if (providerId) {
      // Actualización
      const { data, error: updateError } = await supabase
        .from('proveedores')
        .update(proveedor)
        .eq('id', providerId)
        .select()
      
      if (updateError) throw updateError
      operation = 'actualizado'
    } else {
      // Inserción
      const { data, error: insertError } = await supabase
        .from('proveedores')
        .insert([proveedor])
        .select()
      
      if (insertError) throw insertError
      operation = 'agregado'
    }

    Swal.fire({
      icon: 'success',
      title: 'Éxito',
      text: `Proveedor ${operation} correctamente`
    })

    const modal = bootstrap.Modal.getInstance(document.getElementById('addEditProviderModal'))
    modal.hide()
    form.reset()
    await cargarProveedores()

  } catch (error) {
    console.error('Error guardando proveedor:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.message || 'No se pudo guardar el proveedor. Por favor intente de nuevo.'
    })
  }
}

// Función para editar proveedor
window.editarProveedor = async function(id) {
  try {
    const { data: proveedor, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    // Llenar formulario con datos del proveedor
    document.getElementById('providerId').value = proveedor.id
    document.getElementById('providerName').value = proveedor.nombre
    document.getElementById('providerContact').value = proveedor.contacto || ''
    document.getElementById('providerPhone').value = proveedor.telefono || ''
    document.getElementById('providerEmail').value = proveedor.email || ''
    document.getElementById('providerAddress').value = proveedor.direccion || ''
    
    // Actualizar título del modal
    document.getElementById('addEditProviderModalLabel').textContent = 'Editar Proveedor'
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('addEditProviderModal'))
    modal.show()

  } catch (error) {
    console.error('Error obteniendo proveedor:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo cargar el proveedor para editar.'
    })
  }
}

// Función para eliminar proveedor
window.eliminarProveedor = async function(id) {
  try {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "¡No podrás revertir esta acción!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8b0000',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    })

    if (!result.isConfirmed) return

    const { error } = await supabase
      .from('proveedores')
      .delete()
      .eq('id', id)

    if (error) throw error

    Swal.fire({
      icon: 'success',
      title: 'Eliminado',
      text: 'El proveedor ha sido eliminado correctamente.'
    })

    await cargarProveedores()

  } catch (error) {
    console.error('Error eliminando proveedor:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo eliminar el proveedor. Por favor intente de nuevo.'
    })
  }
}

// Función para abrir modal de nuevo proveedor
window.nuevoProveedor = function() {
  // Limpiar formulario
  document.getElementById('providerForm').reset()
  document.getElementById('providerId').value = ''
  
  // Actualizar título del modal
  document.getElementById('addEditProviderModalLabel').textContent = 'Agregar Proveedor'
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('addEditProviderModal'))
  modal.show()
}
