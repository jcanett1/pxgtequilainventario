// js/reportes.js - Versión completa y corregida
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', function() {
  loadFiltersData();
  attachEventHandlers();
  setDefaultDateRange();
});

// Función para mostrar alertas
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

// Establece el rango de fechas por defecto (últimos 30 días)
function setDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const formatDate = (date) => date.toISOString().split('T')[0];
  
  ['movimientos', 'productos', 'proveedores'].forEach(section => {
    document.getElementById(`${section}StartDate`).value = formatDate(startDate);
    document.getElementById(`${section}EndDate`).value = formatDate(endDate);
  });
}

// Carga los datos para los filtros
async function loadFiltersData() {
  try {
    // Cargar productos para filtro de movimientos
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('id, nombre')
      .order('nombre', { ascending: true });
      
    if (productosError) throw productosError;
    
    const productoSelect = document.getElementById('movimientosProducto');
    productos.forEach(producto => {
      const option = document.createElement('option');
      option.value = producto.id;
      option.textContent = producto.nombre;
      productoSelect.appendChild(option);
    });
    
    // Cargar categorías para filtro de stock
    const { data: categorias, error: categoriasError } = await supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre', { ascending: true });
      
    if (categoriasError) throw categoriasError;
    
    const categoriaSelect = document.getElementById('stockCategoria');
    categorias.forEach(categoria => {
      const option = document.createElement('option');
      option.value = categoria.id;
      option.textContent = categoria.nombre;
      categoriaSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error cargando datos de filtros:', error);
    mostrarAlerta('Error al cargar datos de filtros', 'error');
  }
}

// Asigna los manejadores de eventos
function attachEventHandlers() {
  // Reporte de movimientos
  document.getElementById('generarReporteMovimientos').addEventListener('click', generarReporteMovimientos);
  document.getElementById('exportMovimientosExcel').addEventListener('click', () => exportToExcel('movimientosTable', 'Reporte_Movimientos'));
  document.getElementById('exportMovimientosPDF').addEventListener('click', () => exportToPDF('movimientosTable', 'Reporte_Movimientos'));
  
  // Reporte de productos
  document.getElementById('generarReporteProductos').addEventListener('click', generarReporteProductos);
  document.getElementById('exportProductosExcel').addEventListener('click', () => exportToExcel('productosTable', 'Reporte_Productos'));
  document.getElementById('exportProductosPDF').addEventListener('click', () => exportToPDF('productosTable', 'Reporte_Productos'));
  
  // Reporte de stock
  document.getElementById('generarReporteStock').addEventListener('click', generarReporteStock);
  document.getElementById('exportStockExcel').addEventListener('click', () => exportToExcel('stockTable', 'Reporte_Stock'));
  document.getElementById('exportStockPDF').addEventListener('click', () => exportToPDF('stockTable', 'Reporte_Stock'));
  
  // Reporte de proveedores
  document.getElementById('generarReporteProveedores').addEventListener('click', generarReporteProveedores);
  document.getElementById('exportProveedoresExcel').addEventListener('click', () => exportToExcel('proveedoresTable', 'Reporte_Proveedores'));
  document.getElementById('exportProveedoresPDF').addEventListener('click', () => exportToPDF('proveedoresTable', 'Reporte_Proveedores'));
}

// Genera el reporte de movimientos
async function generarReporteMovimientos() {
  try {
    const startDate = document.getElementById('movimientosStartDate').value;
    const endDate = document.getElementById('movimientosEndDate').value;
    const productoId = document.getElementById('movimientosProducto').value;
    
    let query = supabase
      .from('movimientos')
      .select(`
        id, 
        created_at, 
        tipo, 
        cantidad, 
        precio,
        usuario,
        notas,
        productos(nombre)
      `)
      .order('created_at', { ascending: false });
    
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);
    if (productoId) query = query.eq('producto_id', productoId);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('movimientosTableBody');
    tableBody.innerHTML = data.length === 0 
      ? '<tr><td colspan="8" class="text-center">No se encontraron registros</td></tr>'
      : data.map(movimiento => `
          <tr>
            <td>${movimiento.id}</td>
            <td>${formatearFecha(movimiento.created_at)}</td>
            <td>${movimiento.productos?.nombre || '-'}</td>
            <td>${movimiento.tipo}</td>
            <td>${movimiento.cantidad}</td>
            <td>$${parseFloat(movimiento.precio || 0).toFixed(2)}</td>
            <td>${movimiento.usuario || '-'}</td>
            <td>${movimiento.notas || '-'}</td>
          </tr>
        `).join('');
    
    mostrarAlerta('Reporte de movimientos generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generando reporte de movimientos:', error);
    mostrarAlerta(`Error al generar reporte: ${error.message}`, 'error');
  }
}

// Genera el reporte de productos
async function generarReporteProductos() {
  try {
    const startDate = document.getElementById('productosStartDate').value;
    const endDate = document.getElementById('productosEndDate').value;
    
    let query = supabase
      .from('productos')
      .select('*')
      .order('nombre');
    
    if (startDate) query = query.gte('fecha_ingreso', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('fecha_ingreso', `${endDate}T23:59:59`);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('productosTableBody');
    tableBody.innerHTML = data.length === 0 
      ? '<tr><td colspan="7" class="text-center">No se encontraron registros</td></tr>'
      : data.map(producto => `
          <tr>
            <td>${producto.id}</td>
            <td>${producto.nombre}</td>
            <td>${producto.categoria || '-'}</td>
            <td>${producto.stock || '0'}</td>
            <td>$${parseFloat(producto.precio || 0).toFixed(2)}</td>
            <td>${formatearFecha(producto.fecha_ingreso)}</td>
            <td>${producto.descripcion || '-'}</td>
          </tr>
        `).join('');
    
    mostrarAlerta('Reporte de productos generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generando reporte de productos:', error);
    mostrarAlerta('Error al generar reporte de productos', 'error');
  }
}

// Genera el reporte de stock
async function generarReporteStock() {
  try {
    const categoria = document.getElementById('stockCategoria').value;
    
    let query = supabase
      .from('productos')
      .select('id, nombre, categoria, stock, stock_minimo, precio')
      .order('nombre');
    
    if (categoria) query = query.eq('categoria', categoria);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('stockTableBody');
    tableBody.innerHTML = data.length === 0 
      ? '<tr><td colspan="7" class="text-center">No se encontraron registros</td></tr>'
      : data.map(producto => {
          const valorTotal = parseFloat(producto.precio || 0) * parseInt(producto.stock || 0);
          return `
            <tr>
              <td>${producto.id}</td>
              <td>${producto.nombre}</td>
              <td>${producto.categoria || '-'}</td>
              <td>${producto.stock || '0'}</td>
              <td>${producto.stock_minimo || '0'}</td>
              <td>$${parseFloat(producto.precio || 0).toFixed(2)}</td>
              <td>$${valorTotal.toFixed(2)}</td>
            </tr>
          `;
        }).join('');
    
    mostrarAlerta('Reporte de stock generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generando reporte de stock:', error);
    mostrarAlerta('Error al generar reporte de stock', 'error');
  }
}

// Genera el reporte de proveedores
async function generarReporteProveedores() {
  try {
    const startDate = document.getElementById('proveedoresStartDate').value;
    const endDate = document.getElementById('proveedoresEndDate').value;
    
    let query = supabase
      .from('proveedores')
      .select('*')
      .order('nombre');
    
    if (startDate) query = query.gte('fecha_registro', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('fecha_registro', `${endDate}T23:59:59`);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('proveedoresTableBody');
    tableBody.innerHTML = data.length === 0 
      ? '<tr><td colspan="7" class="text-center">No se encontraron registros</td></tr>'
      : data.map(proveedor => `
          <tr>
            <td>${proveedor.id}</td>
            <td>${proveedor.nombre}</td>
            <td>${proveedor.contacto || '-'}</td>
            <td>${proveedor.telefono || '-'}</td>
            <td>${proveedor.email || '-'}</td>
            <td>${proveedor.direccion || '-'}</td>
            <td>${proveedor.productos_ofrecidos || '-'}</td>
          </tr>
        `).join('');
    
    mostrarAlerta('Reporte de proveedores generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generando reporte de proveedores:', error);
    mostrarAlerta('Error al generar reporte de proveedores', 'error');
  }
}

// Exporta a Excel
function exportToExcel(tableId, fileName) {
  try {
    const table = document.getElementById(tableId);
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarAlerta('Archivo Excel generado correctamente', 'success');
  } catch (error) {
    console.error('Error exportando a Excel:', error);
    mostrarAlerta('Error al exportar a Excel', 'error');
  }
}

// Exporta a PDF
function exportToPDF(tableId, fileName) {
  try {
    const { jsPDF } = window.jspdf;
    const { autoTable } = window.jspdf.autoTable;
    const doc = new jsPDF();
    autoTable(doc, { html: `#${tableId}` });
    doc.save(`${fileName}_${new Date().toISOString().slice(0,10)}.pdf`);
    mostrarAlerta('Archivo PDF generado correctamente', 'success');
  } catch (error) {
    console.error('Error exportando a PDF:', error);
    mostrarAlerta('Error al exportar a PDF', 'error');
  }
}

// Formatea fechas para visualización
function formatearFecha(fechaIso) {
  if (!fechaIso) return '-';
  const fecha = new Date(fechaIso);
  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
