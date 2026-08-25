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

function showAuthenticatedState(user) {
  document.body.classList.remove('auth-pending')
  document.body.classList.add('auth-ready')

  const emailElement = document.getElementById('currentUserEmail')
  if (emailElement) {
    emailElement.textContent = user?.email || 'Sesión activa'
    emailElement.title = user?.email || 'Sesión activa'
  }

  const logoutButton = document.getElementById('logoutBtn')
  if (logoutButton && !logoutButton.dataset.authBound) {
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
}

async function requireAuthentication() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      redirectToLogin()
      return
    }

    showAuthenticatedState(data.session.user)

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) redirectToLogin()
    })
  } catch {
    redirectToLogin()
  }
}

void requireAuthentication()
