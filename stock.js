import { createClient } from '@supabase/supabase-js'
import Swal from 'sweetalert2'

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)


document.addEventListener('DOMContentLoaded', function() {
  cargarStock();
  
  // Listen for stock updates from other pages
  document.addEventListener('stockUpdated', function() {
    cargarStock();
  });
});

async function cargarStock() {
  try {
    const { data: productos, error } = await supabase
      .from('productos')
      .select('id, nombre, categoria, precio, stock, proveedor, fecha_ingreso, ubicacion')
      .order('nombre');
    
    if (error) throw error;
    
    const tableBody = document.getElementById('stockTableBody');
    tableBody.innerHTML = '';
    
    productos.forEach(producto => {
      const row = document.createElement('tr');
      
      // Determinar la clase de stock basada en el nivel
      let stockClass = '';
      if (producto.stock <= 10) {
        stockClass = 'stock-low';
      } else if (producto.stock <= 20) {
        stockClass = 'stock-medium';
      } else {
        stockClass = 'stock-high';
      }
      
      // Aplicar la clase al row
      row.className = stockClass;
      
      row.innerHTML = `
        <td>${producto.nombre}</td>
        <td>${producto.categoria || '-'}</td>
        <td>$${producto.precio ? parseFloat(producto.precio).toFixed(2) : '0.00'}</td>
        <td>${producto.stock}</td>
        <td>${producto.proveedor || '-'}</td>
        <td>${producto.fecha_ingreso ? formatearFecha(producto.fecha_ingreso) : '-'}</td>
        <td>${producto.ubicacion || '-'}</td>
      `;
      
      tableBody.appendChild(row);
    });
    
  } catch (error) {
    console.error('Error al cargar stock:', error);
    mostrarAlerta('Error al cargar datos de stock', 'error');
  }
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return '-';
  const fecha = new Date(fechaIso);
  return new Intl.DateTimeFormat('es-MX', { 
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(fecha);
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
