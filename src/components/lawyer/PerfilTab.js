/**
 * PerfilTab.js — Tela de Perfil e Cartão de Visitas do Advogado
 * Alinhado com o design esmero dark/gold e com paridade completa de campos.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Share,
  Clipboard,
  Image,
  Dimensions
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../styles/theme';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');
const LOCAL_IP = '192.168.2.195';
const WEB_API = __DEV__
  ? `http://${LOCAL_IP}:3000/api`
  : 'https://socialjuridico.com.br/api';

const SPECIALTIES_LIST = [
  'Família',
  'Cível',
  'Imobiliário',
  'Trabalhista',
  'Penal',
  'Tributário',
  'Digital',
  'Empresarial'
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
  { value: 'MT', label: 'MT - Mato Grosso' },
  { value: 'MS', label: 'MS - Mato Grosso do Sul' },
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

const DURATION_OPTIONS = [
  '30 minutos',
  '1 hora',
  '1 hora e meia',
  '2 horas',
  '3 horas'
];

export default function PerfilTab({ userId, accessToken }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [oab, setOab] = useState('');
  const [estado, setEstado] = useState('');
  const [bio, setBio] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState([]);
  const [consulta, setConsulta] = useState('Gratuita');
  const [tempo, setTempo] = useState('1 hora');
  const [valor, setValor] = useState('0');
  const [avatar, setAvatar] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [verified, setVerified] = useState(false);

  // Selector Modals
  const [showUfModal, setShowUfModal] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Refs for ViewShot capturing
  const cardRef = useRef(null);
  const shareRef = useRef(null);

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
  };

  // Fetch profile data
  const fetchProfile = useCallback(async (isRefresh = false) => {
    if (!userId || !accessToken) return;
    if (!isRefresh) setLoading(true);

    try {
      const res = await fetch(`${WEB_API}/perfil`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      const resData = await res.json();

      if (resData.success && resData.data) {
        const p = resData.data;
        setName(p.name || '');
        setPhone(p.phone || '');
        setEmail(p.email || '');
        setOab(p.oab || '');
        setEstado(p.estado || '');
        setBio(p.bio || '');
        setConsulta(p.consulta || 'Gratuita');
        setTempo(p.tempo || '1 hora');
        setValor(p.valor ? String(p.valor) : '0');
        setAvatar(p.avatar || '');
        setIsPremium(p.is_premium || false);
        setVerified(p.oab_verification_status === 'VERIFIED' || p.verified || false);

        // Parse specialties from string to array
        const specs = p.specialties 
          ? p.specialties.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        setSelectedSpecialties(specs);
      } else {
        console.warn('[PerfilTab] Erro ao carregar perfil:', resData.message);
      }
    } catch (e) {
      console.error('[PerfilTab] fetchProfile error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, accessToken]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile(true);
  };

  // Toggle specialties selection
  const toggleSpecialty = (spec) => {
    if (selectedSpecialties.includes(spec)) {
      setSelectedSpecialties(selectedSpecialties.filter(s => s !== spec));
    } else {
      setSelectedSpecialties([...selectedSpecialties, spec]);
    }
  };

  // Save profile to backend
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'O nome completo é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        oab: oab.trim(),
        estado: estado,
        bio: bio.trim(),
        specialties: selectedSpecialties.join(', '),
        consulta: consulta,
        tempo: tempo,
        valor: parseFloat(valor || 0)
      };

      const res = await fetch(`${WEB_API}/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload)
      });
      const resData = await res.json();

      if (resData.success) {
        Alert.alert('Sucesso', 'Perfil profissional atualizado com sucesso!');
        fetchProfile(true);
      } else {
        Alert.alert('Erro', resData.message || 'Não foi possível salvar o perfil.');
      }
    } catch (e) {
      console.error('[PerfilTab] Save error:', e);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  // Update password via profile route
  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Erro', 'A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não conferem.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch(`${WEB_API}/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password: newPassword })
      });
      const resData = await res.json();

      if (resData.success) {
        Alert.alert('Sucesso', 'Senha alterada com sucesso!');
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Erro', resData.message || 'Erro ao alterar a senha.');
      }
    } catch (e) {
      console.error('[PerfilTab] password update error:', e);
      Alert.alert('Erro', 'Não foi possível alterar a senha no momento.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Format currency for display
  const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
  };

  // Generate sharing text
  const getShareText = () => {
    const specs = selectedSpecialties.length > 0 ? selectedSpecialties.join(', ') : 'Não informado';
    const atend = consulta === 'Gratuita' ? 'Consulta Gratuita' : `${tempo} - ${formatMoney(valor)}`;
    const bioText = bio ? bio : 'Sem descrição profissional informada.';

    return `${name} | Advogado\n` +
           `OAB: ${oab || 'Não informado'} (${estado || 'UF'})\n` +
           `Especialidades: ${specs}\n` +
           `Atendimento: ${atend}\n` +
           `Contato: ${phone || 'Não informado'}\n\n` +
           `Apresentação:\n${bioText}`;
  };

  // Copy share text to Clipboard
  const handleCopyText = () => {
    const text = getShareText();
    Clipboard.setString(text);
    Alert.alert('Copiado', 'Resumo profissional copiado para a área de transferência!');
  };

  // Share text using native Share
  const handleShareText = async () => {
    try {
      await Share.share({
        message: getShareText(),
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Capture view and download/save as image
  const handleDownloadImage = async (ref, label) => {
    if (!ref.current) {
      Alert.alert('Erro', 'O componente de visualização não está pronto.');
      return;
    }

    try {
      // Capture the ref as a PNG URI
      const uri = await captureRef(ref, {
        format: 'png',
        quality: 0.95,
      });

      // Request media library permissions (write-only to prevent Android AUDIO permission error in Expo Go)
      let status = 'denied';
      try {
        const permissionRes = await MediaLibrary.requestPermissionsAsync(true);
        status = permissionRes.status;
      } catch (permissionErr) {
        console.warn('[PerfilTab] Erro ao solicitar permissão da galeria:', permissionErr);
      }
      
      if (status === 'granted') {
        try {
          await MediaLibrary.createAssetAsync(uri);
          Alert.alert('Sucesso', `${label} foi salvo na sua galeria de fotos!`);
        } catch (saveErr) {
          console.error('[PerfilTab] Erro ao salvar na biblioteca:', saveErr);
          // Fallback to sharing if saving fails (common in newer Android/Expo Go versions)
          Alert.alert(
            'Erro ao Salvar',
            'Não foi possível salvar a imagem na galeria. Deseja compartilhar a imagem diretamente?',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Compartilhar',
                onPress: async () => {
                  try {
                    await Sharing.shareAsync(uri);
                  } catch (shareErr) {
                    console.error('Erro ao compartilhar imagem:', shareErr);
                  }
                }
              }
            ]
          );
        }
      } else {
        // Permission denied, offer sharing alternative
        Alert.alert(
          'Permissão Requerida',
          'Não conseguimos salvar na galeria de fotos sem permissão de gravação. Deseja compartilhar a imagem diretamente?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Compartilhar',
              onPress: async () => {
                try {
                  await Sharing.shareAsync(uri);
                } catch (shareErr) {
                  console.error('Erro ao compartilhar imagem:', shareErr);
                }
              }
            }
          ]
        );
      }
    } catch (err) {
      console.error(`Erro ao capturar ${label}:`, err);
      Alert.alert('Erro', `Não foi possível gerar a imagem do ${label.toLowerCase()}.`);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f5c853" />
        <Text style={styles.loadingText}>Carregando informações do perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f5c853" colors={["#f5c853"]} />
      }
    >
      {/* 1. Header Profile summary */}
      <View style={styles.profileHeaderBox}>
        <View style={styles.avatarBorder}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {name ? name.charAt(0).toUpperCase() : 'A'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.lawyerName}>{name || 'Advogado'}</Text>

        <View style={styles.badgeRow}>
          {isPremium && (
            <View style={[styles.badge, styles.badgePremium]}>
              <Text style={styles.badgePremiumText}>ADVOGADO PREMIUM</Text>
            </View>
          )}
          {verified && (
            <View style={[styles.badge, styles.badgeVerified]}>
              <Feather name="check" size={12} color="#2ecc71" style={{ marginRight: 4 }} />
              <Text style={styles.badgeVerifiedText}>VERIFICADO</Text>
            </View>
          )}
        </View>

        {/* Account Details Box */}
        <View style={styles.accountDataBox}>
          <Text style={styles.accountDataTitle}>DADOS DA CONTA</Text>
          <Text style={styles.accountDataEmail}>Email: {email}</Text>
          <TouchableOpacity
            style={styles.accountResetBtn}
            onPress={() => setShowPasswordModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.accountResetBtnText}>Alterar Particular na Conta</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Informações Básicas Section */}
      <View style={styles.sectionHeader}>
        <Feather name="user" size={18} color="#f5c853" style={styles.sectionIcon} />
        <Text style={styles.sectionTitle}>INFORMAÇÕES BÁSICAS</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>NOME COMPLETO</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nome Completo"
            placeholderTextColor="#505560"
          />
        </View>

        <Text style={styles.label}>CELULAR / WHATSAPP</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="(DD) 90000-0000"
            placeholderTextColor="#505560"
            keyboardType="phone-pad"
            maxLength={15}
          />
        </View>

        <Text style={styles.label}>EMAIL PROFISSIONAL</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor="#505560"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.label}>NÚMERO OAB</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={oab}
            onChangeText={setOab}
            placeholder="Ex: 123456"
            placeholderTextColor="#505560"
            keyboardType="numeric"
          />
        </View>

        <Text style={styles.label}>ESTADO (UF)</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => setShowUfModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.inputText}>
            {estado ? (UF_OPTIONS.find(item => item.value === estado)?.label || estado) : 'Selecione seu Estado (UF)'}
          </Text>
          <Feather name="chevron-down" size={16} color="#606672" />
        </TouchableOpacity>
      </View>

      {/* 3. Expertise & Bio Section */}
      <View style={styles.sectionHeader}>
        <Feather name="briefcase" size={18} color="#f5c853" style={styles.sectionIcon} />
        <Text style={styles.sectionTitle}>EXPERTISE & BIO</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>MINHAS ESPECIALIDADES (SELECIONE UMA OU MAIS)</Text>
        <View style={styles.specialtiesGrid}>
          {SPECIALTIES_LIST.map((spec) => {
            const isActive = selectedSpecialties.includes(spec);
            return (
              <TouchableOpacity
                key={spec}
                style={[styles.specialtyCard, isActive && styles.specialtyCardActive]}
                onPress={() => toggleSpecialty(spec)}
                activeOpacity={0.7}
              >
                <Feather
                  name={isActive ? "check-square" : "square"}
                  size={16}
                  color={isActive ? "#f5c853" : "#a0a5b0"}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.specialtyText, isActive && styles.specialtyTextActive]}>
                  {spec}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.labelLimitRow}>
          <Text style={styles.label}>SUA BIO / EXPERIÊNCIA</Text>
          <Text style={styles.limitText}>{bio.length}/500 caract.</Text>
        </View>
        <View style={[styles.inputContainer, styles.textAreaContainer]}>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={(text) => {
              if (text.length <= 500) setBio(text);
            }}
            placeholder="Conte um pouco sobre sua carreira, conquistas e foco profissional..."
            placeholderTextColor="#505560"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* 4. Atendimento & Consulta Section */}
      <View style={styles.sectionHeader}>
        <Feather name="clock" size={18} color="#f5c853" style={styles.sectionIcon} />
        <Text style={styles.sectionTitle}>ATENDIMENTO & CONSULTA</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.consultaToggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, consulta === 'Gratuita' && styles.toggleBtnActive]}
            onPress={() => {
              setConsulta('Gratuita');
              setValor('0');
            }}
            activeOpacity={0.7}
          >
            <Feather
              name={consulta === 'Gratuita' ? "check" : "check"}
              size={16}
              color={consulta === 'Gratuita' ? '#f5c853' : '#606672'}
              style={{ marginRight: 6, opacity: consulta === 'Gratuita' ? 1 : 0 }}
            />
            <Text style={[styles.toggleBtnText, consulta === 'Gratuita' && styles.toggleBtnTextActive]}>
              Consulta Gratuita
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.toggleBtn, consulta === 'Paga' && styles.toggleBtnActive]}
            onPress={() => setConsulta('Paga')}
            activeOpacity={0.7}
          >
            <Feather
              name={consulta === 'Paga' ? "check" : "check"}
              size={16}
              color={consulta === 'Paga' ? '#f5c853' : '#606672'}
              style={{ marginRight: 6, opacity: consulta === 'Paga' ? 1 : 0 }}
            />
            <Text style={[styles.toggleBtnText, consulta === 'Paga' && styles.toggleBtnTextActive]}>
              Consulta Paga
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>TEMPO DE CONSULTA</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() => setShowDurationModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.inputText}>{tempo}</Text>
          <Feather name="chevron-down" size={16} color="#606672" />
        </TouchableOpacity>

        {consulta === 'Paga' && (
          <>
            <Text style={styles.label}>VALOR (R$)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={valor}
                onChangeText={setValor}
                placeholder="Ex: 150.00"
                placeholderTextColor="#505560"
                keyboardType="numeric"
              />
            </View>
          </>
        )}
      </View>

      {/* 5. Cartão de Visitas Digital Section */}
      <View style={styles.sectionHeader}>
        <Feather name="credit-card" size={18} color="#f5c853" style={styles.sectionIcon} />
        <Text style={styles.sectionTitle}>CARTÃO DE VISITAS DIGITAL</Text>
      </View>

      {/* The Styled Business Card Box */}
      <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.95 }} style={styles.digitalCardBox}>
        {/* Top Header inside business card */}
        <View style={styles.digitalCardTop}>
          <View style={styles.digitalCardAvatarBorder}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.digitalCardAvatar} />
            ) : (
              <View style={styles.digitalCardAvatarFallback}>
                <Text style={styles.digitalCardAvatarFallbackText}>
                  {name ? name.charAt(0).toUpperCase() : 'A'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.digitalCardTopInfo}>
            <Text style={styles.digitalCardSubtitle}>ADVOGADO SOCIALJURÍDICO</Text>
            <Text style={styles.digitalCardName}>{name || 'Seu Nome'}</Text>
            <Text style={styles.digitalCardOab}>OAB: {oab || '------'} ({estado || 'UF'})</Text>
            <View style={styles.digitalCardBadgeRow}>
              {isPremium && (
                <View style={styles.digitalMiniBadgeGold}>
                  <Text style={styles.digitalMiniBadgeGoldText}>PREMIUM</Text>
                </View>
              )}
              {verified && (
                <View style={styles.digitalMiniBadgeGreen}>
                  <Feather name="check" size={10} color="#2ecc71" style={{ marginRight: 2 }} />
                  <Text style={styles.digitalMiniBadgeGreenText}>OAB VERIFICADA</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Separator */}
        <View style={styles.digitalCardDivider} />

        {/* Contact fields */}
        <View style={styles.digitalCardContactList}>
          <View style={styles.digitalCardContactItem}>
            <Feather name="phone" size={14} color="#f5c853" style={styles.digitalCardContactIcon} />
            <Text style={styles.digitalCardContactText}>{phone || 'Celular não informado'}</Text>
          </View>
          
          <View style={styles.digitalCardContactItem}>
            <Feather name="mail" size={14} color="#f5c853" style={styles.digitalCardContactIcon} />
            <Text style={styles.digitalCardContactText}>{email || 'E-mail não informado'}</Text>
          </View>

          <View style={styles.digitalCardContactItem}>
            <Feather name="clock" size={14} color="#f5c853" style={styles.digitalCardContactIcon} />
            <Text style={styles.digitalCardContactText}>
              {consulta === 'Gratuita' ? 'Consulta Gratuita' : `${tempo} - ${formatMoney(valor)}`}
            </Text>
          </View>
        </View>

        {/* Presentation Bio */}
        {bio ? (
          <View style={styles.digitalCardBioBox}>
            <Text style={styles.digitalCardSectionTitle}>Apresentação</Text>
            <Text style={styles.digitalCardBioText} numberOfLines={4}>
              {bio}
            </Text>
          </View>
        ) : null}

        {/* Specialties Tags */}
        {selectedSpecialties.length > 0 ? (
          <View style={styles.digitalCardSpecsBox}>
            <Text style={styles.digitalCardSectionTitle}>Áreas de atuação</Text>
            <View style={styles.digitalCardTagsContainer}>
              {selectedSpecialties.map((spec) => (
                <View key={spec} style={styles.digitalCardTag}>
                  <Text style={styles.digitalCardTagText}>{spec}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ViewShot>

      {/* Share / Copy Text section */}
      <Text style={styles.shareSubtitle}>
        Use um resumo profissional pronto para WhatsApp, e-mail e redes:
      </Text>

      <View style={styles.shareTextBox}>
        <Text style={styles.shareTextTitle}>Novo perfil para compartilhar</Text>
        <Text style={styles.shareTextDesc}>
          Esse conteúdo resume seu perfil e pode ser enviado para potenciais clientes com estilo manual:
        </Text>
        
        <ViewShot ref={shareRef} options={{ format: 'png', quality: 0.95 }} style={styles.sharePreviewContainer}>
          <Text style={styles.sharePreviewText}>
            {name || 'Nome'}{' | '}{'SocialJurídico'}{'\n'}
            OAB: {oab || '------'} ({estado || 'UF'}){'\n'}
            Especialidades: {selectedSpecialties.length > 0 ? selectedSpecialties.join(', ') : 'Não informado'}{'\n'}
            Atendimento: {consulta === 'Gratuita' ? 'Consulta Gratuita' : `${tempo} - ${formatMoney(valor)}`}{'\n'}
            Contato: {phone || 'Não informado'}{'\n'}
            {bio ? bio.slice(0, 120) + (bio.length > 120 ? '...' : '') : 'Apresentação...'}
          </Text>
        </ViewShot>

        <TouchableOpacity
          style={styles.copyBtn}
          onPress={handleCopyText}
          activeOpacity={0.8}
        >
          <Feather name="copy" size={14} color="#f5c853" style={{ marginRight: 6 }} />
          <Text style={styles.copyBtnText}>Copiar texto</Text>
        </TouchableOpacity>

        <View style={styles.shareActionsRow}>
          <TouchableOpacity
            style={[styles.shareActionBtn, { marginRight: 8 }]}
            onPress={() => handleDownloadImage(shareRef, 'Resumo do Perfil')}
            activeOpacity={0.8}
          >
            <Feather name="download" size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.shareActionBtnText}>Baixar Imagem</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareActionBtn, styles.shareActionBtnGold]}
            onPress={handleShareText}
            activeOpacity={0.8}
          >
            <Feather name="share-2" size={14} color="#0d0f12" style={{ marginRight: 6 }} />
            <Text style={styles.shareActionBtnGoldText}>Compartilhar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 6. Conversion tips list */}
      <View style={styles.conversionBox}>
        <Text style={styles.conversionTitle}>Checklist de conversão</Text>
        
        <View style={styles.conversionItem}>
          <Feather name="check" size={14} color="#2ecc71" style={styles.conversionIcon} />
          <Text style={styles.conversionText}>
            Adicione foto profissional para aumentar confiança.
          </Text>
        </View>

        <View style={styles.conversionItem}>
          <Feather name="check" size={14} color="#2ecc71" style={styles.conversionIcon} />
          <Text style={styles.conversionText}>
            Cadastre biografia curta com foco na sua especialidade.
          </Text>
        </View>

        <View style={styles.conversionItem}>
          <Feather name="check" size={14} color="#2ecc71" style={styles.conversionIcon} />
          <Text style={styles.conversionText}>
            Defina consulta gratuita ou informe tempo e valor.
          </Text>
        </View>

        <View style={styles.conversionItem}>
          <Feather name="check" size={14} color="#2ecc71" style={styles.conversionIcon} />
          <Text style={styles.conversionText}>
            Complete áreas de atuação para aparecer melhor nas buscas.
          </Text>
        </View>
      </View>

      {/* Cartão Digital Bottom Banner actions */}
      <View style={styles.bottomBannerBox}>
        <Text style={styles.bottomBannerTitle}>CARTÃO DIGITAL</Text>
        <View style={styles.shareActionsRow}>
          <TouchableOpacity
            style={[styles.bottomBtn, { marginRight: 8 }]}
            onPress={() => handleDownloadImage(cardRef, 'Cartão de Visitas Digital')}
            activeOpacity={0.8}
          >
            <Feather name="download" size={16} color="#a0a5b0" style={{ marginRight: 6 }} />
            <Text style={styles.bottomBtnText}>Baixar Imagem</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={handleShareText}
            activeOpacity={0.8}
          >
            <Feather name="share-2" size={16} color="#a0a5b0" style={{ marginRight: 6 }} />
            <Text style={styles.bottomBtnText}>Compartilhar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Save Button */}
      <TouchableOpacity
        style={styles.saveProfileBtn}
        onPress={handleSaveProfile}
        disabled={saving}
        activeOpacity={0.9}
      >
        {saving ? (
          <ActivityIndicator color="#0d0f12" />
        ) : (
          <>
            <Feather name="save" size={18} color="#0d0f12" style={{ marginRight: 8 }} />
            <Text style={styles.saveProfileBtnText}>Salvar Perfil Profissional</Text>
          </>
        )}
      </TouchableOpacity>

      {/* --- UF Modal --- */}
      <Modal visible={showUfModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione o Estado (UF)</Text>
              <TouchableOpacity onPress={() => setShowUfModal(false)}>
                <Feather name="x" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {UF_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.modalItem, estado === item.value && styles.modalItemActive]}
                  onPress={() => {
                    setEstado(item.value);
                    setShowUfModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, estado === item.value && styles.modalItemTextActive]}>
                    {item.label}
                  </Text>
                  {estado === item.value && <Feather name="check" size={18} color="#f5c853" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- Duration Modal --- */}
      <Modal visible={showDurationModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tempo de Consulta</Text>
              <TouchableOpacity onPress={() => setShowDurationModal(false)}>
                <Feather name="x" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {DURATION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.modalItem, tempo === opt && styles.modalItemActive]}
                  onPress={() => {
                    setTempo(opt);
                    setShowDurationModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, tempo === opt && styles.modalItemTextActive]}>
                    {opt}
                  </Text>
                  {tempo === opt && <Feather name="check" size={18} color="#f5c853" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- Password Modal --- */}
      <Modal visible={showPasswordModal} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Alterar Senha da Conta</Text>
            <Text style={styles.alertDesc}>
              Digite a nova senha para acessar a plataforma SocialJurídico.
            </Text>

            <Text style={styles.alertLabel}>NOVA SENHA</Text>
            <View style={styles.alertInputContainer}>
              <TextInput
                style={styles.alertInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#505560"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.alertLabel}>CONFIRMAR SENHA</Text>
            <View style={styles.alertInputContainer}>
              <TextInput
                style={styles.alertInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a nova senha"
                placeholderTextColor="#505560"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.alertBtnRow}>
              <TouchableOpacity
                style={[styles.alertBtn, styles.alertBtnCancel]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={updatingPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.alertBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.alertBtn, styles.alertBtnConfirm]}
                onPress={handleUpdatePassword}
                disabled={updatingPassword}
                activeOpacity={0.8}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#0d0f12" />
                ) : (
                  <Text style={styles.alertBtnConfirmText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a0d',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#090a0d',
  },
  loadingText: {
    color: '#a0a5b0',
    marginTop: 12,
    fontSize: 14,
  },
  profileHeaderBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarBorder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#f5c853',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  avatarFallback: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#16191f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: '#f5c853',
    fontSize: 32,
    fontWeight: 'bold',
  },
  lawyerName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.2,
    marginHorizontal: 4,
  },
  badgePremium: {
    borderColor: '#f5c853',
    backgroundColor: 'rgba(245, 200, 83, 0.08)',
  },
  badgePremiumText: {
    color: '#f5c853',
    fontSize: 11,
    fontWeight: 'bold',
  },
  badgeVerified: {
    borderColor: '#2ecc71',
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeVerifiedText: {
    color: '#2ecc71',
    fontSize: 11,
    fontWeight: 'bold',
  },
  accountDataBox: {
    width: '100%',
    backgroundColor: '#12141c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f222b',
    padding: 16,
    marginTop: 20,
  },
  accountDataTitle: {
    color: '#a0a5b0',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  accountDataEmail: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 12,
  },
  accountResetBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#ff4d4d',
    borderRadius: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 77, 77, 0.04)',
  },
  accountResetBtnText: {
    color: '#ff4d4d',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    color: '#f5c853',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#12141c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f222b',
    padding: 16,
    marginBottom: 12,
  },
  label: {
    color: '#a0a5b0',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  labelLimitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitText: {
    color: '#606672',
    fontSize: 11,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#090a0d',
    borderColor: '#242833',
    borderWidth: 1.2,
    borderRadius: 6,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 14,
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
  textAreaContainer: {
    height: 100,
    paddingVertical: 8,
  },
  textArea: {
    height: '100%',
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10,
  },
  specialtyCard: {
    width: '48%',
    backgroundColor: '#090a0d',
    borderWidth: 1,
    borderColor: '#242833',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  specialtyCardActive: {
    borderColor: '#f5c853',
    backgroundColor: 'rgba(245, 200, 83, 0.06)',
  },
  specialtyText: {
    color: '#808694',
    fontSize: 13,
  },
  specialtyTextActive: {
    color: '#f5c853',
    fontWeight: 'bold',
  },
  consultaToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#090a0d',
    borderWidth: 1.2,
    borderColor: '#242833',
    borderRadius: 6,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  toggleBtnActive: {
    borderColor: '#f5c853',
    backgroundColor: 'rgba(245, 200, 83, 0.06)',
  },
  toggleBtnText: {
    color: '#808694',
    fontSize: 13,
    fontWeight: 'bold',
  },
  toggleBtnTextActive: {
    color: '#f5c853',
  },
  digitalCardBox: {
    backgroundColor: '#12141c',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f5c853',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#f5c853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  digitalCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  digitalCardAvatarBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: '#f5c853',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitalCardAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  digitalCardAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#090a0d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitalCardAvatarFallbackText: {
    color: '#f5c853',
    fontSize: 22,
    fontWeight: 'bold',
  },
  digitalCardTopInfo: {
    marginLeft: 14,
    flex: 1,
  },
  digitalCardSubtitle: {
    color: '#f5c853',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  digitalCardName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  digitalCardOab: {
    color: '#808694',
    fontSize: 12,
    marginTop: 1,
  },
  digitalCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  digitalMiniBadgeGold: {
    borderColor: '#f5c853',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(245, 200, 83, 0.05)',
    marginRight: 6,
  },
  digitalMiniBadgeGoldText: {
    color: '#f5c853',
    fontSize: 9,
    fontWeight: 'bold',
  },
  digitalMiniBadgeGreen: {
    borderColor: '#2ecc71',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(46, 204, 113, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  digitalMiniBadgeGreenText: {
    color: '#2ecc71',
    fontSize: 9,
    fontWeight: 'bold',
  },
  digitalCardDivider: {
    height: 1,
    backgroundColor: '#1f222b',
    marginVertical: 14,
  },
  digitalCardContactList: {
    marginBottom: 10,
  },
  digitalCardContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  digitalCardContactIcon: {
    width: 20,
    textAlign: 'center',
    marginRight: 8,
  },
  digitalCardContactText: {
    color: '#e2e4e9',
    fontSize: 13,
  },
  digitalCardSectionTitle: {
    color: '#a0a5b0',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  digitalCardBioBox: {
    marginTop: 8,
  },
  digitalCardBioText: {
    color: '#b0b5c1',
    fontSize: 13,
    lineHeight: 18,
  },
  digitalCardSpecsBox: {
    marginTop: 12,
  },
  digitalCardTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  digitalCardTag: {
    backgroundColor: '#1a1d26',
    borderWidth: 1,
    borderColor: '#2c313c',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  digitalCardTagText: {
    color: '#f5c853',
    fontSize: 11,
  },
  shareSubtitle: {
    color: '#a0a5b0',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  shareTextBox: {
    backgroundColor: '#12141c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f222b',
    padding: 16,
    marginBottom: 20,
  },
  shareTextTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  shareTextDesc: {
    color: '#808694',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  sharePreviewContainer: {
    backgroundColor: '#090a0d',
    borderColor: '#1f222b',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  sharePreviewText: {
    color: '#b0b5c1',
    fontSize: 12,
    lineHeight: 18,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2b2512',
    borderWidth: 1.2,
    borderColor: '#f5c853',
    borderRadius: 6,
    paddingVertical: 10,
    marginBottom: 12,
  },
  copyBtnText: {
    color: '#f5c853',
    fontSize: 13,
    fontWeight: 'bold',
  },
  shareActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f222b',
    borderWidth: 1,
    borderColor: '#2d313d',
    borderRadius: 6,
    paddingVertical: 10,
  },
  shareActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  shareActionBtnGold: {
    backgroundColor: '#f5c853',
    borderColor: '#f5c853',
  },
  shareActionBtnGoldText: {
    color: '#0d0f12',
    fontSize: 13,
    fontWeight: 'bold',
  },
  conversionBox: {
    backgroundColor: '#12141c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f222b',
    padding: 16,
    marginBottom: 20,
  },
  conversionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  conversionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  conversionIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  conversionText: {
    flex: 1,
    color: '#a0a5b0',
    fontSize: 13,
    lineHeight: 17,
  },
  bottomBannerBox: {
    backgroundColor: '#12141c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f222b',
    padding: 16,
    marginBottom: 24,
  },
  bottomBannerTitle: {
    color: '#f5c853',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#2c313c',
    borderRadius: 6,
    paddingVertical: 10,
    backgroundColor: '#090a0d',
  },
  bottomBtnText: {
    color: '#a0a5b0',
    fontSize: 13,
    fontWeight: 'bold',
  },
  saveProfileBtn: {
    backgroundColor: '#f5c853',
    borderRadius: 8,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5c853',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  saveProfileBtnText: {
    color: '#0d0f12',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Dropdown list Custom Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#12141c',
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
    borderColor: '#1f222b',
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
  // Popups/Alert Modals styling
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  alertContent: {
    backgroundColor: '#12141c',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#1f222b',
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertDesc: {
    fontSize: 13,
    color: '#a0a5b0',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  alertLabel: {
    color: '#f5c853',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  alertInputContainer: {
    backgroundColor: '#090a0d',
    borderColor: '#242833',
    borderWidth: 1.2,
    borderRadius: 6,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  alertInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  alertBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  alertBtn: {
    flex: 1,
    height: 42,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBtnCancel: {
    borderWidth: 1.2,
    borderColor: '#2c313c',
    marginRight: 8,
    backgroundColor: '#090a0d',
  },
  alertBtnCancelText: {
    color: '#a0a5b0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertBtnConfirm: {
    backgroundColor: '#f5c853',
    marginLeft: 8,
  },
  alertBtnConfirmText: {
    color: '#0d0f12',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
