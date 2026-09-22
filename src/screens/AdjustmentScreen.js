import React, { useState } from 'react';
import { supabase } from '../services/supabase';
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
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../context/AppContext';

export default function AdjustmentScreen({
  navigation,
  route,
}) {
  const { addAdjustmentRequest } = useApp();

  const [requestType, setRequestType] = useState('add'); // 'add' | 'abono'
  const fallbackRequestedDate =
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

const requestedDate =
  route.params?.requestedDate ||
  fallbackRequestedDate;

const selectedDateLabel =
  route.params?.dateLabel ||
  requestedDate.split('-').reverse().join('/');

const receivedPunches =
  route.params?.punches ||
  ['--:--', '--:--', '--:--', '--:--'];

  const punchLabels = [
  'Entrada',
  'Saída Almoço',
  'Volta Almoço',
  'Saída',
];

const [punches, setPunches] = useState(
  receivedPunches.map((time, index) => {
    const isMissing =
      !time || time === '--:--';

    return {
      id: String(index + 1),
      label: isMissing
        ? `${punchLabels[index]} (Faltante)`
        : punchLabels[index],
      time: isMissing ? '' : time,
      isOriginal: !isMissing,
    };
  })
);

  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddPunchField = () => {
    const nextIndex = punches.length + 1;
    setPunches((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        label: `Horário Adicional ${nextIndex}`,
        time: '',
        isOriginal: false,
      },
    ]);
  };

  const handleTimeChange = (id, newTime) => {
    setPunches((prev) =>
      prev.map((item) => (item.id === id ? { ...item, time: newTime } : item))
    );
  };

  const handleRemovePunchField = (id) => {
    setPunches((prev) => prev.filter((item) => item.id !== id));
  };

  // Seletor real de arquivos usando expo-document-picker
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAttachment(result.assets[0]);
      }
    } catch (error) {
      alert('Não foi possível carregar o arquivo.');
      console.error(error);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
  };

  const handleSubmit = async () => {
      if (isSubmitting) {
    return;
  }
  if (!reason.trim()) {
    alert('Por favor, informe a justificativa do ajuste.');
    return;
  }

  const entryTypes = [
  'CLOCK_IN',
  'LUNCH_OUT',
  'LUNCH_IN',
  'CLOCK_OUT',
];

const requestedPunches = punches
  .map((punch, index) => ({
    entry_type: entryTypes[index] || null,
    label: punch.label,
    requested_time: punch.time.trim(),
    is_original: punch.isOriginal,
  }))
  .filter(
    (punch) =>
      !punch.is_original &&
      punch.requested_time !== ''
  );

if (
  requestType === 'add' &&
  requestedPunches.length === 0
) {
  alert(
    'Preencha pelo menos um horário faltante para solicitar a correção.'
  );
  return;
}

setIsSubmitting(true);

let attachmentPath = null;
let requestSaved = false;

try {
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    const loggedUser = session?.user;

    if (authError || !loggedUser) {
  throw new Error('Usuário não autenticado.');
}

if (attachment) {
  const safeFileName = attachment.name.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );

  attachmentPath =
    `${loggedUser.id}/${Date.now()}-${safeFileName}`;

  let fileData;

  if (Platform.OS === 'web' && attachment.file) {
    fileData = attachment.file;
  } else {
    const fileResponse = await fetch(attachment.uri);
    fileData = await fileResponse.arrayBuffer();
  }

  const { error: uploadError } = await supabase.storage
    .from('adjustment-attachments')
    .upload(attachmentPath, fileData, {
      contentType:
        attachment.mimeType ||
        attachment.file?.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }
}

const { error } = await supabase
  .from('adjustment_requests')
      .insert({
        user_id: loggedUser.id,
        request_type:
          requestType === 'add'
            ? 'TIME_CORRECTION'
            : 'ABSENCE_EXCUSE',
        requested_date: requestedDate,
        requested_punches: requestedPunches,
        reason: reason.trim(),
        attachment_url: attachmentPath,
      });

    if (error) {
      throw error;
    }

    requestSaved = true;

    alert(
      'Solicitação de ajuste enviada com sucesso para o gestor!'
    );

    navigation.goBack();
  } catch (error) {
  console.error(
    'Erro ao enviar solicitação:',
    error
  );

  if (attachmentPath && !requestSaved) {
  const { error: removeError } =
    await supabase.storage
      .from('adjustment-attachments')
      .remove([attachmentPath]);

  if (removeError) {
    console.error(
      'Erro ao remover anexo não utilizado:',
      removeError
    );
  }
}

  if (error?.code === '23505') {
    alert(
      'Já existe uma solicitação pendente para esta data.'
    );
    return;
  }

    alert(
    `Não foi possível enviar a solicitação.\n\n${error.message}`
  );
} finally {
  setIsSubmitting(false);
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
        <Text style={styles.headerTitle}>Solicitar ajuste</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Data */}
        <Text style={styles.fieldLabel}>Data selecionada</Text>
        <View style={styles.dateCard}>
          <Text style={styles.dateText}>
  {selectedDateLabel}
</Text>
          <Text style={styles.dateCardBadge}>04h 15m batidas</Text>
        </View>

        {/* Tipo de Solicitação */}
        <Text style={styles.fieldLabel}>Tipo de solicitação</Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={styles.radioButtonContainer}
            onPress={() => setRequestType('add')}
          >
            <View style={[styles.radioCircle, requestType === 'add' && styles.radioCircleSelected]}>
              {requestType === 'add' && <View style={styles.radioInnerDot} />}
            </View>
            <Text style={styles.radioLabel}>Completar/Corrigir marcações</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioButtonContainer}
            onPress={() => setRequestType('abono')}
          >
            <View style={[styles.radioCircle, requestType === 'abono' && styles.radioCircleSelected]}>
              {requestType === 'abono' && <View style={styles.radioInnerDot} />}
            </View>
            <Text style={styles.radioLabel}>Abono de período</Text>
          </TouchableOpacity>
        </View>

        {/* Grade de Horários */}
        <View style={styles.punchesSectionHeader}>
          <Text style={styles.fieldLabel}>Marcações do dia</Text>
          <TouchableOpacity style={styles.btnAddPunch} onPress={handleAddPunchField}>
            <Text style={styles.btnAddPunchText}>+ Adicionar horário</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.punchesListContainer}>
          {punches.map((item) => (
            <View key={item.id} style={styles.punchRow}>
              <View style={styles.punchLabelContainer}>
                <Text style={styles.punchLabel}>{item.label}</Text>
                {item.isOriginal && <Text style={styles.punchTagOriginal}>Registrado</Text>}
              </View>

              <View style={styles.punchInputWrapper}>
                <TextInput
                  style={[
                    styles.punchInput,
                    item.isOriginal && styles.punchInputReadOnly,
                  ]}
                  value={item.time}
                  onChangeText={(val) => handleTimeChange(item.id, val)}
                  placeholder="--:--"
                  placeholderTextColor="#94A3B8"
                  editable={!item.isOriginal}
                />
                {!item.isOriginal && punches.length > 4 && (
                  <TouchableOpacity
                    style={styles.btnDeletePunch}
                    onPress={() => handleRemovePunchField(item.id)}
                  >
                    <Text style={styles.btnDeletePunchText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Justificativa */}
        <Text style={styles.fieldLabel}>Justificativa</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={3}
          maxLength={120}
          value={reason}
          onChangeText={setReason}
          placeholder="Ex: Esqueci de registrar na saída do almoço..."
          placeholderTextColor="#94A3B8"
        />
        <Text style={styles.charCounter}>{reason.length}/120</Text>

        {/* Anexos */}
        <Text style={styles.fieldLabel}>Anexos (comprovante / declaração)</Text>
        {attachment ? (
          <View style={styles.attachmentSelectedCard}>
            <View style={styles.attachmentInfo}>
              <Text style={styles.uploadIcon}>📎</Text>
              <Text style={styles.attachmentSelectedText} numberOfLines={1}>
                {attachment.name}
              </Text>
            </View>
            <TouchableOpacity onPress={handleRemoveAttachment}>
              <Text style={styles.btnRemoveAttachment}>✕ Remover</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadArea} onPress={handlePickFile}>
            <Text style={styles.uploadIcon}>📎</Text>
            <Text style={styles.uploadText}>Escolher arquivo do dispositivo (PDF ou Imagem)</Text>
          </TouchableOpacity>
        )}

        {/* Botão de Envio */}
        <TouchableOpacity
  style={[
    styles.submitButton,
    isSubmitting && { opacity: 0.6 },
  ]}
  onPress={handleSubmit}
  disabled={isSubmitting}
>
  <Text style={styles.submitButtonText}>
    {isSubmitting
      ? 'Enviando...'
      : 'Enviar solicitação de ajuste'}
  </Text>
</TouchableOpacity>
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  dateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dateCardBadge: {
    fontSize: 11,
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  radioGroup: {
    flexDirection: 'column',
    gap: 8,
    marginVertical: 4,
  },
  radioButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  radioCircleSelected: {
    borderColor: '#1D4ED8',
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1D4ED8',
  },
  radioLabel: {
    fontSize: 13,
    color: '#334155',
  },
  punchesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  btnAddPunch: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnAddPunchText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  punchesListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 8,
  },
  punchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  punchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  punchLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  punchTagOriginal: {
    fontSize: 10,
    color: '#166534',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: '600',
  },
  punchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  punchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    width: 80,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  punchInputReadOnly: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    color: '#64748B',
  },
  btnDeletePunch: {
    padding: 4,
  },
  btnDeletePunchText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    height: 80,
    textAlignVertical: 'top',
  },
  charCounter: {
    textAlign: 'right',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  uploadArea: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  uploadIcon: {
    fontSize: 16,
  },
  uploadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  attachmentSelectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  attachmentSelectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
    flex: 1,
  },
  btnRemoveAttachment: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});