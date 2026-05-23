import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
  Clipboard,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS } from '../styles/theme';

const { width } = Dimensions.get('window');
const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function LawyerDigitalSignatureScreen({ route, navigation }) {
  const { user, session } = route.params || {};
  const accessToken = route.params?.accessToken || session?.accessToken || session?.access_token;

  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState(null);

  // Form de criação
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('contrato'); // contrato, procuracao, outro
  const [selectedFile, setSelectedFile] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [lawyerName, setLawyerName] = useState(user?.user_metadata?.name || 'Advogado');
  const [lawyerEmail, setLawyerEmail] = useState(user?.email || '');
  const [isCreating, setIsCreating] = useState(false);

  // Form de assinatura (OTP)
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [stampPosition, setStampPosition] = useState('footer-left');
  const [stampPage, setStampPage] = useState('');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  // Buscar processos de assinatura
  const fetchSignatures = useCallback(async (isRefresh = false) => {
    if (!accessToken) return;
    if (!isRefresh) setLoading(true);

    try {
      const res = await fetch(`${WEB_API}/crm/assinatura`, {
        method: 'GET',
        headers: authHeaders,
      });
      const resData = await res.json();
      if (resData.success) {
        setSignatures(resData.data || []);
      }
    } catch (e) {
      console.error('[LawyerDigitalSignatureScreen] fetchSignatures error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSignatures(true);
  };

  // Selecionar documento PDF
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file);
        if (!docName) {
          // Preenche o nome do documento tirando a extensão se estiver vazio
          const cleanName = file.name.replace(/\.[^/.]+$/, "");
          setDocName(cleanName);
        }
      }
    } catch (err) {
      console.error('[DocumentPicker] error:', err);
      Alert.alert('Erro', 'Falha ao selecionar arquivo');
    }
  };

  // Criar Novo Processo de Assinatura
  const handleCreateProcess = async () => {
    if (!selectedFile) {
      Alert.alert('Atenção', 'Selecione um arquivo PDF.');
      return;
    }
    if (!docName.trim() || !clientName.trim() || !clientEmail.trim() || !lawyerName.trim() || !lawyerEmail.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios.');
      return;
    }

    setIsCreating(true);
    try {
      // 1. Upload do PDF original
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name || 'documento.pdf',
        type: 'application/pdf',
      });

      const uploadRes = await fetch(`${WEB_API}/crm/assinatura/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.message || 'Erro ao subir o arquivo PDF');
      }

      // 2. Iniciar o processo
      const payload = {
        document_name: docName,
        document_type: docType,
        document_url: uploadData.data.document_url,
        original_hash: uploadData.data.original_hash,
        lawyer_name: lawyerName,
        lawyer_email: lawyerEmail,
        client_name: clientName,
        client_email: clientEmail,
      };

      const res = await fetch(`${WEB_API}/crm/assinatura`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (resData.success) {
        Alert.alert('Sucesso', 'Processo de assinatura iniciado com sucesso!');
        setShowCreateModal(false);
        // Limpar form
        setDocName('');
        setSelectedFile(null);
        setClientName('');
        setClientEmail('');
        fetchSignatures();
      } else {
        Alert.alert('Erro', resData.message || 'Falha ao iniciar processo');
      }
    } catch (e) {
      console.error('[CreateProcess] error:', e);
      Alert.alert('Erro', e.message || 'Erro ao conectar ao servidor');
    } finally {
      setIsCreating(false);
    }
  };

  // Copiar link do cliente
  const handleCopyClientLink = (item) => {
    const link = `https://socialjuridico.com.br/assinatura/${item.id}?role=client`;
    Clipboard.setString(link);
    Alert.alert('Copiado', 'Link de assinatura do cliente copiado para a área de transferência!');
  };

  // Reenviar e-mail para o cliente
  const handleResendClientEmail = async (item) => {
    try {
      const res = await fetch(`${WEB_API}/crm/assinatura/enviar-otp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ signature_id: item.id, role: 'client' }),
      });
      const resData = await res.json();
      if (resData.success) {
        Alert.alert('Sucesso', 'E-mail enviado ao cliente com código de assinatura!');
      } else {
        Alert.alert('Erro', resData.message || 'Falha ao reenviar e-mail');
      }
    } catch (e) {
      console.error('[ResendEmail] error:', e);
      Alert.alert('Erro', 'Falha ao conectar com o servidor');
    }
  };

  // Enviar código OTP para o Advogado (Iniciar assinatura do advogado)
  const handleSendLawyerOtp = async () => {
    if (!selectedSignature) return;
    setIsSendingOtp(true);
    try {
      const res = await fetch(`${WEB_API}/crm/assinatura/enviar-otp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ signature_id: selectedSignature.id, role: 'lawyer' }),
      });
      const resData = await res.json();
      if (resData.success) {
        setOtpSent(true);
        Alert.alert('Código Enviado', 'O código de verificação foi enviado para o seu e-mail.');
      } else {
        Alert.alert('Erro', resData.message || 'Falha ao enviar código');
      }
    } catch (e) {
      console.error('[SendOtp] error:', e);
      Alert.alert('Erro', 'Falha de conexão com o servidor');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Confirmar OTP e Assinar documento
  const handleVerifyLawyerOtpAndSign = async () => {
    if (!selectedSignature || !otpCode.trim()) return;
    setIsSubmittingSignature(true);
    try {
      const res = await fetch(`${WEB_API}/crm/assinatura/validar-otp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          signature_id: selectedSignature.id,
          role: 'lawyer',
          code: otpCode.trim(),
          stamp_page: stampPage ? parseInt(stampPage) : undefined,
          stamp_position: stampPosition,
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        Alert.alert('Sucesso', 'Documento assinado digitalmente com sucesso!');
        setShowSignModal(false);
        setOtpCode('');
        setOtpSent(false);
        fetchSignatures();
      } else {
        Alert.alert('Código Inválido', resData.message || 'Código incorreto ou expirado');
      }
    } catch (e) {
      console.error('[Sign] error:', e);
      Alert.alert('Erro', 'Erro ao processar assinatura eletrônica');
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  // Ações de links externos
  const handleOpenPdf = (url) => {
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert('Aviso', 'URL do documento indisponível');
    }
  };

  const handleOpenCertificado = (code) => {
    if (code) {
      Linking.openURL(`https://socialjuridico.com.br/validar?code=${code}`);
    }
  };

  // Métricas
  const totalProcessos = signatures.length;
  const assinados = signatures.filter(s => s.status === 'signed').length;
  const aguardando = signatures.filter(s => s.status !== 'signed').length;

  const renderItem = ({ item }) => {
    const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : (item.metadata || {});
    const lawyerSigned = meta.lawyer?.signed;
    const clientSigned = meta.client?.signed;

    let borderLeftColor = '#f5c853'; // Pendente / Parcialmente
    let badgeText = 'Pendente';
    let badgeBg = 'rgba(245, 200, 83, 0.1)';
    let badgeBorderColor = 'rgba(245, 200, 83, 0.3)';
    let badgeTextColor = '#f5c853';
    let statusIcon = 'timer-sand';

    if (item.status === 'signed') {
      borderLeftColor = '#2ecc71';
      badgeText = 'Assinado';
      badgeBg = 'rgba(46, 204, 113, 0.1)';
      badgeBorderColor = 'rgba(46, 204, 113, 0.3)';
      badgeTextColor = '#2ecc71';
      statusIcon = 'check-circle';
    } else if (item.status === 'partially_signed') {
      borderLeftColor = '#e2b13c';
      badgeText = 'Parcialmente';
      badgeBg = 'rgba(226, 177, 60, 0.1)';
      badgeBorderColor = 'rgba(226, 177, 60, 0.3)';
      badgeTextColor = '#e2b13c';
      statusIcon = 'clock-outline';
    }

    return (
      <View style={[styles.card, { borderLeftColor }]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.docInfo}>
            <Feather name="file-text" size={18} color="#f5c853" style={{ marginRight: 8 }} />
            <Text style={styles.docName} numberOfLines={1}>{item.document_name}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badgeBg, borderColor: badgeBorderColor }]}>
            <MaterialCommunityIcons name={statusIcon} size={10} color={badgeTextColor} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: badgeTextColor }]}>{badgeText}</Text>
          </View>
        </View>

        {/* Code */}
        <Text style={styles.codeText}>{item.verification_code}</Text>

        {/* Signers Row */}
        <View style={styles.signersRow}>
          <View style={styles.signerCol}>
            <Text style={styles.signerLabel}>ADV: {meta.lawyer?.name || 'Advogado'}</Text>
            <View style={styles.signerStatus}>
              {lawyerSigned ? (
                <>
                  <Feather name="check" size={12} color="#2ecc71" style={{ marginRight: 4 }} />
                  <Text style={[styles.signerStatusText, { color: '#2ecc71' }]}>Assinado</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="circle-slice-8" size={12} color="#f5c853" style={{ marginRight: 4 }} />
                  <Text style={[styles.signerStatusText, { color: '#f5c853' }]}>Pendente</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.signerCol}>
            <Text style={styles.signerLabel}>CLI: {meta.client?.name || 'Cliente'}</Text>
            <View style={styles.signerStatus}>
              {clientSigned ? (
                <>
                  <Feather name="check" size={12} color="#2ecc71" style={{ marginRight: 4 }} />
                  <Text style={[styles.signerStatusText, { color: '#2ecc71' }]}>Assinado</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="circle-slice-8" size={12} color="#f5c853" style={{ marginRight: 4 }} />
                  <Text style={[styles.signerStatusText, { color: '#f5c853' }]}>Pendente</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString('pt-BR')}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {item.status === 'partially_signed' && (
              <>
                <TouchableOpacity style={styles.outlineActionBtn} onPress={() => handleCopyClientLink(item)}>
                  <Text style={styles.outlineActionBtnText}>Link Cliente</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.outlineActionBtn, { marginLeft: 8 }]} onPress={() => handleResendClientEmail(item)}>
                  <Text style={styles.outlineActionBtnText}>Reenviar e-mail</Text>
                </TouchableOpacity>
              </>
            )}

            {item.status === 'signed' && (
              <>
                <TouchableOpacity style={styles.outlineActionBtn} onPress={() => handleOpenPdf(item.document_url)}>
                  <Feather name="download" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.outlineActionBtnText}>Baixar PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filledGoldBtn, { marginLeft: 8 }]} onPress={() => handleOpenCertificado(item.verification_code)}>
                  <Text style={styles.filledGoldBtnText}>Certificado</Text>
                </TouchableOpacity>
              </>
            )}

            {(item.status === 'pending' || !lawyerSigned) && (
              <TouchableOpacity
                style={styles.outlineActionBtn}
                onPress={() => {
                  setSelectedSignature(item);
                  setShowSignModal(true);
                }}
              >
                <Feather name="edit-3" size={12} color="#f5c853" style={{ marginRight: 4 }} />
                <Text style={[styles.outlineActionBtnText, { color: '#f5c853' }]}>Assinar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#f5c853" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assinatura Digital</Text>
        <Feather name="edit-3" size={20} color="#f5c853" style={{ padding: 4 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5c853" />
        }
      >
        <Text style={styles.subtitle}>
          Assine documentos com carimbo de tempo eletrônico e validade jurídica equivalente à assinatura física.
        </Text>

        {/* Button Iniciar Novo Processo */}
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Feather name="plus" size={18} color="#090a0d" style={{ marginRight: 6 }} />
          <Text style={styles.createBtnText}>Iniciar Novo Processo</Text>
        </TouchableOpacity>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.totalBox}>
            <Text style={styles.statsLabel}>TOTAL DE PROCESSOS</Text>
            <Text style={styles.statsValue}>{totalProcessos}</Text>
          </View>
          <View style={styles.subStatsContainer}>
            <View style={[styles.statsCard, { marginRight: 8 }]}>
              <Text style={[styles.statsLabel, { color: '#2ecc71' }]}>ASSINADOS</Text>
              <Text style={[styles.statsValue, { color: '#2ecc71' }]}>{assinados}</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={[styles.statsLabel, { color: '#f5c853' }]}>AGUARDANDO</Text>
              <Text style={[styles.statsValue, { color: '#f5c853' }]}>{aguardando}</Text>
            </View>
          </View>
        </View>

        {/* Feed List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#f5c853" />
            <Text style={styles.loadingText}>Carregando processos...</Text>
          </View>
        ) : (
          <FlatList
            data={signatures}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            scrollEnabled={false} // FlatList dentro de ScrollView
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Feather name="file-text" size={40} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>Nenhum processo de assinatura criado.</Text>
              </View>
            }
          />
        )}
      </ScrollView>

      {/* Modal: Iniciar Novo Processo */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Processo de Assinatura</Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); setSelectedFile(null); }}>
                <Feather name="x" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* Document Picker */}
              <TouchableOpacity style={styles.pickerBtn} onPress={handlePickDocument}>
                <Feather name="upload-cloud" size={24} color="#f5c853" style={{ marginBottom: 8 }} />
                <Text style={styles.pickerBtnText}>
                  {selectedFile ? selectedFile.name : 'Selecionar Documento PDF'}
                </Text>
                {selectedFile && (
                  <Text style={styles.pickerFileSize}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Nome do Documento *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Contrato de Prestação de Serviços"
                placeholderTextColor="#606672"
                value={docName}
                onChangeText={setDocName}
              />

              <Text style={styles.inputLabel}>Tipo de Documento</Text>
              <View style={styles.typeSelectorRow}>
                {['contrato', 'procuracao', 'outro'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeSelectBtn, docType === type && styles.typeSelectBtnActive]}
                    onPress={() => setDocType(type)}
                  >
                    <Text style={[styles.typeSelectBtnText, docType === type && styles.typeSelectBtnTextActive]}>
                      {type === 'contrato' ? 'Contrato' : type === 'procuracao' ? 'Procuração' : 'Outro'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Nome do Cliente *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome completo do cliente"
                placeholderTextColor="#606672"
                value={clientName}
                onChangeText={setClientName}
              />

              <Text style={styles.inputLabel}>E-mail do Cliente *</Text>
              <TextInput
                style={styles.input}
                placeholder="cliente@email.com"
                placeholderTextColor="#606672"
                keyboardType="email-address"
                autoCapitalize="none"
                value={clientEmail}
                onChangeText={setClientEmail}
              />

              <Text style={styles.inputLabel}>Nome do Advogado *</Text>
              <TextInput
                style={styles.input}
                placeholder="Seu nome"
                placeholderTextColor="#606672"
                value={lawyerName}
                onChangeText={setLawyerName}
              />

              <Text style={styles.inputLabel}>E-mail do Advogado *</Text>
              <TextInput
                style={styles.input}
                placeholder="advogado@email.com"
                placeholderTextColor="#606672"
                keyboardType="email-address"
                autoCapitalize="none"
                value={lawyerEmail}
                onChangeText={setLawyerEmail}
              />

              {isCreating ? (
                <ActivityIndicator size="large" color="#f5c853" style={{ marginTop: 24 }} />
              ) : (
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreateProcess}>
                  <Text style={styles.submitBtnText}>Iniciar Processo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal: Assinar Documento OTP */}
      <Modal visible={showSignModal} animationType="fade" transparent>
        <View style={styles.signOverlay}>
          <View style={styles.signContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assinar Documento</Text>
              <TouchableOpacity onPress={() => { setShowSignModal(false); setOtpSent(false); setOtpCode(''); setStampPage(''); setStampPosition('footer-left'); }}>
                <Feather name="x" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.signSub}>
              {selectedSignature?.document_name}
            </Text>

            {!otpSent ? (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <Text style={styles.inputLabel}>Página para o Carimbo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Número da Página (Em branco para a última)"
                  placeholderTextColor="#606672"
                  keyboardType="number-pad"
                  value={stampPage}
                  onChangeText={setStampPage}
                />

                <Text style={styles.inputLabel}>Posição do Selo</Text>
                <Text style={styles.gridHint}>Escolha em qual região da página o selo de assinatura será fixado:</Text>
                
                {/* 3x3 Grid Visual Selector */}
                <View style={styles.gridContainer}>
                  {/* Row 1: Header */}
                  <View style={styles.gridRow}>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'header-left' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('header-left')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'header-left' && styles.gridCellTextSelected]}>Sup. Esq.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'header-center' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('header-center')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'header-center' && styles.gridCellTextSelected]}>Sup. Centro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'header-right' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('header-right')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'header-right' && styles.gridCellTextSelected]}>Sup. Dir.</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Row 2: Middle */}
                  <View style={styles.gridRow}>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'middle-left' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('middle-left')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'middle-left' && styles.gridCellTextSelected]}>Meio Esq.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'middle-center' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('middle-center')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'middle-center' && styles.gridCellTextSelected]}>Meio Centro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'middle-right' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('middle-right')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'middle-right' && styles.gridCellTextSelected]}>Meio Dir.</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Row 3: Footer */}
                  <View style={styles.gridRow}>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'footer-left' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('footer-left')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'footer-left' && styles.gridCellTextSelected]}>Inf. Esq.</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'footer-center' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('footer-center')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'footer-center' && styles.gridCellTextSelected]}>Inf. Centro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.gridCell, stampPosition === 'footer-right' && styles.gridCellSelected]}
                      onPress={() => setStampPosition('footer-right')}
                    >
                      <Text style={[styles.gridCellText, stampPosition === 'footer-right' && styles.gridCellTextSelected]}>Inf. Dir.</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.signInstructions}>
                  Para concluir a assinatura, enviaremos um código OTP de 6 dígitos no seu e-mail cadastrado ({lawyerEmail}).
                </Text>

                {isSendingOtp ? (
                  <ActivityIndicator size="small" color="#f5c853" style={{ marginVertical: 16 }} />
                ) : (
                  <TouchableOpacity style={styles.sendOtpBtn} onPress={handleSendLawyerOtp}>
                    <Feather name="mail" size={16} color="#090a0d" style={{ marginRight: 6 }} />
                    <Text style={styles.sendOtpBtnText}>Enviar Código por E-mail</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : (
              <View style={{ paddingVertical: 12 }}>
                <Text style={styles.selectedPositionText}>
                  Selo configurado na página {stampPage || 'última'} na posição {
                    stampPosition === 'footer-left' ? 'Inf. Esq. (Rodapé)' :
                    stampPosition === 'footer-center' ? 'Inf. Centro (Rodapé)' :
                    stampPosition === 'footer-right' ? 'Inf. Dir. (Rodapé)' :
                    stampPosition === 'header-left' ? 'Sup. Esq. (Cabeçalho)' :
                    stampPosition === 'header-center' ? 'Sup. Centro (Cabeçalho)' :
                    stampPosition === 'header-right' ? 'Sup. Dir. (Cabeçalho)' :
                    stampPosition === 'middle-left' ? 'Meio Esq.' :
                    stampPosition === 'middle-center' ? 'Meio Centro' : 'Meio Dir.'
                  }.
                </Text>

                <Text style={styles.signInstructions}>
                  Digite o código de 6 dígitos que enviamos para o seu e-mail:
                </Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor="#606672"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                
                {isSubmittingSignature ? (
                  <ActivityIndicator size="small" color="#f5c853" style={{ marginTop: 16 }} />
                ) : (
                  <TouchableOpacity style={styles.submitBtn} onPress={handleVerifyLawyerOtpAndSign}>
                    <Feather name="edit-3" size={16} color="#090a0d" style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>Confirmar Assinatura</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={{ alignSelf: 'center', marginTop: 16 }} onPress={handleSendLawyerOtp}>
                  <Text style={styles.resendOtpText}>Reenviar código</Text>
                </TouchableOpacity>
              </View>
            )}
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
    borderBottomColor: '#16191f',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  subtitle: {
    color: '#a3a9c2',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5c853',
    borderRadius: 24,
    paddingVertical: 14,
    marginBottom: 24,
  },
  createBtnText: {
    color: '#090a0d',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsRow: {
    marginBottom: 24,
  },
  totalBox: {
    backgroundColor: '#12141c',
    borderWidth: 1,
    borderColor: '#1f222b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  subStatsContainer: {
    flexDirection: 'row',
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#12141c',
    borderWidth: 1,
    borderColor: '#1f222b',
    borderRadius: 12,
    padding: 16,
  },
  statsLabel: {
    color: '#a3a9c2',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  statsValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 6,
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#a3a9c2',
    marginTop: 12,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#606672',
    marginTop: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#12141c',
    borderWidth: 1,
    borderColor: '#1f222b',
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  docName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  codeText: {
    color: '#7a808f',
    fontSize: 11,
    marginBottom: 12,
  },
  signersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  signerCol: {
    flex: 1,
  },
  signerLabel: {
    color: '#a0a5b0',
    fontSize: 11,
    marginBottom: 4,
  },
  signerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signerStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1f222b',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    color: '#7a808f',
    fontSize: 11,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#606672',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  outlineActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  filledGoldBtn: {
    backgroundColor: '#f5c853',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filledGoldBtnText: {
    color: '#090a0d',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Modal Novo Processo
  modalOverlay: {
    flex: 1,
    backgroundColor: '#090a0d',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#16191f',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pickerBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#f5c853',
    backgroundColor: '#12141c',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pickerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  pickerFileSize: {
    color: '#7a808f',
    fontSize: 11,
    marginTop: 4,
  },
  inputLabel: {
    color: '#f5c853',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#12141c',
    borderWidth: 1,
    borderColor: '#1f222b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 16,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  typeSelectBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12141c',
    borderWidth: 1,
    borderColor: '#1f222b',
    borderRadius: 8,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  typeSelectBtnActive: {
    borderColor: '#f5c853',
    backgroundColor: 'rgba(245, 200, 83, 0.08)',
  },
  typeSelectBtnText: {
    color: '#a3a9c2',
    fontSize: 12,
    fontWeight: 'bold',
  },
  typeSelectBtnTextActive: {
    color: '#f5c853',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 10,
  },
  submitBtnText: {
    color: '#090a0d',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Modal OTP Assinar
  signOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  signContent: {
    width: '100%',
    backgroundColor: '#12141c',
    borderWidth: 1,
    borderColor: '#3a341e',
    borderRadius: 16,
    padding: 20,
  },
  signSub: {
    color: '#f5c853',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  signInstructions: {
    color: '#a3a9c2',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  sendOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 12,
  },
  sendOtpBtnText: {
    color: '#090a0d',
    fontSize: 13,
    fontWeight: 'bold',
  },
  otpInput: {
    backgroundColor: '#090a0d',
    borderWidth: 1.5,
    borderColor: '#f5c853',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 20,
  },
  resendOtpText: {
    color: '#7a808f',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  gridContainer: {
    marginVertical: 12,
    backgroundColor: '#16191f',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f222b',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  gridCell: {
    flex: 1,
    height: 40,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#3a3a4a',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12141c',
  },
  gridCellSelected: {
    borderColor: '#f5c853',
    backgroundColor: 'rgba(245, 200, 83, 0.15)',
  },
  gridCellText: {
    color: '#a3a9c2',
    fontSize: 9,
    fontWeight: 'bold',
  },
  gridCellTextSelected: {
    color: '#f5c853',
  },
  gridHint: {
    color: '#7a808f',
    fontSize: 11,
    marginBottom: 4,
  },
  selectedPositionText: {
    color: '#f5c853',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(245, 200, 83, 0.08)',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 83, 0.2)',
  },
});
