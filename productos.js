import Swal from 'sweetalert2'
import { getCurrentUser, supabase } from './supabase-client.js'
import { escapeHtml, formatCurrency, formatDate, friendlyError, formatMovementUnit, formatProductSelectOption, getProductPresentation, formatProductStock, formatProductUnit, getProductQuantity, localDateInputValue, showToast } from './ui-utils.js?v=20260826-presentation-2'

const PRODUCT_IMAGE_BUCKET = 'product-images'
const PRODUCT_IMAGE_MAX_SIZE = 5 * 1024 * 1024

let productoEditando = null
let productos = []
let categorias = []
let productImagesSupported = true
let productPresentationSupported = true
let imagePreviewObjectUrl = null
let imageSetupWarningShown = false
let presentationSetupWarningShown = false

window.addEventListener('DOMContentLoaded', initializeProducts)

async function initializeProducts() {
  try {
    bindProductEvents()
    await Promise.all([cargarProductos(), cargarCategorias(), cargarProveedores()])
    document.getElementById('productEntryDate').value = localDateInputValue()
    actualizarCamposPresentacion()
  } catch (error) {
    console.error('Error inicial:', error)
    mostrarError('No se pudo cargar el módulo de productos: ' + friendlyError(error))
  }
}

function bindProductEvents() {
  document.getElementById('saveProductBtn')?.addEventListener('click', guardarProducto)
  document.getElementById('addStockBtn')?.addEventListener('click', agregarStockExistente)
  document.getElementById('productosTableBody')?.addEventListener('click', handleProductAction)
  document.getElementById('productsGrid')?.addEventListener('click', handleProductAction)
  document.getElementById('productSearch')?.addEventListener('input', renderProductos)
  document.getElementById('productCategoryFilter')?.addEventListener('change', renderProductos)
  document.getElementById('clearProductFilters')?.addEventListener('click', limpiarFiltros)
  document.getElementById('productImage')?.addEventListener('change', handleImageSelected)
  document.getElementById('productPresentation')?.addEventListener('change', actualizarCamposPresentacion)
  document.getElementById('existingProduct')?.addEventListener('change', actualizarEtiquetasAjusteStock)
  document.getElementById('addCategoryForm')?.addEventListener('submit', guardarCategoria)
  document.getElementById('categoriesList')?.addEventListener('click', handleCategoryAction)
  document.getElementById('openCategoriesFromProduct')?.addEventListener('click', abrirGestorCategorias)
  document.getElementById('addProductModal')?.addEventListener('hidden.bs.modal', resetFormularioProducto)
  document.getElementById('categoriesModal')?.addEventListener('shown.bs.modal', () => document.getElementById('categoryName')?.focus())
}

async function cargarProductos() {
  const fieldsWithImage = 'id, nombre, precio, cantidad, tipo_presentacion, piezas_por_caja, descripcion, ubicacion, fecha_ingreso, codigo_barras, categoria_id, proveedor_id, image_url, categorias:categoria_id(id, nombre), proveedores:proveedor_id(id, nombre)'
  const fieldsWithPresentation = 'id, nombre, precio, cantidad, tipo_presentacion, piezas_por_caja, descripcion, ubicacion, fecha_ingreso, codigo_barras, categoria_id, proveedor_id, categorias:categoria_id(id, nombre), proveedores:proveedor_id(id, nombre)'
  const legacyFields = 'id, nombre, precio, cantidad, descripcion, ubicacion, fecha_ingreso, codigo_barras, categoria_id, proveedor_id, categorias:categoria_id(id, nombre), proveedores:proveedor_id(id, nombre)'

  let response = await supabase.from('productos').select(fieldsWithImage).order('nombre', { ascending: true })
  if (response.error && /image_url/i.test(response.error.message || '')) {
    productImagesSupported = false
    response = await supabase.from('productos').select(fieldsWithPresentation).order('nombre', { ascending: true })
    if (!imageSetupWarningShown) {
      showToast(Swal, 'La tabla aún necesita la configuración de imágenes para activar las cargas.', 'warning')
      imageSetupWarningShown = true
    }
  }
  if (response.error && /tipo_presentacion|piezas_por_caja/i.test(response.error.message || '')) {
    productPresentationSupported = false
    response = await supabase.from('productos').select(legacyFields).order('nombre', { ascending: true })
    if (!presentationSetupWarningShown) {
      showToast(Swal, 'Aplica la migración de presentación para activar cajas y piezas.', 'warning')
      presentationSetupWarningShown = true
    }
  }

  if (response.error) throw response.error
  productos = response.data || []
  renderProductos()
  renderCategorias()
  cargarProductosExistentes()
}

function renderProductos() {
  const grid = document.getElementById('productsGrid')
  if (!grid) return

  const searchTerm = document.getElementById('productSearch')?.value.trim().toLocaleLowerCase('es-MX') || ''
  const categoryId = document.getElementById('productCategoryFilter')?.value || ''
  const filteredProducts = productos.filter(producto => {
    const matchesName = !searchTerm || [producto.nombre, producto.descripcion, producto.codigo_barras]
      .filter(Boolean)
      .some(value => String(value).toLocaleLowerCase('es-MX').includes(searchTerm))
    const matchesCategory = !categoryId || String(producto.categoria_id || '') === categoryId
    return matchesName && matchesCategory
  })

  const count = document.getElementById('productResultsCount')
  if (count) {
    count.textContent = filteredProducts.length === productos.length
      ? `${productos.length} ${productos.length === 1 ? 'producto' : 'productos'}`
      : `${filteredProducts.length} de ${productos.length} productos`
  }

  if (!productos.length) {
    grid.innerHTML = `<div class="col-12"><div class="products-empty"><div><i class="fas fa-box-open fa-2x mb-3 d-block"></i><strong>Aún no hay productos registrados.</strong><p class="mb-0 mt-2">Agrega tu primer producto para comenzar a organizar tu catálogo.</p></div></div></div>`
    return
  }

  if (!filteredProducts.length) {
    grid.innerHTML = `<div class="col-12"><div class="products-empty"><div><i class="fas fa-filter fa-2x mb-3 d-block"></i><strong>No encontramos productos con esos filtros.</strong><p class="mb-0 mt-2">Prueba con otro nombre o limpia la selección.</p></div></div></div>`
    return
  }

  grid.innerHTML = filteredProducts.map(renderProductCard).join('')
}

function renderProductCard(producto) {
  const quantity = getProductQuantity(producto)
  const stockState = quantity <= 5 ? 'low' : quantity <= 15 ? 'medium' : ''
  const stockLabel = formatProductStock(producto)
  const presentationLabel = formatProductUnit(producto)
  const imageUrl = getSafeImageUrl(producto.image_url)
  const categoryName = producto.categorias?.nombre || 'Sin categoría'
  const description = producto.descripcion || 'Sin descripción disponible.'
  const provider = producto.proveedores?.nombre || 'Sin proveedor'
  const location = producto.ubicacion || 'Sin ubicación'
  const escapedName = escapeHtml(producto.nombre || 'Producto')

  return `
    <div class="col-12 col-md-6 col-xl-4">
      <article class="product-card" data-product-id="${Number(producto.id)}">
        <div class="product-card-media">
          ${imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" alt="Imagen de ${escapedName}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.hidden=false"><div class="product-placeholder" hidden><i class="fas fa-box-open" aria-hidden="true"></i></div>`
            : `<div class="product-placeholder"><i class="fas fa-box-open" aria-hidden="true"></i></div>`}
          <span class="product-stock-chip ${stockState}">${stockLabel}</span>
        </div>
        <div class="product-card-body">
          <div class="product-card-category">${escapeHtml(categoryName)}</div>
          <h3 class="product-card-title">${escapedName}</h3>
          <p class="product-card-description">${escapeHtml(description)}</p>
          <div class="product-card-data">
            <div class="product-card-data-item">
              <span class="product-card-data-label">Precio</span>
              <strong class="product-card-price">${formatCurrency(producto.precio)}</strong>
            </div>
            <div class="product-card-data-item">
              <span class="product-card-data-label">Presentación</span>
              <span class="product-card-data-value" title="${escapeHtml(presentationLabel)}">${escapeHtml(presentationLabel)}</span>
            </div>
            <div class="product-card-data-item">
              <span class="product-card-data-label">Existencia</span>
              <span class="product-card-data-value" title="${escapeHtml(stockLabel)}">${escapeHtml(stockLabel)}</span>
            </div>
            <div class="product-card-data-item">
              <span class="product-card-data-label">Proveedor</span>
              <span class="product-card-data-value" title="${escapeHtml(provider)}">${escapeHtml(provider)}</span>
            </div>
            <div class="product-card-data-item">
              <span class="product-card-data-label">Ubicación</span>
              <span class="product-card-data-value" title="${escapeHtml(location)}">${escapeHtml(location)}</span>
            </div>
            <div class="product-card-data-item">
              <span class="product-card-data-label">Ingreso</span>
              <span class="product-card-data-value">${formatDate(producto.fecha_ingreso)}</span>
            </div>
          </div>
          <div class="product-card-actions" aria-label="Acciones para ${escapedName}">
            <button class="btn btn-info" type="button" data-action="edit" data-id="${Number(producto.id)}" title="Editar producto"><i class="fas fa-edit" aria-hidden="true"></i><span class="visually-hidden">Editar</span></button>
            <button class="btn btn-success" type="button" data-action="stock" data-id="${Number(producto.id)}" title="Agregar stock"><i class="fas fa-plus-minus" aria-hidden="true"></i><span class="visually-hidden">Agregar stock</span></button>
            <button class="btn btn-secondary" type="button" data-action="history" data-id="${Number(producto.id)}" title="Ver historial"><i class="fas fa-history" aria-hidden="true"></i><span class="visually-hidden">Ver historial</span></button>
            <button class="btn btn-danger" type="button" data-action="delete" data-id="${Number(producto.id)}" title="Eliminar producto"><i class="fas fa-trash" aria-hidden="true"></i><span class="visually-hidden">Eliminar</span></button>
          </div>
        </div>
      </article>
    </div>`
}

function actualizarCamposPresentacion() {
  const presentation = document.getElementById('productPresentation')?.value === 'caja' ? 'caja' : 'pieza'
  const piecesGroup = document.getElementById('productPiecesPerBoxGroup')
  const piecesInput = document.getElementById('productPiecesPerBox')
  const quantityLabel = document.getElementById('productQuantityLabel')
  const note = document.getElementById('productPresentationNote')
  if (!piecesGroup || !piecesInput || !quantityLabel || !note) return

  const isBox = presentation === 'caja'
  piecesGroup.classList.toggle('d-none', !isBox)
  piecesInput.disabled = !isBox
  if (!isBox) piecesInput.value = '1'
  quantityLabel.textContent = isBox ? 'Cantidad inicial (cajas)' : 'Cantidad inicial (piezas)'
  note.innerHTML = isBox
    ? '<i class="fas fa-boxes-stacked me-2" aria-hidden="true"></i>El inventario se manejará por cajas. Cada caja contiene la cantidad de piezas indicada.'
    : '<i class="fas fa-cube me-2" aria-hidden="true"></i>El inventario se manejará por piezas individuales.'
}

function limpiarFiltros() {
  const search = document.getElementById('productSearch')
  const category = document.getElementById('productCategoryFilter')
  if (search) search.value = ''
  if (category) category.value = ''
  renderProductos()
}

async function cargarCategorias() {
  const { data, error } = await supabase.from('categorias').select('id, nombre').order('nombre')
  if (error) throw error
  categorias = data || []
  renderCategoryOptions()
  renderCategorias()
}

function renderCategoryOptions(selectedProductCategory = null) {
  const productSelect = document.getElementById('productCategory')
  const filterSelect = document.getElementById('productCategoryFilter')
  const selectedFilter = filterSelect?.value || ''
  const selectedProduct = selectedProductCategory ?? productSelect?.value ?? ''
  const categoryOptions = categorias.map(categoria => `<option value="${Number(categoria.id)}">${escapeHtml(categoria.nombre)}</option>`).join('')

  if (productSelect) {
    productSelect.innerHTML = `<option value="">Seleccionar categoría</option>${categoryOptions}`
    productSelect.value = String(selectedProduct || '')
  }
  if (filterSelect) {
    filterSelect.innerHTML = `<option value="">Todas las categorías</option>${categoryOptions}`
    filterSelect.value = String(selectedFilter || '')
  }
}

function renderCategorias() {
  const list = document.getElementById('categoriesList')
  const count = document.getElementById('categoryResultsCount')
  if (count) count.textContent = `${categorias.length} ${categorias.length === 1 ? 'categoría' : 'categorías'}`
  if (!list) return

  if (!categorias.length) {
    list.innerHTML = '<div class="products-empty"><div><i class="fas fa-tags fa-2x mb-3 d-block"></i><strong>Aún no hay categorías.</strong><p class="mb-0 mt-2">Crea la primera para organizar tus productos.</p></div></div>'
    return
  }

  list.innerHTML = categorias.map(categoria => {
    const productCount = productos.filter(producto => String(producto.categoria_id || '') === String(categoria.id)).length
    return `<div class="category-list-item"><div class="category-list-item-name"><i class="fas fa-tag" aria-hidden="true"></i><span>${escapeHtml(categoria.nombre)}</span><span class="badge bg-light text-dark">${productCount}</span></div><button class="btn btn-sm btn-outline-danger" type="button" data-category-action="delete" data-id="${Number(categoria.id)}" title="Eliminar categoría"><i class="fas fa-trash" aria-hidden="true"></i><span class="visually-hidden">Eliminar</span></button></div>`
  }).join('')
}

async function cargarProveedores() {
  const { data, error } = await supabase.from('proveedores').select('id, nombre').order('nombre')
  if (error) throw error
  document.querySelectorAll('.select-proveedor').forEach(select => {
    const currentValue = select.value
    select.innerHTML = '<option value="">Seleccionar proveedor</option>'
    ;(data || []).forEach(proveedor => {
      const option = document.createElement('option')
      option.value = proveedor.id
      option.textContent = proveedor.nombre
      select.appendChild(option)
    })
    select.value = currentValue
  })
}

function cargarProductosExistentes() {
  const selectProductos = document.getElementById('existingProduct')
  if (!selectProductos) return
  const currentValue = selectProductos.value
  selectProductos.innerHTML = '<option value="">Seleccionar producto</option>'
  productos.forEach(producto => {
    const option = document.createElement('option')
    option.value = producto.id
    option.textContent = formatProductSelectOption(producto)
    selectProductos.appendChild(option)
  })
  selectProductos.value = currentValue
  actualizarEtiquetasAjusteStock()
}

function actualizarEtiquetasAjusteStock() {
  const select = document.getElementById('existingProduct')
  const label = document.getElementById('additionalStockLabel')
  const hint = document.getElementById('additionalStockHint')
  const input = document.getElementById('additionalStock')
  if (!select || !label || !hint || !input) return
  const producto = productos.find(item => String(item.id) === String(select.value))
  const isBox = producto?.tipo_presentacion === 'caja'
  label.textContent = isBox ? 'Cajas a agregar' : 'Piezas a agregar'
  hint.textContent = producto
    ? isBox ? `Cada caja contiene ${getProductPresentation(producto).piecesPerBox} piezas.` : 'Se agregarán piezas individuales al inventario.'
    : 'La cantidad se agregará según la presentación del producto.'
  input.placeholder = isBox ? 'Ej. 3 cajas' : 'Ej. 10 piezas'
}

async function guardarProducto() {
  const form = document.getElementById('addProductForm')
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    form.reportValidity()
    return
  }

  const imageFile = document.getElementById('productImage')?.files?.[0] || null
  if (imageFile && !validarImagen(imageFile)) return
  if (imageFile && !productImagesSupported) {
    return mostrarError('Primero aplica la configuración de imágenes indicada en el repositorio y vuelve a intentarlo.')
  }

  const presentation = document.getElementById('productPresentation').value === 'caja' ? 'caja' : 'pieza'
  const piecesPerBox = presentation === 'caja' ? Number.parseInt(document.getElementById('productPiecesPerBox').value, 10) : 1
  if (!productPresentationSupported && presentation === 'caja') {
    return mostrarError('Aplica primero la migración de presentación en Supabase para registrar productos por caja.')
  }
  if (presentation === 'caja' && (!Number.isInteger(piecesPerBox) || piecesPerBox <= 0)) {
    return mostrarError('Indica cuántas piezas contiene cada caja.')
  }

  const productData = {
    nombre: document.getElementById('productName').value.trim(),
    categoria_id: document.getElementById('productCategory').value || null,
    precio: Number(document.getElementById('productPrice').value),
    cantidad: Number.parseInt(document.getElementById('productQuantity').value, 10) || 0,
    descripcion: document.getElementById('productDescription').value.trim() || null,
    proveedor_id: document.getElementById('productSupplier').value || null,
    ubicacion: document.getElementById('productLocation').value.trim() || null,
    fecha_ingreso: document.getElementById('productEntryDate').value
  }

  if (!productData.nombre) return mostrarError('El nombre del producto es requerido')
  if (!Number.isFinite(productData.precio) || productData.precio <= 0) return mostrarError('El precio debe ser mayor que cero')
  if (productData.cantidad < 0) return mostrarError('La cantidad no puede ser negativa')
  if (productPresentationSupported) {
    productData.tipo_presentacion = presentation
    productData.piezas_por_caja = piecesPerBox
  }

  const saveButton = document.getElementById('saveProductBtn')
  saveButton.disabled = true
  saveButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Guardando...'

  try {
    let result
    if (productoEditando) {
      const { data, error } = await supabase.from('productos').update(productData).eq('id', productoEditando.id).select().single()
      if (error) throw error
      result = data
      if (Number(productoEditando.precio) !== productData.precio) {
        const user = await getCurrentUser().catch(() => null)
        const { error: historyError } = await supabase.from('historial_precios').insert({
          producto_id: productoEditando.id,
          precio_anterior: productoEditando.precio,
          precio_nuevo: productData.precio,
          usuario_id: user?.id || null
        })
        if (historyError) console.warn('No se pudo registrar historial de precio:', historyError)
      }
    } else {
      const { data, error } = await supabase.from('productos').insert(productData).select().single()
      if (error) throw error
      result = data
    }

    if (imageFile) {
      const imageUrl = await uploadProductImage(imageFile, result.id)
      const { error: imageError } = await supabase.from('productos').update({ image_url: imageUrl }).eq('id', result.id)
      if (imageError) throw imageError
    }

    await mostrarExito(`Producto "${result.nombre}" ${productoEditando ? 'actualizado' : 'guardado'} correctamente`)
    bootstrap.Modal.getInstance(document.getElementById('addProductModal'))?.hide()
    resetFormularioProducto()
    await cargarProductos()
  } catch (error) {
    console.error('Error guardando producto:', error)
    mostrarError(friendlyError(error), 'Error al guardar')
  } finally {
    saveButton.disabled = false
    saveButton.innerHTML = productoEditando ? 'Actualizar Producto' : 'Guardar Producto'
  }
}

function validarImagen(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    mostrarError('Elige una imagen JPG, PNG, WEBP o GIF.')
    return false
  }
  if (file.size > PRODUCT_IMAGE_MAX_SIZE) {
    mostrarError('La imagen no puede superar los 5 MB.')
    return false
  }
  return true
}

async function uploadProductImage(file, productId) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const randomId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `${productId}/${randomId}.${extension}`
  const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  })
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function handleImageSelected(event) {
  const file = event.target.files?.[0]
  if (!file) {
    mostrarImagenPreview(productoEditando?.image_url || '')
    return
  }
  if (!validarImagen(file)) {
    event.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.addEventListener('load', () => mostrarImagenPreview(reader.result))
  reader.readAsDataURL(file)
}

function mostrarImagenPreview(source) {
  const preview = document.getElementById('productImagePreview')
  if (!preview) return
  if (imagePreviewObjectUrl) {
    URL.revokeObjectURL(imagePreviewObjectUrl)
    imagePreviewObjectUrl = null
  }
  const safeSource = typeof source === 'string' ? getSafeImageUrl(source) : source
  if (safeSource) {
    preview.classList.remove('empty')
    preview.innerHTML = `<img src="${escapeHtml(safeSource)}" alt="Previsualización de imagen">`
  } else {
    preview.classList.add('empty')
    preview.innerHTML = '<i class="fas fa-image" aria-hidden="true"></i><span>La imagen aparecerá aquí</span>'
  }
}

function getSafeImageUrl(value) {
  if (!value || typeof value !== 'string') return ''
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(value)) return value
  try {
    const url = new URL(value, window.location.href)
    if (['http:', 'https:'].includes(url.protocol)) return url.href
    if (url.protocol === window.location.protocol && url.origin === window.location.origin) return url.href
  } catch {
    return ''
  }
  return ''
}

async function agregarStockExistente() {
  const form = document.getElementById('addStockForm')
  if (!form.checkValidity()) {
    form.classList.add('was-validated')
    form.reportValidity()
    return
  }

  const productoId = document.getElementById('existingProduct').value
  const cantidad = Number.parseInt(document.getElementById('additionalStock').value, 10)
  if (!productoId) return mostrarError('Debe seleccionar un producto')
  if (!Number.isInteger(cantidad) || cantidad <= 0) return mostrarError('La cantidad debe ser mayor que cero')

  const button = document.getElementById('addStockBtn')
  button.disabled = true
  try {
    const { data: producto, error: fetchError } = await supabase.from('productos').select('id, cantidad, nombre, tipo_presentacion, piezas_por_caja').eq('id', productoId).single()
    if (fetchError) throw fetchError

    const currentQuantity = Number(producto.cantidad) || 0
    const { error: updateError } = await supabase.from('productos')
      .update({ cantidad: currentQuantity + cantidad })
      .eq('id', productoId)
      .eq('cantidad', currentQuantity)
    if (updateError) throw updateError

    try {
      await registrarMovimiento(productoId, 'entrada', cantidad, 'Ajuste manual de inventario')
    } catch (movementError) {
      await supabase.from('productos').update({ cantidad: currentQuantity }).eq('id', productoId).eq('cantidad', currentQuantity + cantidad)
      throw movementError
    }

    await mostrarExito(`Se agregaron ${cantidad} ${formatMovementUnit(producto, cantidad)} a "${producto.nombre}"`)
    bootstrap.Modal.getInstance(document.getElementById('addExistingModal'))?.hide()
    form.reset()
    form.classList.remove('was-validated')
    await cargarProductos()
  } catch (error) {
    console.error('Error actualizando stock:', error)
    mostrarError(friendlyError(error), 'Error al actualizar stock')
  } finally {
    button.disabled = false
  }
}

async function registrarMovimiento(productoId, tipo, cantidad, motivo) {
  const user = await getCurrentUser().catch(() => null)
  const { error } = await supabase.from('movimientos').insert({ producto_id: productoId, tipo, cantidad, motivo, usuario_id: user?.id || null })
  if (error) throw error
}

function resetFormularioProducto() {
  const form = document.getElementById('addProductForm')
  if (!form) return
  form.reset()
  form.classList.remove('was-validated')
  productoEditando = null
  document.getElementById('addProductModalLabel').textContent = 'Agregar Nuevo Producto'
  document.getElementById('saveProductBtn').textContent = 'Guardar Producto'
  document.getElementById('productEntryDate').value = localDateInputValue()
  document.getElementById('productPresentation').value = 'pieza'
  document.getElementById('productPiecesPerBox').value = '1'
  actualizarCamposPresentacion()
  mostrarImagenPreview('')
}

async function handleProductAction(event) {
  const button = event.target.closest('button[data-action]')
  if (!button) return
  const id = Number(button.dataset.id)
  if (!Number.isInteger(id)) return
  if (button.dataset.action === 'edit') await editarProducto(id)
  if (button.dataset.action === 'stock') await mostrarModalAjuste(id)
  if (button.dataset.action === 'history') await verHistorial(id)
  if (button.dataset.action === 'delete') await eliminarProducto(id)
}

async function editarProducto(id) {
  try {
    const { data: producto, error } = await supabase.from('productos').select('*').eq('id', id).single()
    if (error) throw error
    productoEditando = producto
    document.getElementById('productName').value = producto.nombre || ''
    document.getElementById('productPresentation').value = producto.tipo_presentacion === 'caja' ? 'caja' : 'pieza'
    document.getElementById('productPiecesPerBox').value = String(Math.max(1, Number.parseInt(producto.piezas_por_caja, 10) || 1))
    actualizarCamposPresentacion()
    renderCategoryOptions(producto.categoria_id || '')
    document.getElementById('productCategory').value = producto.categoria_id || ''
    document.getElementById('productPrice').value = producto.precio ?? ''
    document.getElementById('productQuantity').value = producto.cantidad ?? 0
    document.getElementById('productDescription').value = producto.descripcion || ''
    document.getElementById('productSupplier').value = producto.proveedor_id || ''
    document.getElementById('productLocation').value = producto.ubicacion || ''
    document.getElementById('productEntryDate').value = producto.fecha_ingreso || ''
    document.getElementById('productImage').value = ''
    mostrarImagenPreview(producto.image_url || '')
    document.getElementById('addProductModalLabel').textContent = 'Editar Producto'
    document.getElementById('saveProductBtn').textContent = 'Actualizar Producto'
    bootstrap.Modal.getOrCreateInstance(document.getElementById('addProductModal')).show()
  } catch (error) {
    mostrarError(friendlyError(error), 'No se pudo cargar el producto')
  }
}

async function mostrarModalAjuste(id) {
  const select = document.getElementById('existingProduct')
  if (select) select.value = String(id)
  actualizarEtiquetasAjusteStock()
  bootstrap.Modal.getOrCreateInstance(document.getElementById('addExistingModal')).show()
}

async function eliminarProducto(id) {
  const producto = productos.find(item => Number(item.id) === id)
  if (!producto) return mostrarError('No se encontró el producto seleccionado.')
  const result = await Swal.fire({
    title: '¿Eliminar producto?',
    html: `¿Estás seguro de eliminar <strong>${escapeHtml(producto.nombre)}</strong>?<br>Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#b85c5c',
    cancelButtonText: 'Cancelar',
    confirmButtonText: 'Sí, eliminar'
  })
  if (!result.isConfirmed) return

  try {
    const { error } = await supabase.from('productos').delete().eq('id', id)
    if (error) throw error
    await mostrarExito(`Producto "${producto.nombre}" eliminado correctamente`)
    await cargarProductos()
  } catch (error) {
    mostrarError(friendlyError(error), 'No se pudo eliminar el producto')
  }
}

async function verHistorial(id) {
  try {
    const producto = productos.find(item => Number(item.id) === id)
    if (!producto) throw new Error('Producto no encontrado')
    const { data: movimientos, error } = await supabase.from('movimientos').select('created_at, tipo, cantidad, motivo, destinatario, usuario_id').eq('producto_id', id).order('created_at', { ascending: false })
    if (error) throw error

    const rows = (movimientos || []).map(mov => `
      <tr>
        <td>${formatDate(mov.created_at, true)}</td>
        <td><span class="badge ${mov.tipo === 'entrada' ? 'bg-success' : mov.tipo === 'salida' ? 'bg-danger' : 'bg-warning text-dark'}">${escapeHtml(mov.tipo || 'ajuste')}</span></td>
        <td>${Number(mov.cantidad) || 0} ${formatMovementUnit(producto, mov.cantidad)}</td>
        <td>${escapeHtml(mov.motivo || '-')}</td>
        <td>${escapeHtml(mov.destinatario || '-')}</td>
      </tr>`).join('')

    await Swal.fire({
      title: `Historial: ${escapeHtml(producto.nombre)}`,
      html: rows ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad / unidad</th><th>Motivo</th><th>Destinatario</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="text-muted">No hay movimientos registrados para este producto.</p>',
      width: 900,
      confirmButtonText: 'Cerrar'
    })
  } catch (error) {
    mostrarError(friendlyError(error), 'No se pudo obtener el historial')
  }
}

async function guardarCategoria(event) {
  event.preventDefault()
  const input = document.getElementById('categoryName')
  const button = document.getElementById('saveCategoryBtn')
  const name = input?.value.trim()
  if (!name) return

  button.disabled = true
  try {
    const { error } = await supabase.from('categorias').insert({ nombre: name })
    if (error) throw error
    await showToast(Swal, 'Categoría agregada correctamente.', 'success')
    input.value = ''
    await cargarCategorias()
  } catch (error) {
    mostrarError(friendlyError(error), 'No se pudo agregar la categoría')
  } finally {
    button.disabled = false
  }
}

function abrirGestorCategorias() {
  bootstrap.Modal.getOrCreateInstance(document.getElementById('categoriesModal')).show()
}

async function handleCategoryAction(event) {
  const button = event.target.closest('button[data-category-action]')
  if (!button) return
  const id = Number(button.dataset.id)
  const categoria = categorias.find(item => Number(item.id) === id)
  if (!categoria) return

  const result = await Swal.fire({
    title: '¿Eliminar categoría?',
    html: `Se eliminará <strong>${escapeHtml(categoria.nombre)}</strong>. Los productos relacionados deben quedar sin categoría antes de continuar.`,
    icon: 'warning',
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    confirmButtonText: 'Sí, eliminar',
    confirmButtonColor: '#b85c5c'
  })
  if (!result.isConfirmed) return

  try {
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) throw error
    await showToast(Swal, 'Categoría eliminada.', 'success')
    await Promise.all([cargarCategorias(), cargarProductos()])
  } catch (error) {
    mostrarError(friendlyError(error), 'No se pudo eliminar la categoría')
  }
}

function mostrarError(message, title = 'Error') {
  return Swal.fire({ icon: 'error', title, text: message })
}

function mostrarExito(message) {
  return Swal.fire({ icon: 'success', title: 'Éxito', text: message, timer: 2200, showConfirmButton: false })
}

// Compatibilidad con enlaces o personalizaciones antiguas.
window.editarProducto = editarProducto
window.mostrarModalAjuste = mostrarModalAjuste
window.verHistorial = verHistorial
window.eliminarProducto = eliminarProducto
