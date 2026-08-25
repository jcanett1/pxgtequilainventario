export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(Number(value) || 0)
}

export function formatDate(value, withTime = false) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('es-MX', withTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }
  ).format(date)
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function showToast(Swal, title, icon = 'info') {
  return Swal.fire({
    title,
    icon,
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3200,
    timerProgressBar: true
  })
}

export function setTableState(tbody, colspan, message, tone = 'muted') {
  if (!tbody) return
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-${tone} py-4">${escapeHtml(message)}</td></tr>`
}

export function setButtonBusy(button, busy, busyLabel = 'Procesando...') {
  if (!button) return
  if (busy) {
    button.dataset.originalLabel = button.innerHTML
    button.disabled = true
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${busyLabel}`
  } else {
    button.disabled = false
    if (button.dataset.originalLabel) button.innerHTML = button.dataset.originalLabel
  }
}

export function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (/JWT expired|session/i.test(message)) return 'La sesión ha expirado. Recarga la página.'
  if (/permission denied|row-level security/i.test(message)) return 'No tienes permisos para esta acción.'
  if (/duplicate key|unique/i.test(message)) return 'Ya existe un registro con esos datos.'
  if (/foreign key/i.test(message)) return 'No se puede completar porque el registro relacionado ya no existe.'
  return message || 'Ocurrió un error inesperado. Intenta nuevamente.'
}
