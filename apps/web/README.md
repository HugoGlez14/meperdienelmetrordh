# meperdienelmetro — web

Aplicación local en React + Vite para planear viajes en las 12 líneas del Metro de la CDMX.

## Ejecutar

Requiere Node.js 20.19+ o 22.12+.

```sh
# Desde la raíz del monorepo
npm install
npm run dev:web
```

## Validar y compilar

```sh
npm run test --workspace @meperdienelmetro/web
npm run build:web
```

## Git y Vercel

La configuración de despliegue del monorepo está en `/vercel.json`. El cálculo de rutas no necesita claves ni backend.

## Rutas y datos

En desarrollo, Vite incluye una API local con las siete líneas, estaciones y
cálculo de rutas, por lo que la vista de Metrobús funciona sin Python, MySQL ni
credenciales. Para usar el backend GTFS completo, crea `apps/web/.env` y define
`METROBUS_API_TARGET=http://127.0.0.1:8787`; ese modo añade horarios y posiciones
cuando `apps/api/server.py` está configurado y en ejecución.

En producción, la vista consulta `/api/metrobus/network` y `/api/metrobus/live`
mediante una función de Vercel. Configura `METROBUS_USER` y `METROBUS_PASSWORD`
en las variables de entorno **Production** del proyecto y vuelve a desplegar.
Se utiliza el proveedor Sinóptico configurado en `apps/api/server.py`. Nunca
uses el prefijo `VITE_` en estas credenciales: no deben llegar al navegador.

La función descarga los trazos GTFS reales y decodifica las posiciones de
unidades. Se consulta cada 30 segundos y solo se muestran unidades con una
posición de menos de dos minutos. La caché en memoria reutiliza la sesión por
7 minutos, el mapa por una hora y las posiciones por 20 segundos dentro de cada
instancia de Vercel; un arranque en frío vuelve a descargarlos. No necesita
MySQL ni una base de datos. El feed real todavía debe verificarse con las
credenciales del proyecto: feeds comprimidos de más de 32 MiB o redes que
superen 4 MB en JSON requieren almacenamiento/caché externo.

El botón **Elegir origen y destino** abre el planificador de estaciones con
tiempos estimados, sin horarios GTFS ni predicciones de llegada. Si falla el
proveedor, el planificador sigue disponible con opción para reintentar.

Si ya tienes un backend Python completo alojado, puedes configurar en su lugar
`METROBUS_API_TARGET=https://tu-backend.example` (el origen, sin ruta). La función
reenviará únicamente las consultas de red, posiciones y planificación. El
token opcional `METROBUS_API_TOKEN` se envía solo a ese backend. El proxy de Vite
se usa únicamente en desarrollo; no constituye un backend de producción.

`packages/core` contiene las estaciones y el algoritmo Dijkstra compartido con la aplicación móvil. Los transbordos se modelan como cambios de línea en estaciones compartidas. El modo menor tiempo usa 2 minutos por tramo y 5 por transbordo. El modo menos cambios prioriza el número de transbordos y después los tramos. No incluye espera, afluencia, cierres, accesibilidad ni tiempos reales; se debe verificar la operación antes de viajar.

Referencia pública: https://www.metro.cdmx.gob.mx/la-red/mapa-de-la-red

El mapa es una adaptación vectorial del plano del STC, con posiciones de estaciones transcritas de https://www.metro.cdmx.gob.mx/storage/app/media/red/plano_red19ok.png. Los tramos conectan esas posiciones con segmentos rectos; no es una reproducción exacta de todos los quiebres del original ni un plano geográfico. Permite ampliar y resalta la ruta elegida sobre toda la red. Las alternativas se generan excluyendo conexiones de la ruta preferida, se deduplican y se descartan ciclos o desvíos mayores a 30 minutos adicionales; se muestran hasta tres opciones, no una enumeración exhaustiva. Las fuentes de Google son opcionales y cuentan con alternativas locales.
