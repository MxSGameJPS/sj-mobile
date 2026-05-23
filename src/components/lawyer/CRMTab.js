/**
 * CRMTab.js — CRM & KYC Jurídico Mobile
 * Paridade completa com a versão Web.
 * Funcionalidades: listagem, formulário completo, extração IA (PDF/foto),
 * comando de voz (texto + IA), dossiê com abas (Geral, Interações, Financeiro, Análise IA, Casos).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Alert, KeyboardAvoidingView,
  Platform, RefreshControl, Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

// ─── Constants ───────────────────────────────────────────────────
const SUPABASE_URL = 'https://uwkcdwlgobnhowumcdnp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3a2Nkd2xnb2JuaG93dW1jZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTEyNDIsImV4cCI6MjA4OTE4NzI0Mn0.Nz-2pITIzlzZW-sePHXAyW6Kz19p45vlMN22Z8VEYEk';
// Para testar localmente no Expo Go, use o IP da sua máquina de desenvolvimento
const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

// ─── Helpers ─────────────────────────────────────────────────────
const maskPhone = (p) => {
  if (!p) return 'Sem telefone';
  const d = p.replace(/\D/g, '');
  return d.length >= 8 ? `(${d.slice(0, 2)}) ****-${d.slice(-4)}` : p;
};

const maskDoc = (doc) => {
  if (!doc) return '--';
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(-2)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(-2)}`;
  return doc;
};

const riskColor = (s) => s < 30 ? '#10b981' : s < 70 ? '#f5c853' : '#ff453a';
const riskLabel = (s) => s < 30 ? 'Baixo' : s < 70 ? 'Médio' : 'Alto';
const currency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const monthLabel = () => new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '--';

// ─── DOSSIER TABS ────────────────────────────────────────────────
const DOSSIER_TABS = ['Geral', 'Interações', 'Financeiro', 'Análise IA', 'Casos'];

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export default function CRMTab({ userId, accessToken, planType, onPlanUpgrade }) {
  
  const checkCrmLimit = () => {
    if (planType === 'FREE') {
      if (onPlanUpgrade) {
        onPlanUpgrade('O CRM de Clientes é uma ferramenta exclusiva dos planos START e PRO.\n\nGerencie seu plano no portal web para obter acesso.');
      } else {
        Alert.alert('Acesso Restrito', 'O CRM de Clientes é uma ferramenta exclusiva dos planos START e PRO.\n\nGerencie seu plano no portal web para obter acesso.');
      }
      return false;
    }
    if (planType === 'START' && clients.length >= 10) {
      if (onPlanUpgrade) {
        onPlanUpgrade('Você atingiu o limite de 10 clientes do Plano START. Faça upgrade para o Plano PRO para gerenciar clientes ilimitados.');
      } else {
        Alert.alert('Limite Atingido', 'Você atingiu o limite de 10 clientes do Plano START. Faça upgrade para continuar.');
      }
      return false;
    }
    return true;
  };
  // ── Core state ──
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [financials, setFinancials] = useState({ previsto: 0, recebido: 0, count: 0 });

  // ── New Client Modal ──
  const [showNewClient, setShowNewClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [form, setForm] = useState({
    nome_completo: '', tipo: 'Pessoa Física', cpf_cnpj: '', rg_ie: '',
    estado_civil: '', profissao: '', telefone: '', endereco_completo: '', email: '', notas_internas: '',
  });

  // ── Voice CRM Modal ──
  const [showVoice, setShowVoice] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [processingVoice, setProcessingVoice] = useState(false);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef(null);

  // ── Dossier ──
  const [selectedClient, setSelectedClient] = useState(null);
  const [showDossier, setShowDossier] = useState(false);
  const [dossierTab, setDossierTab] = useState('Geral');

  const [interactions, setInteractions] = useState([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [financeRecords, setFinanceRecords] = useState([]);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [showFinanceForm, setShowFinanceForm] = useState(false);
  const [financeForm, setFinanceForm] = useState({ description: '', amount: '', status: 'PENDENTE', due_date: '' });
  const [savingFinance, setSavingFinance] = useState(false);

  const [clientCases, setClientCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);

  const [insight, setInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  // ─── Auth headers ────────────────────────────────────────────────
  const authHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // ─── Fetch clients ────────────────────────────────────────────────
  const fetchClients = useCallback(async () => {
    if (!userId || !accessToken) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/crm_clients?lawyer_id=eq.${userId}&order=created_at.desc`,
        { headers: authHeaders }
      );
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) { console.error('[CRM] fetchClients:', e); }
  }, [userId, accessToken]);

  // ─── Fetch financials (monthly summary) ──────────────────────────
  const fetchFinancials = useCallback(async () => {
    if (!userId || !accessToken) return;
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/crm_finance?lawyer_id=eq.${userId}&due_date=gte.${from}&due_date=lte.${to}`,
        { headers: authHeaders }
      );
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const previsto = data.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      const recebido = data.filter(e => e.status === 'PAGO').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      setFinancials({ previsto, recebido, count: data.length });
    } catch (e) { console.error('[CRM] fetchFinancials:', e); }
  }, [userId, accessToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchClients(), fetchFinancials()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchClients, fetchFinancials]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // ─── Dossier data loaders ─────────────────────────────────────────
  const openDossier = async (client) => {
    setSelectedClient(client);
    setDossierTab('Geral');
    setInteractions([]);
    setFinanceRecords([]);
    setClientCases([]);
    setInsight('');
    setShowDossier(true);
    loadDossierTab('Geral', client);
  };

  const loadDossierTab = async (tab, client) => {
    const c = client || selectedClient;
    if (!c) return;

    if (tab === 'Interações') {
      setLoadingInteractions(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/crm_interactions?client_id=eq.${c.id}&lawyer_id=eq.${userId}&order=created_at.desc`,
          { headers: authHeaders }
        );
        const data = await res.json();
        setInteractions(Array.isArray(data) ? data : []);
      } catch (e) { console.error('[CRM] interactions:', e); }
      setLoadingInteractions(false);
    }

    if (tab === 'Financeiro') {
      setLoadingFinance(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/crm_finance?client_id=eq.${c.id}&lawyer_id=eq.${userId}&order=due_date.asc`,
          { headers: authHeaders }
        );
        const data = await res.json();
        setFinanceRecords(Array.isArray(data) ? data : []);
      } catch (e) { console.error('[CRM] finance:', e); }
      setLoadingFinance(false);
    }

    if (tab === 'Casos') {
      setLoadingCases(true);
      try {
        const res = await fetch(
          `${WEB_API}/crm/client-cases?email=${encodeURIComponent(c.email || '')}&cpf_cnpj=${encodeURIComponent(c.cpf_cnpj || '')}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setClientCases(data.success && Array.isArray(data.data) ? data.data : []);
      } catch (e) { console.error('[CRM] cases:', e); }
      setLoadingCases(false);
    }

    if (tab === 'Análise IA') {
      setLoadingInsight(true);
      setInsight('');
      try {
        const res = await fetch(
          `${WEB_API}/crm/insights?clientId=${c.id}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 || data.limitReached) {
          setInsight('LIMIT_REACHED');
        } else if (res.ok && data.success) {
          setInsight(data.insight);
        } else {
          setInsight(data.message || 'Não foi possível gerar o insight.');
        }
      } catch (e) {
        console.error('[CRM] insight:', e);
        setInsight('Erro ao conectar com a IA.');
      }
      setLoadingInsight(false);
    }
  };

  const handleTabChange = (tab) => {
    setDossierTab(tab);
    loadDossierTab(tab);
  };

  // ─── Save new interaction ─────────────────────────────────────────
  const saveInteraction = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const payload = {
        id: generateUUID(),
        lawyer_id: userId,
        client_id: selectedClient.id,
        content: newNote.trim(),
        type: 'nota',
        created_at: new Date().toISOString(),
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/crm_interactions`, {
        method: 'POST',
        headers: { ...authHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Erro ao salvar interação');
      setNewNote('');
      loadDossierTab('Interações');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar a interação.');
    }
    setSavingNote(false);
  };

  // ─── Save finance record ──────────────────────────────────────────
  const saveFinance = async () => {
    if (!financeForm.description.trim() || !financeForm.amount) {
      Alert.alert('Atenção', 'Preencha a descrição e o valor.');
      return;
    }
    setSavingFinance(true);
    try {
      const payload = {
        id: generateUUID(),
        lawyer_id: userId,
        client_id: selectedClient.id,
        description: financeForm.description.trim(),
        amount: parseFloat(financeForm.amount.replace(',', '.')),
        status: financeForm.status,
        due_date: financeForm.due_date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        paid_at: financeForm.status === 'PAGO' ? new Date().toISOString() : null,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/crm_finance`, {
        method: 'POST',
        headers: { ...authHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Erro ao salvar lançamento');
      setFinanceForm({ description: '', amount: '', status: 'PENDENTE', due_date: '' });
      setShowFinanceForm(false);
      loadDossierTab('Financeiro');
      fetchFinancials(); // Update monthly summary
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o lançamento.');
    }
    setSavingFinance(false);
  };

  // ─── Toggle payment status ────────────────────────────────────────
  const togglePayment = async (record) => {
    const newStatus = record.status === 'PAGO' ? 'PENDENTE' : 'PAGO';
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/crm_finance?id=eq.${record.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: newStatus, paid_at: newStatus === 'PAGO' ? new Date().toISOString() : null }),
      });
      loadDossierTab('Financeiro');
      fetchFinancials();
    } catch (e) { Alert.alert('Erro', 'Não foi possível atualizar o status.'); }
  };

  // ─── Save new client ──────────────────────────────────────────────
  const handleSaveClient = async () => {
    if (!form.nome_completo.trim()) {
      Alert.alert('Campo Obrigatório', 'Informe o nome completo do cliente.');
      return;
    }
    setSaving(true);
    try {
      // Call production API to respect plan limits
      const res = await fetch(`${WEB_API}/crm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || 'Erro no servidor'}`);
      }
      const data = await res.json();
      if (!data.success) {
        if (data.error_type === 'QUOTA_EXCEEDED') {
          Alert.alert('Limite Atingido', 'Você atingiu o limite de clientes do seu plano. Faça upgrade para continuar.');
        } else {
          Alert.alert('Erro', data.message || 'Não foi possível cadastrar o cliente.');
        }
        return;
      }
      Alert.alert('✅ Sucesso', 'Cliente cadastrado com sucesso!');
      setShowNewClient(false);
      resetForm();
      loadAll();
    } catch (e) {
      Alert.alert('Erro', 'Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => setForm({
    nome_completo: '', tipo: 'Pessoa Física', cpf_cnpj: '', rg_ie: '',
    estado_civil: '', profissao: '', telefone: '', endereco_completo: '', email: '', notas_internas: '',
  });

  // ─── PDF/Image extraction ─────────────────────────────────────────
  const handleExtractPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      await extractFromFile(result.assets[0]);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
    }
  };

  const handleExtractPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão Necessária', 'Permita o acesso à galeria para usar esta função.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      await extractFromFile(result.assets[0]);
    }
  };

  const extractFromFile = async (asset) => {
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || 'document.pdf',
        type: asset.mimeType || 'application/pdf',
      });

      const res = await fetch(`${WEB_API}/crm/extract-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || 'Erro no servidor'}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setForm(prev => ({
          ...prev,
          nome_completo: data.data.nome_completo || prev.nome_completo,
          tipo: data.data.tipo || prev.tipo,
          cpf_cnpj: data.data.cpf_cnpj || prev.cpf_cnpj,
          rg_ie: data.data.rg_ie || prev.rg_ie,
          estado_civil: data.data.estado_civil || prev.estado_civil,
          profissao: data.data.profissao || prev.profissao,
          telefone: data.data.telefone || prev.telefone,
          endereco_completo: data.data.endereco_completo || prev.endereco_completo,
          email: data.data.email || prev.email,
        }));
        setShowNewClient(true);
        Alert.alert('✅ Extração Concluída', 'Dados extraídos com sucesso! Revise e confirme o formulário.');
      } else {
        Alert.alert('Erro', data.message || 'Não foi possível extrair dados do documento.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Erro ao processar o documento.');
    } finally {
      setExtracting(false);
    }
  };

  // ─── Voice CRM (recording + text-based + AI) ──────────────────────
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permissão Necessária', 'Permita o acesso ao microfone para gravar o comando de voz.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setRecordingDuration(0);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('[CRM] Failed to start recording', err);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação de áudio.');
    }
  };

  const stopRecording = async (shouldProcess = true) => {
    if (!recording) return;

    try {
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (shouldProcess && uri) {
        await processAudioCommand(uri);
      }
    } catch (err) {
      console.error('[CRM] Failed to stop recording', err);
      Alert.alert('Erro', 'Não foi possível parar a gravação.');
    }
  };

  const cancelRecording = async () => {
    if (recording) {
      try {
        setIsRecording(false);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        await recording.stopAndUnloadAsync();
      } catch (e) {
        console.error('[CRM] Error cancelling recording:', e);
      }
      setRecording(null);
    }
    setRecordingDuration(0);
    setIsRecording(false);
  };

  const processAudioCommand = async (uri) => {
    setProcessingVoice(true);
    try {
      const filename = uri.split('/').pop() || 'audio.m4a';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `audio/${match[1]}` : 'audio/m4a';

      const formData = new FormData();
      formData.append('audio', {
        uri,
        name: filename,
        type,
      });

      const res = await fetch(`${WEB_API}/crm/voice-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || 'Erro no servidor'}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setForm(prev => ({ ...prev, ...data.data }));
        setShowVoice(false);
        setVoiceText('');
        setShowNewClient(true);
        Alert.alert('✅ Voz Processada', 'Dados extraídos com sucesso! Revise e salve o formulário.');
      } else {
        Alert.alert('Atenção', data.message || 'A IA não conseguiu entender ou extrair os dados do áudio. Tente novamente.');
      }
    } catch (e) {
      console.error('[CRM] processAudioCommand:', e);
      Alert.alert('Erro', 'Erro ao conectar ou enviar áudio para processamento.');
    } finally {
      setProcessingVoice(false);
    }
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const processVoiceCommand = async () => {
    if (!voiceText.trim()) return;
    setProcessingVoice(true);
    try {
      const res = await fetch(`${WEB_API}/crm/voice-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text: voiceText }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || 'Erro no servidor'}`);
      }
      const data = await res.json();
      if (data.success && data.data) {
        setForm(prev => ({ ...prev, ...data.data }));
        setShowVoice(false);
        setVoiceText('');
        setShowNewClient(true);
        Alert.alert('✅ IA Processou', 'Dados extraídos! Revise o formulário.');
      } else {
        Alert.alert('Atenção', data.message || 'A IA não conseguiu extrair os dados. Tente descrever mais detalhadamente.');
      }
    } catch (e) {
      Alert.alert('Erro', 'Erro ao processar comando.');
    } finally {
      setProcessingVoice(false);
    }
  };

  // ─── Filtered list ────────────────────────────────────────────────
  const filtered = clients.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const pct = financials.previsto > 0
    ? Math.min(100, Math.round((financials.recebido / financials.previsto) * 100))
    : 0;

  // ════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#f5c853" />}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>CRM & KYC Jurídico</Text>
            <Text style={s.subtitle}>Gestão de carteira e análise de risco.</Text>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={s.actionRow}>
          <TouchableOpacity style={[s.actionBtn, s.btnRed]} onPress={() => { if (checkCrmLimit()) setShowVoice(true); }}>
            <Feather name="mic" size={14} color="#ff453a" />
            <Text style={[s.actionTxt, { color: '#ff453a' }]}>Comando{'\n'}de Voz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, s.btnGray, extracting && { opacity: 0.6 }]}
            onPress={() => {
              if (checkCrmLimit()) {
                Alert.alert('Extração IA', 'Selecionar origem:', [
                  { text: 'PDF / Documento', onPress: handleExtractPDF },
                  { text: 'Galeria de Fotos', onPress: handleExtractPhoto },
                  { text: 'Cancelar', style: 'cancel' },
                ]);
              }
            }}
            disabled={extracting}
          >
            {extracting
              ? <ActivityIndicator size="small" color="#a3a9c2" />
              : <Feather name="zap" size={14} color="#a3a9c2" />
            }
            <Text style={[s.actionTxt, { color: '#a3a9c2' }]}>{extracting ? 'Extraindo...' : 'Extração IA'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.btnGold]} onPress={() => { if (checkCrmLimit()) { resetForm(); setShowNewClient(true); } }}>
            <Feather name="user-plus" size={14} color="#f5c853" />
            <Text style={[s.actionTxt, { color: '#f5c853' }]}>Novo{'\n'}Cliente</Text>
          </TouchableOpacity>
        </View>

        {/* ── Info box ── */}
        <View style={s.infoBox}>
          <View style={s.infoIcon}><Feather name="shield" size={20} color="#f5c853" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.infoTitle}>O que você pode fazer:</Text>
            <Text style={s.infoText}>
              Gerencie sua carteira com IA. Analise risco, segmente clientes, acompanhe histórico e receba recomendações estratégicas. Tudo centralizado em um dossiê completo para cada cliente.
            </Text>
            <View style={s.tagRow}>
              {['Score de Confiança', 'Segmentação', 'Chat IA', 'Relatórios'].map(t => (
                <View key={t} style={s.tag}><Text style={s.tagTxt}>{t}</Text></View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Finance card ── */}
        <View style={s.finCard}>
          <View style={s.finHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="trending-up" size={16} color="#f5c853" />
              <Text style={s.finTitle}>Desempenho Financeiro do Mês</Text>
            </View>
            <Text style={s.finMonth}>{monthLabel()}</Text>
          </View>
          <View style={s.finGrid}>
            <View style={s.finStat}>
              <Text style={s.finLbl}>PREVISTO TOTAL</Text>
              <Text style={s.finVal}>{currency(financials.previsto)}</Text>
            </View>
            <View style={s.finStat}>
              <Text style={s.finLbl}>RECEBIDO (PAGO)</Text>
              <Text style={[s.finVal, { color: '#10b981' }]}>{currency(financials.recebido)}</Text>
            </View>
          </View>
          <View style={s.progSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={s.finLbl}>PROGRESSO DE RECEBIMENTO</Text>
              <Text style={s.progPct}>{pct}%</Text>
            </View>
            <View style={s.progBar}>
              <View style={[s.progFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.finCount}>{financials.count} lançamentos financeiros identificados neste período.</Text>
          </View>
        </View>

        {/* ── Search ── */}
        <View style={s.searchWrap}>
          <Feather name="search" size={15} color="#606672" style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar cliente..."
            placeholderTextColor="#606672"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={15} color="#606672" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Client list ── */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#f5c853" />
            <Text style={s.loadTxt}>Carregando clientes...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyState}>
            <Feather name="users" size={40} color="#2b2d36" />
            <Text style={s.emptyTxt}>{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}</Text>
            {!search && (
              <TouchableOpacity style={s.emptyBtn} onPress={() => {
                if (checkCrmLimit()) {
                  resetForm();
                  setShowNewClient(true);
                }
              }}>
                <Text style={s.emptyBtnTxt}>+ Cadastrar primeiro cliente</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map(client => <ClientCard key={client.id} client={client} onDossier={() => openDossier(client)} />)
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════
           MODAL: NOVO CLIENTE
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showNewClient} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Novo Cliente</Text>
              <TouchableOpacity onPress={() => setShowNewClient(false)}>
                <Feather name="x" size={22} color="#a3a9c2" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Tipo */}
              <Text style={s.fLabel}>TIPO DE PESSOA</Text>
              <View style={s.typeRow}>
                {['Pessoa Física', 'Pessoa Jurídica'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, form.tipo === t && s.typeBtnActive]}
                    onPress={() => setForm(p => ({ ...p, tipo: t }))}
                  >
                    <Text style={[s.typeBtnTxt, form.tipo === t && { color: '#f5c853' }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {[
                { label: 'Nome Completo *', key: 'nome_completo', placeholder: 'Nome do cliente' },
                { label: 'E-mail', key: 'email', placeholder: 'email@exemplo.com', keyboardType: 'email-address', autoCapitalize: 'none' },
                { label: 'Telefone / Celular', key: 'telefone', placeholder: '(11) 99999-9999', keyboardType: 'phone-pad' },
                { label: form.tipo === 'Pessoa Física' ? 'CPF' : 'CNPJ', key: 'cpf_cnpj', placeholder: form.tipo === 'Pessoa Física' ? '000.000.000-00' : '00.000.000/0000-00', keyboardType: 'numeric' },
                { label: form.tipo === 'Pessoa Física' ? 'RG' : 'Inscrição Estadual', key: 'rg_ie', placeholder: 'Número do documento' },
                { label: 'Estado Civil', key: 'estado_civil', placeholder: 'Ex: Casado, Solteiro...' },
                { label: 'Profissão', key: 'profissao', placeholder: 'Ex: Engenheiro, Professor...' },
                { label: 'Endereço Completo', key: 'endereco_completo', placeholder: 'Rua, número, bairro, cidade - UF' },
                { label: 'Notas Internas', key: 'notas_internas', placeholder: 'Observações privadas...', multiline: true },
              ].map(field => (
                <View key={field.key} style={s.fGroup}>
                  <Text style={s.fLabel}>{field.label}</Text>
                  <TextInput
                    style={[s.fInput, field.multiline && { height: 80, textAlignVertical: 'top' }]}
                    placeholder={field.placeholder}
                    placeholderTextColor="#606672"
                    value={form[field.key]}
                    onChangeText={v => setForm(p => ({ ...p, [field.key]: v }))}
                    keyboardType={field.keyboardType || 'default'}
                    autoCapitalize={field.autoCapitalize || 'sentences'}
                    multiline={field.multiline}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveClient}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnTxt}>Salvar Cliente</Text>}
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL: COMANDO DE VOZ
      ══════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════
           MODAL: COMANDO DE VOZ
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showVoice} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '85%' }]}>
            <View style={s.modalHdr}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="mic" size={18} color="#ff453a" />
                <Text style={s.modalTitle}>Comando de Voz</Text>
              </View>
              <TouchableOpacity onPress={() => { cancelRecording(); setShowVoice(false); }}>
                <Feather name="x" size={22} color="#a3a9c2" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.voiceInfoBox}>
                <Feather name="info" size={14} color="#606672" style={{ marginTop: 2 }} />
                <Text style={s.voiceInfoTxt}>
                  Grave um áudio ou digite o comando descrevendo os dados do cliente naturalmente (Nome, CPF, E-mail, Profissão, etc). A IA estruturará tudo.
                </Text>
              </View>

              {/* Area de Gravação de Áudio / Processando */}
              <View style={s.voiceMicContainer}>
                {processingVoice ? (
                  <View style={s.idleMicContainer}>
                    <ActivityIndicator size="large" color="#f5c853" style={{ marginBottom: 10 }} />
                    <Text style={s.recordingTimer}>Processando com IA...</Text>
                    <Text style={s.recordingHint}>Transcrevendo áudio e extraindo dados do cliente...</Text>
                  </View>
                ) : isRecording ? (
                  <View style={s.recordingPulseContainer}>
                    <View style={s.pulseCircle} />
                    <TouchableOpacity style={s.recordingMicBtn} onPress={() => stopRecording(true)}>
                      <Feather name="square" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={s.recordingTimer}>Gravando: {formatDuration(recordingDuration)}</Text>
                    <Text style={s.recordingHint}>Toque no quadrado para parar e processar</Text>
                  </View>
                ) : (
                  <View style={s.idleMicContainer}>
                    <TouchableOpacity style={s.idleMicBtn} onPress={startRecording}>
                      <Feather name="mic" size={32} color="#ff453a" />
                    </TouchableOpacity>
                    <Text style={s.recordingTimer}>Toque para Gravar</Text>
                    <Text style={s.recordingHint}>Clique para iniciar o comando por voz</Text>
                  </View>
                )}
              </View>

              {/* Fallback de Texto */}
              {!isRecording && !processingVoice && (
                <View style={{ marginTop: 10 }}>
                  <Text style={s.fLabel}>Ou digite o comando:</Text>
                  <TextInput
                    style={s.voiceInput}
                    placeholder="Digite o comando aqui... Ex: João Silva, CPF 123.456.789-00, e-mail joao@gmail.com..."
                    placeholderTextColor="#606672"
                    value={voiceText}
                    onChangeText={setVoiceText}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Ações */}
              <View style={[s.voiceActions, { marginTop: 10 }]}>
                <TouchableOpacity style={s.voiceCancelBtn} onPress={() => { cancelRecording(); setShowVoice(false); setVoiceText(''); }}>
                  <Text style={s.voiceCancelTxt}>Cancelar</Text>
                </TouchableOpacity>
                {!isRecording ? (
                  <TouchableOpacity
                    style={[s.voiceProcessBtn, (!voiceText.trim() || processingVoice) && { opacity: 0.5 }]}
                    onPress={processVoiceCommand}
                    disabled={!voiceText.trim() || processingVoice}
                  >
                    {processingVoice ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Feather name="zap" size={15} color="#000" />
                        <Text style={s.voiceProcessTxt}>Processar Texto</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[s.voiceProcessBtn, { backgroundColor: '#ff453a' }, processingVoice && { opacity: 0.5 }]}
                    onPress={() => stopRecording(true)}
                    disabled={processingVoice}
                  >
                    {processingVoice ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="check" size={15} color="#fff" />
                        <Text style={[s.voiceProcessTxt, { color: '#fff' }]}>Processar Áudio</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
           MODAL: DOSSIÊ COMPLETO
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={showDossier} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.sheet, { height: '90%' }]}>
            {/* Header */}
            <View style={s.modalHdr}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle} numberOfLines={1}>Dossiê: {selectedClient?.name}</Text>
                {selectedClient && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={[s.riskPill, { borderColor: riskColor(selectedClient.risk_score || 50) }]}>
                      <Text style={[s.riskPillTxt, { color: riskColor(selectedClient.risk_score || 50) }]}>
                        {riskLabel(selectedClient.risk_score || 50)} ({selectedClient.risk_score || 50}%)
                      </Text>
                    </View>
                    <Text style={s.statusTxt}>{selectedClient.status || 'Ativo'}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => { setShowDossier(false); setSelectedClient(null); }}>
                <Feather name="x" size={22} color="#a3a9c2" />
              </TouchableOpacity>
            </View>

            {/* Tab bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar}>
              {DOSSIER_TABS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.tabBtn, dossierTab === t && s.tabBtnActive]}
                  onPress={() => handleTabChange(t)}
                >
                  <Text style={[s.tabBtnTxt, dossierTab === t && s.tabBtnTxtActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Tab content */}
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {dossierTab === 'Geral' && selectedClient && (
                <DossierGeral client={selectedClient} />
              )}
              {dossierTab === 'Interações' && (
                <DossierInteractions
                  interactions={interactions}
                  loading={loadingInteractions}
                  newNote={newNote}
                  setNewNote={setNewNote}
                  onSave={saveInteraction}
                  saving={savingNote}
                />
              )}
              {dossierTab === 'Financeiro' && (
                <DossierFinance
                  records={financeRecords}
                  loading={loadingFinance}
                  showForm={showFinanceForm}
                  setShowForm={setShowFinanceForm}
                  financeForm={financeForm}
                  setFinanceForm={setFinanceForm}
                  onSave={saveFinance}
                  saving={savingFinance}
                  onToggle={togglePayment}
                />
              )}
              {dossierTab === 'Análise IA' && (
                <DossierInsight 
                  insight={insight} 
                  loading={loadingInsight} 
                  onUpgrade={() => {
                    setShowDossier(false);
                    if (onPlanUpgrade) {
                      onPlanUpgrade('Você atingiu o limite de 5 insights do Plano START.\n\nEfetue o upgrade para o Plano PRO no portal web para acesso ilimitado.');
                    }
                  }}
                />
              )}
              {dossierTab === 'Casos' && (
                <DossierCases cases={clientCases} loading={loadingCases} />
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════

function ClientCard({ client, onDossier }) {
  return (
    <View style={s.clientCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{(client.name || '??').substring(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.clientName}>{client.name}</Text>
          <Text style={s.clientContact}>{client.email || 'Sem e-mail'} • {maskPhone(client.phone)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.detailLbl}>DOCUMENTO</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Feather name="file-text" size={13} color="#606672" />
            <Feather name="file" size={13} color="#606672" />
          </View>
          <Text style={s.detailVal}>{maskDoc(client.cpf_cnpj)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.detailLbl}>RISCO</Text>
          <View style={[s.riskPill, { borderColor: riskColor(client.risk_score || 50), alignSelf: 'flex-start' }]}>
            <Text style={[s.riskPillTxt, { color: riskColor(client.risk_score || 50) }]}>
              {riskLabel(client.risk_score || 50)} ({client.risk_score || 50}%)
            </Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.detailLbl}>STATUS</Text>
          <Text style={s.detailVal}>{client.status || 'Ativo'}</Text>
        </View>
      </View>
      <TouchableOpacity style={s.dossierBtn} onPress={onDossier}>
        <Feather name="folder" size={13} color="#f5c853" />
        <Text style={s.dossierBtnTxt}>Dossiê Completo</Text>
      </TouchableOpacity>
    </View>
  );
}

function DossierGeral({ client }) {
  const rows = [
    { icon: 'user', label: 'Tipo', value: client.type || 'Pessoa Física' },
    { icon: 'mail', label: 'E-mail', value: client.email || 'Não informado' },
    { icon: 'phone', label: 'Telefone', value: maskPhone(client.phone) },
    { icon: 'file-text', label: 'CPF / CNPJ', value: maskDoc(client.cpf_cnpj) },
    { icon: 'file', label: 'RG / IE', value: client.rg ? `***${String(client.rg).slice(-3)}` : '--' },
    { icon: 'heart', label: 'Estado Civil', value: client.civil_status || '--' },
    { icon: 'briefcase', label: 'Profissão', value: client.profession || '--' },
    { icon: 'map-pin', label: 'Endereço', value: client.address || '--' },
  ];

  return (
    <View style={s.dSection}>
      <View style={s.dossierScoreCard}>
        <Text style={s.dossierScoreLbl}>Score de Risco</Text>
        <Text style={[s.dossierScoreVal, { color: riskColor(client.risk_score || 50) }]}>
          {riskLabel(client.risk_score || 50)}
        </Text>
        <View style={s.progBar}>
          <View style={[s.progFill, {
            width: `${client.risk_score || 50}%`,
            backgroundColor: riskColor(client.risk_score || 50)
          }]} />
        </View>
        <Text style={s.dossierScoreNum}>{client.risk_score || 50}% de risco litigioso</Text>
      </View>
      {rows.map(r => (
        <View key={r.label} style={s.dRow}>
          <View style={s.dRowIcon}><Feather name={r.icon} size={14} color="#606672" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.dRowLbl}>{r.label}</Text>
            <Text style={s.dRowVal}>{r.value}</Text>
          </View>
        </View>
      ))}
      {client.notes ? (
        <View style={s.notesBox}>
          <Text style={s.notesLbl}>📝 Notas Internas</Text>
          <Text style={s.notesTxt}>{client.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

function DossierInteractions({ interactions, loading, newNote, setNewNote, onSave, saving }) {
  return (
    <View style={s.dSection}>
      <Text style={s.dSectionTitle}>Nova Anotação</Text>
      <TextInput
        style={[s.fInput, { height: 80, textAlignVertical: 'top', marginBottom: 8 }]}
        placeholder="Descreva a interação com o cliente..."
        placeholderTextColor="#606672"
        value={newNote}
        onChangeText={setNewNote}
        multiline
      />
      <TouchableOpacity
        style={[s.saveBtn, { marginBottom: 20 }, (!newNote.trim() || saving) && { opacity: 0.5 }]}
        onPress={onSave}
        disabled={!newNote.trim() || saving}
      >
        {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnTxt}>+ Salvar Interação</Text>}
      </TouchableOpacity>

      <Text style={s.dSectionTitle}>Histórico ({interactions.length})</Text>
      {loading ? (
        <ActivityIndicator color="#f5c853" style={{ marginVertical: 16 }} />
      ) : interactions.length === 0 ? (
        <Text style={s.emptyTxt}>Nenhuma interação registrada.</Text>
      ) : (
        interactions.map(i => (
          <View key={i.id} style={s.interactionItem}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={s.interactionTypePill}>
                <Text style={s.interactionTypeTxt}>{i.type || 'nota'}</Text>
              </View>
              <Text style={s.interactionDate}>{fmtDate(i.created_at)}</Text>
            </View>
            <Text style={s.interactionContent}>{i.content}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function DossierFinance({ records, loading, showForm, setShowForm, financeForm, setFinanceForm, onSave, saving, onToggle }) {
  const total = records.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const recebido = records.filter(r => r.status === 'PAGO').reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  return (
    <View style={s.dSection}>
      {/* Summary */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View style={[s.finStat, { flex: 1 }]}>
          <Text style={s.finLbl}>TOTAL</Text>
          <Text style={s.finVal}>{currency(total)}</Text>
        </View>
        <View style={[s.finStat, { flex: 1 }]}>
          <Text style={s.finLbl}>RECEBIDO</Text>
          <Text style={[s.finVal, { color: '#10b981' }]}>{currency(recebido)}</Text>
        </View>
      </View>

      {/* Add button */}
      <TouchableOpacity style={[s.saveBtn, { marginBottom: 12, backgroundColor: 'rgba(245,200,83,0.12)', borderWidth: 1, borderColor: 'rgba(245,200,83,0.3)' }]} onPress={() => setShowForm(!showForm)}>
        <Text style={[s.saveBtnTxt, { color: '#f5c853' }]}>{showForm ? '▲ Fechar Formulário' : '+ Novo Lançamento'}</Text>
      </TouchableOpacity>

      {/* Finance form */}
      {showForm && (
        <View style={s.finForm}>
          {[
            { label: 'Descrição *', key: 'description', placeholder: 'Ex: Honorários - Audiência' },
            { label: 'Valor (R$) *', key: 'amount', placeholder: '0,00', keyboardType: 'decimal-pad' },
            { label: 'Vencimento (AAAA-MM-DD)', key: 'due_date', placeholder: '2025-05-31' },
          ].map(f => (
            <View key={f.key} style={s.fGroup}>
              <Text style={s.fLabel}>{f.label}</Text>
              <TextInput
                style={s.fInput}
                placeholder={f.placeholder}
                placeholderTextColor="#606672"
                value={financeForm[f.key]}
                onChangeText={v => setFinanceForm(p => ({ ...p, [f.key]: v }))}
                keyboardType={f.keyboardType || 'default'}
              />
            </View>
          ))}
          <Text style={s.fLabel}>STATUS</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {['PENDENTE', 'PAGO', 'CANCELADO'].map(st => (
              <TouchableOpacity
                key={st}
                style={[s.typeBtn, financeForm.status === st && s.typeBtnActive, { flex: 1 }]}
                onPress={() => setFinanceForm(p => ({ ...p, status: st }))}
              >
                <Text style={[s.typeBtnTxt, financeForm.status === st && { color: '#f5c853' }, { fontSize: 11 }]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnTxt}>Salvar Lançamento</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Records list */}
      <Text style={s.dSectionTitle}>Lançamentos ({records.length})</Text>
      {loading ? (
        <ActivityIndicator color="#f5c853" style={{ marginVertical: 16 }} />
      ) : records.length === 0 ? (
        <Text style={s.emptyTxt}>Nenhum lançamento registrado.</Text>
      ) : (
        records.map(r => (
          <View key={r.id} style={s.finRecord}>
            <View style={{ flex: 1 }}>
              <Text style={s.finRecordDesc}>{r.description}</Text>
              <Text style={s.finRecordDate}>Venc.: {fmtDate(r.due_date)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[s.finRecordAmt, { color: r.status === 'PAGO' ? '#10b981' : '#f5c853' }]}>
                {currency(r.amount)}
              </Text>
              <TouchableOpacity
                style={[s.statusPill, {
                  backgroundColor: r.status === 'PAGO' ? 'rgba(16,185,129,0.1)' :
                    r.status === 'CANCELADO' ? 'rgba(255,69,58,0.1)' : 'rgba(245,200,83,0.1)'
                }]}
                onPress={() => onToggle(r)}
              >
                <Text style={[s.statusPillTxt, {
                  color: r.status === 'PAGO' ? '#10b981' : r.status === 'CANCELADO' ? '#ff453a' : '#f5c853'
                }]}>
                  {r.status}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function DossierInsight({ insight, loading, onUpgrade }) {
  return (
    <View style={s.dSection}>
      <View style={s.insightCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Feather name="zap" size={18} color="#f5c853" />
          <Text style={s.insightTitle}>Análise de IA — KYC Jurídico</Text>
        </View>
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color="#f5c853" />
            <Text style={s.loadTxt}>Gerando análise com IA...</Text>
          </View>
        ) : insight === 'LIMIT_REACHED' ? (
          <View style={{ gap: 12, alignItems: 'center', paddingVertical: 10 }}>
            <Text style={[s.insightTxt, { color: '#ff453a', textAlign: 'center', fontWeight: 'bold' }]}>
              Você atingiu o limite de 5 insights do Plano START.
            </Text>
            <Text style={{ color: '#8e94a2', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>
              Faça upgrade para o Plano PRO para obter insights estratégicos de inteligência jurídica ilimitados para todos os seus clientes.
            </Text>
            <TouchableOpacity 
              style={[s.saveBtn, { backgroundColor: '#f5c853', width: '100%' }]}
              onPress={onUpgrade}
            >
              <Feather name="trending-up" size={16} color="#000" />
              <Text style={s.saveBtnTxt}>FAZER UPGRADE PARA PRO</Text>
            </TouchableOpacity>
          </View>
        ) : insight ? (
          <Text style={s.insightTxt}>{insight}</Text>
        ) : (
          <Text style={s.emptyTxt}>Toque em "Análise IA" para gerar um insight sobre este cliente.</Text>
        )}
      </View>
      {insight !== 'LIMIT_REACHED' && (
        <Text style={s.insightDisclaimer}>
          ⚠️ A análise de IA é um auxílio estratégico e não substitui o julgamento profissional do advogado.
        </Text>
      )}
    </View>
  );
}

function DossierCases({ cases, loading }) {
  const statusColor = (st) => st === 'ABERTO' ? '#10b981' : st === 'FECHADO' ? '#ff453a' : '#f5c853';
  return (
    <View style={s.dSection}>
      <Text style={s.dSectionTitle}>Casos Associados ({cases.length})</Text>
      {loading ? (
        <ActivityIndicator color="#f5c853" style={{ marginVertical: 16 }} />
      ) : cases.length === 0 ? (
        <Text style={s.emptyTxt}>Nenhum caso associado a este cliente.</Text>
      ) : (
        cases.map(c => (
          <View key={c.id} style={s.caseItem}>
            <View style={{ flex: 1 }}>
              <Text style={s.caseName}>{c.titulo || 'Sem título'}</Text>
              <Text style={s.caseArea}>{c.area_atuacao || 'Geral'} • {fmtDate(c.created_at)}</Text>
            </View>
            <View style={[s.statusPill, { backgroundColor: `${statusColor(c.status)}18` }]}>
              <Text style={[s.statusPillTxt, { color: statusColor(c.status) }]}>{c.status}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ─── UUID generator ───────────────────────────────────────────────
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ════════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090a0d' },
  scroll: { padding: 16 },
  center: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#12141c', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },

  // Header
  header: { marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: '#606672', marginTop: 2 },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1 },
  btnRed: { backgroundColor: 'rgba(255,69,58,0.08)', borderColor: 'rgba(255,69,58,0.2)' },
  btnGray: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
  btnGold: { backgroundColor: 'rgba(245,200,83,0.08)', borderColor: 'rgba(245,200,83,0.2)' },
  actionTxt: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  // Info box
  infoBox: { flexDirection: 'row', backgroundColor: '#12141c', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 14, marginBottom: 14 },
  infoIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(245,200,83,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#f5c853', marginBottom: 4 },
  infoText: { fontSize: 11, color: '#8e94a2', lineHeight: 16, marginBottom: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tagTxt: { fontSize: 10, color: '#606672', fontWeight: '600' },

  // Finance card
  finCard: { backgroundColor: '#12141c', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)', overflow: 'hidden', marginBottom: 14 },
  finHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(212,175,55,0.03)' },
  finTitle: { fontSize: 13, fontWeight: '800', color: '#fff' },
  finMonth: { fontSize: 9, color: '#606672', fontWeight: '600' },
  finGrid: { flexDirection: 'row', padding: 16, gap: 16 },
  finStat: { flex: 1, backgroundColor: '#1a1c28', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  finLbl: { fontSize: 9, color: '#606672', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  finVal: { fontSize: 16, fontWeight: '800', color: '#fff' },
  progSection: { paddingHorizontal: 16, paddingBottom: 14 },
  progPct: { fontSize: 12, fontWeight: '800', color: '#f5c853' },
  progBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: '#f5c853', borderRadius: 4 },
  finCount: { fontSize: 10, color: '#606672', marginTop: 6 },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12141c', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },

  // Empty / loading
  loadTxt: { color: '#606672', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTxt: { color: '#606672', fontSize: 13, marginTop: 10, textAlign: 'center', fontStyle: 'italic' },
  emptyBtn: { marginTop: 14, backgroundColor: 'rgba(245,200,83,0.1)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(245,200,83,0.2)' },
  emptyBtnTxt: { color: '#f5c853', fontSize: 13, fontWeight: '700' },

  // Client card
  clientCard: { backgroundColor: '#12141c', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 14, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e2130', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: '#f5c853' },
  clientName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  clientContact: { fontSize: 11, color: '#606672', marginTop: 2 },
  detailLbl: { fontSize: 9, color: '#606672', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  detailVal: { fontSize: 11, color: '#a3a9c2', fontWeight: '600' },
  riskPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, alignSelf: 'flex-start' },
  riskPillTxt: { fontSize: 10, fontWeight: '700' },
  statusTxt: { fontSize: 11, color: '#606672' },
  dossierBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(245,200,83,0.08)', borderWidth: 1, borderColor: 'rgba(245,200,83,0.2)' },
  dossierBtnTxt: { fontSize: 12, fontWeight: '700', color: '#f5c853' },

  // Modal shared
  modalHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#fff', flex: 1, marginRight: 12 },

  // Form
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1a1c28', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  typeBtnActive: { borderColor: '#f5c853', backgroundColor: 'rgba(245,200,83,0.08)' },
  typeBtnTxt: { fontSize: 12, fontWeight: '600', color: '#606672' },
  fGroup: { marginBottom: 12 },
  fLabel: { fontSize: 10, color: '#606672', fontWeight: '700', textTransform: 'uppercase', marginBottom: 5 },
  fInput: { backgroundColor: '#1a1c28', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12, color: '#fff', fontSize: 14 },
  saveBtn: { backgroundColor: '#f5c853', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  saveBtnTxt: { fontSize: 15, fontWeight: '800', color: '#000' },

  // Voice modal
  voiceInfoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#1a1c28', borderRadius: 8, padding: 12, marginBottom: 12, alignItems: 'flex-start' },
  voiceInfoTxt: { flex: 1, fontSize: 12, color: '#606672', lineHeight: 17 },
  voiceInput: { backgroundColor: '#1a1c28', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, color: '#fff', fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 12 },
  voiceActions: { flexDirection: 'row', gap: 10 },
  voiceCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  voiceCancelTxt: { fontSize: 14, color: '#a3a9c2', fontWeight: '600' },
  voiceProcessBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: '#f5c853', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  voiceProcessTxt: { fontSize: 14, fontWeight: '800', color: '#000' },
  voiceMicContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, backgroundColor: '#1a1c28', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  recordingPulseContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%', height: 120 },
  pulseCircle: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,69,58,0.15)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.4)' },
  recordingMicBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ff453a', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  idleMicContainer: { alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 10 },
  idleMicBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,69,58,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)' },
  recordingTimer: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 12 },
  recordingHint: { fontSize: 11, color: '#606672', marginTop: 6, textAlign: 'center', paddingHorizontal: 16 },

  // Dossier tabs
  tabBar: { flexGrow: 0, marginBottom: 12 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'transparent' },
  tabBtnActive: { backgroundColor: 'rgba(245,200,83,0.1)', borderColor: 'rgba(245,200,83,0.3)' },
  tabBtnTxt: { fontSize: 13, color: '#606672', fontWeight: '600' },
  tabBtnTxtActive: { color: '#f5c853' },

  // Dossier sections
  dSection: { paddingVertical: 4 },
  dSectionTitle: { fontSize: 12, fontWeight: '700', color: '#a3a9c2', textTransform: 'uppercase', marginBottom: 10, marginTop: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 6 },
  dossierScoreCard: { backgroundColor: '#1a1c28', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  dossierScoreLbl: { fontSize: 10, color: '#606672', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  dossierScoreVal: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  dossierScoreNum: { fontSize: 11, color: '#606672', marginTop: 6 },
  dRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  dRowIcon: { width: 28, paddingTop: 2 },
  dRowLbl: { fontSize: 10, color: '#606672', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  dRowVal: { fontSize: 13, color: '#a3a9c2' },
  notesBox: { backgroundColor: 'rgba(245,200,83,0.05)', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(245,200,83,0.1)' },
  notesLbl: { fontSize: 11, fontWeight: '700', color: '#f5c853', marginBottom: 4 },
  notesTxt: { fontSize: 13, color: '#a3a9c2', lineHeight: 18 },

  // Interactions
  interactionItem: { backgroundColor: '#1a1c28', borderRadius: 10, padding: 12, marginBottom: 8 },
  interactionTypePill: { backgroundColor: 'rgba(245,200,83,0.1)', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  interactionTypeTxt: { fontSize: 10, color: '#f5c853', fontWeight: '600', textTransform: 'uppercase' },
  interactionDate: { fontSize: 10, color: '#606672' },
  interactionContent: { fontSize: 13, color: '#a3a9c2', lineHeight: 18 },

  // Finance
  finForm: { backgroundColor: '#1a1c28', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  finRecord: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1c28', borderRadius: 10, padding: 12, marginBottom: 6 },
  finRecordDesc: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 },
  finRecordDate: { fontSize: 11, color: '#606672' },
  finRecordAmt: { fontSize: 14, fontWeight: '800' },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillTxt: { fontSize: 10, fontWeight: '700' },

  // Insight
  insightCard: { backgroundColor: '#1a1c28', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(245,200,83,0.1)', marginBottom: 12 },
  insightTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  insightTxt: { fontSize: 14, color: '#c8ccd8', lineHeight: 22 },
  insightDisclaimer: { fontSize: 11, color: '#606672', fontStyle: 'italic', textAlign: 'center' },

  // Cases
  caseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1c28', borderRadius: 10, padding: 12, marginBottom: 6 },
  caseName: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 },
  caseArea: { fontSize: 11, color: '#606672' },
});
