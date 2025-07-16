// js/dashboard.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Swal from 'sweetalert2'
import Chart from 'https://esm.sh/chart.js@4.4.0' // Añade esta línea

// Configuración de Supabase
const supabaseUrl = 'https://bwkvfwrrlizhqdpaxfmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3Zmd3JybGl6aHFkcGF4Zm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NTIyODMsImV4cCI6MjA2NTMyODI4M30.6ryUGUVRcDtASw0s1RTnKwSA4ezn_I_oxHeuSWGmwFU'
const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', function() {
  initializeDashboard();
});

async function initializeDashboard() {
  try {
    await Promise.all([
      loadMetrics(),
      loadStockByCategory(),
      loadRecentMovements(),
      loadRecentProducts()
    ]);
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    mostrarAlerta('Error al cargar el dashboard', 'error');
  }
}

async function loadMetrics() {
  try {
    // Get total products
    const { count: totalProducts, error: productsError } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true });
      
    if (productsError) throw productsError;
    
    // Get today's movements
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    
    const { count: todayMovementsCount, error: movementsError } = await supabase
      .from('movimientos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStr);
      
    if (movementsError) throw movementsError;
    
    // Calculate total stock value
    const { data: productos, error: stockError } = await supabase
      .from('productos')
      .select('precio, cantidad');
      
    if (stockError) throw stockError;
    
    const totalStockValue = productos.reduce((total, producto) => 
  total + (parseFloat(producto.precio || 0) * parseInt(producto.cantidad || 0)), 0);
    
    // Update the UI
    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('todayMovements').textContent = todayMovementsCount;
    document.getElementById('totalStockValue').textContent = `$${totalStockValue.toFixed(2)}`;
    
  } catch (error) {
    console.error('Error loading metrics:', error);
    mostrarAlerta('Error al cargar métricas', 'error');
  }
}

async function loadStockByCategory() {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('cantidad, categorias: categoria_id(nombre)');
      
    if (error) throw error;
    
    const categorySums = {};
    data.forEach(item => {
      const category = item.categorias?.nombre || 'Sin categoría';
      categorySums[category] = (categorySums[category] || 0) + item.cantidad;
    });
    
    const ctx = document.getElementById('chartStockByCategory');
    if (!ctx) throw new Error('Elemento del gráfico no encontrado');
    
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(categorySums),
        datasets: [{
          data: Object.values(categorySums),
          backgroundColor: [
            'rgba(139, 0, 0, 0.7)',
            'rgba(255, 179, 71, 0.7)',
            'rgba(153, 102, 51, 0.7)'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' }
        }
      }
    });
    
  } catch (error) {
    console.error('Error loading stock by category:', error);
    mostrarAlerta('Error al cargar gráfico de stock', 'error');
  }
}

async function loadRecentMovements() {
  try {
    // Calculate date from 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();
    
    const { data, error } = await supabase
      .from('movimientos')
      .select(`
        created_at, 
        tipo, 
        cantidad,
        productos: producto_id(nombre)
      `)
      .gte('created_at', sevenDaysAgoStr)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    // Process data for chart - group by date and movement type
    const dateMap = {};
    const allDates = [];
    
    // Create entries for last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = formatDateForChart(date);
      dateMap[dateStr] = { entrada: 0, salida: 0 };
      allDates.push(dateStr);
    }
    
    // Fill with actual data
    data.forEach(movement => {
      const dateStr = formatDateForChart(new Date(movement.created_at));
      if (dateMap[dateStr]) {
        if (movement.tipo === 'entrada') {
          dateMap[dateStr].entrada += parseInt(movement.cantidad || 0);
        } else if (movement.tipo === 'salida') {
          dateMap[dateStr].salida += parseInt(movement.cantidad || 0);
        }
      }
    });
    
    // Prepare datasets
    const entradas = allDates.map(date => dateMap[date].entrada);
    const salidas = allDates.map(date => dateMap[date].salida);
    
    // Create chart
    const ctx = document.getElementById('chartRecentMovements').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: allDates,
        datasets: [
          {
            label: 'Entradas',
            data: entradas,
            borderColor: 'rgba(50, 168, 82, 1)',
            backgroundColor: 'rgba(50, 168, 82, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Salidas',
            data: salidas,
            borderColor: 'rgba(139, 0, 0, 1)',
            backgroundColor: 'rgba(139, 0, 0, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Movimientos en los Últimos 7 Días'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Cantidad'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Fecha'
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error loading recent movements:', error);
    mostrarAlerta('Error al cargar gráfico de movimientos recientes', 'error');
  }
}

async function loadRecentProducts() {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select(`
        nombre, 
        cantidad,
        precio, 
        fecha_ingreso,
        categorias: categoria_id(nombre)
      `)
      .order('fecha_ingreso', { ascending: false })
      .limit(5);
      
    if (error) throw error;
    
    const tableBody = document.getElementById('recentProductsTableBody');
    tableBody.innerHTML = '';
    
    data.forEach(producto => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${producto.nombre}</td>
        <td>${producto.categorias?.nombre || '-'}</td>
        <td>${producto.cantidad || '0'}</td>
        <td>$${parseFloat(producto.precio || 0).toFixed(2)}</td>
        <td>${formatearFecha(producto.fecha_ingreso)}</td>
      `;
      tableBody.appendChild(row);
    });
    
  } catch (error) {
    console.error('Error loading recent products:', error);
    mostrarAlerta('Error al cargar productos recientes', 'error');
  }
}

function formatDateForChart(date) {
  return new Intl.DateTimeFormat('es-MX', { 
    day: '2-digit',
    month: '2-digit'
  }).format(date);
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
