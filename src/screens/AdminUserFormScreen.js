import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

const notify = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function AdminUserFormScreen({ navigation, route }) {
  const editingUser = route.params?.user;
  const isEditing = Boolean(editingUser?.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [sectors, setSectors] = useState([]);
  const submitting = useRef(false);

  const [form, setForm] = useState({
    full_name: editingUser?.full_name || '',
    email: editingUser?.email || '',
    password: '',
    role: editingUser?.role || 'EMPLOYEE',
    department: editingUser?.department || '',
    employee_code: editingUser?.employee_code || '',
    work_schedule_id: editingUser?.work_schedule_id || '',
    allow_home_office: editingUser?.allow_home_office === true,
    allow_external_work: editingUser?.allow_external_work === true,
  });

  const change = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    let mounted = true;

    const loadOptions = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error('Entre novamente para continuar.');
        }

        const { data: administrator, error: profileError } = await supabase
          .from('profiles')
          .select('role, active, company_id')
          .eq('id', user.id)
          .single();

        if (
          profileError ||
          administrator?.role !== 'ADMIN' ||
          !administrator?.active ||
          !administrator?.company_id
        ) {
          throw new Error('Esta área é exclusiva do administrador ativo.');
        }

        const [scheduleResult, sectorResult] = await Promise.all([
          supabase
            .from('work_schedules')
            .select('id, name, start_time, end_time')
            .eq('company_id', administrator.company_id)
            .order('name'),
          supabase
            .from('profiles')
            .select('department')
            .eq('company_id', administrator.company_id)
            .eq('active', true)
            .in('role', ['EMPLOYEE', 'MANAGER']),
        ]);

        if (scheduleResult.error) throw scheduleResult.error;
        if (sectorResult.error) throw sectorResult.error;
        if (!mounted) return;

        setSchedules(scheduleResult.data || []);
        setSectors(
          [...new Set(
            (sectorResult.data || [])
              .map((item) => item.department?.trim())
              .filter(Boolean)
          )].sort()
        );
        setAuthorized(true);
      } catch (error) {
        if (mounted) {
          setLoadError(error.message || 'Não foi possível carregar o cadastro.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadOptions();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    if (submitting.current || !authorized) return;

    const invalidProfessionalData =
      form.full_name.trim().length < 3 ||
      !form.department.trim() ||
      !form.employee_code.trim() ||
      !form.work_schedule_id;

    const invalidAccessData =
      !isEditing && (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ||
        form.password.length < 8 ||
        form.password.length > 128
      );

    if (invalidProfessionalData || invalidAccessData) {
      notify(
        'Confira os campos',
        isEditing
          ? 'Informe nome, setor, matrícula e jornada.'
          : 'Informe nome, e-mail válido, senha de 8 a 128 caracteres, setor, matrícula e jornada.'
      );
      return;
    }

    submitting.current = true;
    setSaving(true);

    try {
      const professionalData = {
        full_name: form.full_name.trim(),
        role: form.role,
        department: form.department.trim(),
        employee_code: form.employee_code.trim(),
        work_schedule_id: form.work_schedule_id,
        allow_home_office: form.allow_home_office,
        allow_external_work: form.allow_external_work,
      };

      const requestBody = isEditing
        ? {
            action: 'update',
            user_id: editingUser.id,
            ...professionalData,
          }
        : {
            action: 'create',
            ...professionalData,
            email: form.email.trim().toLowerCase(),
            password: form.password,
          };

      const { data, error } = await supabase.functions.invoke(
        'admin-manage-users',
        { body: requestBody }
      );

      if (error) {
        let message = 'Não foi possível salvar o usuário. Tente novamente.';

        if (error.context && typeof error.context.json === 'function') {
          try {
            const details = await error.context.json();
            message = details.error || details.message || message;
          } catch {
            // Mantém a mensagem se a resposta não contiver JSON.
          }
        }

        throw new Error(message);
      }

      if (data?.error) throw new Error(data.error);
      if (!data?.user?.id) {
        throw new Error('O servidor não confirmou a operação.');
      }

      change('password', '');

      notify(
        isEditing ? 'Alterações salvas' : 'Cadastro concluído',
        isEditing
          ? 'Os dados profissionais foram atualizados.'
          : 'A conta e o perfil foram criados com sucesso.'
      );

      navigation.goBack();
    } catch (error) {
      notify('Não foi possível salvar', error.message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const input = (label, field, options = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={form[field]}
        onChangeText={(value) => change(field, value)}
        editable={!saving}
        placeholderTextColor="#94A3B8"
        {...options}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          disabled={saving}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Voltar"
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? "Editar usuário" : "Cadastrar usuário"}</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1D4ED8" />
      ) : !authorized ? (
        <Text style={styles.error}>{loadError}</Text>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <Text style={styles.section}>Dados de acesso</Text>

              {input('Nome completo', 'full_name', {
                maxLength: 150,
                autoCapitalize: 'words',
              })}
              {input('E-mail', 'email', {
                keyboardType: 'email-address',
                autoCapitalize: 'none',
                autoCorrect: false,
                maxLength: 254,
                editable: !saving && !isEditing,
              })}
              {isEditing && (
                <Text style={styles.hint}>
                  O e-mail de acesso permanece inalterado.
                </Text>
              )}
              {!isEditing && input('Senha inicial', 'password', {
                secureTextEntry: true,
                autoCapitalize: 'none',
                autoCorrect: false,
                maxLength: 128,
              })}

              <Text style={styles.label}>Função</Text>
              <View style={styles.options}>
                {[
                  ['EMPLOYEE', 'Funcionário'],
                  ['MANAGER', 'Gerente'],
                ].map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    disabled={saving}
                    style={[
                      styles.option,
                      form.role === value && styles.selected,
                    ]}
                    onPress={() => change('role', value)}
                  >
                    <Text style={styles.optionText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.section}>Dados profissionais</Text>
              {input('Matrícula', 'employee_code', {
                maxLength: 50,
                autoCapitalize: 'none',
              })}
              {input('Setor', 'department', { maxLength: 100 })}

              <View style={styles.options}>
                {sectors.map((sector) => (
                  <TouchableOpacity
                    key={sector}
                    disabled={saving}
                    style={[
                      styles.option,
                      form.department === sector && styles.selected,
                    ]}
                    onPress={() => change('department', sector)}
                  >
                    <Text style={styles.optionText}>{sector}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Jornada de trabalho</Text>
              {schedules.length === 0 && (
                <Text style={styles.error}>
                  Nenhuma jornada disponível para esta empresa.
                </Text>
              )}

              {schedules.map((schedule) => (
                <TouchableOpacity
                  key={schedule.id}
                  disabled={saving}
                  style={[
                    styles.schedule,
                    form.work_schedule_id === schedule.id && styles.selected,
                  ]}
                  onPress={() => change('work_schedule_id', schedule.id)}
                >
                  <Text style={styles.optionText}>{schedule.name}</Text>
                  <Text style={styles.hint}>
                    {schedule.start_time.slice(0, 5)}
                    {' até '}
                    {schedule.end_time.slice(0, 5)}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.section}>Permissões de trabalho</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Permitir Home Office</Text>
                <Switch
                  value={form.allow_home_office}
                  disabled={saving}
                  onValueChange={(value) => change('allow_home_office', value)}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Permitir trabalho externo</Text>
                <Switch
                  value={form.allow_external_work}
                  disabled={saving}
                  onValueChange={(value) => change('allow_external_work', value)}
                />
              </View>

              <TouchableOpacity
                style={[styles.save, saving && { opacity: 0.6 }]}
                disabled={saving || schedules.length === 0}
                onPress={handleSave}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>{isEditing ? "Salvar alterações" : "Cadastrar usuário"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  back: { width: 40, alignItems: 'center' },
  backText: { fontSize: 30, color: '#0F172A' },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  content: {
    width: '100%', maxWidth: 680, alignSelf: 'center',
    padding: 16, paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: '#E2E8F0',
  },
  section: {
    fontSize: 16, fontWeight: '700', color: '#0F172A',
    marginTop: 12, marginBottom: 16,
  },
  field: { marginBottom: 14 },
  label: {
    fontSize: 13, fontWeight: '600',
    color: '#475569', marginBottom: 7,
  },
  input: {
    minHeight: 46, borderWidth: 1, borderColor: '#CBD5E1',
    borderRadius: 9, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: '#0F172A',
  },
  options: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, marginBottom: 16,
  },
  option: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
  },
  selected: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  optionText: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  schedule: {
    padding: 12, borderWidth: 1, borderColor: '#CBD5E1',
    borderRadius: 9, marginBottom: 8,
  },
  hint: { fontSize: 12, color: '#64748B', marginTop: 4 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14, gap: 10,
  },
  switchLabel: { flex: 1, color: '#334155', fontSize: 14 },
  save: {
    backgroundColor: '#1D4ED8', padding: 15,
    borderRadius: 10, alignItems: 'center', marginTop: 16,
  },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  error: { color: '#B91C1C', margin: 16, lineHeight: 22 },
});