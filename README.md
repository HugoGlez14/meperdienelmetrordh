# MePerdiEnElMetro MVC

Monorepo de **Me Perdí en el Metro** para web, Android e iOS. Unifica la
aplicación React/Vite y la aplicación Expo/React Native alrededor de un único
modelo de transporte escrito en TypeScript.

## Estructura

```text
apps/
  web/       Vista web: React + Vite
  mobile/    Vista móvil: Expo + React Native
packages/
  core/      Modelos, casos de uso, controladores y contratos compartidos
infra/
  supabase/  Esquema opcional para cuentas y sincronización
docs/        Arquitectura, auditoría y plan de migración
```

La aplicación funciona sin cuenta y calcula rutas completamente offline. La
base de datos sólo es necesaria para sincronizar perfiles, favoritos, historial
y preferencias entre dispositivos.

## Requisitos

- Node.js 22.12 o superior.
- npm 10 o superior.
- Android Studio únicamente si se utilizará un emulador Android.
- Expo Go o un development build para probar en un teléfono.

## Instalación

```bash
npm install
```

## Ejecutar

```bash
# Web
npm run dev:web

# Expo
npm run dev:mobile

# Emulador Android
npm run android
```

## Validar

```bash
npm run check
```

El comando ejecuta typecheck, pruebas del núcleo compartido y compilación de la
web.

## MVC pragmático

- **Modelo:** `packages/core/src/models`.
- **Controladores/casos de uso:** `packages/core/src/controllers`.
- **Vistas:** `apps/web` y `apps/mobile`.
- **Puertos:** contratos de autenticación y persistencia en
  `packages/core/src/ports`.
- **Adaptadores:** se implementan dentro de cada aplicación cuando se habiliten
  Supabase, SQLite, IndexedDB, voz, ubicación y mapas.

Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y
[docs/TECHNOLOGY_AUDIT.md](docs/TECHNOLOGY_AUDIT.md) para el análisis completo.

## Variables de entorno

No son necesarias para planificar rutas. Cuando se habilite autenticación,
copiar los `.env.example` de cada aplicación y usar únicamente la URL y clave
publicable de Supabase. Las claves privilegiadas permanecen siempre en el
servidor.
