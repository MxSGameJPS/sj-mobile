import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Alert, Clipboard, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS } from '../styles/theme';
import { supabaseRealtime } from '../services/supabaseService';

const SUPABASE_URL = 'https://uwkcdwlgobnhowumcdnp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3a2Nkd2xnb2JuaG93dW1jZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTEyNDIsImV4cCI6MjA4OTE4NzI0Mn0.Nz-2pITIzlzZW-sePHXAyW6Kz19p45vlMN22Z8VEYEk';
const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function LawyerBlindagemNotificacaoScreen({ route, navigation }) {
  const { user: initialUser, session: initialSession } = route.params || {};
  const [user, setUser] = useState(initialUser);
  const [session, setSession] = useState(initialSession);

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

  // CRM Clients & Loading
  const [crmClients, setCrmClients] = useState([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [selectedCrmClient, setSelectedCrmClient] = useState(null);

  // Form State
  const [nomeNotificado, setNomeNotificado] = useState('');
  const [enderecoNotificado, setEnderecoNotificado] = useState('');
  const [cepNotificado, setCepNotificado] = useState('');
  const [cidadeEstadoNotificado, setCidadeEstadoNotificado] = useState('');

  const [nomeNotificante, setNomeNotificante] = useState('');
  const [enderecoNotificante, setEnderecoNotificante] = useState('');
  const [cepNotificante, setCepNotificante] = useState('');
  const [cidadeEstadoNotificante, setCidadeEstadoNotificante] = useState('');

  const [fatos, setFatos] = useState('');
  const [tom, setTom] = useState('Conciliador'); // 'Conciliador' ou 'Assertivo / Agressivo'
  const [emailDestino, setEmailDestino] = useState('');
  const [logo, setLogo] = useState(null);

  // UI Flow State
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [sentResult, setSentResult] = useState(null);

  const fetchCrm = useCallback(async () => {
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      if (!user?.id || !accessToken) return;

      const authHeaders = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      const crmRes = await fetch(`${SUPABASE_URL}/rest/v1/crm_clients?lawyer_id=eq.${user.id}&order=created_at.desc`, { headers: authHeaders });
      const crmData = await crmRes.json();
      if (Array.isArray(crmData)) {
        setCrmClients(crmData);
      }
    } catch (e) {
      console.warn('Erro ao carregar CRM:', e);
    }
  }, [user, session]);

  useEffect(() => {
    fetchCrm();
  }, [fetchCrm]);

  const handleSelectClient = (client) => {
    setSelectedCrmClient(client);
    setNomeNotificante(client.name || '');
    setEnderecoNotificante(client.endereco_completo || '');
    setShowClientPicker(false);
  };

  const handleSelectLogo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setLogo(result.assets[0]);
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Erro', 'Erro ao selecionar logotipo.');
    }
  };

  const handleGenerate = async () => {
    if (!nomeNotificado.trim() || !fatos.trim() || !emailDestino.trim()) {
      Alert.alert('Erro', 'Por favor, preencha o Nome do Notificado, os Fatos e o E-mail de destino.');
      return;
    }

    setIsGenerating(true);
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      
      const payload = {
        type: "Notificação Extrajudicial",
        tone: tom === 'Conciliador' ? 'Conciliador' : 'Agressivo',
        facts: `DADOS DO NOTIFICADO (Destinatário):
- Nome: ${nomeNotificado}
- Endereço: ${enderecoNotificado}, CEP: ${cepNotificado}, Cidade-Estado: ${cidadeEstadoNotificado}

DADOS DO NOTIFICANTE (Remetente):
- Nome/Razão Social: ${nomeNotificante || 'Não informado'}
- Endereço: ${enderecoNotificante}, CEP: ${cepNotificante}, Cidade-Estado: ${cidadeEstadoNotificante}

FATOS E CONCORDÂNCIA:
${fatos}`,
        advocateData: { name: user?.user_metadata?.name || 'Advogado' }
      };

      const res = await fetch(`${WEB_API}/crm/redator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (resJson.success && resJson.draft) {
        setDraft(resJson.draft);
        setShowResult(true);
      } else {
        Alert.alert('Erro', resJson.message || 'Erro ao gerar notificação');
      }
    } catch (err) {
      console.warn(err);
      Alert.alert('Erro', 'Falha na conexão ao gerar notificação');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendNotification = async () => {
    setIsSending(true);
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      
      const formData = new FormData();
      formData.append('draft_text', draft);
      formData.append('destinatario_email', emailDestino);
      formData.append('tone', tom === 'Conciliador' ? 'Conciliador' : 'Agressivo');
      
      if (selectedCrmClient) {
        formData.append('client_id', selectedCrmClient.id);
      }

      if (logo) {
        formData.append('logo_file', {
          uri: logo.uri,
          name: logo.name || 'logo.png',
          type: logo.mimeType || 'image/png',
        });
      }

      const res = await fetch(`${WEB_API}/crm/notificacoes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const dataJson = await res.json();
      if (dataJson.success) {
        setSentResult({
          protocol: dataJson.data.protocol,
          hash: dataJson.data.hash,
          date: new Date(dataJson.data.date).toLocaleString('pt-BR')
        });
        setSentSuccess(true);
        Alert.alert('✅ Sucesso', 'Notificação extrajudicial enviada e blindada na blockchain!');
      } else {
        Alert.alert('Erro', dataJson.message || 'Erro ao enviar notificação.');
      }
    } catch (err) {
      console.warn(err);
      Alert.alert('Erro', 'Falha na conexão ao enviar notificação.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#f5c853" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificação Extrajudicial</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {!showResult ? (
          // Passo 1: Formulário
          <View style={styles.formContainer}>
            <View style={styles.formIntro}>
              <Feather name="edit-3" size={20} color="#f5c853" style={{ marginRight: 8 }} />
              <Text style={styles.formIntroText}>Nova Notificação Extrajudicial</Text>
            </View>

            {/* Caso / Cliente CRM */}
            <Text style={styles.sectionTitle}>Caso / Cliente (Opcional)</Text>
            {crmClients.length > 0 && (
              <TouchableOpacity 
                style={styles.crmTrigger} 
                onPress={() => setShowClientPicker(!showClientPicker)}
              >
                <Text style={styles.crmTriggerText}>
                  {selectedCrmClient ? selectedCrmClient.name : 'Selecione um caso ou cliente...'}
                </Text>
                <Feather name="chevron-down" size={16} color="#a0a5b0" />
              </TouchableOpacity>
            )}

            {showClientPicker && (
              <View style={styles.crmListWrapper}>
                <TouchableOpacity 
                  style={styles.crmClientItem}
                  onPress={() => {
                    setSelectedCrmClient(null);
                    setShowClientPicker(false);
                  }}
                >
                  <Text style={[styles.crmClientItemName, { color: '#f5c853' }]}>Nenhum / Limpar seleção</Text>
                </TouchableOpacity>
                {crmClients.map((client) => (
                  <TouchableOpacity 
                    key={client.id} 
                    style={styles.crmClientItem}
                    onPress={() => handleSelectClient(client)}
                  >
                    <Text style={styles.crmClientItemName}>{client.name}</Text>
                    {client.email ? <Text style={styles.crmClientItemDetail}>{client.email}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Notificado */}
            <Text style={styles.sectionTitle}>Nome do Notificado</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome completo do destinatário"
              placeholderTextColor="#606672"
              value={nomeNotificado}
              onChangeText={setNomeNotificado}
            />

            {/* Dados do Notificado */}
            <View style={styles.cardContainer}>
              <Text style={styles.cardHeaderTitle}>Dados do Notificado (Destinatário)</Text>
              <TextInput style={styles.cardInput} placeholder="Endereço" placeholderTextColor="#606672" value={enderecoNotificado} onChangeText={setEnderecoNotificado} />
              <TextInput style={styles.cardInput} placeholder="CEP" placeholderTextColor="#606672" value={cepNotificado} onChangeText={setCepNotificado} keyboardType="numeric" />
              <TextInput style={styles.cardInput} placeholder="Cidade - Estado" placeholderTextColor="#606672" value={cidadeEstadoNotificado} onChangeText={setCidadeEstadoNotificado} />
            </View>

            {/* Dados do Notificante */}
            <View style={styles.cardContainer}>
              <Text style={styles.cardHeaderTitle}>Dados do Notificante (Remetente)</Text>
              <TextInput style={styles.cardInput} placeholder="Nome ou Razão Social" placeholderTextColor="#606672" value={nomeNotificante} onChangeText={setNomeNotificante} />
              <TextInput style={styles.cardInput} placeholder="Endereço" placeholderTextColor="#606672" value={enderecoNotificante} onChangeText={setEnderecoNotificante} />
              <TextInput style={styles.cardInput} placeholder="CEP" placeholderTextColor="#606672" value={cepNotificante} onChangeText={setCepNotificante} keyboardType="numeric" />
              <TextInput style={styles.cardInput} placeholder="Cidade - Estado" placeholderTextColor="#606672" value={cidadeEstadoNotificante} onChangeText={setCidadeEstadoNotificante} />
            </View>

            {/* Fatos */}
            <Text style={styles.sectionTitle}>O que está acontecendo? [Explique para a IA]</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Explique os fatos para que a IA redija a notificação adequada..."
              placeholderTextColor="#606672"
              value={fatos}
              onChangeText={setFatos}
              multiline
              numberOfLines={6}
            />

            {/* Tom */}
            <Text style={styles.sectionTitle}>Tom da Notificação</Text>
            <View style={styles.tomContainer}>
              <TouchableOpacity 
                style={[styles.tomBtn, tom === 'Conciliador' && styles.tomBtnActiveGold]}
                onPress={() => setTom('Conciliador')}
              >
                <MaterialCommunityIcons 
                  name="hand-okay" 
                  size={16} 
                  color={tom === 'Conciliador' ? '#0d0f12' : '#f5c853'} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tomBtnText, tom === 'Conciliador' && styles.tomBtnTextActive]}>
                  Conciliador
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.tomBtn, tom === 'Assertivo / Agressivo' && styles.tomBtnActiveFlame]}
                onPress={() => setTom('Assertivo / Agressivo')}
              >
                <MaterialCommunityIcons 
                  name="flame" 
                  size={16} 
                  color={tom === 'Assertivo / Agressivo' ? '#ffffff' : '#ff4d4d'} 
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tomBtnText, tom === 'Assertivo / Agressivo' && styles.tomBtnTextActiveLight]}>
                  Assertivo / Agressivo
                </Text>
              </TouchableOpacity>
            </View>

            {/* E-mail Destinatário */}
            <Text style={styles.sectionTitle}>E-mail do Destinatário</Text>
            <TextInput
              style={styles.input}
              placeholder="email@destino.com"
              placeholderTextColor="#606672"
              value={emailDestino}
              onChangeText={setEmailDestino}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Logotipo */}
            <Text style={styles.sectionTitle}>Logotipo (Opcional)</Text>
            <TouchableOpacity style={styles.logoTrigger} onPress={handleSelectLogo}>
              <Feather name="image" size={16} color="#f5c853" style={{ marginRight: 8 }} />
              <Text style={styles.logoTriggerText}>
                {logo ? logo.name : 'Escolher arquivo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.primaryBtn, isGenerating && { opacity: 0.7 }]} 
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#0d0f12" />
              ) : (
                <Text style={styles.primaryBtnText}>Gerar Notificação com IA</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // Passo 2: Resultado
          <View style={styles.resultContainer}>
            <Text style={styles.sectionTitle}>Notificação Gerada por IA</Text>
            <View style={styles.draftBox}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
                <Text style={styles.draftText}>{draft}</Text>
              </ScrollView>
            </View>

            {sentSuccess ? (
              <View style={styles.certificateBox}>
                <Feather name="check-circle" size={40} color="#2ecc71" style={{ marginBottom: 12 }} />
                <Text style={styles.certTitle}>Enviada & Blindada!</Text>
                <Text style={styles.certLabel}>Protocolo Blockchain:</Text>
                <Text style={styles.certVal}>{sentResult.protocol}</Text>
                <Text style={styles.certLabel}>Assinatura Hash SHA-512:</Text>
                <Text style={[styles.certVal, styles.monoText]}>{sentResult.hash}</Text>
                <Text style={styles.certLabel}>Data do Disparo:</Text>
                <Text style={styles.certVal}>{sentResult.date}</Text>

                <TouchableOpacity 
                  style={[styles.secondaryBtn, { width: '100%', marginTop: 20 }]} 
                  onPress={() => {
                    setShowResult(false);
                    setSentSuccess(false);
                    setDraft('');
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Voltar ao Início</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={styles.shareButtonsContainer}>
                  <TouchableOpacity style={styles.iconActionBtn} onPress={() => { Clipboard.setString(draft); Alert.alert('Copiado', 'Texto copiado!'); }}>
                    <Feather name="copy" size={16} color="#f5c853" style={{ marginRight: 6 }} />
                    <Text style={styles.iconActionBtnText}>Copiar Texto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconActionBtn} onPress={() => Share.share({ message: draft })}>
                    <Feather name="share-2" size={16} color="#f5c853" style={{ marginRight: 6 }} />
                    <Text style={styles.iconActionBtnText}>Compartilhar</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.confirmSendBtn, isSending && { opacity: 0.7 }]}
                  onPress={handleSendNotification}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Feather name="send" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmSendBtnText}>Blindar e Enviar por E-mail</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.secondaryBtn, { marginTop: 12 }]} 
                  onPress={() => setShowResult(false)}
                >
                  <Text style={styles.secondaryBtnText}>Tentar Novamente</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
  backBtn: {
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
  formContainer: {
    marginBottom: 20,
  },
  formIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(245, 200, 83, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 83, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  formIntroText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
  },
  crmTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  crmTriggerText: {
    color: '#ffffff',
    fontSize: 14,
  },
  crmListWrapper: {
    backgroundColor: '#1c202a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2c313c',
    padding: 10,
    marginTop: 4,
    maxHeight: 180,
  },
  crmClientItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2b303d',
  },
  crmClientItemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  crmClientItemDetail: {
    color: '#8e94a2',
    fontSize: 11,
  },
  input: {
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  cardContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  cardHeaderTitle: {
    color: '#f5c853',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  cardInput: {
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 6,
    color: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10,
  },
  tomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tomBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  tomBtnActiveGold: {
    backgroundColor: '#f5c853',
    borderColor: '#f5c853',
  },
  tomBtnActiveFlame: {
    backgroundColor: '#ff4d4d',
    borderColor: '#ff4d4d',
  },
  tomBtnText: {
    color: '#a0a5b0',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tomBtnTextActive: {
    color: '#0d0f12',
  },
  tomBtnTextActiveLight: {
    color: '#ffffff',
  },
  logoTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  logoTriggerText: {
    color: '#a0a5b0',
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  primaryBtnText: {
    color: '#0d0f12',
    fontSize: 15,
    fontWeight: 'bold',
  },
  resultContainer: {
    marginBottom: 20,
  },
  draftBox: {
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  draftText: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#a0a5b0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  shareButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 200, 83, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 83, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconActionBtnText: {
    color: '#f5c853',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmSendBtn: {
    backgroundColor: '#f5c853',
    flexDirection: 'row',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  confirmSendBtnText: {
    color: '#0d0f12',
    fontSize: 15,
    fontWeight: 'bold',
  },
  certificateBox: {
    backgroundColor: 'rgba(46, 204, 113, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.2)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  certTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  certLabel: {
    color: '#8e94a2',
    fontSize: 11,
    marginTop: 8,
  },
  certVal: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  }
});
