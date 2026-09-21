import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TransitLine } from '@meperdienelmetro/core';
import { theme } from '../theme';
import { useApp } from '../app-state';

type Props = {
  label: string;
  value: string;
  lines: TransitLine[];
  onChange: (station: string) => void;
  placeholder: string;
};

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function StationPicker({label,value,lines,onChange,placeholder}:Props){
  const {theme:appTheme,t}=useApp();
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [selectedLineId,setSelectedLineId]=useState<string|null>(null);
  const selectedLine=lines.find(line=>line.id===selectedLineId)??null;
  const filteredStations=useMemo(()=>{
    if(!selectedLine) return [];
    const needle=normalize(query);
    return selectedLine.stations.filter(station=>normalize(station).includes(needle));
  },[query,selectedLine]);

  function openPicker(){
    setSelectedLineId(null);
    setQuery('');
    setOpen(true);
  }

  function showLines(){
    setSelectedLineId(null);
    setQuery('');
  }

  function handleRequestClose(){
    if(selectedLine){
      showLines();
      return;
    }
    setOpen(false);
  }

  return <>
    <Text style={[styles.label,{color:appTheme.colors.muted}]}>{label}</Text>
    <Pressable style={[styles.field,{backgroundColor:appTheme.colors.surface,borderColor:appTheme.colors.border}]} onPress={openPicker} accessibilityRole="button">
      <Text style={[value?styles.value:styles.placeholder,{color:value?appTheme.colors.text:appTheme.colors.muted}]}>{value||placeholder}</Text>
      <Text style={styles.chevron}>⌄</Text>
    </Pressable>

    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleRequestClose}>
      <SafeAreaView style={[styles.modal,{backgroundColor:appTheme.colors.background}]}>
        <View style={styles.modalHeader}>
          <View style={styles.headerCopy}>
            {selectedLine
              ? <Pressable onPress={showLines} hitSlop={10} accessibilityRole="button">
                  <Text style={[styles.back,{color:appTheme.colors.accent}]}>← {t.allLines}</Text>
                </Pressable>
              : <Text style={[styles.modalEyebrow,{color:appTheme.colors.accent}]}>{t.catalog}</Text>}
            <Text style={[styles.modalTitle,{color:appTheme.colors.text}]}>{selectedLine?`${t.line} ${selectedLine.id}`:label}</Text>
            <Text style={[styles.modalSubtitle,{color:appTheme.colors.muted}]}>{selectedLine?t.selectLine:t.allLines}</Text>
          </View>
          <Pressable onPress={()=>setOpen(false)} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.close,{color:appTheme.colors.accent}]}>{t.close}</Text>
          </Pressable>
        </View>

        {selectedLine?<>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t.selectLine}
            placeholderTextColor={appTheme.colors.muted}
            style={[styles.search,{backgroundColor:appTheme.colors.surface,borderColor:appTheme.colors.border,color:appTheme.colors.text}]}
          />
          <FlatList
            data={filteredStations}
            keyExtractor={item=>item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({item})=><Pressable style={styles.option} onPress={()=>{onChange(item);setOpen(false)}} accessibilityRole="button">
              <View style={[styles.stationMarker,{backgroundColor:selectedLine.color}]}/>
              <Text style={[styles.optionText,{color:appTheme.colors.text}]}>{item}</Text>
              <Text style={styles.arrow}>→</Text>
            </Pressable>}
            ListEmptyComponent={<Text style={[styles.empty,{color:appTheme.colors.muted}]}>{t.noRoute}</Text>}
          />
        </>:<FlatList
          data={lines}
          keyExtractor={item=>item.id}
          contentContainerStyle={styles.list}
          renderItem={({item})=><Pressable style={styles.lineOption} onPress={()=>setSelectedLineId(item.id)} accessibilityRole="button">
            <View style={[styles.lineMarker,{backgroundColor:item.color}]}/>
            <View style={styles.lineCopy}>
              <Text style={[styles.lineTitle,{color:appTheme.colors.text}]}>{t.line} {item.id}</Text>
              <Text style={[styles.lineRoute,{color:appTheme.colors.muted}]} numberOfLines={1}>{item.stations[0]} — {item.stations.at(-1)}</Text>
              <Text style={[styles.lineCount,{color:appTheme.colors.muted}]}>{item.stations.length} {t.stops}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </Pressable>}
          ListEmptyComponent={<Text style={[styles.empty,{color:appTheme.colors.muted}]}>{t.noRoute}</Text>}
        />}
      </SafeAreaView>
    </Modal>
  </>;
}

const styles=StyleSheet.create({
  label:{fontSize:13,fontWeight:'700',color:theme.colors.muted,marginBottom:8,marginTop:18},
  field:{minHeight:58,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,backgroundColor:theme.colors.surface,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  value:{fontSize:16,fontWeight:'700',color:theme.colors.text,flex:1},
  placeholder:{fontSize:16,color:theme.colors.muted,flex:1},
  chevron:{fontSize:22,color:theme.colors.muted},
  modal:{flex:1,backgroundColor:theme.colors.background},
  modalHeader:{paddingHorizontal:20,paddingTop:12,paddingBottom:16,flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},
  headerCopy:{flex:1,paddingRight:16},
  modalEyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.4,color:theme.colors.accent},
  back:{fontSize:14,fontWeight:'900',color:theme.colors.accent,marginBottom:4},
  modalTitle:{fontSize:26,fontWeight:'900',color:theme.colors.text,marginTop:3},
  modalSubtitle:{fontSize:13,lineHeight:18,color:theme.colors.muted,marginTop:3},
  close:{fontSize:15,fontWeight:'800',color:theme.colors.accent},
  search:{marginHorizontal:20,borderWidth:1,borderColor:theme.colors.border,borderRadius:16,backgroundColor:theme.colors.surface,paddingHorizontal:16,paddingVertical:14,fontSize:16,color:theme.colors.text},
  list:{padding:20,paddingBottom:40},
  option:{paddingVertical:16,borderBottomWidth:1,borderBottomColor:theme.colors.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  lineOption:{paddingVertical:15,borderBottomWidth:1,borderBottomColor:theme.colors.border,flexDirection:'row',alignItems:'center'},
  lineMarker:{width:6,height:54,borderRadius:99,marginRight:14},
  stationMarker:{width:10,height:10,borderRadius:99,marginRight:12},
  lineCopy:{flex:1,paddingRight:12},
  lineTitle:{fontSize:16,fontWeight:'700',color:theme.colors.text},
  lineRoute:{fontSize:13,color:theme.colors.muted,marginTop:3},
  lineCount:{fontSize:11,fontWeight:'800',color:theme.colors.muted,marginTop:4},
  optionText:{fontSize:16,fontWeight:'700',color:theme.colors.text,flex:1,paddingRight:12},
  arrow:{fontSize:18,color:theme.colors.accent},
  empty:{paddingVertical:36,textAlign:'center',color:theme.colors.muted}
});
