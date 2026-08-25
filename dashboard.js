import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm'
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm'
import { supabase } from './supabase-client.js'
import { escapeHtml, formatCurrency, formatDate, localDateInputValue, setTableState, showToast } from './ui-utils.js'

Chart.register(...registerables)

let stockCategoryChart
let recentMovementsChart

const todayStart = () => `${localDateInputValue()}T00:00:00`
const tomorrowStart = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return `${localDateInputValue(tomorrow)}T00:00:00`
}

window.addEventListener('DOMContentLoaded', initializeDashboard)

async function initializeDashboard() {
  setDashboardLoading(true)
  const results = await Promise.allSettled([
    loadMetrics(),
    loadStockByCategory(),
    loadRecentMovements(),
    loadRecentProducts()
  ])
  setDashboardLoading(false)

  if (results.some(result => result.status === 'rejected')) {
    showToast(Swal, 'Algunas secciones no pudieron cargarse. Revisa la conexión e intenta nuevamente.', 'warning')
  }
}

function setDashboardLoading(isLoading) {
  document.querySelectorAll('[data-dashboard-value]').forEach(element => {
    if (isLoading) element.setAttribute('aria-busy', 'true')
  })
}

async function loadMetrics() {
  const [productsResult, movementsResult, stockResult] = await Promise.all([
    supabase.from('productos').select('id', { count: 'exact', head: true }),
    supabase.from('movimientos').select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart()).lt('created_at', tomorrowStart()),
    supabase.from('productos').select('precio, cantidad')
  ])

  if (productsResult.error) throw productsResult.error
  if (movementsResult.error) throw movementsResult.error
  if (stockResult.error) throw stockResult.error

  const totalStockValue = (stockResult.data || []).reduce((total, producto) => {
    return total + (Number(producto.precio) || 0) * (Number(producto.cantidad) || 0)
  }, 0)

  document.getElementById('totalProducts').textContent = productsResult.count ?? 0
  document.getElementById('todayMovements').textContent = movementsResult.count ?? 0
  document.getElementById('totalStockValue').textContent = formatCurrency(totalStockValue)
}

async function loadStockByCategory() {
  const { data, error } = await supabase
    .from('productos')
    .select('cantidad, categorias:categoria_id(nombre)')

  if (error) throw error

  const categorySums = {}
  ;(data || []).forEach(item => {
    const category = item.categorias?.nombre || 'Sin categoría'
    categorySums[category] = (categorySums[category] || 0) + (Number(item.cantidad) || 0)
  })

  const canvas = document.getElementById('chartStockByCategory')
  if (!canvas) return
  stockCategoryChart?.destroy()

  stockCategoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: Object.keys(categorySums).length ? Object.keys(categorySums) : ['Sin datos'],
      datasets: [{
        data: Object.keys(categorySums).length ? Object.values(categorySums) : [1],
        backgroundColor: ['#8b0000', '#ffb347', '#996633', '#32a852', '#36a2eb', '#9966ff'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: { position: 'right' },
        title: { display: false }
      }
    }
  })
}

async function loadRecentMovements() {
  const start = new Date()
  start.setDate(start.getDate() - 6)

  const { data, error } = await supabase
    .from('movimientos')
    .select('created_at, tipo, cantidad')
    .gte('created_at', `${localDateInputValue(start)}T00:00:00`)
    .order('created_at', { ascending: true })

  if (error) throw error

  const dateMap = {}
  const labels = []
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const key = localDateInputValue(date)
    dateMap[key] = { entrada: 0, salida: 0 }
    labels.push({ key, label: new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit' }).format(date) })
  }

  ;(data || []).forEach(movement => {
    const key = localDateInputValue(new Date(movement.created_at))
    if (!dateMap[key]) return
    if (movement.tipo === 'entrada') dateMap[key].entrada += Number(movement.cantidad) || 0
    if (movement.tipo === 'salida') dateMap[key].salida += Number(movement.cantidad) || 0
  })

  const canvas = document.getElementById('chartRecentMovements')
  if (!canvas) return
  recentMovementsChart?.destroy()

  recentMovementsChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels.map(item => item.label),
      datasets: [
        {
          label: 'Entradas',
          data: labels.map(item => dateMap[item.key].entrada),
          borderColor: '#32a852',
          backgroundColor: 'rgba(50, 168, 82, 0.12)',
          tension: 0.35,
          fill: true
        },
        {
          label: 'Salidas',
          data: labels.map(item => dateMap[item.key].salida),
          borderColor: '#8b0000',
          backgroundColor: 'rgba(139, 0, 0, 0.1)',
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  })
}

async function loadRecentProducts() {
  const { data, error } = await supabase
    .from('productos')
    .select('nombre, cantidad, precio, fecha_ingreso, categorias:categoria_id(nombre)')
    .order('fecha_ingreso', { ascending: false })
    .limit(5)

  if (error) throw error

  const tableBody = document.getElementById('recentProductsTableBody')
  if (!tableBody) return
  if (!data?.length) {
    setTableState(tableBody, 5, 'No hay productos registrados todavía.')
    return
  }

  tableBody.innerHTML = data.map(producto => `
    <tr>
      <td>${escapeHtml(producto.nombre)}</td>
      <td>${escapeHtml(producto.categorias?.nombre || 'Sin categoría')}</td>
      <td>${Number(producto.cantidad) || 0}</td>
      <td>${formatCurrency(producto.precio)}</td>
      <td>${formatDate(producto.fecha_ingreso)}</td>
    </tr>
  `).join('')
}
