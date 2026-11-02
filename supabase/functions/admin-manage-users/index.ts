import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const fail = (error: string, status = 400) =>
      Response.json({ error }, { status });

    if (req.method !== "POST") {
      return fail("Método não permitido.", 405);
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await ctx.supabase.auth.getUser();

      if (userError || !user) {
        return fail("Sessão inválida. Entre novamente.", 401);
      }

      const { data: administrator, error: administratorError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id, company_id, role, active")
          .eq("id", user.id)
          .single();

      if (administratorError) {
        console.error("Erro ao consultar administrador:", administratorError);

        return fail(
          `Falha ao consultar perfil administrativo: ${administratorError.message}`,
          500,
        );
      }

      if (!administrator) {
        return fail("Perfil do usuário autenticado não encontrado.", 403);
      }

      if (!administrator.active) {
        return fail("O usuário autenticado está desativado.", 403);
      }

      if (administrator.role !== "ADMIN") {
        return fail("O usuário autenticado não possui a função ADMIN.", 403);
      }

      if (!administrator.company_id) {
        return fail("O administrador não está vinculado a uma empresa.", 403);
      }

      let body;

      try {
        body = await req.json();
      } catch {
        return fail("Os dados enviados são inválidos.");
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail("Os dados enviados são inválidos.");
      }

      // Lista funcionários e gerentes da empresa do administrador.
      if (body.action === "list") {
        const page = body.page === undefined ? 0 : body.page;

        if (
          !Number.isSafeInteger(page) ||
          page < 0 ||
          page > 10000
        ) {
          return fail("Página inválida.");
        }

        const pageSize = 50;
        const firstRow = page * pageSize;

        const { data: users, error: listError, count } =
          await ctx.supabaseAdmin
            .from("profiles")
            .select(
              "id, full_name, email, role, department, employee_code, work_schedule_id, allow_home_office, allow_external_work, active",
              { count: "exact" },
            )
            .eq("company_id", administrator.company_id)
            .in("role", ["EMPLOYEE", "MANAGER"])
            .order("full_name")
            .order("id")
            .range(firstRow, firstRow + pageSize - 1);

        if (listError) {
          console.error("Erro ao listar usuários:", listError);

          return fail(
            "Não foi possível carregar os usuários.",
            500,
          );
        }

        return Response.json({
          users: users || [],
          total: count || 0,
          page,
          page_size: pageSize,
          has_more:
            firstRow + (users?.length || 0) < (count || 0),
        });
      }

      // Edita somente funcionários ou gerentes da mesma empresa.
      if (body.action === "update") {
        const textValue = (value: unknown) =>
          typeof value === "string" ? value.trim() : "";

        const targetId = textValue(body.user_id);

        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)
        ) {
          return fail("Usuário inválido.");
        }

        if (targetId === user.id) {
          return fail("Não é permitido editar o próprio administrador.", 403);
        }

        const { data: target, error: targetError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .select(
              "id, role, allow_home_office, allow_external_work",
            )
            .eq("id", targetId)
            .eq("company_id", administrator.company_id)
            .in("role", ["EMPLOYEE", "MANAGER"])
            .maybeSingle();

        if (targetError) {
          console.error("Erro ao consultar usuário:", targetError);
          return fail("Não foi possível consultar o usuário.", 500);
        }

        if (!target) {
          return fail("Usuário não encontrado ou não autorizado.", 404);
        }

        const fullName = textValue(body.full_name);
        const department = textValue(body.department);
        const employeeCode = textValue(body.employee_code);
        const workScheduleId = textValue(body.work_schedule_id);
        const role = body.role;

        if (
          fullName.length < 3 ||
          fullName.length > 150 ||
          !department ||
          department.length > 100 ||
          !employeeCode ||
          employeeCode.length > 50 ||
          !workScheduleId
        ) {
          return fail("Preencha nome, setor, matrícula e jornada.");
        }

        if (role !== "EMPLOYEE" && role !== "MANAGER") {
          return fail("Selecione Funcionário ou Gerente.");
        }

        for (const field of ["allow_home_office", "allow_external_work"]) {
          if (body[field] !== undefined && typeof body[field] !== "boolean") {
            return fail("As permissões de trabalho são inválidas.");
          }
        }

        const { data: schedule, error: scheduleError } =
          await ctx.supabaseAdmin
            .from("work_schedules")
            .select("id")
            .eq("id", workScheduleId)
            .eq("company_id", administrator.company_id)
            .maybeSingle();

        if (scheduleError || !schedule) {
          return fail("Selecione uma jornada válida da sua empresa.");
        }

        const { data: duplicates, error: duplicateError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("company_id", administrator.company_id)
            .eq("employee_code", employeeCode)
            .neq("id", targetId)
            .limit(1);

        if (duplicateError) {
          console.error("Erro ao verificar matrícula:", duplicateError);
          return fail("Não foi possível verificar a matrícula.", 500);
        }

        if (duplicates?.length) {
          return fail("Esta matrícula já pertence a outro usuário.", 409);
        }

        const { data: updatedProfile, error: updateError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .update({
              full_name: fullName,
              department,
              employee_code: employeeCode,
              work_schedule_id: schedule.id,
              role,
              allow_home_office:
                body.allow_home_office ?? target.allow_home_office,
              allow_external_work:
                body.allow_external_work ?? target.allow_external_work,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetId)
            .eq("company_id", administrator.company_id)
            .in("role", ["EMPLOYEE", "MANAGER"])
            .select(
              "id, full_name, email, role, department, employee_code, work_schedule_id, allow_home_office, allow_external_work, active",
            )
            .maybeSingle();

        if (updateError) {
          console.error("Erro ao editar usuário:", updateError);
          return fail("Não foi possível salvar as alterações.", 500);
        }

        if (!updatedProfile) {
          return fail("O usuário não está mais disponível para edição.", 409);
        }

        return Response.json({
          message: "Usuário atualizado com sucesso.",
          user: updatedProfile,
        });
      }

      // Altera o acesso sem apagar a conta nem os registros.
      if (body.action === "set_active") {
        const targetId =
          typeof body.user_id === "string"
            ? body.user_id.trim()
            : "";

        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)
        ) {
          return fail("Usuário inválido.");
        }

        if (typeof body.active !== "boolean") {
          return fail("Informe se o usuário deve ficar ativo ou desativado.");
        }

        if (targetId === user.id) {
          return fail("Não é permitido desativar o próprio administrador.", 403);
        }

        const { data: updatedUser, error: statusError } =
          await ctx.supabaseAdmin
            .from("profiles")
            .update({
              active: body.active,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetId)
            .eq("company_id", administrator.company_id)
            .in("role", ["EMPLOYEE", "MANAGER"])
            .select(
              "id, full_name, email, role, department, employee_code, work_schedule_id, allow_home_office, allow_external_work, active",
            )
            .maybeSingle();

        if (statusError) {
          console.error("Erro ao alterar acesso do usuário:", statusError);
          return fail("Não foi possível alterar o acesso do usuário.", 500);
        }

        if (!updatedUser) {
          return fail("Usuário não encontrado ou não autorizado.", 404);
        }

        return Response.json({
          message: body.active
            ? "Usuário reativado com sucesso."
            : "Usuário desativado com sucesso.",
          user: updatedUser,
        });
      }

      if (body.action !== "create") {
        return fail("Ação não disponível.");
      }

      const text = (value: unknown) =>
        typeof value === "string" ? value.trim() : "";

      const fullName = text(body.full_name);
      const email = text(body.email).toLowerCase();
      const password =
        typeof body.password === "string" ? body.password : "";
      const department = text(body.department);
      const employeeCode = text(body.employee_code);
      const workScheduleId = text(body.work_schedule_id);
      const role = body.role;

      if (
        fullName.length < 3 ||
        fullName.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        password.length < 8 ||
        password.length > 128 ||
        !department ||
        department.length > 100 ||
        !employeeCode ||
        employeeCode.length > 50 ||
        !workScheduleId
      ) {
        return fail(
          "Preencha nome, e-mail válido, senha de 8 a 128 caracteres, setor, matrícula e jornada.",
        );
      }

      if (role !== "EMPLOYEE" && role !== "MANAGER") {
        return fail("Selecione Funcionário ou Gerente.");
      }

      for (const field of ["allow_home_office", "allow_external_work"]) {
        if (body[field] !== undefined && typeof body[field] !== "boolean") {
          return fail("As permissões de trabalho são inválidas.");
        }
      }

      const { data: schedule, error: scheduleError } =
        await ctx.supabaseAdmin
          .from("work_schedules")
          .select("id")
          .eq("id", workScheduleId)
          .eq("company_id", administrator.company_id)
          .maybeSingle();

      if (scheduleError || !schedule) {
        return fail("Selecione uma jornada válida da sua empresa.");
      }

      const { data: existingEmployee, error: employeeError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("company_id", administrator.company_id)
          .eq("employee_code", employeeCode)
          .limit(1);

      if (employeeError) {
        throw employeeError;
      }

      if (existingEmployee?.length) {
        return fail("Esta matrícula já está cadastrada na empresa.", 409);
      }

      const { data: createdAccount, error: accountError } =
        await ctx.supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

      if (accountError || !createdAccount.user) {
        return fail(
          accountError?.message || "Não foi possível criar a conta.",
        );
      }

      const accountId = createdAccount.user.id;

      const { data: createdProfile, error: profileError } =
        await ctx.supabaseAdmin
          .from("profiles")
          .insert({
            id: accountId,
            company_id: administrator.company_id,
            manager_id: null,
            work_schedule_id: schedule.id,
            full_name: fullName,
            email,
            role,
            department,
            employee_code: employeeCode,
            allow_home_office: body.allow_home_office === true,
            allow_external_work: body.allow_external_work === true,
            active: true,
          })
          .select(
            "id, full_name, email, role, department, employee_code, active",
          )
          .single();

      if (profileError) {
        const { error: rollbackError } =
          await ctx.supabaseAdmin.auth.admin.deleteUser(accountId);

        if (rollbackError) {
          console.error("Falha ao desfazer cadastro:", {
            accountId,
            profileError,
            rollbackError,
          });

          return fail(
            "O perfil não foi salvo e a conta não pôde ser desfeita. Confira os logs antes de tentar novamente.",
            500,
          );
        }

        console.error("Erro ao criar perfil:", profileError);

        return fail(
          "Não foi possível salvar o perfil. O cadastro foi desfeito.",
          500,
        );
      }

      return Response.json(
        {
          message: "Usuário cadastrado com sucesso.",
          user: createdProfile,
        },
        { status: 201 },
      );
    } catch (error) {
      console.error("Erro na gestão de usuários:", error);
      return fail("Não foi possível concluir a operação.", 500);
    }
  }),
};