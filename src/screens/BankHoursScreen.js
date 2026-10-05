import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';

const timeToMinutes = (time) => {
  if (!time) {
    return 0;
  }

  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatMinutesToBank = (minutes) => {
  const isNegative = minutes < 0;
  const absoluteMinutes = Math.abs(Math.round(minutes));
  const hours = Math.floor(absoluteMinutes / 60);
  const remainingMinutes = absoluteMinutes % 60;

  return (
    `${isNegative ? '-' : '+'}` +
    `${String(hours).padStart(2, '0')}:` +
    `${String(remainingMinutes).padStart(2, '0')}`
  );
};

const getSaoPauloDateKey = (dateValue) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateValue));
};

export default function BankHoursScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'credito' | 'debito'
  const [databaseEntries, setDatabaseEntries] = useState([]);
const [workSchedule, setWorkSchedule] = useState(null);
const [isLoadingBank, setIsLoadingBank] = useState(true);
const [approvedAdjustments, setApprovedAdjustments] = useState([]);

useEffect(() => {
  const loadBankData = async () => {
    try {
      setIsLoadingBank(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error('Usuário não encontrado.');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('work_schedule_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const { data: schedule, error: scheduleError } = await supabase
        .from('work_schedules')
        .select(
          'id, start_time, lunch_start_time, lunch_end_time, end_time, tolerance_minutes'
        )
        .eq('id', profile.work_schedule_id)
        .single();

      if (scheduleError) {
        throw scheduleError;
      }

      const { data: entries, error: entriesError } = await supabase
        .from('time_entries')
        .select('id, entry_type, recorded_at')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: true });

      if (entriesError) {
        throw entriesError;
      }

      const { data: adjustments, error: adjustmentsError } =
  await supabase
    .from('adjustment_requests')
    .select(
      'id, requested_date, request_type, requested_punches, status'
    )
    .eq('user_id', user.id)
    .eq('status', 'APPROVED')
    .order('requested_date', { ascending: true });

if (adjustmentsError) {
  throw adjustmentsError;
}

      setWorkSchedule(schedule);
      setDatabaseEntries(entries || []);
      setApprovedAdjustments(adjustments || []);
    } catch (error) {
      console.error('Erro ao carregar banco de horas:', error);
    } finally {
      setIsLoadingBank(false);
    }
  };

  loadBankData();
}, []);

  const expectedDailyMinutes = workSchedule
  ? timeToMinutes(workSchedule.end_time) -
    timeToMinutes(workSchedule.start_time) -
    (timeToMinutes(workSchedule.lunch_end_time) -
      timeToMinutes(workSchedule.lunch_start_time))
  : 0;

  const effectiveEntries = [...databaseEntries];

approvedAdjustments
  .filter(
    (adjustment) =>
      adjustment.request_type === 'TIME_CORRECTION' &&
      Array.isArray(adjustment.requested_punches)
  )
  .forEach((adjustment) => {
    adjustment.requested_punches.forEach((punch) => {
      if (!punch.entry_type || !punch.requested_time) {
        return;
      }

      const correctedEntry = {
        id: `adjustment-${adjustment.id}-${punch.entry_type}`,
        entry_type: punch.entry_type,
        recorded_at:
          `${adjustment.requested_date}T` +
          `${punch.requested_time}:00-03:00`,
      };

      const existingIndex = effectiveEntries.findIndex(
        (entry) =>
          getSaoPauloDateKey(entry.recorded_at) ===
            adjustment.requested_date &&
          entry.entry_type === punch.entry_type
      );

      if (existingIndex >= 0) {
        effectiveEntries[existingIndex] = correctedEntry;
      } else {
        effectiveEntries.push(correctedEntry);
      }
    });
  });

const entriesGroupedByDate = effectiveEntries.reduce((groups, entry) => {
  const dateKey = getSaoPauloDateKey(entry.recorded_at);

  if (!groups[dateKey]) {
    groups[dateKey] = [];
  }

  groups[dateKey].push(entry);
  return groups;
}, {});

approvedAdjustments
  .filter(
    (adjustment) =>
      adjustment.request_type === 'ABSENCE_EXCUSE'
  )
  .forEach((adjustment) => {
    if (!entriesGroupedByDate[adjustment.requested_date]) {
      entriesGroupedByDate[adjustment.requested_date] = [];
    }
  });

const todayKey = getSaoPauloDateKey(new Date());

const transactions = Object.entries(entriesGroupedByDate)
  .map(([dateKey, entries]) => {
    const findEntry = (entryType) =>
      entries.find((entry) => entry.entry_type === entryType);

    const clockIn = findEntry('CLOCK_IN');
    const lunchOut = findEntry('LUNCH_OUT');
    const lunchIn = findEntry('LUNCH_IN');
    const clockOut = findEntry('CLOCK_OUT');

    let workedMinutes = 0;

    if (clockIn && lunchOut) {
      workedMinutes +=
        (new Date(lunchOut.recorded_at) -
          new Date(clockIn.recorded_at)) /
        60000;
    }

    if (lunchIn && clockOut) {
      workedMinutes +=
        (new Date(clockOut.recorded_at) -
          new Date(lunchIn.recorded_at)) /
        60000;
    }

    const isComplete =
      Boolean(clockIn) &&
      Boolean(lunchOut) &&
      Boolean(lunchIn) &&
      Boolean(clockOut);

    const isToday = dateKey === todayKey;

const hasApprovedCorrection = approvedAdjustments.some(
  (adjustment) =>
    adjustment.requested_date === dateKey &&
    adjustment.request_type === 'TIME_CORRECTION' &&
    Array.isArray(adjustment.requested_punches) &&
    adjustment.requested_punches.length > 0
);

const hasApprovedAbsence = approvedAdjustments.some(
  (adjustment) =>
    adjustment.requested_date === dateKey &&
    adjustment.request_type === 'ABSENCE_EXCUSE'
);


let bankMinutes = 0;
let description = 'Jornada em andamento';

    if (hasApprovedAbsence) {
  bankMinutes = 0;
  description = 'Abono aprovado';
} if (hasApprovedAbsence) {
  bankMinutes = 0;
  description = 'Abono aprovado';
} else if (!isToday || isComplete) {
  bankMinutes = workedMinutes - expectedDailyMinutes;

  const tolerance = Number(
    workSchedule?.tolerance_minutes || 0
  );

  if (Math.abs(bankMinutes) <= tolerance) {
    bankMinutes = 0;
  }

  description = hasApprovedCorrection
    ? 'Correção de ponto aprovada'
    : isComplete
    ? 'Jornada concluída'
    : 'Jornada incompleta';
}

    const [year, month, day] = dateKey.split('-');
    const dateForLabel = new Date(
      `${year}-${month}-${day}T12:00:00-03:00`
    );

    const weekday = dateForLabel
      .toLocaleDateString('pt-BR', {
        weekday: 'short',
        timeZone: 'America/Sao_Paulo',
      })
      .replace('.', '');

    const formattedWeekday =
      weekday.charAt(0).toUpperCase() + weekday.slice(1);

    return {
      id: dateKey,
      date: isToday
        ? `Hoje (${day}/${month})`
        : `${formattedWeekday}, ${day}/${month}`,
      description,
      hours: formatMinutesToBank(bankMinutes),
      type:
        bankMinutes > 0
          ? 'positive'
          : bankMinutes < 0
          ? 'negative'
          : 'neutral',
      bankMinutes,
      dateKey,
    };
  })
  .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const filteredTransactions = transactions.filter((t) => {
    if (activeTab === 'credito') return t.type === 'positive';
    if (activeTab === 'debito') return t.type === 'negative';
    return true;
  });

  const balanceMinutes = transactions.reduce((total, transaction) => {
  const isNegative = transaction.hours.startsWith('-');
  const numericTime = transaction.hours.replace('+', '').replace('-', '');
  const [hours, minutes] = numericTime.split(':').map(Number);

  const transactionMinutes = hours * 60 + minutes;

  return total + (isNegative ? -transactionMinutes : transactionMinutes);
}, 0);

const isPositiveBalance = balanceMinutes > 0;
const isNegativeBalance = balanceMinutes < 0;

const absoluteBalance = Math.abs(balanceMinutes);
const balanceHours = Math.floor(absoluteBalance / 60);
const balanceRemainingMinutes = absoluteBalance % 60;

const formattedBalance =
  `${isNegativeBalance ? '-' : isPositiveBalance ? '+' : ''}` +
  `${String(balanceHours).padStart(2, '0')}h ` +
  `${String(balanceRemainingMinutes).padStart(2, '0')}m`;

const balanceLabel = isPositiveBalance
  ? 'Saldo positivo'
  : isNegativeBalance
  ? 'Saldo negativo'
  : 'Saldo zerado';

const balanceColor = isPositiveBalance
  ? '#86EFAC'
  : isNegativeBalance
  ? '#FCA5A5'
  : '#FFFFFF';

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
        <Text style={styles.headerTitle}>Banco de Horas</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Card Principal de Saldo */}
        {/* Card Principal de Saldo */}
<View style={styles.balanceCard}>
  <Text
  style={[
    styles.balanceLabel,
    { color: balanceColor },
  ]}
>
  {balanceLabel}
</Text>

<Text style={styles.balanceValue}>
  {formattedBalance}
</Text>
</View>

        {/* Abas de Filtro do Extrato */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'todos' && styles.filterTabActive]}
            onPress={() => setActiveTab('todos')}
          >
            <Text style={[styles.filterTabText, activeTab === 'todos' && styles.filterTabTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'credito' && styles.filterTabActive]}
            onPress={() => setActiveTab('credito')}
          >
            <Text style={[styles.filterTabText, activeTab === 'credito' && styles.filterTabTextActive]}>
              Crédito (+)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, activeTab === 'debito' && styles.filterTabActive]}
            onPress={() => setActiveTab('debito')}
          >
            <Text style={[styles.filterTabText, activeTab === 'debito' && styles.filterTabTextActive]}>
              Débito (-)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Lançamentos */}
        <Text style={styles.sectionTitle}>Extrato de lançamentos</Text>

        <View style={styles.transactionList}>
  {isLoadingBank ? (
    <Text
      style={{
        textAlign: 'center',
        color: '#64748B',
        paddingVertical: 24,
      }}
    >
      Carregando banco de horas...
    </Text>
  ) : filteredTransactions.length === 0 ? (
    <Text
      style={{
        textAlign: 'center',
        color: '#64748B',
        paddingVertical: 24,
      }}
    >
      Nenhum lançamento encontrado.
    </Text>
  ) : (
    filteredTransactions.map((item) => (
      <View key={item.id} style={styles.transactionCard}>
        <View style={styles.transactionLeft}>
          <View
            style={[
              styles.indicatorDot,
              item.type === 'positive'
                ? styles.dotPositive
                : item.type === 'negative'
                ? styles.dotNegative
                : styles.dotNeutral,
            ]}
          />

          <View>
            <Text style={styles.transactionDate}>
              {item.date}
            </Text>

            <Text style={styles.transactionDesc}>
              {item.description}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.transactionHours,
            item.type === 'positive'
              ? styles.hoursPositive
              : item.type === 'negative'
              ? styles.hoursNegative
              : styles.hoursNeutral,
          ]}
        >
          {item.hours}
        </Text>
      </View>
    ))
  )}
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
  balanceCard: {
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#BFDBFE',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  balancePeriod: {
    fontSize: 12,
    color: '#DBEAFE',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#DBEAFE',
    marginBottom: 2,
  },
  statPositive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#86EFAC',
  },
  statNegative: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FCA5A5',
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  transactionList: {
    gap: 8,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPositive: {
    backgroundColor: '#16A34A',
  },
  dotNegative: {
    backgroundColor: '#DC2626',
  },
  dotNeutral: {
    backgroundColor: '#94A3B8',
  },
  transactionDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  transactionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  transactionHours: {
    fontSize: 14,
    fontWeight: '700',
  },
  hoursPositive: {
    color: '#16A34A',
  },
  hoursNegative: {
    color: '#DC2626',
  },
  hoursNeutral: {
    color: '#64748B',
  },
});