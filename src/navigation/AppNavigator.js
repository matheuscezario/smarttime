import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Telas
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AdjustmentScreen from '../screens/AdjustmentScreen';
import BankHoursScreen from '../screens/BankHoursScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminUserDetailScreen from '../screens/AdminUserDetailScreen';
import AdminApprovalsScreen from '../screens/AdminApprovalsScreen';
import AdminReportsScreen from '../screens/AdminReportsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false, // Mantém os cabeçalhos bonitos que você já desenhou em cada tela
          animation: 'slide_from_right', // Transição suave entre telas
        }}
      >
        {/* Fluxo de Autenticação */}
        <Stack.Screen name="Login" component={LoginScreen} />

        {/* Fluxo do Colaborador */}
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Adjustment" component={AdjustmentScreen} />
        <Stack.Screen name="BankHours" component={BankHoursScreen} />

        {/* Fluxo do Gestor / Admin */}
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
        <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
        <Stack.Screen name="AdminApprovals" component={AdminApprovalsScreen} />
        <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}