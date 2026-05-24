import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Alert, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import { supabaseRealtime } from '../services/supabaseService';
import LawyerSidebar from '../components/lawyer/LawyerSidebar';
import NotificationCenterModal from '../components/lawyer/NotificationCenterModal';

const SUPABASE_URL = 'https://uwkcdwlgobnhowumcdnp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3a2Nkd2xnb2JuaG93dW1jZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTEyNDIsImV4cCI6MjA4OTE4NzI0Mn0.Nz-2pITIzlzZW-sePHXAyW6Kz19p45vlMN22Z8VEYEk';
const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function LawyerAgendaScreen({ route, navigation }) {
  const { user: initialUser, session: initialSession } = route.params || {};
  const [user, setUser] = useState(initialUser);
  const [session, setSession] = useState(initialSession);

  // Sidebar, Notifications & Loading
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic lawyer profile (balance)
  const [lawyerProfile, setLawyerProfile] = useState({
    name: 'Advogado',
    juris_balance: 0,
    plan_type: 'PRO'
  });

  // Agenda & CRM States
  const [agendaItems, setAgendaItems] = useState([]);
  const [crmClients, setCrmClients] = useState([]);
  const [clientsMap, setClientsMap] = useState({});

  // AI Modal States
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResultText, setAiResultText] = useState('');
  const [aiModalTitle, setAiModalTitle] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);

  // Session Recovery
  useEffect(() => {
    const recoverSession = async () => {
      if (!user || !session) {
        const { data: { session: activeSession } } = await supabaseRealtime.auth.getSession();
        if (activeSession) {
          setSession(activeSession);
          setUser(activeSession.user);
        }
      }
    };
    recoverSession();
  }, [user, session]);

  // Fetch Lawyer Profile for balance and details
  const fetchLawyerProfile = useCallback(async () => {
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      if (!accessToken) return;

      const res = await fetch(`${WEB_API}/perfil`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        setLawyerProfile({
          name: resJson.data.name || 'Advogado',
          juris_balance: resJson.data.balance || 0,
          plan_type: resJson.data.plan_type || 'FREE'
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil do advogado:', e);
    }
  }, [session]);

  // Fetch CRM Clients
  const fetchCrmClients = useCallback(async () => {
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      if (!user?.id || !accessToken) return;

      const authHeaders = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/crm_clients?lawyer_id=eq.${user.id}`, { headers: authHeaders });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCrmClients(data);
        const mapping = {};
        data.forEach(c => {
          mapping[c.id] = c.name;
        });
        setClientsMap(mapping);
      }
    } catch (e) {
      console.warn('Erro ao carregar clientes CRM:', e);
    }
  }, [user, session]);

  // Fetch Agenda Items
  const fetchAgenda = useCallback(async () => {
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      if (!accessToken) return;

      setLoading(true);
      const res = await fetch(`${WEB_API}/crm/agenda`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAgendaItems(json.data);
      }
    } catch (e) {
      console.warn('Erro ao carregar agenda:', e);
      Alert.alert('Erro', 'Não foi possível carregar sua agenda.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  const loadAll = useCallback(async () => {
    if (session) {
      await Promise.all([
        fetchLawyerProfile(),
        fetchCrmClients(),
        fetchAgenda()
      ]);
    }
  }, [session, fetchLawyerProfile, fetchCrmClients, fetchAgenda]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // Delete Agenda Item
  const handleDeleteItem = (item) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o compromisso "${item.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
              const res = await fetch(`${WEB_API}/crm/agenda?id=${item.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              });
              const json = await res.json();
              if (json.success) {
                setAgendaItems(prev => prev.filter(i => i.id !== item.id));
                Alert.alert('Sucesso', 'Compromisso removido da sua agenda.');
              } else {
                Alert.alert('Erro', json.message || 'Erro ao excluir compromisso.');
              }
            } catch (err) {
              console.warn(err);
              Alert.alert('Erro', 'Erro de conexão ao excluir.');
            }
          }
        }
      ]
    );
  };

  // AI Actions (Analisar / Resumo)
  const handleAiAction = async (actionType) => {
    if (agendaItems.length === 0) {
      Alert.alert('Agenda Vazia', 'Adicione compromissos na agenda primeiro!');
      return;
    }

    const title = actionType === 'analisar' ? 'Análise Inteligente de Agenda' : 'Resumo Executivo da Agenda';
    setAiModalTitle(title);
    setAiResultText('⏳ Iniciando consulta à IA...');
    setIsAiLoading(false); // Vamos usar o texto mesmo, não spinner
    setShowAiModal(true);

    // Atualiza o status visualmente durante o processo
    const updateStatus = (msg) => setAiResultText(msg);

    try {
      // 1. Obter token
      updateStatus('🔑 Verificando autenticação...');
      let accessToken = null;

      if (session && typeof session === 'object') {
        accessToken = session.access_token || session.accessToken || null;
      } else if (typeof session === 'string') {
        accessToken = session;
      }

      if (!accessToken) {
        try {
          const { data } = await supabaseRealtime.auth.getSession();
          accessToken = data?.session?.access_token || null;
        } catch (sessionErr) {
          console.warn('[Agenda AI] getSession error:', sessionErr);
        }
      }

      if (!accessToken) {
        updateStatus('❌ Sessão expirada. Por favor, faça login novamente.');
        return;
      }

      // 2. Montar o resumo da agenda
      updateStatus('📋 Organizando compromissos da agenda...');
      const formatDate = (dateStr) => {
        try {
          if (!dateStr) return 'Sem data';
          const d = new Date(String(dateStr).replace(' ', 'T'));
          if (isNaN(d.getTime())) return 'Data inválida';
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const mi = String(d.getMinutes()).padStart(2, '0');
          return `${dd}/${mm}/${yy} às ${hh}:${mi}`;
        } catch (_) { return 'Data inválida'; }
      };

      const linhas = agendaItems.map(i =>
        `- ${i.title || 'Sem título'} (${formatDate(i.date)}): ${i.description || 'Sem descrição'}`
      );
      const agendaSummary = linhas.join('\n');

      const messagePrompt = actionType === 'analisar'
        ? `Analise minha agenda jurídica e identifique conflitos, prazos críticos e prioridades:\n\n${agendaSummary}\n\nForneça análise técnica em tópicos.`
        : `Gere um resumo executivo da minha agenda jurídica:\n\n${agendaSummary}\n\nDestaque os pontos críticos.`;

      // 3. Chamar API
      updateStatus('🤖 Consultando inteligência artificial...');

      const fetchUrl = `${WEB_API}/crm/chat`;
      let rawResponse = null;
      let httpStatus = 0;

      try {
        const res = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: messagePrompt,
            clientData: { name: actionType === 'analisar' ? 'Análise de Agenda' : 'Resumo de Agenda' },
            history: []
          })
        });

        httpStatus = res.status;
        rawResponse = await res.text(); // usa text() primeiro para evitar crash no json()
      } catch (fetchErr) {
        console.warn('[Agenda AI] fetch error:', fetchErr);
        updateStatus(`❌ Erro de rede: ${fetchErr.message || 'Sem conexão com o servidor'}\n\nURL: ${fetchUrl}`);
        return;
      }

      // 4. Parsear resposta
      let json = null;
      try {
        json = JSON.parse(rawResponse);
      } catch (parseErr) {
        console.warn('[Agenda AI] JSON parse error. Raw:', rawResponse?.substring(0, 200));
        updateStatus(`❌ Resposta inválida do servidor (status ${httpStatus}).\n\nDetalhes: ${rawResponse?.substring(0, 150) || 'sem dados'}`);
        return;
      }

      // 5. Verificar resultado
      if (json.success && json.response) {
        updateStatus(json.response);
      } else if (httpStatus === 401 || json.message === 'Não autorizado') {
        updateStatus('❌ Sem autorização. Faça login novamente.');
      } else {
        updateStatus(`⚠️ ${json.message || `Servidor retornou status ${httpStatus} sem resposta da IA.`}`);
      }

    } catch (unexpectedErr) {
      console.warn('[Agenda AI] Unexpected error:', unexpectedErr);
      updateStatus(`❌ Erro inesperado: ${unexpectedErr.message || 'Desconhecido'}`);
    }
  };

  // Grouping Helpers
  const getEventTimeStr = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '--:--';
    }
  };

  const getEventDateTextStr = (dateStr) => {
    try {
      const d = new Date(dateStr);
      const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} • ${getEventTimeStr(dateStr)}`;
    } catch (e) {
      return '';
    }
  };

  const getUrgencyDetails = (urgency) => {
    const u = String(urgency).toUpperCase();
    if (u === 'HIGH' || u === 'ALTA') {
      return { label: 'ALTA', color: '#ff4d4d', bg: 'rgba(255, 77, 77, 0.1)' };
    }
    if (u === 'LOW' || u === 'BAIXA') {
      return { label: 'BAIXA', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.1)' };
    }
    return { label: 'MÉDIA', color: '#a0a5b0', bg: '#2c313c' }; // MEDIUM
  };

  // Group events into Today, Tomorrow, and Next Days
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const todayEvents = agendaItems.filter(i => new Date(i.date).toISOString().split('T')[0] === todayStr);
  const tomorrowEvents = agendaItems.filter(i => new Date(i.date).toISOString().split('T')[0] === tomorrowStr);
  const upcomingEvents = agendaItems.filter(i => {
    const itemDate = new Date(i.date).toISOString().split('T')[0];
    return itemDate !== todayStr && itemDate !== tomorrowStr;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setIsSidebarOpen(true)}>
          <Feather name="menu" size={24} color="#f5c853" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agenda Inteligente</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowNotifModal(true)}>
          <Feather name="bell" size={22} color="#f5c853" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5c853" colors={["#f5c853"]} />
        }
      >
        {/* Buttons Row */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleAiAction('analisar')}>
            <MaterialCommunityIcons name="chart-box-outline" size={16} color="#f5c853" style={{ marginRight: 6 }} />
            <Text style={styles.rowActionBtnText}>Analisar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rowActionBtn} onPress={() => handleAiAction('resumo')}>
            <MaterialCommunityIcons name="file-document-outline" size={16} color="#f5c853" style={{ marginRight: 6 }} />
            <Text style={styles.rowActionBtnText}>Resumo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.newBtn}
            onPress={() => navigation.navigate('LawyerAgendaNovo', { 
              user, 
              session, 
              crmClients,
              planType: lawyerProfile.plan_type,
              agendaCount: agendaItems.length
            })}
          >
            <Feather name="plus" size={16} color="#090a0d" style={{ marginRight: 4 }} />
            <Text style={styles.newBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#f5c853" />
            <Text style={styles.loadingText}>Carregando compromissos...</Text>
          </View>
        ) : (
          <View style={styles.agendaSectionsContainer}>
            {/* HOJE SECTION */}
            <Text style={styles.sectionLabel}>HOJE</Text>
            {todayEvents.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="calendar" size={32} color="#2b2d36" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyCardText}>Nenhum compromisso agendado.</Text>
              </View>
            ) : (
              todayEvents.map((item) => {
                const urgency = getUrgencyDetails(item.urgency);
                return (
                  <View key={item.id} style={styles.eventCard}>
                    <View style={styles.eventCardHeader}>
                      <View style={styles.timeRow}>
                        <Feather name="clock" size={14} color="#f5c853" style={{ marginRight: 6 }} />
                        <Text style={styles.timeText}>{getEventTimeStr(item.date)}</Text>
                      </View>
                      <View style={[styles.urgencyBadge, { backgroundColor: urgency.bg }]}>
                        <Text style={[styles.urgencyBadgeText, { color: urgency.color }]}>{urgency.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <View style={styles.clientRow}>
                      <Text style={styles.clientLabel}>
                        Cliente: {item.client_id ? (clientsMap[item.client_id] || 'Carregando...') : 'Não atribuído'}
                      </Text>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteItem(item)}>
                        <Feather name="trash-2" size={14} color="#ff4d4d" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            {/* AMANHÃ SECTION */}
            <Text style={styles.sectionLabel}>AMANHÃ</Text>
            {tomorrowEvents.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="calendar" size={32} color="#2b2d36" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyCardText}>Nenhum compromisso agendado.</Text>
              </View>
            ) : (
              tomorrowEvents.map((item) => {
                const urgency = getUrgencyDetails(item.urgency);
                return (
                  <View key={item.id} style={styles.eventCard}>
                    <View style={styles.eventCardHeader}>
                      <View style={styles.timeRow}>
                        <Feather name="clock" size={14} color="#f5c853" style={{ marginRight: 6 }} />
                        <Text style={styles.timeText}>{getEventTimeStr(item.date)}</Text>
                      </View>
                      <View style={[styles.urgencyBadge, { backgroundColor: urgency.bg }]}>
                        <Text style={[styles.urgencyBadgeText, { color: urgency.color }]}>{urgency.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <View style={styles.clientRow}>
                      <Text style={styles.clientLabel}>
                        Cliente: {item.client_id ? (clientsMap[item.client_id] || 'Carregando...') : 'Não atribuído'}
                      </Text>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteItem(item)}>
                        <Feather name="trash-2" size={14} color="#ff4d4d" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            {/* PROXIMOS DIAS SECTION */}
            <Text style={styles.sectionLabel}>PRÓXIMOS DIAS</Text>
            {upcomingEvents.length === 0 ? (
              <View style={styles.emptyCard}>
                <Feather name="calendar" size={32} color="#2b2d36" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyCardText}>Nenhum compromisso nos próximos dias.</Text>
              </View>
            ) : (
              upcomingEvents.map((item) => {
                const urgency = getUrgencyDetails(item.urgency);
                return (
                  <View key={item.id} style={[styles.eventCard, styles.upcomingEventCard]}>
                    <View style={styles.eventCardHeader}>
                      <View style={styles.timeRow}>
                        <Feather name="calendar" size={14} color="#f5c853" style={{ marginRight: 6 }} />
                        <Text style={styles.timeText}>{getEventDateTextStr(item.date)}</Text>
                      </View>
                      <View style={[styles.urgencyBadge, { backgroundColor: urgency.bg }]}>
                        <Text style={[styles.urgencyBadgeText, { color: urgency.color }]}>{urgency.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.eventTitle}>{item.title}</Text>
                    <View style={styles.clientRow}>
                      <Text style={styles.clientLabel}>
                        Cliente: {item.client_id ? (clientsMap[item.client_id] || 'Carregando...') : 'Não atribuído'}
                      </Text>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteItem(item)}>
                        <Feather name="trash-2" size={14} color="#ff4d4d" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
        <View style={{ height: 45 }} />
      </ScrollView>

      {/* AI Analysis / Summary Dialog - Native Modal */}
      <Modal
        visible={showAiModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAiModal(false)}
      >
        <View style={styles.aiModalOverlay}>
          <View style={styles.aiModalContent}>
            <View style={styles.aiModalHeader}>
              <Feather name="cpu" size={20} color="#f5c853" style={{ marginRight: 8 }} />
              <Text style={styles.aiModalTitleText} numberOfLines={1}>{aiModalTitle}</Text>
            </View>
            <ScrollView style={styles.aiModalScroll} contentContainerStyle={{ paddingBottom: 10 }}>
              {aiResultText ? (
                <Text style={styles.aiModalBodyText}>{aiResultText}</Text>
              ) : (
                <View style={styles.aiModalLoading}>
                  <ActivityIndicator size="large" color="#f5c853" />
                  <Text style={styles.aiModalLoadingText}>Consultando inteligência artificial...</Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.aiModalCloseBtn} onPress={() => setShowAiModal(false)}>
              <Text style={styles.aiModalCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sidebar Modals */}
      <LawyerSidebar 
        visible={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        lawyerProfile={lawyerProfile}
        navigation={navigation}
        user={user}
        session={session}
        onLogout={async () => {
          setIsSidebarOpen(false);
          await supabaseRealtime.auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }}
      />

      <NotificationCenterModal
        visible={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        session={session}
        user={user}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090a0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d24',
    backgroundColor: '#0d0f12',
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  rowActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flex: 1.1,
    marginRight: 8,
    justifyContent: 'center',
  },
  rowActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5c853',
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flex: 0.9,
    justifyContent: 'center',
  },
  newBtnText: {
    color: '#090a0d',
    fontSize: 13,
    fontWeight: 'bold',
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#a0a5b0',
    marginTop: 10,
  },
  agendaSectionsContainer: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#a0a5b0',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 16,
  },
  emptyCard: {
    backgroundColor: '#16191f',
    borderColor: '#20242e',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  emptyCardText: {
    color: '#8e94a2',
    fontSize: 13,
  },
  eventCard: {
    backgroundColor: '#16191f',
    borderColor: '#20242e',
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  upcomingEventCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f5c853',
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  urgencyBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  eventTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  clientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientLabel: {
    color: '#8e94a2',
    fontSize: 12,
  },
  deleteBtn: {
    padding: 4,
  },
  // AI Modal
  aiModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  aiModalContent: {
    backgroundColor: '#12151c',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#302919',
    padding: 20,
    shadowColor: '#f5c853',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  aiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#20242e',
    paddingBottom: 12,
    marginBottom: 16,
  },
  aiModalTitleText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  aiModalScroll: {
    flex: 1,
    marginBottom: 20,
  },
  aiModalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  aiModalLoadingText: {
    color: '#a0a5b0',
    marginTop: 12,
    fontSize: 13,
  },
  aiModalBodyText: {
    color: '#e2e4e9',
    fontSize: 14,
    lineHeight: 22,
  },
  aiModalCloseBtn: {
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiModalCloseBtnText: {
    color: '#090a0d',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
