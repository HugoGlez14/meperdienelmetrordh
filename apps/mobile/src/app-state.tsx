import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Transport } from '@meperdienelmetro/core';

export type Language = 'es' | 'en';
export type ThemeMode = 'light' | 'dark';

export type AppTheme = {
  colors: {
    background: string; surface: string; text: string; muted: string; border: string;
    accent: string; accentSoft: string; dark: string; success: string; danger: string;
  };
  radius: { sm: number; md: number; lg: number };
};

const light: AppTheme = { colors: { background:'#F6F7F2', surface:'#FFFFFF', text:'#1D3429', muted:'#69766F', border:'#DDE3DD', accent:'#EF5B24', accentSoft:'#FFF0E9', dark:'#18392E', success:'#168A66', danger:'#B42318' }, radius:{sm:12,md:18,lg:28} };
const dark: AppTheme = { colors: { background:'#0B1714', surface:'#142720', text:'#EDF5F0', muted:'#B7C8BE', border:'#315246', accent:'#FF8B62', accentSoft:'#3A2B20', dark:'#07100D', success:'#65D6AA', danger:'#FF8A80' }, radius:{sm:12,md:18,lg:28} };

const copy = {
  es: {
    brandMetro:'me perdi en el metro', brandMetrobus:'me perdi en el metrobus', homeTag:'MENOS VUELTAS. MÁS CIUDAD.', homeTitle:'Piérdete en la ciudad.', homeAccent:'No en el transporte.', homeCopy:'Planea tu recorrido incluso sin señal. Metro y Metrobús viven dentro de la app.',
    plan:'PLANEA TU VIAJE', where:'¿A dónde vamos?', from:'Estoy en', to:'Quiero ir a', origin:'Selecciona tu origen', destination:'Selecciona tu destino', swap:'Intercambiar origen y destino', find:'Encontrar mi ruta', fastest:'Menor tiempo', fewer:'Menos cambios', same:'El origen y el destino deben ser estaciones diferentes.',
    catalog:'Líneas y estaciones', service:'Servicio', preferences:'Preferencias', offline:'Tu ruta se calcula sin internet.', route:'Tu ruta', recommended:'Recomendada', alternative:'Alternativa', minutes:'min', stops:'estaciones', transfers:'transbordos', steps:'Paso a paso', board:'Sube aquí', transfer:'Transborda aquí', arrived:'Llegaste', share:'Compartir', listen:'Escuchar ruta', stopAudio:'Detener audio', map:'Mapa de la red', routeMap:'Mapa de tu ruta', mapRouteNote:'Se muestran origen, transbordos y llegada sobre el plano de la red.', mapNetworkNote:'Plano esquemático de la red. Calcula una ruta para verla resaltada.', noRoute:'No encontramos una ruta.', retry:'Regresa y prueba con otras estaciones.',
    allLines:'Todas las líneas y estaciones', selectLine:'Toca una línea para conocer sus estaciones.', station:'Estación', connections:'Conexiones', close:'Cerrar', serviceTitle:'Información de servicio', serviceCopy:'Los avisos en vivo requieren internet. Esta app conserva las rutas y la información base sin conexión.', metroHours:'Metro: lun-vie 05:00–00:00 · sáb 06:00–00:00 · dom 07:00–00:00.', metrobusHours:'Metrobús: consulta horarios por línea antes de salir.', official:'Abrir fuente oficial', appearance:'Apariencia', language:'Idioma', light:'Claro', dark:'Oscuro', spanish:'Español', english:'English', version:'V1 · APP NATIVA OFFLINE', systemMetro:'METRO CDMX', systemMetrobus:'METROBÚS CDMX', line:'Línea', direction:'dirección', selected:'seleccionada'
  },
  en: {
    brandMetro:'lost in the metro', brandMetrobus:'lost in metrobus', homeTag:'FEWER TURNS. MORE CITY.', homeTitle:'Get lost in the city.', homeAccent:'Not in transit.', homeCopy:'Plan your trip even without signal. Metro and Metrobus live inside the app.',
    plan:'PLAN YOUR TRIP', where:'Where are we going?', from:'I am at', to:'I want to go to', origin:'Select origin', destination:'Select destination', swap:'Swap origin and destination', find:'Find my route', fastest:'Fastest route', fewer:'Fewer transfers', same:'Origin and destination must be different.',
    catalog:'Lines and stations', service:'Service', preferences:'Preferences', offline:'Your route is calculated offline.', route:'Your route', recommended:'Recommended', alternative:'Alternative', minutes:'min', stops:'stops', transfers:'transfers', steps:'Step by step', board:'Board here', transfer:'Transfer here', arrived:'You arrived', share:'Share', listen:'Listen to route', stopAudio:'Stop audio', map:'Network map', routeMap:'Your route map', mapRouteNote:'Origin, transfers and arrival are shown on the network map.', mapNetworkNote:'Schematic network map. Calculate a route to highlight it.', noRoute:'We could not find a route.', retry:'Go back and try other stations.',
    allLines:'All lines and stations', selectLine:'Tap a line to see its stations.', station:'Station', connections:'Connections', close:'Close', serviceTitle:'Service information', serviceCopy:'Live alerts require internet. This app keeps routes and core information offline.', metroHours:'Metro: Mon–Fri 05:00–00:00 · Sat 06:00–00:00 · Sun 07:00–00:00.', metrobusHours:'Metrobus: check schedules by line before leaving.', official:'Open official source', appearance:'Appearance', language:'Language', light:'Light', dark:'Dark', spanish:'Español', english:'English', version:'V1 · NATIVE OFFLINE APP', systemMetro:'MEXICO CITY METRO', systemMetrobus:'MEXICO CITY METROBUS', line:'Line', direction:'towards', selected:'selected'
  }
} as const;

type Translation = { [K in keyof typeof copy.es]: string };
type AppContextValue = { language: Language; setLanguage:(value:Language)=>void; mode:ThemeMode; setMode:(value:ThemeMode)=>void; theme:AppTheme; t:Translation; systemName:(transport:Transport)=>string };
const AppContext=createContext<AppContextValue|null>(null);

export function AppProvider({children}:{children:ReactNode}){
  const [language,setLanguage]=useState<Language>('es');
  const [mode,setMode]=useState<ThemeMode>('light');
  const value=useMemo(()=>({language,setLanguage,mode,setMode,theme:mode==='dark'?dark:light,t:copy[language],systemName:(transport:Transport)=>transport==='metro'?copy[language].systemMetro:copy[language].systemMetrobus}),[language,mode]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp(){const value=useContext(AppContext);if(!value)throw new Error('useApp must be used within AppProvider');return value;}
