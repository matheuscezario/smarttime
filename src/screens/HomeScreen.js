import React, { useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { useApp } from '../context/AppContext';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation, route }) {
  const { todayPunches, recordPunch } = useApp();
  const profile = route.params?.profile;
  const isManager = profile?.role === 'MANAGER';
  const permiteHomeOffice = profile?.allow_home_office === true;
const displayName = profile?.full_name || 'Funcionário';
const initials = displayName
  .split(' ')
  .map((name) => name[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isRecording, setIsRecording] = useState(false);
  const [sedeEmpresa, setSedeEmpresa] = useState(null);
const [distanciaDaSede, setDistanciaDaSede] = useState(null);
const [dentroDaArea, setDentroDaArea] = useState(false);
  const [assignedWorkMode, setAssignedWorkMode] = useState('base');
// 'base' | 'home' | 'externo'

const [notifications, setNotifications] = useState([]);
const [unreadNotifications, setUnreadNotifications] =
  useState(0);
const [notificationsVisible, setNotificationsVisible] =
  useState(false);

const [managerMenuVisible, setManagerMenuVisible] =
  useState(false);

const notificationsStorageKey =
  `@smarttime:seen_notifications:${profile?.id || 'user'}`;

const loadNotifications = async () => {
  if (!profile?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from('adjustment_requests')
    .select(
  'id, requested_date, request_type, requested_punches, status, created_at'
)
    .eq('user_id', profile.id)
    .in('status', ['APPROVED', 'REJECTED'])
    .order('created_at', {
      ascending: false,
    })
    .limit(20);

  if (error) {
    console.error(
      'Erro ao carregar notificações:',
      error
    );

    return [];
  }

  const notificationRows = data || [];

  setNotifications(notificationRows);

  const savedIds = await AsyncStorage.getItem(
    notificationsStorageKey
  );

  const seenIds = savedIds
    ? JSON.parse(savedIds)
    : [];

  const unread = notificationRows.filter(
    (item) => !seenIds.includes(item.id)
  ).length;

  setUnreadNotifications(unread);

  return notificationRows;
};

const handleOpenNotifications = async () => {
  const notificationRows =
    await loadNotifications();

  setNotificationsVisible(true);

  const notificationIds =
    notificationRows.map((item) => item.id);

  await AsyncStorage.setItem(
    notificationsStorageKey,
    JSON.stringify(notificationIds)
  );

  setUnreadNotifications(0);
};

const handleNotificationPress = (notification) => {
  setNotificationsVisible(false);

  if (notification.status === 'APPROVED') {
    navigation.navigate('History', {
      profile,
    });

    return;
  }

  const entryTypes = [
    'CLOCK_IN',
    'LUNCH_OUT',
    'LUNCH_IN',
    'CLOCK_OUT',
  ];

  const notificationPunches = entryTypes.map(
    (entryType) => {
      const requestedPunch =
        notification.requested_punches?.find(
          (punch) =>
            punch.entry_type === entryType
        );

      return (
        requestedPunch?.requested_time ||
        '--:--'
      );
    }
  );

  const [year, month, day] =
    notification.requested_date.split('-');

  navigation.navigate('Adjustment', {
    requestedDate:
      notification.requested_date,
    dateLabel: `${day}/${month}/${year}`,
    punches: notificationPunches,
  });
};

useEffect(() => {
  loadNotifications();

  const notificationTimer = setInterval(
    loadNotifications,
    30000
  );

  return () => {
    clearInterval(notificationTimer);
  };
}, [profile?.id]);

useEffect(() => {
  const carregarModoTrabalho = async () => {
    if (!profile?.id) {
      return;
    }

    const dataHoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());

    const { data, error } = await supabase
      .from('work_mode_assignments')
      .select('work_mode')
      .eq('user_id', profile.id)
      .eq('work_date', dataHoje)
      .maybeSingle();

    if (error) {
      Alert.alert(
        'Erro',
        'Não foi possível carregar o modo de trabalho.'
      );
      return;
    }

    const modos = {
      BASE: 'base',
      HOME_OFFICE: 'home',
      EXTERNAL: 'externo',
    };

    setAssignedWorkMode(modos[data?.work_mode] || 'base');
  };

  carregarModoTrabalho();
}, [profile?.id]);

  const calcularDistanciaEmMetros = (
  latitudeUsuario,
  longitudeUsuario,
  latitudeSede,
  longitudeSede
) => {
  const raioTerra = 6371000;

  const converterParaRadianos = (valor) =>
    (valor * Math.PI) / 180;

  const diferencaLatitude = converterParaRadianos(
    latitudeSede - latitudeUsuario
  );

  const diferencaLongitude = converterParaRadianos(
    longitudeSede - longitudeUsuario
  );

  const a =
    Math.sin(diferencaLatitude / 2) ** 2 +
    Math.cos(converterParaRadianos(latitudeUsuario)) *
      Math.cos(converterParaRadianos(latitudeSede)) *
      Math.sin(diferencaLongitude / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return raioTerra * c;
};

useEffect(() => {
  const carregarSedeEmpresa = async () => {
    const { data, error } = await supabase
      .from('work_locations')
      .select(
        'id, name, latitude, longitude, radius_meters, address'
      )
      .eq('active', true)
      .eq('type', 'COMPANY')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar sede:', error);
      return;
    }

    setSedeEmpresa(data);
  };

  carregarSedeEmpresa();
}, []);

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Relógio em tempo real
useEffect(() => {
  const timer = setInterval(() => setCurrentDate(new Date()), 1000);
  return () => clearInterval(timer);
}, []);

// Buscar as batidas registradas hoje
useEffect(() => {
  const loadTodayPunches = async () => {
    if (!profile?.id) {
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const { data, error } = await supabase
      .from('time_entries')
      .select('entry_type, recorded_at')
      .eq('user_id', profile.id)
      .gte('recorded_at', startOfDay.toISOString())
      .lt('recorded_at', endOfDay.toISOString())
      .order('recorded_at');

    if (error) {
      console.error('Erro ao buscar batidas:', error);
      return;
    }

    const entryIndexes = {
      CLOCK_IN: 0,
      LUNCH_OUT: 1,
      LUNCH_IN: 2,
      CLOCK_OUT: 3,
    };

    (data || []).forEach((entry) => {
      const index = entryIndexes[entry.entry_type];

      if (index !== undefined) {
        const formattedTime = new Date(entry.recorded_at)
          .toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });

        recordPunch(index, formattedTime);
      }
    });
  };

  loadTodayPunches();
}, [profile?.id]);

const formatTime = (date) => {
  return date.toLocaleTimeString('pt-BR', { hour12: false });
};

  const formatDate = (date) => {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const str = date.toLocaleDateString('pt-BR', options);
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleLogout = async () => {
  await supabase.auth.signOut();

  navigation.reset({
    index: 0,
    routes: [{ name: 'Login' }],
  });
};

  // Identifica a próxima batida pendente na ordem
  const nextPunchIndex = todayPunches.findIndex((p) => p.time === null);

  const handleRegisterPunch = async (index) => {
    
  if (isRecording) {
    return;
  }

  try {
    setIsRecording(true);

    if (!sedeEmpresa) {
      Alert.alert(
        'Sede não carregada',
        'Aguarde alguns segundos e tente novamente.'
      );
      return;
    }

    const { status } =
      await Location.requestForegroundPermissionsAsync();
      

    if (status !== 'granted') {
      Alert.alert(
        'Localização necessária',
        'Permita o acesso à localização para registrar o ponto.'
      );
      return;
    }

    const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.High,
});

    

    const distancia = calcularDistanciaEmMetros(
      location.coords.latitude,
      location.coords.longitude,
      Number(sedeEmpresa.latitude),
      Number(sedeEmpresa.longitude)
    );

    const estaDentro =
      distancia <= Number(sedeEmpresa.radius_meters);

    setDistanciaDaSede(Math.round(distancia));
    setDentroDaArea(estaDentro);

    if (assignedWorkMode === 'base' && !estaDentro) {
  const mensagem =
    `Você está fora da área da sede. ` +
    `O limite permitido é de ${sedeEmpresa.radius_meters} metros.`;

  if (Platform.OS === 'web') {
    window.alert(`Fora da área permitida\n\n${mensagem}`);
  } else {
    Alert.alert('Fora da área permitida', mensagem);
  }

  return;
}

    const now = new Date();

    const entryTypes = [
      'CLOCK_IN',
      'LUNCH_OUT',
      'LUNCH_IN',
      'CLOCK_OUT',
    ];

    const { error } = await supabase.from('time_entries').insert({
      user_id: profile.id,
      entry_type: entryTypes[index],
      recorded_at: now.toISOString(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy_meters: location.coords.accuracy,
      within_geofence: estaDentro,
      location_type:
  assignedWorkMode === 'home'
    ? 'HOME_OFFICE'
    : assignedWorkMode === 'externo'
    ? 'EXTERNAL'
    : 'COMPANY',
      created_offline: false,
      sync_status: 'SYNCED',
    });

    if (error) {
      throw error;
    }

    const formattedTime = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    recordPunch(index, formattedTime);

    Alert.alert(
      'Ponto registrado',
      `${todayPunches[index].type} às ${formattedTime}.`
    );
  } catch (error) {
    console.error('Erro ao registrar ponto:', error);

    const mensagemErro =
  'Verifique a conexão e a permissão de localização.';

if (Platform.OS === 'web') {
  window.alert(
    `Não foi possível registrar\n\n${mensagemErro}`
  );
} else {
  Alert.alert(
    'Não foi possível registrar',
    mensagemErro
  );
}
  } finally {
    setIsRecording(false);
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cabeçalho Superior */}
        <View style={styles.topHeader}>
          <View style={styles.headerBar}>
            <View style={styles.headerSideSpace} />
            {isManager ? (
  <TouchableOpacity
    style={styles.managerMenuButton}
    onPress={() =>
      setManagerMenuVisible(true)
    }
  >
    <Text style={styles.managerMenuIcon}>
      ☰
    </Text>
  </TouchableOpacity>
) : (
  <View style={styles.headerSideSpace} />
)}
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <TouchableOpacity
  style={styles.notificationButton}
  onPress={handleOpenNotifications}
>
  <Text style={styles.bellIcon}>🔔</Text>

  {unreadNotifications > 0 && (
    <View style={styles.notificationBadge}>
      <Text style={styles.notificationBadgeText}>
        {unreadNotifications > 9
          ? '9+'
          : unreadNotifications}
      </Text>
    </View>
  )}
</TouchableOpacity>
          </View>

          <View style={styles.greetingContainer}>
            <Text style={styles.greetingTitle}>Olá, {displayName}! 👋</Text>
            <Text style={styles.greetingSubtitle}>Tenha um ótimo dia de trabalho!</Text>
          </View>
        </View>

        {/* Card Principal */}
        <View style={styles.mainCard}>
          <Text style={styles.timeLabel}>Horário de Brasília</Text>
          <Text style={styles.clockText}>{formatTime(currentDate)}</Text>
          <Text style={styles.dateText}>{formatDate(currentDate)}</Text>

          {/* Status */}
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Você está conectado</Text>
          </View>

          {/* Localização */}
<View style={styles.locationContainer}>
  <Text style={styles.locationIcon}>📍</Text>

  <Text style={styles.locationText}>
    {assignedWorkMode === 'home'
      ? 'Home Office autorizado'
      : assignedWorkMode === 'externo'
      ? 'Trabalho externo autorizado'
      : distanciaDaSede === null
      ? 'Localização ainda não verificada'
      : dentroDaArea
      ? 'Dentro da área da empresa'
      : 'Fora da área da empresa'}
  </Text>
</View>

          {/* Modo de Trabalho */}
          <View style={styles.workModeSection}>
            <View style={styles.workModeHeader}>
              <Text style={styles.workModeTitle}>Modo de Trabalho</Text>
              <Text style={styles.workModeNotice}>🔒 Definido pelo Gestor</Text>
            </View>

            <View style={styles.workModeSelector}>
              <View
                style={[
                  styles.modeTab,
                  assignedWorkMode === 'base' ? styles.modeTabActive : styles.modeTabDisabled,
                ]}
              >
                <Text style={styles.modeIcon}>🏢</Text>
                <Text
                  style={[
                    styles.modeLabel,
                    assignedWorkMode === 'base' ? styles.modeLabelActive : styles.modeLabelDisabled,
                  ]}
                >
                  Base (Presencial)
                </Text>
              </View>

              <View
                style={[
                  styles.modeTab,
                  assignedWorkMode === 'home' ? styles.modeTabActive : styles.modeTabDisabled,
                ]}
              >
                <Text style={styles.modeIcon}>🏠</Text>
                <Text
                  style={[
                    styles.modeLabel,
                    assignedWorkMode === 'home' ? styles.modeLabelActive : styles.modeLabelDisabled,
                  ]}
                >
                  Home Office
                </Text>
              </View>

              <View
                style={[
                  styles.modeTab,
                  assignedWorkMode === 'externo' ? styles.modeTabActive : styles.modeTabDisabled,
                ]}
              >
                <Text style={styles.modeIcon}>🚗</Text>
                <Text
                  style={[
                    styles.modeLabel,
                    assignedWorkMode === 'externo' ? styles.modeLabelActive : styles.modeLabelDisabled,
                  ]}
                >
                  Trabalho Externo
                </Text>
              </View>
            </View>
          </View>

          {/* Resumo do Expediente */}
          <View style={styles.progressSection}>
            <Text style={styles.progressText}>
              {nextPunchIndex === -1
                ? 'Jornada diária concluída!'
                : `Próximo registro: ${todayPunches[nextPunchIndex].type}`}
            </Text>
            <Text style={styles.progressHours}>
              {todayPunches.filter((p) => p.time !== null).length} de 4 batidas
            </Text>
          </View>

          {/* Grid Interativo com Dados Globais */}
          <View style={styles.punchGrid}>
            {todayPunches.map((item, index) => {
              const isRecorded = item.time !== null;
              const isCurrent = index === nextPunchIndex;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.punchCard,
                    isRecorded && styles.punchCardRecorded,
                    isCurrent && styles.punchCardCurrent,
                  ]}
                >
                  <Text style={styles.punchIcon}>{item.icon}</Text>
                  <Text style={styles.punchType}>{item.type}</Text>

                  {isRecorded ? (
                    <Text style={styles.punchTimeRecorded}>{item.time}</Text>
                  ) : isCurrent ? (
                    <TouchableOpacity
                      style={styles.btnPunchAction}
                      onPress={() => handleRegisterPunch(index)}
                    >
                      <Text style={styles.btnPunchActionText}>Bater Ponto</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.punchTimePending}>--:--</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Rodapé */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() =>
  navigation.navigate('History', {
    profile,
  })
}
          >
            <Text style={styles.footerBtnIcon}>🕒</Text>
            <Text style={styles.footerBtnText}>Histórico</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => navigation.navigate('BankHours')}
          >
            <Text style={styles.footerBtnIcon}>📊</Text>
            <Text style={styles.footerBtnText}>Banco</Text>
          </TouchableOpacity>

          <TouchableOpacity
  style={styles.footerBtn}
  onPress={handleLogout}
>
            <Text style={styles.footerBtnIcon}>🚪</Text>
            <Text style={styles.footerBtnText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
  visible={managerMenuVisible}
  transparent
  animationType="fade"
  onRequestClose={() =>
    setManagerMenuVisible(false)
  }
>
  <View style={styles.managerMenuOverlay}>
    <TouchableOpacity
      style={styles.managerMenuBackdrop}
      activeOpacity={1}
      onPress={() =>
        setManagerMenuVisible(false)
      }
    />

    <View style={styles.managerMenuPanel}>
      <View style={styles.managerMenuHeader}>
        <View style={styles.managerMenuAvatar}>
          <Text style={styles.managerMenuAvatarText}>
            {initials}
          </Text>
        </View>

        <View style={styles.managerMenuUserInfo}>
          <Text style={styles.managerMenuName}>
            {displayName}
          </Text>

          <Text style={styles.managerMenuRole}>
            Gerente • {profile?.department}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() =>
            setManagerMenuVisible(false)
          }
        >
          <Text style={styles.managerMenuClose}>
            ✕
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.managerMenuItem}
        onPress={() =>
          setManagerMenuVisible(false)
        }
      >
        <Text style={styles.managerMenuItemIcon}>
          🕒
        </Text>

        <Text style={styles.managerMenuItemText}>
          Meu ponto
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.managerMenuItem}
        onPress={() => {
          setManagerMenuVisible(false);

          navigation.navigate('AdminUsers', {
            profile,
          });
        }}
      >
        <Text style={styles.managerMenuItemIcon}>
          👥
        </Text>

        <Text style={styles.managerMenuItemText}>
          Usuários do setor
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.managerMenuItem}
        onPress={() => {
          setManagerMenuVisible(false);

          navigation.navigate(
            'AdminApprovals'
          );
        }}
      >
        <Text style={styles.managerMenuItemIcon}>
          ✅
        </Text>

        <Text style={styles.managerMenuItemText}>
          Solicitações de ajuste
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.managerMenuItem}
        onPress={() => {
          setManagerMenuVisible(false);

          navigation.navigate(
            'AdminReports'
          );
        }}
      >
        <Text style={styles.managerMenuItemIcon}>
          📊
        </Text>

        <Text style={styles.managerMenuItemText}>
          Relatórios do setor
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.managerMenuItem,
          styles.managerMenuLogout,
        ]}
        onPress={() => {
          setManagerMenuVisible(false);
          handleLogout();
        }}
      >
        <Text style={styles.managerMenuItemIcon}>
          🚪
        </Text>

        <Text style={styles.managerMenuLogoutText}>
          Sair
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

<Modal
  visible={notificationsVisible}
  transparent
  animationType="fade"
  onRequestClose={() =>
    setNotificationsVisible(false)
  }
>
  <View style={styles.notificationOverlay}>
    <View style={styles.notificationModal}>
      <View style={styles.notificationModalHeader}>
        <Text style={styles.notificationModalTitle}>
          Notificações
        </Text>

        <TouchableOpacity
          onPress={() =>
            setNotificationsVisible(false)
          }
        >
          <Text style={styles.notificationClose}>
            ✕
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.notificationList}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <Text style={styles.emptyNotificationText}>
            Nenhuma notificação disponível.
          </Text>
        ) : (
          notifications.map((item) => {
            const approved =
              item.status === 'APPROVED';

            const dateParts =
              item.requested_date.split('-');

            const formattedDate =
              `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

            return (
  <TouchableOpacity
    key={item.id}
    style={styles.notificationItem}
    onPress={() =>
      handleNotificationPress(item)
    }
  >
    <View
      style={[
        styles.notificationStatusIcon,
        approved
          ? styles.notificationApproved
          : styles.notificationRejected,
      ]}
    >
      <Text
        style={styles.notificationStatusIconText}
      >
        {approved ? '✓' : '✕'}
      </Text>
    </View>

    <View style={{ flex: 1 }}>
      <Text style={styles.notificationItemTitle}>
        Solicitação {approved
          ? 'aprovada'
          : 'recusada'}
      </Text>

      <Text style={styles.notificationItemText}>
        Ajuste referente a {formattedDate}
      </Text>

      <Text style={styles.notificationActionText}>
        {approved
          ? 'Ver no histórico'
          : 'Corrigir e reenviar'}
      </Text>
    </View>

    <Text style={styles.notificationChevron}>
      ›
    </Text>
  </TouchableOpacity>
);
          })
        )}
      </ScrollView>
    </View>
  </View>
</Modal>

</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
  width: '100%',
  maxWidth: 1000,
  alignSelf: 'center',
  paddingBottom: 24,
},
headerSideSpace: {
  position: 'absolute',
  left: 0,
  width: 40,
  height: 40,
},
  topHeader: {
    backgroundColor: '#1E40AF',
    paddingTop: 16,
    paddingBottom: 36,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerBar: {
  position: 'relative',
  width: '100%',
  height: 44,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 16,
},
  menuButton: {
    padding: 6,
  },
  menuIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  notificationButton: {
  position: 'absolute',
  right: 0,
  width: 40,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
},

notificationBadge: {
  position: 'absolute',
  top: -2,
  right: -3,
  minWidth: 17,
  height: 17,
  borderRadius: 9,
  paddingHorizontal: 4,
  backgroundColor: '#DC2626',
  borderWidth: 2,
  borderColor: '#1E40AF',
  justifyContent: 'center',
  alignItems: 'center',
},

notificationBadgeText: {
  color: '#FFFFFF',
  fontSize: 9,
  fontWeight: '800',
},
  bellIcon: {
    fontSize: 20,
  },
  greetingContainer: {
    alignItems: 'center',
  },
  greetingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  greetingSubtitle: {
    color: '#BFDBFE',
    fontSize: 14,
    marginTop: 2,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  timeLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  clockText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  workModeSection: {
    width: '100%',
    marginBottom: 20,
  },
  workModeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workModeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  workModeNotice: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  workModeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#1D4ED8',
  },
  modeTabDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.55,
  },
  modeIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  modeLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modeLabelDisabled: {
    color: '#64748B',
  },
  progressSection: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
  },
  progressText: {
    fontSize: 11,
    color: '#1E293B',
    fontWeight: '600',
  },
  progressHours: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  punchGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  punchCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  punchCardRecorded: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  punchCardCurrent: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    borderWidth: 1.5,
  },
  punchIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  punchType: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  punchTimeRecorded: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16A34A',
  },
  punchTimePending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  btnPunchAction: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 2,
  },
  btnPunchActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  footerBtnIcon: {
    fontSize: 15,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  notificationOverlay: {
  flex: 1,
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},

notificationModal: {
  width: '100%',
  maxWidth: 420,
  maxHeight: '75%',
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 18,
},

notificationModalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: 14,
  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
},

notificationModalTitle: {
  fontSize: 18,
  fontWeight: '800',
  color: '#0F172A',
},

notificationClose: {
  fontSize: 18,
  color: '#64748B',
  padding: 4,
},

notificationList: {
  marginTop: 8,
},

notificationItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
},

notificationStatusIcon: {
  width: 34,
  height: 34,
  borderRadius: 17,
  justifyContent: 'center',
  alignItems: 'center',
},

notificationApproved: {
  backgroundColor: '#DCFCE7',
},

notificationRejected: {
  backgroundColor: '#FEE2E2',
},

notificationStatusIconText: {
  fontSize: 16,
  fontWeight: '800',
  color: '#0F172A',
},

notificationItemTitle: {
  fontSize: 14,
  fontWeight: '700',
  color: '#0F172A',
},

notificationItemText: {
  fontSize: 12,
  color: '#64748B',
  marginTop: 3,
},

notificationActionText: {
  fontSize: 11,
  color: '#1D4ED8',
  fontWeight: '700',
  marginTop: 5,
},

notificationChevron: {
  fontSize: 24,
  color: '#94A3B8',
  marginLeft: 8,
},

emptyNotificationText: {
  textAlign: 'center',
  color: '#64748B',
  paddingVertical: 30,
},
managerMenuButton: {
  position: 'absolute',
  left: 0,
  width: 40,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
},

managerMenuIcon: {
  color: '#FFFFFF',
  fontSize: 25,
  fontWeight: '700',
},
managerMenuOverlay: {
  flex: 1,
  backgroundColor: 'rgba(15, 23, 42, 0.45)',
},

managerMenuBackdrop: {
  ...StyleSheet.absoluteFillObject,
},

managerMenuPanel: {
  width: '82%',
  maxWidth: 340,
  height: '100%',
  backgroundColor: '#FFFFFF',
  paddingTop: 28,
  paddingHorizontal: 18,
  shadowColor: '#000000',
  shadowOffset: {
    width: 4,
    height: 0,
  },
  shadowOpacity: 0.2,
  shadowRadius: 12,
  elevation: 10,
},

managerMenuHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingBottom: 20,
  marginBottom: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
},

managerMenuAvatar: {
  width: 42,
  height: 42,
  borderRadius: 21,
  backgroundColor: '#1D4ED8',
  justifyContent: 'center',
  alignItems: 'center',
},

managerMenuAvatarText: {
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: '800',
},

managerMenuUserInfo: {
  flex: 1,
  marginLeft: 10,
},

managerMenuName: {
  fontSize: 14,
  fontWeight: '700',
  color: '#0F172A',
},

managerMenuRole: {
  fontSize: 11,
  color: '#64748B',
  marginTop: 2,
},

managerMenuClose: {
  fontSize: 18,
  color: '#64748B',
  padding: 6,
},

managerMenuItem: {
  flexDirection: 'row',
  alignItems: 'center',
  minHeight: 52,
  paddingHorizontal: 10,
  borderRadius: 9,
  marginBottom: 5,
},

managerMenuItemIcon: {
  width: 30,
  fontSize: 18,
},

managerMenuItemText: {
  fontSize: 14,
  color: '#1E293B',
  fontWeight: '600',
},

managerMenuLogout: {
  marginTop: 12,
  borderTopWidth: 1,
  borderTopColor: '#E2E8F0',
  borderRadius: 0,
},

managerMenuLogoutText: {
  fontSize: 14,
  color: '#DC2626',
  fontWeight: '700',
},
});