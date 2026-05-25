import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Linking,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../styles/theme";
import { supabaseService, supabaseRealtime } from "../services/supabaseService";
import { clearAuthSession, saveAuthSession } from "../services/sessionStore";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import { registerForPushNotificationsAsync } from "../services/pushNotificationService";

const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const AREAS_OF_LAW = [
  "Trabalhista",
  "Civil",
  "Família e Sucessões",
  "Consumidor",
  "Previdenciário",
  "Penal / Criminal",
  "Imobiliário",
  "Tributário",
  "Empresarial",
  "Outro",
];

const USEFUL_LINKS = [
  {
    title: "ConfirmaAdv",
    description: "Consulta pública de dados da advocacia.",
    url: "https://confirmadv.oab.org.br/",
    icon: "award",
  },
  {
    title: "Receita Federal",
    description: "Portal oficial da Receita Federal do Brasil.",
    url: "https://www.gov.br/receitafederal/pt-br",
    icon: "file-text",
  },
  {
    title: "e-CAC",
    description: "Centro Virtual de Atendimento ao Contribuinte.",
    url: "https://cav.receita.fazenda.gov.br/",
    icon: "server",
  },
  {
    title: "CNJ",
    description: "Serviços e informações do Conselho Nacional de Justiça.",
    url: "https://www.cnj.jus.br/",
    icon: "shield",
  },
  {
    title: "TST",
    description: "Portal do Tribunal Superior do Trabalho.",
    url: "https://www.tst.jus.br/",
    icon: "briefcase",
  },
  {
    title: "Central Registradores",
    description: "Serviços digitais e certidões dos registradores.",
    url: "https://www.registradores.org.br/",
    icon: "book",
  },
  {
    title: "Consulta Geral de Processos",
    description: "Busca pública ampla para acompanhamento processual.",
    url: "https://www.jusbrasil.com.br/consulta-processual/",
    icon: "search",
  },
];

export default function DashboardScreen({ route, navigation }) {
  const { user, role, session } = route.params || {};

  const openWebLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Erro", "Não foi possível abrir o link no seu navegador.");
      }
    } catch (error) {
      console.error("Erro ao abrir o link:", error);
      Alert.alert(
        "Erro",
        "Ocorreu um erro ao tentar acessar o endereço informado.",
      );
    }
  };

  const [currentTab, setCurrentTab] = useState("Home");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [cases, setCases] = useState([]);
  const [lawyers, setLawyers] = useState({}); // key: lawyerId -> lawyer object
  const [activeChatCaseId, setActiveChatCaseId] = useState(null);
  const [activeChatInterestId, setActiveChatInterestId] = useState(null);
  const [interesses, setInteresses] = useState([]);
  const [lawyersList, setLawyersList] = useState([]);
  const [officesList, setOfficesList] = useState([]);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [isOfficeModalOpen, setIsOfficeModalOpen] = useState(false);
  const [selectedLawyer, setSelectedLawyer] = useState(null);
  const [isLawyerModalOpen, setIsLawyerModalOpen] = useState(false);
  const [selectedLawyerArea, setSelectedLawyerArea] = useState("Todos");
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  // Form states for Novo Caso
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseCity, setNewCaseCity] = useState("");
  const [newCaseState, setNewCaseState] = useState("");
  const [newCaseArea, setNewCaseArea] = useState("");
  const [newCaseDesc, setNewCaseDesc] = useState("");
  const [newCaseAttachments, setNewCaseAttachments] = useState([]);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [isSubmittingCase, setIsSubmittingCase] = useState(false);

  // Form states for Meu Perfil
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [caseActionLoadingId, setCaseActionLoadingId] = useState(null);

  // Chat states
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] =
    useState(false);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Reviews / Avaliações
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewCaseInfo, setReviewCaseInfo] = useState(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [anjoAnalysis, setAnjoAnalysis] = useState(null);
  const [isAnjoLoading, setIsAnjoLoading] = useState(false);
  const [isAnjoModalOpen, setIsAnjoModalOpen] = useState(false);

  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (session?.accessToken) {
      saveAuthSession({ session, user, role }).catch((err) => {
        console.warn("[DashboardScreen] Erro ao persistir sessão:", err);
      });
    }
  }, [session, user, role]);

  // --- Helpers de Permissão ---
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    Alert.alert(
      "Câmera",
      status === "granted"
        ? "Permissão concedida para uso da câmera!"
        : "Permissão negada.",
    );
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    Alert.alert(
      "Galeria",
      status === "granted"
        ? "Permissão concedida para acessar a galeria!"
        : "Permissão negada.",
    );
  };

  const requestMicPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    Alert.alert(
      "Microfone",
      status === "granted"
        ? "Permissão concedida para gravar áudio!"
        : "Permissão negada.",
    );
  };

  const manageBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      Alert.alert(
        "Indisponível",
        "Seu dispositivo não possui suporte a biometria.",
      );
      return;
    }
    const savedEmail = await SecureStore.getItemAsync("sj_email");
    if (!savedEmail) {
      Alert.alert(
        "Aviso",
        "Faça login digitando sua senha na tela inicial para ativar o acesso biométrico.",
      );
      return;
    }
    Alert.alert(
      "Biometria Ativa",
      `O acesso rápido está configurado para: ${savedEmail}`,
    );
  };

  // Carrega informações do banco do Supabase
  const loadData = async () => {
    if (!user?.id || !session?.accessToken) {
      setLoading(false);
      return;
    }

    // Registrar token de push notification do cliente
    registerForPushNotificationsAsync(session.accessToken).catch((err) => {
      console.warn(
        "[DashboardScreen] Erro ao registrar push para o cliente:",
        err,
      );
    });

    try {
      setLoading(true);
      console.log(
        "[DashboardScreen] Iniciando carregamento de dados para o usuário:",
        user.email,
      );

      // 1. Buscar perfil do cliente (com fallback por email)
      const profileData = await supabaseService.getClientProfile(
        user.id,
        session.accessToken,
        user.email,
      );
      let clientId = user.id;
      if (profileData) {
        setProfile(profileData);
        setProfileName(profileData.name || "");
        setProfilePhone(profileData.phone || "");
        clientId = profileData.id;
      }
      setClientId(clientId);
      console.log(
        "[DashboardScreen] Perfil do cliente carregado. clientId:",
        clientId,
      );

      // 2. Buscar todos os advogados do banco
      const allLawyers = await supabaseService.getLawyersList(
        session.accessToken,
      );
      setLawyersList(allLawyers || []);

      // 3. Buscar todos os escritórios do banco
      const allOffices = await supabaseService.getOfficesList(
        session.accessToken,
      );
      setOfficesList(allOffices || []);

      // 4. Buscar casos do cliente
      const casesData = await supabaseService.getClientCases(
        clientId,
        session.accessToken,
      );
      if (casesData) {
        const visibleCases = casesData.filter((c) => c.status !== "CANCELADO");
        setCases(visibleCases);
        console.log(
          "[DashboardScreen] Casos do cliente carregados:",
          visibleCases.length,
        );

        // Mapear informações dos advogados correspondentes
        const fetchedLawyers = {};
        if (allLawyers) {
          allLawyers.forEach((l) => {
            fetchedLawyers[l.id] = l;
          });
        }

        // Fallback para buscar advogados faltantes
        for (const c of casesData) {
          if (c.advogado_id && !fetchedLawyers[c.advogado_id]) {
            try {
              const lawyerData = await supabaseService.getLawyer(
                c.advogado_id,
                session.accessToken,
              );
              if (lawyerData) {
                fetchedLawyers[c.advogado_id] = lawyerData;
              }
            } catch (err) {
              console.error(
                "[DashboardScreen] Erro ao buscar advogado extra:",
                err,
              );
            }
          }
        }
        setLawyers(fetchedLawyers);
      }

      // 5. Buscar interesses de casos ativos do cliente
      const interestsData = await supabaseService.getCaseInterests(
        clientId,
        session.accessToken,
      );
      setInteresses(interestsData || []);
      console.log(
        "[DashboardScreen] Interesses de casos carregados:",
        interestsData?.length || 0,
      );

      // 6. Buscar notificações do cliente
      const notifsData = await supabaseService.getNotifications(
        clientId,
        session.accessToken,
      );
      setNotifications(notifsData || []);
      console.log(
        "[DashboardScreen] Notificações do cliente carregadas:",
        notifsData?.length || 0,
      );
    } catch (err) {
      console.error("[DashboardScreen] Erro ao carregar dados do banco:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers para Modificação de Casos ---
  const handleEditCase = (caseId) => {
    Alert.alert(
      "Editar Caso",
      "Funcionalidade em desenvolvimento no app móvel. Para edição completa, utilize a plataforma web.",
    );
  };

  const handleDeleteCase = (caseId) => {
    if (caseActionLoadingId) return;
    Alert.alert(
      "Excluir Caso",
      "Tem certeza que deseja excluir este caso definitivamente?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setCaseActionLoadingId(caseId);
            try {
              await supabaseService.deleteCase(caseId, session.accessToken);
              setCases((prev) => prev.filter((c) => c.id !== caseId));
              Alert.alert("Sucesso", "Caso excluído com sucesso.");
            } catch (err) {
              Alert.alert("Erro", err.message);
            } finally {
              setCaseActionLoadingId(null);
            }
          },
        },
      ],
    );
  };

  const handleFinishCase = (caseObj, lawyerObj) => {
    if (caseActionLoadingId) return;
    Alert.alert(
      "Concluir Caso",
      "Tem certeza de que deseja marcar este caso como concluído? Você poderá avaliar o advogado.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Concluir",
          onPress: async () => {
            setCaseActionLoadingId(caseObj.id);
            try {
              await supabaseService.updateCase(
                caseObj.id,
                { status: "FECHADO" },
                session.accessToken,
              );
              setCases((prev) =>
                prev.map((c) =>
                  c.id === caseObj.id ? { ...c, status: "FECHADO" } : c,
                ),
              );

              if (lawyerObj) {
                setReviewCaseInfo({ caseObj, lawyerObj });
                setIsReviewModalOpen(true);
              } else {
                Alert.alert("Sucesso", "Caso marcado como concluído.");
              }
            } catch (err) {
              Alert.alert("Erro", err.message);
            } finally {
              setCaseActionLoadingId(null);
            }
          },
        },
      ],
    );
  };

  const handleSubmitReview = async () => {
    if (!reviewScore) {
      Alert.alert("Erro", "Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }
    setIsSubmittingReview(true);
    try {
      await supabaseService.submitReview(
        {
          advogado_id: reviewCaseInfo.lawyerObj.id,
          cliente_id: user.id,
          caso_id: reviewCaseInfo.caseObj.id,
          nota: reviewScore,
          comentario: reviewComment,
        },
        session.accessToken,
      );
      setIsReviewModalOpen(false);
      setReviewScore(0);
      setReviewComment("");
      setReviewCaseInfo(null);
      Alert.alert(
        "Obrigado",
        "Sua avaliação foi salva e ajudará outros clientes!",
      );
    } catch (err) {
      Alert.alert("Erro", err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, session]);

  useEffect(() => {
    if (!clientId || !session?.accessToken) return;

    const notificationsChannel = supabaseRealtime
      .channel(`client-notifications-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${clientId}`,
        },
        () => {
          loadData();
        },
      )
      .subscribe();

    const interestsChannel = supabaseRealtime
      .channel(`client-case-interests-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "case_interests",
        },
        () => {
          loadData();
        },
      )
      .subscribe();

    return () => {
      supabaseRealtime.removeChannel(notificationsChannel);
      supabaseRealtime.removeChannel(interestsChannel);
    };
  }, [clientId, session?.accessToken]);

  // Polling de mensagens no Chat
  useEffect(() => {
    let intervalId = null;

    const fetchMessages = async () => {
      if (!activeChatCaseId || !session?.accessToken) return;
      try {
        const msgs = await supabaseService.getCaseMessages(
          activeChatCaseId,
          session.accessToken,
          activeChatInterestId,
        );
        setChatMessages(msgs || []);
      } catch (err) {
        console.error("[DashboardScreen] Erro ao buscar mensagens:", err);
      }
    };

    if (activeChatCaseId) {
      setIsLoadingMessages(true);
      fetchMessages().finally(() => {
        setIsLoadingMessages(false);
        // Scroll to bottom on initial load
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });

      intervalId = setInterval(fetchMessages, 4000);
    } else {
      setChatMessages([]);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeChatCaseId, activeChatInterestId, session]);

  const handleLogout = () => {
    clearAuthSession().catch((err) => {
      console.warn("[DashboardScreen] Erro ao limpar sessão local:", err);
    });
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  // Nome formatado para saudação
  const getGreetingName = () => {
    if (profile?.name) return profile.name.split(" ")[0];
    if (profileName) return profileName.split(" ")[0];
    if (!user?.email) return "Cliente";
    const namePart = user.email.split("@")[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  const formatMemberSince = (dateString) => {
    if (!dateString) return "março de 2026";
    try {
      const date = new Date(dateString);
      const months = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
      ];
      return `${months[date.getMonth()]} de ${date.getFullYear()}`;
    } catch (e) {
      return "março de 2026";
    }
  };

  // Ações do formulário Novo Caso
  const handlePublishCase = async () => {
    if (
      !newCaseTitle.trim() ||
      !newCaseCity.trim() ||
      !newCaseState ||
      !newCaseArea ||
      !newCaseDesc.trim()
    ) {
      Alert.alert(
        "Campos Obrigatórios",
        "Por favor, preencha todos os campos do formulário.",
      );
      return;
    }

    setIsSubmittingCase(true);
    try {
      const clientId = profile?.id || user.id;
      const casePayload = {
        titulo: newCaseTitle.trim(),
        descricao: newCaseDesc.trim(),
        area_atuacao: newCaseArea,
        cidade: newCaseCity.trim(),
        estado: newCaseState,
        cliente_id: clientId,
        anexos: newCaseAttachments.map((a) => a.uri).filter(Boolean),
      };

      await supabaseService.createCase(casePayload, session.accessToken);

      Alert.alert(
        "Caso Publicado",
        "Sua solicitação foi publicada com sucesso no banco de dados!",
      );

      // Reseta formulário
      setNewCaseTitle("");
      setNewCaseCity("");
      setNewCaseState("");
      setNewCaseArea("");
      setNewCaseDesc("");
      setNewCaseAttachments([]);
      setIsCreatingCase(false);

      // Recarrega dados
      await loadData();

      // Direciona para Meus Casos
      setCurrentTab("Meus Casos");
    } catch (err) {
      console.error("[DashboardScreen] Erro ao publicar caso:", err);
      Alert.alert("Erro", err.message || "Não foi possível publicar seu caso.");
    } finally {
      setIsSubmittingCase(false);
    }
  };

  // Ações de seleção de arquivos e upload real
  const handleAddAttachment = () => {
    if (newCaseAttachments.length >= 5) {
      Alert.alert("Limite Atingido", "Você pode adicionar no máximo 5 anexos.");
      return;
    }

    Alert.alert("Adicionar Anexo", "Escolha a origem do arquivo:", [
      {
        text: "Tirar Foto",
        onPress: () => pickAttachment("camera"),
      },
      {
        text: "Escolher da Galeria",
        onPress: () => pickAttachment("gallery"),
      },
      {
        text: "Selecionar Documento (PDF)",
        onPress: () => pickAttachment("document"),
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  };

  const pickAttachment = async (type) => {
    try {
      let result = null;
      if (type === "camera") {
        const cameraPermission =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert(
            "Permissão necessária",
            "Precisamos de acesso à câmera para tirar fotos.",
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: [ImagePicker.MediaType.Images],
          allowsEditing: false,
          quality: 0.8,
        });
      } else if (type === "gallery") {
        const galleryPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          Alert.alert(
            "Permissão necessária",
            "Precisamos de acesso à galeria para selecionar imagens.",
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: [ImagePicker.MediaType.Images],
          allowsEditing: false,
          quality: 0.8,
        });
      } else if (type === "document") {
        result = await DocumentPicker.getDocumentAsync({
          type: "*/*",
          copyToCacheDirectory: true,
        });
      }

      if (!result) return;

      const asset = result.assets
        ? result.assets[0]
        : result.type === "success"
          ? result
          : !result.cancelled
            ? result
            : null;
      if (!asset || asset.canceled || result.canceled) return;

      const localUri = asset.uri;
      const fileName =
        asset.name || asset.fileName || localUri.split("/").pop() || "arquivo";
      const mimeType = asset.mimeType || "application/octet-stream";
      const tempId = Math.random().toString(36).substring(7);

      const sizeStr = asset.size
        ? `${(asset.size / 1024 / 1024).toFixed(1)} MB`
        : "1.0 MB";

      const newFile = {
        id: tempId,
        name: fileName,
        size: sizeStr,
        loading: true,
        uri: "",
      };

      setNewCaseAttachments((prev) => [...prev, newFile]);

      try {
        const publicUrl = await supabaseService.uploadCaseAttachment(
          localUri,
          fileName,
          mimeType,
          session.accessToken,
        );
        setNewCaseAttachments((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? { ...item, loading: false, uri: publicUrl }
              : item,
          ),
        );
      } catch (err) {
        console.error("[DashboardScreen] Erro no upload:", err);
        Alert.alert(
          "Erro no Upload",
          "Não foi possível fazer o upload do anexo para o Supabase.",
        );
        setNewCaseAttachments((prev) =>
          prev.filter((item) => item.id !== tempId),
        );
      }
    } catch (err) {
      console.error("[DashboardScreen] Erro ao selecionar anexo:", err);
      Alert.alert("Erro", "Não foi possível selecionar o anexo.");
    }
  };

  const handleRemoveAttachment = (id) => {
    setNewCaseAttachments(newCaseAttachments.filter((item) => item.id !== id));
  };

  // Salvar alterações de perfil
  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      Alert.alert(
        "Campo Obrigatório",
        "O Nome Completo não pode estar em branco.",
      );
      return;
    }

    setIsSavingProfile(true);
    try {
      const clientId = profile?.id || user.id;
      const updated = await supabaseService.updateClientProfile(
        clientId,
        {
          name: profileName.trim(),
          phone: profilePhone.trim(),
        },
        session.accessToken,
      );

      if (updated) {
        setProfile((prev) => ({ ...prev, ...updated }));
      }

      if (profilePassword.trim()) {
        if (profilePassword.length < 6) {
          Alert.alert(
            "Senha Fraca",
            "A senha deve possuir pelo menos 6 caracteres.",
          );
          setIsSavingProfile(false);
          return;
        }
        await supabaseService.updateAuthPassword(
          profilePassword.trim(),
          session.accessToken,
        );
        setProfilePassword("");
        Alert.alert("Sucesso", "Perfil e senha atualizados no banco de dados!");
      } else {
        Alert.alert("Sucesso", "Perfil atualizado no banco de dados!");
      }

      await loadData();
    } catch (err) {
      console.error("[DashboardScreen] Erro ao salvar perfil:", err);
      Alert.alert(
        "Erro",
        err.message || "Falha ao salvar as alterações do perfil.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Excluir conta
  const handleDeleteAccount = () => {
    Alert.alert(
      "Excluir Conta",
      "Tem certeza absoluta que deseja excluir permanentemente sua conta? Seus dados serão apagados e a sessão será encerrada.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir Conta",
          style: "destructive",
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              const clientId = profile?.id || user.id;
              await supabaseService.deleteAccount(
                clientId,
                session.accessToken,
              );
              Alert.alert(
                "Conta Excluída",
                "Sua conta foi removida do banco de dados.",
              );
              handleLogout();
            } catch (err) {
              console.error("[DashboardScreen] Erro ao excluir conta:", err);
              Alert.alert("Erro", "Não foi possível excluir sua conta.");
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  // Gerenciamento de propostas / interesses
  const handleRespondToInterest = async (
    interestId,
    caseId,
    lawyerId,
    action,
  ) => {
    try {
      setLoading(true);
      await supabaseService.respondToInterest(
        interestId,
        caseId,
        lawyerId,
        action,
        session.accessToken,
      );

      let actionMsg = "";
      if (action === "ACCEPT")
        actionMsg =
          "negociação iniciada com sucesso! Você já pode conversar no chat.";
      if (action === "DECLINE") actionMsg = "proposta recusada.";
      if (action === "HIRE") actionMsg = "advogado contratado com sucesso!";

      Alert.alert("Sucesso", actionMsg);
      await loadData();
    } catch (err) {
      console.error("[DashboardScreen] Erro ao responder interesse:", err);
      Alert.alert(
        "Erro",
        err.message || "Não foi possível registrar sua resposta.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Real upload e envio de arquivo no chat
  const handleSendChatFile = async () => {
    if (!activeChatCaseId) return;

    Alert.alert("Enviar Arquivo no Chat", "Selecione o tipo de arquivo:", [
      {
        text: "Tirar Foto",
        onPress: () => pickAndSendChatFile("camera"),
      },
      {
        text: "Escolher da Galeria",
        onPress: () => pickAndSendChatFile("gallery"),
      },
      {
        text: "Selecionar Documento (PDF)",
        onPress: () => pickAndSendChatFile("document"),
      },
      {
        text: "Cancelar",
        style: "cancel",
      },
    ]);
  };

  const pickAndSendChatFile = async (type) => {
    try {
      let result = null;
      if (type === "camera") {
        const cameraPermission =
          await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert(
            "Permissão necessária",
            "Precisamos de acesso à câmera para tirar fotos.",
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: [ImagePicker.MediaType.Images],
          allowsEditing: false,
          quality: 0.8,
        });
      } else if (type === "gallery") {
        const galleryPermission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPermission.granted) {
          Alert.alert(
            "Permissão necessária",
            "Precisamos de acesso à galeria para selecionar imagens.",
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: [ImagePicker.MediaType.Images],
          allowsEditing: false,
          quality: 0.8,
        });
      } else if (type === "document") {
        result = await DocumentPicker.getDocumentAsync({
          type: "*/*",
          copyToCacheDirectory: true,
        });
      }

      if (!result) return;

      const asset = result.assets
        ? result.assets[0]
        : result.type === "success"
          ? result
          : !result.canceled
            ? result
            : null;
      if (!asset || asset.canceled || result.canceled) return;

      const localUri = asset.uri;
      const fileName =
        asset.name || asset.fileName || localUri.split("/").pop() || "arquivo";
      const mimeType = asset.mimeType || "application/octet-stream";

      setLoading(true);

      try {
        const publicUrl = await supabaseService.uploadCaseAttachment(
          localUri,
          fileName,
          mimeType,
          session.accessToken,
        );
        const clientId = profile?.id || user.id;

        await supabaseService.sendCaseMessage(
          {
            caso_id: activeChatCaseId,
            sender_id: clientId,
            content: `[ANEXO_REAL] ${fileName}|${publicUrl}`,
            interest_id: activeChatInterestId,
          },
          session.accessToken,
        );

        // Recarrega mensagens
        const msgs = await supabaseService.getCaseMessages(
          activeChatCaseId,
          session.accessToken,
          activeChatInterestId,
        );
        setChatMessages(msgs || []);

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } catch (err) {
        console.error(
          "[DashboardScreen] Erro ao fazer upload e enviar no chat:",
          err,
        );
        Alert.alert(
          "Erro",
          "Não foi possível fazer o upload e enviar o arquivo.",
        );
      } finally {
        setLoading(false);
      }
    } catch (err) {
      console.error("[DashboardScreen] Erro ao selecionar arquivo:", err);
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  };

  // --- Áudio Recording ---
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        setRecording(recording);
        setIsRecording(true);
      } else {
        Alert.alert(
          "Permissão Negada",
          "Você precisa conceder acesso ao microfone para enviar áudio.",
        );
      }
    } catch (err) {
      console.error("Falha ao iniciar gravação:", err);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      const clientId = profile?.id || user.id;
      const newMsg = {
        caso_id: activeChatCaseId,
        sender_id: clientId,
        content: JSON.stringify({ type: "audio", url: uri }),
        interest_id: activeChatInterestId || null,
      };

      await supabaseService.sendCaseMessage(newMsg, session.accessToken);

      const msgs = await supabaseService.getCaseMessages(
        activeChatCaseId,
        session.accessToken,
        activeChatInterestId,
      );
      setChatMessages(msgs || []);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Falha ao parar gravação:", error);
    }
  };

  // Enviar mensagem no Chat
  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !activeChatCaseId) return;

    const text = newMessageText.trim();
    setNewMessageText(""); // UX limpa input na hora

    try {
      const clientId = profile?.id || user.id;
      await supabaseService.sendCaseMessage(
        {
          caso_id: activeChatCaseId,
          sender_id: clientId,
          content: text,
          interest_id: activeChatInterestId,
        },
        session.accessToken,
      );

      // Recarrega imediatamente as mensagens do chat
      const msgs = await supabaseService.getCaseMessages(
        activeChatCaseId,
        session.accessToken,
        activeChatInterestId,
      );
      setChatMessages(msgs || []);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error("[DashboardScreen] Erro ao enviar mensagem:", err);
      Alert.alert("Erro", "Não foi possível enviar a mensagem.");
    }
  };

  const handleSendMockFile = async () => {
    if (!activeChatCaseId) return;

    const mockFiles = [
      "Contrato_Residencia_Assinado.pdf (1.2 MB)",
      "Identificacao_Comprovada.pdf (780 KB)",
      "Faturas_Atrasadas_Luz.pdf (2.4 MB)",
    ];

    const randomFile = mockFiles[Math.floor(Math.random() * mockFiles.length)];
    const text = `[ANEXO_SIMULADO] ${randomFile}`;

    try {
      const clientId = profile?.id || user.id;
      await supabaseService.sendCaseMessage(
        {
          caso_id: activeChatCaseId,
          sender_id: clientId,
          content: text,
          interest_id: activeChatInterestId,
        },
        session.accessToken,
      );

      const msgs = await supabaseService.getCaseMessages(
        activeChatCaseId,
        session.accessToken,
        activeChatInterestId,
      );
      setChatMessages(msgs || []);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error("[DashboardScreen] Erro ao enviar anexo:", err);
    }
  };

  // Mapeamento de timeline e status do caso ativo
  const getTimelineStatus = (status) => {
    const defaultTimeline = {
      step: 1,
      statusLabel: "Petição Inicial",
      nextStep: "Aguardando manifestação de advogados.",
    };

    if (!status) return defaultTimeline;

    const norm = status.toUpperCase();
    if (norm === "ABERTO" || norm === "PETICAO") {
      return {
        step: 1,
        statusLabel: "Petição Inicial",
        nextStep: "Aguardando manifestação de advogados.",
      };
    } else if (norm === "NEGOCIANDO") {
      return {
        step: 1,
        statusLabel: "Em Negociação",
        nextStep:
          "Converse no chat com o advogado para alinhar detalhes e realizar a contratação.",
      };
    } else if (norm === "EM_ANDAMENTO" || norm === "CONTRATADO") {
      return {
        step: 2,
        statusLabel: "Em Andamento",
        nextStep: "Análise documental e elaboração de petições pelo advogado.",
      };
    } else if (norm === "SENTENCA" || norm === "DECISAO") {
      return {
        step: 3,
        statusLabel: "Decisão / Sentença",
        nextStep: "Prazo recursal e execução de valores.",
      };
    } else if (norm === "FECHADO" || norm === "CONCLUIDO") {
      return {
        step: 4,
        statusLabel: "Concluído",
        nextStep: "Seu processo foi finalizado com sucesso!",
      };
    }
    return defaultTimeline;
  };

  // ---- RENDERERS DE CADA TELA ----

  // ABA HOME
  const renderHomeTab = () => {
    // Busca o primeiro caso ativo
    const activeCase =
      cases.find((c) => c.status !== "FECHADO" && c.status !== "CANCELADO") ||
      cases[0];

    // Filtro para os advogados disponíveis
    const filteredLawyers = (
      selectedLawyerArea === "Todos"
        ? lawyersList
        : lawyersList.filter((l) => {
            if (!l.specialties) return false;
            const specString =
              typeof l.specialties === "string"
                ? l.specialties
                : JSON.stringify(l.specialties);
            return specString
              .toLowerCase()
              .includes(selectedLawyerArea.toLowerCase());
          })
    ).sort((a, b) => {
      if (a.plan_type === "PRO" && b.plan_type !== "PRO") return -1;
      if (b.plan_type === "PRO" && a.plan_type !== "PRO") return 1;
      return 0;
    });

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#f5c853"]}
            tintColor="#f5c853"
          />
        }
      >
        {/* Saudação */}
        <View style={styles.welcomeSection}>
          <View style={styles.homeHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTitle}>Olá, {getGreetingName()}.</Text>
              <Text style={styles.welcomeSub}>
                Aqui está o resumo atualizado das suas demandas legais.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              activeOpacity={0.8}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={16} color="#f5c853" />
              <Text style={styles.logoutBtnText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Advogados Online Badge */}
        <View style={styles.onlineBadge}>
          <View style={styles.onlineGreenDot} />
          <Text style={styles.onlineText}>
            {lawyersList.filter((l) => l.estado === "SP").length || 14}{" "}
            Advogados Online
          </Text>
        </View>

        {/* Card Novo Caso */}
        <TouchableOpacity
          style={styles.voiceCard}
          activeOpacity={0.9}
          onPress={() => setIsCreatingCase(true)}
        >
          <View style={styles.voiceMicCircle}>
            <Feather name="plus" size={24} color="#090a0d" />
          </View>
          <Text style={styles.voiceTitle}>Iniciar Novo Caso</Text>
          <Text style={styles.voiceSub}>
            Toque para preencher os dados de uma nova solicitação
          </Text>
        </TouchableOpacity>

        {/* Advogados interessados nos seus casos (movido para cá) */}
        {(() => {
          const activeInterests = interesses.filter(
            (i) => i.status === "PENDING" || i.status === "NEGOTIATING",
          );
          if (activeInterests.length === 0) return null;

          return (
            <View style={styles.card}>
              <View style={styles.interestSectionHeader}>
                <Feather name="bell" size={18} color="#f5c853" />
                <Text style={styles.interestSectionTitle}>
                  Advogados interessados nos seus casos (
                  {activeInterests.length})
                </Text>
              </View>

              {activeInterests.map((interest) => {
                const lawyerObj = lawyersList.find(
                  (l) => l.id === interest.lawyer_id,
                );
                const lawyerName =
                  lawyerObj?.name || interest.lawyer_name || "Advogado";
                const lawyerSpecialty =
                  lawyerObj?.specialties ||
                  interest.caso?.area_atuacao ||
                  "Geral";
                const isPending = interest.status === "PENDING";

                return (
                  <View key={interest.id} style={styles.interestItemContainer}>
                    <View style={styles.interestRow}>
                      {lawyerObj?.avatar ? (
                        <Image
                          source={{ uri: lawyerObj.avatar }}
                          style={styles.lawyerAvatar}
                        />
                      ) : (
                        <View style={styles.interestAvatar}>
                          <Text style={styles.interestAvatarText}>
                            {lawyerName.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.interestInfo}>
                        <View style={styles.interestNameRow}>
                          <Feather
                            name="award"
                            size={12}
                            color="#f5c853"
                            style={styles.interestSparkIcon}
                          />
                          <Text style={styles.interestName}>{lawyerName}</Text>
                          {lawyerObj?.plan_type === "PRO" && (
                            <View
                              style={{
                                backgroundColor: "#f5c853",
                                borderRadius: 4,
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                marginLeft: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: "#090a0d",
                                  fontSize: 9,
                                  fontWeight: "bold",
                                }}
                              >
                                PRO
                              </Text>
                            </View>
                          )}
                          {lawyerObj?.oab_verification_status ===
                            "VERIFIED" && (
                            <View
                              style={{
                                backgroundColor: "rgba(57, 211, 83, 0.2)",
                                borderRadius: 4,
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                marginLeft: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: "#39d353",
                                  fontSize: 9,
                                  fontWeight: "bold",
                                }}
                              >
                                OAB
                              </Text>
                            </View>
                          )}
                          {!isPending && (
                            <View
                              style={[
                                styles.interestNegotiatingBadge,
                                { marginLeft: 6 },
                              ]}
                            >
                              <Text style={styles.interestNegotiatingBadgeText}>
                                EM NEGOCIAÇÃO
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={styles.interestCaseTitle}
                          numberOfLines={1}
                        >
                          Caso: {interest.caso?.titulo || "Seu caso"}
                        </Text>
                        <Text style={styles.interestArea}>
                          {lawyerSpecialty}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.interestActions}>
                      {isPending ? (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.interestBtn,
                              styles.interestBtnAccept,
                            ]}
                            activeOpacity={0.8}
                            onPress={() =>
                              handleRespondToInterest(
                                interest.id,
                                interest.case_id,
                                interest.lawyer_id,
                                "ACCEPT",
                              )
                            }
                          >
                            <Feather name="check" size={14} color="#39d353" />
                            <Text style={styles.interestBtnAcceptText}>
                              Negociar
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.interestBtn,
                              styles.interestBtnDecline,
                            ]}
                            activeOpacity={0.8}
                            onPress={() =>
                              handleRespondToInterest(
                                interest.id,
                                interest.case_id,
                                interest.lawyer_id,
                                "DECLINE",
                              )
                            }
                          >
                            <Feather name="user-x" size={14} color="#ef4444" />
                            <Text style={styles.interestBtnDeclineText}>
                              Recusar
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.interestBtn, styles.interestBtnChat]}
                            activeOpacity={0.8}
                            onPress={() => {
                              setActiveChatCaseId(interest.case_id);
                              setActiveChatInterestId(interest.id);
                              setCurrentTab("Mensagens");
                            }}
                          >
                            <Feather
                              name="message-square"
                              size={14}
                              color="#a855f7"
                            />
                            <Text style={styles.interestBtnChatText}>
                              Conversar
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.interestBtn, styles.interestBtnHire]}
                            activeOpacity={0.8}
                            onPress={() => {
                              Alert.alert(
                                "Contratar Advogado",
                                `Deseja contratar ${lawyerName} para este caso? Esta ação vinculará o advogado ao processo e debitará 3 Juris do saldo dele.`,
                                [
                                  { text: "Cancelar", style: "cancel" },
                                  {
                                    text: "Contratar",
                                    onPress: () =>
                                      handleRespondToInterest(
                                        interest.id,
                                        interest.case_id,
                                        interest.lawyer_id,
                                        "HIRE",
                                      ),
                                  },
                                ],
                              );
                            }}
                          >
                            <Feather name="award" size={14} color="#f5c853" />
                            <Text style={styles.interestBtnHireText}>
                              Contratar
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.interestBtn,
                              styles.interestBtnDecline,
                            ]}
                            activeOpacity={0.8}
                            onPress={() =>
                              handleRespondToInterest(
                                interest.id,
                                interest.case_id,
                                interest.lawyer_id,
                                "DECLINE",
                              )
                            }
                          >
                            <Feather name="user-x" size={14} color="#ef4444" />
                            <Text style={styles.interestBtnDeclineText}>
                              Recusar
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}
        {/* Status Caso Ativo ou Estado Vazio */}
        {activeCase ? (
          (() => {
            const timeline = getTimelineStatus(activeCase.status);
            const lawyerObj = lawyers[activeCase.advogado_id];

            return (
              <View>
                {/* Detalhes do Processo */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardHeaderTitle}>
                      STATUS DO CASO ATIVO
                    </Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>
                        {timeline.statusLabel}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.caseTitle}>{activeCase.titulo}</Text>
                  <Text style={styles.caseNumber}>
                    Nº{" "}
                    {activeCase.id
                      ? activeCase.id.substring(0, 8).toUpperCase()
                      : "N/A"}
                    -SJ
                  </Text>

                  <View style={styles.caseDetailsContainer}>
                    <View style={styles.caseDetailItem}>
                      <Feather
                        name="paperclip"
                        size={14}
                        color="#8e94a2"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.caseDetailText}>
                        Anexos:{" "}
                        {activeCase.anexos
                          ? Array.isArray(activeCase.anexos)
                            ? activeCase.anexos.length
                            : Object.keys(activeCase.anexos).length
                          : 0}
                        /5
                      </Text>
                    </View>
                    <View style={styles.caseDetailItem}>
                      <Text style={styles.caseDetailText}>
                        Banco: Supabase DB
                      </Text>
                    </View>
                  </View>

                  {/* Timeline Horizontal */}
                  <View style={styles.timelineContainer}>
                    <View
                      style={
                        timeline.step >= 1
                          ? styles.timelineStepChecked
                          : styles.timelineStepInactive
                      }
                    >
                      {timeline.step >= 1 && (
                        <Feather name="check" size={10} color="#090a0d" />
                      )}
                    </View>
                    <View
                      style={
                        timeline.step >= 2
                          ? styles.timelineLineActive
                          : styles.timelineLineInactive
                      }
                    />

                    <View
                      style={
                        timeline.step >= 2
                          ? timeline.step === 2
                            ? styles.timelineStepActive
                            : styles.timelineStepChecked
                          : styles.timelineStepInactive
                      }
                    >
                      {timeline.step > 2 ? (
                        <Feather name="check" size={10} color="#090a0d" />
                      ) : (
                        timeline.step === 2 && (
                          <View style={styles.timelineStepActiveInner} />
                        )
                      )}
                    </View>
                    <View
                      style={
                        timeline.step >= 3
                          ? styles.timelineLineActive
                          : styles.timelineLineInactive
                      }
                    />

                    <View
                      style={
                        timeline.step >= 3
                          ? timeline.step === 3
                            ? styles.timelineStepActive
                            : styles.timelineStepChecked
                          : styles.timelineStepInactive
                      }
                    >
                      {timeline.step > 3 ? (
                        <Feather name="check" size={10} color="#090a0d" />
                      ) : (
                        timeline.step === 3 && (
                          <View style={styles.timelineStepActiveInner} />
                        )
                      )}
                    </View>
                    <View
                      style={
                        timeline.step >= 4
                          ? styles.timelineLineActive
                          : styles.timelineLineInactive
                      }
                    />

                    <View
                      style={
                        timeline.step === 4
                          ? styles.timelineStepActive
                          : styles.timelineStepInactive
                      }
                    >
                      {timeline.step === 4 && (
                        <View style={styles.timelineStepActiveInner} />
                      )}
                    </View>
                  </View>

                  <Text style={styles.timelineNextStep}>
                    Próximo passo:{" "}
                    <Text style={{ color: "#ffffff", fontWeight: "bold" }}>
                      {timeline.nextStep}
                    </Text>
                  </Text>
                </View>

                {/* Contato com Advogado */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardHeaderTitle}>
                      CONTATO COM ADVOGADO
                    </Text>
                  </View>

                  {lawyerObj ? (
                    <View>
                      <View style={styles.lawyerRow}>
                        {lawyerObj.avatar ? (
                          <Image
                            source={{ uri: lawyerObj.avatar }}
                            style={styles.lawyerAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              styles.lawyerAvatar,
                              {
                                backgroundColor: "#f5c853",
                                justifyContent: "center",
                                alignItems: "center",
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: "#090a0d",
                                fontWeight: "bold",
                                fontSize: 16,
                              }}
                            >
                              {lawyerObj.name
                                ? lawyerObj.name.substring(0, 2).toUpperCase()
                                : "AD"}
                            </Text>
                          </View>
                        )}
                        <View style={styles.lawyerInfo}>
                          <View style={styles.lawyerNameRow}>
                            <Text style={styles.lawyerName}>
                              {lawyerObj.name || "Advogado Associado"}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginLeft: 8,
                              }}
                            >
                              {lawyerObj.plan_type === "PRO" && (
                                <View
                                  style={{
                                    backgroundColor: "#f5c853",
                                    borderRadius: 4,
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    marginRight: 4,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#090a0d",
                                      fontSize: 9,
                                      fontWeight: "bold",
                                    }}
                                  >
                                    PRO
                                  </Text>
                                </View>
                              )}
                              {lawyerObj.oab_verification_status ===
                                "VERIFIED" && (
                                <View
                                  style={{
                                    backgroundColor: "rgba(57, 211, 83, 0.2)",
                                    borderRadius: 4,
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#39d353",
                                      fontSize: 9,
                                      fontWeight: "bold",
                                    }}
                                  >
                                    OAB Verificada
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <Text style={styles.lawyerMessage} numberOfLines={1}>
                            {lawyerObj.bio ||
                              "Caso aceito. Clique no chat para conversar."}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.chatConnectBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          setActiveChatCaseId(activeCase.id);
                          setActiveChatInterestId(null);
                          setCurrentTab("Mensagens");
                        }}
                      >
                        <Feather
                          name="message-square"
                          size={16}
                          color="#090a0d"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.chatConnectBtnText}>
                          Enviar Mensagem no Chat
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : activeCase.status?.toUpperCase() === "NEGOCIANDO" ? (
                    <View style={styles.noLawyerCard}>
                      <Feather
                        name="message-square"
                        size={24}
                        color="#f5c853"
                        style={{ marginBottom: 8 }}
                      />
                      <Text style={styles.noLawyerTitle}>Em Negociação</Text>
                      <Text style={styles.noLawyerText}>
                        Você aceitou a manifestação de interesse! Converse no
                        chat com o advogado na lista de propostas abaixo para
                        alinhar os detalhes.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.noLawyerCard}>
                      <Feather
                        name="clock"
                        size={24}
                        color="#f5c853"
                        style={{ marginBottom: 8 }}
                      />
                      <Text style={styles.noLawyerTitle}>
                        Aguardando Advogado
                      </Text>
                      <Text style={styles.noLawyerText}>
                        Sua solicitação está sendo avaliada por advogados
                        qualificados de nossa rede.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })()
        ) : (
          /* Estado Vazio de Casos */
          <View style={styles.emptyStateCard}>
            <Feather
              name="folder-plus"
              size={48}
              color="#f5c853"
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.emptyStateTitle}>Nenhum Caso em Andamento</Text>
            <Text style={styles.emptyStateSub}>
              Publique uma nova solicitação e conecte-se com advogados
              especialistas agora mesmo.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateBtn}
              activeOpacity={0.8}
              onPress={() => setIsCreatingCase(true)}
            >
              <Text style={styles.emptyStateBtnText}>Publicar Solicitação</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Escritórios Parceiros */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleWithIcon}>
              <Feather
                name="briefcase"
                size={16}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.cardHeaderTitle}>ESCRITÓRIOS PARCEIROS</Text>
            </View>
          </View>

          {officesList && officesList.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContainer}
            >
              {officesList.map((office) => (
                <TouchableOpacity
                  key={office.id}
                  style={styles.officeCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedOffice(office);
                    setIsOfficeModalOpen(true);
                  }}
                >
                  {office.logo_url ? (
                    <Image
                      source={{ uri: office.logo_url }}
                      style={styles.officeLogo}
                    />
                  ) : (
                    <View style={styles.officeLogoPlaceholder}>
                      <Text style={styles.officeLogoPlaceholderText}>
                        {office.nome
                          ? office.nome.substring(0, 2).toUpperCase()
                          : "EP"}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.officeName} numberOfLines={1}>
                    {office.nome || "Escritório Parceiro"}
                  </Text>
                  <Text style={styles.officeLocation} numberOfLines={1}>
                    {office.cidade_estado || "São Paulo - SP"}
                  </Text>
                  <View style={styles.officeBadge}>
                    <Text style={styles.officeBadgeText}>
                      {office.plano === "pro_plus" ? "PRO PLUS" : "PARCEIRO"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noDataText}>
              Nenhum escritório parceiro encontrado.
            </Text>
          )}
        </View>

        {/* Advogados Disponíveis */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleWithIcon}>
              <Feather
                name="users"
                size={16}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.cardHeaderTitle}>ADVOGADOS DISPONÍVEIS</Text>
            </View>
          </View>

          {/* Filtro por Especialidade */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsScroll}
          >
            {[
              "Todos",
              "Trabalhista",
              "Civil",
              "Família",
              "Penal",
              "Previdenciário",
              "Consumidor",
            ].map((area) => {
              const isSelected = selectedLawyerArea === area;
              return (
                <TouchableOpacity
                  key={area}
                  style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedLawyerArea(area)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      isSelected && styles.pillTextActive,
                    ]}
                  >
                    {area}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredLawyers && filteredLawyers.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContainer}
            >
              {filteredLawyers.map((lawyer) => (
                <TouchableOpacity
                  key={lawyer.id}
                  style={styles.lawyerCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedLawyer(lawyer);
                    setIsLawyerModalOpen(true);
                  }}
                >
                  {lawyer.avatar ? (
                    <Image
                      source={{ uri: lawyer.avatar }}
                      style={styles.lawyerCardAvatar}
                    />
                  ) : (
                    <View style={styles.lawyerCardAvatarPlaceholder}>
                      <Text style={styles.lawyerCardAvatarText}>
                        {lawyer.name
                          ? lawyer.name.substring(0, 2).toUpperCase()
                          : "AD"}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.lawyerCardName} numberOfLines={1}>
                    {lawyer.name || "Advogado"}
                  </Text>

                  {/* TAGS PRO e OAB */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginVertical: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {lawyer.plan_type === "PRO" && (
                      <View
                        style={{
                          backgroundColor: "#f5c853",
                          borderRadius: 4,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          marginRight: 4,
                          marginBottom: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: "#090a0d",
                            fontSize: 9,
                            fontWeight: "bold",
                          }}
                        >
                          PRO
                        </Text>
                      </View>
                    )}
                    {lawyer.oab_verification_status === "VERIFIED" && (
                      <View
                        style={{
                          backgroundColor: "rgba(57, 211, 83, 0.2)",
                          borderRadius: 4,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          marginBottom: 2,
                        }}
                      >
                        <Text
                          style={{
                            color: "#39d353",
                            fontSize: 9,
                            fontWeight: "bold",
                          }}
                        >
                          OAB
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.lawyerCardSpecialty} numberOfLines={1}>
                    {lawyer.specialties || "Geral"}
                  </Text>

                  {/* Consulta Info */}
                  <View style={{ marginTop: 6, marginBottom: 4 }}>
                    {lawyer.consulta === "Paga" ? (
                      <View>
                        <Text
                          style={{
                            color: "#f5c853",
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        >
                          Consulta Paga
                        </Text>
                        <Text style={{ color: "#8e94a2", fontSize: 9 }}>
                          {lawyer.tempo || "Duração não informada"} •{" "}
                          {lawyer.valor
                            ? `R$ ${Number(lawyer.valor).toFixed(2)}`
                            : "Valor sob consulta"}
                        </Text>
                      </View>
                    ) : (
                      <View>
                        <Text
                          style={{
                            color: "#39d353",
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        >
                          Consulta Gratuita
                        </Text>
                        <Text style={{ color: "#8e94a2", fontSize: 9 }}>
                          Primeiro contato sem custo
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.lawyerRatingRow}>
                    <Feather
                      name="star"
                      size={12}
                      color="#f5c853"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.lawyerRatingText}>
                      {lawyer.avg_rating ? lawyer.avg_rating.toFixed(1) : "5.0"}{" "}
                      ({lawyer.total_ratings || 0})
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noDataText}>
              Nenhum advogado encontrado nesta área.
            </Text>
          )}
        </View>

        {/* Auditoria e Compliance */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleWithIcon}>
              <Feather
                name="shield"
                size={16}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.cardHeaderTitle}>AUDITORIA E COMPLIANCE</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.complianceItem}
            activeOpacity={0.8}
            onPress={() => openWebLink("https://confirmadv.oab.org.br/")}
          >
            <View style={styles.complianceIconBg}>
              <Feather name="award" size={18} color="#f5c853" />
            </View>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceTitle}>OAB ConfirmaAdv</Text>
              <Text style={styles.complianceDesc}>
                Validar registro profissional do advogado
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#8e94a2" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.complianceItem}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert(
                "Consulta Processual",
                "Selecione o portal de consulta processual pública:",
                [
                  {
                    text: "CNJ (Conselho Nacional de Justiça)",
                    onPress: () => openWebLink("https://www.cnj.jus.br/"),
                  },
                  {
                    text: "TST (Tribunal Superior do Trabalho)",
                    onPress: () => openWebLink("https://www.tst.jus.br/"),
                  },
                  { text: "Cancelar", style: "cancel" },
                ],
              );
            }}
          >
            <View style={styles.complianceIconBg}>
              <MaterialCommunityIcons
                name="scale-balance"
                size={18}
                color="#f5c853"
              />
            </View>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceTitle}>CNJ / TST</Text>
              <Text style={styles.complianceDesc}>
                Consulta processual pública de demandas
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#8e94a2" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.complianceItem}
            activeOpacity={0.8}
            onPress={() => openWebLink("https://cav.receita.fazenda.gov.br/")}
          >
            <View style={styles.complianceIconBg}>
              <MaterialCommunityIcons name="bank" size={18} color="#f5c853" />
            </View>
            <View style={styles.complianceInfo}>
              <Text style={styles.complianceTitle}>e-CAC</Text>
              <Text style={styles.complianceDesc}>
                Regularidade fiscal perante a Receita Federal
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#8e94a2" />
          </TouchableOpacity>
        </View>

        {/* Links Úteis */}
        <View style={[styles.card, { marginTop: 16, marginBottom: 20 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleWithIcon}>
              <Feather
                name="link"
                size={16}
                color="#ffffff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.cardHeaderTitle}>LINKS ÚTEIS</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.usefulLinksScroll}
          >
            {USEFUL_LINKS.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.usefulLinkCard}
                activeOpacity={0.8}
                onPress={() => openWebLink(item.url)}
              >
                <View style={styles.usefulLinkHeader}>
                  <Feather
                    name={item.icon || "globe"}
                    size={14}
                    color="#f5c853"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.usefulLinkTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.usefulLinkDesc} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={styles.usefulLinkAction}>Abrir link</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    );
  };

  // ABA MEUS CASOS
  const renderCasosTab = () => {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#f5c853"]}
            tintColor="#f5c853"
          />
        }
      >
        <View style={styles.welcomeSection}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.welcomeTitle}>Meus Casos</Text>
            <TouchableOpacity
              style={styles.addCaseHeaderBtn}
              activeOpacity={0.8}
              onPress={() => setIsCreatingCase(true)}
            >
              <Feather
                name="plus"
                size={16}
                color="#090a0d"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.addCaseHeaderBtnText}>Novo Caso</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.welcomeSub}>
            Acompanhe o andamento de todos os seus processos legais no Supabase.
          </Text>
        </View>

        {cases && cases.length > 0 ? (
          cases.map((c) => {
            const timeline = getTimelineStatus(c.status);
            const lawyerObj = lawyers[c.advogado_id];

            return (
              <TouchableOpacity
                key={c.id}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => {
                  const caseInterests = interesses.filter(
                    (i) => i.case_id === c.id && i.status === "NEGOTIATING",
                  );

                  if (c.advogado_id) {
                    setActiveChatInterestId(null);
                    setActiveChatCaseId(c.id);
                    setCurrentTab("Mensagens");
                  } else if (caseInterests.length === 1) {
                    setActiveChatInterestId(caseInterests[0].id);
                    setActiveChatCaseId(c.id);
                    setCurrentTab("Mensagens");
                  } else if (caseInterests.length > 1) {
                    setCurrentTab("Mensagens"); // Leva para a aba para escolher qual chat abrir
                  } else {
                    Alert.alert(
                      "Aguardando Advogado",
                      "Ainda não há advogados interessados ou em negociação para este caso.",
                    );
                  }
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.caseItemArea}>
                    {c.area_atuacao || "Civil"}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>
                      {timeline.statusLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.caseItemTitle}>{c.titulo}</Text>
                <Text style={styles.caseItemDesc} numberOfLines={3}>
                  {c.descricao}
                </Text>

                <View style={styles.caseItemFooter}>
                  <Text style={styles.caseItemLoc}>
                    {c.cidade} - {c.estado}
                  </Text>
                  {lawyerObj && (
                    <Text style={styles.caseItemLawyer}>
                      Advogado: {lawyerObj.name}
                    </Text>
                  )}
                </View>

                {/* Ações do Caso */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: "#1a1d24",
                  }}
                >
                  {c.status !== "FECHADO" && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: "rgba(57, 211, 83, 0.1)",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                      onPress={() => handleFinishCase(c, lawyerObj)}
                      disabled={caseActionLoadingId === c.id}
                    >
                      <Feather
                        name="check-circle"
                        size={14}
                        color="#39d353"
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={{
                          color: "#39d353",
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        {caseActionLoadingId === c.id
                          ? "Processando..."
                          : "Concluir Caso"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={{
                      backgroundColor: "rgba(255, 77, 77, 0.1)",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      flexDirection: "row",
                      alignItems: "center",
                      marginLeft: 10,
                    }}
                    onPress={() => handleDeleteCase(c.id)}
                    disabled={caseActionLoadingId === c.id}
                  >
                    <Feather
                      name="trash-2"
                      size={14}
                      color="#ff4d4d"
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={{
                        color: "#ff4d4d",
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      {caseActionLoadingId === c.id
                        ? "Processando..."
                        : "Apagar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyStateCard}>
            <Feather
              name="folder"
              size={48}
              color="#f5c853"
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.emptyStateTitle}>
              Nenhum Processo Cadastrado
            </Text>
            <Text style={styles.emptyStateSub}>
              Sua lista de processos legais está vazia no momento.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateBtn}
              activeOpacity={0.8}
              onPress={() => setIsCreatingCase(true)}
            >
              <Text style={styles.emptyStateBtnText}>
                Cadastrar Primeiro Caso
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  // FORMULÁRIO NOVO CASO
  const renderNewCaseForm = () => {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header customizado com voltar */}
          <View style={styles.formHeaderRow}>
            <TouchableOpacity
              onPress={() => setIsCreatingCase(false)}
              style={styles.formBackBtn}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={24} color="#f5c853" />
            </TouchableOpacity>
            <View>
              <Text style={styles.formMainTitle}>Novo Caso</Text>
              <Text style={styles.formSubTitle}>
                Bem-vindo, {getGreetingName()}
              </Text>
            </View>
          </View>

          <View style={styles.formBody}>
            {/* Título do Caso */}
            <Text style={styles.formLabel}>Título do Caso</Text>
            <View style={styles.formInputContainer}>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Divórcio Consensual, Ação Revisional..."
                placeholderTextColor="#505560"
                value={newCaseTitle}
                onChangeText={setNewCaseTitle}
              />
            </View>

            {/* Cidade */}
            <Text style={styles.formLabel}>Cidade</Text>
            <View style={styles.formInputContainer}>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Porto Alegre"
                placeholderTextColor="#505560"
                value={newCaseCity}
                onChangeText={setNewCaseCity}
              />
            </View>

            {/* Estado (UF) */}
            <Text style={styles.formLabel}>Estado (UF)</Text>
            <TouchableOpacity
              style={styles.formSelector}
              activeOpacity={0.8}
              onPress={() => setShowStatePicker(true)}
            >
              <Text
                style={
                  newCaseState
                    ? styles.formSelectorText
                    : styles.formPlaceholderText
                }
              >
                {newCaseState || "Selecione"}
              </Text>
              <Feather name="chevron-down" size={18} color="#f5c853" />
            </TouchableOpacity>

            {/* Área de Atuação */}
            <Text style={styles.formLabel}>Área de Atuação</Text>
            <TouchableOpacity
              style={styles.formSelector}
              activeOpacity={0.8}
              onPress={() => setShowAreaPicker(true)}
            >
              <Text
                style={
                  newCaseArea
                    ? styles.formSelectorText
                    : styles.formPlaceholderText
                }
              >
                {newCaseArea || "Selecione uma área"}
              </Text>
              <Feather name="chevron-down" size={18} color="#f5c853" />
            </TouchableOpacity>

            {/* Descrição Detalhada */}
            <Text style={styles.formLabel}>Descrição Detalhada</Text>
            <View
              style={[
                styles.formInputContainer,
                { height: 120, alignItems: "flex-start", paddingTop: 10 },
              ]}
            >
              <TextInput
                style={[
                  styles.formInput,
                  { height: "100%", textAlignVertical: "top" },
                ]}
                placeholder="Explique o que aconteceu da forma mais detalhada possível..."
                placeholderTextColor="#505560"
                multiline
                numberOfLines={6}
                value={newCaseDesc}
                onChangeText={setNewCaseDesc}
              />
            </View>

            {/* Anexos */}
            <Text style={styles.formLabel}>Anexos (Opcional - Máx 5)</Text>
            <TouchableOpacity
              style={styles.attachmentBox}
              activeOpacity={0.8}
              onPress={handleAddAttachment}
            >
              <Feather
                name="plus"
                size={24}
                color="#f5c853"
                style={{ marginBottom: 6 }}
              />
              <Text style={styles.attachmentBoxText}>
                Clique para selecionar Imagens ou PDFs
              </Text>
            </TouchableOpacity>

            {/* Lista de Anexos Adicionados */}
            {newCaseAttachments.length > 0 && (
              <View style={styles.attachmentList}>
                {newCaseAttachments.map((file) => (
                  <View key={file.id} style={styles.attachmentItem}>
                    <Feather
                      name="file"
                      size={16}
                      color="#f5c853"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.attachmentItemName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.attachmentItemSize}>({file.size})</Text>
                    <TouchableOpacity
                      style={styles.attachmentRemoveBtn}
                      onPress={() => handleRemoveAttachment(file.id)}
                    >
                      <Feather name="trash-2" size={16} color="#ff4d4d" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Botão Publicar */}
            <TouchableOpacity
              style={styles.submitBtn}
              activeOpacity={0.9}
              onPress={handlePublishCase}
              disabled={isSubmittingCase}
            >
              {isSubmittingCase ? (
                <ActivityIndicator color="#090a0d" />
              ) : (
                <Text style={styles.submitBtnText}>Publicar Solicitação</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Modal Estado */}
        <Modal visible={showStatePicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowStatePicker(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Selecione o Estado (UF)</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {BRAZILIAN_STATES.map((uf) => (
                  <TouchableOpacity
                    key={uf}
                    style={styles.modalItem}
                    onPress={() => {
                      setNewCaseState(uf);
                      setShowStatePicker(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{uf}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal Área de Atuação */}
        <Modal visible={showAreaPicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAreaPicker(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Selecione a Área de Atuação</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {AREAS_OF_LAW.map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={styles.modalItem}
                    onPress={() => {
                      setNewCaseArea(area);
                      setShowAreaPicker(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{area}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    );
  };

  // ABA MENSAGENS / TELA DE CHAT
  const renderMensagensTab = () => {
    // Se estiver em chat ativo
    if (activeChatCaseId) {
      const activeCase = cases.find((c) => c.id === activeChatCaseId);

      let lawyerObj = null;
      if (activeChatInterestId) {
        const interestObj = interesses.find(
          (i) => i.id === activeChatInterestId,
        );
        if (interestObj) {
          lawyerObj = lawyersList.find((l) => l.id === interestObj.lawyer_id);
        }
      }
      if (!lawyerObj && activeCase) {
        lawyerObj =
          lawyers[activeCase.advogado_id] ||
          lawyersList.find((l) => l.id === activeCase.advogado_id);
      }

      return (
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
        >
          {/* Header do Chat */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.chatBackBtn}
              onPress={() => {
                setActiveChatCaseId(null);
                setActiveChatInterestId(null);
              }}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={22} color="#f5c853" />
            </TouchableOpacity>

            {lawyerObj && lawyerObj.avatar ? (
              <Image
                source={{ uri: lawyerObj.avatar }}
                style={styles.chatHeaderAvatar}
              />
            ) : (
              <View
                style={[
                  styles.chatHeaderAvatar,
                  {
                    backgroundColor: "#f5c853",
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
              >
                <Text style={{ color: "#090a0d", fontWeight: "bold" }}>
                  {lawyerObj?.name
                    ? lawyerObj.name.substring(0, 2).toUpperCase()
                    : "AD"}
                </Text>
              </View>
            )}

            <View style={[styles.chatHeaderMeta, { flex: 1 }]}>
              <Text style={styles.chatHeaderName} numberOfLines={1}>
                {lawyerObj?.name || "Advogado"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.chatHeaderStatusDot} />
                <Text style={styles.chatHeaderStatusText}>Online</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.chatHeaderMenuBtn,
                {
                  backgroundColor: "#13151b",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#3a341e",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  marginRight: 10,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => handleAnalyzeContext()}
            >
              <Text
                style={{ color: "#f5c853", fontSize: 11, fontWeight: "bold" }}
              >
                ✨ Anjo Jurídico
              </Text>
            </TouchableOpacity>
          </View>

          {/* Banner de Segurança */}
          <View style={styles.secureBanner}>
            <Feather
              name="lock"
              size={12}
              color="#f5c853"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.secureBannerText}>
              Comunicação criptografada e segura
            </Text>
          </View>

          {/* Mensagens */}
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.chatMessagesScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Divisor de Data */}
            <View style={styles.chatDateDivider}>
              <Text style={styles.chatDateDividerText}>Mensagens Recentes</Text>
            </View>

            {isLoadingMessages && chatMessages.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingVertical: 40,
                }}
              >
                <ActivityIndicator color="#f5c853" />
              </View>
            ) : chatMessages.length > 0 ? (
              chatMessages.map((msg) => {
                const isMe = msg.sender_id === (profile?.id || user.id);

                // Tratar se for um anexo simulado
                if (msg.content && msg.content.startsWith("[ANEXO_SIMULADO]")) {
                  const filename = msg.content.replace("[ANEXO_SIMULADO] ", "");
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgWrapper,
                        isMe ? styles.msgRight : styles.msgLeft,
                      ]}
                    >
                      <View style={styles.fileCard}>
                        <View style={styles.fileCardIconBg}>
                          <Feather name="file-text" size={20} color="#f5c853" />
                        </View>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.fileCardName} numberOfLines={1}>
                            {filename.split(" (")[0]}
                          </Text>
                          <Text style={styles.fileCardSize}>
                            {filename.includes("(")
                              ? filename.split("(")[1].replace(")", "")
                              : "1.2 MB"}{" "}
                            • PDF
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.fileCardDlBtn}
                          activeOpacity={0.7}
                          onPress={() =>
                            Alert.alert(
                              "Download",
                              "Iniciando download do documento com segurança.",
                            )
                          }
                        >
                          <Feather name="download" size={18} color="#f5c853" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                // Tratar se for um anexo real
                if (msg.content && msg.content.startsWith("[ANEXO_REAL]")) {
                  const parts = msg.content
                    .replace("[ANEXO_REAL] ", "")
                    .split("|");
                  const filename = parts[0] || "arquivo";
                  const fileUrl = parts[1] || "";
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgWrapper,
                        isMe ? styles.msgRight : styles.msgLeft,
                      ]}
                    >
                      <View style={styles.fileCard}>
                        <View style={styles.fileCardIconBg}>
                          <Feather name="file-text" size={20} color="#f5c853" />
                        </View>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.fileCardName} numberOfLines={1}>
                            {filename}
                          </Text>
                          <Text style={styles.fileCardSize}>PDF / Imagem</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.fileCardDlBtn}
                          activeOpacity={0.7}
                          onPress={() => openWebLink(fileUrl)}
                        >
                          <Feather
                            name="external-link"
                            size={18}
                            color="#f5c853"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                // Tratar Jitsi/Meet
                if (
                  msg.content &&
                  (msg.content.includes("meet.jit.si") ||
                    msg.content.includes("meet.google.com"))
                ) {
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgWrapper,
                        isMe ? styles.msgRight : styles.msgLeft,
                      ]}
                    >
                      <View style={styles.fileCard}>
                        <View
                          style={[
                            styles.fileCardIconBg,
                            { backgroundColor: "rgba(57, 211, 83, 0.2)" },
                          ]}
                        >
                          <Feather name="video" size={20} color="#39d353" />
                        </View>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.fileCardName} numberOfLines={1}>
                            Videochamada
                          </Text>
                          <Text style={styles.fileCardSize}>
                            Reunião Iniciada
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.fileCardDlBtn}
                          activeOpacity={0.7}
                          onPress={() => openWebLink(msg.content)}
                        >
                          <Feather
                            name="external-link"
                            size={18}
                            color="#f5c853"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                // Tratar se for JSON (Áudio, Mídia)
                let isAudio = false;
                let audioUrl = "";
                try {
                  const parsedContent = JSON.parse(msg.content);
                  if (
                    parsedContent.type === "audio" ||
                    parsedContent.type === "media"
                  ) {
                    isAudio = parsedContent.type === "audio";
                    audioUrl = parsedContent.url;
                  }
                } catch (e) {
                  // Not JSON
                }

                if (isAudio) {
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgWrapper,
                        isMe ? styles.msgRight : styles.msgLeft,
                      ]}
                    >
                      <View
                        style={[
                          styles.bubble,
                          isMe ? styles.bubbleRight : styles.bubbleLeft,
                          { flexDirection: "row", alignItems: "center" },
                        ]}
                      >
                        <Feather
                          name="mic"
                          size={20}
                          color={isMe ? "#090a0d" : "#f5c853"}
                          style={{ marginRight: 10 }}
                        />
                        <Text
                          style={[
                            styles.bubbleText,
                            isMe
                              ? styles.bubbleTextRight
                              : styles.bubbleTextLeft,
                            { flex: 1 },
                          ]}
                        >
                          Mensagem de Voz
                        </Text>
                        <TouchableOpacity
                          style={{ marginLeft: 10 }}
                          onPress={() => openWebLink(audioUrl)}
                        >
                          <Feather
                            name="play-circle"
                            size={24}
                            color={isMe ? "#090a0d" : "#f5c853"}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.msgWrapper,
                      isMe ? styles.msgRight : styles.msgLeft,
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        isMe ? styles.bubbleRight : styles.bubbleLeft,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          isMe ? styles.bubbleTextRight : styles.bubbleTextLeft,
                        ]}
                      >
                        {msg.content}
                      </Text>
                      <View style={styles.msgTimeRow}>
                        <Text
                          style={[
                            styles.msgTime,
                            isMe ? styles.msgTimeRight : styles.msgTimeLeft,
                          ]}
                        >
                          {msg.created_at
                            ? new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </Text>
                        {isMe && (
                          <Feather
                            name="check"
                            size={12}
                            color="#090a0d"
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </View>
                    </View>
                    {!isMe && (
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 4,
                          marginLeft: 4,
                          borderWidth: 1,
                          borderColor: "#3a341e",
                          borderRadius: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          alignSelf: "flex-start",
                          backgroundColor: "#13151b",
                        }}
                        activeOpacity={0.7}
                        onPress={() => handleAnalyzeContext(msg)}
                      >
                        <Text
                          style={{
                            color: "#f5c853",
                            fontSize: 11,
                            fontWeight: "bold",
                          }}
                        >
                          ✨ Chamar Anjo Jurídico
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.noMessagesContainer}>
                <Text style={styles.noMessagesText}>
                  Nenhuma mensagem. Diga "Olá" para o seu advogado!
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Rodapé do Chat (Input) */}
          <View style={styles.chatInputRow}>
            <TouchableOpacity
              style={styles.chatInputIconBtn}
              activeOpacity={0.7}
              onPress={handleSendChatFile}
            >
              <Feather name="paperclip" size={20} color="#f5c853" />
            </TouchableOpacity>

            <View style={styles.chatInputTextContainer}>
              <TextInput
                style={styles.chatTextInput}
                placeholder={
                  isRecording ? "Gravando áudio..." : "Digite sua mensagem..."
                }
                placeholderTextColor={isRecording ? "#e53e3e" : "#6e737f"}
                value={newMessageText}
                onChangeText={setNewMessageText}
                onSubmitEditing={handleSendMessage}
                editable={!isRecording}
              />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                style={[
                  styles.chatSendBtn,
                  {
                    backgroundColor: isRecording ? "#e53e3e" : "#13151b",
                    borderWidth: 1,
                    borderColor: isRecording ? "#e53e3e" : "#f5c853",
                    marginRight: 8,
                  },
                ]}
                activeOpacity={0.8}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Feather
                  name={isRecording ? "square" : "mic"}
                  size={18}
                  color={isRecording ? "#ffffff" : "#f5c853"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chatSendBtn}
                activeOpacity={0.8}
                onPress={handleSendMessage}
              >
                <Feather name="send" size={18} color="#090a0d" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      );
    }

    // Lista de Conversas Unificadas
    const channels = [];

    // 1. Casos Contratados
    cases.forEach((c) => {
      if (c.advogado_id) {
        channels.push({
          id: `hired-${c.id}`,
          type: "HIRED",
          caseId: c.id,
          interestId: null,
          title: c.titulo,
          lawyerId: c.advogado_id,
        });
      }
    });

    // 2. Interesses em Negociação
    interesses.forEach((interest) => {
      if (interest.status === "NEGOTIATING") {
        const alreadyHired = channels.some(
          (ch) => ch.caseId === interest.case_id,
        );
        if (!alreadyHired) {
          channels.push({
            id: `negotiating-${interest.id}`,
            type: "NEGOTIATING",
            caseId: interest.case_id,
            interestId: interest.id,
            title: interest.caso?.titulo || "Caso em Negociação",
            lawyerId: interest.lawyer_id,
          });
        }
      }
    });

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Mensagens</Text>
          <Text style={styles.welcomeSub}>
            Comunique-se de forma direta e segura com seus advogados no
            Supabase.
          </Text>
        </View>

        {channels.length > 0 ? (
          channels.map((ch) => {
            const lawyerObj = lawyersList.find((l) => l.id === ch.lawyerId);
            return (
              <TouchableOpacity
                key={ch.id}
                style={styles.chatRow}
                activeOpacity={0.8}
                onPress={() => {
                  setActiveChatCaseId(ch.caseId);
                  setActiveChatInterestId(ch.interestId);
                }}
              >
                {lawyerObj && lawyerObj.avatar ? (
                  <Image
                    source={{ uri: lawyerObj.avatar }}
                    style={styles.chatAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.chatAvatar,
                      {
                        backgroundColor: "#f5c853",
                        justifyContent: "center",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text style={{ color: "#090a0d", fontWeight: "bold" }}>
                      {lawyerObj?.name
                        ? lawyerObj.name.substring(0, 2).toUpperCase()
                        : "AD"}
                    </Text>
                  </View>
                )}

                <View style={styles.chatInfo}>
                  <View style={styles.chatMeta}>
                    <Text style={styles.chatName}>
                      {lawyerObj?.name || "Advogado"}
                    </Text>
                    <View
                      style={[
                        styles.chatStatusBadge,
                        ch.type === "HIRED"
                          ? styles.chatStatusBadgeHired
                          : styles.chatStatusBadgeNeg,
                      ]}
                    >
                      <Text
                        style={
                          ch.type === "HIRED"
                            ? styles.chatStatusTextHired
                            : styles.chatStatusTextNeg
                        }
                      >
                        {ch.type === "HIRED" ? "Contratado" : "Em Negociação"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.chatLastMsg} numberOfLines={1}>
                    Caso: {ch.title}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyStateCard}>
            <Feather
              name="message-square"
              size={48}
              color="#f5c853"
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.emptyStateTitle}>Sem Conversas Ativas</Text>
            <Text style={styles.emptyStateSub}>
              Suas conversas de chat com os advogados contratados ou em
              negociação aparecerão aqui.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateBtn}
              activeOpacity={0.8}
              onPress={() => setCurrentTab("Meus Casos")}
            >
              <Text style={styles.emptyStateBtnText}>Ver Meus Casos</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  // ABA MEU PERFIL
  const renderPerfilTab = () => {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header do Perfil */}
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatarLarge}>
            <Text style={styles.profileInitials}>
              {profileName ? profileName.substring(0, 2).toUpperCase() : "CL"}
            </Text>
          </View>
          <Text style={styles.profileNameText}>
            {profileName || "Nome do Cliente"}
          </Text>
          <Text style={styles.profileRoleText}>Cliente SocialJurídico</Text>
        </View>

        <View style={styles.formBody}>
          {/* Nome Completo */}
          <Text style={styles.profileLabel}>NOME COMPLETO</Text>
          <View style={styles.profileInputContainer}>
            <Feather
              name="user"
              size={16}
              color="#f5c853"
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={styles.profileInput}
              value={profileName}
              onChangeText={setProfileName}
            />
          </View>

          {/* Telefone */}
          <Text style={styles.profileLabel}>TELEFONE/WHATSAPP</Text>
          <View style={styles.profileInputContainer}>
            <Feather
              name="phone"
              size={16}
              color="#f5c853"
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={styles.profileInput}
              value={profilePhone}
              onChangeText={setProfilePhone}
            />
          </View>

          {/* Email inalteravel */}
          <Text style={styles.profileLabel}>E-MAIL (INALTERÁVEL)</Text>
          <View style={[styles.profileInputContainer, { opacity: 0.5 }]}>
            <Feather
              name="mail"
              size={16}
              color="#8e94a2"
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={[styles.profileInput, { color: "#8e94a2" }]}
              value={profile?.email || user?.email || ""}
              editable={false}
            />
          </View>

          {/* Alterar Senha */}
          <Text style={styles.profileLabel}>ALTERAR SENHA</Text>
          <View style={styles.profileInputContainer}>
            <Feather
              name="lock"
              size={16}
              color="#f5c853"
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={styles.profileInput}
              placeholder="Deixe em branco para manter"
              placeholderTextColor="#6e737f"
              secureTextEntry
              value={profilePassword}
              onChangeText={setProfilePassword}
            />
          </View>

          {/* Membro Desde */}
          <Text style={styles.profileLabel}>MEMBRO DESDE</Text>
          <View style={[styles.profileInputContainer, { opacity: 0.7 }]}>
            <Feather
              name="calendar"
              size={16}
              color="#8e94a2"
              style={{ marginRight: 10 }}
            />
            <Text style={{ color: "#ffffff", fontSize: 14 }}>
              {formatMemberSince(profile?.created_at)}
            </Text>
          </View>

          {/* Tipo de Conta */}
          <Text style={styles.profileLabel}>TIPO DE CONTA</Text>
          <View style={[styles.profileInputContainer, { opacity: 0.7 }]}>
            <Feather
              name="award"
              size={16}
              color="#8e94a2"
              style={{ marginRight: 10 }}
            />
            <Text style={{ color: "#ffffff", fontSize: 14 }}>
              {profile?.role || "CLIENT"}
            </Text>
          </View>

          {/* Permissões */}
          <Text style={styles.profileLabel}>PERMISSÕES DO DISPOSITIVO</Text>
          <View style={styles.permissionsContainer}>
            <TouchableOpacity
              style={styles.permissionRow}
              activeOpacity={0.7}
              onPress={requestCameraPermission}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather
                  name="camera"
                  size={18}
                  color="#8e94a2"
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.permissionText}>Câmera</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#505560" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permissionRow}
              activeOpacity={0.7}
              onPress={requestMediaLibraryPermission}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather
                  name="image"
                  size={18}
                  color="#8e94a2"
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.permissionText}>Galeria</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#505560" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permissionRow}
              activeOpacity={0.7}
              onPress={requestMicPermission}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather
                  name="mic"
                  size={18}
                  color="#8e94a2"
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.permissionText}>Microfone</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#505560" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permissionRow}
              activeOpacity={0.7}
              onPress={manageBiometrics}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name="finger-print"
                  size={18}
                  color="#8e94a2"
                  style={{ marginRight: 12 }}
                />
                <Text style={styles.permissionText}>
                  Acesso Biométrico (Touch/Face ID)
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color="#505560" />
            </TouchableOpacity>
          </View>

          {/* Botões de Ação */}
          <TouchableOpacity
            style={styles.saveProfileBtn}
            activeOpacity={0.9}
            onPress={handleSaveProfile}
            disabled={isSavingProfile}
          >
            {isSavingProfile ? (
              <ActivityIndicator color="#090a0d" />
            ) : (
              <Text style={styles.saveProfileBtnText}>Salvar Alterações</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteProfileBtn}
            activeOpacity={0.9}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
          >
            {isDeletingAccount ? (
              <ActivityIndicator color="#ff4d4d" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather
                  name="trash-2"
                  size={16}
                  color="#ff4d4d"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.deleteProfileBtnText}>
                  Excluir Minha Conta
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // Top Header
  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoScaleContainer}>
            <View style={styles.logoScaleBeam} />
            <View style={styles.logoScalePans}>
              <View style={styles.logoScalePan} />
              <View style={styles.logoScalePan} />
            </View>
            <View style={styles.logoScaleBase} />
          </View>
          <Text style={styles.headerLogoText}>
            Social<Text style={styles.headerLogoGold}>Jurídico</Text>
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notificationBtn}
          activeOpacity={0.7}
          onPress={() => setIsNotificationsModalOpen(true)}
        >
          <Feather name="bell" size={20} color="#f5c853" />
          {notifications.some((n) => !n.lida) && (
            <View style={styles.notificationBadgeDot} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const handleAnalyzeContext = async (specificMessage = null) => {
    setIsAnjoModalOpen(true);
    setIsAnjoLoading(true);
    setAnjoAnalysis(null);

    try {
      const payload = specificMessage
        ? `Analise a seguinte mensagem enviada pelo advogado sob as óticas de Correção Jurídica, Ética e Efetividade: "${specificMessage.content}"`
        : `Analise o contexto geral desta conversa sob as óticas de Correção Jurídica, Ética e Efetividade.`;

      const historyContext = chatMessages.map((m) => ({
        role: m.sender_id === (profile?.id || user?.id) ? "user" : "assistant",
        text: m.content,
      }));

      const res = await fetch(
        `${SUPABASE_URL.replace(".supabase.co", "")}:3000/api/chat/analise-ia`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({ mensagem: payload, history: historyContext }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        setAnjoAnalysis(data.resposta || "Não foi possível gerar a análise.");
      } else {
        setAnjoAnalysis(
          "Desculpe, ocorreu um erro ao me comunicar com o servidor da IA.",
        );
      }
    } catch (err) {
      setAnjoAnalysis(
        "Desculpe, não consegui acessar a rede no momento. Simulando análise:\n\n1. **Correção Jurídica:** A mensagem está correta do ponto de vista técnico.\n\n2. **Ética:** O tom é profissional.\n\n3. **Efetividade:** Clara e objetiva.",
      );
    } finally {
      setIsAnjoLoading(false);
    }
  };

  // Anjo Jurídico Modal
  const renderAnjoModal = () => {
    return (
      <Modal
        visible={isAnjoModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAnjoModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(9, 10, 13, 0.95)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              flex: 0.9,
              backgroundColor: "#0d0f12",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#f5c853",
              borderBottomWidth: 0,
            }}
          >
            {/* Header Anjo */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 20,
                borderBottomWidth: 1,
                borderColor: "#20242e",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: "#f5c853",
                    borderRadius: 8,
                    padding: 8,
                    marginRight: 12,
                  }}
                >
                  <Feather name="cpu" size={20} color="#090a0d" />
                </View>
                <View>
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 18,
                      fontWeight: "bold",
                    }}
                  >
                    Anjo Jurídico
                  </Text>
                  <Text style={{ color: "#8e94a2", fontSize: 12 }}>
                    Traduza termos e tire dúvidas
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsAnjoModalOpen(false)}>
                <Feather name="x" size={24} color="#8e94a2" />
              </TouchableOpacity>
            </View>

            {/* Mensagens Anjo */}
            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  backgroundColor: "#1a1d24",
                  padding: 20,
                  borderRadius: 16,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <Feather
                    name="shield"
                    size={16}
                    color="#f5c853"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      color: "#f5c853",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    Análise da Mensagem
                  </Text>
                </View>

                {isAnjoLoading ? (
                  <View style={{ paddingVertical: 40, alignItems: "center" }}>
                    <ActivityIndicator size="large" color="#f5c853" />
                    <Text style={{ color: "#8e94a2", marginTop: 12 }}>
                      Analisando comunicação...
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={{ color: "#ffffff", fontSize: 14, lineHeight: 22 }}
                  >
                    {anjoAnalysis || "Não há dados para analisar."}
                  </Text>
                )}
              </View>

              {!isAnjoLoading && anjoAnalysis && (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    alignSelf: "flex-start",
                    marginTop: 20,
                    borderWidth: 1,
                    borderColor: "#3a341e",
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: "#090a0d",
                  }}
                  activeOpacity={0.7}
                  onPress={() => Alert.alert("Sucesso", "Análise copiada!")} // Idealmente usar Clipboard
                >
                  <Feather
                    name="copy"
                    size={16}
                    color="#f5c853"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      color: "#f5c853",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    Copiar Análise
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Bottom Tab Bar Customizada
  const renderBottomTabBar = () => {
    const tabs = [
      { id: "Home", label: "Home", icon: "home" },
      { id: "Meus Casos", label: "Casos", icon: "folder" },
      { id: "Mensagens", label: "Chat", icon: "message-square" },
      { id: "Perfil", label: "Perfil", icon: "user" },
    ];

    return (
      <View style={styles.tabBar}>
        {tabs.map((t) => {
          const isActive = currentTab === t.id && !isCreatingCase;
          return (
            <TouchableOpacity
              key={t.id}
              style={styles.tabItem}
              activeOpacity={0.8}
              onPress={() => {
                setIsCreatingCase(false);
                setActiveChatCaseId(null);
                setCurrentTab(t.id);
              }}
            >
              <View
                style={[
                  styles.tabBtnWrapper,
                  isActive && styles.tabBtnWrapperActive,
                ]}
              >
                <Feather
                  name={t.icon}
                  size={18}
                  color={isActive ? "#f5c853" : "#8e94a2"}
                  style={{ marginBottom: 2 }}
                />
                <Text
                  style={[
                    styles.tabText,
                    isActive ? styles.tabTextActive : styles.tabTextInactive,
                  ]}
                >
                  {t.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f5c853" />
        <Text style={styles.loadingText}>Conectando ao Supabase...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />

      {/* Exibe o header do app, exceto quando estiver na tela de Chat Ativo */}
      {!activeChatCaseId && renderHeader()}

      {/* Corpo principal */}
      <View style={{ flex: 1 }}>
        {isCreatingCase ? (
          renderNewCaseForm()
        ) : (
          <>
            {currentTab === "Home" && renderHomeTab()}
            {currentTab === "Meus Casos" && renderCasosTab()}
            {currentTab === "Mensagens" && renderMensagensTab()}
            {currentTab === "Perfil" && renderPerfilTab()}
          </>
        )}
      </View>

      {/* Modal Anjo IA */}
      {renderAnjoModal()}

      {/* Modal Notificações */}
      {isNotificationsModalOpen && (
        <Modal
          visible={isNotificationsModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsNotificationsModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsNotificationsModalOpen(false)}
          >
            <TouchableOpacity
              style={[styles.detailModalContent, { maxHeight: "80%" }]}
              activeOpacity={1}
            >
              <View style={styles.detailModalHeader}>
                <Text style={styles.detailModalTitle}>
                  Central de Notificações
                </Text>
                <TouchableOpacity
                  onPress={() => setIsNotificationsModalOpen(false)}
                  style={styles.detailModalCloseBtn}
                >
                  <Feather name="x" size={20} color="#8e94a2" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ marginTop: 10 }}>
                {notifications.length === 0 ? (
                  <Text style={styles.noDataText}>
                    Nenhuma notificação encontrada.
                  </Text>
                ) : (
                  notifications.map((notif) => (
                    <View
                      key={notif.id}
                      style={[
                        styles.card,
                        {
                          padding: 14,
                          marginBottom: 12,
                          opacity: notif.lida ? 0.6 : 1,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <Text
                          style={{
                            color: "#f5c853",
                            fontWeight: "bold",
                            fontSize: 13,
                            flex: 1,
                            paddingRight: 10,
                          }}
                        >
                          {notif.titulo}
                        </Text>
                        <TouchableOpacity
                          onPress={async () => {
                            const success =
                              await supabaseService.deleteNotification(
                                notif.id,
                                session.accessToken,
                              );
                            if (success)
                              setNotifications((prev) =>
                                prev.filter((n) => n.id !== notif.id),
                              );
                          }}
                        >
                          <Feather name="trash-2" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                      <Text
                        style={{
                          color: "#ffffff",
                          fontSize: 13,
                          marginBottom: 10,
                        }}
                      >
                        {notif.mensagem}
                      </Text>
                      {!notif.lida && (
                        <TouchableOpacity
                          style={{
                            alignSelf: "flex-start",
                            backgroundColor: "rgba(245, 200, 83, 0.1)",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                          onPress={async () => {
                            const success =
                              await supabaseService.markNotificationRead(
                                notif.id,
                                session.accessToken,
                              );
                            if (success) {
                              setNotifications((prev) =>
                                prev.map((n) =>
                                  n.id === notif.id ? { ...n, lida: true } : n,
                                ),
                              );
                            }
                          }}
                        >
                          <Text
                            style={{
                              color: "#f5c853",
                              fontSize: 11,
                              fontWeight: "bold",
                            }}
                          >
                            Marcar como lida
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Modal de Avaliação do Advogado */}
      {isReviewModalOpen && reviewCaseInfo && (
        <Modal
          visible={isReviewModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsReviewModalOpen(false)}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ width: "100%", alignItems: "center" }}
            >
              <View style={[styles.detailModalContent, { width: "90%" }]}>
                <View style={styles.detailModalHeader}>
                  <Text style={styles.detailModalTitle}>Avaliar Advogado</Text>
                  <TouchableOpacity
                    onPress={() => setIsReviewModalOpen(false)}
                    style={styles.detailModalCloseBtn}
                  >
                    <Feather name="x" size={20} color="#8e94a2" />
                  </TouchableOpacity>
                </View>

                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 14,
                      textAlign: "center",
                      marginBottom: 16,
                    }}
                  >
                    Como foi o serviço prestado por{" "}
                    <Text style={{ fontWeight: "bold", color: "#f5c853" }}>
                      {reviewCaseInfo.lawyerObj?.name}
                    </Text>
                    ?
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      marginBottom: 20,
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        style={{ padding: 8 }}
                        onPress={() => setReviewScore(star)}
                      >
                        <Feather
                          name="star"
                          size={32}
                          color={star <= reviewScore ? "#f5c853" : "#20242e"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={[
                      styles.profileInput,
                      {
                        backgroundColor: "#0d0f12",
                        borderColor: "#1a1d24",
                        borderWidth: 1,
                        borderRadius: 8,
                        width: "100%",
                        height: 100,
                        padding: 12,
                        textAlignVertical: "top",
                      },
                    ]}
                    placeholder="Deixe um comentário (Opcional)"
                    placeholderTextColor="#505560"
                    multiline
                    numberOfLines={4}
                    value={reviewComment}
                    onChangeText={setReviewComment}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveProfileBtn, { marginTop: 0 }]}
                  activeOpacity={0.9}
                  onPress={handleSubmitReview}
                  disabled={isSubmittingReview}
                >
                  {isSubmittingReview ? (
                    <ActivityIndicator color="#090a0d" />
                  ) : (
                    <Text style={styles.saveProfileBtnText}>
                      Enviar Avaliação
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Modal Detalhes do Escritório */}
      {selectedOffice && (
        <Modal
          visible={isOfficeModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsOfficeModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsOfficeModalOpen(false)}
          >
            <TouchableOpacity
              style={styles.detailModalContent}
              activeOpacity={1}
            >
              <View style={styles.detailModalHeader}>
                <Text style={styles.detailModalTitle}>Escritório Parceiro</Text>
                <TouchableOpacity
                  onPress={() => setIsOfficeModalOpen(false)}
                  style={styles.detailModalCloseBtn}
                >
                  <Feather name="x" size={20} color="#8e94a2" />
                </TouchableOpacity>
              </View>

              <View style={styles.detailModalBody}>
                {selectedOffice.logo_url ? (
                  <Image
                    source={{ uri: selectedOffice.logo_url }}
                    style={styles.detailModalAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.detailModalAvatar,
                      {
                        backgroundColor: "#16191f",
                        justifyContent: "center",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: "#f5c853",
                        fontWeight: "bold",
                        fontSize: 28,
                      }}
                    >
                      {selectedOffice.nome
                        ? selectedOffice.nome.substring(0, 2).toUpperCase()
                        : "EP"}
                    </Text>
                  </View>
                )}

                <Text style={styles.detailModalName}>
                  {selectedOffice.nome || "Escritório Parceiro"}
                </Text>
                <View
                  style={[
                    styles.lawyerBadge,
                    { alignSelf: "center", marginBottom: 16 },
                  ]}
                >
                  <Text style={styles.lawyerBadgeText}>
                    {selectedOffice.plano === "pro_plus"
                      ? "PRO PLUS"
                      : "PARCEIRO"}
                  </Text>
                </View>

                <View style={styles.detailModalInfoRow}>
                  <Feather
                    name="map-pin"
                    size={16}
                    color="#f5c853"
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.detailModalInfoText}>
                    {selectedOffice.cidade_estado || "Não Informado"}
                  </Text>
                </View>

                {selectedOffice.email && (
                  <View style={styles.detailModalInfoRow}>
                    <Feather
                      name="mail"
                      size={16}
                      color="#f5c853"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.detailModalInfoText}>
                      {selectedOffice.email}
                    </Text>
                  </View>
                )}

                <View style={styles.detailModalSection}>
                  <Text style={styles.detailModalSectionTitle}>
                    Áreas de Atuação
                  </Text>
                  <Text style={styles.detailModalSectionText}>
                    {selectedOffice.areas_atuacao ||
                      "Todas as áreas do direito."}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Modal Detalhes do Advogado */}
      {selectedLawyer && (
        <Modal
          visible={isLawyerModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsLawyerModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsLawyerModalOpen(false)}
          >
            <TouchableOpacity
              style={styles.detailModalContent}
              activeOpacity={1}
            >
              <View style={styles.detailModalHeader}>
                <Text style={styles.detailModalTitle}>Perfil do Advogado</Text>
                <TouchableOpacity
                  onPress={() => setIsLawyerModalOpen(false)}
                  style={styles.detailModalCloseBtn}
                >
                  <Feather name="x" size={20} color="#8e94a2" />
                </TouchableOpacity>
              </View>

              <View style={styles.detailModalBody}>
                {selectedLawyer.avatar ? (
                  <Image
                    source={{ uri: selectedLawyer.avatar }}
                    style={styles.detailModalAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.detailModalAvatar,
                      {
                        backgroundColor: "#16191f",
                        justifyContent: "center",
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: "#f5c853",
                        fontWeight: "bold",
                        fontSize: 28,
                      }}
                    >
                      {selectedLawyer.name
                        ? selectedLawyer.name.substring(0, 2).toUpperCase()
                        : "AD"}
                    </Text>
                  </View>
                )}

                <Text style={styles.detailModalName}>
                  {selectedLawyer.name || "Advogado"}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "center",
                    marginBottom: 12,
                  }}
                >
                  {selectedLawyer.plan_type === "PRO" && (
                    <View
                      style={{
                        backgroundColor: "#f5c853",
                        borderRadius: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        marginRight: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: "#090a0d",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      >
                        PRO
                      </Text>
                    </View>
                  )}
                  {selectedLawyer.oab_verification_status === "VERIFIED" && (
                    <View
                      style={{
                        backgroundColor: "rgba(57, 211, 83, 0.2)",
                        borderRadius: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: "#39d353",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      >
                        OAB Verificada
                      </Text>
                    </View>
                  )}
                </View>

                {/* Avaliação */}
                <View style={styles.detailModalRatingRow}>
                  <Feather
                    name="star"
                    size={16}
                    color="#f5c853"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.detailModalRatingText}>
                    {selectedLawyer.avg_rating
                      ? selectedLawyer.avg_rating.toFixed(1)
                      : "5.0"}{" "}
                    ({selectedLawyer.total_ratings || 0} avaliações)
                  </Text>
                </View>

                <View style={styles.detailModalInfoRow}>
                  <Feather
                    name="map-pin"
                    size={16}
                    color="#f5c853"
                    style={{ marginRight: 10 }}
                  />
                  <Text style={styles.detailModalInfoText}>
                    Estado: {selectedLawyer.estado || "Não Informado"}
                  </Text>
                </View>

                {selectedLawyer.oab && (
                  <View style={styles.detailModalInfoRow}>
                    <Feather
                      name="award"
                      size={16}
                      color="#f5c853"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.detailModalInfoText}>
                      OAB: {selectedLawyer.oab}
                    </Text>
                  </View>
                )}

                {selectedLawyer.phone && (
                  <View style={styles.detailModalInfoRow}>
                    <Feather
                      name="phone"
                      size={16}
                      color="#f5c853"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.detailModalInfoText}>
                      {selectedLawyer.phone}
                    </Text>
                  </View>
                )}

                <View style={styles.detailModalSection}>
                  <Text style={styles.detailModalSectionTitle}>
                    Informações de Consulta
                  </Text>
                  <View
                    style={{
                      backgroundColor: "#13151b",
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#20242e",
                      marginBottom: 16,
                    }}
                  >
                    {selectedLawyer.consulta === "Paga" ? (
                      <View>
                        <Text
                          style={{
                            color: "#f5c853",
                            fontSize: 14,
                            fontWeight: "bold",
                            marginBottom: 4,
                          }}
                        >
                          Consulta Paga
                        </Text>
                        <Text style={{ color: "#8e94a2", fontSize: 13 }}>
                          <Feather name="clock" size={12} />{" "}
                          {selectedLawyer.tempo || "Duração não informada"}{" "}
                          {"\n"}
                          <Feather name="dollar-sign" size={12} />{" "}
                          {selectedLawyer.valor
                            ? `R$ ${Number(selectedLawyer.valor).toFixed(2)}`
                            : "Valor sob consulta"}
                        </Text>
                      </View>
                    ) : (
                      <View>
                        <Text
                          style={{
                            color: "#39d353",
                            fontSize: 14,
                            fontWeight: "bold",
                            marginBottom: 4,
                          }}
                        >
                          Consulta Gratuita
                        </Text>
                        <Text style={{ color: "#8e94a2", fontSize: 13 }}>
                          Primeiro contato sem custo informado.
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.detailModalSectionTitle}>
                    Biografia / Especialidades
                  </Text>
                  <Text style={styles.detailModalSectionText}>
                    {selectedLawyer.bio ||
                      "Advogado atuante com excelência profissional e foco na resolução ágil de demandas jurídicas."}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {renderBottomTabBar()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090a0d",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#090a0d",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#8e94a2",
    marginTop: 14,
    fontSize: 15,
  },
  // Cabeçalho Fixo
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#090a0d",
    borderBottomWidth: 1.2,
    borderBottomColor: "#16191f",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoScaleContainer: {
    width: 20,
    height: 20,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  logoScaleBeam: {
    width: 16,
    height: 2.2,
    backgroundColor: "#f5c853",
    borderRadius: 1,
    transform: [{ rotate: "-20deg" }],
  },
  logoScalePans: {
    width: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  logoScalePan: {
    width: 4,
    height: 4,
    borderWidth: 1.2,
    borderColor: "#f5c853",
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  logoScaleBase: {
    width: 3,
    height: 3,
    backgroundColor: "#f5c853",
    borderRadius: 1.5,
    marginTop: 1,
  },
  headerLogoText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  headerLogoGold: {
    color: "#f5c853",
  },
  notificationBtn: {
    padding: 6,
    position: "relative",
  },
  notificationBadgeDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#ef4444",
  },
  // Scrollable Body
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    marginBottom: 16,
  },
  homeHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 6,
  },
  welcomeSub: {
    fontSize: 14,
    color: "#8e94a2",
    lineHeight: 20,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2d3140",
    backgroundColor: "#12151c",
  },
  logoutBtnText: {
    color: "#f5c853",
    fontSize: 12,
    fontWeight: "700",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16191f",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#20242e",
  },
  onlineGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#39d353",
    marginRight: 8,
  },
  onlineText: {
    color: "#8e94a2",
    fontSize: 12,
    fontWeight: "600",
  },
  // Card Iniciar Novo Caso
  voiceCard: {
    borderWidth: 1.2,
    borderColor: "#f5c853",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#0f1115",
    marginBottom: 20,
  },
  voiceMicCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5c853",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  voiceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f5c853",
    marginBottom: 4,
  },
  voiceSub: {
    fontSize: 12,
    color: "#8e94a2",
    textAlign: "center",
    paddingHorizontal: 10,
  },
  // Cards Gerais
  card: {
    backgroundColor: "#0f1115",
    borderWidth: 1.2,
    borderColor: "#1a1d24",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerTitleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#8e94a2",
    letterSpacing: 0.8,
  },
  statusPill: {
    backgroundColor: "rgba(245, 200, 83, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 83, 0.3)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillText: {
    color: "#f5c853",
    fontSize: 11,
    fontWeight: "bold",
  },
  caseTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  caseNumber: {
    fontSize: 13,
    color: "#8e94a2",
    marginBottom: 16,
  },
  caseDetailsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#090a0d",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#16191f",
    marginBottom: 20,
  },
  caseDetailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  caseDetailText: {
    fontSize: 12,
    color: "#8e94a2",
  },
  // Timeline
  timelineContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginBottom: 20,
  },
  timelineStepChecked: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f5c853",
    justifyContent: "center",
    alignItems: "center",
  },
  timelineLineActive: {
    flex: 1,
    height: 2.2,
    backgroundColor: "#f5c853",
  },
  timelineStepActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#f5c853",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#090a0d",
  },
  timelineStepActiveInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#f5c853",
  },
  timelineLineInactive: {
    flex: 1,
    height: 2.2,
    backgroundColor: "#1a1d24",
  },
  timelineStepInactive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1a1d24",
  },
  timelineNextStep: {
    fontSize: 13,
    color: "#8e94a2",
    lineHeight: 18,
  },
  // Advogado Contato
  lawyerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  lawyerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  lawyerInfo: {
    flex: 1,
  },
  lawyerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lawyerName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
    marginRight: 8,
  },
  lawyerBadge: {
    backgroundColor: "#1a1d24",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  lawyerBadgeText: {
    color: "#f5c853",
    fontSize: 9,
    fontWeight: "bold",
  },
  lawyerMessage: {
    fontSize: 12,
    color: "#8e94a2",
    fontStyle: "italic",
  },
  chatConnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    backgroundColor: "#f5c853",
    borderRadius: 8,
    marginTop: 4,
  },
  chatConnectBtnText: {
    color: "#090a0d",
    fontSize: 14,
    fontWeight: "bold",
  },
  noLawyerCard: {
    alignItems: "center",
    paddingVertical: 16,
  },
  noLawyerTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
  },
  noLawyerText: {
    color: "#8e94a2",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  // Compliance
  complianceItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#090a0d",
    borderWidth: 1.2,
    borderColor: "#1a1d24",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  complianceIconBg: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "rgba(245, 200, 83, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  complianceInfo: {
    flex: 1,
  },
  complianceTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 3,
  },
  complianceDesc: {
    fontSize: 11,
    color: "#8e94a2",
  },
  usefulLinksScroll: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  usefulLinkCard: {
    backgroundColor: "#0d0f12",
    borderColor: "#1a1d24",
    borderWidth: 1.2,
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    width: 175,
    height: 120,
    justifyContent: "space-between",
  },
  usefulLinkHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  usefulLinkTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
    flex: 1,
  },
  usefulLinkDesc: {
    color: "#8e94a2",
    fontSize: 11,
    lineHeight: 14,
    flex: 1,
  },
  usefulLinkAction: {
    color: "#f5c853",
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 4,
  },
  // Empty State Card
  emptyStateCard: {
    backgroundColor: "#0f1115",
    borderWidth: 1.2,
    borderColor: "#1a1d24",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSub: {
    fontSize: 13,
    color: "#8e94a2",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyStateBtn: {
    backgroundColor: "#f5c853",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  emptyStateBtnText: {
    color: "#090a0d",
    fontWeight: "bold",
    fontSize: 14,
  },
  // Casos Tab Extra Styles
  caseItemArea: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#8e94a2",
    textTransform: "uppercase",
  },
  caseItemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  caseItemDesc: {
    fontSize: 13,
    color: "#8e94a2",
    lineHeight: 18,
    marginBottom: 12,
  },
  caseItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1a1d24",
    paddingTop: 10,
    marginTop: 4,
  },
  caseItemLoc: {
    fontSize: 11,
    color: "#f5c853",
    fontWeight: "600",
  },
  caseItemLawyer: {
    fontSize: 11,
    color: "#8e94a2",
  },
  addCaseHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5c853",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addCaseHeaderBtnText: {
    color: "#090a0d",
    fontSize: 12,
    fontWeight: "bold",
  },
  // Mensagens Tab
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1115",
    borderWidth: 1.2,
    borderColor: "#1a1d24",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  chatAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
  },
  chatTime: {
    fontSize: 11,
    color: "#f5c853",
    fontWeight: "600",
  },
  chatLastMsg: {
    fontSize: 12,
    color: "#8e94a2",
  },
  // Novo Caso Formulário
  formHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  formBackBtn: {
    padding: 8,
    marginRight: 10,
    marginLeft: -8,
  },
  formMainTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ffffff",
  },
  formSubTitle: {
    fontSize: 13,
    color: "#8e94a2",
  },
  formBody: {
    backgroundColor: "#0f1115",
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#1a1d24",
    padding: 16,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f5c853",
    marginBottom: 8,
    marginTop: 14,
  },
  formInputContainer: {
    backgroundColor: "#0d0f12",
    borderWidth: 1,
    borderColor: "#1a1d24",
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  formInput: {
    color: "#ffffff",
    fontSize: 14,
  },
  formSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0d0f12",
    borderWidth: 1,
    borderColor: "#1a1d24",
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
  },
  formSelectorText: {
    color: "#ffffff",
    fontSize: 14,
  },
  formPlaceholderText: {
    color: "#505560",
    fontSize: 14,
  },
  attachmentBox: {
    backgroundColor: "#0d0f12",
    borderWidth: 1,
    borderColor: "#1a1d24",
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentBoxText: {
    color: "#8e94a2",
    fontSize: 13,
    textAlign: "center",
  },
  attachmentList: {
    marginTop: 10,
    backgroundColor: "#0d0f12",
    borderRadius: 8,
    padding: 8,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#16191f",
  },
  attachmentItemName: {
    color: "#ffffff",
    fontSize: 13,
    flex: 1,
    marginRight: 6,
  },
  attachmentItemSize: {
    color: "#8e94a2",
    fontSize: 11,
    marginRight: 10,
  },
  attachmentRemoveBtn: {
    padding: 4,
  },
  submitBtn: {
    backgroundColor: "#f5c853",
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 10,
  },
  submitBtnText: {
    color: "#090a0d",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#16191f",
    borderColor: "#20242e",
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 16,
    textAlign: "center",
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1d24",
  },
  modalItemText: {
    color: "#ffffff",
    fontSize: 14,
  },
  // Chat Active Screen
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0f1115",
    borderBottomWidth: 1.2,
    borderBottomColor: "#16191f",
  },
  chatBackBtn: {
    padding: 6,
    marginRight: 10,
  },
  chatHeaderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  chatHeaderMeta: {
    flex: 1,
  },
  chatHeaderName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
  },
  chatHeaderStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#39d353",
    marginRight: 5,
  },
  chatHeaderStatusText: {
    color: "#39d353",
    fontSize: 11,
    fontWeight: "600",
  },
  chatHeaderMenuBtn: {
    padding: 6,
  },
  secureBanner: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#16191f",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1d24",
  },
  secureBannerText: {
    color: "#8e94a2",
    fontSize: 11,
    fontWeight: "500",
  },
  chatMessagesScroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 30,
  },
  chatDateDivider: {
    alignItems: "center",
    marginVertical: 14,
  },
  chatDateDividerText: {
    color: "#6e737f",
    fontSize: 11,
    fontWeight: "500",
    backgroundColor: "#16191f",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  msgWrapper: {
    marginVertical: 6,
    flexDirection: "row",
    width: "100%",
  },
  msgLeft: {
    justifyContent: "flex-start",
  },
  msgRight: {
    justifyContent: "flex-end",
  },
  bubble: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: "80%",
  },
  bubbleLeft: {
    backgroundColor: "#16191f",
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: "#1a1d24",
  },
  bubbleRight: {
    backgroundColor: "#f5c853",
    borderBottomRightRadius: 2,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  bubbleTextLeft: {
    color: "#ffffff",
  },
  bubbleTextRight: {
    color: "#090a0d",
  },
  msgTimeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
  },
  msgTime: {
    fontSize: 9,
  },
  msgTimeLeft: {
    color: "#8e94a2",
  },
  msgTimeRight: {
    color: "#090a0d",
    opacity: 0.7,
  },
  noMessagesContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  noMessagesText: {
    color: "#8e94a2",
    fontSize: 13,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1115",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1.2,
    borderTopColor: "#16191f",
  },
  chatInputIconBtn: {
    padding: 8,
    marginRight: 6,
  },
  chatInputTextContainer: {
    flex: 1,
    backgroundColor: "#0d0f12",
    borderColor: "#1a1d24",
    borderWidth: 1,
    borderRadius: 20,
    height: 40,
    paddingHorizontal: 14,
    justifyContent: "center",
    marginRight: 10,
  },
  chatTextInput: {
    color: "#ffffff",
    fontSize: 14,
    padding: 0,
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5c853",
    justifyContent: "center",
    alignItems: "center",
  },
  // File Card in Chat
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16191f",
    borderColor: "#20242e",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    width: "78%",
  },
  fileCardIconBg: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "rgba(245, 200, 83, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  fileCardName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
  },
  fileCardSize: {
    color: "#8e94a2",
    fontSize: 11,
    marginTop: 2,
  },
  fileCardDlBtn: {
    padding: 6,
  },
  // Perfil Tab Styles
  profileHeader: {
    alignItems: "center",
    marginVertical: 24,
  },
  profileAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f5c853",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  profileInitials: {
    color: "#090a0d",
    fontSize: 26,
    fontWeight: "bold",
  },
  profileNameText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  profileRoleText: {
    fontSize: 13,
    color: "#f5c853",
    fontWeight: "600",
  },
  profileLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#f5c853",
    marginBottom: 6,
    marginTop: 14,
    letterSpacing: 0.5,
  },
  profileInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0f12",
    borderWidth: 1,
    borderColor: "#1a1d24",
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
  },
  profileInput: {
    color: "#ffffff",
    fontSize: 14,
    flex: 1,
  },
  permissionsContainer: {
    backgroundColor: "#0d0f12",
    borderWidth: 1,
    borderColor: "#1a1d24",
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 16,
    overflow: "hidden",
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#16191f",
  },
  permissionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  saveProfileBtn: {
    backgroundColor: "#f5c853",
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  saveProfileBtnText: {
    color: "#090a0d",
    fontSize: 15,
    fontWeight: "bold",
  },
  deleteProfileBtn: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: "#ff4d4d",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: "rgba(255, 77, 77, 0.04)",
  },
  deleteProfileBtnText: {
    color: "#ff4d4d",
    fontSize: 14,
    fontWeight: "bold",
  },
  // Barra de abas inferior Fixo
  tabBar: {
    flexDirection: "row",
    height: 60,
    backgroundColor: "#090a0d",
    borderTopWidth: 1.2,
    borderTopColor: "#16191f",
    paddingBottom: Platform.OS === "ios" ? 12 : 0,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  tabBtnWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    width: "90%",
  },
  tabBtnWrapperActive: {
    backgroundColor: "#16191f",
    borderWidth: 0.5,
    borderColor: "#20242e",
  },
  tabText: {
    fontSize: 9,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#f5c853",
  },
  tabTextInactive: {
    color: "#8e94a2",
  },
  // Custom added styles
  interestSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 6,
  },
  interestSectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#f5c853",
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  interestItemContainer: {
    backgroundColor: "#0d0f12",
    borderColor: "#16191f",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  interestRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  interestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5c853",
    marginRight: 12,
  },
  interestAvatarText: {
    color: "#090a0d",
    fontWeight: "bold",
    fontSize: 14,
  },
  interestInfo: {
    flex: 1,
  },
  interestNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  interestName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  interestSparkIcon: {
    marginRight: 6,
  },
  interestNegotiatingBadge: {
    backgroundColor: "#f5c853",
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  interestNegotiatingBadgeText: {
    color: "#090a0d",
    fontSize: 8,
    fontWeight: "bold",
  },
  interestCaseTitle: {
    color: "#8e94a2",
    fontSize: 12,
    marginBottom: 2,
  },
  interestArea: {
    color: "#505560",
    fontSize: 11,
  },
  interestActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#16191f",
    paddingTop: 10,
  },
  interestBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 6,
  },
  interestBtnAccept: {
    backgroundColor: "rgba(57, 211, 83, 0.08)",
    borderWidth: 1,
    borderColor: "#39d353",
  },
  interestBtnAcceptText: {
    color: "#39d353",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  interestBtnDecline: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  interestBtnDeclineText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  interestBtnHire: {
    backgroundColor: "rgba(245, 200, 83, 0.08)",
    borderWidth: 1,
    borderColor: "#f5c853",
  },
  interestBtnHireText: {
    color: "#f5c853",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  interestBtnChat: {
    backgroundColor: "rgba(168, 85, 247, 0.08)",
    borderWidth: 1,
    borderColor: "#a855f7",
  },
  interestBtnChatText: {
    color: "#a855f7",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  horizontalScrollContainer: {
    paddingVertical: 4,
  },
  noDataText: {
    color: "#8e94a2",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 10,
  },
  // Escritórios Parceiros Cards
  officeCard: {
    backgroundColor: "#0d0f12",
    borderColor: "#1a1d24",
    borderWidth: 1.2,
    borderRadius: 10,
    padding: 12,
    marginRight: 12,
    width: 140,
    alignItems: "center",
  },
  officeLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 8,
  },
  officeLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#16191f",
    borderColor: "#f5c853",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  officeLogoPlaceholderText: {
    color: "#f5c853",
    fontWeight: "bold",
    fontSize: 15,
  },
  officeName: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 2,
    textAlign: "center",
  },
  officeLocation: {
    color: "#8e94a2",
    fontSize: 11,
    marginBottom: 6,
    textAlign: "center",
  },
  officeBadge: {
    backgroundColor: "#1a1d24",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  officeBadgeText: {
    color: "#f5c853",
    fontSize: 8,
    fontWeight: "bold",
  },
  // Advogados Cards
  lawyerCard: {
    backgroundColor: "#0d0f12",
    borderColor: "#1a1d24",
    borderWidth: 1.2,
    borderRadius: 10,
    padding: 12,
    marginRight: 12,
    width: 140,
    alignItems: "center",
  },
  lawyerCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 8,
  },
  lawyerCardAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#16191f",
    borderColor: "#f5c853",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  lawyerCardAvatarText: {
    color: "#f5c853",
    fontWeight: "bold",
    fontSize: 15,
  },
  lawyerCardName: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 2,
    textAlign: "center",
  },
  lawyerCardSpecialty: {
    color: "#8e94a2",
    fontSize: 10,
    marginBottom: 6,
    textAlign: "center",
  },
  lawyerRatingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lawyerRatingText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  // Pills
  pillsScroll: {
    paddingBottom: 10,
  },
  pillBtn: {
    backgroundColor: "#16191f",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#20242e",
  },
  pillBtnActive: {
    backgroundColor: "#f5c853",
    borderColor: "#f5c853",
  },
  pillText: {
    color: "#8e94a2",
    fontSize: 11,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#090a0d",
  },
  // Detail Modals
  detailModalContent: {
    width: "90%",
    backgroundColor: "#0f1115",
    borderColor: "#1a1d24",
    borderWidth: 1.2,
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  detailModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#16191f",
    paddingBottom: 10,
    marginBottom: 16,
  },
  detailModalTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#ffffff",
  },
  detailModalCloseBtn: {
    padding: 4,
  },
  detailModalBody: {
    alignItems: "stretch",
  },
  detailModalAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignSelf: "center",
    marginBottom: 12,
    borderColor: "#f5c853",
    borderWidth: 1.2,
  },
  detailModalName: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 4,
  },
  detailModalRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  detailModalRatingText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  detailModalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#16191f",
  },
  detailModalInfoText: {
    color: "#ffffff",
    fontSize: 13,
  },
  detailModalSection: {
    marginTop: 16,
    backgroundColor: "#090a0d",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1a1d24",
  },
  detailModalSectionTitle: {
    color: "#f5c853",
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
  },
  detailModalSectionText: {
    color: "#8e94a2",
    fontSize: 11,
    lineHeight: 16,
  },
  // Chat unificado styles
  chatStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  chatStatusBadgeHired: {
    backgroundColor: "rgba(245, 200, 83, 0.08)",
    borderWidth: 0.5,
    borderColor: "#f5c853",
  },
  chatStatusBadgeNeg: {
    backgroundColor: "rgba(57, 211, 83, 0.08)",
    borderWidth: 0.5,
    borderColor: "#39d353",
  },
  chatStatusTextHired: {
    color: "#f5c853",
    fontSize: 8,
    fontWeight: "bold",
  },
  chatStatusTextNeg: {
    color: "#39d353",
    fontSize: 8,
    fontWeight: "bold",
  },
});
