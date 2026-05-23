import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Text, ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import { supabaseService, supabaseRealtime } from '../services/supabaseService';

const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

// Importação dos Componentes
import LawyerHeader from '../components/lawyer/LawyerHeader';
import LawyerSidebar from '../components/lawyer/LawyerSidebar';
import LawyerBottomTabBar from '../components/lawyer/LawyerBottomTabBar';
import MarketplaceTab from '../components/lawyer/MarketplaceTab';
import CRMTab from '../components/lawyer/CRMTab';
import MensagensTab from '../components/lawyer/MensagensTab';
import PerfilTab from '../components/lawyer/PerfilTab';
import NotificationCenterModal from '../components/lawyer/NotificationCenterModal';
import { registerForPushNotificationsAsync } from '../services/pushNotificationService';

export default function LawyerDashboardScreen({ route, navigation }) {
  const { session, user, role } = route.params || {};

  const [currentTab, setCurrentTab] = useState('Marketplace');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const [openCases, setOpenCases] = useState([]);
  const [activeCases, setActiveCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  // Limpa pesquisa ao mudar de aba
  useEffect(() => {
    setSearchQuery('');
    setSearchVisible(false);
  }, [currentTab]);

  // Estado dinâmico do perfil do advogado
  const [lawyerProfile, setLawyerProfile] = useState({
    name: user?.user_metadata?.name || 'Saulo',
    plan_type: 'PRO',
    oab_verification_status: 'VERIFIED',
    juris_balance: 0
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Se não vier por parametro, busca do supabase diretamente
      let currentSession = route.params?.session;
      let currentUser = route.params?.user;
      let explicitToken = route.params?.accessToken;
      let accessToken = explicitToken || currentSession?.accessToken || currentSession?.access_token || (typeof currentSession === 'string' ? currentSession : null);

      if (!accessToken || !currentUser?.id) {
        console.log('Token ou usuário ausentes nos params. Buscando sessão do supabaseRealtime...');
        const { data: { session: activeSession } } = await supabaseRealtime.auth.getSession();
        
        if (activeSession) {
          currentSession = activeSession;
          currentUser = activeSession.user;
          accessToken = activeSession.access_token;
        }
      }
      
      const userId = currentUser?.id;
      
      console.log('accessToken found?', !!accessToken);
      console.log('userId:', userId);
      
      if (!accessToken || !userId) {
        console.warn('Dashboard: Sessão não encontrada! Redirecionando para Login...');
        if (navigation) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
        return;
      }

      // Register for push notifications using the retrieved accessToken
      registerForPushNotificationsAsync(accessToken).catch(err => {
        console.warn('[Dashboard] Erro ao registrar push:', err);
      });

      // Busca dados de perfil do advogado (incluindo saldo de Juris)
      try {
        const profileRes = await fetch(`${WEB_API}/perfil`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          }
        });
        const profileJson = await profileRes.json();
        if (profileJson.success && profileJson.data) {
          const profile = profileJson.data;
          setLawyerProfile({
            name: profile.name || currentUser?.user_metadata?.name || 'Saulo',
            plan_type: profile.plan_type || 'PRO',
            oab_verification_status: profile.oab_verification_status || 'VERIFIED',
            juris_balance: profile.balance || 0
          });
        }
      } catch (err) {
        console.warn('[Dashboard] Erro ao carregar perfil/saldo:', err);
      }

      // Busca simultaneamente as oportunidades, os casos do advogado e os interesses dele
      const [marketData, myCasesData, myInterests] = await Promise.all([
        supabaseService.getMarketplaceCases(accessToken),
        supabaseService.getLawyerCases(userId, accessToken),
        supabaseService.getLawyerInterests(userId, accessToken)
      ]);

      console.log('--- DASHBOARD DATA FETCH ---');
      console.log('Casos no Marketplace bruto:', marketData.length);
      console.log('Meus interesses totais:', myInterests.length);

      // Filtra os casos em que ele já declarou interesse para não repetirem no Feed
      const formattedMarketplace = marketData
        .filter(c => !myInterests.some(i => i.case_id === c.id))
        .map(c => ({
          id: c.id,
          title: c.titulo || 'Processo sem título',
          location: c.cidade ? `${c.cidade} - ${c.estado}` : 'Brasil',
          description: c.descricao || 'Sem descrição',
          cost: 1, 
          tag: c.area_atuacao || 'GERAL',
          tagColor: '#2b2d36',
          tagTextColor: '#a3a9c2',
          time: 'Recente'
        }));

      console.log('Casos no Marketplace formatados (filtrados):', formattedMarketplace.length);
      setOpenCases(formattedMarketplace);
      
      // Atribui os casos já fechados do advogado
      setActiveCases(myCasesData.slice(0, 5)); // Puxa os 5 mais recentes

    } catch (err) {
      console.error('Erro ao carregar Dashboard Principal:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user, session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleLogout = async () => {
    await supabaseService.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const renderContent = () => {
    switch(currentTab) {
      case 'Marketplace':
        if (isLoading) {
          return (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#f5c853" />
              <Text style={{color: '#a3a9c2', marginTop: 10}}>Carregando Oportunidades...</Text>
            </View>
          );
        }
        return (
          <MarketplaceTab 
            lawyerProfile={lawyerProfile}
            openCases={openCases}
            activeCases={activeCases}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5c853" />
            }
          />
        );
      case 'CRM': {
        const currentSession = route.params?.session;
        const tok = route.params?.accessToken || currentSession?.accessToken || currentSession?.access_token;
        return <CRMTab userId={route.params?.user?.id} accessToken={tok} />;
      }
      case 'Mensagens': {
        const currentSession = route.params?.session;
        const tok = route.params?.accessToken || currentSession?.accessToken || currentSession?.access_token;
        return (
          <MensagensTab 
            userId={route.params?.user?.id} 
            accessToken={tok}
            searchQuery={searchQuery}
            setCurrentTab={setCurrentTab}
          />
        );
      }
      case 'Perfil': {
        const currentSession = route.params?.session;
        const tok = route.params?.accessToken || currentSession?.accessToken || currentSession?.access_token;
        return <PerfilTab userId={route.params?.user?.id} accessToken={tok} />;
      }
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />
      
      {currentTab === 'Mensagens' ? (
        <View style={styles.customHeader}>
          {searchVisible ? (
            <View style={styles.searchHeaderContainer}>
              <Feather name="search" size={18} color="#f5c853" style={styles.searchHeaderIcon} />
              <TextInput
                style={styles.searchHeaderInput}
                placeholder="Pesquisar mensagens..."
                placeholderTextColor="#a0a5b0"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setSearchVisible(false); setSearchQuery(''); }}>
                <Feather name="x" size={20} color="#a0a5b0" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.customHeaderBtn}>
                <Feather name="menu" size={22} color="#f5c853" />
              </TouchableOpacity>
              <Text style={styles.customHeaderTitle}>Minhas Mensagens</Text>
              <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.customHeaderBtn}>
                <Feather name="search" size={22} color="#f5c853" />
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <LawyerHeader 
          jurisBalance={lawyerProfile.juris_balance} 
          onMenuPress={() => setIsSidebarOpen(true)} 
          onBellPress={() => setShowNotifModal(true)} 
        />
      )}

      <View style={styles.content}>
        {renderContent()}
      </View>

      <LawyerBottomTabBar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
      />

      <LawyerSidebar 
        visible={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        lawyerProfile={lawyerProfile} 
        navigation={navigation}
        onLogout={handleLogout}
        user={user}
        session={session}
        setCurrentTab={setCurrentTab}
      />

      <NotificationCenterModal 
        visible={showNotifModal} 
        onClose={() => setShowNotifModal(false)} 
        userId={user?.id} 
        accessToken={route.params?.accessToken || session?.accessToken || session?.access_token} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090a0d',
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteText: {
    color: '#8e94a2',
    fontSize: 16,
  },
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: '#090a0d',
    borderBottomWidth: 1,
    borderBottomColor: '#16191f',
  },
  customHeaderBtn: {
    padding: 6,
  },
  customHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f5c853',
    textAlign: 'center',
  },
  searchHeaderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141c',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchHeaderIcon: {
    marginRight: 8,
  },
  searchHeaderInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 0,
  }
});
