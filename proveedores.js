import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'

// Inicializar Supabase con autenticación
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Verificar autenticación al cargar la página
document.addEventListener('DOMContentLoaded', async function() {
  // Verificar sesión activa
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    // Si no hay sesión, redirigir a login o usar autenticación anónima
    await supabase.auth.signInAnonymously()
  }

  await cargarProveedores()
  document.getElementById('saveProviderBtn').addEventListener('click', guardarProveedor)
  
  // Tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
})

// Función para guardar proveedor (actualizada)
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
      // Actualización con autenticación
      const { data, error } = await supabase
        .from('proveedores')
        .update(proveedor)
        .eq('id', providerId)
        .select()
      
      if (error) throw error
      operation = 'actualizado'
    } else {
      // Inserción con autenticación
      const { data, error } = await supabase
        .from('proveedores')
        .insert([proveedor])
        .select()
      
      if (error) throw error
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
    let errorMessage = 'No se pudo guardar el proveedor. '
    
    if (error.code === '42501') {
      errorMessage += 'Error de permisos. Contacte al administrador.'
    } else {
      errorMessage += error.message || 'Por favor intente de nuevo.'
    }
    
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: errorMessage
    })
  }
}

// Resto del código permanece igual...
