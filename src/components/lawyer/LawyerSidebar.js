import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function LawyerSidebar({ visible, onClose, lawyerProfile = {}, navigation, onLogout, user, session, setCurrentTab, onPlanPress, onJurisPress }) {
  
  const isFree = lawyerProfile.plan_type === 'FREE';
  const isStart = lawyerProfile.plan_type === 'START';

  const checkFreeAccess = (featureName, callback) => {
    if (isFree) {
      onPlanPress(`A ferramenta "${featureName}" é exclusiva para assinantes dos planos START e PRO.\n\nGerencie sua assinatura no portal web para liberar o acesso.`);
      return;
    }
    callback();
  };

  const handleNotImplemented = (featureName) => {
    Alert.alert('Recurso Web', `A ferramenta "${featureName}" está disponível exclusivamente no painel Web do SocialJurídico.`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sidebarContainer}>
          
          {/* Header da Sidebar */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="scale-balance" size={14} color="#f5c853" />
              </View>
              <View>
                <Text style={styles.logoText}>Social<Text style={styles.logoGold}>Jurídico</Text></Text>
                <Text style={styles.logoSubtitle}>ADVOGADO</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#8e94a2" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Perfil Simplificado */}
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {lawyerProfile.name ? lawyerProfile.name.substring(0, 2).toUpperCase() : 'AD'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{lawyerProfile.name || 'Advogado'}</Text>
                <TouchableOpacity style={styles.proBadge} activeOpacity={0.7} onPress={() => onPlanPress()}>
                  <Feather name="star" size={10} color="#090a0d" />
                  <Text style={styles.proBadgeText}>Plano {lawyerProfile.plan_type || 'FREE'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Saldo Section */}
            <TouchableOpacity style={styles.saldoBox} activeOpacity={0.7} onPress={onJurisPress}>
              <Text style={styles.saldoLabel}>SALDO JURIS</Text>
              <Text style={styles.saldoValue}>{lawyerProfile.juris_balance || 0}</Text>
            </TouchableOpacity>

            {/* Ferramentas Menu */}
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>Ferramentas</Text>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                checkFreeAccess('Assinatura Digital', () => {
                  onClose();
                  navigation.navigate('LawyerDigitalSignature', { user, session });
                });
              }}>
                <Feather name="edit-3" size={20} color="#a0a5b0" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Assinatura Digital</Text>
                {isFree && <Feather name="lock" size={14} color="#8e94a2" style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                checkFreeAccess('CRM de Clientes', () => {
                  onClose();
                  if (setCurrentTab) setCurrentTab('CRM');
                });
              }}>
                <Feather name="users" size={20} color="#a0a5b0" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Meus Clientes (CRM)</Text>
                {isFree && <Feather name="lock" size={14} color="#8e94a2" style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                checkFreeAccess('Declarei Interesse', () => {
                  onClose();
                  navigation.navigate('LawyerInterests', { user, session });
                });
              }}>
                <Feather name="bookmark" size={20} color="#a0a5b0" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Declarei Interesse</Text>
                {isFree && <Feather name="lock" size={14} color="#8e94a2" style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                checkFreeAccess('Meus Casos', () => {
                  onClose();
                  navigation.navigate('LawyerCases', { user, session });
                });
              }}>
                <Feather name="briefcase" size={20} color="#a0a5b0" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Meus Casos</Text>
                {isFree && <Feather name="lock" size={14} color="#8e94a2" style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                checkFreeAccess('Blindagem de Provas', () => {
                  onClose();
                  navigation.navigate('LawyerBlindagemDashboard', { user, session });
                });
              }}>
                <Feather name="shield" size={20} color="#a0a5b0" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Blindagem de Provas</Text>
                {isFree && <Feather name="lock" size={14} color="#8e94a2" style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                checkFreeAccess('Agenda e Prazos', () => {
                  onClose();
                  navigation.navigate('LawyerAgenda', { user, session });
                });
              }}>
                <Feather name="calendar" size={20} color="#a0a5b0" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Agenda e Prazos</Text>
                {isFree && <Feather name="lock" size={14} color="#8e94a2" style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                if (isFree || isStart) {
                  onPlanPress('A "Calculadora Jurídica" é exclusiva para assinantes do Plano PRO.\n\nGerencie sua assinatura no portal web para liberar o acesso.');
                  return;
                }
                handleNotImplemented('Calculadora');
              }}>
                <Feather name="grid" size={20} color="#a0a5b0" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Calculadora</Text>
                {(isFree || isStart) && <Feather name="lock" size={14} color="#8e94a2" style={{ marginLeft: 'auto', opacity: 0.6 }} />}
              </TouchableOpacity>
            </View>

            {/* Recursos Web Box */}
            <View style={styles.webResourcesBox}>
              <View style={styles.webResourcesHeader}>
                <Feather name="monitor" size={18} color="#f5c853" style={{ marginRight: 8 }} />
                <Text style={styles.webResourcesTitle}>Recursos Web</Text>
              </View>
              <Text style={styles.webResourcesDesc}>
                As ferramentas IA SMART Docs, Redator IA, Triagem de Casos e Jurisprudência são exclusivas do painel Web.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Area */}
          <View style={styles.footerSection}>
            <TouchableOpacity style={styles.footerItem} onPress={() => {
              onClose();
              if (setCurrentTab) setCurrentTab('Perfil');
            }}>
              <Feather name="user" size={20} color="#a0a5b0" style={styles.menuIcon} />
              <Text style={styles.footerItemText}>Meu Perfil</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.footerItem} onPress={onLogout}>
              <Feather name="log-out" size={20} color="#e53e3e" style={styles.menuIcon} />
              <Text style={[styles.footerItemText, { color: '#e53e3e' }]}>Sair</Text>
            </TouchableOpacity>
          </View>

        </View>
        <TouchableOpacity style={styles.overlayClickable} onPress={onClose} activeOpacity={1} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sidebarContainer: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#0d0f12',
    height: '100%',
    paddingTop: 40, // Espaço da statusBar
    borderRightWidth: 1,
    borderRightColor: '#16191f',
  },
  overlayClickable: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d24',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 24,
    height: 24,
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#3a341e',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logoGold: {
    color: '#f5c853',
  },
  logoSubtitle: {
    color: '#f5c853',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16191f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#20242e',
  },
  avatarText: {
    color: '#f5c853',
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileInfo: {
    justifyContent: 'center',
  },
  profileName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5c853',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  proBadgeText: {
    color: '#090a0d',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  saldoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#16191f',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#20242e',
  },
  saldoLabel: {
    color: '#a0a5b0',
    fontSize: 12,
    letterSpacing: 1,
  },
  saldoValue: {
    color: '#f5c853',
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  menuSectionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIcon: {
    marginRight: 16,
  },
  menuItemText: {
    color: '#e2e4e9',
    fontSize: 15,
  },
  webResourcesBox: {
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#3a341e',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  webResourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  webResourcesTitle: {
    color: '#f5c853',
    fontSize: 14,
    fontWeight: 'bold',
  },
  webResourcesDesc: {
    color: '#a0a5b0',
    fontSize: 12,
    lineHeight: 18,
  },
  footerSection: {
    borderTopWidth: 1,
    borderTopColor: '#1a1d24',
    padding: 20,
    paddingBottom: 40,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerItemText: {
    color: '#a0a5b0',
    fontSize: 15,
  }
});
