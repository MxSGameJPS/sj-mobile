import React, { useState } from 'react';
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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import { supabaseService } from '../services/supabaseService';

const DISCOVERY_OPTIONS = [
  'Grupo do Facebook',
  'Linkedin',
  'Instagram',
  'Pesquisa Google'
];

const UF_OPTIONS = [
  { value: 'AC', label: 'AC - Acre' },
  { value: 'AL', label: 'AL - Alagoas' },
  { value: 'AP', label: 'AP - Amapá' },
  { value: 'AM', label: 'AM - Amazonas' },
  { value: 'BA', label: 'BA - Bahia' },
  { value: 'CE', label: 'CE - Ceará' },
  { value: 'DF', label: 'DF - Distrito Federal' },
  { value: 'ES', label: 'ES - Espírito Santo' },
  { value: 'GO', label: 'GO - Goiás' },
  { value: 'MA', label: 'MA - Maranhão' },
  { value: 'MT', label: 'MT - Grosso' },
  { value: 'MS', label: 'MS - Grosso do Sul' },
  { value: 'MG', label: 'MG - Minas Gerais' },
  { value: 'PA', label: 'PA - Pará' },
  { value: 'PB', label: 'PB - Paraíba' },
  { value: 'PR', label: 'PR - Paraná' },
  { value: 'PE', label: 'PE - Pernambuco' },
  { value: 'PI', label: 'PI - Piauí' },
  { value: 'RJ', label: 'RJ - Rio de Janeiro' },
  { value: 'RN', label: 'RN - Rio Grande do Norte' },
  { value: 'RS', label: 'RS - Rio Grande do Sul' },
  { value: 'RO', label: 'RO - Rondônia' },
  { value: 'RR', label: 'RR - Roraima' },
  { value: 'SC', label: 'SC - Santa Catarina' },
  { value: 'SP', label: 'SP - São Paulo' },
  { value: 'SE', label: 'SE - Sergipe' },
  { value: 'TO', label: 'TO - Tocantins' }
];

export default function RegisterScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('client'); // 'client' | 'lawyer'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [oab, setOab] = useState('');
  const [estado, setEstado] = useState('');
  const [origemDescoberta, setOrigemDescoberta] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Selector Modals
  const [showUfModal, setShowUfModal] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);

  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // WhatsApp auto-formatting
  const handlePhoneChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned.length > 0) {
      const ddd = cleaned.slice(0, 2);
      const prefix = cleaned.slice(2, 7);
      const suffix = cleaned.slice(7, 11);
      
      if (cleaned.length > 7) {
        formatted = `(${ddd}) ${prefix}-${suffix}`;
      } else if (cleaned.length > 2) {
        formatted = `(${ddd}) ${prefix}`;
      } else {
        formatted = `(${ddd}`;
      }
    }
    
    setPhone(formatted);
    if (errorMessage) setErrorMessage('');
  };

  const handleRegister = async () => {
    // Validação de campos obrigatórios
    if (!name || !email || !phone || !origemDescoberta || !senha || !confirmarSenha) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (activeTab === 'lawyer' && (!oab || !estado)) {
      setErrorMessage('Informe o número da OAB e o Estado (UF).');
      return;
    }

    if (senha.length < 8) {
      setErrorMessage('A senha precisa ter no mínimo 8 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      setErrorMessage('As senhas não conferem. Verifique a digitação.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Você precisa concordar com os Termos de Uso e Política de Privacidade.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Se for advogado, fazer checagem de duplicidade de OAB na RPC antes
      if (activeTab === 'lawyer') {
        const oabExists = await supabaseService.checkOabExists(oab, estado);
        if (oabExists) {
          setErrorMessage(`Já existe um advogado cadastrado com a OAB ${oab} nesta UF.`);
          setLoading(false);
          return;
        }
      }

      // 2. Chamar o serviço de cadastro unificado
      const payload = {
        email,
        password: senha,
        name,
        phone,
        role: activeTab === 'lawyer' ? 'LAWYER' : 'CLIENT',
        oab: activeTab === 'lawyer' ? oab : null,
        estado: activeTab === 'lawyer' ? estado : null,
        origem_descoberta: origemDescoberta,
      };

      await supabaseService.signUp(payload);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      let friendlyError = err.message || 'Ocorreu um erro ao criar a sua conta.';
      if (err.message?.includes('already registered') || err.message?.includes('User already exists')) {
        friendlyError = 'Este e-mail já está cadastrado em nossa plataforma.';
      }
      setErrorMessage(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#090a0d" />
        <View style={styles.successContainer}>
          <Ionicons name="mail-unread-outline" size={80} color="#f5c853" style={styles.successIcon} />
          <Text style={styles.successTitle}>Verifique seu e-mail!</Text>
          <Text style={styles.successDesc}>
            Enviamos um link de confirmação para o endereço{'\n'}
            <Text style={styles.boldEmail}>{email}</Text>.{'\n\n'}
            Por favor, clique no link para ativar sua conta antes de fazer o login na plataforma.
          </Text>
          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.successBtnText}>Voltar para o Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Crie sua conta</Text>
            <Text style={styles.subtitle}>Estamos animados para ter você a bordo</Text>
          </View>

          {/* Role Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'client' && styles.activeTab]}
              onPress={() => {
                setActiveTab('client');
                setErrorMessage('');
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'client' && styles.activeTabText]}>
                Sou Cliente
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'lawyer' && styles.activeTab]}
              onPress={() => {
                setActiveTab('lawyer');
                setErrorMessage('');
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'lawyer' && styles.activeTabText]}>
                Sou Advogado
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Nome Completo */}
            <Text style={styles.label}>Nome completo</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Seu nome completo"
                placeholderTextColor="#505560"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errorMessage) setErrorMessage('');
                }}
              />
            </View>

            {/* Email & WhatsApp Row */}
            <View style={styles.row}>
              <View style={styles.flexItem}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="seu@email.com"
                    placeholderTextColor="#505560"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                  />
                </View>
              </View>
              <View style={[styles.flexItem, { marginLeft: 12 }]}>
                <Text style={styles.label}>WhatsApp</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="(11) 90000-0000"
                    placeholderTextColor="#505560"
                    keyboardType="phone-pad"
                    maxLength={15}
                    value={phone}
                    onChangeText={handlePhoneChange}
                  />
                </View>
              </View>
            </View>

            {/* OAB & Estado Row (Somente Advogado) */}
            {activeTab === 'lawyer' && (
              <View style={styles.row}>
                <View style={styles.flexItem}>
                  <Text style={styles.label}>OAB (somente números)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: 123456"
                      placeholderTextColor="#505560"
                      keyboardType="numeric"
                      value={oab}
                      onChangeText={(text) => {
                        setOab(text.replace(/\D/g, ''));
                        if (errorMessage) setErrorMessage('');
                      }}
                    />
                  </View>
                </View>
                <View style={[styles.flexItem, { marginLeft: 12 }]}>
                  <Text style={styles.label}>Estado (UF)</Text>
                  <TouchableOpacity
                    style={styles.inputContainer}
                    onPress={() => setShowUfModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.inputText, !estado && styles.placeholderText]}>
                      {estado ? estado : 'Selecione'}
                    </Text>
                    <Feather name="chevron-down" size={16} color="#606672" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Onde conheceu o Social Jurídico */}
            <Text style={styles.label}>Onde conheceu o Social Jurídico?</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => setShowDiscoveryModal(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.inputText, !origemDescoberta && styles.placeholderText]}>
                {origemDescoberta ? origemDescoberta : 'Selecione uma opção'}
              </Text>
              <Feather name="chevron-down" size={16} color="#606672" />
            </TouchableOpacity>

            {/* Senha & Confirmar Senha Row */}
            <View style={styles.row}>
              <View style={styles.flexItem}>
                <Text style={styles.label}>Senha</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 8"
                    placeholderTextColor="#505560"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={senha}
                    onChangeText={(text) => {
                      setSenha(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Feather name={showPassword ? 'eye' : 'eye-off'} size={16} color="#606672" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.flexItem, { marginLeft: 12 }]}>
                <Text style={styles.label}>Confirmar senha</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Mínimo 8"
                    placeholderTextColor="#505560"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={confirmarSenha}
                    onChangeText={(text) => {
                      setConfirmarSenha(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                  >
                    <Feather name={showConfirmPassword ? 'eye' : 'eye-off'} size={16} color="#606672" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Checkbox Termos */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                {termsAccepted && <Feather name="check" size={12} color="#0d0f12" />}
              </View>
              <Text style={styles.checkboxLabel}>
                Eu concordo com os <Text style={styles.goldText}>Termos de Uso</Text> e a{' '}
                <Text style={styles.goldText}>Política de Privacidade</Text>.
              </Text>
            </TouchableOpacity>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color="#ff4d4d" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#0d0f12" />
              ) : (
                <Text style={styles.submitBtnText}>Criar conta</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
              <Text style={styles.goldTextBold}>Fazer login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* UF Modal Select */}
      <Modal visible={showUfModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione seu Estado (UF)</Text>
              <TouchableOpacity onPress={() => setShowUfModal(false)}>
                <Feather name="x" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={UF_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, estado === item.value && styles.modalItemActive]}
                  onPress={() => {
                    setEstado(item.value);
                    setShowUfModal(false);
                    if (errorMessage) setErrorMessage('');
                  }}
                >
                  <Text style={[styles.modalItemText, estado === item.value && styles.modalItemTextActive]}>
                    {item.label}
                  </Text>
                  {estado === item.value && <Feather name="check" size={18} color="#f5c853" />}
                </TouchableOpacity>
              )}
              style={styles.modalList}
            />
          </View>
        </View>
      </Modal>

      {/* Discovery Modal Select */}
      <Modal visible={showDiscoveryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Como conheceu a gente?</Text>
              <TouchableOpacity onPress={() => setShowDiscoveryModal(false)}>
                <Feather name="x" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={DISCOVERY_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, origemDescoberta === item && styles.modalItemActive]}
                  onPress={() => {
                    setOrigemDescoberta(item);
                    setShowDiscoveryModal(false);
                    if (errorMessage) setErrorMessage('');
                  }}
                >
                  <Text style={[styles.modalItemText, origemDescoberta === item && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                  {origemDescoberta === item && <Feather name="check" size={18} color="#f5c853" />}
                </TouchableOpacity>
              )}
              style={styles.modalList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a0d',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#808694',
    textAlign: 'center',
    marginTop: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#13151b',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#20242e',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#f5c853',
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#808694',
  },
  activeTabText: {
    color: '#0d0f12',
  },
  formContainer: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  flexItem: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a0a5b0',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d0f12',
    borderColor: '#20242e',
    borderWidth: 1.2,
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  inputText: {
    color: '#ffffff',
    fontSize: 14,
  },
  placeholderText: {
    color: '#505560',
  },
  eyeBtn: {
    padding: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.2,
    borderColor: '#20242e',
    backgroundColor: '#0d0f12',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#f5c853',
    borderColor: '#f5c853',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#808694',
    lineHeight: 18,
  },
  goldText: {
    color: '#f5c853',
  },
  goldTextBold: {
    color: '#f5c853',
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 77, 77, 0.08)',
    borderColor: 'rgba(255, 77, 77, 0.2)',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 18,
  },
  errorText: {
    color: '#ff4d4d',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  submitBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#f5c853',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#0d0f12',
    fontSize: 15,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#808694',
    fontSize: 14,
  },
  // Custom Modals styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#13151b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#20242e',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalList: {
    paddingHorizontal: 12,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  modalItemActive: {
    backgroundColor: '#1b1e26',
  },
  modalItemText: {
    fontSize: 14,
    color: '#a0a5b0',
  },
  modalItemTextActive: {
    color: '#f5c853',
    fontWeight: 'bold',
  },
  // Success state styling
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  successDesc: {
    fontSize: 15,
    color: '#a0a5b0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  boldEmail: {
    color: '#f5c853',
    fontWeight: 'bold',
  },
  successBtn: {
    backgroundColor: '#f5c853',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  successBtnText: {
    color: '#0d0f12',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
