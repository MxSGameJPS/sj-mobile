import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

export default function NotificationCenterModal({ visible, onClose, userId, accessToken }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!userId || !accessToken) return;
    if (!isRefresh) setLoading(true);

    try {
      const res = await fetch(`${WEB_API}/notificacoes`, {
        method: 'GET',
        headers: authHeaders,
      });
      const resData = await res.json();

      if (resData.success) {
        setNotifications(resData.data || []);
      }
    } catch (e) {
      console.error('[NotificationCenterModal] fetchError:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, accessToken]);

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible, fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  // Limpa todas as notificações (exclui do feed)
  const handleClearAll = async () => {
    if (notifications.length === 0) return;

    try {
      const res = await fetch(`${WEB_API}/notificacoes?id=all`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const resData = await res.json();
      if (resData.success) {
        setNotifications([]);
      }
    } catch (e) {
      console.error('[NotificationCenterModal] clearError:', e);
    }
  };

  // Formata o tempo relativo (Ex: "Agora", "10m", "1h", "2d")
  const formatTime = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Mapeia o tipo da notificação para ícone e cores condizentes
  const getNotificationDesign = (type) => {
    const t = String(type).toUpperCase();
    if (t === 'MENSAGEM' || t === 'CHAT_INICIADO') {
      return { name: 'message-square', isMCI: false, title: 'Mensagem de Cliente' };
    }
    if (t === 'AGENDA') {
      return { name: 'calendar', isMCI: false, title: 'Agenda' };
    }
    if (t === 'BLINDAGEM') {
      return { name: 'shield', isMCI: false, title: 'Blindagem' };
    }
    if (t === 'FINANCEIRO' || t === 'HONORARIOS' || t === 'PAGAMENTO') {
      return { name: 'cash', isMCI: true, title: 'Financeiro' };
    }
    // Fallback/Sistema
    return { name: 'shield', isMCI: false, title: 'Sistema' };
  };

  const renderItem = ({ item }) => {
    const design = getNotificationDesign(item.tipo);
    const time = formatTime(item.created_at);

    return (
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            {design.isMCI ? (
              <MaterialCommunityIcons name={design.name} size={18} color="#f5c853" />
            ) : (
              <Feather name={design.name} size={18} color="#f5c853" />
            )}
          </View>
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.cardTitle}>{design.title}</Text>
            <Text style={styles.cardTime}>{time}</Text>
          </View>
          <Text style={styles.cardMsg} numberOfLines={3}>
            {item.mensagem}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          
          {/* Header Close chevron */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Feather name="chevron-down" size={32} color="#606672" />
          </TouchableOpacity>

          {/* Scale Logo and Title */}
          <View style={styles.logoBox}>
            <View style={styles.scaleCircle}>
              <MaterialCommunityIcons name="scale-balance" size={36} color="#f5c853" />
            </View>
            <Text style={styles.brandText}>Social<Text style={styles.brandGold}>Jurídico</Text></Text>
            <Text style={styles.subBrandText}>CENTRAL DE INTELIGÊNCIA</Text>
          </View>

          {/* Notifications Feed */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#f5c853" />
            </View>
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5c853" colors={["#f5c853"]} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="bell-off" size={40} color="#505560" style={{ marginBottom: 12 }} />
                  <Text style={styles.emptyText}>Nenhuma notificação recente</Text>
                </View>
              }
            />
          )}

          {/* Bottom Actions */}
          {!loading && notifications.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll} activeOpacity={0.8}>
              <Text style={styles.clearBtnText}>Limpar Notificações</Text>
            </TouchableOpacity>
          )}

          {/* Swipe Hint */}
          <TouchableOpacity style={styles.swipeHint} onPress={onClose} activeOpacity={0.8}>
            <View style={styles.hintBar} />
            <Text style={styles.hintText}>Deslize para fechar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#090a0d',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  closeBtn: {
    alignSelf: 'center',
    padding: 10,
    marginBottom: 10,
  },
  logoBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scaleCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#12141c',
    borderWidth: 1.5,
    borderColor: '#f5c853',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#f5c853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  brandText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  brandGold: {
    color: '#f5c853',
  },
  subBrandText: {
    color: '#f5c853',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2.5,
    marginTop: 6,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#12141c',
    borderWidth: 1,
    borderColor: '#1f222b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 14,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#181b24',
    borderWidth: 1.5,
    borderColor: '#f5c853',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    color: '#f5c853',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cardTime: {
    color: '#7a808f',
    fontSize: 11,
  },
  cardMsg: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#606672',
    fontSize: 14,
  },
  clearBtn: {
    alignSelf: 'center',
    borderWidth: 1.2,
    borderColor: '#606672',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  clearBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  swipeHint: {
    alignItems: 'center',
    paddingTop: 10,
  },
  hintBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1f222b',
    marginBottom: 8,
  },
  hintText: {
    color: '#606672',
    fontSize: 11,
  },
});
