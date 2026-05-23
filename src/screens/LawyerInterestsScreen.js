import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabaseService } from '../services/supabaseService';

export default function LawyerInterestsScreen({ route, navigation }) {
  const { user, session } = route.params || {};
  const [interestsList, setInterestsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInterests = async () => {
      try {
        setLoading(true);
        if (user?.id && session?.accessToken) {
          const data = await supabaseService.getLawyerInterests(user.id, session.accessToken);
          
          // Formatar os dados para exibição no nosso card
          const formattedList = data.map(interest => ({
            id: interest.id,
            caseId: interest.case_id,
            title: interest.casos?.titulo || 'Processo sem título',
            client: interest.casos?.cliente_nome || 'Cliente não identificado',
            status: interest.status === 'PENDING' ? 'Aguardando Resposta' : 'Em Negociação',
            time: 'Recente' // Idealmente seria um date-fns para calcular o "Há x dias"
          }));
          
          setInterestsList(formattedList);
        }
      } catch (error) {
        console.error('Erro ao buscar interesses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInterests();
  }, [user, session]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <View style={styles.clientRow}>
        <Feather name="user" size={14} color="#a0a5b0" />
        <Text style={styles.clientText}>Cliente: {item.client}</Text>
      </View>
      
      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.chatBtn}>
          <Feather name="message-circle" size={16} color="#0d0f12" />
          <Text style={styles.chatBtnText}>Abrir Chat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#f5c853" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Interesses Aceitos</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.emptyBox}>
          <ActivityIndicator size="large" color="#f5c853" />
          <Text style={styles.emptyText}>Buscando seus interesses...</Text>
        </View>
      ) : (
        <FlatList
          data={interestsList}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={40} color="#353a47" />
              <Text style={styles.emptyText}>Nenhum interesse ativo no momento.</Text>
            </View>
          }
        />
      )}
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
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: 'rgba(57, 211, 83, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(57, 211, 83, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#39d353',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeText: {
    color: '#8e94a2',
    fontSize: 12,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  clientText: {
    color: '#a0a5b0',
    fontSize: 13,
    marginLeft: 6,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#20242e',
    paddingTop: 12,
    alignItems: 'flex-end',
  },
  chatBtn: {
    flexDirection: 'row',
    backgroundColor: '#f5c853',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  chatBtnText: {
    color: '#0d0f12',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#8e94a2',
    marginTop: 12,
  }
});
