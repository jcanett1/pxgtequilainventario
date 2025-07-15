
import { createClient } from '@supabase/supabase-js'
import Swal from 'sweetalert2'

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', function() {
  cargarMovimientos();
  cargarProductos();
  
  // Set current date as default for salidaFecha
  document.getElementById('salidaFecha').valueAsDate = new Date();
  
  // Event listeners
  document.getElementById('saveMovementBtn').addEventListener('click', registrarMovimiento);
  document.getElementById('updateMovementBtn').addEventListener('click', actualizarMovimiento);
  document.getElementById('registrarSalidaBtn').addEventListener('click', registrarSalida);
  document.getElementById('confirmarDevolucionBtn').addEventListener('click', confirmarDevolucion);
});

async function cargarProductos() {
  try {
    const { data: productos, error } = await supabase
      .from('productos')
      .select('id, nombre');
    
    if (error) throw error;
    
    const selectProducto = document.getElementById('movementProduct');
    const editSelectProducto = document.getElementById('editMovementProduct');
    const salidaProductoSelect = document.getElementById('salidaProducto');
    
    productos.forEach(producto => {
      const option = new Option(producto.nombre, producto.id);
      const editOption = new Option(producto.nombre, producto.id);
      const salidaOption = new Option(producto.nombre, producto.id);
      
      selectProducto.appendChild(option);
      editSelectProducto.appendChild(editOption);
      salidaProductoSelect.appendChild(salidaOption);
    });
  } catch (error) {
    console.error('Error al cargar productos:', error);
    mostrarAlerta('Error al cargar productos', 'error');
  }
}

async function cargarMovimientos() {
  try {
    const { data: movimientos, error } = await supabase
      .from('movimientos')
      .select(`
        id, 
        tipo, 
        cantidad, 
        motivo, 
        usuario, 
        created_at,
        productos (id, nombre),
        destinatario
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const tableBody = document.getElementById('movementsTableBody');
    tableBody.innerHTML = '';
    
    movimientos.forEach(movimiento => {
      const row = document.createElement('tr');
      
      let accionesBotones = `
        <button class="btn btn-sm btn-warning edit-btn" data-id="${movimiento.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger delete-btn" data-id="${movimiento.id}">
          <i class="fas fa-trash"></i>
        </button>
      `;
      
      // Añadir botón de devolución solo para salidas
      if (movimiento.tipo === 'salida') {
        accionesBotones += `
          <button class="btn btn-sm btn-danger devolucion-btn" data-id="${movimiento.id}">
            <i class="fas fa-undo"></i>
          </button>
        `;
      }
      
      row.innerHTML = `
        <td>${movimiento.id}</td>
        <td>${movimiento.productos.nombre}</td>
        <td>${capitalizar(movimiento.tipo)}</td>
        <td>${movimiento.cantidad}</td>
        <td>${movimiento.motivo}${movimiento.destinatario ? ' - Para: ' + movimiento.destinatario : ''}</td>
        <td>${movimiento.usuario || 'Sistema'}</td>
        <td>${formatearFecha(movimiento.created_at)}</td>
        <td class="action-buttons">
          ${accionesBotones}
        </td>
      `;
      
      tableBody.appendChild(row);
    });
    
    // Agregar event listeners a botones de acción
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.currentTarget.getAttribute('data-id');
        cargarMovimientoParaEditar(id);
      });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.currentTarget.getAttribute('data-id');
        confirmarEliminarMovimiento(id);
      });
    });
    
    document.querySelectorAll('.devolucion-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.currentTarget.getAttribute('data-id');
        prepararDevolucion(id);
      });
    });
    
  } catch (error) {
    console.error('Error al cargar movimientos:', error);
    mostrarAlerta('Error al cargar movimientos', 'error');
  }
}

async function registrarMovimiento() {
  try {
    const productoId = document.getElementById('movementProduct').value;
    const tipo = document.getElementById('movementType').value;
    const cantidad = parseInt(document.getElementById('movementQuantity').value);
    const motivo = document.getElementById('movementReason').value;
    
    if (!productoId || !tipo || !cantidad || !motivo) {
      mostrarAlerta('Todos los campos son obligatorios', 'warning');
      return;
    }
    
    // Insertar movimiento en la base de datos
    const { data: movimiento, error: movimientoError } = await supabase
      .from('movimientos')
      .insert([{ 
        producto_id: productoId,
        tipo: tipo,
        cantidad: cantidad,
        motivo: motivo,
        usuario: 'Usuario actual' // Reemplazar con sistema de autenticación
      }])
      .select();
    
    if (movimientoError) throw movimientoError;
    
    // Actualizar stock según el tipo de movimiento
    const factorAjuste = tipo === 'entrada' ? 1 : (tipo === 'salida' ? -1 : 0);
    
    if (factorAjuste !== 0) {
      const { error: stockError } = await supabase.rpc('actualizar_stock', {
        p_producto_id: productoId,
        p_cantidad: cantidad * factorAjuste
      });
      
      if (stockError) throw stockError;
    }
    
    mostrarAlerta('Movimiento registrado correctamente', 'success');
    document.getElementById('movementForm').reset();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('addMovementModal'));
    modal.hide();
    
    cargarMovimientos();
    
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    mostrarAlerta('Error al registrar movimiento', 'error');
  }
}

async function cargarMovimientoParaEditar(id) {
  try {
    const { data: movimiento, error } = await supabase
      .from('movimientos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('editMovementId').value = movimiento.id;
    document.getElementById('editMovementProduct').value = movimiento.producto_id;
    document.getElementById('editMovementType').value = movimiento.tipo;
    document.getElementById('editMovementQuantity').value = movimiento.cantidad;
    document.getElementById('editMovementReason').value = movimiento.motivo;
    
    const modal = new bootstrap.Modal(document.getElementById('editMovementModal'));
    modal.show();
    
  } catch (error) {
    console.error('Error al cargar movimiento para editar:', error);
    mostrarAlerta('Error al cargar datos del movimiento', 'error');
  }
}

async function actualizarMovimiento() {
  try {
    const id = document.getElementById('editMovementId').value;
    const productoId = document.getElementById('editMovementProduct').value;
    const tipo = document.getElementById('editMovementType').value;
    const cantidad = parseInt(document.getElementById('editMovementQuantity').value);
    const motivo = document.getElementById('editMovementReason').value;
    
    if (!productoId || !tipo || !cantidad || !motivo) {
      mostrarAlerta('Todos los campos son obligatorios', 'warning');
      return;
    }
    
    // Primero obtener el movimiento original para hacer ajuste de stock
    const { data: movimientoOriginal, error: errorConsulta } = await supabase
      .from('movimientos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (errorConsulta) throw errorConsulta;
    
    // Revertir el movimiento original en el stock
    if (movimientoOriginal.tipo !== 'ajuste') {
      const factorReversa = movimientoOriginal.tipo === 'entrada' ? -1 : 1;
      await supabase.rpc('actualizar_stock', {
        p_producto_id: movimientoOriginal.producto_id,
        p_cantidad: movimientoOriginal.cantidad * factorReversa
      });
    }
    
    // Actualizar el movimiento
    const { error: updateError } = await supabase
      .from('movimientos')
      .update({ 
        producto_id: productoId,
        tipo: tipo,
        cantidad: cantidad,
        motivo: motivo
      })
      .eq('id', id);
    
    if (updateError) throw updateError;
    
    // Aplicar el nuevo movimiento al stock
    if (tipo !== 'ajuste') {
      const factorAjuste = tipo === 'entrada' ? 1 : -1;
      await supabase.rpc('actualizar_stock', {
        p_producto_id: productoId,
        p_cantidad: cantidad * factorAjuste
      });
    }
    
    mostrarAlerta('Movimiento actualizado correctamente', 'success');
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('editMovementModal'));
    modal.hide();
    
    cargarMovimientos();
    
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    mostrarAlerta('Error al actualizar movimiento', 'error');
  }
}

async function confirmarEliminarMovimiento(id) {
  try {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción no se puede revertir",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    
    if (result.isConfirmed) {
      await eliminarMovimiento(id);
    }
  } catch (error) {
    console.error('Error en confirmación:', error);
  }
}

async function eliminarMovimiento(id) {
  try {
    // Primero obtener el movimiento para poder ajustar el stock
    const { data: movimiento, error: consultaError } = await supabase
      .from('movimientos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (consultaError) throw consultaError;
    
    // Revertir el efecto en el stock
    if (movimiento.tipo !== 'ajuste') {
      const factorReversa = movimiento.tipo === 'entrada' ? -1 : 1;
      
      const { error: stockError } = await supabase.rpc('actualizar_stock', {
        p_producto_id: movimiento.producto_id,
        p_cantidad: movimiento.cantidad * factorReversa
      });
      
      if (stockError) throw stockError;
    }
    
    // Eliminar el movimiento
    const { error: deleteError } = await supabase
      .from('movimientos')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    
    mostrarAlerta('Movimiento eliminado correctamente', 'success');
    cargarMovimientos();
    
  } catch (error) {
    console.error('Error al eliminar movimiento:', error);
    mostrarAlerta('Error al eliminar movimiento', 'error');
  }
}

async function registrarSalida() {
  try {
    const productoId = document.getElementById('salidaProducto').value;
    const fecha = document.getElementById('salidaFecha').value;
    const cantidad = parseInt(document.getElementById('salidaCantidad').value);
    const destinatario = document.getElementById('salidaDestinatario').value;
    const motivo = document.getElementById('salidaMotivo').value;
    
    if (!productoId || !fecha || !cantidad || !destinatario || !motivo) {
      mostrarAlerta('Todos los campos son obligatorios', 'warning');
      return;
    }
    
    // Insertar movimiento en la base de datos
    const { data: movimiento, error: movimientoError } = await supabase
      .from('movimientos')
      .insert([{ 
        producto_id: productoId,
        tipo: 'salida',
        cantidad: cantidad,
        motivo: motivo,
        destinatario: destinatario,
        created_at: fecha ? new Date(fecha).toISOString() : null,
        usuario: 'Usuario actual' // Reemplazar con sistema de autenticación
      }])
      .select();
    
    if (movimientoError) throw movimientoError;
    
    // Actualizar stock (restar cantidad)
    const { error: stockError } = await supabase.rpc('actualizar_stock', {
      p_producto_id: productoId,
      p_cantidad: -cantidad
    });
    
    if (stockError) throw stockError;
    
    mostrarAlerta('Salida de producto registrada correctamente', 'success');
    document.getElementById('salidaForm').reset();
    document.getElementById('salidaFecha').valueAsDate = new Date();
    
    cargarMovimientos();
    
  } catch (error) {
    console.error('Error al registrar salida:', error);
    mostrarAlerta('Error al registrar salida de producto', 'error');
  }
}

async function prepararDevolucion(id) {
  try {
    const { data: movimiento, error } = await supabase
      .from('movimientos')
      .select(`
        id, 
        cantidad, 
        producto_id,
        productos (id, nombre)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    document.getElementById('devolucionMovimientoId').value = movimiento.id;
    document.getElementById('devolucionProducto').value = movimiento.productos.nombre;
    document.getElementById('devolucionCantidadOriginal').value = movimiento.cantidad;
    document.getElementById('devolucionCantidad').value = movimiento.cantidad;
    document.getElementById('devolucionCantidad').max = movimiento.cantidad;
    
    const modal = new bootstrap.Modal(document.getElementById('devolucionModal'));
    modal.show();
    
  } catch (error) {
    console.error('Error al preparar devolución:', error);
    mostrarAlerta('Error al preparar datos para la devolución', 'error');
  }
}

async function confirmarDevolucion() {
  try {
    const movimientoId = document.getElementById('devolucionMovimientoId').value;
    const cantidad = parseInt(document.getElementById('devolucionCantidad').value);
    const cantidadOriginal = parseInt(document.getElementById('devolucionCantidadOriginal').value);
    const motivo = document.getElementById('devolucionMotivo').value;
    
    if (!cantidad || !motivo) {
      mostrarAlerta('Todos los campos son obligatorios', 'warning');
      return;
    }
    
    if (cantidad > cantidadOriginal) {
      mostrarAlerta('La cantidad a devolver no puede ser mayor que la cantidad original', 'warning');
      return;
    }
    
    // Obtener información del movimiento original
    const { data: movimientoOriginal, error: errorConsulta } = await supabase
      .from('movimientos')
      .select('*')
      .eq('id', movimientoId)
      .single();
    
    if (errorConsulta) throw errorConsulta;
    
    // Insertar movimiento de devolución
    const { error: movimientoError } = await supabase
      .from('movimientos')
      .insert([{ 
        producto_id: movimientoOriginal.producto_id,
        tipo: 'devolucion',
        cantidad: cantidad,
        motivo: `Devolución de movimiento #${movimientoId}: ${motivo}`,
        usuario: 'Usuario actual' // Reemplazar con sistema de autenticación
      }]);
    
    if (movimientoError) throw movimientoError;
    
    // Actualizar stock (sumar cantidad devuelta)
    const { error: stockError } = await supabase.rpc('actualizar_stock', {
      p_producto_id: movimientoOriginal.producto_id,
      p_cantidad: cantidad
    });
    
    if (stockError) throw stockError;
    
    mostrarAlerta('Devolución registrada correctamente', 'success');
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('devolucionModal'));
    modal.hide();
    
    cargarMovimientos();
    
    // Emitir evento personalizado para actualizar stock si es necesario
    const eventStockUpdate = new CustomEvent('stockUpdated');
    document.dispatchEvent(eventStockUpdate);
    
  } catch (error) {
    console.error('Error al registrar devolución:', error);
    mostrarAlerta('Error al registrar devolución', 'error');
  }
}

function mostrarAlerta(mensaje, tipo) {
  Swal.fire({
    title: mensaje,
    icon: tipo,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000
  });
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatearFecha(fechaIso) {
  const fecha = new Date(fechaIso);
  return new Intl.DateTimeFormat('es-MX', { 
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(fecha);
}
