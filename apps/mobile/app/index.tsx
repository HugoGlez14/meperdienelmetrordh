import { useState } from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StationPicker } from '../src/components/StationPicker';
import {
  metroLines,
  metrobusLines,
  type RouteMode,
  type Transport
} from '@meperdienelmetro/core';
import { theme } from '../src/theme';

export default function HomeScreen(){
  const [transport,setTransport]=useState<Transport>('metro');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [mode,setMode]=useState<RouteMode>('fast');
  const lines=transport==='metro'?metroLines:metrobusLines;

  function changeTransport(next:Transport){
    setTransport(next);
    setFrom('');
    setTo('');
  }

  const sameStation=Boolean(from&&to&&from===to);
  const ready=Boolean(from&&to&&!sameStation);

  function search(){
    if(!ready) return;
    router.push({
      pathname:'/route',
      params:{transport,from,to,mode}
    });
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.brandRow}>
        <Text style={styles.brand}>meperdi<Text style={styles.brandLight}>enelmetro</Text><Text style={styles.dot}>.</Text></Text>
        <View style={styles.offlinePill}><Text style={styles.offlineText}>OFFLINE READY</Text></View>
      </View>

      <Text style={styles.eyebrow}>MENOS VUELTAS. MÁS CIUDAD.</Text>
      <Text style={styles.title}>Piérdete en la ciudad.{'\n'}<Text style={styles.titleAccent}>No en el transporte.</Text></Text>
      <Text style={styles.copy}>Planea tu recorrido incluso sin señal. Metro y Metrobús viven dentro de la app.</Text>

      <View style={styles.transportTabs}>
        <Pressable style={[styles.transportTab,transport==='metro'&&styles.transportTabActive]} onPress={()=>changeTransport('metro')}>
          <Text style={[styles.transportText,transport==='metro'&&styles.transportTextActive]}>🚇 Metro</Text>
        </Pressable>
        <Pressable style={[styles.transportTab,transport==='metrobus'&&styles.transportTabActive]} onPress={()=>changeTransport('metrobus')}>
          <Text style={[styles.transportText,transport==='metrobus'&&styles.transportTextActive]}>🚌 Metrobús</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>01 · PLANEA TU VIAJE</Text>
        <Text style={styles.cardTitle}>¿A dónde vamos?</Text>

        <StationPicker label="Estoy en" value={from} lines={lines} onChange={setFrom} placeholder="Selecciona tu origen" />
        <StationPicker label="Quiero ir a" value={to} lines={lines} onChange={setTo} placeholder="Selecciona tu destino" />
        {sameStation&&<Text style={styles.validationError}>El origen y el destino deben ser estaciones diferentes.</Text>}

        {transport==='metro'&&<>
          <Text style={styles.preferenceLabel}>Elige tu recorrido</Text>
          <View style={styles.preferences}>
            <Pressable style={[styles.preference,mode==='fast'&&styles.preferenceActive]} onPress={()=>setMode('fast')}>
              <Text style={[styles.preferenceText,mode==='fast'&&styles.preferenceTextActive]}>⚡ Menor tiempo</Text>
            </Pressable>
            <Pressable style={[styles.preference,mode==='transfers'&&styles.preferenceActive]} onPress={()=>setMode('transfers')}>
              <Text style={[styles.preferenceText,mode==='transfers'&&styles.preferenceTextActive]}>⇄ Menos cambios</Text>
            </Pressable>
          </View>
        </>}

        <Pressable disabled={!ready} style={[styles.searchButton,!ready&&styles.searchDisabled]} onPress={search}>
          <Text style={styles.searchText}>Encontrar mi ruta</Text>
          <Text style={styles.searchArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>📵</Text>
        <View style={styles.infoBody}>
          <Text style={styles.infoTitle}>Tu ruta no depende de internet.</Text>
          <Text style={styles.infoCopy}>El cálculo se ejecuta directamente en tu teléfono. Las funciones en vivo llegarán en fases posteriores.</Text>
        </View>
      </View>

      <Text style={styles.version}>V1 · FUNDACIÓN MÓVIL</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.colors.background},
  page:{padding:20,paddingBottom:48},
  brandRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:4,marginBottom:44,gap:12},
  brand:{fontSize:19,fontWeight:'900',color:theme.colors.text},
  brandLight:{fontWeight:'500'},
  dot:{color:theme.colors.accent},
  offlinePill:{backgroundColor:'#E5F4EC',paddingHorizontal:10,paddingVertical:6,borderRadius:99},
  offlineText:{fontSize:9,fontWeight:'900',letterSpacing:.8,color:theme.colors.success},
  eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:theme.colors.accent,marginBottom:10},
  title:{fontSize:36,lineHeight:40,fontWeight:'900',letterSpacing:-1.2,color:theme.colors.text},
  titleAccent:{color:theme.colors.accent},
  copy:{fontSize:16,lineHeight:23,color:theme.colors.muted,marginTop:16,marginBottom:28,maxWidth:520},
  transportTabs:{flexDirection:'row',backgroundColor:'#E9ECE6',borderRadius:16,padding:4,marginBottom:14},
  transportTab:{flex:1,paddingVertical:12,alignItems:'center',borderRadius:13},
  transportTabActive:{backgroundColor:theme.colors.surface},
  transportText:{fontSize:14,fontWeight:'800',color:theme.colors.muted},
  transportTextActive:{color:theme.colors.text},
  card:{backgroundColor:theme.colors.surface,borderRadius:theme.radius.lg,padding:20,borderWidth:1,borderColor:theme.colors.border},
  cardEyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.1,color:theme.colors.accent},
  cardTitle:{fontSize:25,fontWeight:'900',color:theme.colors.text,marginTop:6,marginBottom:2},
  validationError:{color:'#B42318',fontSize:13,fontWeight:'700',marginTop:12},
  preferenceLabel:{fontSize:13,fontWeight:'700',color:theme.colors.muted,marginTop:22,marginBottom:8},
  preferences:{flexDirection:'row',gap:8},
  preference:{flex:1,paddingVertical:12,paddingHorizontal:8,borderRadius:14,borderWidth:1,borderColor:theme.colors.border,alignItems:'center'},
  preferenceActive:{backgroundColor:theme.colors.accentSoft,borderColor:'#F4A17E'},
  preferenceText:{fontSize:12,fontWeight:'800',color:theme.colors.muted},
  preferenceTextActive:{color:theme.colors.accent},
  searchButton:{height:58,borderRadius:17,backgroundColor:theme.colors.dark,marginTop:22,paddingHorizontal:18,alignItems:'center',justifyContent:'space-between',flexDirection:'row'},
  searchDisabled:{opacity:.35},
  searchText:{color:'#fff',fontSize:16,fontWeight:'900'},
  searchArrow:{color:'#fff',fontSize:22},
  infoCard:{marginTop:16,borderRadius:20,padding:18,backgroundColor:'#EEF2EC',flexDirection:'row',gap:14},
  infoIcon:{fontSize:24},
  infoBody:{flex:1},
  infoTitle:{fontSize:14,fontWeight:'900',color:theme.colors.text},
  infoCopy:{fontSize:13,lineHeight:19,color:theme.colors.muted,marginTop:3},
  version:{textAlign:'center',fontSize:9,fontWeight:'900',letterSpacing:1.6,color:'#9CA69F',marginTop:30}
});
