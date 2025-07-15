import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm'

// Configuración mejorada de Supabase
const supabase = createClient(
  'https://bwkvfwrrlizhqdpaxfmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU',
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
)

// Función para verificar la conexión
async function verificarConexion() {
  try {
    const { error } = await supabase
      .from('productos')
      .select('id')
      .limit(1)
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Error de conexión:', error)
    mostrarAlerta('Error al conectar con la base de datos', 'error')
    return false
  }
}

// Cargar stock con manejo mejorado de errores
async function cargarStock() {
  try {
    // Verificar conexión primero
    if (!await verificarConexion()) return
    
    // Consulta optimizada con manejo de relaciones
    const { data: productos, error } = await supabase
      .from('productos')
      .select(`
        id,
        nombre,
        precio,
        cantidad,
        ubicacion,
        fecha_ingreso,
        categoria_id,
        proveedor_id,
        categorias: categoria_id(nombre),
        proveedores: proveedor_id(nombre)
      `)
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error en consulta:', error)
      throw new Error(`Error al cargar productos: ${error.message}`)
    }

    const tableBody = document.getElementById('stockTableBody')
    if (!tableBody) {
      throw new Error('No se encontró el elemento stockTableBody en el DOM')
    }
    
    tableBody.innerHTML = ''

    if (!productos || productos.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-muted">
            No hay productos en el inventario
          </td>
        </tr>
      `
      return
    }

    // Generar filas de la tabla
    productos.forEach(producto => {
      const row = document.createElement('tr')
      const stockClass = getStockClass(producto.cantidad)
      
      row.className = stockClass
      row.innerHTML = `
        <td>${producto.nombre || '-'}</td>
        <td>${producto.categorias?.nombre || '-'}</td>
        <td>$${(producto.precio || 0).toFixed(2)}</td>
        <td>${producto.cantidad || 0}</td>
        <td>${producto.proveedores?.nombre || '-'}</td>
        <td>${formatearFecha(producto.fecha_ingreso)}</td>
        <td>${producto.ubicacion || '-'}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-primary" onclick="editarStock(${producto.id})">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      `
      tableBody.appendChild(row)
    })

  } catch (error) {
    console.error('Error en cargarStock:', error)
    mostrarAlerta(error.message || 'Error al cargar el inventario', 'error')
  }
}

// Clases CSS según nivel de stock
function getStockClass(cantidad) {
  if (cantidad <= 5) return 'table-danger'
  if (cantidad <= 15) return 'table-warning'
  return 'table-success'
}

// Formatear fecha
function formatearFecha(fecha) {
  if (!fecha) return '-'
  try {
    return new Date(fecha).toLocaleDateString('es-MX')
  } catch {
    return '-'
  }
}

// Mostrar alerta
function mostrarAlerta(mensaje, tipo = 'error') {
  Swal.fire({
    title: mensaje,
    icon: tipo,
    position: 'top-end',
    toast: true,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  })
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  cargarStock().catch(error => {
    console.error('Error inicial:', error)
    mostrarAlerta('Error al iniciar la aplicación', 'error')
  })
})

// Función global para editar stock
window.editarStock = async (id) => {
  // Implementar lógica de edición aquí
  console.log('Editar producto ID:', id)
}
