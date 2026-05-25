/**
 * MensagensTab.js — Painel de Notificações e Chat do Advogado
 * Paridade com o mockup, com a versão Web, e com o chat do cliente.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Linking,
  Clipboard,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { COLORS } from "../../styles/theme";
import {
  supabaseService,
  supabaseRealtime,
} from "../../services/supabaseService";
import { getApiBaseUrl } from "../../config/api";

const WEB_API = getApiBaseUrl();

const SUPABASE_URL = "https://uwkcdwlgobnhowumcdnp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3a2Nkd2xnb2JuaG93dW1jZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTEyNDIsImV4cCI6MjA4OTE4NzI0Mn0.Nz-2pITIzlzZW-sePHXAyW6Kz19p45vlMN22Z8VEYEk";

export default function MensagensTab({
  userId,
  accessToken,
  searchQuery,
  setCurrentTab,
  deepLinkChat,
  onChatOpened,
}) {
  // Controle de Abas Superiores
  const [activeSubTab, setActiveSubTab] = useState("NOTIFICACOES"); // 'NOTIFICACOES' | 'CONVERSAS'

  // --- ABA NOTIFICAÇÕES (Sistema) ---
  const [notifications, setNotifications] = useState([]);
  const [loadingNotif, setLoadingNotif] = useState(true);
  const [refreshingNotif, setRefreshingNotif] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // --- ABA CONVERSAS (Chat) ---
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [refreshingChannels, setRefreshingChannels] = useState(false);
  const [clientProfiles, setClientProfiles] = useState({});

  // Chat Ativo
  const [activeChatCaseId, setActiveChatCaseId] = useState(null);
  const [activeChatInterestId, setActiveChatInterestId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Mensagens de Voz
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef(null);

  // Assessor IA
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const scrollViewRef = useRef(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  // --- BUSCAR NOTIFICAÇÕES ---
  const fetchNotifications = useCallback(
    async (isRefresh = false) => {
      if (!userId || !accessToken) return;
      if (!isRefresh) setLoadingNotif(true);

      try {
        const res = await fetch(`${WEB_API}/notificacoes`, {
          method: "GET",
          headers: authHeaders,
        });
        const resData = await res.json();

        if (resData.success) {
          setNotifications(resData.data || []);
        }
      } catch (e) {
        console.error("[MensagensTab] fetchNotifications:", e);
        try {
          const fallbackData = await supabaseService.getNotifications(
            userId,
            accessToken,
          );
          setNotifications(fallbackData || []);
        } catch (fallbackError) {
          console.warn("[MensagensTab] fallback notifications:", fallbackError);
        }
      } finally {
        setLoadingNotif(false);
        setRefreshingNotif(false);
      }
    },
    [userId, accessToken],
  );

  const onRefresh = () => {
    setRefreshingNotif(true);
    fetchNotifications(true);
  };

  // --- BUSCAR PERFIL DO CLIENTE ---
  const fetchClientProfile = async (clientId) => {
    if (!clientId || clientProfiles[clientId]) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/clientes?id=eq.${clientId}&select=id,name,avatar`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setClientProfiles((prev) => ({
          ...prev,
          [clientId]: data[0],
        }));
      }
    } catch (err) {
      console.warn(
        "[MensagensTab] Erro ao carregar perfil do cliente:",
        clientId,
        err,
      );
    }
  };

  // --- BUSCAR CANAIS (CASOS E INTERESSES) ---
  const loadChannels = useCallback(
    async (isRefresh = false) => {
      if (!userId || !accessToken) return;
      if (!isRefresh) setLoadingChannels(true);

      try {
        const [hiredCases, myInterests] = await Promise.all([
          supabaseService.getLawyerCases(userId, accessToken),
          supabaseService.getLawyerInterests(userId, accessToken),
        ]);

        const activeChannels = [];

        hiredCases.forEach((c) => {
          if (c.chat_started) {
            activeChannels.push({
              id: `hired-${c.id}`,
              type: "HIRED",
              caseId: c.id,
              interestId: null,
              title: c.titulo,
              clientId: c.cliente_id,
            });
          }
        });

        myInterests.forEach((interest) => {
          if (interest.status === "NEGOTIATING") {
            const alreadyHired = activeChannels.some(
              (ch) => ch.caseId === interest.case_id,
            );
            if (!alreadyHired) {
              activeChannels.push({
                id: `negotiating-${interest.id}`,
                type: "NEGOTIATING",
                caseId: interest.case_id,
                interestId: interest.id,
                title:
                  interest.title ||
                  interest.casos?.titulo ||
                  "Caso em Negociação",
                clientId: interest.casos?.cliente_id,
              });
            }
          }
        });

        setChannels(activeChannels);

        // Carrega perfis dos clientes em paralelo
        const clientIds = [
          ...new Set(activeChannels.map((ch) => ch.clientId).filter(Boolean)),
        ];
        await Promise.all(clientIds.map((id) => fetchClientProfile(id)));
      } catch (err) {
        console.warn("[MensagensTab] loadChannels:", err);
      } finally {
        setLoadingChannels(false);
        setRefreshingChannels(false);
      }
    },
    [userId, accessToken],
  );

  // Carregamento Inicial
  useEffect(() => {
    fetchNotifications();
    loadChannels();
  }, [fetchNotifications, loadChannels]);

  // Redirecionamento e abertura automática do chat por Deep Link (vinda de LawyerInterestsScreen)
  useEffect(() => {
    if (deepLinkChat && deepLinkChat.caseId) {
      setActiveChatCaseId(deepLinkChat.caseId);
      setActiveChatInterestId(deepLinkChat.interestId);
      setActiveSubTab("CONVERSAS");
      if (onChatOpened) {
        onChatOpened();
      }
    }
  }, [deepLinkChat, onChatOpened]);

  // --- SELETOR DE ATENDIMENTO DE NOTIFICAÇÕES ---
  const handleMarkAsRead = async (msg) => {
    if (msg.lida) return;
    try {
      const res = await fetch(`${WEB_API}/notificacoes`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ id: msg.id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === msg.id ? { ...n, lida: true } : n)),
        );
      }
    } catch (e) {
      console.error("[MensagensTab] handleMarkAsRead:", e);
    }
  };

  const handleDeleteConfirm = (msgId) => {
    Alert.alert(
      "Excluir Mensagem",
      "Tem certeza que deseja excluir esta mensagem?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => executeDelete(msgId),
        },
      ],
    );
  };

  const executeDelete = async (msgId) => {
    try {
      const res = await fetch(`${WEB_API}/notificacoes?id=${msgId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== msgId));
      } else {
        Alert.alert("Erro", data.message || "Erro ao excluir mensagem");
      }
    } catch (e) {
      console.error("[MensagensTab] executeDelete:", e);
      Alert.alert("Erro", "Erro ao conectar com o servidor.");
    }
  };

  const handleCardPress = (msg) => {
    setSelectedMsg(msg);
    setShowModal(true);
    handleMarkAsRead(msg);
  };

  // --- CARREGAR MENSAGENS DO CHAT ATIVO ---
  const loadMensagens = useCallback(async () => {
    if (!activeChatCaseId) return;
    try {
      let url = `${WEB_API}/mensagens?caso_id=${activeChatCaseId}&_t=${Date.now()}`;
      if (activeChatInterestId) url += `&interest_id=${activeChatInterestId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages(data.data || []);
      }
    } catch (err) {
      console.error("[MensagensTab] loadMensagens:", err);
    }
  }, [activeChatCaseId, activeChatInterestId, accessToken]);

  // Efeito ao abrir o Chat
  useEffect(() => {
    if (!activeChatCaseId) {
      setChatMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    loadMensagens().then(() => {
      setIsLoadingMessages(false);
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    });

    // Inscrição Realtime
    const channelName = `chat-caso-${activeChatCaseId}`;
    const sub = supabaseRealtime
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mensagens",
          filter: `caso_id=eq.${activeChatCaseId}`,
        },
        (payload) => {
          console.log("[MensagensTab] Realtime payload:", payload);
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new;
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              const tempIndex = prev.findIndex(
                (m) => m.isTemp && m.content === newMsg.content,
              );
              if (tempIndex !== -1) {
                const nextList = [...prev];
                nextList[tempIndex] = newMsg;
                return nextList;
              }
              return [...prev, newMsg];
            });
            setTimeout(
              () => scrollViewRef.current?.scrollToEnd({ animated: true }),
              200,
            );
          } else if (payload.eventType === "UPDATE") {
            setChatMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m)),
            );
          } else if (payload.eventType === "DELETE") {
            setChatMessages((prev) =>
              prev.filter((m) => m.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    // Polling Fallback
    const interval = setInterval(() => {
      loadMensagens();
    }, 3000);

    return () => {
      clearInterval(interval);
      supabaseRealtime.removeChannel(sub);
    };
  }, [activeChatCaseId, loadMensagens]);

  // --- ENVIAR MENSAGEM ---
  const handleSendMessage = async () => {
    if (!newMessageText.trim() || isSending) return;
    const msgText = newMessageText.trim();
    setNewMessageText("");
    setIsSending(true);

    // Optimistic UI
    const tempMsg = {
      id: "temp-" + Date.now(),
      sender_id: userId,
      content: msgText,
      created_at: new Date().toISOString(),
      caso_id: activeChatCaseId,
      interest_id: activeChatInterestId || null,
      isTemp: true,
    };
    setChatMessages((prev) => [...prev, tempMsg]);
    setTimeout(
      () => scrollViewRef.current?.scrollToEnd({ animated: true }),
      50,
    );

    try {
      const bodyData = { caso_id: activeChatCaseId, content: msgText };
      if (activeChatInterestId) bodyData.interest_id = activeChatInterestId;

      const res = await fetch(`${WEB_API}/mensagens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (data.success) {
        loadMensagens();
      } else {
        setChatMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        setNewMessageText(msgText);
        Alert.alert("Erro", data.message || "Erro ao enviar mensagem.");
      }
    } catch (err) {
      setChatMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setNewMessageText(msgText);
      Alert.alert("Erro", "Conexão falhou.");
    } finally {
      setIsSending(false);
    }
  };

  // --- ENVIAR ARQUIVO ---
  const handleSendChatFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setUploadingFile(true);

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.name || "document.pdf",
        type: asset.mimeType || "application/pdf",
      });
      formData.append("casoId", activeChatCaseId);

      const res = await fetch(`${WEB_API}/mensagens/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        const mediaContent = JSON.stringify({
          isMedia: true,
          fileUrl: data.url,
          fileName: data.fileName,
          fileType: data.fileType,
        });

        const bodyData = { caso_id: activeChatCaseId, content: mediaContent };
        if (activeChatInterestId) bodyData.interest_id = activeChatInterestId;

        await fetch(`${WEB_API}/mensagens`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(bodyData),
        });
        loadMensagens();
      } else {
        Alert.alert("Erro", data.message || "Erro ao enviar arquivo.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível enviar o arquivo.");
    } finally {
      setUploadingFile(false);
    }
  };

  // --- GRAVAÇÃO DE VOZ ---
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permissão Necessária", "Permita o acesso ao microfone.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      Alert.alert("Erro", "Falha ao gravar áudio.");
    }
  };

  const stopRecording = async (shouldSend = true) => {
    if (!recording) return;
    try {
      setIsRecording(false);
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (shouldSend && uri) {
        setUploadingFile(true);
        const formData = new FormData();
        formData.append("file", {
          uri,
          name: `audio-${Date.now()}.m4a`,
          type: "audio/m4a",
        });
        formData.append("casoId", activeChatCaseId);

        const res = await fetch(`${WEB_API}/mensagens/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          const mediaContent = JSON.stringify({
            isMedia: true,
            fileUrl: data.url,
            fileName: "Mensagem de Voz",
            fileType: "audio/m4a",
          });
          const bodyData = { caso_id: activeChatCaseId, content: mediaContent };
          if (activeChatInterestId) bodyData.interest_id = activeChatInterestId;

          await fetch(`${WEB_API}/mensagens`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(bodyData),
          });
          loadMensagens();
        }
      }
    } catch (err) {
      Alert.alert("Erro", "Não foi possível processar a gravação.");
    } finally {
      setUploadingFile(false);
    }
  };

  // --- ANÁLISE IA (ASSESSOR DE NEGÓCIOS) ---
  const handleAnalyzeContext = async (specificMessage = null) => {
    setIsAiModalOpen(true);
    setIsAiLoading(true);
    setAiAnalysis(null);

    try {
      const payload = specificMessage
        ? `Analise a seguinte mensagem enviada pelo cliente sob as óticas de Oportunidade, Ética e Resposta Estratégica: "${specificMessage.content}"`
        : `Analise o contexto geral desta conversa sob as óticas de Oportunidade, Ética e Resposta Estratégica.`;

      const historyContext = chatMessages.map((m) => ({
        role: m.sender_id === userId ? "assistant" : "user",
        text: m.content,
      }));

      const res = await fetch(`${WEB_API}/chat/analise-ia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          caso_id: activeChatCaseId,
          interest_id: activeChatInterestId || null,
          mensagem_id: specificMessage ? specificMessage.id : "global",
          mensagem: payload,
          history: historyContext,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const analysisText =
          data.data?.analise_texto ||
          data.resposta ||
          "Não foi possível gerar a análise.";
        setAiAnalysis(analysisText);
      } else {
        setAiAnalysis("Desculpe, ocorreu um erro no servidor da IA.");
      }
    } catch (err) {
      setAiAnalysis("Desculpe, não consegui carregar a análise.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- NOTIFICAÇÕES CATEGORIES MAP ---
  const getNotificationCategory = (msg) => {
    const tipo = msg.tipo || "GERAL";
    const titleUpper = (msg.titulo || "").toUpperCase();
    const msgUpper = (msg.mensagem || "").toUpperCase();

    const clientTypes = [
      "MENSAGEM",
      "NEGOCIACAO",
      "CONTRATACAO",
      "CHAT_INICIADO",
      "INTERESSE",
    ];

    if (clientTypes.includes(tipo)) {
      const isPartner =
        titleUpper.includes("PARCEIRO") || msgUpper.includes("PARCEIRO");
      return {
        label: isPartner ? "ADVOGADO PARCEIRO" : "CLIENTE",
        color: "#f5c853",
        icon: "message-square",
        iconColor: "#3b82f6",
        iconBg: "rgba(59, 130, 246, 0.15)",
        isFeather: true,
      };
    } else if (
      tipo === "FINANCEIRO" ||
      tipo === "PAGAMENTO" ||
      tipo === "HONORARIOS"
    ) {
      return {
        label: "FINANCEIRO",
        color: "#2ecc71",
        icon: "check-circle",
        iconColor: "#2ecc71",
        iconBg: "rgba(46, 204, 113, 0.15)",
        isFeather: true,
      };
    } else {
      return {
        label: "SISTEMA",
        color: "#a0a5b0",
        icon: "alert-circle",
        iconColor: "#f5c853",
        iconBg: "rgba(245, 200, 83, 0.15)",
        isFeather: true,
      };
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "Agora";
    try {
      const d = new Date(dateStr);
      const pad = (n) => String(n).padStart(2, "0");
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const year = d.getFullYear();
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${day}/${month}/${year}, ${hours}:${pad(d.getMinutes())}`;
    } catch {
      return "Agora";
    }
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // --- RENDER NOTIFICAÇÃO CARD ---
  const renderNotificationCard = ({ item }) => {
    const cat = getNotificationCategory(item);
    return (
      <TouchableOpacity
        style={[styles.card, !item.lida && styles.unreadCard]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.8}
      >
        {!item.lida && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NOVA</Text>
          </View>
        )}
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: cat.iconBg }]}>
            <Feather name={cat.icon} size={18} color={cat.iconColor} />
          </View>
          <View style={styles.titleGroup}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.titulo || "Notificação"}
            </Text>
            <Text style={[styles.badgeText, { color: cat.color }]}>
              {cat.label}
            </Text>
          </View>
          <View style={styles.metaGroup}>
            <Text style={styles.dateText}>
              {formatDateTime(item.created_at)}
            </Text>
            <TouchableOpacity
              onPress={() => handleDeleteConfirm(item.id)}
              style={styles.deleteBtn}
            >
              <Feather name="trash-2" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.mensagem || "Sem conteúdo."}
        </Text>
      </TouchableOpacity>
    );
  };

  // --- RENDER MESSAGE BUBBLE IN CHAT ---
  const renderMessageContent = (msg, isMe) => {
    const content = msg.content;
    const textColor = isMe ? "#090a0d" : "#ffffff";

    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.isMedia) {
        const isImg =
          parsed.fileType?.startsWith("image/") || parsed.fileType === "image";
        const isPdf =
          parsed.fileType === "application/pdf" || parsed.fileType === "pdf";
        const isAudio =
          parsed.fileType?.startsWith("audio/") ||
          parsed.fileType === "audio" ||
          parsed.fileName === "Mensagem de Voz";

        if (isImg) {
          return (
            <TouchableOpacity
              onPress={() => Linking.openURL(parsed.fileUrl)}
              style={s.mediaMessage}
            >
              <Image
                source={{ uri: parsed.fileUrl }}
                style={s.mediaImage}
                resizeMode="cover"
              />
              <Text style={s.mediaNameText} numberOfLines={1}>
                {parsed.fileName}
              </Text>
            </TouchableOpacity>
          );
        } else if (isPdf) {
          return (
            <TouchableOpacity
              onPress={() => Linking.openURL(parsed.fileUrl)}
              style={s.pdfCard}
            >
              <Feather
                name="file-text"
                size={24}
                color="#f5c853"
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.fileNameText} numberOfLines={1}>
                  {parsed.fileName}
                </Text>
                <Text style={s.fileActionText}>Visualizar PDF</Text>
              </View>
            </TouchableOpacity>
          );
        } else if (isAudio) {
          return (
            <TouchableOpacity
              onPress={() => Linking.openURL(parsed.fileUrl)}
              style={s.audioCard}
            >
              <Feather
                name="mic"
                size={20}
                color="#f5c853"
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.fileNameText}>Mensagem de Voz</Text>
                <Text style={s.fileActionText}>Toque para reproduzir</Text>
              </View>
              <Feather name="play" size={18} color="#f5c853" />
            </TouchableOpacity>
          );
        } else {
          return (
            <TouchableOpacity
              onPress={() => Linking.openURL(parsed.fileUrl)}
              style={s.pdfCard}
            >
              <Feather
                name="file"
                size={24}
                color="#a0a5b0"
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.fileNameText} numberOfLines={1}>
                  {parsed.fileName}
                </Text>
                <Text style={s.fileActionText}>Baixar arquivo</Text>
              </View>
            </TouchableOpacity>
          );
        }
      }
    } catch (e) {
      // RegEx para link de videochamada
    }

    const meetRegex = /(https:\/\/(meet\.google\.com|meet\.jit\.si)\/[^\s]+)/i;
    const match = String(content || "").match(meetRegex);

    if (match) {
      const meetLink = match[1];
      const prefix = String(content || "")
        .replace(meetLink, "")
        .trim();
      return (
        <View>
          {prefix ? (
            <Text style={[s.msgText, { color: textColor }]}>{prefix}</Text>
          ) : null}
          <TouchableOpacity
            onPress={() => Linking.openURL(meetLink)}
            style={s.meetCard}
          >
            <Feather
              name="video"
              size={20}
              color="#39d353"
              style={{ marginRight: 8 }}
            />
            <Text style={s.meetText}>Entrar na Videochamada</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return <Text style={[s.msgText, { color: textColor }]}>{content}</Text>;
  };

  // --- FILTRAR CANAIS ---
  const filteredChannels = channels.filter((ch) => {
    if (!searchQuery) return true;
    const profile = clientProfiles[ch.clientId];
    return (
      (profile?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ch.title || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // --- RENDERIZAR TELA DE CHAT ATIVO ---
  if (activeChatCaseId) {
    const client =
      clientProfiles[
        channels.find((ch) => ch.caseId === activeChatCaseId)?.clientId
      ];
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.chatRoot}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
      >
        {/* Chat Header */}
        <View style={s.chatHeader}>
          <TouchableOpacity
            onPress={() => setActiveChatCaseId(null)}
            style={s.chatBackBtn}
          >
            <Feather name="arrow-left" size={22} color="#f5c853" />
          </TouchableOpacity>

          {client?.avatar ? (
            <Image source={{ uri: client.avatar }} style={s.chatAvatar} />
          ) : (
            <View style={s.chatAvatarPlaceholder}>
              <Text style={s.chatAvatarText}>
                {client?.name
                  ? client.name.substring(0, 2).toUpperCase()
                  : "CL"}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.chatHeaderName} numberOfLines={1}>
              {client?.name || "Cliente"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={s.onlineDot} />
              <Text style={s.onlineText}>Online</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => handleAnalyzeContext()}
            style={s.aiHeaderBtn}
          >
            <Feather
              name="sparkles"
              size={14}
              color="#f5c853"
              style={{ marginRight: 4 }}
            />
            <Text style={s.aiHeaderBtnText}>Assessor IA</Text>
          </TouchableOpacity>
        </View>

        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={s.chatScroll}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingMessages && chatMessages.length === 0 ? (
            <View style={s.chatLoader}>
              <ActivityIndicator color="#f5c853" />
            </View>
          ) : chatMessages.length > 0 ? (
            chatMessages.map((msg) => {
              const isMe = msg.sender_id === userId;
              return (
                <View
                  key={msg.id}
                  style={[s.msgWrapper, isMe ? s.msgRight : s.msgLeft]}
                >
                  <View style={[s.bubble, isMe ? s.bubbleRight : s.bubbleLeft]}>
                    {renderMessageContent(msg, isMe)}
                    <View style={s.msgMeta}>
                      <Text
                        style={[
                          s.msgTimeText,
                          { color: isMe ? "#444" : "#888" },
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
                          color="#000"
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                  </View>
                  {!isMe && !msg.isTemp && (
                    <TouchableOpacity
                      style={s.aiMsgBadge}
                      onPress={() => handleAnalyzeContext(msg)}
                    >
                      <Feather
                        name="sparkles"
                        size={10}
                        color="#f5c853"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={s.aiMsgBadgeText}>Análise da IA</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          ) : (
            <View style={s.noMessages}>
              <Text style={s.noMessagesText}>
                Nenhuma mensagem. Envie uma mensagem para iniciar a conversa.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Upload indicator */}
        {uploadingFile && (
          <View style={s.uploadIndicator}>
            <ActivityIndicator
              size="small"
              color="#f5c853"
              style={{ marginRight: 8 }}
            />
            <Text style={s.uploadText}>Enviando mídia...</Text>
          </View>
        )}

        {/* Chat Input Bar */}
        <View style={s.chatInputRow}>
          <TouchableOpacity onPress={handleSendChatFile} style={s.iconBtn}>
            <Feather name="paperclip" size={20} color="#f5c853" />
          </TouchableOpacity>

          <View style={s.inputContainer}>
            <TextInput
              style={s.textInput}
              placeholder={
                isRecording ? "Gravando áudio..." : "Digite sua mensagem..."
              }
              placeholderTextColor={isRecording ? "#ff453a" : "#606672"}
              value={newMessageText}
              onChangeText={setNewMessageText}
              editable={!isRecording}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={isRecording ? () => stopRecording(true) : startRecording}
              style={[
                s.sendBtn,
                {
                  backgroundColor: isRecording ? "#ff453a" : "transparent",
                  borderWidth: 1,
                  borderColor: isRecording
                    ? "#ff453a"
                    : "rgba(255,255,255,0.08)",
                  marginRight: 6,
                },
              ]}
            >
              <Feather
                name={isRecording ? "square" : "mic"}
                size={16}
                color={isRecording ? "#fff" : "#f5c853"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSendMessage}
              style={[s.sendBtn, { backgroundColor: "#f5c853" }]}
              disabled={!newMessageText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Feather name="send" size={16} color="#000" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal Assessor IA */}
        <Modal visible={isAiModalOpen} animationType="slide" transparent>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={s.aiLogoBg}>
                    <Feather name="cpu" size={16} color="#090a0d" />
                  </View>
                  <Text style={s.sheetTitle}>Assessor de Negócios IA</Text>
                </View>
                <TouchableOpacity onPress={() => setIsAiModalOpen(false)}>
                  <Feather name="x" size={22} color="#a3a9c2" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                <View style={s.aiCard}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Feather
                      name="sparkles"
                      size={14}
                      color="#f5c853"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={s.aiCardHeader}>Diretriz Estratégica</Text>
                  </View>

                  {isAiLoading ? (
                    <View style={{ paddingVertical: 32, alignItems: "center" }}>
                      <ActivityIndicator size="large" color="#f5c853" />
                      <Text style={{ color: "#8e94a2", marginTop: 12 }}>
                        Analisando caso e conversa...
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.aiAnalysisText}>
                      {aiAnalysis || "Nenhuma análise gerada."}
                    </Text>
                  )}
                </View>

                {!isAiLoading && aiAnalysis && (
                  <TouchableOpacity
                    style={s.copyBtn}
                    onPress={() => {
                      Clipboard.setString(aiAnalysis);
                      Alert.alert(
                        "Copiado",
                        "Parecer da IA copiado para área de transferência.",
                      );
                    }}
                  >
                    <Feather
                      name="copy"
                      size={16}
                      color="#000"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={s.copyBtnText}>Copiar Parecer</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // --- RENDERIZAR ABAS PRINCIPAIS ---
  // filteredNotifications: derivada de notifications + searchQuery
  // (filteredChannels já definida acima com suporte a searchQuery)
  const filteredNotifications = searchQuery
    ? notifications.filter(
        (n) =>
          (n.titulo || n.title || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (n.mensagem || n.message || n.body || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : notifications;

  return (
    <View style={styles.container}>
      {/* Sub Tab Switcher */}
      <View style={s.tabHeader}>
        <TouchableOpacity
          style={[
            s.tabButton,
            activeSubTab === "NOTIFICACOES" && s.tabButtonActive,
          ]}
          onPress={() => setActiveSubTab("NOTIFICACOES")}
        >
          <Feather
            name="bell"
            size={16}
            color={activeSubTab === "NOTIFICACOES" ? "#f5c853" : "#a0a5b0"}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              s.tabButtonText,
              activeSubTab === "NOTIFICACOES" && s.tabButtonTextActive,
            ]}
          >
            Notificações
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.tabButton,
            activeSubTab === "CONVERSAS" && s.tabButtonActive,
          ]}
          onPress={() => setActiveSubTab("CONVERSAS")}
        >
          <Feather
            name="message-square"
            size={16}
            color={activeSubTab === "CONVERSAS" ? "#f5c853" : "#a0a5b0"}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              s.tabButtonText,
              activeSubTab === "CONVERSAS" && s.tabButtonTextActive,
            ]}
          >
            Conversas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Render Lists */}
      {activeSubTab === "NOTIFICACOES" ? (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshingNotif}
              onRefresh={onRefresh}
              tintColor="#f5c853"
              colors={["#f5c853"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="mail" size={48} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>
                Você ainda não recebeu notificações de sistema.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredChannels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshingChannels}
              onRefresh={() => loadChannels(true)}
              tintColor="#f5c853"
              colors={["#f5c853"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather
                name="message-circle"
                size={48}
                color="rgba(255,255,255,0.15)"
              />
              <Text style={styles.emptyText}>
                Nenhuma conversa ativa com clientes encontrada.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const client = clientProfiles[item.clientId];
            return (
              <TouchableOpacity
                style={s.channelCard}
                onPress={() => {
                  setActiveChatCaseId(item.caseId);
                  setActiveChatInterestId(item.interestId);
                }}
              >
                {client?.avatar ? (
                  <Image
                    source={{ uri: client.avatar }}
                    style={s.channelAvatar}
                  />
                ) : (
                  <View style={s.channelAvatarPlaceholder}>
                    <Text style={s.channelAvatarText}>
                      {client?.name
                        ? client.name.substring(0, 2).toUpperCase()
                        : "CL"}
                    </Text>
                  </View>
                )}

                <View style={s.channelMeta}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={s.channelName} numberOfLines={1}>
                      {client?.name || "Cliente"}
                    </Text>
                    <View
                      style={[
                        s.badge,
                        item.type === "HIRED" ? s.badgeHired : s.badgeNeg,
                      ]}
                    >
                      <Text
                        style={
                          item.type === "HIRED"
                            ? s.badgeTextHired
                            : s.badgeTextNeg
                        }
                      >
                        {item.type === "HIRED" ? "Contratado" : "Em Negociação"}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.channelTitle} numberOfLines={1}>
                    Caso: {item.title}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal Notificação Detalhada */}
      {selectedMsg && (
        <Modal
          visible={showModal}
          transparent
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
                  <Text
                    style={[
                      styles.modalBadge,
                      { color: getNotificationCategory(selectedMsg).color },
                    ]}
                  >
                    {getNotificationCategory(selectedMsg).label}
                  </Text>
                  <Text style={styles.modalDate}>
                    {formatDateTime(selectedMsg.created_at)}
                  </Text>
                </View>
                <Text style={styles.modalText}>{selectedMsg.mensagem}</Text>
              </View>

              <View style={styles.modalFooter}>
                {[
                  "MENSAGEM",
                  "NEGOCIACAO",
                  "CONTRATACAO",
                  "CHAT_INICIADO",
                  "INTERESSE",
                ].includes(selectedMsg.tipo) && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      setShowModal(false);
                      // Abre diretamente a sub-aba de conversas
                      setActiveSubTab("CONVERSAS");
                    }}
                  >
                    <Feather
                      name="message-square"
                      size={16}
                      color="#090a0d"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.actionBtnText}>Acessar Conversas</Text>
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

const s = StyleSheet.create({
  // Sub-abas bar
  tabHeader: {
    flexDirection: "row",
    backgroundColor: "#0d0f12",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1d24",
    padding: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: "rgba(245,200,83,0.06)",
    borderColor: "rgba(245,200,83,0.15)",
  },
  tabButtonText: {
    color: "#a0a5b0",
    fontSize: 13,
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: "#f5c853",
  },

  // Conversas Channel row
  channelCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12141c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  channelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  channelAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1e2130",
    justifyContent: "center",
    alignItems: "center",
  },
  channelAvatarText: {
    color: "#f5c853",
    fontWeight: "800",
    fontSize: 14,
  },
  channelMeta: {
    flex: 1,
    marginLeft: 12,
  },
  channelName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    maxWidth: "60%",
  },
  channelTitle: {
    color: "#6e737f",
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeHired: {
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  badgeNeg: {
    backgroundColor: "rgba(245,200,83,0.12)",
  },
  badgeTextHired: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "700",
  },
  badgeTextNeg: {
    color: "#f5c853",
    fontSize: 10,
    fontWeight: "700",
  },

  // Chat Root / Screen
  chatRoot: {
    flex: 1,
    backgroundColor: "#090a0d",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0f12",
    height: 60,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#16191f",
  },
  chatBackBtn: {
    padding: 6,
  },
  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 6,
  },
  chatAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e2130",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  chatAvatarText: {
    color: "#f5c853",
    fontSize: 12,
    fontWeight: "800",
  },
  chatHeaderName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginRight: 4,
  },
  onlineText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "500",
  },
  aiHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1c18",
    borderWidth: 1,
    borderColor: "rgba(245,200,83,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  aiHeaderBtnText: {
    color: "#f5c853",
    fontSize: 11,
    fontWeight: "700",
  },

  // Messages Scroll
  chatScroll: {
    padding: 16,
    paddingBottom: 24,
  },
  chatLoader: {
    paddingVertical: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  noMessages: {
    alignItems: "center",
    paddingVertical: 60,
  },
  noMessagesText: {
    color: "#606672",
    textAlign: "center",
    fontStyle: "italic",
  },
  msgWrapper: {
    marginBottom: 16,
    maxWidth: "80%",
  },
  msgRight: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  msgLeft: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleRight: {
    backgroundColor: "#f5c853",
    borderTopRightRadius: 2,
  },
  bubbleLeft: {
    backgroundColor: "#16191f",
    borderTopLeftRadius: 2,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 19,
  },
  msgMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  msgTimeText: {
    fontSize: 9,
  },
  aiMsgBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    backgroundColor: "#1e1c18",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,200,83,0.15)",
  },
  aiMsgBadgeText: {
    color: "#f5c853",
    fontSize: 10,
    fontWeight: "bold",
  },

  // Input Row
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#0d0f12",
    borderTopWidth: 1,
    borderTopColor: "#16191f",
  },
  iconBtn: {
    padding: 10,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: "#16191f",
    borderRadius: 20,
    paddingHorizontal: 14,
    marginHorizontal: 8,
    height: 38,
    justifyContent: "center",
  },
  textInput: {
    color: "#fff",
    fontSize: 14,
    padding: 0,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  // Media render
  mediaMessage: {
    width: 180,
    borderRadius: 10,
    overflow: "hidden",
  },
  mediaImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#20242e",
  },
  mediaNameText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "600",
    padding: 4,
  },
  pdfCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    padding: 10,
    borderRadius: 8,
    width: 200,
  },
  fileNameText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "700",
  },
  fileActionText: {
    color: "#444",
    fontSize: 10,
    marginTop: 2,
  },
  audioCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    padding: 10,
    borderRadius: 8,
    width: 200,
  },
  meetCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(57,211,83,0.1)",
    borderWidth: 1,
    borderColor: "rgba(57,211,83,0.25)",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  meetText: {
    color: "#39d353",
    fontSize: 12,
    fontWeight: "700",
  },

  // Upload indicator
  uploadIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1c18",
    padding: 8,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(245,200,83,0.15)",
  },
  uploadText: {
    color: "#f5c853",
    fontSize: 12,
    fontWeight: "500",
  },

  // Modal IA
  overlay: {
    flex: 1,
    backgroundColor: "rgba(9, 10, 13, 0.85)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0d0f12",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#f5c853",
    borderBottomWidth: 0,
    padding: 20,
    height: "75%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1d24",
    marginBottom: 16,
  },
  aiLogoBg: {
    backgroundColor: "#f5c853",
    borderRadius: 6,
    padding: 6,
    marginRight: 10,
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  aiCard: {
    backgroundColor: "#12141c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  aiCardHeader: {
    color: "#f5c853",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  aiAnalysisText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 22,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5c853",
    borderRadius: 10,
    paddingVertical: 12,
  },
  copyBtnText: {
    color: "#090a0d",
    fontSize: 14,
    fontWeight: "800",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090a0d",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#090a0d",
  },
  loadingText: {
    color: "#a0a5b0",
    marginTop: 10,
    fontSize: 14,
  },
  card: {
    backgroundColor: "#12141c",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    borderLeftColor: "#f5c853",
  },
  newBadge: {
    position: "absolute",
    top: -8,
    left: 12,
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  titleGroup: {
    flex: 1,
    justifyContent: "center",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaGroup: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
  },
  dateText: {
    color: "#8e94a2",
    fontSize: 11,
    marginBottom: 4,
  },
  deleteBtn: {
    padding: 4,
  },
  cardDesc: {
    color: "#a0a5b0",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    color: "#8e94a2",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#16191f",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3a341e",
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2c313c",
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    marginRight: 16,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalBadge: {
    fontSize: 12,
    fontWeight: "bold",
  },
  modalDate: {
    color: "#a0a5b0",
    fontSize: 12,
  },
  modalText: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 22,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  closeBtn: {
    backgroundColor: "#2c313c",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 10,
  },
  closeBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  actionBtn: {
    backgroundColor: "#f5c853",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  actionBtnText: {
    color: "#090a0d",
    fontSize: 14,
    fontWeight: "bold",
  },
});
