import * as SecureStore from "expo-secure-store";

const AUTH_SESSION_KEY = "sj_auth_session";
const SUPABASE_URL = "https://uwkcdwlgobnhowumcdnp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3a2Nkd2xnb2JuaG93dW1jZG5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTEyNDIsImV4cCI6MjA4OTE4NzI0Mn0.Nz-2pITIzlzZW-sePHXAyW6Kz19p45vlMN22Z8VEYEk";

function compactAuthData(authData) {
  const session = authData?.session || {};
  const user = authData?.user || {};

  return {
    session: {
      accessToken:
        session.accessToken ||
        session.access_token ||
        authData?.accessToken ||
        authData?.access_token ||
        null,
      refreshToken:
        session.refreshToken ||
        session.refresh_token ||
        authData?.refreshToken ||
        authData?.refresh_token ||
        null,
      expiresAt:
        session.expiresAt ||
        session.expires_at ||
        authData?.expiresAt ||
        authData?.expires_at ||
        null,
    },
    user: user?.id
      ? {
          id: user.id,
          email: user.email || null,
          user_metadata: user.user_metadata || {},
        }
      : authData?.user || null,
    role: authData?.role || user?.user_metadata?.role || null,
  };
}

export async function saveAuthSession(authData) {
  if (!authData) return;
  const compacted = compactAuthData(authData);
  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(compacted));
}

export async function loadAuthSession() {
  const rawSession = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession);
  } catch {
    return null;
  }
}

export async function refreshStoredAuthSession() {
  const authSession = await loadAuthSession();
  const refreshToken = authSession?.session?.refreshToken;

  if (!refreshToken) return authSession;

  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );

  if (!response.ok) {
    return authSession;
  }

  const data = await response.json();
  if (!data?.access_token) return authSession;

  const refreshedSession = {
    session: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_at,
    },
    user: authSession?.user || null,
    role: authSession?.role || null,
  };

  await saveAuthSession(refreshedSession);
  return refreshedSession;
}

export async function clearAuthSession() {
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
}

export async function getStoredAccessToken() {
  const authSession = await loadAuthSession();
  const expiresAt = authSession?.session?.expiresAt;
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (!authSession?.session?.accessToken) return null;

  if (expiresAt && Number(expiresAt) <= nowInSeconds + 60) {
    const refreshedSession = await refreshStoredAuthSession();
    return (
      refreshedSession?.session?.accessToken ||
      refreshedSession?.accessToken ||
      null
    );
  }

  return authSession?.session?.accessToken || authSession?.accessToken || null;
}

function decodeJwtPayload(token) {
  try {
    const payloadPart = token?.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const base64 = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getValidAccessToken(preferredToken = null) {
  const authSession = await loadAuthSession();
  const storedToken = authSession?.session?.accessToken || null;
  const token = preferredToken || storedToken || (await getStoredAccessToken());

  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (payload?.exp && payload.exp <= nowInSeconds + 30) {
    const refreshedSession = await refreshStoredAuthSession();
    return (
      refreshedSession?.session?.accessToken ||
      refreshedSession?.accessToken ||
      token
    );
  }

  if (
    authSession?.session?.expiresAt &&
    Number(authSession.session.expiresAt) <= nowInSeconds + 30
  ) {
    const refreshedSession = await refreshStoredAuthSession();
    return (
      refreshedSession?.session?.accessToken ||
      refreshedSession?.accessToken ||
      token
    );
  }

  return token;
}
