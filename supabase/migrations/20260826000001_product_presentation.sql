-- Presentación comercial de productos: pieza o caja.
-- Los productos existentes quedan como piezas para conservar su stock actual.

alter table public.productos
  add column if not exists tipo_presentacion text not null default 'pieza';

alter table public.productos
  add column if not exists piezas_por_caja integer not null default 1;

update public.productos
set tipo_presentacion = 'pieza'
where tipo_presentacion is null
   or tipo_presentacion not in ('pieza', 'caja');

update public.productos
set piezas_por_caja = 1
where piezas_por_caja is null
   or piezas_por_caja < 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_tipo_presentacion_check'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
      add constraint productos_tipo_presentacion_check
      check (tipo_presentacion in ('pieza', 'caja'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_piezas_por_caja_check'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
      add constraint productos_piezas_por_caja_check
      check (piezas_por_caja >= 1);
  end if;
end $$;

comment on column public.productos.tipo_presentacion is 'Unidad en la que se controla el stock: pieza o caja';
comment on column public.productos.piezas_por_caja is 'Cantidad de piezas contenidas en una caja; se mantiene en 1 para productos por pieza';
