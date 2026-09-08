import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useApp } from '../context/AppContext';

export default function BankHoursScreen({ navigation }) {
  const { historyData, todayPunches } = useApp();
  const [activeTab, setActiveTab] = useState('todos'); // 'todos' | 'credito' | 'debito'

  // Identifica batidas de hoje para o extrato dinâmico
  const recordedTodayCount = todayPunches.filter((p) => p.time !== null).length;

  const transactions = [
    {
      id: 'today',
      date: 'Hoje (17/05)',
      description: recordedTodayCount === 4 ? 'Jornada cumprida integralmente' : 'Jornada em andamento',
      hours: recordedTodayCount === 4 ? '+00:00' : '-02:00',
      type: recordedTodayCount === 4 ? 'neutral' : 'negative',
    },
    ...historyData.map((item) => ({
      id: item.id,
      date: item.day,
      description: item.isIncomplete ? 'Jornada incompleta (solicitação pendente)' : 'Jornada regular diária',
      hours: item.isIncomplete ? '-03:45' : '+00:15',
      type: item.isIncomplete ? 'negative' : 'positive',
    })),
  ];

  const filteredTransactions = transactions.filter((t) => {
    if (activeTab === 'credito') return t.type === 'positive';
    if (activeTab === 'debito') return t.type === 'negative';
    return true;
  });

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
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo acumulado</Text>
          <Text style={styles.balanceValue}>+04h 30m</Text>
          <Text style={styles.balancePeriod}>Período de apuração: Maio / 2024</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Horas Positivas</Text>
              <Text style={styles.statPositive}>+08h 15m</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Horas Negativas</Text>
              <Text style={styles.statNegative}>-03h 45m</Text>
            </View>
          </View>
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
          {filteredTransactions.map((item) => (
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
                  <Text style={styles.transactionDate}>{item.date}</Text>
                  <Text style={styles.transactionDesc}>{item.description}</Text>
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