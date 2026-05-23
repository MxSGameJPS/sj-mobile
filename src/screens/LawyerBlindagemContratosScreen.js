import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Alert, Clipboard, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS } from '../styles/theme';
import { supabaseRealtime } from '../services/supabaseService';

const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function LawyerBlindagemContratosScreen({ route, navigation }) {
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

  // Form State
  const [tipo, setTipo] = useState('Prestação de Serviços');
  const [personality, setPersonality] = useState('Formal');
  const [comarca, setComarca] = useState('');
  const [local, setLocal] = useState('');
  const [data, setData] = useState(new Date().toLocaleDateString('pt-BR'));
  const [purpose, setPurpose] = useState('');

  // Parte 1 (Contratante)
  const [parte1, setParte1] = useState({ nome: '', cpf_cnpj: '', estado_civil: '', profissao: '', endereco: '' });
  // Parte 2 (Contratado)
  const [parte2, setParte2] = useState({ nome: '', cpf_cnpj: '', estado_civil: '', profissao: '', endereco: '' });

  // UI Flow State
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isShielding, setIsShielding] = useState(false);
  const [certificate, setCertificate] = useState(null);

  const handleGenerate = async () => {
    if (!purpose.trim()) {
      Alert.alert('Erro', 'Por favor, descreva o objetivo do contrato.');
      return;
    }

    setIsGenerating(true);
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      
      const payload = {
        type: `Contrato de ${tipo || 'Prestação de Serviços'}`,
        tone: personality,
        facts: `Objetivo do Contrato: ${purpose}\n\nComarca: ${comarca}\nLocal: ${local}\nData: ${data}\n\nParte 1 (Contratante): ${parte1.nome}, CPF/CNPJ: ${parte1.cpf_cnpj}, Estado Civil: ${parte1.estado_civil}, Profissão: ${parte1.profissao}, Endereço: ${parte1.endereco}\n\nParte 2 (Contratado): ${parte2.nome}, CPF/CNPJ: ${parte2.cpf_cnpj}, Estado Civil: ${parte2.estado_civil}, Profissão: ${parte2.profissao}, Endereço: ${parte2.endereco}`,
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
        Alert.alert('Erro', resJson.message || 'Erro ao gerar contrato');
      }
    } catch (err) {
      console.warn(err);
      Alert.alert('Erro', 'Falha na conexão ao gerar contrato');
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
        title: `Minuta de ${tipo}`
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
        name: uploadedFile.name || 'contrato_assinado.pdf',
        type: uploadedFile.mimeType || 'application/pdf',
      });
      formData.append('type', 'contrato');

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
        Alert.alert('✅ Sucesso', 'Contrato assinado blindado com sucesso!');
      } else {
        if (dataJson.error_type === 'INSUFFICIENT_JURIS') {
          Alert.alert('Saldo Insuficiente', 'Você precisa de 4 Juris para blindar o documento.');
        } else {
          Alert.alert('Erro', dataJson.message || 'Erro ao blindar contrato.');
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
        <Text style={styles.headerTitle}>Blindagem de Contratos</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {!showResult ? (
          // Passo 1: Formulário
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Tipo de Contrato</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Prestação de Serviços, Locação, etc."
              placeholderTextColor="#606672"
              value={tipo}
              onChangeText={setTipo}
            />

            {/* Parte 1 */}
            <View style={styles.cardContainer}>
              <Text style={styles.cardHeaderTitle}>Parte 1 (Contratante)</Text>
              <TextInput style={styles.cardInput} placeholder="Nome Completo" placeholderTextColor="#606672" value={parte1.nome} onChangeText={(v) => setParte1({...parte1, nome: v})} />
              <TextInput style={styles.cardInput} placeholder="CPF ou CNPJ" placeholderTextColor="#606672" value={parte1.cpf_cnpj} onChangeText={(v) => setParte1({...parte1, cpf_cnpj: v})} keyboardType="numeric" />
              <TextInput style={styles.cardInput} placeholder="Estado Civil" placeholderTextColor="#606672" value={parte1.estado_civil} onChangeText={(v) => setParte1({...parte1, estado_civil: v})} />
              <TextInput style={styles.cardInput} placeholder="Profissão" placeholderTextColor="#606672" value={parte1.profissao} onChangeText={(v) => setParte1({...parte1, profissao: v})} />
              <TextInput style={styles.cardInput} placeholder="Endereço Completo" placeholderTextColor="#606672" value={parte1.endereco} onChangeText={(v) => setParte1({...parte1, endereco: v})} />
            </View>

            {/* Parte 2 */}
            <View style={styles.cardContainer}>
              <Text style={styles.cardHeaderTitle}>Parte 2 (Contratado)</Text>
              <TextInput style={styles.cardInput} placeholder="Nome Completo" placeholderTextColor="#606672" value={parte2.nome} onChangeText={(v) => setParte2({...parte2, nome: v})} />
              <TextInput style={styles.cardInput} placeholder="CPF ou CNPJ" placeholderTextColor="#606672" value={parte2.cpf_cnpj} onChangeText={(v) => setParte2({...parte2, cpf_cnpj: v})} keyboardType="numeric" />
              <TextInput style={styles.cardInput} placeholder="Estado Civil" placeholderTextColor="#606672" value={parte2.estado_civil} onChangeText={(v) => setParte2({...parte2, estado_civil: v})} />
              <TextInput style={styles.cardInput} placeholder="Profissão" placeholderTextColor="#606672" value={parte2.profissao} onChangeText={(v) => setParte2({...parte2, profissao: v})} />
              <TextInput style={styles.cardInput} placeholder="Endereço Completo" placeholderTextColor="#606672" value={parte2.endereco} onChangeText={(v) => setParte2({...parte2, endereco: v})} />
            </View>

            <Text style={styles.sectionTitle}>Personalidade da IA</Text>
            <View style={styles.personalityContainer}>
              {['Técnica', 'Formal', 'Conciliadora'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.personalityBtn, personality === p && styles.personalityBtnActive]}
                  onPress={() => setPersonality(p)}
                >
                  <Text style={[styles.personalityBtnText, personality === p && styles.personalityBtnTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
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

            <Text style={styles.sectionTitle}>Objetivo do Contrato</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descreva detalhadamente o que você precisa que conste no contrato..."
              placeholderTextColor="#606672"
              value={purpose}
              onChangeText={setPurpose}
              multiline
              numberOfLines={6}
            />

            <TouchableOpacity 
              style={[styles.primaryBtn, isGenerating && { opacity: 0.7 }]} 
              onPress={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#0d0f12" />
              ) : (
                <Text style={styles.primaryBtnText}>Gerar Contrato</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // Passo 2: Resultado
          <View style={styles.resultContainer}>
            <Text style={styles.sectionTitle}>Minuta Gerada</Text>
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
                  <Text style={styles.secondaryBtnText}>Tentar Novamente</Text>
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
                    <Text style={styles.shieldTitle}>🛡️ Blindar Contrato Assinado</Text>
                    <Text style={styles.shieldDesc}>
                      Faça o upload do contrato assinado pelas partes para gerar a blindagem digital com validade legal e Hash SHA-512.
                    </Text>

                    <TouchableOpacity style={styles.fileSelector} onPress={handleSelectFile}>
                      <Feather name="upload-cloud" size={24} color="#f5c853" style={{ marginBottom: 8 }} />
                      <Text style={styles.fileSelectorText}>
                        {uploadedFile ? uploadedFile.name : 'Selecionar Contrato Assinado'}
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
                            <Text style={styles.confirmShieldBtnText}>Blindar Contrato Agora</Text>
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
  personalityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  personalityBtn: {
    flex: 1,
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  personalityBtnActive: {
    backgroundColor: '#f5c853',
    borderColor: '#f5c853',
  },
  personalityBtnText: {
    color: '#a0a5b0',
    fontSize: 13,
    fontWeight: '500',
  },
  personalityBtnTextActive: {
    color: '#0d0f12',
    fontWeight: 'bold',
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
