/**
 * LawyerCalculadoraScreen.js — Calculadora Jurídica (Exclusivo PRO)
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

const TOOLS = [
  { id: 'honorarios', label: 'Honorários', icon: 'percent', desc: 'Calcule seus honorários por valor da causa' },
  { id: 'juros', label: 'Juros', icon: 'trending-up', desc: 'Juros simples e compostos sobre dívidas' },
  { id: 'custas', label: 'Custas Processuais', icon: 'file-text', desc: 'Estimativa de custas por Estado' },
  { id: 'correcao', label: 'Correção Monetária', icon: 'activity', desc: 'IPCA/IGP-M sobre valores atrasados' },
];

function formatBRL(value) {
  const num = parseFloat(value.replace(/\D/g, '')) / 100;
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(str) {
  return parseFloat(str.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
}

// --- CALCULADORA DE HONORÁRIOS ---
function CalculadoraHonorarios() {
  const [valorCausa, setValorCausa] = useState('');
  const [percentual, setPercentual] = useState('20');
  const [resultado, setResultado] = useState(null);

  const calcular = () => {
    const val = parseBRL(valorCausa);
    const pct = parseFloat(percentual.replace(',', '.')) || 0;
    if (val <= 0 || pct <= 0) {
      Alert.alert('Atenção', 'Preencha o valor da causa e o percentual de honorários.');
      return;
    }
    const honorarios = (val * pct) / 100;
    setResultado({ honorarios, valorCausa: val, percentual: pct });
  };

  return (
    <View style={s.toolBody}>
      <Text style={s.fieldLabel}>Valor da Causa (R$)</Text>
      <TextInput
        style={s.input}
        value={valorCausa}
        onChangeText={setValorCausa}
        placeholder="Ex.: R$ 50.000,00"
        placeholderTextColor="#505565"
        keyboardType="numeric"
      />
      <Text style={s.fieldLabel}>Percentual de Honorários (%)</Text>
      <TextInput
        style={s.input}
        value={percentual}
        onChangeText={setPercentual}
        placeholder="Ex.: 20"
        placeholderTextColor="#505565"
        keyboardType="numeric"
      />
      <TouchableOpacity style={s.calcBtn} onPress={calcular}>
        <Text style={s.calcBtnText}>Calcular</Text>
      </TouchableOpacity>
      {resultado && (
        <View style={s.resultBox}>
          <Text style={s.resultLabel}>Valor da Causa</Text>
          <Text style={s.resultValue}>
            {resultado.valorCausa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
          <View style={s.resultDivider} />
          <Text style={s.resultLabel}>Honorários ({resultado.percentual}%)</Text>
          <Text style={[s.resultValue, { color: '#f5c853', fontSize: 26 }]}>
            {resultado.honorarios.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
        </View>
      )}
    </View>
  );
}

// --- CALCULADORA DE JUROS ---
function CalculadoraJuros() {
  const [capital, setCapital] = useState('');
  const [taxa, setTaxa] = useState('');
  const [meses, setMeses] = useState('');
  const [tipo, setTipo] = useState('simples');
  const [resultado, setResultado] = useState(null);

  const calcular = () => {
    const C = parseBRL(capital);
    const i = parseFloat(taxa.replace(',', '.')) / 100;
    const n = parseInt(meses, 10);
    if (C <= 0 || i <= 0 || n <= 0) {
      Alert.alert('Atenção', 'Preencha todos os campos corretamente.');
      return;
    }
    let montante, juros;
    if (tipo === 'simples') {
      juros = C * i * n;
      montante = C + juros;
    } else {
      montante = C * Math.pow(1 + i, n);
      juros = montante - C;
    }
    setResultado({ capital: C, montante, juros, tipo });
  };

  return (
    <View style={s.toolBody}>
      <View style={s.segmentRow}>
        <TouchableOpacity
          style={[s.segmentBtn, tipo === 'simples' && s.segmentBtnActive]}
          onPress={() => setTipo('simples')}
        >
          <Text style={[s.segmentText, tipo === 'simples' && s.segmentTextActive]}>Simples</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.segmentBtn, tipo === 'composto' && s.segmentBtnActive]}
          onPress={() => setTipo('composto')}
        >
          <Text style={[s.segmentText, tipo === 'composto' && s.segmentTextActive]}>Composto</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.fieldLabel}>Capital Inicial (R$)</Text>
      <TextInput style={s.input} value={capital} onChangeText={setCapital} placeholder="Ex.: R$ 10.000,00" placeholderTextColor="#505565" keyboardType="numeric" />
      <Text style={s.fieldLabel}>Taxa Mensal (%)</Text>
      <TextInput style={s.input} value={taxa} onChangeText={setTaxa} placeholder="Ex.: 1,5" placeholderTextColor="#505565" keyboardType="numeric" />
      <Text style={s.fieldLabel}>Período (meses)</Text>
      <TextInput style={s.input} value={meses} onChangeText={setMeses} placeholder="Ex.: 24" placeholderTextColor="#505565" keyboardType="numeric" />
      <TouchableOpacity style={s.calcBtn} onPress={calcular}>
        <Text style={s.calcBtnText}>Calcular</Text>
      </TouchableOpacity>
      {resultado && (
        <View style={s.resultBox}>
          <Text style={s.resultLabel}>Capital</Text>
          <Text style={s.resultValue}>{resultado.capital.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
          <Text style={s.resultLabel}>Juros {resultado.tipo === 'simples' ? 'Simples' : 'Compostos'}</Text>
          <Text style={s.resultValue}>{resultado.juros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
          <View style={s.resultDivider} />
          <Text style={s.resultLabel}>Montante Final</Text>
          <Text style={[s.resultValue, { color: '#f5c853', fontSize: 26 }]}>{resultado.montante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
        </View>
      )}
    </View>
  );
}

// --- CALCULADORA DE CUSTAS ---
function CalculadoraCustas() {
  const [valorCausa, setValorCausa] = useState('');
  const [resultado, setResultado] = useState(null);

  const calcular = () => {
    const val = parseBRL(valorCausa);
    if (val <= 0) {
      Alert.alert('Atenção', 'Informe o valor da causa.');
      return;
    }
    // Estimativa média: 2% do valor da causa (varia por estado)
    const custas = val * 0.02;
    const intimacao = 15.60;
    const citacao = 12.20;
    setResultado({ val, custas, intimacao, citacao, total: custas + intimacao + citacao });
  };

  return (
    <View style={s.toolBody}>
      <View style={s.infoBox}>
        <Feather name="info" size={14} color="#f5c853" style={{ marginRight: 6 }} />
        <Text style={s.infoText}>Estimativa baseada em média nacional (2%). Valores variam por Estado.</Text>
      </View>
      <Text style={s.fieldLabel}>Valor da Causa (R$)</Text>
      <TextInput style={s.input} value={valorCausa} onChangeText={setValorCausa} placeholder="Ex.: R$ 25.000,00" placeholderTextColor="#505565" keyboardType="numeric" />
      <TouchableOpacity style={s.calcBtn} onPress={calcular}>
        <Text style={s.calcBtnText}>Calcular</Text>
      </TouchableOpacity>
      {resultado && (
        <View style={s.resultBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={s.resultLabel}>Taxa Judicial (~2%)</Text>
            <Text style={s.resultValue}>{resultado.custas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={s.resultLabel}>Intimação</Text>
            <Text style={s.resultValue}>R$ 15,60</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={s.resultLabel}>Citação</Text>
            <Text style={s.resultValue}>R$ 12,20</Text>
          </View>
          <View style={s.resultDivider} />
          <Text style={s.resultLabel}>Total Estimado</Text>
          <Text style={[s.resultValue, { color: '#f5c853', fontSize: 26 }]}>{resultado.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
        </View>
      )}
    </View>
  );
}

// --- CALCULADORA DE CORREÇÃO MONETÁRIA ---
function CalculadoraCorrecao() {
  const [valor, setValor] = useState('');
  const [anos, setAnos] = useState('');
  const [indice, setIndice] = useState('IPCA');
  const [resultado, setResultado] = useState(null);

  // Taxas médias históricas aproximadas
  const TAXAS = { IPCA: 0.05, 'IGP-M': 0.08, INPC: 0.048 };

  const calcular = () => {
    const val = parseBRL(valor);
    const n = parseFloat(anos.replace(',', '.'));
    const taxa = TAXAS[indice] || 0.05;
    if (val <= 0 || n <= 0) {
      Alert.alert('Atenção', 'Preencha o valor e o período.');
      return;
    }
    const corrigido = val * Math.pow(1 + taxa, n);
    setResultado({ val, corrigido, diferenca: corrigido - val, indice, anos: n, taxa: taxa * 100 });
  };

  return (
    <View style={s.toolBody}>
      <View style={s.segmentRow}>
        {['IPCA', 'IGP-M', 'INPC'].map(idx => (
          <TouchableOpacity
            key={idx}
            style={[s.segmentBtn, indice === idx && s.segmentBtnActive]}
            onPress={() => setIndice(idx)}
          >
            <Text style={[s.segmentText, indice === idx && s.segmentTextActive]}>{idx}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.fieldLabel}>Valor Original (R$)</Text>
      <TextInput style={s.input} value={valor} onChangeText={setValor} placeholder="Ex.: R$ 8.000,00" placeholderTextColor="#505565" keyboardType="numeric" />
      <Text style={s.fieldLabel}>Período (anos)</Text>
      <TextInput style={s.input} value={anos} onChangeText={setAnos} placeholder="Ex.: 3" placeholderTextColor="#505565" keyboardType="numeric" />
      <View style={s.infoBox}>
        <Feather name="info" size={14} color="#f5c853" style={{ marginRight: 6 }} />
        <Text style={s.infoText}>{indice}: ~{(TAXAS[indice] * 100).toFixed(1)}% a.a. (média histórica aproximada)</Text>
      </View>
      <TouchableOpacity style={s.calcBtn} onPress={calcular}>
        <Text style={s.calcBtnText}>Calcular</Text>
      </TouchableOpacity>
      {resultado && (
        <View style={s.resultBox}>
          <Text style={s.resultLabel}>Valor Original</Text>
          <Text style={s.resultValue}>{resultado.val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
          <Text style={s.resultLabel}>Correção pelo {resultado.indice} ({resultado.anos} anos)</Text>
          <Text style={s.resultValue}>{resultado.diferenca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
          <View style={s.resultDivider} />
          <Text style={s.resultLabel}>Valor Corrigido</Text>
          <Text style={[s.resultValue, { color: '#f5c853', fontSize: 26 }]}>{resultado.corrigido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
        </View>
      )}
    </View>
  );
}

const TOOL_COMPONENTS = {
  honorarios: CalculadoraHonorarios,
  juros: CalculadoraJuros,
  custas: CalculadoraCustas,
  correcao: CalculadoraCorrecao,
};

export default function LawyerCalculadoraScreen({ route, navigation }) {
  const [activeTool, setActiveTool] = useState('honorarios');
  const ActiveComponent = TOOL_COMPONENTS[activeTool];

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090a0d" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#f5c853" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Calculadora Jurídica</Text>
          <Text style={s.headerSub}>Plano PRO</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Tool Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.toolTabs} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {TOOLS.map(tool => (
          <TouchableOpacity
            key={tool.id}
            style={[s.toolTab, activeTool === tool.id && s.toolTabActive]}
            onPress={() => setActiveTool(tool.id)}
          >
            <Feather name={tool.icon} size={14} color={activeTool === tool.id ? '#090a0d' : '#a0a5b0'} style={{ marginRight: 6 }} />
            <Text style={[s.toolTabText, activeTool === tool.id && s.toolTabTextActive]}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Description */}
      <View style={s.toolDescBox}>
        <Text style={s.toolDescText}>{TOOLS.find(t => t.id === activeTool)?.desc}</Text>
      </View>

      {/* Active Tool */}
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <ActiveComponent />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#090a0d' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a1d24',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#f5c853', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  toolTabs: { maxHeight: 50, marginVertical: 12 },
  toolTab: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20242e',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
  },
  toolTabActive: { backgroundColor: '#f5c853', borderColor: '#f5c853' },
  toolTabText: { color: '#a0a5b0', fontSize: 13, fontWeight: '600' },
  toolTabTextActive: { color: '#090a0d' },
  toolDescBox: { paddingHorizontal: 20, marginBottom: 8 },
  toolDescText: { color: '#8e94a2', fontSize: 13 },
  toolBody: { paddingHorizontal: 20, paddingTop: 8 },
  fieldLabel: { color: '#d0d4df', fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20242e',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 16,
  },
  calcBtn: {
    backgroundColor: '#f5c853', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  calcBtnText: { color: '#090a0d', fontSize: 15, fontWeight: 'bold' },
  resultBox: {
    backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20242e',
    borderRadius: 12, padding: 20, marginTop: 20,
  },
  resultLabel: { color: '#8e94a2', fontSize: 12, marginBottom: 2 },
  resultValue: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  resultDivider: { height: 1, backgroundColor: '#20242e', marginVertical: 12 },
  segmentRow: { flexDirection: 'row', marginBottom: 4 },
  segmentBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20242e',
    borderRadius: 8, marginRight: 8,
  },
  segmentBtnActive: { backgroundColor: '#f5c853', borderColor: '#f5c853' },
  segmentText: { color: '#a0a5b0', fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#090a0d' },
  infoBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(245,200,83,0.08)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 10,
  },
  infoText: { color: '#d0c070', fontSize: 12, flex: 1 },
});
