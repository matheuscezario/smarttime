import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking,
} from 'react-native';
import { supabase } from '../services/supabase';

export default function AdminApprovalsScreen({ navigation }) {
  const [realRequests, setRealRequests] = useState([]);
  const [
  processingRequestId,
  setProcessingRequestId,
] = useState(null);
const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected'

  useEffect(() => {
  const loadRequests = async () => {
    try {
      setIsLoadingRequests(true);

      const { data, error } = await supabase
        .from('adjustment_requests')
        .select(`
          id,
          user_id,
          request_type,
          requested_date,
          requested_time,
          requested_punches,
          reason,
          attachment_url,
          status,
          created_at,
          user:profiles!adjustment_requests_user_id_fkey (
            full_name,
            department
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const formattedRequests = (data || []).map(
        (request) => ({
          id: request.id,
          userId: request.user_id,
          requestedDate: request.requested_date,
          requestType: request.request_type,
          name: request.user?.full_name || 'Funcionário',
          sector: request.user?.department || 'Sem setor',
          date: request.requested_date
            .split('-')
            .reverse()
            .join('/'),
          type:
            request.request_type === 'TIME_CORRECTION'
              ? 'Completar/Corrigir marcações'
              : 'Abono de período',
          requestedPunches:
  request.requested_punches || [],

time:
  (request.requested_punches || [])
    .map(
      (punch) =>
        `${punch.label.replace(
          ' (Faltante)',
          ''
        )}: ${punch.requested_time}`
    )
    .join(' • ') ||
  request.requested_time ||
  '--',
          reason: request.reason,
          attachment: request.attachment_url,
          status: request.status.toLowerCase(),
        })
      );

      setRealRequests(formattedRequests);
    } catch (error) {
      console.error(
        'Erro ao carregar solicitações:',
        error
      );

      setRealRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  loadRequests();
}, []);

const handleOpenAttachment = async (
  attachmentPath
) => {
  try {
    const { data, error } = await supabase.storage
      .from('adjustment-attachments')
      .createSignedUrl(attachmentPath, 60);

    if (error) {
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error(
        'Não foi possível gerar o link do anexo.'
      );
    }

    const canOpen = await Linking.canOpenURL(
      data.signedUrl
    );

    if (!canOpen) {
      throw new Error(
        'Este dispositivo não conseguiu abrir o anexo.'
      );
    }

    await Linking.openURL(data.signedUrl);
  } catch (error) {
    console.error(
      'Erro ao abrir anexo:',
      error
    );

    alert(
      `Não foi possível abrir o anexo.\n\n${error.message}`
    );
  }
};

  const handleAction = async (id, newStatus) => {
  if (processingRequestId !== null) {
    return;
  }

  setProcessingRequestId(id);

  try {
    const selectedRequest = realRequests.find(
  (request) => request.id === id
);

if (!selectedRequest) {
  throw new Error(
    'Solicitação não encontrada.'
  );
}
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    const manager = session?.user;

    if (authError || !manager) {
      throw new Error('Gestor não autenticado.');
    }

    const databaseStatus =
      newStatus === 'approved'
        ? 'APPROVED'
        : 'REJECTED';

        if (
  newStatus === 'approved' &&
  selectedRequest.requestType ===
    'TIME_CORRECTION'
) {
  const validPunches =
    selectedRequest.requestedPunches.filter(
      (punch) =>
        punch.entry_type &&
        punch.requested_time
    );

  if (validPunches.length === 0) {
    throw new Error(
      'Esta solicitação não possui horários válidos para inclusão.'
    );
  }

  const entriesToInsert = validPunches.map(
    (punch) => ({
      user_id: selectedRequest.userId,
      entry_type: punch.entry_type,
      recorded_at: new Date(
        `${selectedRequest.requestedDate}T${punch.requested_time}:00-03:00`
      ).toISOString(),
      within_geofence: false,
      created_offline: false,
      sync_status: 'SYNCED',
      notes:
        'Batida incluída por solicitação de ajuste aprovada.',
    })
  );

  const { error: insertEntriesError } =
    await supabase
      .from('time_entries')
      .insert(entriesToInsert);

  if (insertEntriesError) {
    throw insertEntriesError;
  }
}

    const { error } = await supabase
      .from('adjustment_requests')
      .update({
        status: databaseStatus,
        reviewed_by: manager.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    setRealRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === id
          ? {
              ...request,
              status: newStatus,
            }
          : request
      )
    );

    alert(
      newStatus === 'approved'
        ? 'Solicitação aprovada com sucesso!'
        : 'Solicitação recusada com sucesso!'
    );
  } catch (error) {
    console.error(
      'Erro ao atualizar solicitação:',
      error
    );

    alert(
      `Não foi possível atualizar a solicitação.\n\n${error.message}`
    );
  } finally {
    setProcessingRequestId(null);
  }
};

  const filteredRequests = realRequests.filter(
  (request) => request.status === filter
);

const pendingCount = realRequests.filter(
  (request) => request.status === 'pending'
).length;

const approvedCount = realRequests.filter(
  (request) => request.status === 'approved'
).length;

const rejectedCount = realRequests.filter(
  (request) => request.status === 'rejected'
).length;

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
        <Text style={styles.headerTitle}>Aprovações</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Abas de Filtro com Contadores Reais */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterTabText, filter === 'pending' && styles.filterTabTextActive]}>
              Pendentes ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === 'approved' && styles.filterTabActive]}
            onPress={() => setFilter('approved')}
          >
            <Text style={[styles.filterTabText, filter === 'approved' && styles.filterTabTextActive]}>
              Aprovadas ({approvedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === 'rejected' && styles.filterTabActive]}
            onPress={() => setFilter('rejected')}
          >
            <Text style={[styles.filterTabText, filter === 'rejected' && styles.filterTabTextActive]}>
              Recusadas ({rejectedCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Solicitações */}
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>Tudo em dia!</Text>
            <Text style={styles.emptySubtitle}>Nenhuma solicitação encontrada nesta categoria.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredRequests.map((req) => (
              <View key={req.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.userName}>{req.name}</Text>
                    <Text style={styles.userSector}>{req.sector}</Text>
                  </View>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{req.type}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Data: <Text style={styles.metaValue}>{req.date}</Text></Text>
                  <Text style={styles.metaLabel}>Horas: <Text style={styles.metaHighlight}>{req.time}</Text></Text>
                </View>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Justificativa:</Text>
                  <Text style={styles.reasonText}>{req.reason}</Text>
                </View>

                {req.attachment && (
  <TouchableOpacity
    style={styles.attachmentBox}
    onPress={() =>
      handleOpenAttachment(req.attachment)
    }
  >
    <Text style={styles.attachmentIcon}>📎</Text>

    <Text
      style={styles.attachmentName}
      numberOfLines={1}
    >
      Abrir anexo:{' '}
      {req.attachment.split('/').pop()}
    </Text>
  </TouchableOpacity>
)}

                {req.status === 'pending' && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
  style={[
    styles.btnAction,
    styles.btnReject,
    processingRequestId !== null && {
      opacity: 0.6,
    },
  ]}
  onPress={() =>
    handleAction(req.id, 'rejected')
  }
  disabled={processingRequestId !== null}
>
                      <Text style={styles.btnRejectText}>Recusar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
  style={[
    styles.btnAction,
    styles.btnApprove,
    processingRequestId !== null && {
      opacity: 0.6,
    },
  ]}
  onPress={() =>
    handleAction(req.id, 'approved')
  }
  disabled={processingRequestId !== null}
>
                      <Text style={styles.btnApproveText}>Aprovar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
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
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  userSector: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  metaValue: {
    color: '#0F172A',
    fontWeight: '600',
  },
  metaHighlight: {
    color: '#16A34A',
    fontWeight: '700',
  },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  reasonText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  attachmentIcon: {
    fontSize: 14,
  },
  attachmentName: {
    fontSize: 12,
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnReject: {
    backgroundColor: '#FEE2E2',
  },
  btnRejectText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  btnApprove: {
    backgroundColor: '#1D4ED8',
  },
  btnApproveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
});