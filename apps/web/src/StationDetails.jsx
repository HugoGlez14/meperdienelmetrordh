import React from 'react';
import { MapPin, X } from 'lucide-react';

const ignoredWords = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);

function initials(name) {
  const words = name.split(/[\s/-]+/).filter(word => word && !ignoredWords.has(word.toLowerCase()));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words.at(-1)[0]}`.toUpperCase();
}

export function StationMark({ name, color, small = false }) {
  return <span className={'station-mark' + (small ? ' station-mark-small' : '')} style={{ '--station-color': color }} aria-hidden="true"><img src="/station-marker.png" alt=""/><b>{initials(name)}</b></span>;
}

export function StationDetails({ station, lines, transport, onClose }) {
  if (!station) return null;
  const color = lines[0]?.color || (transport === 'metrobus' ? '#be1830' : '#31533a');
  const system = transport === 'metrobus' ? 'Metrobús CDMX' : 'Metro CDMX';
  const connectionCopy = lines.length > 1
    ? `Correspondencia disponible con ${lines.length} líneas.`
    : `Ubicada en la Línea ${lines[0]?.id ?? 'correspondiente'}.`;

  return <div className="station-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="station-dialog" role="dialog" aria-modal="true" aria-labelledby="station-dialog-title">
      <button className="station-dialog-close" type="button" onClick={onClose} aria-label="Cerrar ficha de estación"><X size={20}/></button>
      <StationMark name={station} color={color}/>
      <p className="station-dialog-eyebrow"><MapPin size={14}/>{system}</p>
      <h3 id="station-dialog-title">{station}</h3>
      <p className="station-dialog-copy">{connectionCopy}</p>
      <div className="station-dialog-lines" aria-label="Líneas que conectan">
        {lines.map(line => <span key={line.id} style={{ backgroundColor: line.color }}>Línea {line.id}</span>)}
      </div>
    </section>
  </div>;
}
