/**
 * MensagensTab.js — Painel de Notificações do Advogado
 * Paridade com o mockup e com a versão Web.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Alert, Platform
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../styles/theme';

const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function MensagensTab({ userId, accessToken, searchQuery, setCurrentTab }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal para detalhe da mensagem
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Headers de Autenticação para requisições
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  // Busca notificações no backend
  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!userId || !accessToken) return;
    if (!isRefresh) setLoading(true);

    try {
      const res = await fetch(`${WEB_API}/notificacoes`, {
        method: 'GET',
        headers: authHeaders
      });
      const resData = await res.json();

      if (resData.success) {
        setNotifications(resData.data || []);
      } else {
        console.warn('[MensagensTab] Erro ao carregar:', resData.message);
      }
    } catch (e) {
      console.error('[MensagensTab] fetchNotifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, accessToken]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  // Marca uma notificação como lida no backend e atualiza localmente
  const handleMarkAsRead = async (msg) => {
    if (msg.lida) return;
    try {
      const res = await fetch(`${WEB_API}/notificacoes`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ id: msg.id })
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev =>
          prev.map(n => n.id === msg.id ? { ...n, lida: true } : n)
        );
      }
    } catch (e) {
      console.error('[MensagensTab] handleMarkAsRead:', e);
    }
  };

  // Confirmação de exclusão
  const handleDeleteConfirm = (msgId) => {
    Alert.alert(
      "Excluir Mensagem",
      "Tem certeza que deseja excluir esta mensagem?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => executeDelete(msgId) }
      ]
    );
  };

  // Deleta a notificação
  const executeDelete = async (msgId) => {
    try {
      const res = await fetch(`${WEB_API}/notificacoes?id=${msgId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.filter(n => n.id !== msgId));
      } else {
        Alert.alert("Erro", data.message || "Erro ao excluir mensagem");
      }
    } catch (e) {
      console.error('[MensagensTab] executeDelete:', e);
      Alert.alert("Erro", "Erro ao conectar com o servidor.");
    }
  };

  const handleCardPress = (msg) => {
    setSelectedMsg(msg);
    setShowModal(true);
    handleMarkAsRead(msg);
  };

  // Mapeia o tipo da notificação para a estilização e rótulo do mockup
  const getNotificationCategory = (msg) => {
    const tipo = msg.tipo || 'GERAL';
    const titleUpper = (msg.titulo || '').toUpperCase();
    const msgUpper = (msg.mensagem || '').toUpperCase();

    const clientTypes = ["MENSAGEM", "NEGOCIACAO", "CONTRATACAO", "CHAT_INICIADO", "INTERESSE"];

    if (clientTypes.includes(tipo)) {
      const isPartner = titleUpper.includes("PARCEIRO") || msgUpper.includes("PARCEIRO");
      return {
        label: isPartner ? "ADVOGADO PARCEIRO" : "CLIENTE",
        color: "#f5c853", // Gold text
        icon: "message-square",
        iconColor: "#3b82f6", // Blue icon
        iconBg: "rgba(59, 130, 246, 0.15)",
        isFeather: true
      };
    } else if (tipo === "FINANCEIRO" || tipo === "PAGAMENTO" || tipo === "HONORARIOS") {
      return {
        label: "FINANCEIRO",
        color: "#2ecc71", // Green text
        icon: "check-circle",
        iconColor: "#2ecc71", // Green icon
        iconBg: "rgba(46, 204, 113, 0.15)",
        isFeather: true
      };
    } else {
      return {
        label: "SISTEMA",
        color: "#a0a5b0", // Gray text
        icon: "alert-circle",
        iconColor: "#f5c853", // Gold icon
        iconBg: "rgba(245, 200, 83, 0.15)",
        isFeather: true
      };
    }
  };

  // Formata data e hora conforme mockup (dd/mm/yyyy, hh:mm:ss)
  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Agora';
    try {
      const d = new Date(dateStr);
      const pad = (n) => String(n).padStart(2, '0');
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const year = d.getFullYear();
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      const seconds = pad(d.getSeconds());
      return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
    } catch {
      return 'Agora';
    }
  };

  // Filtra notificações com base na busca
  const filteredNotifications = notifications.filter(msg => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (msg.titulo || '').toLowerCase().includes(query) ||
      (msg.mensagem || '').toLowerCase().includes(query)
    );
  });

  const renderItem = ({ item }) => {
    const cat = getNotificationCategory(item);
    
    return (
      <TouchableOpacity 
        style={[
          styles.card,
          !item.lida && styles.unreadCard
        ]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.8}
      >
        {/* Rótulo de NOVA no topo do card se não lida */}
        {!item.lida && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NOVA</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          {/* Ícone Circular do Tipo */}
          <View style={[styles.iconContainer, { backgroundColor: cat.iconBg }]}>
            {cat.isFeather ? (
              <Feather name={cat.icon} size={18} color={cat.iconColor} />
            ) : (
              <MaterialCommunityIcons name={cat.icon} size={18} color={cat.iconColor} />
            )}
          </View>

          {/* Grupo de Títulos */}
          <View style={styles.titleGroup}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.titulo || 'Notificação'}
            </Text>
            <Text style={[styles.badgeText, { color: cat.color }]}>
              {cat.label}
            </Text>
          </View>

          {/* Data e Botão Excluir */}
          <View style={styles.metaGroup}>
            <Text style={styles.dateText}>
              {formatDateTime(item.created_at)}
            </Text>
            <TouchableOpacity 
              style={styles.deleteBtn}
              onPress={() => handleDeleteConfirm(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="trash-2" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Descrição Snippet */}
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.mensagem || 'Sem conteúdo.'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c853" />
        <Text style={styles.loadingText}>Carregando mensagens...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredNotifications}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#f5c853" 
            colors={["#f5c853"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="mail" size={48} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyText}>Você ainda não recebeu mensagens.</Text>
          </View>
        }
        ListFooterComponent={
          // Spinner centered at the bottom during reload or padding
          <View style={styles.footerSpinnerContainer}>
            {refreshing && <ActivityIndicator size="small" color="#f5c853" />}
          </View>
        }
      />

      {/* Modal de Detalhe da Mensagem */}
      {selectedMsg && (
        <Modal
          visible={showModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedMsg.titulo}</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Feather name="x" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.modalMetaRow}>
                  <Text style={[
                    styles.modalBadge, 
                    { color: getNotificationCategory(selectedMsg).color }
                  ]}>
                    {getNotificationCategory(selectedMsg).label}
                  </Text>
                  <Text style={styles.modalDate}>
                    {formatDateTime(selectedMsg.created_at)}
                  </Text>
                </View>

                <Text style={styles.modalText}>
                  {selectedMsg.mensagem}
                </Text>
              </View>

              <View style={styles.modalFooter}>
                {/* Botão Dinâmico de Ação se for Relacionado a Casos */}
                {["MENSAGEM", "NEGOCIACAO", "CONTRATACAO", "CHAT_INICIADO", "INTERESSE"].includes(selectedMsg.tipo) && (
                  <TouchableOpacity 
                    style={styles.actionBtn}
                    onPress={() => {
                      setShowModal(false);
                      if (setCurrentTab) setCurrentTab('CRM');
                    }}
                  >
                    <Feather name="users" size={16} color="#090a0d" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>Acessar CRM / Casos</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={styles.closeBtn}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.closeBtnText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a0d',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#090a0d',
  },
  loadingText: {
    color: '#a0a5b0',
    marginTop: 10,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#12141c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f5c853', // Borda amarela/dourada de destaque unread
  },
  newBadge: {
    position: 'absolute',
    top: -8,
    left: 12,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  newBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaGroup: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dateText: {
    color: '#8e94a2',
    fontSize: 11,
    marginBottom: 4,
  },
  deleteBtn: {
    padding: 4,
  },
  cardDesc: {
    color: '#a0a5b0',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#8e94a2',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  footerSpinnerContainer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#16191f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a341e',
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2c313c',
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 16,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalBadge: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalDate: {
    color: '#a0a5b0',
    fontSize: 12,
  },
  modalText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  closeBtn: {
    backgroundColor: '#2c313c',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 10,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionBtn: {
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#090a0d',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
