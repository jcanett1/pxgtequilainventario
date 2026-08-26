import { supabase } from './supabase-client.js'

const SLIDE_INTERVAL_MS = 5000
let slideshowTimer = null
let activeSlideIndex = 0

const elements = {
  loginForm: document.getElementById('loginForm'),
  resetForm: document.getElementById('resetForm'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  newPassword: document.getElementById('newPassword'),
  confirmPassword: document.getElementById('confirmPassword'),
  feedback: document.getElementById('loginFeedback'),
  loginTitle: document.getElementById('loginTitle'),
  loginSubtitle: document.getElementById('loginSubtitle'),
  loginSubmit: document.getElementById('loginSubmit'),
  resetSubmit: document.getElementById('resetSubmit'),
  forgotPassword: document.getElementById('forgotPasswordBtn'),
  backToLogin: document.getElementById('backToLoginBtn')
}

function initializeLoginSlideshow() {
  const slides = [...document.querySelectorAll('.login-slide')]
  const dots = [...document.querySelectorAll('.login-slideshow-dot')]
  if (slides.length <= 1) return

  const setActiveSlide = (nextIndex) => {
    activeSlideIndex = nextIndex
    slides.forEach((slide, index) => slide.classList.toggle('is-active', index === activeSlideIndex))
    dots.forEach((dot, index) => dot.classList.toggle('is-active', index === activeSlideIndex))
  }

  const stopSlideshow = () => {
    if (slideshowTimer) {
      window.clearInterval(slideshowTimer)
      slideshowTimer = null
    }
  }

  const startSlideshow = () => {
    stopSlideshow()
    slideshowTimer = window.setInterval(() => {
      setActiveSlide((activeSlideIndex + 1) % slides.length)
    }, SLIDE_INTERVAL_MS)
  }

  slides.forEach(slide => {
    const image = slide.querySelector('img')
    if (image) image.loading = 'eager'
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSlideshow()
    else startSlideshow()
  })
  window.addEventListener('pagehide', stopSlideshow, { once: true })
  startSlideshow()
}

function getRedirectTarget() {
  const requested = new URLSearchParams(window.location.search).get('redirect')
  if (!requested) return 'index.html'

  try {
    const target = new URL(requested, window.location.href)
    const currentOrigin = window.location.origin
    const targetPage = target.pathname.split('/').pop() || 'index.html'
    if (target.origin !== currentOrigin || targetPage === 'login.html') return 'index.html'

    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return 'index.html'
  }
}

function navigateToApp() {
  window.location.replace(getRedirectTarget())
}

function setFeedback(message = '', tone = '') {
  elements.feedback.textContent = message
  elements.feedback.className = `login-feedback${tone ? ` is-${tone}` : ''}`
}

function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'El correo o la contraseña no son correctos.'
  }
  if (message.includes('email not confirmed')) {
    return 'Tu correo todavía no ha sido confirmado. Revisa tu bandeja de entrada.'
  }
  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'No se pudo conectar con el servicio. Verifica tu conexión e intenta nuevamente.'
  }
  return 'No se pudo completar la operación. Verifica los datos e intenta nuevamente.'
}

function setBusy(button, busy) {
  if (!button) return
  button.disabled = busy
  button.querySelector('.submit-label')?.classList.toggle('is-hidden', busy)
  button.querySelector('.submit-loading')?.classList.toggle('is-hidden', !busy)
}

function showResetMode() {
  elements.loginForm.classList.add('is-hidden')
  elements.resetForm.classList.remove('is-hidden')
  elements.forgotPassword.classList.add('is-hidden')
  elements.loginTitle.textContent = 'Crea una nueva contraseña'
  elements.loginSubtitle.textContent = 'Define una contraseña nueva para proteger tu acceso al CRM.'
  setFeedback('Puedes actualizar tu contraseña de forma segura.', 'info')
  elements.newPassword.focus()
}

function showLoginMode(message = '') {
  elements.resetForm.classList.add('is-hidden')
  elements.loginForm.classList.remove('is-hidden')
  elements.forgotPassword.classList.remove('is-hidden')
  elements.loginTitle.textContent = 'Bienvenido de nuevo'
  elements.loginSubtitle.textContent = 'Ingresa tus credenciales para continuar al sistema.'
  if (message) setFeedback(message, 'success')
  else setFeedback()
  elements.email.focus()
}

function bindPasswordToggles() {
  document.querySelectorAll('[data-password-target]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordTarget)
      const icon = button.querySelector('i')
      if (!input || !icon) return

      const isVisible = input.type === 'text'
      input.type = isVisible ? 'password' : 'text'
      button.setAttribute('aria-pressed', String(!isVisible))
      button.setAttribute('aria-label', isVisible ? 'Mostrar contraseña' : 'Ocultar contraseña')
      icon.classList.toggle('fa-eye', isVisible)
      icon.classList.toggle('fa-eye-slash', !isVisible)
    })
  })
}

async function handleLogin(event) {
  event.preventDefault()
  const email = elements.email.value.trim()
  const password = elements.password.value

  if (!elements.loginForm.checkValidity()) {
    elements.loginForm.classList.add('was-validated')
    setFeedback('Escribe un correo válido y una contraseña de al menos 6 caracteres.', 'error')
    return
  }

  setFeedback()
  setBusy(elements.loginSubmit, true)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    setBusy(elements.loginSubmit, false)
    setFeedback(friendlyAuthError(error), 'error')
    return
  }

  setFeedback('Acceso validado. Abriendo el CRM…', 'success')
  navigateToApp()
}

async function handlePasswordResetRequest() {
  const email = elements.email.value.trim()
  if (!email || !elements.email.checkValidity()) {
    elements.email.focus()
    setFeedback('Escribe primero el correo asociado a tu cuenta.', 'error')
    return
  }

  elements.forgotPassword.disabled = true
  setFeedback('Enviando instrucciones de recuperación…', 'info')
  const redirectTo = new URL('login.html', window.location.href).href
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  elements.forgotPassword.disabled = false

  if (error) {
    setFeedback(friendlyAuthError(error), 'error')
    return
  }

  setFeedback('Si el correo existe, recibirás las instrucciones para restablecer tu contraseña.', 'success')
}

async function handlePasswordUpdate(event) {
  event.preventDefault()
  const newPassword = elements.newPassword.value
  const confirmPassword = elements.confirmPassword.value

  if (!elements.resetForm.checkValidity()) {
    elements.resetForm.classList.add('was-validated')
    setFeedback('La contraseña debe tener al menos 6 caracteres.', 'error')
    return
  }

  if (newPassword !== confirmPassword) {
    setFeedback('Las contraseñas no coinciden.', 'error')
    elements.confirmPassword.focus()
    return
  }

  setBusy(elements.resetSubmit, true)
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  setBusy(elements.resetSubmit, false)

  if (error) {
    setFeedback(friendlyAuthError(error), 'error')
    return
  }

  await supabase.auth.signOut()
  showLoginMode('Contraseña actualizada. Ahora puedes ingresar con tu nueva contraseña.')
  elements.password.value = ''
}

async function initialize() {
  initializeLoginSlideshow()
  bindPasswordToggles()
  elements.loginForm.addEventListener('submit', handleLogin)
  elements.resetForm.addEventListener('submit', handlePasswordUpdate)
  elements.forgotPassword.addEventListener('click', handlePasswordResetRequest)
  elements.backToLogin.addEventListener('click', () => showLoginMode())

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') showResetMode()
    if (event === 'SIGNED_OUT' && !elements.resetForm.classList.contains('is-hidden')) showLoginMode()
    if (event === 'SIGNED_IN' && session && elements.resetForm.classList.contains('is-hidden')) navigateToApp()
  })

  const { data } = await supabase.auth.getSession()
  if (data.session && !window.location.hash.includes('type=recovery')) {
    navigateToApp()
    return
  }

  if (window.location.hash.includes('type=recovery')) showResetMode()
  else elements.email.focus()
}

void initialize()
