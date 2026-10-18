create function public.configure_parking_lot(
  parking_lot_name text,
  parking_lot_address text,
  grid_rows integer,
  grid_columns integer
)
returns setof public.parking_lots
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  configured_lot public.parking_lots%rowtype;
  existing_lot public.parking_lots%rowtype;
begin
  if not private.is_admin() then
    raise exception 'PARKING_LOT_ADMIN_REQUIRED';
  end if;

  if grid_rows < 1 or grid_rows > 26 or grid_columns < 1 or grid_columns > 100 then
    raise exception 'PARKING_LOT_GRID_DIMENSIONS_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtext('parking_lot_configuration'));

  select *
  into existing_lot
  from public.parking_lots
  limit 1
  for update;

  if found then
    if existing_lot.rows <> grid_rows or existing_lot.columns <> grid_columns then
      raise exception 'PARKING_LOT_GRID_DIMENSIONS_IMMUTABLE';
    end if;

    update public.parking_lots
    set
      name = parking_lot_name,
      address = parking_lot_address
    where id = existing_lot.id
    returning * into configured_lot;

    insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'parking_lot.configure',
      'parking_lot',
      configured_lot.id,
      jsonb_build_object('mode', 'update')
    );

    return next configured_lot;
    return;
  end if;

  insert into public.parking_lots (name, address, rows, columns)
  values (parking_lot_name, parking_lot_address, grid_rows, grid_columns)
  returning * into configured_lot;

  insert into public.parking_spots (parking_lot_id, spot_number)
  select
    configured_lot.id,
    chr(64 + row_number) || column_number::text
  from generate_series(1, grid_rows) as row_number
  cross join generate_series(1, grid_columns) as column_number;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'parking_lot.configure',
    'parking_lot',
    configured_lot.id,
    jsonb_build_object(
      'mode', 'create',
      'rows', grid_rows,
      'columns', grid_columns
    )
  );

  return next configured_lot;
end;
$$;

revoke execute on function public.configure_parking_lot(text, text, integer, integer) from public;
grant execute on function public.configure_parking_lot(text, text, integer, integer) to authenticated;
