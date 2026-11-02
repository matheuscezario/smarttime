-- Consulta somente o estado do próprio usuário autenticado.
-- SECURITY DEFINER evita recursão nas políticas de profiles.
create function public.smarttime_current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
  );
$function$;

revoke all
on function public.smarttime_current_user_is_active()
from public;

grant execute
on function public.smarttime_current_user_is_active()
to authenticated, service_role;

-- Estas políticas complementam as regras existentes.
-- Usuários ativos continuam sujeitos às permissões por empresa e setor.

create policy "SmartTime exige usuario ativo em perfis"
on public.profiles
as restrictive
for all
to authenticated
using (
  (select public.smarttime_current_user_is_active())
)
with check (
  (select public.smarttime_current_user_is_active())
);

create policy "SmartTime exige usuario ativo em batidas"
on public.time_entries
as restrictive
for all
to authenticated
using (
  (select public.smarttime_current_user_is_active())
)
with check (
  (select public.smarttime_current_user_is_active())
);

create policy "SmartTime exige usuario ativo em solicitacoes"
on public.adjustment_requests
as restrictive
for all
to authenticated
using (
  (select public.smarttime_current_user_is_active())
)
with check (
  (select public.smarttime_current_user_is_active())
);

create policy "SmartTime exige usuario ativo em modos de trabalho"
on public.work_mode_assignments
as restrictive
for all
to authenticated
using (
  (select public.smarttime_current_user_is_active())
)
with check (
  (select public.smarttime_current_user_is_active())
);