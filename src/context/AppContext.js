import React, { createContext, useState, useContext } from 'react';

const AppContext = createContext();

const initialRequests = [
  {
    id: '1',
    name: 'João Silva',
    sector: 'Comercial',
    date: '15/05/2024',
    type: 'Completar/Corrigir marcações',
    time: '+02:30',
    reason: 'Esqueci de registrar a volta do almoço devido a reunião externa com cliente.',
    attachment: 'declaracao_cliente.pdf',
    status: 'pending',
  },
  {
    id: '2',
    name: 'Ana Oliveira',
    sector: 'Financeiro',
    date: '14/05/2024',
    type: 'Abono de período',
    time: '04:00',
    reason: 'Consulta médica no período da manhã.',
    attachment: 'atestado_medico.pdf',
    status: 'pending',
  },
  {
    id: '3',
    name: 'Lucas Martins',
    sector: 'Operações',
    date: '10/05/2024',
    type: 'Completar/Corrigir marcações',
    time: '+01:00',
    reason: 'Finalização de inventário fora do expediente normal.',
    attachment: null,
    status: 'pending',
  },
];

const initialHistory = [
  { id: '1', day: 'Seg, 13/05', totalHours: '08h 00m', status: 'Completo', punches: ['08:02', '12:01', '13:02', '17:31'], isIncomplete: false },
  { id: '2', day: 'Ter, 14/05', totalHours: '08h 00m', status: 'Completo', punches: ['08:00', '12:00', '13:00', '17:30'], isIncomplete: false },
  { id: '3', day: 'Qua, 15/05', totalHours: '04h 15m', status: 'Incompleto', punches: ['08:05', '12:10', '--:--', '--:--'], isIncomplete: true },
  { id: '4', day: 'Qui, 16/05', totalHours: '08h 00m', status: 'Completo', punches: ['07:58', '12:00', '13:00', '17:28'], isIncomplete: false },
  { id: '5', day: 'Sex, 17/05', totalHours: '08h 00m', status: 'Completo', punches: ['08:01', '12:00', '13:00', '17:32'], isIncomplete: false },
];

export function AppProvider({ children }) {
  const [requests, setRequests] = useState(initialRequests);
  const [historyData, setHistoryData] = useState(initialHistory);

  // Batidas de hoje
  const [todayPunches, setTodayPunches] = useState([
    { id: 1, type: 'Entrada', icon: '🚪', time: null },
    { id: 2, type: 'Saída almoço', icon: '🍴', time: null },
    { id: 3, type: 'Volta almoço', icon: '🍴', time: null },
    { id: 4, type: 'Saída', icon: '🚪', time: null },
  ]);

  // Função para registrar batida de ponto
  const recordPunch = (index, formattedTime) => {
    setTodayPunches((prev) => {
      const updated = prev.map((item, idx) =>
        idx === index ? { ...item, time: formattedTime } : item
      );
      return updated;
    });
  };

  // Solicitações de Ajuste
  const addAdjustmentRequest = (newRequest) => {
    setRequests((prev) => [
      {
        id: String(Date.now()),
        status: 'pending',
        ...newRequest,
      },
      ...prev,
    ]);
  };

  const updateRequestStatus = (id, newStatus) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: newStatus } : req))
    );
  };

  return (
    <AppContext.Provider
      value={{
        requests,
        addAdjustmentRequest,
        updateRequestStatus,
        todayPunches,
        recordPunch,
        historyData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}