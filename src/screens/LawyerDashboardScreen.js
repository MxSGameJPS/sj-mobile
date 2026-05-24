import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { COLORS } from "../styles/theme";
import { supabaseService, supabaseRealtime } from "../services/supabaseService";

const LOCAL_IP = "192.168.2.195";
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : "https://socialjuridico.com.br/api";

// Importação dos Componentes
import LawyerHeader from "../components/lawyer/LawyerHeader";
import LawyerSidebar from "../components/lawyer/LawyerSidebar";
import LawyerBottomTabBar from "../components/lawyer/LawyerBottomTabBar";
import MarketplaceTab from "../components/lawyer/MarketplaceTab";
import CRMTab from "../components/lawyer/CRMTab";
import MensagensTab from "../components/lawyer/MensagensTab";
import PerfilTab from "../components/lawyer/PerfilTab";
import NotificationCenterModal from "../components/lawyer/NotificationCenterModal";
import { registerForPushNotificationsAsync } from "../services/pushNotificationService";

export default function LawyerDashboardScreen({ route, navigation }) {
  const { session, user, role } = route.params || {};

  const [currentTab, setCurrentTab] = useState("Marketplace");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const [openCases, setOpenCases] = useState([]);
  const [activeCases, setActiveCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);

  // Deep link para abrir chat diretamente (vindo de LawyerInterestsScreen)
  const [deepLinkChat, setDeepLinkChat] = useState(null);

  // Limpa pesquisa ao mudar de aba
  useEffect(() => {
    setSearchQuery("");
    setSearchVisible(false);
  }, [currentTab]);

  // Estado dinâmico do perfil do advogado
  const [lawyerProfile, setLawyerProfile] = useState({
    name: user?.user_metadata?.name || "",
    plan_type: "FREE",
    oab_verification_status: "PENDING",
    juris_balance: 0,
  });

  // Modais de aviso de planos/juris (Store compliance)
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeModalType, setNoticeModalType] = useState("welcome"); // 'welcome' | 'plan' | 'juris'
  const [noticeModalMessage, setNoticeModalMessage] = useState("");

  const triggerNoticeModal = (type, customMessage = "") => {
    setNoticeModalType(type);
    setNoticeModalMessage(customMessage);
    setShowNoticeModal(true);
  };

  const handleTabChange = (tab) => {
    const isFree = lawyerProfile.plan_type === "FREE";
    if (isFree && tab === "CRM") {
      triggerNoticeModal(
        "plan",
        'O "CRM de Clientes" é uma ferramenta exclusiva dos planos START e PRO.\n\nGerencie seu plano diretamente pelo portal web para obter acesso.',
      );
      return;
    }
    setCurrentTab(tab);
  };

  useEffect(() => {
    // Exibe o modal informativo geral no primeiro acesso ao painel
    const timer = setTimeout(() => {
      triggerNoticeModal("welcome");
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Se não vier por parametro, busca do supabase diretamente
      let currentSession = route.params?.session;
      let currentUser = route.params?.user;
      let explicitToken = route.params?.accessToken;
      let accessToken =
        explicitToken ||
        currentSession?.accessToken ||
        currentSession?.access_token ||
        (typeof currentSession === "string" ? currentSession : null);

      if (!accessToken || !currentUser?.id) {
        console.log(
          "Token ou usuário ausentes nos params. Buscando sessão do supabaseRealtime...",
        );
        const {
          data: { session: activeSession },
        } = await supabaseRealtime.auth.getSession();

        if (activeSession) {
          currentSession = activeSession;
          currentUser = activeSession.user;
          accessToken = activeSession.access_token;
        }
      }

      const userId = currentUser?.id;

      console.log("accessToken found?", !!accessToken);
      console.log("userId:", userId);

      if (!accessToken || !userId) {
        console.warn(
          "Dashboard: Sessão não encontrada! Redirecionando para Login...",
        );
        if (navigation) {
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        }
        return;
      }

      // Register for push notifications using the retrieved accessToken
      registerForPushNotificationsAsync(accessToken).catch((err) => {
        console.warn("[Dashboard] Erro ao registrar push:", err);
      });

      // Busca dados de perfil do advogado (incluindo saldo de Juris)
      try {
        const profileRes = await fetch(`${WEB_API}/perfil`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const profileJson = await profileRes.json();
        if (profileJson.success && profileJson.data) {
          const profile = profileJson.data;
          setLawyerProfile({
            name: profile.name || currentUser?.user_metadata?.name || "",
            plan_type: profile.plan_type || "FREE",
            oab_verification_status:
              profile.oab_verification_status || "PENDING",
            juris_balance: profile.balance || 0,
          });
        }
      } catch (err) {
        console.warn("[Dashboard] Erro ao carregar perfil/saldo:", err);
      }

      // Busca simultaneamente as oportunidades, os casos do advogado e os interesses dele
      const [marketData, myCasesData, myInterests] = await Promise.all([
        supabaseService.getMarketplaceCases(accessToken),
        supabaseService.getLawyerCases(userId, accessToken),
        supabaseService.getLawyerInterests(userId, accessToken),
      ]);

      console.log("--- DASHBOARD DATA FETCH ---");
      console.log("Casos no Marketplace bruto:", marketData.length);
      console.log("Meus interesses totais:", myInterests.length);

      // Filtra os casos em que ele já declarou interesse para não repetirem no Feed
      const formattedMarketplace = marketData
        .filter((c) => !myInterests.some((i) => i.case_id === c.id))
        .map((c) => ({
          id: c.id,
          title: c.titulo || "Processo sem título",
          location: c.cidade ? `${c.cidade} - ${c.estado}` : "Brasil",
          description: c.descricao || "Sem descrição",
          cost: 1,
          tag: c.area_atuacao || "GERAL",
          tagColor: "#2b2d36",
          tagTextColor: "#a3a9c2",
          time: "Recente",
        }));

      console.log(
        "Casos no Marketplace formatados (filtrados):",
        formattedMarketplace.length,
      );
      setOpenCases(formattedMarketplace);

      // Atribui os casos já fechados do advogado
      setActiveCases(myCasesData.slice(0, 5)); // Puxa os 5 mais recentes
    } catch (err) {
      console.error("Erro ao carregar Dashboard Principal:", err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user, session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user?.id || !session?.accessToken) return;

    const channel = supabaseRealtime
      .channel(`lawyer-dashboard-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "casos" },
        () => {
          fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "casos" },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabaseRealtime.removeChannel(channel);
    };
  }, [user?.id, session?.accessToken, fetchData]);

  // Processar navegação vinda da tela de Interesses para abrir chat direto
  useEffect(() => {
    const openChatCaseId = route.params?.openChatCaseId;
    const openChatInterestId = route.params?.openChatInterestId;
    if (openChatCaseId) {
      setCurrentTab("Mensagens");
      // Passa via state para o MensagensTab via prop (veja renderContent)
      setDeepLinkChat({
        caseId: openChatCaseId,
        interestId: openChatInterestId || null,
      });
    }
  }, [route.params?.openChatCaseId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleManifestInterest = async (caseObj) => {
    if ((lawyerProfile.juris_balance || 0) < 1) {
      triggerNoticeModal(
        "juris",
        "Saldo insuficiente de Juris.\n\nPor razões de conformidade com as diretrizes das lojas, a aquisição de novos créditos de utilização (Juris) é realizada exclusivamente através do nosso portal de gestão no navegador web.",
      );
      return;
    }

    Alert.alert(
      "Confirmar Manifesto",
      `Ao manifestar interesse no caso "${caseObj.title}", você utilizará 1 Juri.\n\nDeseja prosseguir?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            try {
              let currentSession = route.params?.session;
              let currentUser = route.params?.user;
              let explicitToken = route.params?.accessToken;
              let accessToken =
                explicitToken ||
                currentSession?.accessToken ||
                currentSession?.access_token ||
                (typeof currentSession === "string" ? currentSession : null);

              if (!accessToken) {
                const {
                  data: { session: activeSession },
                } = await supabaseRealtime.auth.getSession();
                if (activeSession) {
                  accessToken = activeSession.access_token;
                }
              }

              if (!accessToken) {
                Alert.alert("Erro", "Sessão expirada. Faça login novamente.");
                return;
              }

              const res = await fetch(`${WEB_API}/casos/vincular`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ casoId: caseObj.id }),
              });

              const json = await res.json();
              if (json.success) {
                Alert.alert(
                  "Sucesso",
                  "Interesse manifestado com sucesso! O cliente foi notificado.",
                );
                fetchData();
              } else {
                if (
                  res.status === 402 ||
                  json.message?.includes("Saldo insuficiente")
                ) {
                  triggerNoticeModal(
                    "juris",
                    "Saldo insuficiente de Juris.\n\nPor razões de conformidade com as diretrizes das lojas, a aquisição de novos créditos de utilização (Juris) é realizada exclusivamente através do nosso portal de gestão no navegador web.",
                  );
                } else {
                  Alert.alert(
                    "Erro",
                    json.message || "Erro ao manifestar interesse",
                  );
                }
              }
            } catch (err) {
              console.warn(err);
              Alert.alert("Erro", "Falha ao conectar com o servidor.");
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    setIsSidebarOpen(false);
    const currentSession = route.params?.session;
    const tok =
      route.params?.accessToken ||
      currentSession?.accessToken ||
      currentSession?.access_token;
    if (tok) {
      supabaseService.signOut(tok).catch((err) => {
        console.warn("[Dashboard] Erro ao fazer logout no background:", err);
      });
    }
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const renderContent = () => {
    switch (currentTab) {
      case "Marketplace":
        if (isLoading) {
          return (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#f5c853" />
              <Text style={{ color: "#a3a9c2", marginTop: 10 }}>
                Carregando Oportunidades...
              </Text>
            </View>
          );
        }
        return (
          <MarketplaceTab
            lawyerProfile={lawyerProfile}
            openCases={openCases}
            activeCases={activeCases}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#f5c853"
                colors={["#f5c853"]}
              />
            }
            onPlanPress={() => {
              console.log(
                "[LawyerDashboardScreen] Card Plano Atual pressionado",
              );
              triggerNoticeModal("plan");
            }}
            onJurisPress={() => {
              console.log(
                "[LawyerDashboardScreen] Card Saldo Juris pressionado",
              );
              triggerNoticeModal("juris");
            }}
            onManifestInterest={handleManifestInterest}
          />
        );
      case "CRM": {
        const currentSession = route.params?.session;
        const tok =
          route.params?.accessToken ||
          currentSession?.accessToken ||
          currentSession?.access_token;
        return (
          <CRMTab
            userId={route.params?.user?.id}
            accessToken={tok}
            planType={lawyerProfile.plan_type}
            onPlanUpgrade={(msg) => triggerNoticeModal("plan", msg)}
          />
        );
      }
      case "Mensagens": {
        const currentSession = route.params?.session;
        const tok =
          route.params?.accessToken ||
          currentSession?.accessToken ||
          currentSession?.access_token;
        return (
          <MensagensTab
            userId={route.params?.user?.id}
            accessToken={tok}
            searchQuery={searchQuery}
            setCurrentTab={handleTabChange}
            deepLinkChat={deepLinkChat}
            onChatOpened={() => setDeepLinkChat(null)}
          />
        );
      }
      case "Perfil": {
        const currentSession = route.params?.session;
        const tok =
          route.params?.accessToken ||
          currentSession?.accessToken ||
          currentSession?.access_token;
        return <PerfilTab userId={route.params?.user?.id} accessToken={tok} />;
      }
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />

      {currentTab === "Mensagens" ? (
        <View style={styles.customHeader}>
          {searchVisible ? (
            <View style={styles.searchHeaderContainer}>
              <Feather
                name="search"
                size={18}
                color="#f5c853"
                style={styles.searchHeaderIcon}
              />
              <TextInput
                style={styles.searchHeaderInput}
                placeholder="Pesquisar mensagens..."
                placeholderTextColor="#a0a5b0"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => {
                  setSearchVisible(false);
                  setSearchQuery("");
                }}
              >
                <Feather name="x" size={20} color="#a0a5b0" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setIsSidebarOpen(true)}
                style={styles.customHeaderBtn}
              >
                <Feather name="menu" size={22} color="#f5c853" />
              </TouchableOpacity>
              <Text style={styles.customHeaderTitle}>Minhas Mensagens</Text>
              <TouchableOpacity
                onPress={() => setSearchVisible(true)}
                style={styles.customHeaderBtn}
              >
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
          onJurisPress={() => triggerNoticeModal("juris")}
        />
      )}

      <View style={styles.content}>{renderContent()}</View>

      <LawyerBottomTabBar
        currentTab={currentTab}
        setCurrentTab={handleTabChange}
      />

      <LawyerSidebar
        visible={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        lawyerProfile={lawyerProfile}
        navigation={navigation}
        onLogout={handleLogout}
        user={user}
        session={session}
        setCurrentTab={handleTabChange}
        onPlanPress={(customMsg) => {
          setIsSidebarOpen(false);
          triggerNoticeModal("plan", customMsg || "");
        }}
        onJurisPress={() => {
          setIsSidebarOpen(false);
          triggerNoticeModal("juris");
        }}
      />

      <NotificationCenterModal
        visible={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        userId={user?.id}
        accessToken={
          route.params?.accessToken ||
          session?.accessToken ||
          session?.access_token
        }
      />

      {/* Modal de Conformidade de Lojas (Planos e Juris) */}
      <Modal
        visible={showNoticeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNoticeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather
                  name={
                    noticeModalType === "juris"
                      ? "award"
                      : noticeModalType === "plan"
                        ? "star"
                        : "info"
                  }
                  size={18}
                  color="#f5c853"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.modalTitle}>
                  {noticeModalType === "juris"
                    ? "Saldo de Juris"
                    : noticeModalType === "plan"
                      ? "Gerenciar Plano"
                      : "Portal do Advogado"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowNoticeModal(false)}>
                <Feather name="x" size={20} color="#8e94a2" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                {noticeModalMessage
                  ? noticeModalMessage
                  : noticeModalType === "juris"
                    ? `Seu saldo atual é de ${lawyerProfile.juris_balance || 0} Juris.\n\nPor razões de conformidade com as diretrizes das lojas de aplicativos, a aquisição de novos créditos de utilização (Juris) é realizada exclusivamente através do nosso portal de gestão no navegador web.`
                    : noticeModalType === "plan"
                      ? `Sua conta está ativa no Plano ${lawyerProfile.plan_type || "FREE"}.\n\nPara alterações cadastrais, upgrades, renovações ou gerenciamento de assinaturas, acesse a área administrativa do SocialJurídico diretamente no seu navegador.`
                      : `Bem-vindo ao SocialJurídico, Dr(a). ${lawyerProfile.name ? lawyerProfile.name.split(" ")[0] : ""}!\n\nLembramos que o gerenciamento do seu plano profissional e a recarga de créditos (Juris) para uso de ferramentas automatizadas são efetuados exclusivamente por meio do portal administrativo web.`}
              </Text>

              <View style={styles.linkContainer}>
                <Text style={styles.linkTitle}>
                  Acesse de qualquer navegador:
                </Text>
                <View style={styles.urlBox}>
                  <Text style={styles.urlText}>socialjuridico.com.br</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => {
                      Clipboard.setString("https://socialjuridico.com.br");
                      Alert.alert(
                        "Copiado",
                        "Endereço copiado para a área de transferência!",
                      );
                    }}
                  >
                    <Feather name="copy" size={14} color="#f5c853" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => setShowNoticeModal(false)}
              >
                <Text style={styles.confirmBtnText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#090a0d",
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  whiteText: {
    color: "#8e94a2",
    fontSize: 16,
  },
  customHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: "#090a0d",
    borderBottomWidth: 1,
    borderBottomColor: "#16191f",
  },
  customHeaderBtn: {
    padding: 6,
  },
  customHeaderTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f5c853",
    textAlign: "center",
  },
  searchHeaderContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12141c",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchHeaderIcon: {
    marginRight: 8,
  },
  searchHeaderInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
    paddingVertical: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#12141c",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3a341e",
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  modalBody: {
    marginBottom: 20,
  },
  modalText: {
    fontSize: 14,
    color: "#a0a5b0",
    lineHeight: 22,
    textAlign: "left",
  },
  linkContainer: {
    marginTop: 16,
    backgroundColor: "#090a0d",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    padding: 12,
  },
  linkTitle: {
    fontSize: 12,
    color: "#606672",
    marginBottom: 6,
    fontWeight: "600",
  },
  urlBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  urlText: {
    fontSize: 15,
    color: "#f5c853",
    fontWeight: "bold",
  },
  copyBtn: {
    padding: 6,
  },
  modalFooter: {
    alignItems: "stretch",
  },
  confirmBtn: {
    backgroundColor: "#f5c853",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#0d0f12",
    fontSize: 15,
    fontWeight: "bold",
  },
});
