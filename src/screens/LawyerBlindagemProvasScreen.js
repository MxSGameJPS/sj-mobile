import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS } from '../styles/theme';

const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function LawyerBlindagemProvasScreen({ route, navigation }) {
  const { user, session } = route.params || {};

  const [uploadedFile, setUploadedFile] = useState(null);
  const [isShielding, setIsShielding] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [lawyerProfile, setLawyerProfile] = useState({ plan_type: 'PRO', juris_balance: 0 });

  const fetchProfile = useCallback(async () => {
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      if (!accessToken) return;

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
        setLawyerProfile({
          plan_type: p.plan_type || 'FREE',
          juris_balance: p.balance || 0
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil:', e);
    }
  }, [session]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'audio/*', 'video/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setUploadedFile(result.assets[0]);
      }
    } catch (e) {
      console.warn(e);
      Alert.alert('Erro', 'Erro ao selecionar arquivo.');
    }
  };

  const handleShieldDocument = async () => {
    if (lawyerProfile.plan_type === 'FREE') {
      Alert.alert(
        'Plano Requerido',
        'A Blindagem de Provas é uma ferramenta exclusiva dos planos START e PRO.\n\nGerencie seu plano no portal web para obter acesso.'
      );
      return;
    }

    if (lawyerProfile.plan_type === 'START' && (lawyerProfile.juris_balance || 0) < 4) {
      Alert.alert(
        'Saldo Insuficiente',
        'Você precisa de 4 Juris para blindar o documento.\n\nPara alterações cadastrais ou gerenciamento do saldo, acesse o portal web do SocialJurídico:\n\nsocialjuridico.com.br'
      );
      return;
    }

    if (!uploadedFile) {
      Alert.alert('Atenção', 'Selecione um arquivo para blindar.');
      return;
    }

    setIsShielding(true);
    try {
      const accessToken = session?.accessToken || session?.access_token || (typeof session === 'string' ? session : null);
      
      const formData = new FormData();
      formData.append('file', {
        uri: uploadedFile.uri,
        name: uploadedFile.name || 'prova_digital.pdf',
        type: uploadedFile.mimeType || 'application/octet-stream',
      });
      formData.append('type', 'prova');

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
        // Deduct 4 Juris locally if on START plan for better UX
        if (lawyerProfile.plan_type === 'START') {
          setLawyerProfile(prev => ({
            ...prev,
            juris_balance: Math.max(0, prev.juris_balance - 4)
          }));
        }
        Alert.alert('✅ Sucesso', 'Prova digital blindada na blockchain com sucesso!');
      } else {
        if (dataJson.error_type === 'INSUFFICIENT_JURIS') {
          Alert.alert(
            'Saldo Insuficiente',
            'Você precisa de 4 Juris para blindar o documento.\n\nPara alterações cadastrais ou gerenciamento do saldo, acesse o portal web do SocialJurídico:\n\nsocialjuridico.com.br'
          );
        } else {
          Alert.alert('Erro', dataJson.message || 'Erro ao blindar a prova.');
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
        <Text style={styles.headerTitle}>Blindagem de Provas</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {certificate ? (
          // Vista de sucesso (Certificado de blindagem)
          <View style={styles.successContainer}>
            <View style={styles.successBadge}>
              <Feather name="check-circle" size={48} color="#2ecc71" />
            </View>
            <Text style={styles.successTitle}>Registro Concluído!</Text>
            <Text style={styles.successSubtitle}>
              Sua prova digital está blindada contra adulterações e possui presunção de legalidade.
            </Text>

            <View style={styles.certificateBox}>
              <Text style={styles.certLabel}>Protocolo</Text>
              <Text style={styles.certVal}>{certificate.protocol}</Text>

              <Text style={styles.certLabel}>Assinatura SHA-512 (Hash)</Text>
              <Text style={[styles.certVal, styles.monoText]}>{certificate.hash}</Text>

              <Text style={styles.certLabel}>Data do Registro</Text>
              <Text style={styles.certVal}>{certificate.date}</Text>

              <Text style={styles.certLabel}>Distribuição</Text>
              <Text style={styles.certVal}>Rede Blockchain Descentralizada</Text>
            </View>

            <TouchableOpacity 
              style={styles.primaryBtn} 
              onPress={() => {
                setCertificate(null);
                setUploadedFile(null);
              }}
            >
              <Text style={styles.primaryBtnText}>Nova Blindagem</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryBtn} 
              onPress={() => navigation.navigate('LawyerBlindagemDashboard')}
            >
              <Text style={styles.secondaryBtnText}>Voltar ao Painel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Fluxo de Upload
          <View>
            {/* Top Icon */}
            <View style={styles.topIconCircle}>
              <Feather name="shield" size={40} color="#f5c853" />
            </View>

            <Text style={styles.mainTitle}>Blindagem de Provas Digitais</Text>
            <Text style={styles.subtitle}>
              Assegure a validade jurídica dos seus arquivos digitais com carimbo de tempo e registro na blockchain.
            </Text>

            {/* Upload Zone */}
            <TouchableOpacity style={styles.uploadZone} onPress={handleSelectFile}>
              <Feather name="upload-cloud" size={32} color="#f5c853" style={{ marginBottom: 12 }} />
              <Text style={styles.uploadZoneTitle}>
                {uploadedFile ? 'Alterar Arquivo Selecionado' : 'Clique para selecionar arquivo ou imagem'}
              </Text>
              <Text style={styles.uploadZoneSubtitle}>
                {uploadedFile ? uploadedFile.name : 'Suporta PDF, Imagens, Áudio e Vídeo'}
              </Text>
            </TouchableOpacity>

            {/* Info Cards */}
            <Text style={styles.infoSectionTitle}>VALIDADE LEGAL & SEGURANÇA</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <Feather name="clock" size={20} color="#f5c853" style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>Carimbo do Tempo ICP-Brasil</Text>
                  <Text style={styles.infoCardText}>
                    Garante a data e hora exatas da existência do documento, com presunção legal de veracidade perante a justiça brasileira.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <Feather name="lock" size={20} color="#f5c853" style={styles.infoIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>Imutabilidade Blockchain</Text>
                  <Text style={styles.infoCardText}>
                    Gera um hash único (assinatura digital) registrado em rede descentralizada, provando que o arquivo não foi alterado.
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom buttons */}
            <TouchableOpacity 
              style={[
                styles.primaryBtn, 
                (!uploadedFile || isShielding) && styles.primaryBtnDisabled
              ]} 
              onPress={handleShieldDocument}
              disabled={!uploadedFile || isShielding}
            >
              {isShielding ? (
                <ActivityIndicator color="#0d0f12" />
              ) : (
                <Text style={styles.primaryBtnText}>Blindar Arquivos Agora</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.balanceText}>
              Saldo:{' '}
              <Text style={{ color: '#f5c853', fontWeight: 'bold' }}>
                {lawyerProfile.plan_type === 'START'
                  ? `${Math.floor(lawyerProfile.juris_balance / 4)} blindagens`
                  : `${lawyerProfile.juris_balance} Juris`}
              </Text>{' '}
              restantes no plano
            </Text>
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
    alignItems: 'center',
  },
  topIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 200, 83, 0.05)',
    borderWidth: 1,
    borderColor: '#3a341e',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 16,
  },
  mainTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#a0a5b0',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  uploadZone: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2c313c',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  uploadZoneTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  uploadZoneSubtitle: {
    color: '#8e94a2',
    fontSize: 12,
  },
  infoSectionTitle: {
    color: '#8e94a2',
    fontSize: 11,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginBottom: 12,
    letterSpacing: 1,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoCardText: {
    color: '#a0a5b0',
    fontSize: 12,
    lineHeight: 16,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryBtnDisabled: {
    backgroundColor: 'rgba(245, 200, 83, 0.3)',
  },
  primaryBtnText: {
    color: '#0d0f12',
    fontSize: 15,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryBtnText: {
    color: '#a0a5b0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  balanceText: {
    color: '#8e94a2',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  successContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 204, 113, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    color: '#a0a5b0',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  certificateBox: {
    width: '100%',
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 12,
    padding: 20,
  },
  certLabel: {
    color: '#8e94a2',
    fontSize: 11,
    marginBottom: 4,
  },
  certVal: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 15,
  }
});
