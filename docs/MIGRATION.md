# Migración

## Completado en la fundación

- Monorepo con npm workspaces.
- Web original preservada en `apps/web`.
- Aplicación Expo preservada en `apps/mobile`.
- Una única fuente TypeScript en `packages/core`.
- Controlador común para Metro y Metrobús.
- Contratos de autenticación y repositorio sin acoplarse a proveedor.
- Esquema SQL inicial con RLS.
- Pruebas del dominio, typecheck y build centralizados.

## Siguientes fases

1. Crear IDs estables y versionar el dataset.
2. Añadir persistencia local y cola de sincronización.
3. Implementar adaptadores Supabase en web y móvil.
4. Incorporar Google OAuth manteniendo el modo invitado.
5. Añadir favoritos, recientes y preferencias.
6. Crear mapas y audio nativos.
7. Añadir un proxy GTFS-RT con caché.
8. Incorporar CI E2E para web y Android.

Los repositorios originales deben conservarse hasta validar despliegue web y un
build Android desde este monorepo.
