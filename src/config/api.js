import Constants from "expo-constants";

const DEFAULT_PRODUCTION_API_URL = "https://socialjuridico.com.br/api";

function normalizeApiUrl(rawUrl) {
  if (!rawUrl) return null;

  const trimmed = String(rawUrl).trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export function getApiBaseUrl() {
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants?.expoConfig?.extra?.apiUrl ||
    Constants?.manifest?.extra?.apiUrl;

  const normalizedConfiguredUrl = normalizeApiUrl(configuredUrl);
  if (normalizedConfiguredUrl) return normalizedConfiguredUrl;

  return DEFAULT_PRODUCTION_API_URL;
}
