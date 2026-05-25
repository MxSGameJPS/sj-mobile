import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";
import LawyerDashboardScreen from "../screens/LawyerDashboardScreen";
import LawyerInterestsScreen from "../screens/LawyerInterestsScreen";
import LawyerCasesScreen from "../screens/LawyerCasesScreen";
import LawyerDigitalSignatureScreen from "../screens/LawyerDigitalSignatureScreen";
import LawyerBlindagemDashboardScreen from "../screens/LawyerBlindagemDashboardScreen";
import LawyerBlindagemContratosScreen from "../screens/LawyerBlindagemContratosScreen";
import LawyerBlindagemProcuracaoScreen from "../screens/LawyerBlindagemProcuracaoScreen";
import LawyerBlindagemProvasScreen from "../screens/LawyerBlindagemProvasScreen";
import LawyerBlindagemNotificacaoScreen from "../screens/LawyerBlindagemNotificacaoScreen";
import LawyerAgendaScreen from "../screens/LawyerAgendaScreen";
import LawyerAgendaNovoScreen from "../screens/LawyerAgendaNovoScreen";
import LawyerCalculadoraScreen from "../screens/LawyerCalculadoraScreen";
import { loadAuthSession } from "../services/sessionStore";
import { COLORS } from "../styles/theme";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [authSession, setAuthSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const storedSession = await loadAuthSession();
        if (mounted) {
          setAuthSession(storedSession);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return null;
  }

  const isAuthenticated = Boolean(authSession?.session?.accessToken);
  const initialRouteName = isAuthenticated
    ? authSession?.role === "LAWYER"
      ? "LawyerDashboard"
      : "Dashboard"
    : "Login";

  const initialParams = isAuthenticated
    ? {
        user: authSession?.user,
        role: authSession?.role,
        session: authSession?.session,
        accessToken: authSession?.session?.accessToken,
      }
    : undefined;

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={isAuthenticated ? "auth" : "guest"}
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          initialParams={initialParams}
        />
        <Stack.Screen
          name="LawyerDashboard"
          component={LawyerDashboardScreen}
          initialParams={initialParams}
        />
        <Stack.Screen
          name="LawyerInterests"
          component={LawyerInterestsScreen}
        />
        <Stack.Screen name="LawyerCases" component={LawyerCasesScreen} />
        <Stack.Screen
          name="LawyerDigitalSignature"
          component={LawyerDigitalSignatureScreen}
        />
        <Stack.Screen
          name="LawyerBlindagemDashboard"
          component={LawyerBlindagemDashboardScreen}
        />
        <Stack.Screen
          name="LawyerBlindagemContratos"
          component={LawyerBlindagemContratosScreen}
        />
        <Stack.Screen
          name="LawyerBlindagemProcuracao"
          component={LawyerBlindagemProcuracaoScreen}
        />
        <Stack.Screen
          name="LawyerBlindagemProvas"
          component={LawyerBlindagemProvasScreen}
        />
        <Stack.Screen
          name="LawyerBlindagemNotificacao"
          component={LawyerBlindagemNotificacaoScreen}
        />
        <Stack.Screen name="LawyerAgenda" component={LawyerAgendaScreen} />
        <Stack.Screen
          name="LawyerAgendaNovo"
          component={LawyerAgendaNovoScreen}
        />
        <Stack.Screen
          name="LawyerCalculadora"
          component={LawyerCalculadoraScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
