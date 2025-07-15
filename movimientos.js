import { createClient } from '@supabase/supabase-js'
import Swal from 'sweetalert2'

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

// Función para mostrar alertas
function mostrarAlerta(mensaje, tipo = 'error') {
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

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await cargarProductos()
    await cargarMovimientos()
    
    // Configurar fecha por defecto
    document.getElementById('salidaFecha').valueAsDate = new Date()
    
    // Event listeners
    document.getElementById('registrarSalidaBtn').addEventListener('click', registrarSalida)
    
  } catch (error) {
    console.error('Error inicial:', error)
    mostrarAlerta('Error al cargar la página', 'error')
  }
})

// Función para capitalizar texto
function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Función para formatear fechas
function formatearFecha(fechaIso) {
  if (!fechaIso) return '-'
  const fecha = new Date(fechaIso)
  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Función para obtener clase CSS según tipo de movimiento
function getBadgeClass(tipo) {
  switch(tipo) {
    case 'entrada': return 'bg-success'
    case 'salida': return 'bg-danger'
    case 'ajuste': return 'bg-warning'
    default: return 'bg-secondary'
  }
}

// Cargar productos para selects
async function cargarProductos() {
  try {
    const { data: productos, error } = await supabase
      .from('productos')
      .select('id, nombre')
      .order('nombre', { ascending: true })
    
    if (error) throw error
    
    const selectProducto = document.getElementById('salidaProducto')
    selectProducto.innerHTML = '<option value="">Seleccionar producto</option>'
    
    productos.forEach(producto => {
      const option = new Option(producto.nombre, producto.id)
      selectProducto.add(option)
    })
    
  } catch (error) {
    console.error('Error cargando productos:', error)
    mostrarAlerta('Error al cargar productos', 'error')
  }
}

// Cargar movimientos en la tabla
async function cargarMovimientos() {
  try {
    // Consulta modificada para manejar correctamente las relaciones
    const query = supabase
      .from('movimientos')
      .select(`
        id,
        tipo,
        cantidad,
        motivo,
        destinatario,
        created_at,
        producto_id,
        productos (id, nombre),
        usuario_id
      `)
      .order('created_at', { ascending: false });

    // Solo intentar unir con auth.users si el usuario está autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      query.select(`, usuarios: usuario_id (email)`);
    }

    const { data: movimientos, error } = await query;

    if (error) throw error;
    
    const tableBody = document.getElementById('movementsTableBody');
    tableBody.innerHTML = '';
    
    if (movimientos.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-muted">
            No hay movimientos registrados
          </td>
        </tr>
      `;
      return;
    }
    
    movimientos.forEach(movimiento => {
      const row = document.createElement('tr');
      
      // Manejar el email del usuario de manera segura
      let usuarioEmail = 'Sistema';
      if (movimiento.usuarios && movimiento.usuarios.email) {
        usuarioEmail = movimiento.usuarios.email;
      } else if (movimiento.usuario_id) {
        usuarioEmail = 'Usuario (' + movimiento.usuario_id.substring(0, 8) + '...)';
      }
      
      row.innerHTML = `
        <td>${movimiento.id}</td>
        <td>${movimiento.productos?.nombre || 'Producto eliminado'}</td>
        <td><span class="badge ${getBadgeClass(movimiento.tipo)}">${capitalizar(movimiento.tipo)}</span></td>
        <td>${movimiento.cantidad}</td>
        <td>${movimiento.motivo || ''}</td>
        <td>${movimiento.destinatario || '-'}</td>
        <td>${usuarioEmail}</td>
        <td>${formatearFecha(movimiento.created_at)}</td>
      `;
      
      tableBody.appendChild(row);
    });
    
  } catch (error) {
    console.error('Error cargando movimientos:', error);
    mostrarAlerta('Error al cargar movimientos. ' + (error.message || ''), 'error');
  }
}

// Función principal para registrar salidas
async function registrarSalida() {
  const form = document.getElementById('salidaForm')
  
  try {
    // Validar formulario
    if (!form.checkValidity()) {
      form.classList.add('was-validated')
      return
    }
    
    // Obtener valores del formulario
    const productoId = document.getElementById('salidaProducto').value
    const cantidad = parseInt(document.getElementById('salidaCantidad').value)
    const destinatario = document.getElementById('salidaDestinatario').value.trim()
    const motivo = document.getElementById('salidaMotivo').value.trim()
    const fecha = document.getElementById('salidaFecha').value
    
    // Validaciones adicionales
    if (cantidad <= 0) throw new Error('La cantidad debe ser mayor que cero')
    if (!destinatario) throw new Error('El destinatario es requerido')
    
    // Mostrar carga
    const loading = Swal.fire({
      title: 'Registrando salida...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    })
    
    // Verificar stock disponible
    const { data: producto, error: stockError } = await supabase
      .from('productos')
      .select('cantidad')
      .eq('id', productoId)
      .single()
    
    if (stockError) throw stockError
    if (producto.cantidad < cantidad) {
      throw new Error(`Stock insuficiente. Disponible: ${producto.cantidad}`)
    }
    
    // Obtener usuario actual (si está autenticado)
    const { data: { user } } = await supabase.auth.getUser()
    const usuarioId = user?.id || null
    
    // Registrar el movimiento
    const { error: movError } = await supabase
      .from('movimientos')
      .insert([{
        producto_id: productoId,
        tipo: 'salida',
        cantidad: cantidad,
        motivo: motivo,
        destinatario: destinatario,
        usuario_id: usuarioId,
        created_at: fecha || new Date().toISOString()
      }])
    
    if (movError) throw movError
    
    // Actualizar stock del producto
    const { error: updateError } = await supabase
      .from('productos')
      .update({ cantidad: producto.cantidad - cantidad })
      .eq('id', productoId)
    
    if (updateError) throw updateError
    
    // Éxito
    loading.close()
    mostrarAlerta('Salida registrada correctamente', 'success')
    
    // Resetear formulario
    form.reset()
    form.classList.remove('was-validated')
    document.getElementById('salidaFecha').valueAsDate = new Date()
    
    // Recargar datos
    await cargarMovimientos()
    
    // Disparar evento para actualizar otras páginas
    const event = new CustomEvent('stockUpdated')
    document.dispatchEvent(event)
    
  } catch (error) {
    console.error('Error registrando salida:', error)
    mostrarAlerta(error.message || 'Error al registrar salida', 'error')
  }
}
