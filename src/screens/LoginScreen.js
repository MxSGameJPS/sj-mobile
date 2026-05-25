import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { COLORS } from "../styles/theme";
import { supabaseService } from "../services/supabaseService";
import { saveAuthSession } from "../services/sessionStore";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(compatible && enrolled);

      // Se tiver biometria e credenciais salvas, tentar autenticar automaticamente
      if (compatible && enrolled) {
        const savedEmail = await SecureStore.getItemAsync("sj_email");
        const savedPassword = await SecureStore.getItemAsync("sj_password");
        if (savedEmail && savedPassword) {
          promptBiometrics(savedEmail, savedPassword);
        }
      }
    } catch (e) {
      console.log("Erro ao verificar suporte a biometria", e);
    }
  };

  const promptBiometrics = async (savedEmail, savedPassword) => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Autentique-se no Social Jurídico",
        fallbackLabel: "Usar senha",
        cancelLabel: "Cancelar",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        performLogin(savedEmail, savedPassword);
      }
    } catch (error) {
      console.log("Erro na autenticação biométrica", error);
    }
  };

  const performLogin = async (loginEmail, loginPassword) => {
    setLoading(true);
    setErrorMessage("");

    const cleanEmail = loginEmail.trim().toLowerCase();

    try {
      const result = await supabaseService.signIn(cleanEmail, loginPassword);

      // Salva as credenciais no SecureStore para futuros acessos biométricos
      await SecureStore.setItemAsync("sj_email", cleanEmail);
      await SecureStore.setItemAsync("sj_password", loginPassword);
      await saveAuthSession({
        session: result.session,
        user: result.user,
        role: result.role,
      });

      setLoading(false);

      const nextScreen =
        result.role === "LAWYER" ? "LawyerDashboard" : "Dashboard";

      navigation.navigate(nextScreen, {
        session: result.session,
        accessToken: result.session?.accessToken,
        user: result.user,
        role: result.role,
      });
    } catch (error) {
      setLoading(false);
      let friendlyError = error.message;
      if (
        error.message.includes("Invalid login credentials") ||
        error.message.includes("invalid_credentials")
      ) {
        friendlyError = "E-mail ou senha incorretos.";
        // Limpar credenciais salvas antigas/inválidas para evitar loops de falha
        SecureStore.deleteItemAsync("sj_email").catch(() => {});
        SecureStore.deleteItemAsync("sj_password").catch(() => {});
      } else if (error.message.includes("Email not confirmed")) {
        friendlyError = "Por favor, confirme seu e-mail antes de acessar.";
      }
      setErrorMessage(friendlyError);
    }
  };

  const handleLogin = () => {
    if (!email || !password) {
      setErrorMessage("Por favor, preencha todos os campos.");
      return;
    }
    performLogin(email, password);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo & Header */}
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              {/* Ícone customizado representando a balança de forma estilizada */}
              <View style={styles.scaleIconContainer}>
                <View style={styles.scaleBeam} />
                <View style={styles.scalePansContainer}>
                  <View style={styles.scalePanLeft} />
                  <View style={styles.scalePanRight} />
                </View>
                <View style={styles.scaleBase} />
              </View>
              <Text style={styles.logoText}>
                Social<Text style={styles.logoGold}>Jurídico</Text>
              </Text>
            </View>
            <Text style={styles.subtitle}>Acesso exclusivo à plataforma.</Text>
          </View>

          {/* Accent Line / Divider (Substituindo o antigo seletor de abas) */}
          <View style={styles.accentLineContainer}>
            <View style={styles.accentLineFill} />
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>E-mail corporativo</Text>
            <View style={styles.inputContainer}>
              <Feather
                name="mail"
                size={20}
                color="#606672"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="nome@escritorio.com.br"
                placeholderTextColor="#505560"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Senha</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <Feather
                name="lock"
                size={20}
                color="#606672"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#505560"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage("");
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
                style={styles.eyeIcon}
              >
                <Feather
                  name={showPassword ? "eye" : "eye-off"}
                  size={20}
                  color="#606672"
                />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Feather
                  name="alert-circle"
                  size={16}
                  color="#f5c853"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#0d0f12" />
              ) : (
                <View style={styles.loginBtnContent}>
                  <Text style={styles.loginBtnText}>Entrar na plataforma</Text>
                  <Feather
                    name="arrow-right"
                    size={20}
                    color="#0d0f12"
                    style={styles.arrowIcon}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Biometric Button */}
            {hasBiometrics && (
              <TouchableOpacity
                style={styles.biometricBtn}
                activeOpacity={0.7}
                onPress={async () => {
                  const savedEmail = await SecureStore.getItemAsync("sj_email");
                  const savedPassword =
                    await SecureStore.getItemAsync("sj_password");
                  if (savedEmail && savedPassword) {
                    promptBiometrics(savedEmail, savedPassword);
                  } else {
                    setErrorMessage(
                      "Faça login com senha primeiro para ativar a biometria.",
                    );
                  }
                }}
              >
                <Ionicons name="finger-print" size={20} color="#f5c853" />
                <Text style={styles.biometricBtnText}>
                  Entrar com biometria
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Footer Register Link */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Ainda não faz parte? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Register")}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>Cadastre-se grátis</Text>
            </TouchableOpacity>
          </View>

          {/* Social Proof Badges no rodapé */}
          <View style={styles.socialProofContainer}>
            <View style={styles.badgeOverlaps}>
              <View
                style={[
                  styles.avatarBadge,
                  { zIndex: 3, backgroundColor: "#21252d" },
                ]}
              >
                <Feather name="user" size={12} color="#a0a5b0" />
              </View>
              <View
                style={[
                  styles.avatarBadge,
                  { zIndex: 2, backgroundColor: "#2d3341", marginLeft: -8 },
                ]}
              >
                <MaterialCommunityIcons
                  name="office-building-outline"
                  size={12}
                  color="#a0a5b0"
                />
              </View>
              <View
                style={[
                  styles.avatarBadge,
                  {
                    zIndex: 1,
                    backgroundColor: COLORS.primary,
                    marginLeft: -8,
                  },
                ]}
              >
                <Ionicons name="star" size={12} color="#000" />
              </View>
            </View>
            <Text style={styles.socialProofText}>
              Confiança de +1.000 usuários
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090a0d", // Fundo preto escuro idêntico ao figma
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scaleIconContainer: {
    width: 24,
    height: 24,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  scaleBeam: {
    width: 20,
    height: 3,
    backgroundColor: "#f5c853",
    borderRadius: 2,
    transform: [{ rotate: "-20deg" }], // Efeito inclinado da balança do logo
  },
  scalePansContainer: {
    width: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    paddingHorizontal: 1,
  },
  scalePanLeft: {
    width: 6,
    height: 6,
    borderWidth: 1.5,
    borderColor: "#f5c853",
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  scalePanRight: {
    width: 6,
    height: 6,
    borderWidth: 1.5,
    borderColor: "#f5c853",
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  scaleBase: {
    width: 4,
    height: 4,
    backgroundColor: "#f5c853",
    borderRadius: 2,
    marginTop: 1,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
  },
  logoGold: {
    color: "#f5c853",
  },
  subtitle: {
    fontSize: 15,
    color: "#808694",
    marginTop: 10,
  },
  // Estilo da barra de progresso/accent line sob o cabeçalho
  accentLineContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#15171d",
    borderColor: "#20242e",
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 32,
    justifyContent: "center",
    paddingHorizontal: 1.5,
  },
  accentLineFill: {
    width: "45%", // Estilo preenchimento do progress slider do mockup
    height: 4,
    backgroundColor: "#353a47",
    borderRadius: 2,
  },
  // Form e Inputs
  formContainer: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#a0a5b0",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0f12", // Fundo preto do input
    borderColor: "#20242e",
    borderWidth: 1.2,
    borderRadius: 8,
    height: 52,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    height: "100%",
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#f5c853",
    marginBottom: 8,
  },
  eyeIcon: {
    padding: 4,
  },
  // Erros
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 200, 83, 0.1)",
    borderColor: "rgba(245, 200, 83, 0.3)",
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#f5c853",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  // Botão Entrar
  loginBtn: {
    width: "100%",
    height: 52,
    backgroundColor: "#f5c853", // Amarelo/Dourado figma
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  loginBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: {
    color: "#0d0f12",
    fontSize: 16,
    fontWeight: "bold",
  },
  arrowIcon: {
    marginLeft: 8,
  },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    backgroundColor: "rgba(245, 200, 83, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 83, 0.3)",
    borderRadius: 8,
    paddingVertical: 12,
  },
  biometricBtnText: {
    color: "#f5c853",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  // Footer
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 40,
  },
  footerText: {
    color: "#808694",
    fontSize: 14,
  },
  registerText: {
    color: "#f5c853",
    fontSize: 14,
    fontWeight: "bold",
  },
  // Social Proof Badges no rodapé
  socialProofContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  badgeOverlaps: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  avatarBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderColor: "#090a0d",
    borderWidth: 1.5,
  },
  socialProofText: {
    color: "#808694",
    fontSize: 13,
    fontWeight: "500",
  },
});
