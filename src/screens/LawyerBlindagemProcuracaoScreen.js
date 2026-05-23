import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Alert, Clipboard, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS } from '../styles/theme';
import { supabaseRealtime } from '../services/supabaseService';

const SUPABASE_URL = 'https://uwkcdwlgobnhowumcdnp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3a2Nkd2xnb2JuaG93dW1jZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTEyNDIsImV4cCI6MjA4OTE4NzI0Mn0.Nz-2pITIzlzZW-sePHXAyW6Kz19p45vlMN22Z8VEYEk';
const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function LawyerBlindagemProcuracaoScreen({ route, navigation }) {
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

  // Form State
  const [outorgante, setOutorgante] = useState({ nome: '', cpf_cnpj: '', estado_civil: '', profissao: '', endereco: '' });
  const [outorgado, setOutorgado] = useState({ nome: '', oab: '', cpf: '', endereco: '' });
  const [comarca, setComarca] = useState('');
  const [local, setLocal] = useState('');
  const [data, setData] = useState(new Date().toLocaleDateString('pt-BR'));
  const [poderes, setPoderes] = useState('Ad Judicia et Extra');

  // UI Flow State
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isShielding, setIsShielding] = useState(false);
  const [certificate, setCertificate] = useState(null);

  const fetchCrmAndProfile = useCallback(async () => {
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      if (!user?.id || !accessToken) return;

      // 1. Fetch CRM Clients
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

      // 2. Fetch Lawyer Profile
      const profileRes = await fetch(`${WEB_API}/perfil`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      const profileJson = await profileRes.json();
      if (profileJson.success && profileJson.data) {
        const p = profileJson.data;
        setOutorgado(prev => ({
          ...prev,
          nome: p.name || user?.user_metadata?.name || '',
          oab: p.oab ? `${p.oab}/${p.estado || ''}` : '',
          cpf: '', // CPF is inputted manually
          endereco: p.endereco_completo || ''
        }));
        setLocal(p.estado || '');
      }
    } catch (e) {
      console.warn('Erro ao carregar CRM/Perfil:', e);
    }
  }, [user, session]);

  useEffect(() => {
    fetchCrmAndProfile();
  }, [fetchCrmAndProfile]);

  const handleSelectClient = (client) => {
    setOutorgante({
      nome: client.name || '',
      cpf_cnpj: client.cpf_cnpj || '',
      estado_civil: client.estado_civil || '',
      profissao: client.profissao || '',
      endereco: client.endereco_completo || ''
    });
    setShowClientPicker(false);
  };

  const handleGenerate = async () => {
    if (!poderes.trim()) {
      Alert.alert('Erro', 'Por favor, descreva os poderes outorgados.');
      return;
    }

    setIsGenerating(true);
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      
      const payload = {
        type: `Procuração`,
        tone: "Formal",
        facts: `Poderes: ${poderes}\n\nComarca: ${comarca}\nLocal: ${local}\nData: ${data}\n\nOutorgante: ${outorgante.nome}, CPF/CNPJ: ${outorgante.cpf_cnpj}, Estado Civil: ${outorgante.estado_civil}, Profissão: ${outorgante.profissao}, Endereço: ${outorgante.endereco}\n\nOutorgado: ${outorgado.nome}, OAB: ${outorgado.oab}, CPF: ${outorgado.cpf}, Endereço: ${outorgado.endereco}`,
        advocateData: { name: outorgado.nome, oab: outorgado.oab }
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
        Alert.alert('Erro', resJson.message || 'Erro ao gerar procuração');
      }
    } catch (err) {
      console.warn(err);
      Alert.alert('Erro', 'Falha na conexão ao gerar procuração');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyDraft = () => {
    Clipboard.setString(draft);
    Alert.alert('Copiado', 'Minuta copiada para a área de transferência!');
  };

  const handleShareDraft = async () => {
    try {
      await Share.share({
        message: draft,
        title: 'Minuta de Procuração'
      });
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setUploadedFile(result.assets[0]);
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Erro', 'Erro ao selecionar o arquivo.');
    }
  };

  const handleShieldDocument = async () => {
    if (!uploadedFile) {
      Alert.alert('Atenção', 'Selecione o arquivo assinado para blindar.');
      return;
    }

    setIsShielding(true);
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      
      const formData = new FormData();
      formData.append('file', {
        uri: uploadedFile.uri,
        name: uploadedFile.name || 'procuracao_assinada.pdf',
        type: uploadedFile.mimeType || 'application/pdf',
      });
      formData.append('type', 'procuracao');

      const res = await fetch(`${WEB_API}/crm/blindagem`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const dataJson = await res.json();
      if (dataJson.success) {
        setCertificate({
          protocol: dataJson.data.protocol,
          hash: dataJson.data.hash,
          date: new Date(dataJson.data.date).toLocaleString('pt-BR')
        });
        Alert.alert('✅ Sucesso', 'Procuração assinada blindada com sucesso!');
      } else {
        if (dataJson.error_type === 'INSUFFICIENT_JURIS') {
          Alert.alert('Saldo Insuficiente', 'Você precisa de 4 Juris para blindar o documento.');
        } else {
          Alert.alert('Erro', dataJson.message || 'Erro ao blindar procuração.');
        }
      }
    } catch (err) {
      console.warn(err);
      Alert.alert('Erro', 'Falha na conexão ao enviar blindagem.');
    } finally {
      setIsShielding(false);
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
        <Text style={styles.headerTitle}>Blindagem de Procuração</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {!showResult ? (
          // Passo 1: Formulário
          <View style={styles.formContainer}>
            
            {/* Outorgante */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderWithAction}>
                <Text style={styles.cardHeaderTitle}>Outorgante</Text>
                {crmClients.length > 0 && (
                  <TouchableOpacity 
                    style={styles.crmSelectorLink}
                    onPress={() => setShowClientPicker(!showClientPicker)}
                  >
                    <Text style={styles.crmSelectorLinkText}>
                      {showClientPicker ? 'Fechar CRM' : 'Puxar do CRM (Opcional)'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {showClientPicker && (
                <View style={styles.crmListWrapper}>
                  {crmClients.map((client) => (
                    <TouchableOpacity 
                      key={client.id} 
                      style={styles.crmClientItem}
                      onPress={() => handleSelectClient(client)}
                    >
                      <Text style={styles.crmClientItemName}>{client.name}</Text>
                      {client.cpf_cnpj ? <Text style={styles.crmClientItemDetail}>{client.cpf_cnpj}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TextInput style={styles.cardInput} placeholder="Nome Completo" placeholderTextColor="#606672" value={outorgante.nome} onChangeText={(v) => setOutorgante({...outorgante, nome: v})} />
              <TextInput style={styles.cardInput} placeholder="CPF ou CNPJ" placeholderTextColor="#606672" value={outorgante.cpf_cnpj} onChangeText={(v) => setOutorgante({...outorgante, cpf_cnpj: v})} keyboardType="numeric" />
              <TextInput style={styles.cardInput} placeholder="Estado Civil" placeholderTextColor="#606672" value={outorgante.estado_civil} onChangeText={(v) => setOutorgante({...outorgante, estado_civil: v})} />
              <TextInput style={styles.cardInput} placeholder="Profissão" placeholderTextColor="#606672" value={outorgante.profissao} onChangeText={(v) => setOutorgante({...outorgante, profissao: v})} />
              <TextInput style={styles.cardInput} placeholder="Endereço Completo" placeholderTextColor="#606672" value={outorgante.endereco} onChangeText={(v) => setOutorgante({...outorgante, endereco: v})} />
            </View>

            {/* Outorgado */}
            <View style={styles.cardContainer}>
              <Text style={styles.cardHeaderTitle}>Outorgado (Advogado)</Text>
              <TextInput style={styles.cardInput} placeholder="Nome Completo" placeholderTextColor="#606672" value={outorgado.nome} onChangeText={(v) => setOutorgado({...outorgado, nome: v})} />
              <TextInput style={styles.cardInput} placeholder="OAB (Ex: 123456/SP)" placeholderTextColor="#606672" value={outorgado.oab} onChangeText={(v) => setOutorgado({...outorgado, oab: v})} />
              <TextInput style={styles.cardInput} placeholder="CPF" placeholderTextColor="#606672" value={outorgado.cpf} onChangeText={(v) => setOutorgado({...outorgado, cpf: v})} keyboardType="numeric" />
              <TextInput style={styles.cardInput} placeholder="Endereço Profissional" placeholderTextColor="#606672" value={outorgado.endereco} onChangeText={(v) => setOutorgado({...outorgado, endereco: v})} />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.rowLabel}>Comarca</Text>
                <TextInput style={styles.rowInput} placeholder="Ex: São Paulo - SP" placeholderTextColor="#606672" value={comarca} onChangeText={setComarca} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.rowLabel}>Local</Text>
                <TextInput style={styles.rowInput} placeholder="Ex: São Paulo" placeholderTextColor="#606672" value={local} onChangeText={setLocal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Data</Text>
                <TextInput style={styles.rowInput} placeholder="DD/MM/AAAA" placeholderTextColor="#606672" value={data} onChangeText={setData} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Poderes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descreva os poderes outorgados na procuração..."
              placeholderTextColor="#606672"
              value={poderes}
              onChangeText={setPoderes}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity 
              style={[styles.primaryBtn, isGenerating && { opacity: 0.7 }]} 
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#0d0f12" />
              ) : (
                <Text style={styles.primaryBtnText}>Gerar Procuração</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // Passo 2: Resultado
          <View style={styles.resultContainer}>
            <Text style={styles.sectionTitle}>Procuração Gerada</Text>
            <View style={styles.draftBox}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
                <Text style={styles.draftText}>{draft}</Text>
              </ScrollView>
            </View>

            {!confirmed ? (
              <View style={styles.btnRow}>
                <TouchableOpacity 
                  style={[styles.secondaryBtn, { flex: 1, marginRight: 10 }]} 
                  onPress={() => setShowResult(false)}
                >
                  <Text style={styles.secondaryBtnText}>Voltar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]} 
                  onPress={() => setConfirmed(true)}
                >
                  <Text style={styles.primaryBtnText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.shieldSection}>
                <View style={styles.shareButtonsContainer}>
                  <TouchableOpacity style={styles.iconActionBtn} onPress={handleCopyDraft}>
                    <Feather name="copy" size={16} color="#f5c853" style={{ marginRight: 6 }} />
                    <Text style={styles.iconActionBtnText}>Copiar Texto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconActionBtn} onPress={handleShareDraft}>
                    <Feather name="share-2" size={16} color="#f5c853" style={{ marginRight: 6 }} />
                    <Text style={styles.iconActionBtnText}>Compartilhar</Text>
                  </TouchableOpacity>
                </View>

                {certificate ? (
                  <View style={styles.certificateBox}>
                    <Feather name="check-circle" size={40} color="#2ecc71" style={{ marginBottom: 12 }} />
                    <Text style={styles.certTitle}>Documento Blindado!</Text>
                    <Text style={styles.certLabel}>Protocolo:</Text>
                    <Text style={styles.certVal}>{certificate.protocol}</Text>
                    <Text style={styles.certLabel}>Hash SHA-512:</Text>
                    <Text style={[styles.certVal, { fontSize: 10 }]}>{certificate.hash}</Text>
                    <Text style={styles.certLabel}>Data do Registro:</Text>
                    <Text style={styles.certVal}>{certificate.date}</Text>
                  </View>
                ) : (
                  <View style={styles.uploadSection}>
                    <Text style={styles.shieldTitle}>🛡️ Blindar Procuração Assinada</Text>
                    <Text style={styles.shieldDesc}>
                      Faça o upload da procuração assinada digitalmente ou fisicamente para registrar a blindagem blockchain com validade jurídica.
                    </Text>

                    <TouchableOpacity style={styles.fileSelector} onPress={handleSelectFile}>
                      <Feather name="upload-cloud" size={24} color="#f5c853" style={{ marginBottom: 8 }} />
                      <Text style={styles.fileSelectorText}>
                        {uploadedFile ? uploadedFile.name : 'Selecionar Procuração Assinada'}
                      </Text>
                    </TouchableOpacity>

                    {uploadedFile && (
                      <TouchableOpacity 
                        style={[styles.confirmShieldBtn, isShielding && { opacity: 0.7 }]}
                        onPress={handleShieldDocument}
                        disabled={isShielding}
                      >
                        {isShielding ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <>
                            <Feather name="shield" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.confirmShieldBtnText}>Blindar Procuração Agora</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <TouchableOpacity 
                  style={[styles.secondaryBtn, { marginTop: 20 }]} 
                  onPress={() => {
                    setShowResult(false);
                    setConfirmed(false);
                    setUploadedFile(null);
                    setCertificate(null);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Voltar ao Início</Text>
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
  sectionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
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
    height: 100,
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
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  crmSelectorLink: {
    paddingVertical: 2,
  },
  crmSelectorLinkText: {
    color: '#f5c853',
    fontSize: 12,
    fontWeight: 'bold',
  },
  crmListWrapper: {
    backgroundColor: '#1c202a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2c313c',
    padding: 10,
    marginBottom: 12,
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
  row: {
    flexDirection: 'row',
    marginTop: 16,
  },
  rowLabel: {
    color: '#a0a5b0',
    fontSize: 12,
    marginBottom: 6,
  },
  rowInput: {
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 6,
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
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
  btnRow: {
    flexDirection: 'row',
    marginTop: 10,
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
  shieldSection: {
    marginTop: 10,
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
  uploadSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 12,
    padding: 20,
  },
  shieldTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  shieldDesc: {
    color: '#8e94a2',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  fileSelector: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#2c313c',
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  fileSelectorText: {
    color: '#a0a5b0',
    fontSize: 13,
  },
  confirmShieldBtn: {
    backgroundColor: '#2ecc71',
    flexDirection: 'row',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmShieldBtnText: {
    color: '#ffffff',
    fontSize: 14,
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
  }
});
