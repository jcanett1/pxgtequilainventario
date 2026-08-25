import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm'
import { supabase } from './supabase-client.js'
import { escapeHtml, formatCurrency, formatDate, friendlyError, setTableState, showToast } from './ui-utils.js'

window.addEventListener('DOMContentLoaded', cargarStock)

async function cargarStock() {
  const tableBody = document.getElementById('stockTableBody')
  try {
    const { data: productos, error } = await supabase
      .from('productos')
      .select('id, nombre, precio, cantidad, ubicacion, fecha_ingreso, categorias:categoria_id(nombre), proveedores:proveedor_id(nombre)')
      .order('nombre')
    if (error) throw error

    if (!productos?.length) {
      setTableState(tableBody, 7, 'No hay productos en el inventario.')
      return
    }

    tableBody.innerHTML = productos.map(producto => {
      const cantidad = Number(producto.cantidad) || 0
      const stockClass = getStockClass(cantidad)
      return `
        <tr class="${stockClass}">
          <td><strong>${escapeHtml(producto.nombre)}</strong></td>
          <td>${escapeHtml(producto.categorias?.nombre || 'Sin categoría')}</td>
          <td>${formatCurrency(producto.precio)}</td>
          <td><span class="badge ${getStockBadge(cantidad)}">${cantidad}</span></td>
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
