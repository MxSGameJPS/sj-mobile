import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Share, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';

const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function LawyerBlindagemDashboardScreen({ route, navigation }) {
  const { user, session } = route.params || {};
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      let currentSession = session;
      let accessToken = currentSession?.accessToken || currentSession?.access_token || (typeof currentSession === 'string' ? currentSession : null);

      if (!accessToken) return;

      const res = await fetch(`${WEB_API}/crm/blindagem`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDocuments(json.data);
      }
    } catch (err) {
      console.warn('Erro ao carregar documentos blindados:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  const handleShare = async (doc) => {
    try {
      if (doc.file_url) {
        await Share.share({
          message: `Documento Blindado: ${doc.file_name}\nProtocolo: ${doc.protocol}\nLink: ${doc.file_url}`,
          url: doc.file_url,
        });
      }
    } catch (error) {
      console.warn(error);
    }
  };

  const handleDownload = (doc) => {
    if (doc.file_url) {
      Linking.openURL(doc.file_url).catch(err => console.error("Erro ao abrir URL:", err));
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
        <Text style={styles.headerTitle}>Central de Blindagem</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Feather name="rotate-cw" size={20} color="#a0a5b0" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5c853" />
        }
      >
        {/* Intro */}
        <View style={styles.introSection}>
          <Text style={styles.mainTitle}>Central de Blindagem de Documentos</Text>
          <Text style={styles.subtitle}>
            Proteja e autentique seus documentos legais com validade jurídica e segurança avançada.
          </Text>
        </View>

        {/* Grid Menus */}
        <View style={styles.gridContainer}>
          {/* Contratos */}
          <TouchableOpacity 
            style={styles.gridCard}
            onPress={() => navigation.navigate('LawyerBlindagemContratos', { user, session })}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(245,200,83,0.05)' }]}>
              <Feather name="file-text" size={24} color="#f5c853" />
            </View>
            <Text style={styles.gridCardText}>Blindagem de Contratos</Text>
          </TouchableOpacity>

          {/* Procuracao */}
          <TouchableOpacity 
            style={styles.gridCard}
            onPress={() => navigation.navigate('LawyerBlindagemProcuracao', { user, session })}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(245,200,83,0.05)' }]}>
              <Feather name="user" size={24} color="#f5c853" />
            </View>
            <Text style={styles.gridCardText}>Blindagem de Procuração</Text>
          </TouchableOpacity>

          {/* Provas */}
          <TouchableOpacity 
            style={styles.gridCard}
            onPress={() => navigation.navigate('LawyerBlindagemProvas', { user, session })}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(245,200,83,0.05)' }]}>
              <MaterialCommunityIcons name="fingerprint" size={24} color="#f5c853" />
            </View>
            <Text style={styles.gridCardText}>Blindagem de Provas Digitais</Text>
          </TouchableOpacity>

          {/* Notificação */}
          <TouchableOpacity 
            style={styles.gridCard}
            onPress={() => navigation.navigate('LawyerBlindagemNotificacao', { user, session })}
          >
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(245,200,83,0.05)' }]}>
              <Feather name="mail" size={24} color="#f5c853" />
            </View>
            <Text style={styles.gridCardText}>Notificação Extrajudicial</Text>
          </TouchableOpacity>
        </View>

        {/* List Title */}
        <Text style={styles.listSectionTitle}>Documentos Blindados</Text>

        {/* List content */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#f5c853" />
            <Text style={styles.loadingText}>Carregando blindagens...</Text>
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="shield" size={40} color="#2b2d36" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Nenhum documento blindado nesta conta.</Text>
          </View>
        ) : (
          documents.map((doc) => {
            const isLido = doc.status === 'lido';
            const displayType = doc.type || (doc.status ? 'Notificação' : 'Prova Digital');
            
            let statusLabel = 'ENVIADO';
            if (doc.status) {
              statusLabel = doc.status.toUpperCase();
            } else {
              statusLabel = 'BLINDADO';
            }

            return (
              <View 
                key={doc.id} 
                style={[
                  styles.docCard, 
                  isLido ? styles.docCardLido : styles.docCardEnviado
                ]}
              >
                <View style={styles.docCardHeader}>
                  <View style={styles.docCardTitleRow}>
                    <Feather 
                      name={doc.status ? "mail" : "file"} 
                      size={18} 
                      color="#ffffff" 
                      style={{ marginRight: 8 }} 
                    />
                    <Text style={styles.docCardName} numberOfLines={1}>
                      {doc.file_name}
                    </Text>
                  </View>

                  <View style={[
                    styles.statusBadge, 
                    isLido ? styles.statusBadgeLido : styles.statusBadgeEnviado
                  ]}>
                    <Text style={[
                      styles.statusBadgeText, 
                      isLido ? styles.statusBadgeTextLido : styles.statusBadgeTextEnviado
                    ]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.docCardBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docCardLabel}>Protocolo</Text>
                    <Text style={styles.docCardProtocol}>{doc.protocol || 'N/A'}</Text>
                  </View>

                  <View style={styles.docCardActions}>
                    <TouchableOpacity 
                      style={styles.actionIconBtn} 
                      onPress={() => handleShare(doc)}
                    >
                      <Feather name="share-2" size={16} color="#a0a5b0" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionIconBtn} 
                      onPress={() => handleDownload(doc)}
                    >
                      <Feather name="download" size={18} color="#f5c853" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
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
  refreshBtn: {
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
  introSection: {
    marginBottom: 20,
  },
  mainTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#a0a5b0',
    fontSize: 14,
    lineHeight: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridCardText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  listSectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#a0a5b0',
    marginTop: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#16191f',
    borderColor: '#20242e',
    borderWidth: 1,
    borderRadius: 12,
  },
  emptyText: {
    color: '#a0a5b0',
    fontSize: 14,
  },
  docCard: {
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#20242e',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  docCardLido: {
    borderLeftColor: '#f5c853',
  },
  docCardEnviado: {
    borderLeftColor: '#4a5568',
  },
  docCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  docCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  docCardName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeLido: {
    backgroundColor: '#f5c853',
  },
  statusBadgeEnviado: {
    backgroundColor: '#2c313c',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadgeTextLido: {
    color: '#090a0d',
  },
  statusBadgeTextEnviado: {
    color: '#a0a5b0',
  },
  docCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  docCardLabel: {
    color: '#8e94a2',
    fontSize: 11,
    marginBottom: 2,
  },
  docCardProtocol: {
    color: '#a0a5b0',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  docCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBtn: {
    padding: 6,
    marginLeft: 12,
  }
});
