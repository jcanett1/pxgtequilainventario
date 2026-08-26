# Presentación de productos: pieza o caja

La aplicación ahora permite definir la unidad de control de cada producto:

| Presentación | Cantidad inicial y movimientos | Ejemplo |
|---|---|---|
| **Por pieza** | La cantidad representa piezas individuales. | `10 piezas` |
| **Por caja** | La cantidad representa cajas completas y `piezas_por_caja` indica el contenido de cada caja. | `5 cajas · 120 piezas` si cada caja contiene 24 piezas |

## Aplicar la migración

Ejecuta `supabase/migrations/20260826000001_product_presentation.sql` en el SQL Editor de Supabase o mediante el flujo de migraciones de tu proyecto.

La migración agrega las columnas `tipo_presentacion` y `piezas_por_caja`, establece los productos existentes como **por pieza** y agrega restricciones para aceptar únicamente `pieza` o `caja` y valores de piezas por caja mayores o iguales a uno.

## Uso en la aplicación

Al crear o editar un producto, selecciona **Por pieza** o **Por caja**. Cuando selecciones **Por caja**, captura cuántas piezas contiene cada caja; la cantidad inicial será el número de cajas.

En **Movimientos > Entradas**, selecciona el producto. El formulario indicará automáticamente si debes capturar piezas o cajas y mostrará la existencia actual. La entrada suma unidades de la presentación del producto y queda registrada en el historial. Las salidas y el ajuste manual de stock usan la misma unidad.

El precio se interpreta como precio de la presentación registrada: precio por pieza para productos por pieza y precio por caja para productos por caja.
