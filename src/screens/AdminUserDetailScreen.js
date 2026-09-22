import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';

export default function AdminUserDetailScreen({ navigation, route }) {
  // Recebe o colaborador clicado (ou usa um fallback padrão)
  const user = route.params?.user || {
  name: 'João Silva',
  role: 'Analista Comercial',
  matricula: '10452',
  sector: 'Comercial',
  online: true,
  time: '08:02',
};

const [workMode, setWorkMode] = useState('BASE');
const [isSavingMode, setIsSavingMode] = useState(false);
const [userEntries, setUserEntries] = useState([]);
const [isLoadingEntries, setIsLoadingEntries] = useState(true);
const [pendingAdjustments, setPendingAdjustments] = useState(0);
const [workSchedule, setWorkSchedule] = useState(null);

useEffect(() => {
  const carregarModoTrabalho = async () => {
    if (!user?.id) {
      return;
    }

    const dataHoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());

    const { data, error } = await supabase
      .from('work_mode_assignments')
      .select('work_mode')
      .eq('user_id', user.id)
      .eq('work_date', dataHoje)
      .maybeSingle();

    if (error) {
      console.error(
        'Erro ao carregar modo de trabalho:',
        error
      );
      return;
    }

    setWorkMode(data?.work_mode || 'BASE');
  };

  carregarModoTrabalho();
}, [user?.id]);

useEffect(() => {
  const carregarBatidas = async () => {
    if (!user?.id) {
      setIsLoadingEntries(false);
      return;
    }

    try {
      setIsLoadingEntries(true);

      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          id,
          entry_type,
          recorded_at,
          location_type,
          within_geofence
        `)
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      setUserEntries(data || []);
    } catch (error) {
      console.error(
        'Erro ao carregar batidas do funcionário:',
        error
      );

      setUserEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  };

  carregarBatidas();
}, [user?.id]);

useEffect(() => {
  const carregarPendencias = async () => {
    if (!user?.id) {
      return;
    }

    const { count, error } = await supabase
      .from('adjustment_requests')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', user.id)
      .eq('status', 'PENDING');

    if (error) {
      console.error(
        'Erro ao carregar pendências:',
        error
      );
      return;
    }

    setPendingAdjustments(count || 0);
  };

  carregarPendencias();
}, [user?.id]);

useEffect(() => {
  const carregarJornada = async () => {
    if (!user?.workScheduleId) {
      setWorkSchedule(null);
      return;
    }

    const { data, error } = await supabase
      .from('work_schedules')
      .select(`
        id,
        name,
        start_time,
        lunch_start_time,
        lunch_end_time,
        end_time,
        tolerance_minutes
      `)
      .eq('id', user.workScheduleId)
      .maybeSingle();

    if (error) {
      console.error(
        'Erro ao carregar jornada:',
        error
      );
      setWorkSchedule(null);
      return;
    }

    setWorkSchedule(data);
  };

  carregarJornada();
}, [user?.workScheduleId]);

const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

    const entryPosition = {
  CLOCK_IN: 0,
  LUNCH_OUT: 1,
  LUNCH_IN: 2,
  CLOCK_OUT: 3,
};

const realUserHistory = Object.values(
  userEntries.reduce((days, entry) => {
    const recordedDate = new Date(entry.recorded_at);

    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(recordedDate);

    const dateLabel = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(recordedDate);

    if (!days[dateKey]) {
      days[dateKey] = {
        id: dateKey,
        date: dateLabel,
        entries: ['--:--', '--:--', '--:--', '--:--'],
        total: '--',
        ok: false,
      };
    }

    const position = entryPosition[entry.entry_type];

    if (position !== undefined) {
      days[dateKey].entries[position] =
        new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        }).format(recordedDate);
    }

    days[dateKey].ok =
      days[dateKey].entries.every(
        (time) => time !== '--:--'
      );

    return days;
  }, {})
);

realUserHistory.forEach((day) => {
  if (!day.ok) {
  day.total = 'Pendente';
  day.totalMinutes = 0;
  return;
}

  const toMinutes = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const entrada = toMinutes(day.entries[0]);
  const saidaAlmoco = toMinutes(day.entries[1]);
  const voltaAlmoco = toMinutes(day.entries[2]);
  const saida = toMinutes(day.entries[3]);

  const totalMinutes =
    (saidaAlmoco - entrada) +
    (saida - voltaAlmoco);
    day.totalMinutes = totalMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  day.total =
    `${String(hours).padStart(2, '0')}h ` +
    `${String(minutes).padStart(2, '0')}m`;
});

const currentMonthKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
})
  .format(new Date())
  .slice(0, 7);

const monthlyTotalMinutes = realUserHistory
  .filter((day) => day.id.startsWith(currentMonthKey))
  .reduce(
    (total, day) => total + (day.totalMinutes || 0),
    0
  );

const monthlyTotalText =
  `${Math.floor(monthlyTotalMinutes / 60)}h ` +
  `${String(monthlyTotalMinutes % 60).padStart(2, '0')}m`;

  const scheduleTimeToMinutes = (time) => {
  if (!time) {
    return 0;
  }

  const [hours, minutes] = time
    .slice(0, 5)
    .split(':')
    .map(Number);

  return hours * 60 + minutes;
};

const expectedDailyMinutes = workSchedule
  ? (
      scheduleTimeToMinutes(workSchedule.end_time) -
      scheduleTimeToMinutes(workSchedule.start_time)
    ) -
    (
      scheduleTimeToMinutes(workSchedule.lunch_end_time) -
      scheduleTimeToMinutes(workSchedule.lunch_start_time)
    )
  : 0;

  const expectedDailyText = workSchedule
  ? `${Math.floor(expectedDailyMinutes / 60)}h ` +
    `${String(expectedDailyMinutes % 60).padStart(2, '0')}m por dia`
  : 'Jornada não definida';

const bankMinutes = workSchedule
  ? realUserHistory
      .filter(
        (day) =>
          day.id.startsWith(currentMonthKey) &&
          day.ok
      )
      .reduce((balance, day) => {
        const difference =
          day.totalMinutes - expectedDailyMinutes;

        const adjustedDifference =
          Math.abs(difference) <=
          workSchedule.tolerance_minutes
            ? 0
            : difference;

        return balance + adjustedDifference;
      }, 0)
  : 0;

const bankSign = bankMinutes > 0 ? '+' : bankMinutes < 0 ? '-' : '';

const absoluteBankMinutes = Math.abs(bankMinutes);

const bankHoursText = workSchedule
  ? `${bankSign}${Math.floor(absoluteBankMinutes / 60)}h ` +
    `${String(absoluteBankMinutes % 60).padStart(2, '0')}m`
  : '--';

  const todayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
}).format(new Date());

const todayEntries = userEntries.filter((entry) => {
  const entryDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(entry.recorded_at));

  return entryDate === todayKey;
});

const latestTodayEntry = todayEntries[0];

const isUserOnline =
  Boolean(latestTodayEntry) &&
  latestTodayEntry.entry_type !== 'CLOCK_OUT';

const latestEntryTime = latestTodayEntry
  ? new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(latestTodayEntry.recorded_at))
  : null;

const userStatusText = !latestTodayEntry
  ? 'Offline • Sem registro'
  : isUserOnline
  ? `Online • Última marcação às ${latestEntryTime}`
  : `Offline • Saída às ${latestEntryTime}`;

    const handleSaveWorkMode = async (newMode) => {
  if (
    newMode === 'HOME_OFFICE' &&
    !user.allowHomeOffice
  ) {
    const mensagem =
      'Este funcionário não está autorizado para Home Office.';

    if (Platform.OS === 'web') {
      window.alert(mensagem);
    } else {
      Alert.alert('Não autorizado', mensagem);
    }

    return;
  }

  if (
    newMode === 'EXTERNAL' &&
    !user.allowExternalWork
  ) {
    const mensagem =
      'Este funcionário não está autorizado para Trabalho Externo.';

    if (Platform.OS === 'web') {
      window.alert(mensagem);
    } else {
      Alert.alert('Não autorizado', mensagem);
    }

    return;
  }

  try {
    setIsSavingMode(true);

    const {
  data: { session },
  error: authError,
} = await supabase.auth.getSession();

const manager = session?.user;

if (authError || !manager) {
  throw new Error('Gestor não autenticado.');
}

    const dataHoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());

    const { error } = await supabase
      .from('work_mode_assignments')
      .upsert(
        {
          company_id: user.companyId,
          user_id: user.id,
          work_date: dataHoje,
          work_mode: newMode,
          assigned_by: manager.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,work_date',
        }
      );

    if (error) {
      throw error;
    }

    setWorkMode(newMode);

    const mensagem = 'Modo de trabalho atualizado.';

    if (Platform.OS === 'web') {
      window.alert(mensagem);
    } else {
      Alert.alert('Sucesso', mensagem);
    }
  } catch (error) {
    console.error(
      'Erro ao salvar modo de trabalho:',
      error
    );

    const mensagem =
  'Não foi possível atualizar o modo de trabalho.';

    if (Platform.OS === 'web') {
      window.alert(mensagem);
    } else {
      Alert.alert('Erro', mensagem);
    }
  } finally {
    setIsSavingMode(false);
  }
};

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Usuário</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Card de Identificação com Dados Dinâmicos */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>
            {user.role} • Matrícula: {user.matricula}
          </Text>

          <View
  style={[
    styles.statusBadge,
    !isUserOnline && styles.statusBadgeOffline,
  ]}
>
  <View
    style={[
      styles.statusDot,
      !isUserOnline && styles.statusDotOffline,
    ]}
  />

  <Text
    style={[
      styles.statusBadgeText,
      !isUserOnline && styles.statusBadgeTextOffline,
    ]}
  >
    {userStatusText}
  </Text>
</View>
</View>

        {/* Modo de trabalho de hoje */}
<View style={styles.workModeCard}>
  <Text style={styles.workModeTitle}>
    Modo de trabalho de hoje
  </Text>

  <Text style={styles.workModeSubtitle}>
    Defina onde o colaborador trabalhará hoje.
  </Text>

  <View style={styles.workModeOptions}>
    <TouchableOpacity
      style={[
        styles.workModeButton,
        workMode === 'BASE' && styles.workModeButtonActive,
      ]}
      onPress={() => handleSaveWorkMode('BASE')}
      disabled={isSavingMode}
    >
      <Text
        style={[
          styles.workModeButtonText,
          workMode === 'BASE' && styles.workModeButtonTextActive,
        ]}
      >
        🏢 Base
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
  style={[
    styles.workModeButton,
    workMode === 'HOME_OFFICE' &&
      styles.workModeButtonActive,
    !user.allowHomeOffice &&
      styles.workModeButtonDisabled,
  ]}
  onPress={() => handleSaveWorkMode('HOME_OFFICE')}
  disabled={isSavingMode || !user.allowHomeOffice}
>
  <Text
    style={[
      styles.workModeButtonText,
      workMode === 'HOME_OFFICE' &&
        styles.workModeButtonTextActive,
      !user.allowHomeOffice &&
        styles.workModeButtonTextDisabled,
    ]}
  >
    🏠 Home Office
  </Text>
</TouchableOpacity>

    <TouchableOpacity
  style={[
    styles.workModeButton,
    workMode === 'EXTERNAL' &&
      styles.workModeButtonActive,
    !user.allowExternalWork &&
      styles.workModeButtonDisabled,
  ]}
  onPress={() => handleSaveWorkMode('EXTERNAL')}
  disabled={isSavingMode || !user.allowExternalWork}
>
  <Text
    style={[
      styles.workModeButtonText,
      workMode === 'EXTERNAL' &&
        styles.workModeButtonTextActive,
      !user.allowExternalWork &&
        styles.workModeButtonTextDisabled,
    ]}
  >
    🚗 Externo
  </Text>
</TouchableOpacity>
  </View>
</View>

        {/* Indicadores Rápidos */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Horas (Mês)</Text>
            <Text style={styles.kpiValue}>
  {isLoadingEntries ? '--' : monthlyTotalText}
</Text>
            <Text style={styles.kpiSub}>
  {expectedDailyText}
</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Banco de Horas</Text>
            <Text
  style={[
    styles.kpiValue,
    bankMinutes > 0 && styles.textGreen,
    bankMinutes < 0 && styles.textRed,
  ]}
>
  {bankHoursText}
</Text>

<Text style={styles.kpiSub}>
  {bankMinutes > 0
    ? 'Positivo'
    : bankMinutes < 0
    ? 'Negativo'
    : 'Sem saldo'}
</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pendências</Text>
            <Text
  style={[
    styles.kpiValue,
    pendingAdjustments > 0 && styles.textRed,
  ]}
>
  {pendingAdjustments}
</Text>

<Text style={styles.kpiSub}>
  {pendingAdjustments === 1
    ? 'Ajuste pendente'
    : 'Ajustes pendentes'}
</Text>
          </View>
        </View>

        {/* Ações Rápidas do Gestor */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
  style={[
    styles.actionBtnPrimary,
    pendingAdjustments === 0 &&
      styles.actionBtnDisabled,
  ]}
  onPress={() => navigation.navigate('Adjustment')}
  disabled={pendingAdjustments === 0}
>
  <Text style={styles.actionBtnPrimaryText}>
    {pendingAdjustments === 0
      ? 'Nenhuma solicitação pendente'
      : 'Ver Solicitação de Ajuste'}
  </Text>
</TouchableOpacity>
        </View>

        {/* Últimas Marcações */}
        <Text style={styles.sectionTitle}>Últimas marcações registradas</Text>
        {isLoadingEntries && (
  <Text
    style={{
      color: '#64748B',
      marginBottom: 10,
    }}
  >
    Carregando marcações...
  </Text>
)}

{!isLoadingEntries && realUserHistory.length === 0 && (
  <Text
    style={{
      color: '#64748B',
      marginBottom: 10,
    }}
  >
    Nenhuma marcação encontrada.
  </Text>
)}
        <View style={styles.historyList}>
          {!isLoadingEntries &&
  realUserHistory.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>{item.date}</Text>
                <Text style={[styles.historyTotal, !item.ok && styles.textRed]}>
                  {item.total} {item.ok ? '✓' : '⚠️'}
                </Text>
              </View>

              <View style={styles.punchesPillRow}>
                {item.entries.map((punch, idx) => (
                  <View key={idx} style={styles.punchPill}>
                    <Text style={[styles.punchPillText, punch === '--:--' && styles.textRed]}>
                      {punch}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#1E293B',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  userRole: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeOffline: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  statusDotOffline: {
    backgroundColor: '#DC2626',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  statusBadgeTextOffline: {
    color: '#991B1B',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  textGreen: {
    color: '#16A34A',
  },
  textRed: {
    color: '#DC2626',
  },
  quickActionsContainer: {
    marginBottom: 20,
  },
  actionBtnPrimary: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },

  actionBtnDisabled: {
  backgroundColor: '#CBD5E1',
  opacity: 0.7,
},
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  historyTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  punchesPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  punchPill: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  punchPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },

  workModeCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  padding: 16,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  marginBottom: 16,
},

workModeTitle: {
  fontSize: 15,
  fontWeight: '700',
  color: '#0F172A',
  marginBottom: 4,
},

workModeSubtitle: {
  fontSize: 12,
  color: '#64748B',
  marginBottom: 12,
},

workModeOptions: {
  flexDirection: 'row',
  gap: 8,
},

workModeButton: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 8,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#CBD5E1',
  backgroundColor: '#F8FAFC',
  alignItems: 'center',
},

workModeButtonActive: {
  backgroundColor: '#1D4ED8',
  borderColor: '#1D4ED8',
},

workModeButtonDisabled: {
  backgroundColor: '#F1F5F9',
  borderColor: '#E2E8F0',
  opacity: 0.45,
},

workModeButtonText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#64748B',
},

workModeButtonTextActive: {
  color: '#FFFFFF',
},

workModeButtonTextDisabled: {
  color: '#94A3B8',
},
});