import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import {
  useFocusEffect,
} from '@react-navigation/native';
import * as Print from 'expo-print';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';

export default function HistoryScreen({
  navigation,
  route,
}) {
  const { todayPunches } = useApp();

  const profile = route.params?.profile;

  const displayName =
    profile?.full_name || 'Funcionário';
  const [databaseEntries, setDatabaseEntries] =
  useState([]);

  const [
  adjustmentRequests,
  setAdjustmentRequests,
] = useState([]);

  const departmentName =
  profile?.department || 'Não informado';

  const employeeCode =
  profile?.employee_code || 'Não informado';

  const [companyData, setCompanyData] =
  useState(null);

  const companyName =
  companyData?.name || 'Empresa não informada';

  const companyDocument =
  companyData?.document || 'Não informado';

  const emissionDate =
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

const [isLoadingHistory, setIsLoadingHistory] =
  useState(true);
  const [selectedMonth, setSelectedMonth] =
  useState(() => {
    const monthText =
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        month: 'long',
        year: 'numeric',
      }).format(new Date());

    return (
      monthText.charAt(0).toUpperCase() +
      monthText.slice(1).replace(' de ', ' / ')
    );
  });
  const [previewVisible, setPreviewVisible] = useState(false);

  useFocusEffect(
  useCallback(() => {
    const loadHistoryEntries = async () => {
    try {
      setIsLoadingHistory(true);

      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      const loggedUser = session?.user;

      if (authError || !loggedUser) {
        throw new Error(
          'Usuário não autenticado.'
        );
      }

      const { data, error } = await supabase
        .from('time_entries')
.select(`
  id,
  entry_type,
  recorded_at,
  notes
`)
        .eq('user_id', loggedUser.id)
        .order('recorded_at', {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setDatabaseEntries(data || []);
      const {
  data: requestsData,
  error: requestsError,
} = await supabase
  .from('adjustment_requests')
  .select(`
  id,
  requested_date,
  request_type,
  status
`)
  .eq('user_id', loggedUser.id)
  .order('created_at', {
    ascending: false,
  });

if (requestsError) {
  throw requestsError;
}

setAdjustmentRequests(
  requestsData || []
);
    } catch (error) {
      console.error(
        'Erro ao carregar histórico:',
        error
      );

      setDatabaseEntries([]);
      setAdjustmentRequests([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

      loadHistoryEntries();
  }, [])
);

useEffect(() => {
  const loadCompanyData = async () => {
    if (!profile?.id) {
      setCompanyData(null);
      return;
    }

    const {
      data: profileCompany,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', profile.id)
      .single();

    if (profileError) {
      console.error(
        'Erro ao carregar vínculo da empresa:',
        profileError
      );

      setCompanyData(null);
      return;
    }

    if (!profileCompany?.company_id) {
      setCompanyData(null);
      return;
    }

    const { data, error } = await supabase
      .from('companies')
      .select('name, document')
      .eq('id', profileCompany.company_id)
      .single();

    if (error) {
      console.error(
        'Erro ao carregar empresa:',
        error
      );

      setCompanyData(null);
      return;
    }

    setCompanyData(data);
  };

  loadCompanyData();
}, [profile?.id]);

  const todayEntries = todayPunches.map((p) => p.time || '--:--');
  const recordedCount = todayPunches.filter((p) => p.time !== null).length;
  const todayTotalHours = (() => {
  const toMinutes = (time) => {
    const [hours, minutes] =
      time.split(':').map(Number);

    return hours * 60 + minutes;
  };

  let totalMinutes = 0;

  if (
    todayEntries[0] !== '--:--' &&
    todayEntries[1] !== '--:--'
  ) {
    totalMinutes +=
      toMinutes(todayEntries[1]) -
      toMinutes(todayEntries[0]);
  }

  if (
    todayEntries[2] !== '--:--' &&
    todayEntries[3] !== '--:--'
  ) {
    totalMinutes +=
      toMinutes(todayEntries[3]) -
      toMinutes(todayEntries[2]);
  }

  const hours = Math.floor(
    totalMinutes / 60
  );

  const minutes = totalMinutes % 60;

  return (
    `${String(hours).padStart(2, '0')}h ` +
    `${String(minutes).padStart(2, '0')}m`
  );
})();
  const todayDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
}).format(new Date());

const hasPendingTodayAdjustment =
  adjustmentRequests.some(
    (request) =>
      request.requested_date === todayDate &&
      String(request.status).toUpperCase() ===
        'PENDING'
  );

  const hasApprovedTodayAbsence =
  adjustmentRequests.some(
    (request) =>
      request.requested_date === todayDate &&
      request.request_type ===
        'ABSENCE_EXCUSE' &&
      String(request.status).toUpperCase() ===
        'APPROVED'
  );

const todayDateLabel = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date());

const getHistoryDate = (dayLabel) => {
  const dateMatch = dayLabel.match(
    /(\d{2})\/(\d{2})/
  );

  const yearMatch = selectedMonth.match(
    /(\d{4})/
  );

  if (!dateMatch || !yearMatch) {
    return todayDate;
  }

  const [, day, month] = dateMatch;
  const year = yearMatch[1];

  return `${year}-${month}-${day}`;
};

const entryPosition = {
  CLOCK_IN: 0,
  LUNCH_OUT: 1,
  LUNCH_IN: 2,
  CLOCK_OUT: 3,
};

const realHistoryData = Object.values(
  databaseEntries
    .filter((entry) => {
      const recordedDate =
        new Date(entry.recorded_at);

      const monthText =
        new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          month: 'long',
          year: 'numeric',
        }).format(recordedDate);

      const entryMonth =
        monthText.charAt(0).toUpperCase() +
        monthText
          .slice(1)
          .replace(' de ', ' / ');

      return entryMonth === selectedMonth;
    })
    .reduce((days, entry) => {
    const recordedDate =
      new Date(entry.recorded_at);

    const dateKey =
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
      }).format(recordedDate);

    if (!days[dateKey]) {
      const dateLabel =
        new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        }).format(recordedDate);

      days[dateKey] = {
        id: dateKey,
        day: dateLabel,
        punches: [
          '--:--',
          '--:--',
          '--:--',
          '--:--',
        ],
      };
    }

    const position =
      entryPosition[entry.entry_type];

    if (position !== undefined) {
      days[dateKey].punches[position] =
        new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        }).format(recordedDate);
    }

    return days;
  }, {})
)
  .filter((day) => day.id !== todayDate)
  .map((day) => {
    const toMinutes = (time) => {
      const [hours, minutes] = time
        .split(':')
        .map(Number);

      return hours * 60 + minutes;
    };

    let totalMinutes = 0;

    if (
      day.punches[0] !== '--:--' &&
      day.punches[1] !== '--:--'
    ) {
      totalMinutes +=
        toMinutes(day.punches[1]) -
        toMinutes(day.punches[0]);
    }

    if (
      day.punches[2] !== '--:--' &&
      day.punches[3] !== '--:--'
    ) {
      totalMinutes +=
        toMinutes(day.punches[3]) -
        toMinutes(day.punches[2]);
    }

    const isIncomplete = day.punches.some(
      (time) => time === '--:--'
    );

    const hours = Math.floor(
      totalMinutes / 60
    );

    const minutes = totalMinutes % 60;

    const hasPendingAdjustment =
  adjustmentRequests.some(
    (request) =>
      request.requested_date === day.id &&
      String(request.status).toUpperCase() ===
        'PENDING'
  );

  const hasApprovedAbsence =
  adjustmentRequests.some(
    (request) =>
      request.requested_date === day.id &&
      request.request_type ===
        'ABSENCE_EXCUSE' &&
      String(request.status).toUpperCase() ===
        'APPROVED'
  );

    return {
  ...day,
  hasPendingAdjustment,
  hasApprovedAbsence,
  isIncomplete:
    hasApprovedAbsence
      ? false
      : isIncomplete,
  status: hasApprovedAbsence
    ? 'Abonado'
    : isIncomplete
      ? 'Incompleto'
      : 'Completo',
      totalHours: hasApprovedAbsence
  ? 'Abonado'
  : `${String(hours).padStart(2, '0')}h ` +
    `${String(minutes).padStart(2, '0')}m`,
    };
  })
  .sort((a, b) =>
    b.id.localeCompare(a.id)
  );

  const handleConfirmDownload = async () => {
    try {
      const todayRowHtml =
  isViewingCurrentMonth
    ? `
      <tr style="background-color: #EFF6FF; font-weight: bold;">
        <td>Hoje</td>
        <td>${todayEntries[0]}</td>
        <td>${todayEntries[1]}</td>
        <td>${todayEntries[2]}</td>
        <td>${todayEntries[3]}</td>
        <td>${todayTotalHours}</td>
      </tr>
    `
    : '';

const rowsHtml = [
  todayRowHtml,
  ...realHistoryData.map(
    (item) => `
      <tr>
        <td>${item.day}</td>
        <td>${item.punches[0]}</td>
        <td>${item.punches[1]}</td>
        <td>${item.punches[2]}</td>
        <td>${item.punches[3]}</td>
        <td>${item.totalHours}</td>
      </tr>
    `
  ),
].join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: sans-serif; padding: 24px; color: #1E293B; }
            h2 { margin-bottom: 4px; color: #0F172A; }
            p { margin: 2px 0; font-size: 13px; color: #475569; }
            .divider { height: 1px; background-color: #CBD5E1; margin: 16px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #CBD5E1; padding: 8px; text-align: center; }
            th { background-color: #F1F5F9; color: #334155; }
            .signature-area { margin-top: 50px; text-align: center; }
            .signature-line { width: 260px; height: 1px; background-color: #475569; margin: 0 auto 6px auto; }
          </style>
        </head>
        <body>
          <h2>${companyName}</h2>
<p>CNPJ: ${companyDocument} • Folha de Espelho de Ponto</p>
          <div class="divider"></div>
          <p><strong>Colaborador:</strong> ${displayName}</p>
          <p><strong>Departamento:</strong> ${departmentName} • <strong>Matrícula:</strong> ${employeeCode}</p>
          <p><strong>Período:</strong> ${selectedMonth}</p>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Entrada</th>
                <th>Almoço</th>
                <th>Volta</th>
                <th>Saída</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="signature-area">
            <div class="signature-line"></div>
            <p>Assinatura Digital do Colaborador</p>
          </div>
        </body>
        </html>
      `;

      if (Platform.OS === 'web') {
  await Print.printToFileAsync({
    html: htmlContent,
  });

  setPreviewVisible(false);
  return;
}

const { uri } =
  await Print.printToFileAsync({
    html: htmlContent,
  });

alert(
  `PDF gerado com sucesso!\nArquivo salvo em: ${uri}`
);

setPreviewVisible(false);
    } catch (error) {
      alert('Erro ao gerar o PDF. Verifique o console para mais detalhes.');
      console.error(error);
    }
  };

  const goToPreviousMonth = () => {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const [monthName, yearText] =
    selectedMonth.split(' / ');

  const currentMonthIndex =
    months.indexOf(monthName);

  if (currentMonthIndex === -1) {
    return;
  }

  const previousMonthIndex =
    currentMonthIndex === 0
      ? 11
      : currentMonthIndex - 1;

  const previousYear =
    currentMonthIndex === 0
      ? Number(yearText) - 1
      : Number(yearText);

  setSelectedMonth(
    `${months[previousMonthIndex]} / ${previousYear}`
  );
};

const goToNextMonth = () => {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const [monthName, yearText] =
    selectedMonth.split(' / ');

  const selectedMonthIndex =
    months.indexOf(monthName);

  if (selectedMonthIndex === -1) {
    return;
  }

  const currentDateParts =
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      month: 'numeric',
      year: 'numeric',
    }).formatToParts(new Date());

  const currentMonthIndex =
    Number(
      currentDateParts.find(
        (part) => part.type === 'month'
      )?.value
    ) - 1;

  const currentYear =
    Number(
      currentDateParts.find(
        (part) => part.type === 'year'
      )?.value
    );

  const selectedYear = Number(yearText);

  const isCurrentMonth =
    selectedMonthIndex === currentMonthIndex &&
    selectedYear === currentYear;

  if (isCurrentMonth) {
    return;
  }

  const nextMonthIndex =
    selectedMonthIndex === 11
      ? 0
      : selectedMonthIndex + 1;

  const nextYear =
    selectedMonthIndex === 11
      ? selectedYear + 1
      : selectedYear;

  setSelectedMonth(
    `${months[nextMonthIndex]} / ${nextYear}`
  );
};

const currentMonthText = (() => {
  const monthText =
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

  return (
    monthText.charAt(0).toUpperCase() +
    monthText.slice(1).replace(' de ', ' / ')
  );
})();

const isViewingCurrentMonth =
  selectedMonth === currentMonthText;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu Histórico</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.monthSelector}>
          <TouchableOpacity
  style={styles.monthArrowButton}
  onPress={goToPreviousMonth}
>
  <Text style={styles.monthArrow}>‹</Text>
</TouchableOpacity>
          <View style={styles.monthCenter}>
            <Text style={styles.calendarIcon}>📅</Text>
            <Text style={styles.monthText}>{selectedMonth}</Text>
          </View>
          <TouchableOpacity
  style={[
    styles.monthArrowButton,
    isViewingCurrentMonth && {
      opacity: 0.3,
    },
  ]}
  onPress={goToNextMonth}
  disabled={isViewingCurrentMonth}
>
  <Text style={styles.monthArrow}>›</Text>
</TouchableOpacity>
        </View>
        {isViewingCurrentMonth && (
          <>

        <Text style={styles.sectionHeader}>Hoje em tempo real</Text>
        <View style={[styles.dayCard, styles.todayCard]}>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.dayText}>Hoje (Em andamento)</Text>
              <Text style={styles.todaySubText}>{recordedCount} de 4 batidas registradas</Text>
            </View>
            <View
  style={[
    styles.statusBadge,
    hasApprovedTodayAbsence ||
    recordedCount === 4
      ? styles.badgeSuccess
      : styles.badgeProgress,
  ]}
>
  <Text
    style={[
      styles.statusBadgeText,
      hasApprovedTodayAbsence ||
      recordedCount === 4
        ? styles.textSuccess
        : styles.textProgress,
    ]}
  >
    {hasApprovedTodayAbsence
      ? 'Abonado'
      : recordedCount === 4
        ? 'Completo'
        : 'Em curso'}
  </Text>
</View>
          </View>

          <View style={styles.punchesPillRow}>
            {todayEntries.map((time, idx) => (
              <View
                key={idx}
                style={[
                  styles.punchPill,
                  time !== '--:--' ? styles.punchPillActive : styles.punchPillEmpty,
                ]}
              >
                <Text
                  style={[
                    styles.punchPillText,
                    time !== '--:--' ? styles.punchTextActive : styles.punchTextEmpty,
                  ]}
                >
                  {time}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.cardBottomRow}>
            <Text style={styles.totalHoursText}>
  Total: {todayTotalHours}
</Text>
            {recordedCount < 4 &&
  !hasApprovedTodayAbsence && (
  <TouchableOpacity
    style={[
      styles.btnAdjust,
      hasPendingTodayAdjustment && {
        opacity: 0.6,
      },
    ]}
    disabled={hasPendingTodayAdjustment}
                onPress={() =>
  navigation.navigate('Adjustment', {
    requestedDate: todayDate,
    dateLabel: todayDateLabel,
    punches: todayEntries,
  })
}
              >
                <Text style={styles.btnAdjustText}>
  {hasPendingTodayAdjustment
    ? 'Solicitação pendente'
    : 'Solicitar ajuste'}
</Text>
              </TouchableOpacity>
            )}
          </View>
                </View>
      </>
    )}

        <Text style={styles.sectionHeader}>Dias anteriores</Text>
        <View style={styles.historyList}>
  {!isLoadingHistory &&
    realHistoryData.length === 0 && (
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E2E8F0',
          borderRadius: 12,
          padding: 20,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: '#64748B',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Nenhum registro encontrado neste mês.
        </Text>
      </View>
    )}

  {realHistoryData.map((item) => (
            <View
              key={item.id}
              style={[styles.dayCard, item.isIncomplete && styles.cardIncomplete]}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.dayText}>{item.day}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    item.isIncomplete ? styles.badgeWarning : styles.badgeSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      item.isIncomplete ? styles.textWarning : styles.textSuccess,
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.punchesPillRow}>
                {item.punches.map((punch, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.punchPill,
                      punch === '--:--' && styles.punchPillMissing,
                    ]}
                  >
                    <Text
                      style={[
                        styles.punchPillText,
                        punch === '--:--' && styles.textMissing,
                      ]}
                    >
                      {punch}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.cardBottomRow}>
                <Text style={styles.totalHoursText}>Total: {item.totalHours}</Text>
                {item.isIncomplete && (
  <TouchableOpacity
    style={[
      styles.btnAdjust,
      item.hasPendingAdjustment && {
        opacity: 0.6,
      },
    ]}
    disabled={item.hasPendingAdjustment}
    onPress={() =>
      navigation.navigate('Adjustment', {
        requestedDate: getHistoryDate(item.day),
        dateLabel: `${item.day} / ${
          selectedMonth.match(/\d{4}/)?.[0] || ''
        }`,
        punches: item.punches,
      })
    }
  >
    <Text style={styles.btnAdjustText}>
      {item.hasPendingAdjustment
        ? 'Solicitação pendente'
        : 'Solicitar ajuste'}
    </Text>
  </TouchableOpacity>
)}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>Documentos</Text>
        <TouchableOpacity style={styles.exportCard} onPress={() => setPreviewVisible(true)}>
          <View style={styles.exportCardLeft}>
            <View style={styles.exportIconBadge}>
              <Text style={styles.exportIconText}>📄</Text>
            </View>
            <View>
              <Text style={styles.exportCardTitle}>Visualizar e Baixar Espelho</Text>
              <Text style={styles.exportCardSubtitle}>Pré-visualizar folha de ponto e exportar</Text>
            </View>
          </View>
          <Text style={styles.exportArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Pré-visualização */}
      <Modal visible={previewVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pré-visualização do Espelho</Text>
              <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetPaper} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetCompany}>
  {companyName}
</Text>
                <Text style={styles.sheetSub}>
  CNPJ: {companyDocument} • Emissão: {emissionDate}
</Text>
                <View style={styles.sheetDivider} />
                <Text style={styles.sheetWorker}>
  Colaborador: {displayName}
</Text>
                <Text style={styles.sheetMeta}>
  Departamento: {departmentName} • Matrícula: {employeeCode}
</Text>
                <Text style={styles.sheetMeta}>Período: {selectedMonth}</Text>
              </View>

              <View style={styles.sheetTable}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableCol, styles.colDay, styles.headerText]}>Data</Text>
                  <Text style={[styles.tableCol, styles.headerText]}>Entrada</Text>
                  <Text style={[styles.tableCol, styles.headerText]}>Almoço</Text>
                  <Text style={[styles.tableCol, styles.headerText]}>Volta</Text>
                  <Text style={[styles.tableCol, styles.headerText]}>Saída</Text>
                  <Text style={[styles.tableCol, styles.colTotal, styles.headerText]}>Total</Text>
                </View>

                {isViewingCurrentMonth && (
  <View style={[styles.tableRow, styles.rowToday]}>
    <Text
      style={[
        styles.tableCol,
        styles.colDay,
        styles.boldCol,
      ]}
    >
      Hoje
    </Text>

    {todayEntries.map((p, i) => (
      <Text
        key={i}
        style={[
          styles.tableCol,
          p === '--:--' && styles.redCol,
        ]}
      >
        {p}
      </Text>
    ))}

    <Text
      style={[
        styles.tableCol,
        styles.colTotal,
        styles.boldCol,
      ]}
    >
      {todayTotalHours}
    </Text>
  </View>
)}

                {realHistoryData.map((item) => (
                  <View key={item.id} style={styles.tableRow}>
                    <Text style={[styles.tableCol, styles.colDay]}>{item.day.split(',')[1]}</Text>
                    {item.punches.map((p, idx) => (
                      <Text key={idx} style={[styles.tableCol, p === '--:--' && styles.redCol]}>
                        {p}
                      </Text>
                    ))}
                    <Text style={[styles.tableCol, styles.colTotal]}>{item.totalHours.split(' ')[0]}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.signatureSection}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Assinatura do Colaborador (Digital)</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setPreviewVisible(false)}
              >
                <Text style={styles.btnSecondaryText}>Fechar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={handleConfirmDownload}
              >
                <Text style={styles.btnPrimaryText}>📥 Baixar PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  filterButton: {
    padding: 6,
  },
  filterIcon: {
    fontSize: 18,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  monthArrowButton: {
    paddingHorizontal: 8,
  },
  monthArrow: {
    fontSize: 22,
    color: '#1E293B',
    fontWeight: '600',
  },
  monthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarIcon: {
    fontSize: 16,
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  todayCard: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F7FF',
  },
  cardIncomplete: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFDF5',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  todaySubText: {
    fontSize: 11,
    color: '#2563EB',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  badgeProgress: {
    backgroundColor: '#DBEAFE',
  },
  badgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textSuccess: {
    color: '#15803D',
  },
  textProgress: {
    color: '#1D4ED8',
  },
  textWarning: {
    color: '#B45309',
  },
  punchesPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  punchPill: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 64,
    alignItems: 'center',
  },
  punchPillActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  punchPillEmpty: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  punchPillMissing: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  punchPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  punchTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },
  punchTextEmpty: {
    color: '#94A3B8',
  },
  textMissing: {
    color: '#DC2626',
    fontWeight: '700',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  totalHoursText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  btnAdjust: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  btnAdjustText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  historyList: {
    gap: 8,
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    marginTop: 4,
    marginBottom: 16,
  },
  exportCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportIconText: {
    fontSize: 18,
  },
  exportCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  exportCardSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
  },
  exportArrow: {
    fontSize: 22,
    color: '#1D4ED8',
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    fontSize: 18,
    color: '#64748B',
    padding: 4,
  },
  sheetPaper: {
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  sheetHeader: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  sheetCompany: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  sheetSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  sheetWorker: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  sheetMeta: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  sheetTable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  rowToday: {
    backgroundColor: '#EFF6FF',
  },
  tableCol: {
    flex: 1,
    fontSize: 10,
    textAlign: 'center',
    color: '#334155',
  },
  colDay: {
    flex: 1.2,
    fontWeight: '600',
  },
  colTotal: {
    flex: 1,
    fontWeight: '700',
    color: '#1E40AF',
  },
  headerText: {
    fontWeight: '700',
    color: '#475569',
  },
  boldCol: {
    fontWeight: '700',
  },
  redCol: {
    color: '#DC2626',
    fontWeight: '600',
  },
  signatureSection: {
    marginTop: 24,
    alignItems: 'center',
    paddingBottom: 24,
  },
  signatureLine: {
    width: '70%',
    height: 1,
    backgroundColor: '#94A3B8',
    marginBottom: 6,
  },
  signatureLabel: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  btnPrimary: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});