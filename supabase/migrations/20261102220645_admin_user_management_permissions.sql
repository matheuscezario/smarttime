-- Permissões utilizadas pela Edge Function de gestão de usuários.
grant usage on schema public to service_role;

grant select, insert
on table public.profiles
to service_role;

grant update (
  full_name,
  role,
  department,
  employee_code,
  work_schedule_id,
  allow_home_office,
  allow_external_work,
  active,
  updated_at
)
on table public.profiles
to service_role;

grant select
on table public.work_schedules
to service_role;