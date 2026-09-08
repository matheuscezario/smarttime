import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
} from 'react-native';
import * as Print from 'expo-print';
import { useApp } from '../context/AppContext';

export default function AdminReportsScreen({ navigation }) {
  const { requests } = useApp();

  // Estados dos filtros da imagem
  const [startDate, setStartDate] = useState('01/05/2024');
  const [endDate, setEndDate] = useState('31/05/2024');
  const [selectedSector, setSelectedSector] = useState('Todos os setores');
  const [formatType, setFormatType] = useState('pdf'); // 'pdf' | 'excel'

  // Métricas dinâmicas do contexto
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;
  const totalRequests = requests.length;

  const handleGenerateReport = async () => {
    if (formatType === 'excel') {
      alert(`Exportação em Excel solicitada para o período ${startDate} até ${endDate}.`);
      return;
    }

    try {
      const requestsRows = requests
        .map(
          (req) => `
        <tr>
          <td>${req.name}</td>
          <td>${req.sector}</td>
          <td>${req.date}</td>
          <td>${req.type}</td>
          <td style="font-weight: bold; color: ${
            req.status === 'approved'
              ? '#16A34A'
              : req.status === 'rejected'
              ? '#DC2626'
              : '#D97706'
          };">
            ${req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Recusado' : 'Pendente'}
          </td>
        </tr>
      `
        )
        .join('');

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
              <p>Total Geral</p>
              <div class="metric-val">${totalRequests}</div>
            </div>
            <div class="metric-box">
              <p>Pendentes</p>
              <div class="metric-val" style="color: #D97706;">${pendingCount}</div>
            </div>
            <div class="metric-box">
              <p>Aprovados</p>
              <div class="metric-val" style="color: #16A34A;">${approvedCount}</div>
            </div>
            <div class="metric-box">
              <p>Recusados</p>
              <div class="metric-val" style="color: #DC2626;">${rejectedCount}</div>
            </div>
          </div>

          <h3>Detalhamento das Solicitações</h3>
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Setor</th>
                <th>Data</th>
                <th>Tipo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${requestsRows}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      alert(`Relatório em PDF gerado com sucesso!\nSalvo em: ${uri}`);
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
          <TouchableOpacity style={styles.dropdownSelector}>
            <Text style={styles.dropdownText}>{selectedSector}</Text>
            <Text style={styles.dropdownChevron}>⌄</Text>
          </TouchableOpacity>

          {/* Seção Formato */}
          <Text style={styles.fieldLabel}>Formato</Text>
          <View style={styles.radioRow}>
            {/* Opção PDF */}
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setFormatType('pdf')}
            >
              <View style={[styles.radioCircle, formatType === 'pdf' && styles.radioCircleActive]}>
                {formatType === 'pdf' && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.radioText, formatType === 'pdf' && styles.radioTextActive]}>
                PDF
              </Text>
            </TouchableOpacity>

            {/* Opção Excel */}
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setFormatType('excel')}
            >
              <View style={[styles.radioCircle, formatType === 'excel' && styles.radioCircleActive]}>
                {formatType === 'excel' && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.radioText, formatType === 'excel' && styles.radioTextActive]}>
                Excel
              </Text>
            </TouchableOpacity>
          </View>

          {/* Botão Gerar Relatório */}
          <TouchableOpacity style={styles.btnGenerate} onPress={handleGenerateReport}>
            <Text style={styles.btnGenerateText}>Gerar relatório</Text>
          </TouchableOpacity>
        </View>

        {/* Resumo de Indicadores */}
        <Text style={styles.sectionTitle}>Métricas em tempo real</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pendentes</Text>
            <Text style={[styles.metricNumber, styles.textAmber]}>{pendingCount}</Text>
            <Text style={styles.metricSub}>Aguardando revisão</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Aprovadas</Text>
            <Text style={[styles.metricNumber, styles.textGreen]}>{approvedCount}</Text>
            <Text style={styles.metricSub}>Concluídas</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Recusadas</Text>
            <Text style={[styles.metricNumber, styles.textRed]}>{rejectedCount}</Text>
            <Text style={styles.metricSub}>Não abonadas</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Geral</Text>
            <Text style={[styles.metricNumber, styles.textBlue]}>{totalRequests}</Text>
            <Text style={styles.metricSub}>No sistema</Text>
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
    padding: 16,
    paddingBottom: 32,
  },
  filterCard: {
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
    gap: 12,
    marginBottom: 14,
  },
  dateCol: {
    flex: 1,
  },
  inputSubLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInput: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    padding: 0,
  },
  calendarIcon: {
    fontSize: 14,
    marginLeft: 6,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
  },
  dropdownSelector: {
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
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  dropdownChevron: {
    fontSize: 18,
    color: '#0A2540',
    fontWeight: 'bold',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
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
  textAmber: { color: '#D97706' },
  textGreen: { color: '#16A34A' },
  textRed: { color: '#DC2626' },
  textBlue: { color: '#0052CC' },
});