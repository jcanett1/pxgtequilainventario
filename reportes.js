// js/reportes.js - Versión completa con reportes de productos y stock actualizados
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm'
import autoTable from 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.28/+esm'

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

// Establece el rango de fechas por defecto (solo para movimientos y proveedores)
function setDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const formatDate = (date) => date.toISOString().split('T')[0];
  
  ['movimientos', 'proveedores'].forEach(section => {
    const startElement = document.getElementById(`${section}StartDate`);
    const endElement = document.getElementById(`${section}EndDate`);
    
    if (startElement && endElement) {
      startElement.value = formatDate(startDate);
      endElement.value = formatDate(endDate);
    }
  });
}

// Carga los datos para los filtros
async function loadFiltersData() {
  try {
    // Cargar productos para todos los filtros
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('id, nombre, categoria, precio, stock')
      .order('nombre', { ascending: true });
      
    if (!productosError && productos) {
      // Para filtro de movimientos
      const productoMovSelect = document.getElementById('movimientosProducto');
      if (productoMovSelect) {
        productos.forEach(producto => {
          const option = document.createElement('option');
          option.value = producto.id;
          option.textContent = `${producto.nombre} (${producto.categoria || 'Sin categoría'})`;
          productoMovSelect.appendChild(option);
        });
      }
      
      // Para filtro de productos
      const productoProdSelect = document.getElementById('productosProducto');
      if (productoProdSelect) {
        productos.forEach(producto => {
          const option = document.createElement('option');
          option.value = producto.id;
          option.textContent = `${producto.nombre} (${producto.categoria || 'Sin categoría'})`;
          productoProdSelect.appendChild(option);
        });
      }
      
      // Para filtro de stock
      const productoStockSelect = document.getElementById('stockProducto');
      if (productoStockSelect) {
        productos.forEach(producto => {
          const option = document.createElement('option');
          option.value = producto.id;
          option.textContent = `${producto.nombre} (${producto.categoria || 'Sin categoría'})`;
          productoStockSelect.appendChild(option);
        });
      }
    }
    
    // Cargar categorías para filtros
    const { data: categorias, error: categoriasError } = await supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre', { ascending: true });
      
    if (!categoriasError && categorias) {
      const categoriaSelect = document.getElementById('productosCategoria');
      if (categoriaSelect) {
        categorias.forEach(categoria => {
          const option = document.createElement('option');
          option.value = categoria.id;
          option.textContent = categoria.nombre;
          categoriaSelect.appendChild(option);
        });
      }
    }
    
  } catch (error) {
    console.error('Error cargando datos de filtros:', error);
    mostrarAlerta('Error al cargar datos de filtros', 'error');
  }
}

// Asigna los manejadores de eventos
function attachEventHandlers() {
  const addListener = (id, event, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
    }
  };

  // Reporte de movimientos
  addListener('generarReporteMovimientos', 'click', generarReporteMovimientos);
  addListener('exportMovimientosExcel', 'click', () => exportToExcel('movimientosTable', 'Reporte_Movimientos'));
  addListener('exportMovimientosPDF', 'click', () => exportToPDF('movimientosTable', 'Reporte_Movimientos'));
  
  // Reporte de productos
  addListener('generarReporteProductos', 'click', generarReporteProductos);
  addListener('exportProductosExcel', 'click', () => exportToExcel('productosTable', 'Reporte_Productos'));
  addListener('exportProductosPDF', 'click', () => exportToPDF('productosTable', 'Reporte_Productos'));
  
  // Reporte de stock
  addListener('generarReporteStock', 'click', generarReporteStock);
  addListener('exportStockExcel', 'click', () => exportToExcel('stockTable', 'Reporte_Stock'));
  addListener('exportStockPDF', 'click', () => exportToPDF('stockTable', 'Reporte_Stock'));
  
  // Reporte de proveedores
  addListener('generarReporteProveedores', 'click', generarReporteProveedores);
  addListener('exportProveedoresExcel', 'click', () => exportToExcel('proveedoresTable', 'Reporte_Proveedores'));
  addListener('exportProveedoresPDF', 'click', () => exportToPDF('proveedoresTable', 'Reporte_Proveedores'));
}

// Genera el reporte de movimientos (se mantiene igual)
async function generarReporteMovimientos() {
  try {
    const startDate = document.getElementById('movimientosStartDate')?.value;
    const endDate = document.getElementById('movimientosEndDate')?.value;
    const productoId = document.getElementById('movimientosProducto')?.value;
    
    let query = supabase
      .from('movimientos')
      .select(`
        id, 
        created_at, 
        tipo, 
        cantidad, 
        motivo,
        usuario_id,
        destinatario,
        productos(nombre)
      `)
      .order('created_at', { ascending: false });
    
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);
    if (productoId) query = query.eq('producto_id', productoId);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('movimientosTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = data.length === 0 
      ? '<tr><td colspan="8" class="text-center">No se encontraron registros</td></tr>'
      : data.map(movimiento => `
          <tr>
            <td>${movimiento.id}</td>
            <td>${formatearFecha(movimiento.created_at)}</td>
            <td>${movimiento.productos?.nombre || '-'}</td>
            <td>${movimiento.tipo}</td>
            <td>${movimiento.cantidad}</td>
            <td>${movimiento.motivo || '-'}</td>
            <td>${movimiento.usuario_id ? movimiento.usuario_id.slice(0, 8) : '-'}</td>
            <td>${movimiento.destinatario || '-'}</td>
          </tr>
        `).join('');
    
    mostrarAlerta('Reporte de movimientos generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generando reporte de movimientos:', error);
    mostrarAlerta(`Error al generar reporte de movimientos: ${error.message}`, 'error');
  }
}

// Genera el reporte de productos (modificado para selección por producto/categoría)
async function generarReporteProductos() {
  try {
    const productoId = document.getElementById('productosProducto')?.value;
    const categoriaId = document.getElementById('productosCategoria')?.value;
    
    let query = supabase
      .from('productos')
      .select(`
        id,
        nombre,
        descripcion,
        categoria,
        precio,
        stock,
        created_at
      `)
      .order('nombre', { ascending: true });
    
    if (productoId) query = query.eq('id', productoId);
    if (categoriaId) query = query.eq('categoria_id', categoriaId);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('productosTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = data.length === 0 
      ? '<tr><td colspan="7" class="text-center">No se encontraron productos</td></tr>'
      : data.map(producto => `
          <tr>
            <td>${producto.id}</td>
            <td>${producto.nombre}</td>
            <td>${producto.categoria || 'Sin categoría'}</td>
            <td>${producto.stock || '0'}</td>
            <td>$${parseFloat(producto.precio || 0).toFixed(2)}</td>
            <td>${formatearFecha(producto.created_at)}</td>
            <td>${producto.descripcion || '-'}</td>
          </tr>
        `).join('');
    
    mostrarAlerta('Reporte de productos generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generando reporte de productos:', error);
    mostrarAlerta(`Error al generar reporte de productos: ${error.message}`, 'error');
  }
}

// Genera el reporte de stock (modificado para selección por producto)
async function generarReporteStock() {
  try {
    const productoId = document.getElementById('stockProducto')?.value;
    
    let query = supabase
      .from('productos')
      .select(`
        id,
        nombre,
        categoria,
        stock,
        stock_minimo,
        precio
      `)
      .order('nombre', { ascending: true });
    
    if (productoId) query = query.eq('id', productoId);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('stockTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = data.length === 0 
      ? '<tr><td colspan="7" class="text-center">No se encontraron productos</td></tr>'
      : data.map(producto => {
          const valorTotal = parseFloat(producto.precio || 0) * parseInt(producto.stock || 0);
          const alertaStock = producto.stock_minimo && producto.stock < producto.stock_minimo ? 
            'text-danger fw-bold' : '';
          
          return `
            <tr>
              <td>${producto.id}</td>
              <td>${producto.nombre}</td>
              <td>${producto.categoria || 'Sin categoría'}</td>
              <td class="${alertaStock}">${producto.stock || '0'}</td>
              <td>${producto.stock_minimo || '0'}</td>
              <td>$${parseFloat(producto.precio || 0).toFixed(2)}</td>
              <td>$${valorTotal.toFixed(2)}</td>
            </tr>
          `;
        }).join('');
    
    mostrarAlerta('Reporte de stock generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generando reporte de stock:', error);
    mostrarAlerta(`Error al generar reporte de stock: ${error.message}`, 'error');
  }
}

// Genera el reporte de proveedores (se mantiene igual)
async function generarReporteProveedores() {
  try {
    const startDate = document.getElementById('proveedoresStartDate')?.value;
    const endDate = document.getElementById('proveedoresEndDate')?.value;
    
    let query = supabase
      .from('proveedores')
      .select('id, nombre, contacto, telefono, email, direccion, created_at')
      .order('nombre');
    
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    const tableBody = document.getElementById('proveedoresTableBody');
    if (!tableBody) return;
    
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
            <td>${formatearFecha(proveedor.created_at)}</td>
          </tr>
        `).join('');
    
    mostrarAlerta('Reporte de proveedores generado exitosamente', 'success');
  } catch (error) {
    console.error('Error generando reporte de proveedores:', error);
    mostrarAlerta(`Error al generar reporte de proveedores: ${error.message}`, 'error');
  }
}

// Exporta a Excel
async function exportToExcel(tableId, fileName) {
  try {
    const table = document.getElementById(tableId);
    if (!table) {
      throw new Error('No se encontró la tabla para exportar');
    }
    
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
    mostrarAlerta('Archivo Excel generado correctamente', 'success');
  } catch (error) {
    console.error('Error exportando a Excel:', error);
    mostrarAlerta(`Error al exportar a Excel: ${error.message}`, 'error');
  }
}

// Exporta a PDF
async function exportToPDF(tableId, fileName) {
  try {
    const table = document.getElementById(tableId);
    if (!table) {
      throw new Error('No se encontró la tabla para exportar');
    }
    
    const doc = new jsPDF();
    autoTable(doc, { html: `#${tableId}` });
    doc.save(`${fileName}_${new Date().toISOString().slice(0,10)}.pdf`);
    mostrarAlerta('Archivo PDF generado correctamente', 'success');
  } catch (error) {
    console.error('Error exportando a PDF:', error);
    mostrarAlerta(`Error al exportar a PDF: ${error.message}`, 'error');
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
