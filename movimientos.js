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
    
    // Limpiar selects primero
    selectProducto.innerHTML = '<option value="">Seleccionar producto</option>';
    editSelectProducto.innerHTML = '<option value="">Seleccionar producto</option>';
    salidaProductoSelect.innerHTML = '<option value="">Seleccionar producto</option>';
    
    productos.forEach(producto => {
      const option = new Option(producto.nombre, producto.id);
      const editOption = new Option(producto.nombre, producto.id);
      const salidaOption = new Option(producto.nombre, producto.id);
      
      selectProducto.add(option);
      editSelectProducto.add(editOption);
      salidaProductoSelect.add(salidaOption);
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
          <button class="btn btn-sm btn-info devolucion-btn" data-id="${movimiento.id}">
            <i class="fas fa-undo"></i> Devolución
          </button>
        `;
      }
      
      row.innerHTML = `
        <td>${movimiento.id}</td>
        <td>${movimiento.productos?.nombre || 'Producto eliminado'}</td>
        <td><span class="badge ${getBadgeClass(movimiento.tipo)}">${capitalizar(movimiento.tipo)}</span></td>
        <td>${movimiento.cantidad}</td>
        <td>${movimiento.motivo || ''}${movimiento.destinatario ? '<br><small class="text-muted">Destinatario: ' + movimiento.destinatario + '</small>' : ''}</td>
        <td>${movimiento.usuario || 'Sistema'}</td>
        <td>${formatearFecha(movimiento.created_at)}</td>
        <td class="text-nowrap">
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

function getBadgeClass(tipo) {
  switch(tipo) {
    case 'entrada': return 'bg-success';
    case 'salida': return 'bg-danger';
    case 'devolucion': return 'bg-info';
    case 'ajuste': return 'bg-warning';
    default: return 'bg-secondary';
  }
}

async function registrarMovimiento() {
  try {
    const productoId = document.getElementById('movementProduct').value;
    const tipo = document.getElementById('movementType').value;
    const cantidad = parseInt(document.getElementById('movementQuantity').value);
    const motivo = document.getElementById('movementReason').value;
    const destinatario = tipo === 'salida' ? document.getElementById('movementRecipient').value : null;
    
    if (!productoId || !tipo || !cantidad || !motivo || (tipo === 'salida' && !destinatario)) {
      mostrarAlerta('Todos los campos obligatorios deben estar completos', 'warning');
      return;
    }
    
    // Insertar movimiento en la base de datos
    const movimientoData = {
      producto_id: productoId,
      tipo: tipo,
      cantidad: cantidad,
      motivo: motivo,
      usuario: 'Usuario actual', // Reemplazar con sistema de autenticación
      ...(destinatario && { destinatario: destinatario }) // Solo agregar destinatario si existe
    };

    const { data: movimiento, error: movimientoError } = await supabase
      .from('movimientos')
      .insert([movimientoData])
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
    mostrarAlerta('Error al registrar movimiento: ' + error.message, 'error');
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
    document.getElementById('editMovementRecipient').value = movimiento.destinatario || '';
    
    // Mostrar/ocultar campo destinatario según tipo
    toggleDestinatarioField(movimiento.tipo);
    
    const modal = new bootstrap.Modal(document.getElementById('editMovementModal'));
    modal.show();
    
  } catch (error) {
    console.error('Error al cargar movimiento para editar:', error);
    mostrarAlerta('Error al cargar datos del movimiento', 'error');
  }
}

function toggleDestinatarioField(tipo) {
  const destinatarioGroup = document.getElementById('editMovementRecipientGroup');
  if (tipo === 'salida') {
    destinatarioGroup.style.display = 'block';
  } else {
    destinatarioGroup.style.display = 'none';
  }
}

async function actualizarMovimiento() {
  try {
    const id = document.getElementById('editMovementId').value;
    const productoId = document.getElementById('editMovementProduct').value;
    const tipo = document.getElementById('editMovementType').value;
    const cantidad = parseInt(document.getElementById('editMovementQuantity').value);
    const motivo = document.getElementById('editMovementReason').value;
    const destinatario = tipo === 'salida' ? document.getElementById('editMovementRecipient').value : null;
    
    if (!productoId || !tipo || !cantidad || !motivo || (tipo === 'salida' && !destinatario)) {
      mostrarAlerta('Todos los campos obligatorios deben estar completos', 'warning');
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
    const updateData = {
      producto_id: productoId,
      tipo: tipo,
      cantidad: cantidad,
      motivo: motivo,
      ...(destinatario && { destinatario: destinatario }) // Solo agregar destinatario si existe
    };

    const { error: updateError } = await supabase
      .from('movimientos')
      .update(updateData)
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
    mostrarAlerta('Error al actualizar movimiento: ' + error.message, 'error');
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
    
    // Verificar stock disponible
    const { data: producto, error: productoError } = await supabase
      .from('productos')
      .select('cantidad')
      .eq('id', productoId)
      .single();
    
    if (productoError) throw productoError;
    if (producto.cantidad < cantidad) {
      throw new Error(`Stock insuficiente. Disponible: ${producto.cantidad}`);
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
        created_at: fecha ? new Date(fecha).toISOString() : new Date().toISOString(),
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
    
    // Emitir evento para actualizar otras vistas
    const event = new CustomEvent('stockUpdated');
    document.dispatchEvent(event);
    
  } catch (error) {
    console.error('Error al registrar salida:', error);
    mostrarAlerta(error.message || 'Error al registrar salida de producto', 'error');
  }
}

// Las funciones confirmarEliminarMovimiento, eliminarMovimiento, prepararDevolucion, 
// confirmarDevolucion, mostrarAlerta, capitalizar y formatearFecha permanecen iguales
// a como las tenías en tu código original, solo asegúrate de que estén definidas

// Función para inicializar event listeners en los selects
function setupEventListeners() {
  // Mostrar/ocultar campo destinatario según tipo de movimiento
  document.getElementById('movementType').addEventListener('change', function() {
    const destinatarioGroup = document.getElementById('movementRecipientGroup');
    destinatarioGroup.style.display = this.value === 'salida' ? 'block' : 'none';
  });

  document.getElementById('editMovementType').addEventListener('change', function() {
    const destinatarioGroup = document.getElementById('editMovementRecipientGroup');
    destinatarioGroup.style.display = this.value === 'salida' ? 'block' : 'none';
  });
}

// Inicializar event listeners cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', setupEventListeners);
