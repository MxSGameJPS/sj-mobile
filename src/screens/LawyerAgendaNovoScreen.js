import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import { supabaseRealtime } from '../services/supabaseService';

const SUPABASE_URL = 'https://uwkcdwlgobnhowumcdnp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3a2Nkd2xnb2JuaG93dW1jZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTEyNDIsImV4cCI6MjA4OTE4NzI0Mn0.Nz-2pITIzlzZW-sePHXAyW6Kz19p45vlMN22Z8VEYEk';
const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function LawyerAgendaNovoScreen({ route, navigation }) {
  const { user: initialUser, session: initialSession, crmClients: initialCrmClients } = route.params || {};
  
  const [user, setUser] = useState(initialUser);
  const [session, setSession] = useState(initialSession);
  const [clients, setClients] = useState(initialCrmClients || []);

  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [selectedClient, setSelectedClient] = useState(null);
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Judicial');
  const [urgency, setUrgency] = useState('Média');

  // UI state
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  // Modal selector states
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showUrgencyModal, setShowUrgencyModal] = useState(false);

  // Types & Urgency list options
  const typeOptions = ['Judicial', 'Reunião', 'Audiência', 'Prazo', 'Outro'];
  const urgencyOptions = ['Alta', 'Média', 'Baixa'];

  // Session recovery & clients fetching if missing
  useEffect(() => {
    const init = async () => {
      let activeSession = session;
      let currentUser = user;

      if (!user || !session) {
        const { data: { session: recoveredSession } } = await supabaseRealtime.auth.getSession();
        if (recoveredSession) {
          activeSession = recoveredSession;
          currentUser = recoveredSession.user;
          setSession(recoveredSession);
          setUser(recoveredSession.user);
        }
      }

      if (currentUser && activeSession && clients.length === 0) {
        try {
          const accessToken = activeSession.accessToken || activeSession.access_token || (typeof activeSession === 'string' ? activeSession : null);
          if (!accessToken) return;

          const authHeaders = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          };
          const res = await fetch(`${SUPABASE_URL}/rest/v1/crm_clients?lawyer_id=eq.${currentUser.id}`, { headers: authHeaders });
          const data = await res.json();
          if (Array.isArray(data)) {
            setClients(data);
          }
        } catch (e) {
          console.warn('Erro ao buscar clientes:', e);
        }
      }
    };
    init();
  }, [user, session, clients]);

  // Dynamic search on clients
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
    (c.cpf && c.cpf.includes(clientSearch))
  );

  // Formatting helpers
  const handleDateChange = (text) => {
    // Remove non-digits
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    setDate(formatted.slice(0, 10));
  };

  const handleTimeChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
    }
    setTime(formatted.slice(0, 5));
  };

  // AI Suggestion Handler
  const handleSuggestDeadline = async () => {
    if (!title.trim()) {
      Alert.alert('Aviso', 'Por favor, digite o título do compromisso primeiro para que a IA possa analisar.');
      return;
    }

    setAiLoading(true);
    setAiSuggestion(null);

    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      if (!accessToken) {
        Alert.alert('Erro', 'Sessão de usuário expirada ou inválida.');
        return;
      }

      const promptMsg = `Analise este título de compromisso jurídico e sugira um prazo e preparação ideal: "${title}". Responda APENAS com um objeto JSON válido (sem markdown ou blocos de código) no formato: {"suggestedDate": "DD/MM/AAAA", "reasoning": "Sua explicação resumida aqui"}`;

      const res = await fetch(`${WEB_API}/crm/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          message: promptMsg,
          clientData: { name: 'Sugestão de Prazo' },
          history: []
        })
      });

      const json = await res.json();
      if (json.success && json.response) {
        // Parse the AI response robustly
        let parsedDate = '';
        let parsedReasoning = json.response;

        try {
          const cleanedText = json.response.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedText);
          if (parsed.suggestedDate) parsedDate = parsed.suggestedDate;
          if (parsed.reasoning) parsedReasoning = parsed.reasoning;
        } catch (e) {
          // Regular expression fallbacks
          const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/;
          const match = json.response.match(dateRegex);
          if (match) parsedDate = match[0];

          const isoRegex = /(\d{4})-(\d{2})-(\d{2})/;
          const isoMatch = json.response.match(isoRegex);
          if (isoMatch && !parsedDate) {
            const [_, y, m, d] = isoMatch;
            parsedDate = `${d}/${m}/${y}`;
          }
        }

        if (parsedDate) {
          setDate(parsedDate);
          setAiSuggestion({
            date: parsedDate,
            reasoning: parsedReasoning
          });
        } else {
          Alert.alert('IA', 'A IA não conseguiu determinar uma data precisa, mas sugeriu:\n\n' + parsedReasoning);
        }
      } else {
        Alert.alert('Erro', json.message || 'Não foi possível obter sugestão da IA.');
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Erro', 'Erro ao conectar à inteligência artificial.');
    } finally {
      setAiLoading(false);
    }
  };

  // Submit Handler
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Erro', 'Por favor, informe o título do compromisso.');
      return;
    }

    // Date validation
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(date)) {
      Alert.alert('Erro', 'Por favor, informe a data no formato DD/MM/AAAA.');
      return;
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(time)) {
      Alert.alert('Erro', 'Por favor, informe a hora no formato HH:MM.');
      return;
    }

    // Parse date and time into ISO
    const [day, month, year] = date.split('/');
    const [hour, minute] = time.split(':');
    
    const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    
    if (isNaN(parsedDate.getTime())) {
      Alert.alert('Erro', 'Data ou hora inválida.');
      return;
    }

    setLoading(true);

    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      
      const payload = {
        title,
        date: parsedDate.toISOString(),
        description: description + (aiSuggestion ? `\n\n[Sugestão de Prazo IA]: ${aiSuggestion.reasoning}` : ''),
        type,
        urgency: urgency === 'Alta' ? 'HIGH' : (urgency === 'Baixa' ? 'LOW' : 'MEDIUM'),
        client_id: selectedClient ? selectedClient.id : null,
        status: 'PENDING'
      };

      const res = await fetch(`${WEB_API}/crm/agenda`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        Alert.alert('Sucesso', 'Compromisso agendado com sucesso!');
        navigation.navigate('LawyerAgenda', { user, session });
      } else {
        if (json.message === 'LIMIT_REACHED') {
          Alert.alert('Upgrade Necessário', 'Você atingiu o limite de compromissos do seu plano atual.');
        } else {
          Alert.alert('Erro', json.message || 'Ocorreu um erro ao salvar o compromisso.');
        }
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Erro', 'Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#f5c853" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Compromisso</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Feather name="more-vertical" size={20} color="#f5c853" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Main Visual Header */}
          <View style={styles.mainTitleRow}>
            <Text style={styles.addPrefix}>add</Text>
            <Text style={styles.mainTitleText}> Novo Compromisso</Text>
          </View>
          <Text style={styles.subtitle}>Organize seus prazos e audiências com inteligência</Text>

          {/* Form Fields */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>TÍTULO *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Audiência de Instrução"
              placeholderTextColor="#5a5e6b"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Row of Date & Time */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.fieldLabel}>DATA *</Text>
              <View style={styles.inputIconContainer}>
                <TextInput
                  style={[styles.textInput, styles.inputWithIcon]}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor="#5a5e6b"
                  keyboardType="numeric"
                  value={date}
                  onChangeText={handleDateChange}
                />
                <Feather name="calendar" size={16} color="#f5c853" style={styles.inputIcon} />
              </View>
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>HORA *</Text>
              <View style={styles.inputIconContainer}>
                <TextInput
                  style={[styles.textInput, styles.inputWithIcon]}
                  placeholder="09:00"
                  placeholderTextColor="#5a5e6b"
                  keyboardType="numeric"
                  value={time}
                  onChangeText={handleTimeChange}
                />
                <Feather name="clock" size={16} color="#f5c853" style={styles.inputIcon} />
              </View>
            </View>
          </View>

          {/* Client Select dropdown */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>CLIENTE (OPCIONAL)</Text>
            <TouchableOpacity style={styles.dropdownSelector} onPress={() => setShowClientModal(true)}>
              <Text style={selectedClient ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                {selectedClient ? selectedClient.name : '– Selecione –'}
              </Text>
              <Feather name="chevron-down" size={18} color="#a0a5b0" />
            </TouchableOpacity>
          </View>

          {/* Description for AI */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>DESCRIÇÃO (PARA IA)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Descreva o compromisso, contexto, área jurídica..."
              placeholderTextColor="#5a5e6b"
              multiline={true}
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
          </View>

          {/* Row of Type & Urgency */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
              <Text style={styles.fieldLabel}>TIPO</Text>
              <TouchableOpacity style={styles.dropdownSelector} onPress={() => setShowTypeModal(true)}>
                <Text style={styles.dropdownTextSelected}>{type}</Text>
                <Feather name="chevron-down" size={18} color="#a0a5b0" />
              </TouchableOpacity>
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>URGÊNCIA</Text>
              <TouchableOpacity style={styles.dropdownSelector} onPress={() => setShowUrgencyModal(true)}>
                <Text style={styles.dropdownTextSelected}>{urgency}</Text>
                <Feather name="chevron-down" size={18} color="#a0a5b0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* AI Suggestion Box */}
          {aiSuggestion && (
            <View style={styles.aiSuggestionBox}>
              <View style={styles.aiSuggestionHeader}>
                <MaterialCommunityIcons name="robot" size={20} color="#f5c853" style={{ marginRight: 8 }} />
                <Text style={styles.aiSuggestionTitle}>Sugestão da Inteligência Artificial</Text>
              </View>
              <Text style={styles.aiSuggestionDateText}>
                Data Sugerida: <Text style={{ color: '#f5c853', fontWeight: 'bold' }}>{aiSuggestion.date}</Text>
              </Text>
              <Text style={styles.aiSuggestionReasoning}>{aiSuggestion.reasoning}</Text>
            </View>
          )}

          {/* AI Suggestion Action Button */}
          <TouchableOpacity 
            style={styles.aiSuggestBtn} 
            onPress={handleSuggestDeadline}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <MaterialCommunityIcons name="sparkles" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.aiSuggestBtnText}>Sugerir Prazo com IA</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Save Action Button */}
          <TouchableOpacity 
            style={styles.saveBtn} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#090a0d" />
            ) : (
              <>
                <Feather name="check" size={18} color="#090a0d" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Salvar Compromisso</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CUSTOM MODAL SELECTORS */}

      {/* 1. Client Modal */}
      <Modal
        visible={showClientModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowClientModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Cliente</Text>
              <TouchableOpacity onPress={() => { setShowClientModal(false); setClientSearch(''); }}>
                <Feather name="x" size={24} color="#8e94a2" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchContainer}>
              <Feather name="search" size={18} color="#a0a5b0" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar por nome ou CPF..."
                placeholderTextColor="#5a5e6b"
                value={clientSearch}
                onChangeText={setClientSearch}
              />
            </View>

            {clients.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>Nenhum cliente CRM cadastrado.</Text>
              </View>
            ) : filteredClients.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>Nenhum cliente encontrado para "{clientSearch}".</Text>
              </View>
            ) : (
              <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[
                      styles.modalOptionItem,
                      selectedClient?.id === item.id && styles.modalOptionItemSelected
                    ]}
                    onPress={() => {
                      setSelectedClient(item);
                      setShowClientModal(false);
                      setClientSearch('');
                    }}
                  >
                    <View>
                      <Text style={styles.modalOptionText}>{item.name}</Text>
                      {item.cpf ? <Text style={styles.modalOptionSubtext}>CPF: {item.cpf}</Text> : null}
                    </View>
                    {selectedClient?.id === item.id && (
                      <Feather name="check" size={18} color="#f5c853" />
                    )}
                  </TouchableOpacity>
                )}
                style={styles.modalList}
              />
            )}

            <TouchableOpacity 
              style={styles.modalClearBtn}
              onPress={() => {
                setSelectedClient(null);
                setShowClientModal(false);
                setClientSearch('');
              }}
            >
              <Text style={styles.modalClearBtnText}>Remover Atribuição de Cliente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Type Modal */}
      <Modal
        visible={showTypeModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '40%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tipo de Compromisso</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Feather name="x" size={24} color="#8e94a2" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={typeOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.modalOptionItem,
                    type === item && styles.modalOptionItemSelected
                  ]}
                  onPress={() => {
                    setType(item);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{item}</Text>
                  {type === item && (
                    <Feather name="check" size={18} color="#f5c853" />
                  )}
                </TouchableOpacity>
              )}
              style={styles.modalList}
            />
          </View>
        </View>
      </Modal>

      {/* 3. Urgency Modal */}
      <Modal
        visible={showUrgencyModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowUrgencyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '35%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Urgência</Text>
              <TouchableOpacity onPress={() => setShowUrgencyModal(false)}>
                <Feather name="x" size={24} color="#8e94a2" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={urgencyOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.modalOptionItem,
                    urgency === item && styles.modalOptionItemSelected
                  ]}
                  onPress={() => {
                    setUrgency(item);
                    setShowUrgencyModal(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{item}</Text>
                  {urgency === item && (
                    <Feather name="check" size={18} color="#f5c853" />
                  )}
                </TouchableOpacity>
              )}
              style={styles.modalList}
            />
          </View>
        </View>
      </Modal>

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
    padding: 24,
  },
  mainTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  addPrefix: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#6c8cf2',
    fontSize: 28,
    fontWeight: 'normal',
  },
  mainTitleText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#a0a5b0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
  },
  formGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: '#a0a5b0',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  inputIconContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputWithIcon: {
    paddingRight: 40,
  },
  inputIcon: {
    position: 'absolute',
    right: 14,
  },
  dropdownSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownTextPlaceholder: {
    color: '#5a5e6b',
    fontSize: 15,
  },
  dropdownTextSelected: {
    color: '#ffffff',
    fontSize: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  // Suggestion Box
  aiSuggestionBox: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiSuggestionTitle: {
    color: '#f5c853',
    fontWeight: 'bold',
    fontSize: 14,
  },
  aiSuggestionDateText: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 8,
  },
  aiSuggestionReasoning: {
    color: '#a0a5b0',
    fontSize: 13,
    lineHeight: 18,
  },
  // Buttons
  aiSuggestBtn: {
    flexDirection: 'row',
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  aiSuggestBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#090a0d',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Modal Style
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#12151c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#302919',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16191f',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2c313c',
  },
  modalSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 10,
  },
  modalList: {
    marginBottom: 10,
  },
  modalOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e222b',
  },
  modalOptionItemSelected: {
    borderBottomColor: '#f5c853',
  },
  modalOptionText: {
    color: '#ffffff',
    fontSize: 15,
  },
  modalOptionSubtext: {
    color: '#a0a5b0',
    fontSize: 12,
    marginTop: 2,
  },
  modalEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  modalEmptyText: {
    color: '#a0a5b0',
    fontSize: 14,
  },
  modalClearBtn: {
    borderWidth: 1,
    borderColor: '#e53e3e',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  modalClearBtnText: {
    color: '#e53e3e',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
