import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function MarketplaceTab({ lawyerProfile, openCases, activeCases, refreshControl, onPlanPress, onJurisPress, onManifestInterest }) {
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
      
      {/* Header Info */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>Bem-vindo, {lawyerProfile?.name ? `Dr. ${lawyerProfile.name.split(' ')[0]}` : 'Advogado'}</Text>
        <Text style={styles.dashboardTitle}>Dashboard Geral</Text>
        
        {lawyerProfile?.oab_verification_status === 'VERIFIED' && (
          <View style={styles.oabBadge}>
            <Feather name="check-circle" size={12} color="#39d353" />
            <Text style={styles.oabBadgeText}>OAB VERIFICADO (CNA)</Text>
          </View>
        )}
      </View>
 
      {/* Cards de Status */}
      <View style={styles.statusCardsRow}>
        
        {/* Plano Atual */}
        <TouchableOpacity style={styles.statusCard} activeOpacity={0.7} onPress={onPlanPress}>
          <View style={styles.planIconBox}>
            <Feather name="award" size={24} color="#f5c853" />
          </View>
          <View style={styles.planInfo}>
            <Text style={styles.cardLabel}>PLANO ATUAL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.planTitle}>
                {lawyerProfile?.plan_type === 'PRO'
                  ? 'PRO'
                  : lawyerProfile?.plan_type === 'START'
                  ? 'START'
                  : 'FREE'}
              </Text>
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineBadgeText}>ONLINE</Text>
              </View>
            </View>
            <Text style={styles.planSubtitle}>
              {lawyerProfile?.plan_type === 'PRO'
                ? 'SHA-256 | Blindagem Ilimitada'
                : lawyerProfile?.plan_type === 'START'
                ? 'CRM + Agenda + Redator IA'
                : 'Marketplace de Casos'}
            </Text>
          </View>
        </TouchableOpacity>
 
        {/* Saldo Juris */}
        <TouchableOpacity style={styles.saldoCard} activeOpacity={0.7} onPress={onJurisPress}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="credit-card" size={20} color="#f5c853" style={{ marginRight: 10 }} />
            <View>
              <Text style={styles.cardLabel}>SEU SALDO</Text>
              <Text style={styles.saldoTitle}>{lawyerProfile?.juris_balance || 0} Juris</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Marketplace de Casos */}
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="storefront-outline" size={22} color="#f5c853" style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>Marketplace de{'\n'}Casos</Text>
        </View>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.seeAllText}>Ver todas{'\n'}oportunidades</Text>
          <Feather name="arrow-right" size={14} color="#f5c853" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Lista de Oportunidades */}
      {openCases.map((item, index) => (
        <View key={item.id || index} style={styles.caseCard}>
          <View style={styles.caseCardHeader}>
            <View style={[styles.tag, item.tagColor && { backgroundColor: item.tagColor }]}>
              <Text style={[styles.tagText, item.tagTextColor && { color: item.tagTextColor }]}>{item.tag || 'GERAL'}</Text>
            </View>
            <Text style={styles.caseTime}>{item.time || 'Recente'}</Text>
          </View>
          <Text style={styles.caseTitle}>{item.title}</Text>
          <Text style={styles.caseLocation}>{item.location}</Text>
          <Text style={styles.caseDesc} numberOfLines={3}>{item.description}</Text>
          
          <View style={styles.caseCardFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="scale-balance" size={14} color="#f5c853" />
              <Text style={styles.jurisCostText}>{item.cost || 1} Juri{item.cost > 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity 
              style={styles.manifestBtn}
              onPress={() => onManifestInterest && onManifestInterest(item)}
            >
              <Text style={styles.manifestBtnText}>Manifestar Interesse</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Meus Casos (Últimos Processos) */}
      <View style={styles.sectionWrapperDark}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleSmall}>ÚLTIMOS PROCESSOS (MEUS CASOS)</Text>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.seeAllText}>Ver todos</Text>
            <Feather name="arrow-right" size={14} color="#f5c853" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {activeCases.map((proc, index) => (
          <TouchableOpacity key={proc.id || index} style={styles.processCard} activeOpacity={0.8}>
            <View style={styles.processIconBox}>
              {proc.iconType === 'family' ? (
                <Feather name="users" size={20} color="#a0a5b0" />
              ) : proc.iconType === 'doc' ? (
                <Feather name="file-text" size={20} color="#a0a5b0" />
              ) : (
                <MaterialCommunityIcons name="gavel" size={20} color="#a0a5b0" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.processNumber}>{proc.number}</Text>
              <Text style={styles.processDesc}>{proc.type} • Cliente: {proc.client}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greetingSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  greetingText: {
    color: '#e2e4e9',
    fontSize: 14,
    marginBottom: 4,
  },
  dashboardTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  oabBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oabBadgeText: {
    color: '#39d353',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  statusCardsRow: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statusCard: {
    flexDirection: 'row',
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#3a341e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  planIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1c22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planInfo: {
    flex: 1,
  },
  cardLabel: {
    color: '#f5c853',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  planTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8,
  },
  onlineBadge: {
    backgroundColor: 'rgba(57, 211, 83, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  onlineBadgeText: {
    color: '#39d353',
    fontSize: 9,
    fontWeight: 'bold',
  },
  planSubtitle: {
    color: '#8e94a2',
    fontSize: 11,
    marginTop: 4,
  },
  saldoCard: {
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#3a341e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saldoTitle: {
    color: '#f5c853',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  sectionTitleSmall: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  seeAllText: {
    color: '#f5c853',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  caseCard: {
    backgroundColor: '#16191f',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  caseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: 'rgba(245, 200, 83, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 83, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: '#f5c853',
    fontSize: 10,
    fontWeight: 'bold',
  },
  caseTime: {
    color: '#e2e4e9',
    fontSize: 12,
  },
  caseTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  caseLocation: {
    color: '#8e94a2',
    fontSize: 12,
    marginBottom: 12,
  },
  caseDesc: {
    color: '#a0a5b0',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  caseCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#20242e',
    paddingTop: 16,
  },
  jurisCostText: {
    color: '#f5c853',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  manifestBtn: {
    backgroundColor: '#f5c853',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  manifestBtnText: {
    color: '#090a0d',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sectionWrapperDark: {
    backgroundColor: '#13151b',
    paddingVertical: 24,
    marginTop: 16,
  },
  processCard: {
    flexDirection: 'row',
    backgroundColor: '#0d0f12',
    borderWidth: 1,
    borderColor: '#20242e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  processIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1a1d24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  processNumber: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  processDesc: {
    color: '#a0a5b0',
    fontSize: 12,
  }
});
