import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''

const allowedOrigins = new Set([
  'https://jcanett1.github.io',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://jcanett1.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }
}

function response(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) })
}

function cleanUser(user: any) {
  return {
    id: user.id,
    email: user.email ?? '',
    role: user.app_metadata?.role === 'admin' ? 'admin' : 'usuario',
    user_metadata: {
      full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
    },
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    banned_until: user.banned_until ?? null
  }
}

async function requireAdmin(req: Request) {
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    throw new Error('Faltan secretos de Supabase en la Edge Function.')
  }

  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) {
    return { error: 'Sesión requerida.', status: 401 }
  }

  const supabaseUser = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  })
  const { data, error } = await supabaseUser.auth.getUser()
  if (error || !data.user) return { error: 'Sesión inválida o expirada.', status: 401 }

  const role = data.user.app_metadata?.role === 'admin' ? 'admin' : 'usuario'
  if (role !== 'admin') return { error: 'Solo un administrador puede gestionar usuarios.', status: 403 }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return { user: data.user, admin }
}

async function countAdmins(admin: any) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return (data.users ?? []).filter((user: any) => user.app_metadata?.role === 'admin').length
}

function validEmail(value: unknown) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function validRole(value: unknown) {
  return value === 'admin' || value === 'usuario'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return response(req, { error: 'Método no permitido.' }, 405)

  try {
    const auth = await requireAdmin(req)
    if ('error' in auth) return response(req, { error: auth.error }, auth.status)

    const body = await req.json().catch(() => ({}))
    const action = body?.action

    if (action === 'list') {
      const { data, error } = await auth.admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (error) throw error
      return response(req, { users: (data.users ?? []).map(cleanUser) })
    }

    if (action === 'create') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
      const role = body.role

      if (!validEmail(email)) return response(req, { error: 'El correo electrónico no es válido.' }, 400)
      if (password.length < 6) return response(req, { error: 'La contraseña debe tener al menos 6 caracteres.' }, 400)
      if (fullName.length < 2) return response(req, { error: 'El nombre completo es obligatorio.' }, 400)
      if (!validRole(role)) return response(req, { error: 'El perfil seleccionado no es válido.' }, 400)

      const { data, error } = await auth.admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { role }
      })
      if (error) throw error
      return response(req, { user: cleanUser(data.user) }, 201)
    }

    if (action === 'update') {
      const id = typeof body.id === 'string' ? body.id : ''
      const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
      const role = body.role
      if (!id) return response(req, { error: 'Falta el identificador del usuario.' }, 400)
      if (fullName.length < 2) return response(req, { error: 'El nombre completo es obligatorio.' }, 400)
      if (!validRole(role)) return response(req, { error: 'El perfil seleccionado no es válido.' }, 400)

      const { data: existingData, error: existingError } = await auth.admin.auth.admin.getUserById(id)
      if (existingError || !existingData.user) return response(req, { error: 'Usuario no encontrado.' }, 404)
      const existingUser = existingData.user
      const existingRole = existingUser.app_metadata?.role === 'admin' ? 'admin' : 'usuario'

      if (id === auth.user.id && role !== 'admin') {
        return response(req, { error: 'No puedes quitarte el perfil administrador a ti mismo.' }, 409)
      }
      if (existingRole === 'admin' && role !== 'admin' && await countAdmins(auth.admin) <= 1) {
        return response(req, { error: 'No puedes degradar al último administrador.' }, 409)
      }

      const { data, error } = await auth.admin.auth.admin.updateUserById(id, {
        user_metadata: { ...(existingUser.user_metadata ?? {}), full_name: fullName },
        app_metadata: { ...(existingUser.app_metadata ?? {}), role }
      })
      if (error) throw error
      return response(req, { user: cleanUser(data.user) })
    }

    if (action === 'delete') {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return response(req, { error: 'Falta el identificador del usuario.' }, 400)
      if (id === auth.user.id) return response(req, { error: 'No puedes eliminar tu propia cuenta.' }, 409)

      const { data: existingData, error: existingError } = await auth.admin.auth.admin.getUserById(id)
      if (existingError || !existingData.user) return response(req, { error: 'Usuario no encontrado.' }, 404)
      if (existingData.user.app_metadata?.role === 'admin' && await countAdmins(auth.admin) <= 1) {
        return response(req, { error: 'No puedes eliminar al último administrador.' }, 409)
      }

      const { error } = await auth.admin.auth.admin.deleteUser(id)
      if (error) throw error
      return response(req, { ok: true })
    }

    return response(req, { error: 'Acción no reconocida.' }, 400)
  } catch (error) {
    console.error(error)
    return response(req, { error: error instanceof Error ? error.message : 'Error interno de la función.' }, 500)
  }
})
