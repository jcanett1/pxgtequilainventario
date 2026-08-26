import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm'
import { supabase } from './supabase-client.js'
import { escapeHtml, formatCurrency, formatDate, formatProductStock, formatProductUnit, friendlyError, getProductQuantity, setTableState, showToast } from './ui-utils.js?v=20260826-presentation-2'

window.addEventListener('DOMContentLoaded', cargarStock)

async function cargarStock() {
  const tableBody = document.getElementById('stockTableBody')
  try {
    const presentationFields = 'id, nombre, precio, cantidad, tipo_presentacion, piezas_por_caja, ubicacion, fecha_ingreso, categorias:categoria_id(nombre), proveedores:proveedor_id(nombre)'
    const legacyFields = 'id, nombre, precio, cantidad, ubicacion, fecha_ingreso, categorias:categoria_id(nombre), proveedores:proveedor_id(nombre)'
    let response = await supabase.from('productos').select(presentationFields).order('nombre')
    if (response.error && /tipo_presentacion|piezas_por_caja/i.test(response.error.message || '')) {
      response = await supabase.from('productos').select(legacyFields).order('nombre')
    }
    if (response.error) throw response.error
    const productos = response.data

    if (!productos?.length) {
      setTableState(tableBody, 7, 'No hay productos en el inventario.')
      return
    }

    tableBody.innerHTML = productos.map(producto => {
      const cantidad = getProductQuantity(producto)
      const stockClass = getStockClass(cantidad)
      return `
        <tr class="${stockClass}">
          <td><strong>${escapeHtml(producto.nombre)}</strong></td>
          <td>${escapeHtml(producto.categorias?.nombre || 'Sin categoría')}</td>
          <td>${formatCurrency(producto.precio)}</td>
          <td><span class="badge ${getStockBadge(cantidad)}">${formatProductStock(producto)}</span><small class="d-block text-muted mt-1">${formatProductUnit(producto)}</small></td>
          <td>${escapeHtml(producto.proveedores?.nombre || 'Sin proveedor')}</td>
          <td>${formatDate(producto.fecha_ingreso)}</td>
          <td>${escapeHtml(producto.ubicacion || 'Sin ubicación')}</td>
        </tr>
      `
    }).join('')
  } catch (error) {
    console.error('Error en cargarStock:', error)
    setTableState(tableBody, 7, 'No se pudo cargar el inventario.', 'danger')
    showToast(Swal, friendlyError(error), 'error')
  }
}

function getStockClass(cantidad) {
  if (cantidad <= 5) return 'table-danger'
  if (cantidad <= 15) return 'table-warning'
  return 'table-success'
}

function getStockBadge(cantidad) {
  if (cantidad <= 5) return 'bg-danger'
  if (cantidad <= 15) return 'bg-warning text-dark'
  return 'bg-success'
}

window.cargarStock = cargarStock
