// js/reportes.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', function() {
  initializeDatePickers();
  loadFiltersData();
  attachEventHandlers();
});

function initializeDatePickers() {
  // Initialize all date pickers
  const datePickerOptions = {
    autoUpdateInput: false,
    locale: {
      cancelLabel: 'Limpiar',
      applyLabel: 'Aplicar',
      format: 'DD/MM/YYYY'
    }
  };
  
  // Initialize for each report section
  ['movimientos', 'productos', 'proveedores'].forEach(section => {
    $(`#${section}StartDate`).daterangepicker({
      singleDatePicker: true,
      ...datePickerOptions
    });
    
    $(`#${section}EndDate`).daterangepicker({
      singleDatePicker: true,
      ...datePickerOptions
    });
    
    $(`#${section}StartDate`).on('apply.daterangepicker', function(ev, picker) {
      $(this).val(picker.startDate.format('DD/MM/YYYY'));
    });
    
    $(`#${section}EndDate`).on('apply.daterangepicker', function(ev, picker) {
      $(this).val(picker.endDate.format('DD/MM/YYYY'));
    });
    
    $(`#${section}StartDate, #${section}EndDate`).on('cancel.daterangepicker', function() {
      $(this).val('');
    });
  });
}

async function loadFiltersData() {
  try {
    // Load products for movimientos filter
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('id, nombre')
      .order('nombre');
      
    if (productosError) throw productosError;
    
    const productoSelect = document.getElementById('movimientosProducto');
    productos.forEach(producto => {
      const option = document.createElement('option');
      option.value = producto.id;
      option.textContent = producto.nombre;
      productoSelect.appendChild(option);
    });
    
    // Load categories for stock filter
    const { data: categorias, error: categoriasError } = await supabase
      .from('productos')
      .select('categoria')
      .not('categoria', 'is', null);
      
    if (categoriasError) throw categoriasError;
    
    // Extract unique categories
    const uniqueCategorias = [...new Set(categorias.map(item => item.categoria))];
    
    const categoriaSelect = document.getElementById('stockCategoria');
    uniqueCategorias.forEach(categoria => {
      const option = document.createElement('option');
      option.value = categoria;
      option.textContent = categoria;
      categoriaSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error loading filter data:', error);
    mostrarAlerta('Error al cargar datos de filtros', 'error');
  }
}

function attachEventHandlers() {
  // Movimientos report
  document.getElementById('generarReporteMovimientos').addEventListener('click', generarReporteMovimientos);
  document.getElementById('exportMovimientosExcel').addEventListener('click', () => exportToExcel('movimientosTable', 'Reporte_Movimientos'));
  document.getElementById('exportMovimientosPDF').addEventListener('click', () => exportToPDF('movimientosTable', 'Reporte_Movimientos'));
  
  // Productos report
  document.getElementById('generarReporteProductos').addEventListener('click', generarReporteProductos);
  document.getElementById('exportProductosExcel').addEventListener('click', () => exportToExcel('productosTable', 'Reporte_Productos'));
  document.getElementById('exportProductosPDF').addEventListener('click', () => exportToPDF('productosTable', 'Reporte_Productos'));
  
  // Stock report
  document.getElementById('generarReporteStock').addEventListener('click', generarReporteStock);
  document.getElementById('exportStockExcel').addEventListener('click', () => exportToExcel('stockTable', 'Reporte_Stock'));
  document.getElementById('exportStockPDF').addEventListener('click', () => exportToPDF('stockTable', 'Reporte_Stock'));
  
  // Proveedores report
  document.getElementById('generarReporteProveedores').addEventListener('click', generarReporteProveedores);
  document.getElementById('exportProveedoresExcel').addEventListener('click', () => exportToExcel('proveedoresTable', 'Reporte_Proveedores'));
  document.getElementById('exportProveedoresPDF').addEventListener('click', () => exportToPDF('proveedoresTable', 'Reporte_Proveedores'));
}

async function generarReporteMovimientos() {
  try {
    const startDate = document.getElementById('movimientosStartDate').value;
    const endDate = document.getElementById('movimientosEndDate').value;
    const productoId = document.getElementById('movimientosProducto').value;
    
    let query = supabase
      .from('movimientos')
      .select(`
        id, 
        fecha, 
        tipo, 
        cantidad, 
        precio,
        usuario,
        notas,
        productos(nombre)
      `)
      .order('fecha', { ascending: false });
    
    // Apply filters if they exist
    if (startDate) {
      const formattedStartDate = formatDateForQuery(startDate);
      query = query.gte('fecha', formattedStartDate);
    }
    
    if (endDate) {
      const formattedEndDate = formatDateForQuery(endDate, true);
      query = query.lte('fecha', formattedEndDate);
    }
    
    if (productoId) {
      query = query.eq('producto_id', productoId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('movimientosTableBody');
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No se encontraron registros</td></tr>';
      return;
    }
    
    data.forEach(movimiento => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${movimiento.id}</td>
        <td>${formatearFecha(movimiento.fecha)}</td>
        <td>${movimiento.productos?.nombre || '-'}</td>
        <td>${movimiento.tipo}</td>
        <td>${movimiento.cantidad}</td>
        <td>$${parseFloat(movimiento.precio || 0).toFixed(2)}</td>
        <td>${movimiento.usuario || '-'}</td>
        <td>${movimiento.notas || '-'}</td>
      `;
      tableBody.appendChild(row);
    });
    
    mostrarAlerta('Reporte generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generating movimientos report:', error);
    mostrarAlerta('Error al generar reporte de movimientos', 'error');
  }
}

async function generarReporteProductos() {
  try {
    const startDate = document.getElementById('productosStartDate').value;
    const endDate = document.getElementById('productosEndDate').value;
    
    let query = supabase
      .from('productos')
      .select('*')
      .order('nombre');
    
    // Apply filters if they exist
    if (startDate) {
      const formattedStartDate = formatDateForQuery(startDate);
      query = query.gte('fecha_ingreso', formattedStartDate);
    }
    
    if (endDate) {
      const formattedEndDate = formatDateForQuery(endDate, true);
      query = query.lte('fecha_ingreso', formattedEndDate);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('productosTableBody');
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron registros</td></tr>';
      return;
    }
    
    data.forEach(producto => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${producto.id}</td>
        <td>${producto.nombre}</td>
        <td>${producto.categoria || '-'}</td>
        <td>${producto.stock || '0'}</td>
        <td>$${parseFloat(producto.precio || 0).toFixed(2)}</td>
        <td>${formatearFecha(producto.fecha_ingreso)}</td>
        <td>${producto.descripcion || '-'}</td>
      `;
      tableBody.appendChild(row);
    });
    
    mostrarAlerta('Reporte generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generating productos report:', error);
    mostrarAlerta('Error al generar reporte de productos', 'error');
  }
}

async function generarReporteStock() {
  try {
    const categoria = document.getElementById('stockCategoria').value;
    
    let query = supabase
      .from('productos')
      .select('id, nombre, categoria, stock, stock_minimo, precio')
      .order('nombre');
    
    if (categoria) {
      query = query.eq('categoria', categoria);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('stockTableBody');
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron registros</td></tr>';
      return;
    }
    
    data.forEach(producto => {
      const valorTotal = parseFloat(producto.precio || 0) * parseInt(producto.stock || 0);
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${producto.id}</td>
        <td>${producto.nombre}</td>
        <td>${producto.categoria || '-'}</td>
        <td>${producto.stock || '0'}</td>
        <td>${producto.stock_minimo || '0'}</td>
        <td>$${parseFloat(producto.precio || 0).toFixed(2)}</td>
        <td>$${valorTotal.toFixed(2)}</td>
      `;
      tableBody.appendChild(row);
    });
    
    mostrarAlerta('Reporte generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generating stock report:', error);
    mostrarAlerta('Error al generar reporte de stock', 'error');
  }
}

async function generarReporteProveedores() {
  try {
    const startDate = document.getElementById('proveedoresStartDate').value;
    const endDate = document.getElementById('proveedoresEndDate').value;
    
    let query = supabase
      .from('proveedores')
      .select('*')
      .order('nombre');
    
    // Apply filters if they exist
    if (startDate) {
      const formattedStartDate = formatDateForQuery(startDate);
      query = query.gte('fecha_registro', formattedStartDate);
    }
    
    if (endDate) {
      const formattedEndDate = formatDateForQuery(endDate, true);
      query = query.lte('fecha_registro', formattedEndDate);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('proveedoresTableBody');
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron registros</td></tr>';
      return;
    }
    
    data.forEach(proveedor => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${proveedor.id}</td>
        <td>${proveedor.nombre}</td>
        <td>${proveedor.contacto || '-'}</td>
        <td>${proveedor.telefono || '-'}</td>
        <td>${proveedor.email || '-'}</td>
        <td>${proveedor.direccion || '-'}</td>
        <td>${proveedor.productos_ofrecidos || '-'}</td>
      `;
      tableBody.appendChild(row);
    });
    
    mostrarAlerta('Reporte generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generating proveedores report:', error);
    mostrarAlerta('Error al generar reporte de proveedores', 'error');
  }
}

function exportToExcel(tableId, fileName) {
  try {
    const table = document.getElementById(tableId);
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `${fileName}_${formatDateFileName()}.xlsx`);
    
    mostrarAlerta('Archivo Excel generado correctamente', 'success');
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    mostrarAlerta('Error al exportar a Excel', 'error');
  }
}

function exportToPDF(tableId, fileName) {
  try {
    const { jsPDF } = window.jspdf;
    const { autoTable } = window.jspdf.autoTable;
    
    const doc = new jsPDF();
    autoTable(doc, { html: `#${tableId}` });
    doc.save(`${fileName}_${formatDateFileName()}.pdf`);
    
    mostrarAlerta('Archivo PDF generado correctamente', 'success');
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    mostrarAlerta('Error al exportar a PDF', 'error');
  }
}

function formatDateForQuery(dateStr, isEndDate = false) {
  // Convert DD/MM/YYYY to YYYY-MM-DD
  const parts = dateStr.split('/');
  let formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  
  // If it's an end date, set it to the end of the day
  if (isEndDate) {
    formattedDate += 'T23:59:59';
  } else {
    formattedDate += 'T00:00:00';
  }
  
  return formattedDate;
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

function formatDateFileName() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
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
