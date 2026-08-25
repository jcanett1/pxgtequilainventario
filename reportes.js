import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm'
import autoTable from 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.28/+esm'
import { supabase } from './supabase-client.js'
import { escapeHtml, formatCurrency, formatDate, friendlyError, showToast } from './ui-utils.js'

window.addEventListener('DOMContentLoaded', () => {
  loadFiltersData()
  attachEventHandlers()
  setDefaultDateRange()
})

function setDefaultDateRange() {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  const formatInputDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  for (const section of ['movimientos', 'proveedores']) {
    const startElement = document.getElementById(`${section}StartDate`)
    const endElement = document.getElementById(`${section}EndDate`)
    if (startElement && endElement) {
      startElement.value = formatInputDate(startDate)
      endElement.value = formatInputDate(endDate)
    }
  }
}

async function loadFiltersData() {
  try {
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('id, nombre, categoria_id, categorias:categoria_id(nombre)')
      .order('nombre')
    if (productosError) throw productosError

    const filterIds = ['movimientosProducto', 'productosProducto', 'stockProducto']
    filterIds.forEach(id => {
      const select = document.getElementById(id)
      if (!select) return
      select.innerHTML = `<option value="">Todos los productos</option>`
      ;(productos || []).forEach(producto => {
        const option = document.createElement('option')
        option.value = producto.id
        option.textContent = `${producto.nombre} (${producto.categorias?.nombre || 'Sin categoría'})`
        select.appendChild(option)
      })
    })

    const { data: categorias, error: categoriasError } = await supabase.from('categorias').select('id, nombre').order('nombre')
    if (categoriasError) throw categoriasError
    const categoriaSelect = document.getElementById('productosCategoria')
    if (categoriaSelect) {
      categoriaSelect.innerHTML = '<option value="">Todas las categorías</option>'
      ;(categorias || []).forEach(categoria => {
        const option = document.createElement('option')
        option.value = categoria.id
        option.textContent = categoria.nombre
        categoriaSelect.appendChild(option)
      })
    }
  } catch (error) {
    console.error('Error cargando datos de filtros:', error)
    showToast(Swal, 'No se pudieron cargar los filtros: ' + friendlyError(error), 'error')
  }
}

function attachEventHandlers() {
  const addListener = (id, event, handler) => document.getElementById(id)?.addEventListener(event, handler)
  addListener('generarReporteMovimientos', 'click', generarReporteMovimientos)
  addListener('exportMovimientosExcel', 'click', () => exportToExcel('movimientosTable', 'Reporte_Movimientos'))
  addListener('exportMovimientosPDF', 'click', () => exportToPDF('movimientosTable', 'Reporte_Movimientos'))
  addListener('generarReporteProductos', 'click', generarReporteProductos)
  addListener('exportProductosExcel', 'click', () => exportToExcel('productosTable', 'Reporte_Productos'))
  addListener('exportProductosPDF', 'click', () => exportToPDF('productosTable', 'Reporte_Productos'))
  addListener('generarReporteStock', 'click', generarReporteStock)
  addListener('exportStockExcel', 'click', () => exportToExcel('stockTable', 'Reporte_Stock'))
  addListener('exportStockPDF', 'click', () => exportToPDF('stockTable', 'Reporte_Stock'))
  addListener('generarReporteProveedores', 'click', generarReporteProveedores)
  addListener('exportProveedoresExcel', 'click', () => exportToExcel('proveedoresTable', 'Reporte_Proveedores'))
  addListener('exportProveedoresPDF', 'click', () => exportToPDF('proveedoresTable', 'Reporte_Proveedores'))
}

async function generarReporteMovimientos() {
  try {
    const startDate = document.getElementById('movimientosStartDate')?.value
    const endDate = document.getElementById('movimientosEndDate')?.value
    const productoId = document.getElementById('movimientosProducto')?.value
    let query = supabase.from('movimientos').select('id, created_at, tipo, cantidad, motivo, usuario_id, destinatario, productos:producto_id(nombre)').order('created_at', { ascending: false })
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
    if (endDate) query = query.lt('created_at', `${endDate}T23:59:59.999`)
    if (productoId) query = query.eq('producto_id', productoId)

    const { data, error } = await query
    if (error) throw error
    const tableBody = document.getElementById('movimientosTableBody')
    if (!tableBody) return
    tableBody.innerHTML = data?.length ? data.map(movimiento => `
      <tr>
        <td>${escapeHtml(movimiento.id)}</td>
        <td>${formatDate(movimiento.created_at, true)}</td>
        <td>${escapeHtml(movimiento.productos?.nombre || 'Producto eliminado')}</td>
        <td><span class="badge ${movementBadge(movimiento.tipo)}">${escapeHtml(movimiento.tipo || '-')}</span></td>
        <td>${Number(movimiento.cantidad) || 0}</td>
        <td>${escapeHtml(movimiento.motivo || '-')}</td>
        <td>${escapeHtml(movimiento.usuario_id ? movimiento.usuario_id.slice(0, 8) + '…' : 'Sistema')}</td>
        <td>${escapeHtml(movimiento.destinatario || '-')}</td>
      </tr>
    `).join('') : '<tr><td colspan="8" class="text-center text-muted py-4">No se encontraron registros.</td></tr>'
    showToast(Swal, 'Reporte de movimientos generado.', 'success')
  } catch (error) {
    console.error('Error generando reporte de movimientos:', error)
    showToast(Swal, 'Error al generar movimientos: ' + friendlyError(error), 'error')
  }
}

async function generarReporteProductos() {
  try {
    const productoId = document.getElementById('productosProducto')?.value
    const categoriaId = document.getElementById('productosCategoria')?.value
    let query = supabase.from('productos').select('id, nombre, descripcion, categoria_id, cantidad, precio, fecha_ingreso, categorias:categoria_id(nombre)').order('nombre')
    if (productoId) query = query.eq('id', productoId)
    if (categoriaId) query = query.eq('categoria_id', categoriaId)

    const { data, error } = await query
    if (error) throw error
    const tableBody = document.getElementById('productosTableBody')
    if (!tableBody) return
    tableBody.innerHTML = data?.length ? data.map(producto => `
      <tr>
        <td>${escapeHtml(producto.id)}</td>
        <td>${escapeHtml(producto.nombre)}</td>
        <td>${escapeHtml(producto.categorias?.nombre || 'Sin categoría')}</td>
        <td>${Number(producto.cantidad) || 0}</td>
        <td>${formatCurrency(producto.precio)}</td>
        <td>${formatDate(producto.fecha_ingreso)}</td>
        <td>${escapeHtml(producto.descripcion || '-')}</td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron productos.</td></tr>'
    showToast(Swal, 'Reporte de productos generado.', 'success')
  } catch (error) {
    console.error('Error generando reporte de productos:', error)
    showToast(Swal, 'Error al generar productos: ' + friendlyError(error), 'error')
  }
}

async function generarReporteStock() {
  try {
    const productoId = document.getElementById('stockProducto')?.value
    let query = supabase.from('productos').select('id, nombre, cantidad, precio, categorias:categoria_id(nombre)').order('nombre')
    if (productoId) query = query.eq('id', productoId)

    const { data, error } = await query
    if (error) throw error
    const tableBody = document.getElementById('stockTableBody')
    if (!tableBody) return
    tableBody.innerHTML = data?.length ? data.map(producto => {
      const cantidad = Number(producto.cantidad) || 0
      const valorTotal = (Number(producto.precio) || 0) * cantidad
      return `
        <tr>
          <td>${escapeHtml(producto.id)}</td>
          <td>${escapeHtml(producto.nombre)}</td>
          <td>${escapeHtml(producto.categorias?.nombre || 'Sin categoría')}</td>
          <td>${cantidad}</td>
          <td><span class="badge ${stockBadge(cantidad)}">${stockStatus(cantidad)}</span></td>
          <td>${formatCurrency(producto.precio)}</td>
          <td>${formatCurrency(valorTotal)}</td>
        </tr>
      `
    }).join('') : '<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron productos.</td></tr>'
    showToast(Swal, 'Reporte de stock generado.', 'success')
  } catch (error) {
    console.error('Error generando reporte de stock:', error)
    showToast(Swal, 'Error al generar stock: ' + friendlyError(error), 'error')
  }
}

async function generarReporteProveedores() {
  try {
    const startDate = document.getElementById('proveedoresStartDate')?.value
    const endDate = document.getElementById('proveedoresEndDate')?.value
    let query = supabase.from('proveedores').select('id, nombre, contacto, telefono, email, direccion, created_at').order('nombre')
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
    if (endDate) query = query.lt('created_at', `${endDate}T23:59:59.999`)

    const { data, error } = await query
    if (error) throw error
    const tableBody = document.getElementById('proveedoresTableBody')
    if (!tableBody) return
    tableBody.innerHTML = data?.length ? data.map(proveedor => `
      <tr>
        <td>${escapeHtml(proveedor.id)}</td>
        <td>${escapeHtml(proveedor.nombre)}</td>
        <td>${escapeHtml(proveedor.contacto || '-')}</td>
        <td>${escapeHtml(proveedor.telefono || '-')}</td>
        <td>${escapeHtml(proveedor.email || '-')}</td>
        <td>${escapeHtml(proveedor.direccion || '-')}</td>
        <td>${formatDate(proveedor.created_at)}</td>
      </tr>
    `).join('') : '<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron proveedores.</td></tr>'
    showToast(Swal, 'Reporte de proveedores generado.', 'success')
  } catch (error) {
    console.error('Error generando reporte de proveedores:', error)
    showToast(Swal, 'Error al generar proveedores: ' + friendlyError(error), 'error')
  }
}

function movementBadge(tipo) {
  if (tipo === 'entrada') return 'bg-success'
  if (tipo === 'salida') return 'bg-danger'
  if (tipo === 'ajuste') return 'bg-warning text-dark'
  return 'bg-secondary'
}

function stockStatus(cantidad) {
  if (cantidad <= 5) return 'Crítico'
  if (cantidad <= 15) return 'Bajo'
  return 'Normal'
}

function stockBadge(cantidad) {
  if (cantidad <= 5) return 'bg-danger'
  if (cantidad <= 15) return 'bg-warning text-dark'
  return 'bg-success'
}

function exportToExcel(tableId, fileName) {
  try {
    const table = document.getElementById(tableId)
    if (!table) throw new Error('No se encontró la tabla para exportar')
    const wb = XLSX.utils.table_to_book(table)
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    showToast(Swal, 'Archivo Excel generado correctamente.', 'success')
  } catch (error) {
    showToast(Swal, 'Error al exportar a Excel: ' + friendlyError(error), 'error')
  }
}

function exportToPDF(tableId, fileName) {
  try {
    const table = document.getElementById(tableId)
    if (!table) throw new Error('No se encontró la tabla para exportar')
    const doc = new jsPDF({ orientation: 'landscape' })
    autoTable(doc, { html: `#${tableId}`, styles: { fontSize: 8 }, headStyles: { fillColor: [139, 0, 0] } })
    doc.save(`${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`)
    showToast(Swal, 'Archivo PDF generado correctamente.', 'success')
  } catch (error) {
    showToast(Swal, 'Error al exportar a PDF: ' + friendlyError(error), 'error')
  }
}
