# Metrobús web con MariaDB de XAMPP

La base activa es `metrobus_gtfs`, visible en http://127.0.0.1/phpmyadmin/.
MariaDB escucha en `127.0.0.1:3307`; el puerto 3306 pertenece a otra
instalación de MySQL de esta computadora. La configuración anterior de
phpMyAdmin quedó en `C:/xampp/phpMyAdmin/config.inc.php.codex-backup` y la de MariaDB en `C:/xampp/mysql/bin/my.ini.codex-backup`.

## Qué se guarda

- Ocho tablas `gtfs_*`: rutas, paradas, viajes, trazados, horarios y calendarios.
- `gtfs_connections`: conexiones por horario, preparadas para buscar trayectos.
- `vehicle_positions`: última posición conocida de cada unidad válida.
- `live_snapshot`: respuesta actual de la API para la web.
- `metrobus_meta`: fecha y huella de la última importación estática.

La base contiene la última instantánea, no el historial completo de movimiento.
Los archivos originales descargados siguen en `apps/api/data/gtfs.zip` y
`apps/api/data/realtime.pb` para descarga y recuperación. Las credenciales
permanecen en `apps/api/.env`, excluido de Git. La SQLite anterior dejó de ser
utilizada por la aplicación.

## Iniciar localmente

Requisitos: Python 3.11+, Node 22.12+ y XAMPP. Inicia MariaDB de XAMPP en el
puerto 3307 y Apache para acceder a phpMyAdmin. Luego, desde la raíz del proyecto:

```powershell
python -m venv apps/api/.venv
apps/api/.venv/Scripts/python.exe -m pip install -r apps/api/requirements.txt
npm ci
```

Copia `apps/api/.env.example` a `apps/api/.env` y configura las credenciales
del proveedor y de MariaDB. En esta instalación ya están configuradas.
Ejecuta en dos terminales:

```powershell
apps/api/.venv/Scripts/python.exe apps/api/server.py
npm run dev:web
```

Abre http://127.0.0.1:5173/metrobus. La API Python escucha en
`127.0.0.1:8787` y Vite le envía las consultas `/api/metrobus`.

## Datos y cálculo

El servidor consulta la API del proveedor cada 30 segundos y reemplaza las
posiciones actuales en MariaDB. Renueva las URLs firmadas antes de que caduquen.
Los recorridos y horarios GTFS se actualizan diariamente. Las unidades sin
ruta asignada aparecen en la vista general; las coordenadas fuera de CDMX se
descartan de la vista y se registran como rechazadas en la instantánea.

El cálculo usa `gtfs_connections`, el calendario y las excepciones para obtener
la llegada programada más temprana en las próximas cuatro horas. Los transbordos
a pie de hasta 120 metros son aproximaciones geográficas. El feed observado no
contiene predicciones de llegada ni identificadores de viaje suficientes para
calcular retrasos reales; la interfaz distingue horarios de posiciones en vivo.

## Comprobar

```powershell
apps/api/.venv/Scripts/python.exe -m unittest discover -s apps/api -p test_*.py -v
npm run check
node apps/web/scripts/verify-metrobus.mjs
```

El despliegue Vercel actual solo publica la web. Para publicar esta integración
se necesita alojar la API y MariaDB con almacenamiento persistente y enrutar
`/api/metrobus` hacia el servidor. Nunca publiques `.env` ni URLs firmadas.
