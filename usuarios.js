import { supabase } from './supabase-client.js'

const FUNCTION_NAME = 'admin-users'
const elements = {
  tableBody: document.getElementById('usersTableBody'),
  loading: document.getElementById('usersLoading'),
  empty: document.getElementById('usersEmpty'),
  feedback: document.getElementById('usersFeedback'),
  search: document.getElementById('userSearch'),
  newButton: document.getElementById('newUserBtn'),
  modal: document.getElementById('userModal'),
  modalTitle: document.getElementById('userModalTitle'),
  form: document.getElementById('userForm'),
  formFeedback: document.getElementById('userFormFeedback'),
  fullName: document.getElementById('userFullName'),
  email: document.getElementById('userEmail'),
  password: document.getElementById('userPassword'),
  passwordWrap: document.getElementById('passwordFieldWrap'),
  role: document.getElementById('userRole'),
  saveButton: document.getElementById('saveUserBtn'),
  saveLabel: document.querySelector('#saveUserBtn .save-label'),
  saveLoading: document.querySelector('#saveUserBtn .save-loading')
}

const state = {
  users: [],
  editingId: null,
  currentUserId: null,
  modal: null
}

function displayName(user) {
  return user.user_metadata?.full_name?.trim() || user.email?.split('@')[0] || 'Sin nombre'
}

function roleLabel(role) {
  return role === 'admin' ? 'Administrador' : 'Usuario'
}

function formatDate(value) {
  if (!value) return 'Sin acceso registrado'
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function setFeedback(message = '', type = 'info') {
  elements.feedback.textContent = message
  elements.feedback.className = message ? `alert alert-${type}` : 'alert d-none'
}

function setFormFeedback(message = '', type = 'danger') {
  elements.formFeedback.textContent = message
  elements.formFeedback.className = message ? `alert alert-${type}` : 'alert d-none'
}

function setLoading(isLoading) {
  elements.loading.classList.toggle('d-none', !isLoading)
  if (isLoading) elements.empty.classList.add('d-none')
}

function setSaving(isSaving) {
  elements.saveButton.disabled = isSaving
  elements.saveLabel.classList.toggle('d-none', isSaving)
  elements.saveLoading.classList.toggle('d-none', !isSaving)
}

function friendlyError(error) {
  const message = error?.message || 'No se pudo completar la operación.'
  if (/function.*not.*found|404/i.test(message)) return 'La administración de usuarios todavía no está desplegada en Supabase. Revisa SUPABASE_AUTH_SETUP.md.'
  if (/already.*registered|already exists/i.test(message)) return 'Ya existe una cuenta con ese correo electrónico.'
  if (/unauthorized|401/i.test(message)) return 'Tu sesión ya no es válida. Vuelve a iniciar sesión.'
  if (/forbidden|403|admin/i.test(message)) return 'No tienes permisos de administrador para realizar esta acción.'
  return message
}

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { action, ...payload }
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

function createCell(text, className = '') {
  const cell = document.createElement('td')
  cell.textContent = text
  if (className) cell.className = className
  return cell
}

function createUserCell(user) {
  const cell = document.createElement('td')
  const wrapper = document.createElement('div')
  wrapper.className = 'user-row-identity'

  const avatar = document.createElement('span')
  avatar.className = 'user-row-avatar'
  avatar.innerHTML = '<i class="fas fa-user" aria-hidden="true"></i>'

  const details = document.createElement('div')
  const name = document.createElement('strong')
  name.textContent = displayName(user)
  const email = document.createElement('small')
  email.textContent = user.email || 'Sin correo'
  details.append(name, email)
  wrapper.append(avatar, details)
  cell.append(wrapper)
  return cell
}

function createRoleCell(user) {
  const cell = document.createElement('td')
  const badge = document.createElement('span')
  badge.className = `user-role-badge ${user.role === 'admin' ? 'is-admin' : ''}`
  badge.textContent = roleLabel(user.role)
  cell.append(badge)
  return cell
}

function createStatusCell(user) {
  const cell = document.createElement('td')
  const badge = document.createElement('span')
  const isBanned = Boolean(user.banned_until && new Date(user.banned_until) > new Date())
  const isConfirmed = Boolean(user.email_confirmed_at)
  badge.className = `user-status-badge ${isBanned ? 'is-banned' : isConfirmed ? 'is-active' : 'is-pending'}`
  badge.textContent = isBanned ? 'Bloqueado' : isConfirmed ? 'Activo' : 'Pendiente'
  cell.append(badge)
  return cell
}

function createActionsCell(user) {
  const cell = document.createElement('td')
  cell.className = 'text-end'
  const actions = document.createElement('div')
  actions.className = 'user-row-actions'

  const editButton = document.createElement('button')
  editButton.type = 'button'
  editButton.className = 'btn btn-sm btn-outline-primary'
  editButton.dataset.userAction = 'edit'
  editButton.dataset.userId = user.id
  editButton.title = 'Editar usuario'
  editButton.innerHTML = '<i class="fas fa-pen" aria-hidden="true"></i><span class="visually-hidden">Editar</span>'

  const deleteButton = document.createElement('button')
  deleteButton.type = 'button'
  deleteButton.className = 'btn btn-sm btn-outline-danger'
  deleteButton.dataset.userAction = 'delete'
  deleteButton.dataset.userId = user.id
  deleteButton.title = user.id === state.currentUserId ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'
  deleteButton.disabled = user.id === state.currentUserId
  deleteButton.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i><span class="visually-hidden">Eliminar</span>'

  actions.append(editButton, deleteButton)
  cell.append(actions)
  return cell
}

function renderUsers() {
  const query = elements.search.value.trim().toLowerCase()
  const filtered = state.users.filter((user) => `${displayName(user)} ${user.email || ''}`.toLowerCase().includes(query))

  elements.tableBody.replaceChildren()
  filtered.forEach((user) => {
    const row = document.createElement('tr')
    row.append(
      createUserCell(user),
      createRoleCell(user),
      createStatusCell(user),
      createCell(formatDate(user.last_sign_in_at), 'text-muted'),
      createActionsCell(user)
    )
    elements.tableBody.append(row)
  })

  elements.empty.classList.toggle('d-none', filtered.length > 0)
  if (filtered.length === 0) {
    const emptyStrong = elements.empty.querySelector('strong')
    if (emptyStrong) emptyStrong.textContent = query ? 'No hay coincidencias' : 'No hay usuarios que mostrar'
  }
}

function openNewUser() {
  state.editingId = null
  elements.modalTitle.textContent = 'Nuevo usuario'
  elements.form.reset()
  elements.email.disabled = false
  elements.passwordWrap.classList.remove('d-none')
  elements.password.required = true
  elements.role.value = 'usuario'
  setFormFeedback()
  state.modal.show()
}

function openEditUser(user) {
  state.editingId = user.id
  elements.modalTitle.textContent = 'Editar usuario'
  elements.fullName.value = user.user_metadata?.full_name || ''
  elements.email.value = user.email || ''
  elements.email.disabled = true
  elements.password.value = ''
  elements.password.required = false
  elements.passwordWrap.classList.add('d-none')
  elements.role.value = user.role === 'admin' ? 'admin' : 'usuario'
  setFormFeedback()
  state.modal.show()
}

async function loadUsers() {
  setLoading(true)
  try {
    const result = await invoke('list')
    state.users = Array.isArray(result?.users) ? result.users : []
    renderUsers()
    setFeedback(state.users.length ? '' : 'Todavía no hay cuentas adicionales registradas.', 'info')
  } catch (error) {
    state.users = []
    renderUsers()
    setFeedback(friendlyError(error), 'danger')
  } finally {
    setLoading(false)
  }
}

async function handleSave(event) {
  event.preventDefault()
  setFormFeedback()

  const fullName = elements.fullName.value.trim()
  const email = elements.email.value.trim().toLowerCase()
  const password = elements.password.value
  const role = elements.role.value === 'admin' ? 'admin' : 'usuario'

  if (fullName.length < 2) return setFormFeedback('Escribe el nombre completo del usuario.')
  if (!email || !email.includes('@')) return setFormFeedback('Escribe un correo electrónico válido.')
  if (!state.editingId && password.length < 6) return setFormFeedback('La contraseña temporal debe tener al menos 6 caracteres.')

  setSaving(true)
  try {
    if (state.editingId) {
      await invoke('update', { id: state.editingId, full_name: fullName, role })
      setFeedback('Usuario actualizado correctamente.', 'success')
    } else {
      await invoke('create', { email, password, full_name: fullName, role })
      setFeedback('Usuario creado correctamente en Supabase Auth.', 'success')
    }
    state.modal.hide()
    await loadUsers()
  } catch (error) {
    setFormFeedback(friendlyError(error))
  } finally {
    setSaving(false)
  }
}

async function handleTableAction(event) {
  const button = event.target.closest('[data-user-action]')
  if (!button) return
  const user = state.users.find((item) => item.id === button.dataset.userId)
  if (!user) return

  if (button.dataset.userAction === 'edit') {
    openEditUser(user)
    return
  }

  if (button.dataset.userAction === 'delete') {
    if (user.id === state.currentUserId) return
    const confirmed = window.confirm(`¿Eliminar la cuenta de ${user.email}? Esta acción revoca su acceso al CRM.`)
    if (!confirmed) return

    button.disabled = true
    try {
      await invoke('delete', { id: user.id })
      setFeedback('Usuario eliminado y acceso revocado.', 'success')
      await loadUsers()
    } catch (error) {
      button.disabled = false
      setFeedback(friendlyError(error), 'danger')
    }
  }
}

async function initialize() {
  const auth = await window.pxgAuthReady
  if (!auth?.isAdmin) return

  state.currentUserId = auth.userId
  state.modal = bootstrap.Modal.getOrCreateInstance(elements.modal)
  elements.newButton.addEventListener('click', openNewUser)
  elements.form.addEventListener('submit', handleSave)
  elements.search.addEventListener('input', renderUsers)
  elements.tableBody.addEventListener('click', handleTableAction)
  await loadUsers()
}

void initialize()
