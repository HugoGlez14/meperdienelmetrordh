import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  planRoute,
  type RouteMode,
  type TransitRoute,
  type Transport
} from '@meperdienelmetro/core';
import { theme } from '../src/theme';

export default function RouteScreen(){
  const params=useLocalSearchParams<{transport:string;from:string;to:string;mode:string}>();
  const transport=(params.transport==='metrobus'?'metrobus':'metro') as Transport;
  const mode=(params.mode==='transfers'?'transfers':'fast') as RouteMode;
  const from=params.from||'';
  const to=params.to||'';

  const routes=useMemo<TransitRoute[]>(()=>{
    return planRoute({transport,from,to,mode}).routes;
  },[transport,from,to,mode]);

  const [selected,setSelected]=useState(0);
  const route=routes[selected]||routes[0];

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.topbar}>
        <Pressable onPress={()=>router.back()} style={styles.back}><Text style={styles.backText}>←</Text></Pressable>
        <Text style={styles.topTitle}>Tu ruta</Text>
        <View style={styles.spacer}/>
      </View>

      <Text style={styles.eyebrow}>{transport==='metro'?'METRO CDMX':'METROBÚS CDMX'}</Text>
      <Text style={styles.title}>{from}</Text>
      <Text style={styles.to}>→ {to}</Text>

      {!route?<View style={styles.empty}><Text style={styles.emptyIcon}>⚠️</Text><Text style={styles.emptyTitle}>No encontramos una ruta.</Text><Text style={styles.emptyCopy}>Regresa y prueba con otras estaciones.</Text></View>:<>
        {routes.length>1&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
          {routes.map((item,index)=><Pressable key={index} onPress={()=>setSelected(index)} style={[styles.option,selected===index&&styles.optionActive]}>
            <Text style={[styles.optionName,selected===index&&styles.optionNameActive]}>{index===0?'Recomendada':`Alternativa ${index}`}</Text>
            <Text style={styles.optionMeta}>{item.minutes} min · {item.transfers} cambios</Text>
          </Pressable>)}
        </ScrollView>}

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{route.minutes}<Text style={styles.statUnit}> min</Text></Text><Text style={styles.statLabel}>estimados</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{route.stops}</Text><Text style={styles.statLabel}>estaciones</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{route.transfers}</Text><Text style={styles.statLabel}>transbordos</Text></View>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteIcon}>📵</Text>
          <Text style={styles.noteText}>Esta ruta se calculó localmente en tu teléfono.</Text>
        </View>

        <Text style={styles.sectionEyebrow}>PASO A PASO</Text>
        <Text style={styles.sectionTitle}>Tu recorrido</Text>

        <View style={styles.timeline}>
          {route.segments.map((segment,index)=><View key={`${segment.line.id}-${index}`} style={styles.segment}>
            <View style={[styles.lineBadge,{backgroundColor:segment.line.color}]}><Text style={styles.lineBadgeText}>{segment.line.id}</Text></View>
            <View style={styles.segmentBody}>
              <Text style={styles.segmentTitle}>{transport==='metro'?'Línea':'Línea'} {segment.line.id} · dirección {segment.direction}</Text>
              <Text style={styles.segmentMeta}>{segment.stations.length-1} estaciones</Text>
              <View style={styles.stations}>
                {segment.stations.map((station,stationIndex)=><View key={station} style={styles.stationRow}>
                  <View style={styles.stationRail}>
                    <View style={[styles.stationDot,{borderColor:segment.line.color}]}/>
                    {stationIndex<segment.stations.length-1&&<View style={[styles.rail,{backgroundColor:segment.line.color}]}/>}
                  </View>
                  <View style={styles.stationTextWrap}>
                    <Text style={[styles.stationText,(stationIndex===0||stationIndex===segment.stations.length-1)&&styles.stationStrong]}>{station}</Text>
                    {stationIndex===0&&<Text style={styles.stationHint}>Sube aquí</Text>}
                    {stationIndex===segment.stations.length-1&&<Text style={styles.stationHint}>{index===route.segments.length-1?'Llegaste':'Transborda aquí'}</Text>}
                  </View>
                </View>)}
              </View>
            </View>
          </View>)}
        </View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.colors.background},
  page:{padding:20,paddingBottom:50},
  topbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:32},
  back:{width:42,height:42,borderRadius:21,backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.border,alignItems:'center',justifyContent:'center'},
  backText:{fontSize:22,color:theme.colors.text},
  topTitle:{fontSize:15,fontWeight:'900',color:theme.colors.text},
  spacer:{width:42},
  eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.4,color:theme.colors.accent},
  title:{fontSize:30,fontWeight:'900',color:theme.colors.text,marginTop:8},
  to:{fontSize:25,fontWeight:'700',color:theme.colors.muted,marginTop:2,marginBottom:22},
  options:{gap:8,paddingBottom:18},
  option:{minWidth:150,padding:14,borderWidth:1,borderColor:theme.colors.border,borderRadius:16,backgroundColor:theme.colors.surface},
  optionActive:{borderColor:theme.colors.accent,backgroundColor:theme.colors.accentSoft},
  optionName:{fontSize:13,fontWeight:'900',color:theme.colors.text},
  optionNameActive:{color:theme.colors.accent},
  optionMeta:{fontSize:11,color:theme.colors.muted,marginTop:4},
  stats:{flexDirection:'row',backgroundColor:theme.colors.dark,borderRadius:22,paddingVertical:18,marginBottom:12},
  stat:{flex:1,alignItems:'center',paddingHorizontal:4},
  statValue:{fontSize:24,fontWeight:'900',color:'#fff'},
  statUnit:{fontSize:12},
  statLabel:{fontSize:10,color:'#C7D8D0',marginTop:3},
  note:{backgroundColor:'#E8F3ED',borderRadius:15,padding:13,flexDirection:'row',alignItems:'center',gap:9,marginBottom:30},
  noteIcon:{fontSize:17},
  noteText:{fontSize:12,fontWeight:'700',color:theme.colors.success,flex:1},
  sectionEyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:theme.colors.accent},
  sectionTitle:{fontSize:25,fontWeight:'900',color:theme.colors.text,marginTop:4,marginBottom:16},
  timeline:{gap:12},
  segment:{backgroundColor:theme.colors.surface,borderRadius:22,borderWidth:1,borderColor:theme.colors.border,padding:16,flexDirection:'row',gap:12},
  lineBadge:{width:42,height:42,borderRadius:12,alignItems:'center',justifyContent:'center'},
  lineBadgeText:{fontSize:14,fontWeight:'900',color:'#fff'},
  segmentBody:{flex:1},
  segmentTitle:{fontSize:14,fontWeight:'900',color:theme.colors.text,lineHeight:20},
  segmentMeta:{fontSize:12,color:theme.colors.muted,marginTop:2,marginBottom:14},
  stations:{},
  stationRow:{flexDirection:'row',minHeight:45},
  stationRail:{width:22,alignItems:'center'},
  stationDot:{width:11,height:11,borderRadius:6,backgroundColor:'#fff',borderWidth:3,zIndex:2},
  rail:{width:3,flex:1,marginTop:-1},
  stationTextWrap:{flex:1,paddingLeft:7,paddingBottom:12},
  stationText:{fontSize:13,color:theme.colors.muted},
  stationStrong:{fontWeight:'900',color:theme.colors.text},
  stationHint:{fontSize:10,fontWeight:'800',color:theme.colors.accent,marginTop:2},
  empty:{backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.border,borderRadius:22,padding:30,alignItems:'center'},
  emptyIcon:{fontSize:32},
  emptyTitle:{fontSize:19,fontWeight:'900',color:theme.colors.text,marginTop:12},
  emptyCopy:{fontSize:14,color:theme.colors.muted,marginTop:5,textAlign:'center'}
});
