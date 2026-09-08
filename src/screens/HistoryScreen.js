import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
} from 'react-native';
import * as Print from 'expo-print';
import { useApp } from '../context/AppContext';

export default function HistoryScreen({ navigation }) {
  const { todayPunches, historyData } = useApp();
  const [selectedMonth, setSelectedMonth] = useState('Maio / 2024');
  const [previewVisible, setPreviewVisible] = useState(false);

  const todayEntries = todayPunches.map((p) => p.time || '--:--');
  const recordedCount = todayPunches.filter((p) => p.time !== null).length;

  const handleConfirmDownload = async () => {
    try {
      const rowsHtml = [
        `
        <tr style="background-color: #EFF6FF; font-weight: bold;">
          <td>Hoje</td>
          <td>${todayEntries[0]}</td>
          <td>${todayEntries[1]}</td>
          <td>${todayEntries[2]}</td>
          <td>${todayEntries[3]}</td>
          <td>${recordedCount * 2}h</td>
        </tr>
        `,
        ...historyData.map(
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
          <h2>SMARTTIME SOLUÇÕES CORPORATIVAS</h2>
          <p>CNPJ: 00.123.456/0001-99 • Folha de Espelho de Ponto</p>
          <div class="divider"></div>
          <p><strong>Colaborador:</strong> Maria Souza</p>
          <p><strong>Cargo:</strong> Assistente Comercial • <strong>Matrícula:</strong> 10453</p>
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

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      alert(`PDF gerado com sucesso!\nArquivo salvo em: ${uri}`);
      setPreviewVisible(false);
    } catch (error) {
      alert('Erro ao gerar o PDF. Verifique o console para mais detalhes.');
      console.error(error);
    }
  };

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
          <TouchableOpacity style={styles.monthArrowButton}>
            <Text style={styles.monthArrow}>‹</Text>
          </TouchableOpacity>
          <View style={styles.monthCenter}>
            <Text style={styles.calendarIcon}>📅</Text>
            <Text style={styles.monthText}>{selectedMonth}</Text>
          </View>
          <TouchableOpacity style={styles.monthArrowButton}>
            <Text style={styles.monthArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Hoje em tempo real</Text>
        <View style={[styles.dayCard, styles.todayCard]}>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.dayText}>Hoje (Em andamento)</Text>
              <Text style={styles.todaySubText}>{recordedCount} de 4 batidas registradas</Text>
            </View>
            <View style={[styles.statusBadge, recordedCount === 4 ? styles.badgeSuccess : styles.badgeProgress]}>
              <Text style={[styles.statusBadgeText, recordedCount === 4 ? styles.textSuccess : styles.textProgress]}>
                {recordedCount === 4 ? 'Completo' : 'Em curso'}
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
            <Text style={styles.totalHoursText}>Total: {recordedCount * 2}h (estimado)</Text>
            {recordedCount < 4 && (
              <TouchableOpacity
                style={styles.btnAdjust}
                onPress={() => navigation.navigate('Adjustment')}
              >
                <Text style={styles.btnAdjustText}>Solicitar ajuste</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.sectionHeader}>Dias anteriores</Text>
        <View style={styles.historyList}>
          {historyData.map((item) => (
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
                    style={styles.btnAdjust}
                    onPress={() => navigation.navigate('Adjustment')}
                  >
                    <Text style={styles.btnAdjustText}>Solicitar ajuste</Text>
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
                <Text style={styles.sheetCompany}>SMARTTIME SOLUÇÕES CORPORATIVAS</Text>
                <Text style={styles.sheetSub}>CNPJ: 00.123.456/0001-99 • Emissão: 17/05/2024</Text>
                <View style={styles.sheetDivider} />
                <Text style={styles.sheetWorker}>Colaborador: Maria Souza</Text>
                <Text style={styles.sheetMeta}>Cargo: Assistente Comercial • Matrícula: 10453</Text>
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

                <View style={[styles.tableRow, styles.rowToday]}>
                  <Text style={[styles.tableCol, styles.colDay, styles.boldCol]}>Hoje</Text>
                  {todayEntries.map((p, i) => (
                    <Text key={i} style={[styles.tableCol, p === '--:--' && styles.redCol]}>
                      {p}
                    </Text>
                  ))}
                  <Text style={[styles.tableCol, styles.colTotal, styles.boldCol]}>
                    {recordedCount * 2}h
                  </Text>
                </View>

                {historyData.map((item) => (
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