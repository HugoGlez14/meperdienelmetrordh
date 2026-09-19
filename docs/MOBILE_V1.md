# V1 — meperdienelmetro mobile

## Objetivo

Crear una app móvil independiente, local-first, para Android e iOS que conserve el motor de rutas de la web y esté diseñada desde el inicio para funcionar sin señal.

## Incluido en V1

- Expo + React Native + TypeScript.
- Android primero, iOS compatible desde la misma base.
- Planificador offline para Metro CDMX.
- Planificador offline para Metrobús CDMX.
- Menor tiempo / menos transbordos para Metro.
- Resultados paso a paso.
- Hasta 3 alternativas para Metro.
- Favoritos y rutas recientes locales.
- Audio de instrucciones.
- Mapas esquemáticos de Metro y Metrobús.
- Modo claro/oscuro.
- UI móvil dedicada.

## Fuera de V1

- Inicio de sesión con Google.
- Sincronización cloud.
- Ubicación GPS.
- Metrobús en tiempo real.
- Alertas GTFS-Realtime.
- Viaje activo.
- Rutas combinadas Metro + Metrobús.

Esas funciones se incorporarán después de estabilizar el núcleo offline.

## Entregas internas

### 1. Fundación
- [x] Repo móvil separado.
- [x] Expo Router.
- [x] TypeScript.
- [x] Tema visual base.
- [x] Selector móvil de estaciones.
- [x] Motor offline Metro.
- [x] Motor offline Metrobús.
- [x] Home inicial.
- [x] Resultado paso a paso.

### 2. Persistencia local
- [ ] Favoritos.
- [ ] Recientes.
- [ ] Preferencias.
- [ ] Migración/versionado de datos locales.

### 3. Experiencia de viaje
- [ ] Audio.
- [ ] Mapas.
- [ ] Compartir ruta.
- [ ] Dark mode.
- [ ] Estados vacíos y errores.

### 4. QA Android
- [ ] Tests de routing.
- [ ] Typecheck en CI.
- [ ] Prueba en dispositivo Android.
- [ ] Build APK interno.
- [ ] Correcciones de accesibilidad y performance.

### 5. Release
- [ ] AAB producción.
- [ ] Play Console.
- [ ] Preparación iOS/TestFlight.

## Principio técnico

El cálculo de rutas debe seguir funcionando cuando no exista ninguna conexión a internet. Las futuras funciones online deben enriquecer el viaje, nunca bloquear el núcleo de la aplicación.
