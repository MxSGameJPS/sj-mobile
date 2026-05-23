import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabaseService } from '../services/supabaseService';

export default function LawyerCasesScreen({ route, navigation }) {
  const { user, session } = route.params || {};
  const [casesList, setCasesList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        if (user?.id && session?.accessToken) {
          const data = await supabaseService.getLawyerCases(user.id, session.accessToken);
          
          // Formatar os dados para exibição no nosso card
          const formattedList = data.map(caso => ({
            id: caso.id,
            number: caso.numero_processo || 'Sem número',
            type: caso.area_direito || 'Área não informada',
            client: caso.cliente_nome || 'Cliente não identificado',
            iconType: caso.area_direito?.toLowerCase().includes('família') ? 'users' : 'gavel',
            status: caso.status
          }));
          
          setCasesList(formattedList);
        }
      } catch (error) {
        console.error('Erro ao buscar casos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [user, session]);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={styles.iconBox}>
          {item.iconType === 'users' ? (
            <Feather name="users" size={20} color="#a0a5b0" />
          ) : item.iconType === 'file-text' ? (
            <Feather name="file-text" size={20} color="#a0a5b0" />
          ) : (
            <MaterialCommunityIcons name="gavel" size={20} color="#a0a5b0" />
          )}
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.processNumber}>{item.number}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.type}</Text>
        <Text style={styles.clientText}>Cliente: {item.client}</Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.actionText}>Ver Detalhes do Processo</Text>
        <Feather name="chevron-right" size={16} color="#f5c853" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#f5c853" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Casos Ativos</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.emptyBox}>
          <ActivityIndicator size="large" color="#f5c853" />
          <Text style={styles.emptyText}>Buscando seus processos ativos...</Text>
        </View>
      ) : (
        <FlatList
          data={casesList}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="briefcase" size={40} color="#353a47" />
              <Text style={styles.emptyText}>Você ainda não foi contratado em nenhum caso.</Text>
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
    backgroundColor: '#0d0f12',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1a1d24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  processNumber: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: 'rgba(245, 200, 83, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    color: '#f5c853',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardContent: {
    marginBottom: 16,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  clientText: {
    color: '#a0a5b0',
    fontSize: 13,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1a1d24',
    paddingTop: 12,
  },
  actionText: {
    color: '#f5c853',
    fontSize: 13,
    fontWeight: 'bold',
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
