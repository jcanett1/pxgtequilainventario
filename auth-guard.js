import { supabase } from './supabase-client.js'

const LOGIN_PAGE = 'login.html'

function getCurrentPage() {
  const page = window.location.pathname.split('/').pop() || 'index.html'
  return `${page}${window.location.search}`
}

function redirectToLogin() {
  const redirect = encodeURIComponent(getCurrentPage())
  window.location.replace(`${LOGIN_PAGE}?redirect=${redirect}`)
}

function normalizeRole(user) {
  return user?.app_metadata?.role === 'admin' ? 'admin' : 'usuario'
}

function displayNameFor(user) {
  return user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Usuario'
}

function populateProfile(user, role) {
  const displayName = displayNameFor(user)
  const email = user?.email || 'Sesión activa'
  const roleLabel = role === 'admin' ? 'Administrador' : 'Usuario'

  const currentUserEmail = document.getElementById('currentUserEmail')
  if (currentUserEmail) {
    currentUserEmail.textContent = email
    currentUserEmail.title = email
  }

  const profileTriggerName = document.getElementById('profileTriggerName')
  if (profileTriggerName) profileTriggerName.textContent = displayName

  const profileDisplayName = document.getElementById('profileDisplayName')
  if (profileDisplayName) profileDisplayName.textContent = displayName

  const profileEmail = document.getElementById('profileEmail')
  if (profileEmail) {
    profileEmail.textContent = email
    profileEmail.title = email
  }

  const profileRole = document.getElementById('profileRole')
  if (profileRole) {
    profileRole.textContent = roleLabel
    profileRole.classList.toggle('is-admin', role === 'admin')
  }

  const manageUsersLink = document.getElementById('manageUsersLink')
  if (manageUsersLink) manageUsersLink.classList.toggle('d-none', role !== 'admin')
}

function bindLogoutButton() {
  const logoutButton = document.getElementById('logoutBtn')
  if (!logoutButton || logoutButton.dataset.authBound) return

  logoutButton.dataset.authBound = 'true'
  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true
    logoutButton.classList.add('is-loading')
    const { error } = await supabase.auth.signOut()
    if (error) {
      logoutButton.disabled = false
      logoutButton.classList.remove('is-loading')
      window.alert('No se pudo cerrar la sesión. Intenta nuevamente.')
      return
    }
    redirectToLogin()
  })
}

function showAuthenticatedState(user) {
  const role = normalizeRole(user)
  const isAdmin = role === 'admin'
  window.pxgAuth = { userId: user.id, role, isAdmin }

  populateProfile(user, role)
  bindLogoutButton()
  document.body.classList.remove('auth-pending')
  document.body.classList.add('auth-ready')
}

async function requireAuthentication() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      redirectToLogin()
      return null
    }

    const user = data.session.user
    const role = normalizeRole(user)
    if (document.body.dataset.requiresAdmin === 'true' && role !== 'admin') {
      window.location.replace('index.html?access=denied')
      return null
    }

    showAuthenticatedState(user)

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) redirectToLogin()
      if (session?.user) showAuthenticatedState(session.user)
    })

    return window.pxgAuth
  } catch {
    redirectToLogin()
    return null
  }
}

window.pxgAuthReady = requireAuthentication()
