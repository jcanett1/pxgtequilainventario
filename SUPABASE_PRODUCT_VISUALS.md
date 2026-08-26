# Imágenes y categorías de productos

La pantalla de Productos ahora admite una presentación en tarjetas, búsqueda por nombre, filtro por categoría, administración de categorías y una imagen principal por producto.

## Activar imágenes en Supabase

La migración `supabase/migrations/20260826000000_product_visuals.sql` realiza tres cambios: agrega `productos.image_url`, crea el bucket público `product-images` con un límite de 5 MB y define políticas para que los usuarios autenticados puedan cargar, actualizar, consultar y eliminar imágenes.

Desde un entorno que tenga la CLI de Supabase instalada y permisos sobre el proyecto, ejecuta:

```bash
supabase login
supabase link --project-ref bwkvfwrrlizhqdpaxfmb
supabase db push
```

Si el proyecto ya utiliza otra forma de aplicar migraciones, ejecuta únicamente el archivo SQL desde el SQL Editor de Supabase.

> No coloques una service role key en `supabase-client.js`, en el HTML ni en JavaScript del navegador. La carga se realiza con la sesión del usuario autenticado y las policies de Supabase.

## Uso en la pantalla

Para crear una categoría, abre **Gestionar categorías**, escribe el nombre y presiona **Agregar categoría**. Después aparecerá en el selector del formulario y en el filtro del catálogo.

Para crear o editar un producto, selecciona una imagen JPG, PNG, WEBP o GIF de hasta 5 MB. La pantalla muestra una previsualización antes de guardar y almacena la URL pública en `productos.image_url`.

La búsqueda revisa el nombre, la descripción y el código de barras. El filtro de categoría se puede combinar con la búsqueda por texto y se limpia con el botón **Limpiar**.


## Presentación de inventario

Para activar la selección de productos por pieza o caja, aplica también `supabase/migrations/20260826000001_product_presentation.sql`. La guía completa de uso está en `SUPABASE_PRODUCT_PRESENTATION.md`.
