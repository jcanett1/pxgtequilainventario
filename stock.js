import { createClient } from '@supabase/supabase-js'
import Swal from 'sweetalert2'

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // Verificar conexión con Supabase
    const { error: testError } = await supabase
      .from('productos')
      .select('id')
      .limit(1)
      
    if (testError) throw testError
    
    // Cargar datos iniciales
    await cargarStock()
    
    // Escuchar eventos de actualización
    document.addEventListener('stockUpdated', cargarStock)
    
  } catch (error) {
    console.error('Error inicial:', error)
    mostrarAlerta('Error al conectar con la base de datos', 'error')
  }
})

// Función principal para cargar stock
async function cargarStock() {
  try {
    // Consulta mejorada con relaciones
    const { data: productos, error } = await supabase
      .from('productos')
      .select(`
        id,
        nombre,
        precio,
        cantidad as stock,
        ubicacion,
        fecha_ingreso,
        categorias: categoria_id(nombre),
        proveedores: proveedor_id(nombre)
      `)
      .order('nombre', { ascending: true })

    if (error) throw error

    const tableBody = document.getElementById('stockTableBody')
    tableBody.innerHTML = ''

    if (!productos || productos.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted py-4">
            No hay productos registrados en el inventario
          </td>
        </tr>
      `
      return
    }

    productos.forEach(producto => {
      const row = document.createElement('tr')
      
      // Clase CSS según nivel de stock
      let stockClass = ''
      if (producto.stock <= 10) {
        stockClass = 'table-danger'
      } else if (producto.stock <= 20) {
        stockClass = 'table-warning'
      } else {
        stockClass = 'table-success'
      }
      
      row.className = stockClass
      
      row.innerHTML = `
        <td>${producto.nombre}</td>
        <td>${producto.categorias?.nombre || '-'}</td>
        <td>$${producto.precio ? parseFloat(producto.precio).toFixed(2) : '0.00'}</td>
        <td>${producto.stock}</td>
        <td>${producto.proveedores?.nombre || '-'}</td>
        <td>${formatearFecha(producto.fecha_ingreso)}</td>
        <td>${producto.ubicacion || '-'}</td>
      `
      
      tableBody.appendChild(row)
    })

  } catch (error) {
    console.error('Error al cargar stock:', error)
    mostrarAlerta('Error al cargar el inventario', 'error')
  }
}

// Función para formatear fechas
function formatearFecha(fechaIso) {
  if (!fechaIso) return '-'
  const fecha = new Date(fechaIso)
  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Función para mostrar alertas
function mostrarAlerta(mensaje, tipo) {
  Swal.fire({
    title: mensaje,
    icon: tipo,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  })
}
