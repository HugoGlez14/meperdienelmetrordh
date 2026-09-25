import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, BusFront, Clock3, Download, Footprints, MapPin, Navigation, Route } from "lucide-react";
import OfflinePlanner from "./MetrobusPlanner";

async function get(path, signal) {
  const request = new AbortController();
  const abort = () => request.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, path.startsWith("plan?") ? 30000 : 10000);
  try {
    const response = await fetch("/api/metrobus/" + path, { signal: request.signal });
    if (!response.ok) throw new Error("El servicio local de Metrobús no está disponible.");
    return await response.json();
  } catch (error) {
    if (request.signal.aborted && !signal?.aborted)
      throw new Error("La consulta tardó demasiado. Puedes usar el planificador sin conexión.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
const clock = (value) =>
  new Date(value * 1000).toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  });
export function GeographicMap({ network, live, line, variant, journey }) {
  const [zoom, setZoom] = useState(1),
    [selected, setSelected] = useState(null);
  const local = network.source === "local";
  const journeyRouteIds = new Set(
    journey?.found
      ? journey.segments.filter((segment) => segment.kind === "ride").map((segment) => segment.routeId)
      : [],
  );
  const routes = network.routes.filter((route) =>
    journey?.found
      ? journeyRouteIds.has(route.route_id)
      : (!line || route.route_short_name === line) && (!variant || route.route_id === variant),
  );
  const routeIds = new Set(routes.map((r) => r.route_id));
  const paths = routes.flatMap((r) =>
    r.shapeIds.map((id) => ({
      id: r.route_id + ":" + id,
      points: network.shapes[id] || [],
      color: "#" + r.route_color,
    })),
  );
  const extent = paths.flatMap((p) => p.points);
  const all = [
    ...(extent.length ? extent : Object.values(network.shapes).flat()),
    ...(!journey?.found && !line && !variant
      ? (live?.vehicles || [])
          .filter((v) => Date.now() / 1000 - v.timestamp <= 120)
          .map((v) => [v.lat, v.lng])
      : []),
  ];
  const minLat = Math.min(...all.map((p) => p[0])),
    maxLat = Math.max(...all.map((p) => p[0])),
    minLng = Math.min(...all.map((p) => p[1])),
    maxLng = Math.max(...all.map((p) => p[1]));
  const scale = Math.min(
    900 / (Math.max(0.001, maxLng - minLng) * Math.cos((19.4 * Math.PI) / 180)),
    1000 / Math.max(0.001, maxLat - minLat),
  );
  const point = ([lat, lng]) => [
    50 + (lng - minLng) * Math.cos((19.4 * Math.PI) / 180) * scale,
    50 + (maxLat - lat) * scale,
  ];
  const points = (coordinates) =>
    coordinates.map((p) => point(p).join(",")).join(" ");
  const vehicles =
    live?.vehicles.filter(
      (v) =>
        (routeIds.has(v.routeId) || (!journey?.found && !line && !variant)) &&
        Date.now() / 1000 - v.timestamp <= 120,
    ) || [];
  const journeyStopIds = new Set(
    journey?.found ? journey.segments.flatMap((segment) => segment.stopIds || []) : [],
  );
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selected?.id);
  useEffect(() => {
    setZoom(1);
    setSelected(null);
  }, [line, variant, journey]);
  function download() {
    const data = JSON.stringify(
      {
        type: "FeatureCollection",
        features: paths.map((p) => ({
          type: "Feature",
          properties: { id: p.id, color: p.color },
          geometry: {
            type: "LineString",
            coordinates: p.points.map(([lat, lng]) => [lng, lat]),
          },
        })),
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([data], { type: "application/geo+json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "recorridos-metrobus.geojson";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="mb-map" aria-label="Mapa de Metrobús">
      <div className="mb-map-head">
        <div className="mb-map-heading">
          <span className="mb-map-heading-icon"><Navigation size={19} /></span>
          <div>
            <p className="eyebrow">{local ? "MAPA LOCAL" : "MAPA EN VIVO"}</p>
            <h3>{local ? "Recorridos de Metrobús" : journey?.found ? "Unidades de tu trayecto" : "Recorridos de Metrobús"}</h3>
          </div>
        </div>
        <span className="mb-map-count"><BusFront size={17} /> {vehicles.length} unidades recientes</span>
      </div>
      <div className="mb-map-tools">
        <div className="mb-map-lines" aria-label="Líneas visibles">
          {[...new Map(routes.map((route) => [route.route_short_name, route])).values()].map((route) => (
            <span className="mb-map-line" key={route.route_short_name} style={{"--line-color": `#${route.route_color}`}}>
              Línea {route.route_short_name}
            </span>
          ))}
        </div>
        <div>
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            aria-label="Alejar mapa"
          >
            −
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
            aria-label="Acercar mapa"
          >
            +
          </button>
          <button onClick={download} title="Descargar recorridos visibles"><Download size={16} /> <span>Descargar</span></button>
        </div>
      </div>
      <div className="mb-map-viewport">
        <svg
          viewBox="0 0 1000 1100"
          style={{
            width: zoom * 100 + "%",
            display: "block",
            background: "transparent",
          }}
          role="img"
          aria-label="Recorridos geográficos y posiciones recientes de Metrobús"
        >
          {paths.map((p) => (
            <polyline
              key={p.id}
              points={points(p.points)}
              fill="none"
              stroke={p.color}
              strokeWidth="3"
              opacity={journey?.found ? ".25" : ".7"}
            />
          ))}
          {journey?.segments
            ?.filter((s) => s.kind === "ride")
            .map((s, i) => (
              <polyline
                key={i}
                points={points(s.points)}
                fill="none"
                stroke={"#" + s.route.route_color}
                strokeWidth="7"
              />
            ))}
          {network.stops
            .filter(
              (s) =>
                (!journey?.found || journeyStopIds.has(s.stop_id)) &&
                +s.stop_lat >= minLat &&
                +s.stop_lat <= maxLat &&
                +s.stop_lon >= minLng &&
                +s.stop_lon <= maxLng,
            )
            .map((s) => {
              const [x, y] = point([+s.stop_lat, +s.stop_lon]);
              return (
                <circle
                  key={s.stop_id}
                  cx={x}
                  cy={y}
                  r={journey?.found ? "5" : "3"}
                  fill="white"
                  stroke={journey?.found ? "#aa263d" : "#62545b"}
                  strokeWidth={journey?.found ? "2" : "1"}
                >
                  <title>{s.stop_name}</title>
                </circle>
              );
            })}
          {vehicles.map((v) => {
            const [x, y] = point([v.lat, v.lng]);
            return (
              <g
                key={v.id}
                tabIndex="0"
                role="button"
                aria-label={`Unidad ${v.label || v.id}, ruta ${v.routeId || "sin asignar"}, posición ${clock(v.timestamp)}`}
                onClick={() => setSelected(v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(v);
                  }
                }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={selectedVehicle?.id === v.id ? "9" : "7"}
                  fill={"#" + (network.routes.find((route) => route.route_id === v.routeId)?.route_color || "162b45")}
                  stroke="white"
                  strokeWidth="3"
                />
                <title>{`Unidad ${v.label || v.id} - ${clock(v.timestamp)}`}</title>
              </g>
            );
          })}
        </svg>
      </div>
      {selectedVehicle && (
        <div className="mb-vehicle-detail" role="status">
          <BusFront size={19} />
          <div><strong>Unidad {selectedVehicle.label || selectedVehicle.id}</strong><span>Ruta {selectedVehicle.routeId || "sin asignar"} · posición {clock(selectedVehicle.timestamp)}</span></div>
        </div>
      )}
      <p className="mb-map-note">
        {local ? "Mapa esquemático incluido en la aplicación." : "Posiciones recibidas en los últimos 2 minutos. Toca una unidad para ver su información."}
        {journey?.found && " El tiempo de llegada del viaje procede del horario, no de la ubicación de la unidad."}
      </p>
    </section>
  );
}

function MetrobusLiveBackend({ mobile }) {
  const [network, setNetwork] = useState(null),
    [live, setLive] = useState(null),
    [networkError, setNetworkError] = useState(""),
    [liveError, setLiveError] = useState(""),
    [offline, setOffline] = useState(false),
    [automaticFallback, setAutomaticFallback] = useState(false),
    [retryKey, setRetryKey] = useState(0),
    [line, setLine] = useState("1"),
    [variant, setVariant] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [journey, setJourney] = useState(null),
    [busy, setBusy] = useState(false),
    [planError, setPlanError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let networkLoaded = false;
    async function refresh() {
      const tasks = [
        get("live", controller.signal).then(value => {
          setLive(value);
          setLiveError("");
        }).catch(error => {
          if (!controller.signal.aborted) setLiveError(error.message);
        }),
      ];
      if (!networkLoaded) tasks.push(
        get("network", controller.signal).then(value => {
          setNetwork(value);
          networkLoaded = true;
          setNetworkError("");
        }).catch(error => {
          if (!controller.signal.aborted) {
            setNetworkError(error.message);
            setAutomaticFallback(true);
            setOffline(true);
          }
        }),
      );
      await Promise.allSettled(tasks);
      if (!controller.signal.aborted) timer = setTimeout(refresh, 30000);
    }
    refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [retryKey]);
  const error = networkError || liveError;
  const localNetwork = network?.source === "local";
  const stops = useMemo(
    () =>
      network
        ? [...network.stops].sort((a, b) =>
            a.stop_name.localeCompare(b.stop_name, "es"),
          )
        : [],
    [network],
  );
  async function calculate(e) {
    e.preventDefault();
    setBusy(true);
    setPlanError("");
    setJourney(null);
    try {
      const result = await get("plan?" + new URLSearchParams({ from, to }));
      setJourney(result);
      if (result.found) {
        setLine("");
        setVariant("");
      }
    } catch (e) {
      setPlanError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (offline)
    return (
      <>
        {automaticFallback ? (
          <div className="mb-live-status mb-offline-status" role="status">
            <span className="mb-status-dot mb-status-dot-muted" aria-hidden="true" />
            <div className="mb-live-status-copy">
              <strong>Planificador local activo</strong>
              <span>Las rutas y el mapa funcionan sin el servicio en vivo.</span>
            </div>
            <button onClick={() => {
              setOffline(false);
              setAutomaticFallback(false);
              setNetworkError("");
              setLiveError("");
              setRetryKey(value => value + 1);
            }}>Reintentar servicio en vivo <ArrowRight size={16} /></button>
          </div>
        ) : (
          <button className="mb-return" onClick={() => setOffline(false)}>
            Volver a recorridos y unidades en vivo
          </button>
        )}
        <OfflinePlanner mobile={mobile} />
      </>
    );
  return (
    <section className="metrobus-page mb-live-page">
      <div className="metrobus-intro mb-live-intro" id="ruta-metrobus">
        <div>
          <p className="eyebrow">METROBÚS CDMX · RUTAS Y UNIDADES</p>
          <h1>
            Tu camino por la ciudad, <span>más claro.</span>
          </h1>
          <p>Elige tu destino, revisa el trayecto y ubica las unidades que circulan por sus rutas.</p>
        </div>
        <div className="mb-intro-emblem" aria-hidden="true"><BusFront size={39} /></div>
      </div>
      <div className="mb-live-status" role="status">
        <span className={"mb-status-dot" + (error || !live || live.stale ? " mb-status-dot-muted" : "")} aria-hidden="true" />
        <div className="mb-live-status-copy">
          <strong>{error || (!network ? "Cargando recorridos…" : localNetwork ? "Servicio local disponible" : !live || live.stale ? "Sin posiciones recientes" : "Unidades actualizadas")}</strong>
          <span>{!network ? "Estamos preparando el mapa." : localNetwork ? "Rutas, estaciones y cálculo de trayectos listos." : !live || live.stale ? "Puedes consultar rutas y horarios mientras tanto." : `Última señal ${clock(live.timestamp)} · se actualiza automáticamente`}</span>
          {live?.error && <small>{live.error}</small>}
        </div>
        <button onClick={() => setOffline(true)}>Planificador sin conexión <ArrowRight size={16} /></button>
      </div>
      {network && (
        <>
          <div className="workspace mb-live-workspace">
            <aside className="mb-live-sidebar">
              <form className="mb-plan-form" onSubmit={calculate}>
                <div className="mb-panel-title"><span className="mb-panel-icon"><Route size={20} /></span><div><p className="eyebrow">PLANEA TU VIAJE</p><h2>¿A dónde vas?</h2></div></div>
                {[
                  ["Origen", from, setFrom],
                  ["Destino", to, setTo],
                ].map(([label, value, set]) => (
                  <label className="mb-field" key={label}>
                    <span><MapPin size={15} /> {label}</span>
                    <select
                      required
                      disabled={busy}
                      value={value}
                      onChange={(e) => {
                        set(e.target.value);
                        setJourney(null);
                      }}
                    >
                      <option value="">Selecciona una parada</option>
                      {stops.map((s) => (
                        <option key={s.stop_id} value={s.stop_id}>
                          {s.stop_name} · {s.stop_id}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <p className="mb-departure"><Clock3 size={15} /> Salida ahora · hora de Ciudad de México</p>
                <button
                  className="search-button"
                  aria-busy={busy}
                  disabled={busy || !from || !to || from === to}
                >
                  {busy ? "Calculando…" : <>Encontrar trayecto <ArrowRight size={18} /></>}
                </button>
                <p role="alert">{planError}</p>
              </form>
              {journey?.found ? <div className="mb-filter-panel mb-trip-filter"><p className="eyebrow">VISTA ACTIVA</p><strong>Solo tu trayecto</strong><p>El mapa muestra los recorridos y las unidades identificadas para las líneas de este viaje.</p><button type="button" onClick={() => { setJourney(null); setLine(""); setVariant(""); }}>Explorar toda la red <ArrowRight size={16} /></button></div> : <div className="mb-filter-panel"><p className="eyebrow">EXPLORA LA RED</p><h3>Filtra los recorridos</h3><label className="mb-field">
                Línea
                <select
                  value={line}
                  onChange={(e) => {
                    setLine(e.target.value);
                    setVariant("");
                  }}
                >
                  <option value="">Todas</option>
                  {[...new Set(network.routes.map((r) => r.route_short_name))]
                    .sort()
                    .map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                </select>
              </label>
              <label className="mb-field">
                Recorrido y sentido
                <select
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                >
                  <option value="">Todos los recorridos</option>
                  {network.routes
                    .filter((r) => !line || r.route_short_name === line)
                    .map((r) => (
                      <option key={r.route_id} value={r.route_id}>
                        {r.route_long_name}
                      </option>
                    ))}
                </select>
              </label></div>}
              {!localNetwork && <div className="mb-downloads">
                <a href="/api/metrobus/download/static">
                  <Download size={15} /> Datos de rutas GTFS
                </a>
                <a href="/api/metrobus/download/realtime">
                  <Download size={15} /> Últimas posiciones
                </a>
              </div>}
            </aside>
            <section className="result metrobus-result">
              {journey &&
                (journey.found ? (
                  <div className="mb-journey">
                    <div className="mb-journey-heading"><div><p className="eyebrow">TU VIAJE EN METROBÚS</p><h2>{network.stops.find((stop) => stop.stop_id === from)?.stop_name} <ArrowRight size={20} /> {network.stops.find((stop) => stop.stop_id === to)?.stop_name}</h2></div><span className="mb-schedule-label"><Clock3 size={15} /> {journey.source === "local" ? "Estimación local" : "Horario GTFS"}</span></div>
                    <div className="mb-trip-stats"><div><strong>{journey.minutes}<small> min</small></strong><span>{journey.source === "local" ? "duración estimada" : "duración programada"}</span></div><div><strong>{clock(journey.arrival)}</strong><span>{journey.source === "local" ? "llegada estimada" : "llegada programada"}</span></div><div><strong>{journey.transfers}</strong><span>{journey.transfers === 1 ? "transbordo" : "transbordos"}</span></div></div>
                    <div className="mb-steps-heading"><h3>Tu recorrido paso a paso</h3><span>{journey.segments.length} {journey.segments.length === 1 ? "tramo" : "tramos"}</span></div>
                    <ol className="mb-steps">
                      {journey.segments.map((segment, index) => (
                        <li className="mb-step" key={index}>
                          <span className="mb-step-icon" style={{"--step-color": segment.kind === "walk" ? "#64748b" : `#${segment.route.route_color}`}}>{segment.kind === "walk" ? <Footprints size={18} /> : <BusFront size={18} />}</span>
                          <div className="mb-step-body"><div className="mb-step-top"><strong>{segment.kind === "walk" ? "Camina al siguiente andén" : `Línea ${segment.route.route_short_name}`}</strong><span>{clock(segment.departure)}–{clock(segment.arrival)}</span></div><p>{segment.fromName} <ArrowRight size={15} /> {segment.toName}</p>{segment.kind === "ride" && <small>{segment.route.route_long_name}</small>}</div>
                        </li>
                      ))}
                    </ol>
                    <p className="mb-schedule-note"><Clock3 size={16} /> {journey.source === "local" ? "Estimación de dos minutos por estación y cuatro por transbordo." : "Tiempo basado en horarios, incluida la espera. No es una predicción de llegada de una unidad."}</p>
                    {journey.walkingNote && <small className="mb-walking-note">{journey.walkingNote}</small>}
                  </div>
                ) : (
                  <div className="mb-no-journey" role="status"><Route size={25} /><strong>Sin viaje programado</strong><p>{journey.message}</p></div>
                ))}
              {!journey && <div className="mb-map-intro"><span className="mb-map-intro-icon"><BusFront size={22} /></span><div><h2>Explora el Metrobús en vivo</h2><p>Elige dos estaciones para destacar tu viaje y ver solo las unidades que circulan por sus rutas.</p></div></div>}
              <GeographicMap network={network} live={error ? { ...live, vehicles: [] } : live} line={line} variant={variant} journey={journey} />
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export default function MetrobusLive({ mobile }) {
  const liveEnabled = import.meta.env.DEV || import.meta.env.VITE_METROBUS_LIVE_ENABLED === "true";
  return liveEnabled ? <MetrobusLiveBackend mobile={mobile} /> : <OfflinePlanner mobile={mobile} />;
}
