import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function LawyerBottomTabBar({ currentTab, setCurrentTab }) {
  
  const TabButton = ({ name, iconName, isFeather, label }) => {
    const isActive = currentTab === name;
    const color = isActive ? '#f5c853' : '#a0a5b0';
    
    return (
      <TouchableOpacity 
        style={[styles.tabButton, isActive && styles.activeTabButton]} 
        onPress={() => setCurrentTab(name)}
        activeOpacity={0.7}
      >
        {isFeather ? (
          <Feather name={iconName} size={22} color={color} />
        ) : (
          <MaterialCommunityIcons name={iconName} size={22} color={color} />
        )}
        <Text style={[styles.tabLabel, { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.tabBar}>
      <TabButton name="Marketplace" iconName="storefront-outline" isFeather={false} label="Marketplace" />
      <TabButton name="CRM" iconName="users" isFeather={true} label="CRM" />
      <TabButton name="Mensagens" iconName="message-square" isFeather={true} label="Mensagens" />
      <TabButton name="Perfil" iconName="user" isFeather={true} label="Perfil" />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#0d0f12',
    borderTopWidth: 1,
    borderTopColor: '#1a1d24',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 4, // safe area padding
  },
  tabButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  activeTabButton: {
    borderTopColor: '#f5c853',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  }
});
