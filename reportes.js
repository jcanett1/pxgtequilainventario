// js/reportes.js - Versión completa actualizada
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

// Establece el rango de fechas por defecto (últimos 30 días)
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
    // Cargar productos para filtro de movimientos (si existe la tabla)
    try {
      const { data: productos, error: productosError } = await supabase
        .from('productos')
        .select('id, nombre')
        .order('nombre', { ascending: true });
        
      if (!productosError && productos) {
        const productoSelect = document.getElementById('movimientosProducto');
        if (productoSelect) {
          productos.forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.id;
            option.textContent = producto.nombre;
            productoSelect.appendChild(option);
          });
        }
      }
    } catch (e) {
      console.log('Tabla productos no disponible:', e.message);
    }
    
    // Cargar categorías para filtro de stock (si existe la tabla)
    try {
      const { data: categorias, error: categoriasError } = await supabase
        .from('categorias')
        .select('id, nombre')
        .order('nombre', { ascending: true });
        
      if (!categoriasError && categorias) {
        const categoriaSelect = document.getElementById('stockCategoria');
        if (categoriaSelect) {
          categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.nombre;
            categoriaSelect.appendChild(option);
          });
        }
      }
    } catch (e) {
      console.log('Tabla categorias no disponible:', e.message);
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
  
  // Reporte de proveedores
  addListener('generarReporteProveedores', 'click', generarReporteProveedores);
  addListener('exportProveedoresExcel', 'click', () => exportToExcel('proveedoresTable', 'Reporte_Proveedores'));
  addListener('exportProveedoresPDF', 'click', () => exportToPDF('proveedoresTable', 'Reporte_Proveedores'));
  
  // Deshabilitar reportes no disponibles
  ['productos', 'stock'].forEach(section => {
    const btnGenerate = document.getElementById(`generarReporte${section.charAt(0).toUpperCase() + section.slice(1)}`);
    const btnExcel = document.getElementById(`export${section.charAt(0).toUpperCase() + section.slice(1)}Excel`);
    const btnPDF = document.getElementById(`export${section.charAt(0).toUpperCase() + section.slice(1)}PDF`);
    
    if (btnGenerate) btnGenerate.disabled = true;
    if (btnExcel) btnExcel.disabled = true;
    if (btnPDF) btnPDF.disabled = true;
  });
}

// Genera el reporte de movimientos
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

// Genera el reporte de proveedores
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
