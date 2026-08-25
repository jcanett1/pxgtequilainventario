# Notas de implementación basadas en la documentación oficial de Supabase

## Fuentes consultadas

1. [User Management](https://supabase.com/docs/guides/auth/managing-user-data): el esquema `auth` no se expone automáticamente mediante la API generada; para consultar datos de usuarios desde la aplicación se recomienda crear una tabla pública `profiles` referenciada a `auth.users`, protegerla con RLS y usar `on delete cascade`. La documentación también describe el uso de `user_metadata` para datos de perfil y aclara que eliminar un usuario de Auth debe hacerse mediante `auth.admin.deleteUser()`.

2. [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth): las Edge Functions pueden validar el JWT del usuario con el modo de autenticación `user`; las operaciones privilegiadas pueden usar un cliente admin/service role únicamente dentro de la función, nunca en el navegador. La plataforma mantiene `verify_jwt = true` por defecto y expone el usuario autenticado a la función.

3. [JavaScript auth.admin.listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers), [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) y [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser): los métodos `auth.admin.*` requieren entorno de servidor y no deben llamarse desde el navegador ni con una service role key expuesta.

## Decisión para PXG

La interfaz pública usará el cliente Supabase con la clave publicable existente y llamará una Edge Function autenticada para listar, crear, actualizar y eliminar usuarios. El rol se almacenará en `app_metadata.role`, que solo podrá modificar la operación administrativa del servidor. Para el nombre visible y datos no sensibles se usará `user_metadata.full_name`. La página de administración estará protegida tanto por la interfaz como por la verificación server-side de que el usuario solicitante tenga `app_metadata.role = admin`.
