import React,{useEffect,useMemo,useState} from 'react';

import {createRoot} from 'react-dom/client';

import {ArrowDownUp,ArrowRight,ArrowUpRight,BusFront,Clock3,Footprints,Info,LocateFixed,MapPin,Navigation,TrainFront,ChevronDown,Route} from 'lucide-react';

import {
  metroLines as lines,
  metroStations as stations,
  metroStationLines as stationLines,
  normalizeStation as normalize,
  planRoute
} from '@meperdienelmetro/core';

import './style.css';

import RouteMap from './RouteMap';
import RouteAudio from './RouteAudio';
import MetroUpdates from './MetroUpdates';
import LinesCatalog from './LinesCatalog';
import ServiceInfo from './ServiceInfo';
import SiteControls,{CityClock} from './SiteControls';
import MetrobusPlanner from './MetrobusPlanner';

const copy={es:{tag:'MENOS VUELTAS. MÁS CIUDAD.',head:'Piérdete en la ciudad.',accent:'No en el Metro.',from:'Estoy en',to:'Quiero ir a',fast:'Menor tiempo',few:'Menos cambios',find:'Encontrar mi ruta',empty:'Tu próxima ruta empieza aquí',emptyText:'Selecciona dónde estás y a dónde quieres ir para ver tu recorrido.',trip:'TU PRÓXIMO VIAJE',recommended:'Recomendada',alternative:'Alternativa',time:'tiempo estimado',stops:'estaciones por recorrer',transfer:'transbordo',transfers:'transbordos',steps:'Tu ruta, paso a paso',error:'Selecciona dos estaciones de la lista para encontrar tu ruta.'},en:{tag:'FEWER TURNS. MORE CITY.',head:'Get lost in the city.',accent:'Not in the Metro.',from:'I am at',to:'I want to go to',fast:'Fastest route',few:'Fewer transfers',find:'Find my route',empty:'Your next route starts here',emptyText:'Choose where you are and where you want to go to see your route.',trip:'YOUR NEXT TRIP',recommended:'Recommended',alternative:'Alternative',time:'estimated time',stops:'stops to travel',transfer:'transfer',transfers:'transfers',steps:'Your route, step by step',error:'Choose two stations from the list to find your route.'}};

function Badge({line}){return <span className="badge" style={{background:line.color}}>{line.id}</span>}
function PageLoader({routing=false,metrobus=false}){const Vehicle=metrobus?BusFront:TrainFront;const brand=metrobus?'me perdi en el metrobus':'me perdi en el metro';return <div className="page-loader" role="status" aria-live="polite">
<div className="loader-mark"><Vehicle size={35}/></div>
<p className="loader-brand">{brand}<b>.</b></p>
<div className={'loader-route'+(metrobus?' loader-route-bus':'')} aria-hidden="true"><i/><span><Vehicle size={20}/></span><i/></div>
<p className="loader-copy">{routing?'Preparando tu recorrido':'Conectando las líneas de la ciudad'}</p>
<span className="sr-only">{routing?'Preparando tu recorrido':'Cargando meperdienelmetro'}</span>
</div>}
function Picker({label,value,onChange,id,icon,mobile}){const [open,setOpen]=useState(false),[query,setQuery]=useState('');
const openPicker=()=>{setQuery('');setOpen(true)};
return <div className="picker">
<label>{label}</label>
<div className="input-wrap">{icon}<input aria-label={label} value={open?query:value} readOnly={mobile} inputMode={mobile?'none':undefined} onClick={openPicker} onFocus={openPicker} onBlur={()=>!mobile&&setTimeout(()=>setOpen(false),150)} onChange={e=>{setQuery(e.target.value);
setOpen(true)}}/>
<ChevronDown size={17}/>
</div>{open&&<div className={'options'+(mobile?' options-mobile':'')} id={id}>{mobile&&<div className="options-mobile-heading"><strong>{label}</strong><button type="button" onClick={()=>setOpen(false)}>Cerrar</button></div>}{stations.filter(s=>normalize(s).includes(normalize(query))).map(s=>
<button type="button" key={s} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(s);setQuery('');
setOpen(false)}}>
<span>{s}</span>
<span>{stationLines(s).map(l=>
<Badge key={l.id} line={l}/>)}</span>
</button>)}</div>}</div>}
function App(){const [from,setFrom]=useState(''),[to,setTo]=useState(''),[mode,setMode]=useState('fast'),[trip,setTrip]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(0),[language,setLanguage]=useState('es'),[theme,setTheme]=useState('light'),[loading,setLoading]=useState(false),[pageLoading,setPageLoading]=useState(true),[mobile,setMobile]=useState(()=>window.innerWidth<=760);
const isMetrobus=window.location.pathname.replace(/\/$/,'')==='/metrobus';
const t=copy[language],routes=useMemo(()=>trip?planRoute({transport:'metro',from:trip.from,to:trip.to,mode:trip.mode}).routes:[],[trip]),route=routes[selected]||routes[0];
useEffect(()=>{document.documentElement.lang=language;
document.documentElement.dataset.system=isMetrobus?'metrobus':'metro';
document.documentElement.dataset.theme=theme},[language,theme]);
useEffect(()=>{const timer=setTimeout(()=>setPageLoading(false),1800);
return()=>clearTimeout(timer)},[]);
useEffect(()=>{const update=()=>setMobile(window.innerWidth<=760);window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)},[]);
function submit(e){e.preventDefault();
if(!stations.includes(from)||!stations.includes(to)){setError(t.error);
return}if(from===to){setError(language==='en'?'Origin and destination must be different stations.':'El origen y el destino deben ser estaciones diferentes.');
return}setError('');
setLoading(true);
setSelected(0);
setTimeout(()=>{setTrip({from,to,mode});setLoading(false)},900)}return <>{(pageLoading||loading)&&<PageLoader routing={loading&&!pageLoading} metrobus={isMetrobus}/>}
<header>
<a className="brand" href="./">
<img className="brand-icon" src="/logo.svg" alt=""/>
<span>{isMetrobus?'me perdi':'meperdi'}<span className="brand-light">{isMetrobus?' en el metrobus':'enelmetro'}</span>
<span className="brand-dot">.</span>
</span>
</a>
<nav className="main-nav">
<a className={!isMetrobus?'active':''} href="/">Metro</a>
<a className={isMetrobus?'active':''} href="/metrobus">Metrobús</a>
</nav>
<div className="header-tools">
<CityClock language={language}/>
<SiteControls language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme}/>
</div>
</header>
<nav className="sub-nav" aria-label="Secciones">
{isMetrobus?<><a href="#ruta-metrobus">Ruta</a><a href="#estaciones-metrobus">Estaciones</a><a href="#servicio-metrobus">Servicio</a></>:<><a href="#route">{language==='en'?'Route':'Ruta'}</a><a href="#stations">{language==='en'?'Stations':'Estaciones'}</a><a href="#service">{language==='en'?'Service':'Servicio'}</a></>}
</nav>
{isMetrobus?<main className="metrobus-only"><MetrobusPlanner mobile={mobile}/><section id="servicio-metrobus" className="metrobus-service"><p className="eyebrow">SERVICIO DE METROBÚS</p><h2>Consulta avisos antes de salir</h2><p>Los horarios y las incidencias pueden cambiar por línea, ruta o día. Revisa los canales oficiales antes de iniciar tu viaje.</p><div><a href="https://www.metrobus.cdmx.gob.mx/dependencia/acerca-de/rutas" target="_blank" rel="noreferrer">Rutas y horarios oficiales <ArrowUpRight size={16}/></a><a href="https://x.com/MetrobusCDMX" target="_blank" rel="noreferrer">Avisos de Metrobús CDMX <ArrowUpRight size={16}/></a></div></section></main>:<main>
<div className="intro">
<div>
<p className="eyebrow">{t.tag}</p>
<h1>{t.head}<br/>
<span>{t.accent}</span>
</h1>
</div>
<p>{language==='en'?'From where you are to where you want to go.':'De donde estás a donde quieres ir.'}<br/>{language==='en'?'Find your route, one transfer at a time.':'Encuentra tu ruta, un transbordo a la vez.'}</p>
</div>
<div className="workspace" id="route">
<aside>
<form onSubmit={submit}>
<div className="panel-heading">
<span className="step-number">01</span>
<h2>{language==='en'?'Where are we going?':'¿A dónde vamos?'}</h2>
</div>
<div className="station-fields">
<Picker label={t.from} value={from} onChange={setFrom} id="origin" mobile={mobile} icon={<LocateFixed size={19}/>}/>
<button className="swap" type="button" onClick={()=>{setFrom(to);
setTo(from)}}>
<ArrowDownUp size={17}/>
</button>
<Picker label={t.to} value={to} onChange={setTo} id="destination" mobile={mobile} icon={<MapPin size={19}/>}/>
</div>
<fieldset>
<legend>{language==='en'?'Choose your route':'Elige tu recorrido'}</legend>
<div className="preferences">
<label className={mode==='fast'?'selected':''}>
<input type="radio" checked={mode==='fast'} onChange={()=>setMode('fast')}/>
<Clock3 size={15}/>{t.fast}</label>
<label className={mode==='transfers'?'selected':''}>
<input type="radio" checked={mode==='transfers'} onChange={()=>setMode('transfers')}/>
<Footprints size={15}/>{t.few}</label>
</div>
</fieldset>{error&&<p className="error">{error}</p>}<button className="search-button" disabled={loading}>{loading?<><span className="button-loader"/>{language==='en'?'Finding route…':'Buscando ruta…'}</>:<>{t.find}<ArrowRight size={19}/></>}
</button>
</form>
<div className="side-note">
<Navigation size={21}/>
<div>
<strong>{language==='en'?'The city connects with you.':'La ciudad se conecta contigo.'}</strong>
<p>{language==='en'?'Explore all twelve Metro lines.':'Explora las doce líneas del Metro.'}</p>
</div>
</div>
<a className="official" href="https://www.metro.cdmx.gob.mx/storage/app/media/red/plano_red19.pdf" target="_blank" rel="noreferrer">{language==='en'?'Download official map':'Descargar mapa oficial'}<ArrowUpRight size={17}/>
</a>
</aside>
<section className="result">{trip?<>
<div className="result-heading">
<div>
<p className="eyebrow">{t.trip}</p>
<h2>{trip.from}<ArrowRight size={22}/>{trip.to}</h2>
</div>
</div>
<div className="route-options">{routes.map((option,i)=>
<button type="button" key={i} className={selected===i?'active':''} onClick={()=>setSelected(i)}>
<strong>{i===0?t.recommended:t.alternative+' '+i}</strong>
<span>{option.minutes} min · {option.transfers} {option.transfers===1?t.transfer:t.transfers}</span>
<span className="option-lines">{option.segments.map((seg,j)=>
<Badge key={j} line={seg.line}/>)}</span>
</button>)}</div>
<div className="stats">
<div>
<Clock3/>
<strong>{route.minutes}<small> min</small>
</strong>
<span>{t.time}</span>
</div>
<div>
<TrainFront/>
<strong>{route.stops}</strong>
<span>{t.stops}</span>
</div>
<div>
<ArrowDownUp/>
<strong>{route.transfers}</strong>
<span>{route.transfers===1?t.transfer:t.transfers}</span>
</div>
</div>
<RouteMap route={route} from={trip.from} to={trip.to} language={language}/>
<RouteAudio route={route} from={trip.from} to={trip.to} language={language}/>
<div className="directions">
<div className="directions-title">
<h3>{t.steps}</h3>
</div>{route.segments.map((seg,i)=>
<details className="segment" key={i} open>
<summary>
<Badge line={seg.line}/>
<div>
<strong>{seg.stations[0]} → {seg.stations.at(-1)}</strong>
<p>{language==='en'?'Towards':'Dirección'} {seg.direction} · {seg.stations.length-1} {language==='en'?'stops':'estaciones'}</p>
</div>
<ChevronDown size={18}/>
</summary>
<ol>{seg.stations.map((s,j)=>
<li key={s}>
<span style={{background:seg.line.color}}/>{s}{j===0&&<small>{language==='en'?'Board here':'Sube aquí'}</small>}{j===seg.stations.length-1&&<small>{language==='en'?'Arrived':'Llegaste'}</small>}</li>)}</ol>
</details>)}</div>
<p className="service-note">
<Info size={16}/>{language==='en'?'Estimate: two minutes per stop plus five per transfer.':'Estimación: dos minutos por estación más cinco minutos por transbordo.'}</p>
</>:<div className="empty-route">
<Route size={36}/>
<h2>{t.empty}</h2>
<p>{t.emptyText}</p>
</div>}</section>
</div>
<section id="service">
<ServiceInfo/>
</section>
<MetroUpdates/>
<section id="stations">
<LinesCatalog/>
</section>
<div className="network">
<span>{language==='en'?'ONE CITY, TWELVE LINES.':'UNA CIUDAD, DOCE LÍNEAS.'}</span>
<div>{lines.map(l=>
<Badge key={l.id} line={l}/>)}</div>
</div>
</main>}
<footer>
<span>{isMetrobus?'Hecho para moverte por la CDMX en Metrobús.':language==='en'?'Made to move through CDMX.':'Hecho para moverte por la CDMX.'}</span>
<span>{isMetrobus?'Proyecto independiente · No afiliado a Metrobús CDMX':language==='en'?'Independent project · Not affiliated with STC Metro':'Proyecto independiente · No afiliado al STC Metro'}</span>
</footer>
</>}
createRoot(document.getElementById('root')).render(<App/>);
