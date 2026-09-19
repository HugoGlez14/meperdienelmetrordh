# Arquitectura MVC

## Objetivo

Web y móvil deben ofrecer la misma respuesta para una ruta sin duplicar líneas,
estaciones o algoritmos. La conectividad mejora la experiencia, pero nunca es
un requisito para calcular un recorrido.

```text
                 packages/core
        Modelos + reglas + controladores
                     │
          ┌──────────┴──────────┐
          │                     │
      apps/web              apps/mobile
   React DOM + Vite       React Native + Expo
          │                     │
          └──────────┬──────────┘
                     │ opcional
             Supabase / API GTFS-RT
```

## Responsabilidades

### Modelo

`packages/core/src/models` contiene:

- tipos de dominio;
- líneas y estaciones de Metro y Metrobús;
- Dijkstra y reglas de costo;
- rutas, segmentos, tiempos y alternativas;
- modelos de perfil, favoritos y preferencias.

No puede importar React, DOM, Expo, almacenamiento o Supabase.

### Controlador

`packages/core/src/controllers` expone acciones independientes de la interfaz:

- `planRoute` valida una solicitud y calcula Metro o Metrobús;
- `planPrimaryRoute` obtiene una única ruta;
- `SessionController` coordina la sesión mediante un puerto de autenticación.

Las vistas pueden añadir hooks para estado efímero, pero no deben duplicar las
reglas del dominio.

### Vista

- `apps/web`: componentes React, CSS, mapa SVG, Web Speech y descargas.
- `apps/mobile`: pantallas Expo Router, componentes React Native y estilos
  nativos.

Los mapas y coordenadas actuales permanecen en la web porque dependen de SVG,
Canvas y DOM. La futura vista móvil podrá usar `react-native-svg` sin alterar el
motor de rutas.

### Puertos y adaptadores

Los contratos `AuthGateway` y `UserRepository` aíslan al dominio de Supabase.
Los adaptadores previstos son:

| Capacidad | Web | Móvil |
|---|---|---|
| Persistencia offline | IndexedDB | Expo SQLite |
| Sesión segura | sesión web de Supabase | Expo SecureStore |
| Voz | Web Speech API | Expo Speech |
| Ubicación | Geolocation API | Expo Location |
| Compartir/archivo | Web Share/Blob | Expo Sharing/FileSystem |

## Autenticación y base de datos

El planificador anónimo no necesita base de datos. Para cuentas, favoritos e
historial sincronizados se propone Supabase Auth con Google y PostgreSQL con
Row Level Security.

- Supabase administra identidades; la aplicación no guarda contraseñas.
- La cuenta es opcional.
- Cada tabla usa políticas basadas en `auth.uid()`.
- El cliente sólo recibe la clave publicable.
- Cualquier secreto administrativo o de un proveedor GTFS vive en servidor.

El esquema inicial está en `infra/supabase/schema.sql`.

## Offline-first

1. El dataset estático viaja dentro de cada aplicación.
2. Las rutas se calculan localmente.
3. Favoritos y preferencias se escriben primero en almacenamiento local.
4. Una cola de salida sincroniza cuando vuelve la conexión y existe sesión.
5. Un fallo de autenticación o API nunca bloquea el planificador.

## Tiempo real

GTFS-Realtime requiere un proxy o Edge Function que proteja credenciales,
decodifique protobuf y aplique caché. La respuesta cliente debe ser JSON estable
con `generatedAt`, `expiresAt` y `stale`. No se deben guardar todas las posiciones
en PostgreSQL ni consultar el proveedor directamente desde las aplicaciones.

## Decisiones pendientes

- Introducir IDs estables para estaciones en lugar de usar el nombre visible.
- Declarar transbordos de Metrobús explícitamente.
- Implementar almacenamiento local y sincronización.
- Añadir mapas y audio nativos.
- Crear el proxy GTFS-RT cuando exista acceso oficial al feed.

## Referencias técnicas

- Expo, monorepos: https://docs.expo.dev/guides/monorepos/
- Supabase, Auth con React Native: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase, Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase, Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
