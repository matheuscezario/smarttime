import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../services/supabase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        const rememberedEmail = await AsyncStorage.getItem(
          '@smarttime:rememberedEmail'
        );

        if (rememberedEmail) {
          setEmail(rememberedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error('Erro ao carregar e-mail lembrado:', error);
      }
    };

    loadRememberedEmail();
  }, []);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const isValidEmail = (value) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value);
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      showAlert(
        'Campos obrigatórios',
        'Informe o e-mail e a senha.'
      );
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      showAlert(
        'E-mail inválido',
        'Informe um endereço de e-mail válido.'
      );
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        showAlert(
          'Não foi possível entrar',
          'Confira o e-mail e a senha informados.'
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, role, department, employee_code, active'
        )
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();

        showAlert(
          'Perfil não encontrado',
          'A conta existe, mas o perfil do usuário não foi localizado.'
        );
        return;
      }

      if (!profile.active) {
        await supabase.auth.signOut();

        showAlert(
          'Usuário desativado',
          'Seu acesso está desativado. Entre em contato com o administrador.'
        );
        return;
      }

      if (rememberMe) {
        await AsyncStorage.setItem(
          '@smarttime:rememberedEmail',
          normalizedEmail
        );
      } else {
        await AsyncStorage.removeItem('@smarttime:rememberedEmail');
      }

      const destination =
  profile.role === 'ADMIN'
    ? 'AdminUsers'
    : 'Home';

      navigation.reset({
        index: 0,
        routes: [
          {
            name: destination,
            params: { profile },
          },
        ],
      });
    } catch (error) {
      console.error('Erro ao fazer login:', error);

      showAlert(
        'Erro de conexão',
        'Não foi possível conectar ao servidor. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    showAlert(
      'Informe seu e-mail',
      'Digite seu e-mail antes de solicitar a recuperação da senha.'
    );
    return;
  }

  if (!isValidEmail(normalizedEmail)) {
    showAlert(
      'E-mail inválido',
      'Informe um endereço de e-mail válido.'
    );
    return;
  }

  try {
    setLoading(true);

    const redirectTo =
      Platform.OS === 'web'
        ? window.location.origin
        : undefined;

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo }
      );

    if (error) {
      throw error;
    }

    showAlert(
      'E-mail enviado',
      'Enviamos as instruções de recuperação. Verifique também a caixa de spam.'
    );
  } catch (error) {
    console.error(
      'Erro ao solicitar recuperação de senha:',
      error
    );

    if (error?.status === 429) {
      showAlert(
        'Muitas tentativas',
        'Aguarde alguns minutos antes de solicitar outro e-mail.'
      );
      return;
    }

    showAlert(
      'Não foi possível enviar',
      'Tente novamente em alguns instantes.'
    );
  } finally {
    setLoading(false);
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={styles.brandTitle}>SmartTime</Text>
          <Text style={styles.welcomeTitle}>Bem-vindo!</Text>
          <Text style={styles.subtitle}>Faça login para continuar</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>E-mail</Text>

          <TextInput
            style={styles.input}
            placeholder="seu.email@empresa.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />

          <Text style={styles.label}>Senha</Text>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleLogin}
              editable={!loading}
            />

            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={() => setShowPassword((current) => !current)}
              disabled={loading}
            >
              <Text style={styles.showPasswordText}>
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRememberMe((current) => !current)}
              disabled={loading}
            >
              <View
                style={[
                  styles.checkbox,
                  rememberMe && styles.checkboxChecked,
                ]}
              >
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <Text style={styles.checkboxLabel}>Lembrar de mim</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotPassword}>
                Esqueci minha senha
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  header: {
    marginBottom: 36,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1D4ED8',
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  showPasswordButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  showPasswordText: {
    fontSize: 12,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#475569',
  },
  forgotPassword: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
