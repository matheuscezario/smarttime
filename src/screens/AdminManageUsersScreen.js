import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

export default function AdminManageUsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [processingId, setProcessingId] = useState(null);
  const processing = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadUsers = async () => {
        setLoading(true);
        setErrorMessage('');
        setUsers([]);

        try {
          const { data, error } = await supabase.functions.invoke(
            'admin-manage-users',
            { body: { action: 'list', page } }
          );

          if (error) {
            let message = 'Não foi possível carregar os usuários.';

            if (error.context && typeof error.context.json === 'function') {
              try {
                const details = await error.context.json();
                message = details.error || details.message || message;
              } catch {
                // Mantém a mensagem quando a resposta não contém JSON.
              }
            }

            throw new Error(message);
          }

          if (data?.error) throw new Error(data.error);

          if (!Array.isArray(data?.users)) {
            throw new Error('O servidor retornou uma resposta inválida.');
          }

          if (!active) return;

          setUsers(data.users);
          setTotal(data.total || 0);
          setHasMore(data.has_more === true);
        } catch (error) {
          if (active) {
            setErrorMessage(error.message || 'Erro ao carregar usuários.');
            setHasMore(false);
            setTotal(0);
          }
        } finally {
          if (active) setLoading(false);
        }
      };

      loadUsers();

      return () => { active = false; };
    }, [page, reloadKey])
  );

  const handleChangeAccess = async (item) => {
    if (processing.current) return;

    processing.current = true;
    setProcessingId(item.id);

    const nextActive = !item.active;
    const actionLabel = nextActive ? 'Reativar' : 'Desativar';

    const message = nextActive
      ? `Permitir novamente o acesso de ${item.full_name}?`
      : `Desativar o acesso de ${item.full_name}? O histórico será preservado.`;

    try {
      const confirmed = Platform.OS === 'web'
        ? window.confirm(message)
        : await new Promise((resolve) => {
            Alert.alert(
              `${actionLabel} usuário`,
              message,
              [
                {
                  text: 'Cancelar',
                  style: 'cancel',
                  onPress: () => resolve(false),
                },
                {
                  text: actionLabel,
                  style: nextActive ? 'default' : 'destructive',
                  onPress: () => resolve(true),
                },
              ],
              {
                cancelable: true,
                onDismiss: () => resolve(false),
              }
            );
          });

      if (!confirmed) return;

      const { data, error } = await supabase.functions.invoke(
        'admin-manage-users',
        {
          body: {
            action: 'set_active',
            user_id: item.id,
            active: nextActive,
          },
        }
      );

      if (error) {
        let message = 'Não foi possível alterar o acesso.';

        if (error.context && typeof error.context.json === 'function') {
          try {
            const details = await error.context.json();
            message = details.error || details.message || message;
          } catch {
            // Mantém a mensagem caso a resposta não contenha JSON.
          }
        }

        throw new Error(message);
      }

      if (data?.error) throw new Error(data.error);

      if (
        data?.user?.id !== item.id ||
        data.user.active !== nextActive
      ) {
        throw new Error('O servidor não confirmou a alteração.');
      }

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === item.id ? data.user : currentUser
        )
      );

      if (Platform.OS === 'web') {
        window.alert(data.message);
      } else {
        Alert.alert('Acesso atualizado', data.message);
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert(error.message);
      } else {
        Alert.alert('Não foi possível alterar', error.message);
      }
    } finally {
      processing.current = false;
      setProcessingId(null);
    }
  };

  const renderUser = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.full_name}</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: item.active ? '#DCFCE7' : '#FEE2E2' },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: item.active ? '#166534' : '#991B1B' },
            ]}
          >
            {item.active ? 'Ativo' : 'Desativado'}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {item.role === 'MANAGER' ? 'Gerente' : 'Funcionário'}
        {' • '}
        {item.department || 'Sem setor'}
      </Text>

      <Text style={styles.email}>{item.email}</Text>

      <Text style={styles.meta}>
        Matrícula: {item.employee_code || 'Não informada'}
      </Text>

      <TouchableOpacity
        style={[
          styles.editButton,
          processingId !== null && styles.disabled,
        ]}
        disabled={processingId !== null}
        onPress={() =>
          navigation.navigate('AdminUserForm', {
            user: item,
          })
        }
      >
        <Text style={styles.editText}>Editar dados</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.editButton,
          {
            backgroundColor: item.active ? '#FEF2F2' : '#F0FDF4',
          },
          processingId !== null && styles.disabled,
        ]}
        disabled={processingId !== null}
        onPress={() => handleChangeAccess(item)}
      >
        {processingId === item.id ? (
          <ActivityIndicator color="#1D4ED8" />
        ) : (
          <Text
            style={[
              styles.editText,
              { color: item.active ? '#B91C1C' : '#166534' },
            ]}
          >
            {item.active ? 'Desativar usuário' : 'Reativar usuário'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerSide}
          accessibilityLabel="Voltar"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Gerenciar usuários</Text>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('AdminUserForm')}
        >
          <Text style={styles.primaryText}>+ Cadastrar usuário</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator
            style={{ marginTop: 30 }}
            color="#1D4ED8"
          />
        ) : errorMessage ? (
          <View style={styles.card}>
            <Text style={styles.error}>{errorMessage}</Text>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setReloadKey((value) => value + 1)}
            >
              <Text style={styles.editText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.summary}>
              {total} {total === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
              {' • Funcionários e gerentes'}
            </Text>

            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              renderItem={renderUser}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  Nenhum usuário encontrado nesta página.
                </Text>
              }
            />

            <View style={styles.pagination}>
              <TouchableOpacity
                disabled={page === 0}
                onPress={() => setPage((value) => value - 1)}
                style={[
                  styles.pageButton,
                  page === 0 && styles.disabled,
                ]}
              >
                <Text style={styles.editText}>Anterior</Text>
              </TouchableOpacity>

              <Text style={styles.meta}>Página {page + 1}</Text>

              <TouchableOpacity
                disabled={!hasMore}
                onPress={() => setPage((value) => value + 1)}
                style={[
                  styles.pageButton,
                  !hasMore && styles.disabled,
                ]}
              >
                <Text style={styles.editText}>Próxima</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerSide: { width: 36, alignItems: 'center' },
  backText: { fontSize: 30, color: '#0F172A' },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    padding: 16,
  },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  summary: { fontSize: 12, color: '#64748B', marginBottom: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  badge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  email: { fontSize: 13, color: '#334155', marginBottom: 6 },
  editButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  editText: { color: '#1D4ED8', fontSize: 13, fontWeight: '700' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  pageButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  disabled: { opacity: 0.4 },
  empty: { color: '#64748B', textAlign: 'center', padding: 24 },
  error: { color: '#B91C1C', lineHeight: 22 },
});