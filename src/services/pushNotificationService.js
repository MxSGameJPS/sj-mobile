import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getApiBaseUrl } from "../config/api";

const WEB_API = getApiBaseUrl();

// Configura o comportamento das notificações recebidas com o app em primeiro plano (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(accessToken) {
  if (Platform.OS === "web") return null;

  try {
    // 1. Checar as permissões de notificação existentes
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn(
        "[PushNotificationService] Permissão para push notifications não concedida.",
      );
      return null;
    }

    // 2. Obter o token de push do Expo
    // Passa o projectId obtido do app.json/extra para ambiente local de desenvolvimento.
    let token = null;
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
      if (!projectId) {
        console.warn(
          "[PushNotificationService] Aviso: projectId do EAS não encontrado. Verifique app.json.",
        );
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenData.data;
      console.log("[PushNotificationService] Token gerado:", token);
    } catch (tokenErr) {
      console.warn(
        "[PushNotificationService] Erro ao buscar token (verifique se google-services.json está presente na build ou se está rodando no Expo Go):",
        tokenErr.message,
      );
    }

    // 3. Registrar o token obtido no backend Next.js
    if (token && accessToken) {
      const res = await fetch(`${WEB_API}/notificacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });
      const resData = await res.json();
      console.log(
        "[PushNotificationService] Registro no backend concluído:",
        resData,
      );
    }

    // 4. Configurar canal de som e vibração para Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#f5c853",
      });
    }

    return token;
  } catch (err) {
    console.error(
      "[PushNotificationService] Falha geral no registro de Push:",
      err,
    );
    return null;
  }
}
