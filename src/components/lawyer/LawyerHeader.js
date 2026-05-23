import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function LawyerHeader({ onMenuPress, onBellPress, jurisBalance = 0 }) {
  return (
    <View style={styles.header}>
      {/* Logo e Menu */}
      <TouchableOpacity 
        style={styles.logoContainer} 
        onPress={onMenuPress}
        activeOpacity={0.7}
      >
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="scale-balance" size={16} color="#f5c853" />
        </View>
        <Text style={styles.logoText}>Social<Text style={styles.logoGold}>Jurídico</Text></Text>
      </TouchableOpacity>

      {/* Saldo e Notificações */}
      <View style={styles.rightContainer}>
        <TouchableOpacity style={styles.jurisBadge} activeOpacity={0.8}>
          <Text style={styles.jurisText}>{jurisBalance} Juris</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7} onPress={onBellPress}>
          <Feather name="bell" size={20} color="#f5c853" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#090a0d',
    borderBottomWidth: 1,
    borderBottomColor: '#16191f',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 28,
    height: 28,
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#3a341e',
    borderRadius: 6,
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
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jurisBadge: {
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#3a341e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
  },
  jurisText: {
    color: '#f5c853',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bellBtn: {
    padding: 4,
  }
});
