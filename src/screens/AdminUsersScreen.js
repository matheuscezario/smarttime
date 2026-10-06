import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';

const mockUsers = [
  { id: '1', name: 'João Silva', role: 'Analista Comercial', matricula: '10452', sector: 'Comercial', online: true, time: '08:02', mode: '🏠' },
  { id: '2', name: 'Maria Souza', role: 'Assistente Comercial', matricula: '10453', sector: 'Comercial', online: true, time: '08:01', mode: '🏢' },
  { id: '3', name: 'Carlos Lima', role: 'Coordenador Financeiro', matricula: '10454', sector: 'Financeiro', online: true, time: '08:05', mode: '🏢' },
  { id: '4', name: 'Ana Oliveira', role: 'Analista Fiscal', matricula: '10455', sector: 'Financeiro', online: false, time: '--:--', mode: '🏠' },
  { id: '5', name: 'Bruno Santos', role: 'Desenvolvedor Full Stack', matricula: '10456', sector: 'TI', online: true, time: '08:03', mode: '🏠' },
  { id: '6', name: 'Fernanda Costa', role: 'Analista de Suporte', matricula: '10457', sector: 'TI', online: false, time: '--:--', mode: '✉️' },
  { id: '7', name: 'Lucas Martins', role: 'Supervisor de Operações', matricula: '10458', sector: 'Operações', online: true, time: '08:00', mode: '🏢' },
];

export default function AdminUsersScreen({ navigation, route }) {
  const { requests } = useApp();
  const profile = route.params?.profile;
  const canManageUsers =
  profile?.role === 'ADMIN' ||
  profile?.role === 'MANAGER';
const [users, setUsers] = useState([]);
const [pendingCount, setPendingCount] = useState(0);
const [loadingUsers, setLoadingUsers] = useState(true);
  const handleLogout = async () => {
  await supabase.auth.signOut();

  navigation.reset({
    index: 0,
    routes: [{ name: 'Login' }],
  });
};

  const [activeTab, setActiveTab] = useState('todos');
const [search, setSearch] = useState('');

const [selectedSector, setSelectedSector] = useState('todos');
const [sectorSelectorOpen, setSectorSelectorOpen] = useState(false);

useEffect(() => {
  if (!canManageUsers) {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Home',
          params: { profile },
        },
      ],
    });
  }
}, [canManageUsers, navigation, profile]);

useEffect(() => {
  if (!canManageUsers) {
    setLoadingUsers(false);
    return;
  }

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          company_id,
          work_schedule_id,
          full_name,
          role,
          department,
          employee_code,
          allow_home_office,
          allow_external_work,
          active
        `)
        .eq('active', true)
        .order('full_name');

      if (error) {
        console.error('Erro ao buscar usuários:', error);
        return;
      }

      const {
  count: pendingRequestsCount,
  error: pendingRequestsError,
} = await supabase
  .from('adjustment_requests')
  .select('id', {
    count: 'exact',
    head: true,
  })
  .eq('status', 'PENDING');

if (pendingRequestsError) {
  console.error(
    'Erro ao buscar solicitações pendentes:',
    pendingRequestsError
  );
} else {
  setPendingCount(pendingRequestsCount || 0);
}

      const dataHoje = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
}).format(new Date());

const {
  data: workModeAssignments,
  error: workModeError,
} = await supabase
  .from('work_mode_assignments')
  .select('user_id, work_mode')
  .eq('work_date', dataHoje);

if (workModeError) {
  console.error(
    'Erro ao buscar modos de trabalho:',
    workModeError
  );
}

const workModeByUser = Object.fromEntries(
  (workModeAssignments || []).map((assignment) => [
    assignment.user_id,
    assignment.work_mode,
  ])
);

const {
  data: todayEntries,
  error: todayEntriesError,
} = await supabase
  .from('time_entries')
  .select('user_id, entry_type, recorded_at')
  .gte('recorded_at', `${dataHoje}T00:00:00-03:00`)
  .lte('recorded_at', `${dataHoje}T23:59:59-03:00`)
  .order('recorded_at', { ascending: false });

if (todayEntriesError) {
  console.error(
    'Erro ao buscar batidas de hoje:',
    todayEntriesError
  );
}

const latestEntryByUser = {};

(todayEntries || []).forEach((entry) => {
  if (!latestEntryByUser[entry.user_id]) {
    latestEntryByUser[entry.user_id] = entry;
  }
});

      const formattedUsers = (data || [])
        .filter((user) => user.id !== profile?.id)
        .map((user) => {
  const latestEntry = latestEntryByUser[user.id];

  const isOnline =
    Boolean(latestEntry) &&
    latestEntry.entry_type !== 'CLOCK_OUT';

  const latestTime = latestEntry
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(latestEntry.recorded_at))
    : '--:--';

  return {
    id: user.id,
    companyId: user.company_id,
    workScheduleId: user.work_schedule_id,
    allowHomeOffice: user.allow_home_office,
    allowExternalWork: user.allow_external_work,
    name: user.full_name,
    role: user.role,
    matricula: user.employee_code || 'Sem matrícula',
    sector: user.department || 'Sem setor',
    online: isOnline,
    time: latestTime,
    mode:
      workModeByUser[user.id] === 'HOME_OFFICE'
        ? '🏠'
        : workModeByUser[user.id] === 'EXTERNAL'
        ? '🚗'
        : '🏢',
  };
});

      setUsers(formattedUsers);
    } finally {
      setLoadingUsers(false);
    }
  };

  loadUsers();
}, [profile?.id]);

const sectors = [...new Set(users.map((user) => user.sector))]
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b));

  const usersInSelectedSector =
  selectedSector === 'todos'
    ? users
    : users.filter(
        (user) => user.sector === selectedSector
      );

  const filteredUsers = usersInSelectedSector.filter((user) => {
  const matchesSearch =
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.sector.toLowerCase().includes(search.toLowerCase());

  const matchesSector =
    selectedSector === 'todos' ||
    user.sector === selectedSector;

  const matchesStatus =
    activeTab === 'online'
      ? user.online
      : activeTab === 'offline'
      ? !user.online
      : true;

  return matchesSearch && matchesSector && matchesStatus;
});

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleLogout}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usuários por setor</Text>
        <View style={styles.headerRightGroup}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.navigate('AdminReports')}
          >
            <Text style={styles.headerIcon}>📊</Text>
          </TouchableOpacity>
          
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner com Contador Dinâmico */}
        
  <TouchableOpacity
    style={styles.approvalBanner}
    onPress={() => navigation.navigate('AdminApprovals')}
  >
    <View style={styles.approvalBannerLeft}>
      <Text style={styles.approvalBannerIcon}>⏳</Text>

      <View>
        <Text style={styles.approvalBannerTitle}>
  {pendingCount > 0
    ? `${pendingCount} ${
        pendingCount === 1
          ? 'solicitação pendente'
          : 'solicitações pendentes'
      }`
    : 'Solicitações de ajuste'}
</Text>

<Text style={styles.approvalBannerSubtitle}>
  {pendingCount > 0
    ? 'Clique para revisar e aprovar'
    : 'Consulte o histórico de solicitações'}
</Text>
      </View>
    </View>

    <Text style={styles.chevronIcon}>›</Text>
  </TouchableOpacity>

        {/* Seletor de Setor */}
<Text style={styles.filterLabel}>Setor</Text>

<TouchableOpacity
  style={styles.selectorCard}
  onPress={() =>
    setSectorSelectorOpen((currentValue) => !currentValue)
  }
>
  <Text style={styles.selectorText}>
    {selectedSector === 'todos'
      ? 'Todos os setores'
      : selectedSector}
  </Text>

  <Text style={styles.dropdownArrow}>
    {sectorSelectorOpen ? '▲' : '▼'}
  </Text>
</TouchableOpacity>

{sectorSelectorOpen && (
  <View
    style={{
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D9E2EF',
      borderRadius: 12,
      marginTop: 6,
      marginBottom: 12,
      overflow: 'hidden',
    }}
  >
    <TouchableOpacity
      style={{
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor:
          selectedSector === 'todos' ? '#EFF6FF' : '#FFFFFF',
      }}
      onPress={() => {
        setSelectedSector('todos');
        setSectorSelectorOpen(false);
      }}
    >
      <Text
        style={{
          color:
            selectedSector === 'todos' ? '#1D4ED8' : '#334155',
          fontWeight:
            selectedSector === 'todos' ? '700' : '500',
        }}
      >
        Todos os setores
      </Text>
    </TouchableOpacity>

    {sectors.map((sector) => (
      <TouchableOpacity
        key={sector}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          backgroundColor:
            selectedSector === sector ? '#EFF6FF' : '#FFFFFF',
        }}
        onPress={() => {
          setSelectedSector(sector);
          setSectorSelectorOpen(false);
        }}
      >
        <Text
          style={{
            color:
              selectedSector === sector ? '#1D4ED8' : '#334155',
            fontWeight:
              selectedSector === sector ? '700' : '500',
          }}
        >
          {sector}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
)}

        {/* Campo de Busca */}
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar colaborador..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          <Text style={styles.searchIcon}>🔍</Text>
        </View>

        {/* Abas de Filtro */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'todos' && styles.tabButtonActive]}
            onPress={() => setActiveTab('todos')}
          >
            <Text style={[styles.tabText, activeTab === 'todos' && styles.tabTextActive]}>
              Todos ({usersInSelectedSector.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'online' && styles.tabButtonActive]}
            onPress={() => setActiveTab('online')}
          >
            <Text style={[styles.tabText, activeTab === 'online' && styles.tabTextActive]}>
              Online ({usersInSelectedSector.filter((user) => user.online).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'offline' && styles.tabButtonActive]}
            onPress={() => setActiveTab('offline')}
          >
            <Text style={[styles.tabText, activeTab === 'offline' && styles.tabTextActive]}>
              Offline ({usersInSelectedSector.filter((user) => !user.online).length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Colaboradores */}
        <View style={styles.usersList}>
          {filteredUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              onPress={() => navigation.navigate('AdminUserDetail', { user })}
            >
              <View style={styles.userLeft}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>
                    {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.userNameText}>{user.name}</Text>
                  <Text style={styles.userSectorText}>{user.sector}</Text>
                </View>
              </View>

              <View style={styles.userRight}>
                <View style={[styles.statusDot, user.online ? styles.dotGreen : styles.dotRed]} />
                <Text style={[styles.timeText, !user.online && styles.timeTextOffline]}>
                  {user.time}
                </Text>
                <Text style={styles.modeIconText}>{user.mode}</Text>
              </View>
            </TouchableOpacity>
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerIconButton: {
    padding: 6,
  },
  backButtonText: {
    fontSize: 28,
    color: '#1E293B',
    fontWeight: '300',
  },
  headerIcon: {
    fontSize: 20,
    color: '#1E293B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrollContent: {
  width: '100%',
  maxWidth: 1000,
  alignSelf: 'center',
  padding: 16,
  paddingBottom: 32,
},
  approvalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  approvalBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  approvalBannerIcon: {
    fontSize: 20,
  },
  approvalBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  approvalBannerSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
  },
  chevronIcon: {
    fontSize: 18,
    color: '#1D4ED8',
  },
  filterLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '600',
  },
  selectorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  selectorText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#64748B',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0F172A',
  },
  searchIcon: {
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  usersList: {
    gap: 8,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  userNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  userSectorText: {
    fontSize: 12,
    color: '#64748B',
  },
  userRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#16A34A',
  },
  dotRed: {
    backgroundColor: '#DC2626',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  timeTextOffline: {
    color: '#94A3B8',
  },
  modeIconText: {
    fontSize: 14,
    marginLeft: 4,
  },
});