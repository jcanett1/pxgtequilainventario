# Configuración de usuarios y perfiles en Supabase Auth

La interfaz de usuarios del CRM PXG usa la Edge Function `admin-users`. La función valida el JWT del usuario conectado y solo permite operaciones cuando `app_metadata.role` es `admin`. Las operaciones `auth.admin.*` deben ejecutarse únicamente en un entorno de servidor y nunca desde el navegador [1] [2]. La service role key se usa exclusivamente como secreto de Supabase y nunca se incluye en el repositorio ni en el navegador.

## 1. Desplegar la función

Instala la CLI de Supabase, inicia sesión con tu cuenta y vincula el proyecto `bwkvfwrrlizhqdpaxfmb`:

```bash
supabase login
supabase link --project-ref bwkvfwrrlizhqdpaxfmb
```

En el panel web de Supabase, los nombres que empiezan por `SUPABASE_` están reservados para variables internas. Por eso crea un secreto personalizado llamado `PXG_ADMIN_SERVICE_ROLE_KEY`. La función también conserva compatibilidad con variables reservadas disponibles automáticamente en algunos proyectos:

```bash
supabase secrets set PXG_ADMIN_SERVICE_ROLE_KEY="TU_SECRET_KEY_PRIVADA_DE_SUPABASE"
supabase functions deploy admin-users
```

El gateway mantiene `verify_jwt = true` y la función vuelve a comprobar el JWT y el rol admin dentro de su código. El archivo `supabase/config.toml` deja declarada la misma política.

> Nunca coloques `PXG_ADMIN_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` ni `SUPABASE_SERVICE_ROLE_KEY` en `supabase-client.js`, en GitHub Pages, en HTML, en JavaScript del navegador ni en un repositorio público. En el panel de Secrets sí puedes guardarlo como secreto cifrado; no necesitas compartirlo en el chat.

## 2. Convertir la primera cuenta en administrador

Después de crear o identificar la cuenta que debe administrar el sistema, ejecuta en el SQL Editor de Supabase una sola vez. Sustituye el correo por el correo exacto de la cuenta:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = lower('tu-correo@empresa.com');
```

Cierra sesión y vuelve a entrar en el CRM para que el nuevo `app_metadata.role` se refleje en el token de sesión. A partir de ese momento aparecerá **Administrar usuarios** dentro del icono de perfil.

## 3. Roles disponibles

El sistema utiliza dos perfiles. `admin` puede listar, crear, modificar y eliminar cuentas desde `usuarios.html`. `usuario` puede usar las pantallas operativas del CRM, pero no ve el enlace de administración y, aunque intente abrir la URL manualmente, la Edge Function rechaza la operación con HTTP 403.

## 4. Operaciones soportadas

La pantalla permite crear una cuenta con nombre, correo, contraseña temporal y rol; editar el nombre y el rol; buscar por nombre o correo; y eliminar una cuenta. Para evitar bloquear el sistema, no se permite que un administrador se elimine a sí mismo ni que se degrade o elimine al último administrador. La eliminación usa la administración de Auth del lado servidor, que es el mecanismo recomendado para revocar el acceso de una cuenta [3].

## 5. Seguridad de la base de datos

El guard de la interfaz evita mostrar pantallas internas sin sesión, pero la protección real de las tablas del inventario depende de RLS. Configura policies para el rol `authenticated` y, si deseas separar operaciones, usa `auth.jwt() -> 'app_metadata' ->> 'role'` para permitir acciones administrativas. Las tablas `productos`, `movimientos`, `proveedores`, `categorias`, `ubicaciones` e `historial_precios` deben tener RLS activado y policies explícitas. Supabase recomienda proteger las tablas públicas con RLS y mantener los datos de Auth fuera del acceso API directo [1].

## Referencias

[1]: https://supabase.com/docs/guides/auth/managing-user-data "Supabase User Management"
[2]: https://supabase.com/docs/guides/functions/auth "Supabase Securing Edge Functions"
[3]: https://supabase.com/docs/reference/javascript/auth-admin-deleteuser "Supabase Auth Admin Delete User"
