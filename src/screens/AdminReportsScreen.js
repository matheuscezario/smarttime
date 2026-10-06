import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import { supabase } from '../services/supabase';

export default function AdminReportsScreen({ navigation }) {

  // Estados dos filtros da imagem
  const [startDate, setStartDate] = useState('01/05/2024');
  const [endDate, setEndDate] = useState('31/05/2024');
  const [selectedSector, setSelectedSector] = useState('Todos os setores');
  const [sectors, setSectors] = useState([]);
const [sectorMenuOpen, setSectorMenuOpen] = useState(false);

const [reportMetrics, setReportMetrics] = useState({
  employees: 0,
  punches: 0,
  registeredDays: 0,
  outsideGeofence: 0,
});

const convertDateToISO = (dateText, endOfDay = false) => {
  const parts = dateText.split('/');

  if (parts.length !== 3) {
    return null;
  }

  const [day, month, year] = parts;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

useEffect(() => {
  const loadSectors = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('department')
      .eq('active', true)
      .not('department', 'is', null);

    if (error) {
      console.error(
        'Erro ao carregar setores:',
        error
      );
      return;
    }

    const uniqueSectors = [
      ...new Set(
        (data || [])
          .map((item) => item.department?.trim())
          .filter(Boolean)
      ),
    ].sort();

    setSectors(uniqueSectors);
  };

  loadSectors();
}, []);

useEffect(() => {
  const loadReportMetrics = async () => {
    const startDateISO = convertDateToISO(startDate);
    const endDateISO = convertDateToISO(endDate, true);

    // Enquanto a data estiver incompleta, não consulta o banco.
    if (!startDateISO || !endDateISO || startDateISO > endDateISO) {
      setReportMetrics({
        employees: 0,
        punches: 0,
        registeredDays: 0,
        outsideGeofence: 0,
      });
      return;
    }

    const { data: entries, error: entriesError } = await supabase
      .from('time_entries')
      .select('id, user_id, recorded_at, within_geofence')
      .gte('recorded_at', startDateISO)
      .lte('recorded_at', endDateISO);

    if (entriesError) {
      console.error('Erro ao carregar métricas do relatório:', entriesError);
      return;
    }

    const userIds = [
      ...new Set((entries || []).map((entry) => entry.user_id)),
    ];

    let profiles = [];

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, department')
        .in('id', userIds);

      if (profilesError) {
        console.error('Erro ao carregar setores das métricas:', profilesError);
        return;
      }

      profiles = profilesData || [];
    }

    const profileById = {};

    profiles.forEach((employee) => {
      profileById[employee.id] = employee;
    });

    const filteredEntries =
      selectedSector === 'Todos os setores'
        ? entries || []
        : (entries || []).filter(
            (entry) =>
              profileById[entry.user_id]?.department === selectedSector
          );

    const employees = new Set(
      filteredEntries.map((entry) => entry.user_id)
    ).size;

    const registeredDays = new Set(
      filteredEntries.map((entry) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
        }).format(new Date(entry.recorded_at))
      )
    ).size;

    const outsideGeofence = filteredEntries.filter(
      (entry) => entry.within_geofence === false
    ).length;

    setReportMetrics({
      employees,
      punches: filteredEntries.length,
      registeredDays,
      outsideGeofence,
    });
  };

  loadReportMetrics();
}, [startDate, endDate, selectedSector]);

  const handleGenerateReport = async () => {
    const startDateISO = convertDateToISO(startDate);
const endDateISO = convertDateToISO(endDate, true);

if (!startDateISO || !endDateISO) {
  alert('Informe as datas no formato DD/MM/AAAA.');
  return;
}

if (startDateISO > endDateISO) {
  alert('A data inicial não pode ser maior que a data final.');
  return;
}

const { data: timeEntries, error: timeEntriesError } = await supabase
  .from('time_entries')
  .select(
  'id, user_id, entry_type, recorded_at, notes, within_geofence'
)
  .gte('recorded_at', startDateISO)
  .lte('recorded_at', endDateISO)
  .order('recorded_at', { ascending: true });

if (timeEntriesError) {
  console.error('Erro ao consultar batidas:', timeEntriesError);
  alert('Não foi possível consultar as batidas do período.');
  return;
}

const userIds = [
  ...new Set(
    (timeEntries || []).map((entry) => entry.user_id)
  ),
];

let profiles = [];

if (userIds.length > 0) {
  const {
    data: profilesData,
    error: profilesError,
  } = await supabase
    .from('profiles')
    .select(
      'id, full_name, department, employee_code'
    )
    .in('id', userIds);

  if (profilesError) {
    console.error(
      'Erro ao consultar funcionários:',
      profilesError
    );

    alert(
      'As batidas foram encontradas, mas não foi possível carregar os funcionários.'
    );

    return;
  }

  profiles = profilesData || [];
}

const profileById = {};

profiles.forEach((employee) => {
  profileById[employee.id] = employee;
});

const filteredTimeEntries =
  selectedSector === 'Todos os setores'
    ? timeEntries || []
    : (timeEntries || []).filter((entry) => {
        const employee =
          profileById[entry.user_id];

        return (
          employee?.department ===
          selectedSector
        );
      });

      const reportEmployeeCount = new Set(
  filteredTimeEntries.map((entry) => entry.user_id)
).size;

const reportPunchCount = filteredTimeEntries.length;

const reportDayCount = new Set(
  filteredTimeEntries.map((entry) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(entry.recorded_at))
  )
).size;

const reportOutsideGeofenceCount = filteredTimeEntries.filter(
  (entry) => entry.within_geofence === false
).length;

const employeesFound = [
  ...new Set(
    (timeEntries || []).map((entry) => {
      return (
        profileById[entry.user_id]?.full_name ||
        'Funcionário não identificado'
      );
    })
  ),
];

const entryTypeLabels = {
  CLOCK_IN: 'Entrada',
  LUNCH_OUT: 'Saída para almoço',
  LUNCH_IN: 'Volta do almoço',
  CLOCK_OUT: 'Saída',
};

const timeEntriesRows =
  filteredTimeEntries.length > 0
    ? filteredTimeEntries
        .map((entry) => {
    const employee =
      profileById[entry.user_id];

    const recordedDate = new Date(
      entry.recorded_at
    );

    return `
      <tr>
        <td>
          ${
            employee?.full_name ||
            'Funcionário não identificado'
          }
        </td>

        <td>
          ${employee?.department || '-'}
        </td>

        <td>
          ${recordedDate.toLocaleDateString(
            'pt-BR'
          )}
        </td>

        <td>
          ${recordedDate.toLocaleTimeString(
            'pt-BR',
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          )}
        </td>

        <td>
          ${
            entryTypeLabels[
              entry.entry_type
            ] || entry.entry_type
          }
        </td>
      </tr>
    `;
          })
        .join('')
    : `
      <tr>
        <td colspan="5" style="text-align: center;">
          Nenhuma batida encontrada para o período e setor selecionados.
        </td>
      </tr>
    `;

    try {

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
            .metrics-grid { display: flex; gap: 12px; margin: 16px 0; }
            .metric-box { border: 1px solid #CBD5E1; padding: 12px; border-radius: 6px; flex: 1; text-align: center; }
            .metric-val { font-size: 20px; font-weight: bold; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #CBD5E1; padding: 8px; text-align: left; }
            th { background-color: #F1F5F9; color: #334155; }
          </style>
        </head>
        <body>
          <h2>SMARTTIME - RELATÓRIO GERENCIAL</h2>
          <p>Período: ${startDate} até ${endDate} • Setor: ${selectedSector}</p>
          <div class="divider"></div>

          <div class="metrics-grid">
  <div class="metric-box">
    <p>Colaboradores</p>
    <div class="metric-val" style="color: #2563EB;">
      ${reportEmployeeCount}
    </div>
  </div>

  <div class="metric-box">
    <p>Batidas</p>
    <div class="metric-val" style="color: #16A34A;">
      ${reportPunchCount}
    </div>
  </div>

  <div class="metric-box">
    <p>Dias registrados</p>
    <div class="metric-val" style="color: #D97706;">
      ${reportDayCount}
    </div>
  </div>

  <div class="metric-box">
    <p>Fora da área</p>
    <div class="metric-val" style="color: #DC2626;">
      ${reportOutsideGeofenceCount}
    </div>
  </div>
</div>

          <h3>Batidas registradas no período</h3>
          <table>
            <thead>
              <tr>
  <th>Colaborador</th>
  <th>Setor</th>
  <th>Data</th>
  <th>Horário</th>
  <th>Tipo de batida</th>
</tr>
            </thead>
            <tbody>
              ${timeEntriesRows}
            </tbody>
          </table>
        </body>
        </html>
      `;

      if (Platform.OS === 'web') {
  const printFrame =
    document.createElement('iframe');

  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';

  document.body.appendChild(printFrame);

  const frameDocument =
    printFrame.contentWindow.document;

  frameDocument.open();
  frameDocument.write(htmlContent);
  frameDocument.close();

  setTimeout(() => {
    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();

    setTimeout(() => {
      document.body.removeChild(printFrame);
    }, 1000);
  }, 500);

  return;
}

const { uri } =
  await Print.printToFileAsync({
    html: htmlContent,
  });

alert(
  `Relatório em PDF gerado com sucesso!\nSalvo em: ${uri}`
);
    } catch (error) {
      alert('Erro ao gerar relatório.');
      console.error(error);
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
        <Text style={styles.headerTitle}>Relatórios</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Card de Configuração de Relatório */}
        <View style={styles.filterCard}>
          {/* Seção Período */}
          <Text style={styles.cardSectionTitle}>Período</Text>
          <View style={styles.dateRow}>
            {/* Campo Início */}
            <View style={styles.dateCol}>
              <Text style={styles.inputSubLabel}>Início</Text>
              <View style={styles.dateInputWrapper}>
                <TextInput
                  style={styles.dateInput}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.calendarIcon}>📅</Text>
              </View>
            </View>

            {/* Campo Fim */}
            <View style={styles.dateCol}>
              <Text style={styles.inputSubLabel}>Fim</Text>
              <View style={styles.dateInputWrapper}>
                <TextInput
                  style={styles.dateInput}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.calendarIcon}>📅</Text>
              </View>
            </View>
          </View>

          {/* Seção Setor */}
          <Text style={styles.fieldLabel}>Setor</Text>
          <TouchableOpacity
  style={styles.dropdownSelector}
  onPress={() =>
    setSectorMenuOpen((current) => !current)
  }
>
  <Text style={styles.dropdownText}>
    {selectedSector}
  </Text>

  <Text style={styles.dropdownChevron}>
  {sectorMenuOpen ? '▲' : '▼'}
</Text>
</TouchableOpacity>

{sectorMenuOpen && (
  <View style={styles.sectorOptions}>
    {['Todos os setores', ...sectors].map(
      (sector) => (
        <TouchableOpacity
          key={sector}
          style={styles.sectorOption}
          onPress={() => {
            setSelectedSector(sector);
            setSectorMenuOpen(false);
          }}
        >
          <Text style={styles.sectorOptionText}>
            {sector}
          </Text>
        </TouchableOpacity>
      )
    )}
  </View>
)}

        

          {/* Botão Gerar Relatório */}
          <TouchableOpacity style={styles.btnGenerate} onPress={handleGenerateReport}>
            <Text style={styles.btnGenerateText}>Gerar relatório</Text>
          </TouchableOpacity>
        </View>

        {/* Resumo de Indicadores */}
        <Text style={styles.sectionTitle}>Métricas em tempo real</Text>
        <View style={styles.metricsGrid}>
  <View style={[styles.metricRow, styles.metricRowSpacing]}>
    <View style={[styles.metricCard, styles.metricCardLeft]}>
      <Text style={styles.metricLabel}>Colaboradores</Text>
      <Text style={[styles.metricNumber, styles.textBlue]}>
        {reportMetrics.employees}
      </Text>
      <Text style={styles.metricSub}>Com registros</Text>
    </View>

    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>Batidas</Text>
      <Text style={[styles.metricNumber, styles.textGreen]}>
        {reportMetrics.punches}
      </Text>
      <Text style={styles.metricSub}>No período</Text>
    </View>
  </View>

  <View style={styles.metricRow}>
    <View style={[styles.metricCard, styles.metricCardLeft]}>
      <Text style={styles.metricLabel}>Dias registrados</Text>
      <Text style={[styles.metricNumber, styles.textAmber]}>
        {reportMetrics.registeredDays}
      </Text>
      <Text style={styles.metricSub}>Com movimentação</Text>
    </View>

    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>Fora da área</Text>
      <Text style={[styles.metricNumber, styles.textRed]}>
        {reportMetrics.outsideGeofence}
      </Text>
      <Text style={styles.metricSub}>Batidas sinalizadas</Text>
    </View>
  </View>
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
  color: '#0F172A',
  fontWeight: '300',
},

headerTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#0A2540',
},

scrollContent: {
  width: '100%',
  maxWidth: 1000,
  alignSelf: 'center',
  padding: 16,
  paddingBottom: 32,
},

filterCard: {
  width: '100%',
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 20,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 6,
  elevation: 2,
  marginBottom: 20,
},

cardSectionTitle: {
  fontSize: 15,
  fontWeight: '800',
  color: '#0A2540',
  marginBottom: 8,
},

dateRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginBottom: 14,
},

dateCol: {
  width: '48%',
  minWidth: 0,
},

inputSubLabel: {
  fontSize: 12,
  color: '#64748B',
  marginBottom: 6,
},

dateInputWrapper: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#CBD5E1',
  paddingHorizontal: 12,
  height: 46,
  minWidth: 0,
  overflow: 'hidden',
},

dateInput: {
  flex: 1,
  minWidth: 0,
  fontSize: 13,
  fontWeight: '600',
  color: '#0F172A',
  padding: 0,
},

calendarIcon: {
  flexShrink: 0,
  fontSize: 14,
  marginLeft: 6,
},

fieldLabel: {
  fontSize: 13,
  color: '#64748B',
  marginBottom: 6,
},

dropdownSelector: {
  width: '100%',
  minHeight: 46,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#CBD5E1',
  paddingHorizontal: 14,
  paddingVertical: 12,
  marginBottom: 16,
},

dropdownText: {
  flex: 1,
  minWidth: 0,
  fontSize: 14,
  color: '#0F172A',
  fontWeight: '500',
},

dropdownChevron: {
  width: 20,
  flexShrink: 0,
  fontSize: 11,
  color: '#0A2540',
  fontWeight: 'bold',
  marginLeft: 12,
  textAlign: 'center',
},

radioRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 28,
  marginBottom: 22,
  marginTop: 2,
},

radioOption: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},

radioCircle: {
  width: 20,
  height: 20,
  borderRadius: 10,
  borderWidth: 2,
  borderColor: '#CBD5E1',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
},

radioCircleActive: {
  borderColor: '#0052CC',
},

radioDot: {
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: '#0052CC',
},

radioText: {
  fontSize: 14,
  color: '#64748B',
  fontWeight: '500',
},

radioTextActive: {
  color: '#0F172A',
  fontWeight: '700',
},

btnGenerate: {
  width: '100%',
  backgroundColor: '#0052CC',
  borderRadius: 10,
  paddingVertical: 14,
  alignItems: 'center',
},

btnGenerateText: {
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: '700',
},

sectionTitle: {
  fontSize: 13,
  fontWeight: '700',
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 12,
},

metricsGrid: {
  width: '100%',
},

metricRow: {
  width: '100%',
  flexDirection: 'row',
},

metricRowSpacing: {
  marginBottom: 12,
},

metricCardLeft: {
  marginRight: 12,
},

metricCard: {
  flex: 1,
  minWidth: 0,
  minHeight: 118,
  boxSizing: 'border-box',
  justifyContent: 'space-between',
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  padding: 14,
  borderWidth: 1,
  borderColor: '#E2E8F0',
},

metricLabel: {
  fontSize: 12,
  fontWeight: '600',
  color: '#64748B',
},

metricNumber: {
  fontSize: 26,
  fontWeight: '800',
  marginVertical: 4,
},

metricSub: {
  fontSize: 11,
  color: '#94A3B8',
},

textAmber: {
  color: '#D97706',
},

textGreen: {
  color: '#16A34A',
},

textRed: {
  color: '#DC2626',
},

textBlue: {
  color: '#0052CC',
},

sectorOptions: {
  width: '100%',
  borderWidth: 1,
  borderColor: '#CBD5E1',
  borderRadius: 8,
  backgroundColor: '#FFFFFF',
  marginTop: -10,
  marginBottom: 16,
  overflow: 'hidden',
},

sectorOption: {
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
},

sectorOptionText: {
  fontSize: 14,
  color: '#334155',
},
});