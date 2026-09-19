# Auditoría tecnológica

## Proyecto web original

Origen: `HugoGlez14/meperdienelmetro`.

- React 19 y React DOM.
- Vite 6.
- JavaScript/JSX ESM.
- Lucide React.
- CSS propio y mapas SVG.
- Web Speech API para narración.
- Pruebas con `node:test`.
- Despliegue estático en Vercel.
- Sin backend, login, persistencia, API o base de datos.

La web incluye la interfaz más completa, catálogo, idiomas parciales, tema,
mapas interactivos y descarga PNG. Su antiguo motor de Metrobús usaba BFS: podía
mostrar una ruta más lenta porque no ponderaba los transbordos durante la
búsqueda.

## Proyecto móvil original

Origen: `DavidOrv/meperdienelmetro---mobile`, rama
`feature/v1-foundation`.

- Expo 57.
- React Native 0.86.
- React 19.
- Expo Router.
- TypeScript estricto.
- Sin backend, login, persistencia o pruebas automáticas.

El móvil contenía el mejor núcleo para la migración: tipos compartidos y
Dijkstra ponderado tanto para Metro como Metrobús. Ese núcleo es ahora la fuente
canónica de `packages/core`.

## Hallazgos corregidos

- Se eliminó la duplicación de datos y algoritmos.
- Web y móvil llaman al mismo controlador `planRoute`.
- Metrobús utiliza Dijkstra ponderado por tramo y transbordo.
- La vista web evita desreferenciar segmentos vacíos.
- La pantalla móvil corrigió un literal JSX inválido que impedía compilar.
- Se añadieron pruebas compartidas de Metro, Metrobús y del controlador.

## Base de datos

No se requiere para buscar rutas offline. Sí se requiere para sincronizar:

- perfiles;
- rutas favoritas;
- historial opcional;
- preferencias entre web y móvil;
- dispositivos de notificaciones en una fase posterior.

La propuesta es Supabase Auth + PostgreSQL/RLS. El esquema es opcional y no se
activa hasta configurar un proyecto Supabase y credenciales públicas por app.

## Riesgos y deuda técnica

- Los nombres visibles aún funcionan como identidad de estación.
- Los recorridos son datasets estáticos y no representan cierres o variantes.
- Las conexiones de Metrobús se infieren por nombres compartidos.
- La traducción web es parcial.
- Mapas, audio, favoritos y recientes móviles siguen siendo fases posteriores.
- El historial puede ser sensible y debe ser opcional y eliminable.
- `npm audit` reporta 13 vulnerabilidades moderadas en dependencias transitivas
  de Expo/Expo Router. La corrección automática propuesta instala versiones
  incompatibles y no debe aplicarse con `--force`; se revisarán al actualizar
  oficialmente el SDK.
