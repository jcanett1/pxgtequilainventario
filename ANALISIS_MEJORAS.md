# Análisis y mejoras — CRM Inventario PXG

**Proyecto:** PXG Tequila Inventarios  
**Fecha de revisión:** 25 de agosto de 2026  
**Repositorio:** `jcanett1/pxgtequilainventario`

## Resumen ejecutivo

El sistema publicado es una aplicación web estática que utiliza HTML, Bootstrap, JavaScript modular y Supabase como base de datos [1] [2]. El modelo relacional proporcionado es adecuado para una primera versión de inventarios: separa productos, categorías, proveedores, movimientos, historial de precios y ubicaciones, y mantiene relaciones mediante identificadores.

La inspección encontró que varias pantallas estaban publicadas, pero algunos módulos no podían ejecutarse por imports faltantes y otros consultaban nombres de columnas que no existen en el esquema real. También había desalineaciones entre encabezados y datos en reportes, una acción de edición de stock que solo escribía en consola y varios puntos donde los datos de Supabase se interpolaban directamente en HTML.

Se implementó una corrección de base orientada a estabilizar el sistema sin cambiar la estructura de la base de datos. Dashboard, productos, movimientos, stock, proveedores y reportes ahora comparten el cliente de Supabase, usan las columnas reales del modelo y presentan estados de carga, vacío y error más claros.

## Estado observado antes de los cambios

| Área | Problema identificado | Impacto |
| --- | --- | --- |
| Dashboard | Chart.js se declaraba en el import map, pero no se importaba como módulo; las métricas podían quedar en `--`. | Gráficos y métricas incompletos. |
| Productos | Se utilizaba `createClient` sin importarlo. | El módulo no podía iniciar de forma confiable. |
| Movimientos | Se utilizaba `createClient` sin importarlo. | No cargaban historial ni formularios conectados a datos. |
| Stock | Se utilizaba `createClient` sin importarlo; además, el script agregaba una octava celda que no tenía encabezado. | Tabla desalineada y acción de edición sin implementación. |
| Reportes | Se consultaban `categoria`, `stock`, `stock_minimo` y `created_at` en productos, aunque el esquema usa `categoria_id`, `cantidad` y `fecha_ingreso`. | Los reportes de productos y stock podían fallar. |
| Reportes | Los encabezados mostraban `Precio`, `Notas` y `Productos` donde el script presentaba otros datos. | Confusión al exportar o interpretar información. |
| Proveedores | Había eventos inline y valores de base de datos interpolados sin una estrategia uniforme de saneamiento. | Mayor riesgo de errores y de inyección de HTML. |

## Mejoras implementadas

### Configuración y seguridad del cliente

Se añadieron `supabase-client.js` y `ui-utils.js`. El primero centraliza la URL, la clave pública anon y las opciones de sesión de Supabase. El segundo concentra el escape de HTML, el formato de moneda, las fechas locales, los mensajes de error y los estados de tablas.

La clave utilizada es la clave pública anon que ya existía en el proyecto. Esta clave no sustituye las políticas de seguridad de Supabase: las tablas deben continuar protegidas mediante RLS y policies apropiadas [3]. No se incorporó ninguna service key al navegador.

### Dashboard

El dashboard ahora importa Chart.js explícitamente, registra sus componentes y destruye los gráficos anteriores antes de volver a pintarlos. Las métricas se calculan con rangos de fecha locales para evitar desplazamientos de día por zona horaria. El valor total del inventario se muestra como moneda mexicana y la tabla de productos recientes escapa los textos antes de renderizarlos.

También se usa `Promise.allSettled` para que una falla aislada no impida que las demás secciones del dashboard continúen funcionando.

### Productos

El módulo de productos fue conectado al cliente compartido. Sus acciones se manejan mediante delegación de eventos en lugar de atributos `onclick`, y los valores provenientes de Supabase se escapan antes de incorporarse a la interfaz.

Se conservaron las operaciones de alta, edición, eliminación, ajuste de stock e historial de movimientos. Al modificar un precio, se intenta registrar el cambio en `historial_precios`. Si la política de Supabase no permite ese insert, se informa en consola sin impedir la actualización principal del producto.

Los ajustes de entrada de inventario utilizan una actualización condicional basada en la cantidad actual. Si el registro del movimiento falla, el código intenta revertir la cantidad para reducir el riesgo de dejar el stock desfasado.

### Movimientos

El historial ahora consulta las relaciones con la sintaxis coherente con `producto_id` y muestra destinatario, usuario, motivo, fecha y tipo. La salida valida cantidad, destinatario y stock disponible antes de actualizar.

El registro genérico de entradas, salidas y ajustes utiliza una actualización condicional de cantidad. Si el movimiento no se puede insertar, se intenta revertir el cambio. Esta estrategia mejora la consistencia frente a errores de red, aunque la garantía transaccional completa requiere una función RPC en Supabase que actualice producto y movimiento dentro de una única transacción.

### Stock

La vista de stock se convirtió en una consulta de lectura coherente con su propósito. Ahora utiliza siete columnas alineadas con `stock.html`, muestra niveles críticos, bajos y normales, y elimina la acción de edición que antes no tenía implementación. Los ajustes de inventario continúan disponibles desde Productos, donde existe el flujo correspondiente.

### Reportes

Se corrigieron las consultas para utilizar `categoria_id`, `cantidad`, `fecha_ingreso` y las relaciones con categorías. El reporte de stock ya no depende de `stock_minimo`, columna que no aparece en el esquema proporcionado; en su lugar calcula un estado operativo basado en la cantidad actual: **Crítico** hasta 5 unidades, **Bajo** de 6 a 15 y **Normal** por encima de 15.

Los encabezados ahora coinciden con los datos: movimientos muestra motivo y destinatario; stock muestra estado; proveedores muestra fecha de alta. La exportación a Excel y PDF se conserva.

### Proveedores

El CRUD de proveedores se integró con el cliente compartido. Las filas se renderizan sin eventos inline, con acciones identificadas por `data-*`, y el botón de alta utiliza un identificador accesible. También se corrigió un atributo `alt` duplicado en el logo.

## Validación realizada

La validación estática se ejecutó sobre todos los módulos JavaScript mediante comprobación de sintaxis y `git diff --check`. Además, se revisó que no quedaran eventos `onclick` en los archivos del proyecto ni referencias a las columnas obsoletas de reportes.

La aplicación se probó en una copia local servida por HTTP contra la base de datos configurada. Los resultados observados se resumen a continuación.

| Prueba | Resultado observado |
| --- | --- |
| Dashboard | 1 producto, 0 movimientos del día y valor total de stock de $360.00 MXN; gráficos visibles. |
| Productos | Se cargó `sabritas`, categoría `Abarrotes`, cantidad 2, precio $180.00, proveedor `julio` y ubicación `Toolcrib`. |
| Alta de producto | El modal abrió correctamente y cargó categorías, proveedores y fecha local. |
| Movimientos | El producto apareció en el selector con 2 unidades disponibles y la fecha de salida se asignó al día local. |
| Stock | La tabla mostró siete columnas coherentes y marcó la cantidad 2 como nivel crítico. |
| Reportes | Los filtros cargaron producto y categoría; el reporte de productos generó correctamente el registro real con descripción y precio. |
| Proveedores | La página cargó sin errores visibles y el botón de alta quedó enlazado desde JavaScript. |

## Recomendaciones siguientes

La siguiente mejora de mayor valor es implementar una función RPC transaccional en Supabase para registrar cada movimiento y actualizar la cantidad de producto dentro de una única operación. También conviene agregar una política de autenticación y autorización explícita por rol, porque la aplicación actualmente permite operar sobre la base desde el navegador y la protección efectiva depende de RLS.

A nivel funcional, recomiendo agregar niveles mínimos por producto o por categoría, códigos de barras con búsqueda rápida, filtros de texto en tablas, paginación para inventarios grandes, auditoría de cambios y un flujo completo de devolución que cree un movimiento relacionado con la salida original. La tabla `ubicaciones` también puede incorporarse al formulario de productos en lugar de mantener ubicación como texto libre.

## Referencias

[1]: https://jcanett1.github.io/pxgtequilainventario/index.html "Aplicación publicada — Dashboard PXG Tequila"
[2]: https://github.com/jcanett1/pxgtequilainventario "Repositorio GitHub — PXG Tequila Inventarios"
[3]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase — Row Level Security"


## Verificación pública posterior al commit

Después del commit `8c44b43` y del push a `main`, GitHub Pages comenzó a servir el dashboard actualizado. La versión pública mostró 1 producto, 0 movimientos del día, un valor de stock de $360.00 MXN y el producto `sabritas` en la tabla reciente. La captura visual del navegador todavía mostró los contenedores de canvas sin contenido dibujado, por lo que conviene revisar la carga de Chart.js en el navegador del usuario si los gráficos no aparecen en su sesión; las métricas y la tabla sí quedaron confirmadas en la página pública.


La publicación final ya entrega `supabase-client.js`, `ui-utils.js` y los scripts corregidos con código HTTP 200. Las métricas y la tabla pública cargan correctamente; sin embargo, el dashboard muestra un error aislado en el gráfico de movimientos recientes. Se continuará con la inspección de esa consulta antes de considerar la versión terminada.


En la segunda publicación se agregaron parámetros de versión a los scripts HTML y el build `cb4e7c6` terminó correctamente. Los archivos compartidos ya responden con HTTP 200. La carga pública de métricas continúa presentando intermitencia visual en el dashboard y el gráfico de movimientos no se dibuja de forma consistente; se mantiene como punto de revisión antes de finalizar.


## Cierre de verificación pública

La inspección del DOM público confirmó que las métricas del dashboard son `1`, `0` y `$360.00`, que ambos canvas tienen dimensiones válidas y que el canvas de movimientos contiene píxeles renderizados sin alertas activas. La pantalla pública de Productos carga el registro `sabritas` y sus cuatro acciones. La apariencia del canvas en la captura puede variar por el tiempo de composición del navegador, pero el estado DOM y la ejecución pública quedaron comprobados.


## Incidencia reportada y corrección en curso

Se detectó que `proveedores.js` importaba `escapeHtml` desde `ui-utils.js` y además lo declaraba nuevamente en el mismo módulo, provocando `Uncaught SyntaxError: Identifier 'escapeHtml' has already been declared`. La declaración local fue eliminada y el script recibió una nueva versión de caché. La comprobación de sintaxis ya es correcta y la consola local no muestra errores, pero la tabla de proveedores continúa sin filas visibles; se está revisando la consulta y el renderizado de datos antes de publicar.


La corrección se validó en local: la consulta a `proveedores` devolvió 1 registro (`julio`, ID 3) y el DOM terminó mostrando la fila con contacto, teléfono, correo, dirección y fecha. La captura inicial vacía correspondía al momento previo a completar la carga asíncrona; después de actualizar la vista, el proveedor aparece correctamente.


## Verificación pública de la corrección de proveedores

El build asociado al commit `a64015e` terminó correctamente. En la página pública, después de completar la carga asíncrona, aparece el proveedor registrado con ID 3, nombre `julio`, contacto, teléfono, correo, dirección, fecha y acciones de editar/eliminar. La declaración duplicada de `escapeHtml` ya no existe y el módulo carga sin el error reportado.


## Renovación visual de la interfaz

Para profesionalizar la apariencia se definió una paleta tipo tequila premium corporativo: azul pizarra profundo para navegación y estructura, marfil claro para el fondo, superficies blancas, dorado sobrio para acentos y estados semánticos contenidos para stock y movimientos. Se creó `theme.css` y se enlazó al final de los estilos internos de las seis pantallas para que sus reglas tengan prioridad sin modificar la lógica de Supabase.

La revisión local confirmó el dashboard con navegación azul, tarjetas claras con acento dorado, fondo marfil, tipografía oscura y gráficos que ahora usan azul pizarra, dorado, verde sobrio y rojo suave. Productos conserva la tabla y sus acciones, pero con el mismo contraste y jerarquía visual.


La revisión visual adicional confirmó que Movimientos conserva formularios, pestañas y botones legibles con navegación azul pizarra y acentos dorados. Proveedores mantiene la fila registrada, acciones visibles y footer en azul profundo, con el mismo tratamiento de contraste y estados.


La verificación de Reportes confirmó filtros y botones con buena jerarquía en azul pizarra, dorado y estados semánticos. Stock mostró correctamente el registro `sabritas` y el nivel crítico con un fondo rojo suave, manteniendo legibilidad sin volver al rojo dominante anterior.
