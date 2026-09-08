import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';

const userHistoryMock = [
  { id: '1', date: 'Hoje (17/05)', entries: ['08:01', '12:00', '13:00', '17:32'], total: '08h 00m', ok: true },
  { id: '2', date: 'Ontem (16/05)', entries: ['07:58', '12:00', '13:00', '17:28'], total: '08h 00m', ok: true },
  { id: '3', date: '15/05/2024', entries: ['08:05', '12:10', '--:--', '--:--'], total: '04h 15m', ok: false },
  { id: '4', date: '14/05/2024', entries: ['08:00', '12:00', '13:00', '17:30'], total: '08h 00m', ok: true },
];

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

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

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

          <View style={[styles.statusBadge, !user.online && styles.statusBadgeOffline]}>
            <View style={[styles.statusDot, !user.online && styles.statusDotOffline]} />
            <Text style={[styles.statusBadgeText, !user.online && styles.statusBadgeTextOffline]}>
              {user.online ? `Online • Entrada às ${user.time}` : 'Offline • Sem registro'}
            </Text>
          </View>
        </View>

        {/* Indicadores Rápidos */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Horas (Mês)</Text>
            <Text style={styles.kpiValue}>154h 20m</Text>
            <Text style={styles.kpiSub}>Meta: 168h</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Banco de Horas</Text>
            <Text style={[styles.kpiValue, styles.textGreen]}>+06:45</Text>
            <Text style={styles.kpiSub}>Positivo</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pendências</Text>
            <Text style={[styles.kpiValue, styles.textRed]}>1</Text>
            <Text style={styles.kpiSub}>Ajuste pendente</Text>
          </View>
        </View>

        {/* Ações Rápidas do Gestor */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => navigation.navigate('Adjustment')}
          >
            <Text style={styles.actionBtnPrimaryText}>Ver Solicitação de Ajuste</Text>
          </TouchableOpacity>
        </View>

        {/* Últimas Marcações */}
        <Text style={styles.sectionTitle}>Últimas marcações registradas</Text>
        <View style={styles.historyList}>
          {userHistoryMock.map((item) => (
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
});