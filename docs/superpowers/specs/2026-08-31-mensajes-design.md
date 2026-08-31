# Gestor de mensajes (avisos/noticias del admin y resúmenes de jornada)

## Contexto

El admin necesita comunicar avisos, noticias, felicitaciones y resúmenes de jornada a los usuarios. Hoy la app no tiene ningún mecanismo de comunicación in-app.

Los requisitos son:

- El **admin** crea mensajes desde el panel de administración: título, contenido, tipo (con icono) y rango de fechas de visibilidad (inicio/fin). También puede **borrar** mensajes existentes.
- El **usuario** ve los mensajes activos (dentro del rango de fechas) al entrar a la app, uno a uno en un modal, con un botón **"Ok leído"** que evita volver a mostrarlo.
- Desde **Perfil → botón Mensajes**, el usuario puede **reabrir** cualquier mensaje, incluidos los ya leídos y los que ya pasaron de fecha. Abrirlo desde el perfil lo marca como leído (no hay "desmarcar").
- Los mensajes se traen del backend pero se **cachean localmente** (SWR) para evitar llamadas innecesarias.
- El contenido acepta **HTML** (lo escriben el admin o los resúmenes de jornada generados fuera de la app).
- Caso especial: los **resúmenes de jornada** (texto con tono de comentarista deportivo, creados externamente) se guardan en la **misma colección** que el resto de mensajes.

### Limitación actual

No existe modelo, colección ni endpoint de mensajes en `api-porra`, ni módulo en `porra-spa`. Es un feature de cero.

## Diseño

### Arquitectura y flujo de datos

```
[Admin] → Perfil → Panel de Administración (modal existente)
          └─ botón "💬 Gestión de Mensajes"
               └─ showAdminMessagesModal()
                    ├─ POST   /api/admin/messages        (crear)
                    ├─ GET    /api/messages              (listar todos, JWT)
                    └─ DELETE /api/admin/messages/:id    (borrar)

[Usuario] → enterApp()
          ├─ fetchMessages()  (SWR: cache local → revalida GET /api/messages)
          ├─ ¿activos no leídos? → showMessagesEntryModal() (uno a uno)
          │     └─ "Ok leído" → markRead(id) → POST /api/messages/:id/read
          └─ Perfil → botón "💬 Mensajes" → showProfileMessagesModal()
                └─ lista TODOS los mensajes (incluidos pasados), reabrir → markRead
```

- El **backend devuelve todos los mensajes** (activos y pasados) sin filtrar por fecha; el frontend filtra "activos" localmente con una función pura. Así una sola respuesta sirve para el modal de entrada y para el perfil, y el ETag/304 del backend es determinista (el payload no depende de `Date.now()`).
- El **estado leído** (`readBy`) vive en MongoDB (por usuario) y se refleja en el campo `read` que el backend calcula para el usuario que hace la petición. Se cachea junto a la lista.
- **Sin edición de mensajes**: solo crear y borrar (decisión de producto).

### Backend (`api-porra`)

#### Modelo `db/models/Message.js` (colección `messages`)

| Campo | Tipo | Notas |
|-------|------|-------|
| `title` | String (req) | Máx 200 chars |
| `content` | String (req) | Acepta HTML |
| `type` | String (req) | enum: `noticia`, `aviso`, `felicitacion`, `resumen`, `mantenimiento` |
| `fechaInicio` | Date / null | Sin límite inferior si `null` |
| `fechaFin` | Date / null | Inclusivo al final del día (si `null`, sin límite superior) |
| `readBy` | [String] | Usernames que han leído el mensaje (Enfoque A) |
| `createdBy` | String / null | Username del admin que lo creó; `null` para resúmenes creados externamente |
| `createdAt` | Date | default `Date.now` |

Exportado desde `db/index.js` e importado en `server.js` (convención existente).

#### Validación `api/messageValidation.js`

Patrón de módulos puros existente (`{ ok: true }` / `{ ok: false, error: '...' }` en español):

- `validateMessage({ title, content, type, fechaInicio, fechaFin })`
  - `title`: string, trim no vacío, ≤ 200 chars.
  - `content`: string, trim no vacío.
  - `type`: uno de `['noticia','aviso','felicitacion','resumen','mantenimiento']`.
  - `fechaInicio` / `fechaFin`: `null` o string de fecha válida (`YYYY-MM-DD`); si ambos presentes, `fechaInicio ≤ fechaFin`.

#### Endpoints (rutas `if` en `server.js`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/messages` | JWT (usuario) | Devuelve **todos** los mensajes con `read` por usuario. Campos seguros: `{ id, title, content, type, fechaInicio, fechaFin, createdAt, read }`. Orden estable `createdAt` desc (ETag/304 compatible). |
| POST | `/api/messages/:id/read` | JWT (usuario) | Añade el username a `readBy` (idempotente). Devuelve `{ ok: true, id, read: true }`. |
| POST | `/api/admin/messages` | admin (`verifyAdmin`) | Valida con `validateMessage` y crea. `201 { ok: true, message }`. `createdBy` = username del admin. |
| DELETE | `/api/admin/messages/:id` | admin (`verifyAdmin`) | Borra el mensaje. `{ ok: true, deleted: id }`. |

Convenciones aplicadas: `parseBody`, `sendJson`, `verifyAdmin` → 403 `'Acceso denegado. Se requieren permisos de administrador.'`, `try/catch` → 500 `'Error interno del servidor'`. El GET de mensajes no expone `readBy` ni `createdBy` (no se filtran campos internos al usuario).

**Regla de actividad** (función pura en frontend, no se filtra en backend): un mensaje está activo si `ahora ≥ fechaInicio` y `ahora ≤ final del día de fechaFin`. El form envía `YYYY-MM-DD` (medianoche); `fechaFin` se interpreta como fin de ese día completo.

### Frontend (`porra-spa`)

#### Módulo nuevo `js/mensajes.js`

IIFE estilo `js/progresoAdmin.js` / `js/stats.js` (funciones puras exportadas para tests + render). Expone `global.porraMensajes` y `module.exports` en Node.

| Función | Responsabilidad |
|---------|-----------------|
| `TYPES` | Mapa `type → { icono, label }`: `noticia 📢`, `aviso ⚠️`, `felicitacion 🎉`, `resumen ⚽`, `mantenimiento 🔧` |
| `typeToIcon(type)` / `typeLabel(type)` | Icono / etiqueta desde `TYPES` (fallback a 📢 Noticia) |
| `isMessageActive(message, now)` | `now ≥ fechaInicio` y `now ≤ fin del día de fechaFin` (nulls = sin límite) |
| `getActiveUnread(messages, now)` | Activos + `!read`, ordenados `createdAt` desc |
| `fetchMessages()` | SWR: hidrata de cache → revalida `GET /api/messages` (TTL ~30s). Guarda en `AppState.messages` |
| `markRead(id)` | Optimista (marca `read` en cache/estado) + `POST /api/messages/:id/read`. 401 → `logout()`; fallo de red → `showToast` y deshace |
| `showMessagesEntryModal()` | Modal de entrada: muestra los activos no leídos uno a uno |
| `showProfileMessagesModal()` | Modal del perfil: lista **todos** los mensajes, expandibles para releer |
| `showAdminMessagesModal()` | Modal admin: formulario de creación + listado con borrar |

**Cache**: clave `porra_cache_messages_v1_<username>` (per-usuario, patrón `predall`) con `porraCache.cacheGet/cacheSet`. La purga de logout (`clearPorraCaches`) la elimina; el estado leído persiste en MongoDB.

**Seguridad del HTML**: `title` se renderiza con `esc()` (texto plano). `content` se inyecta como HTML crudo vía `innerHTML` — solo lo escriben admins o los resúmenes del backend, no hay input de usuarios no-admin.

#### Vista 1 — Modal de entrada (`showMessagesEntryModal`)

- Se dispara en `enterApp()` cuando `fetchMessages()` ha resuelto (o hay datos de cache) y existen activos no leídos.
- Modal tipo `.breakdown-modal` a pantalla completa: icono grande, tipo, título, contenido HTML, botón **"Ok leído"** y botón cerrar.
- "Ok leído" → `markRead(id)` y muestra el siguiente activo no leído. Cerrar (✕ o "saltar") pasa al siguiente **sin** marcar.
- Si no quedan → cierra el modal. Si no hay activos no leídos al entrar → no se muestra nada.

#### Vista 2 — Perfil → Mensajes (`showProfileMessagesModal`)

- Botón **"💬 Mensajes"** en `showProfileModal()` (js/main.js), visible para todos los usuarios, junto a "Cambiar Contraseña".
- Modal a pantalla completa con la lista de **todos** los mensajes (activos y pasados), ordenados `createdAt` desc: icono, tipo, título, rango de fechas y badge de leído/no leído.
- Pulsar un mensaje lo expande (contenido HTML) y lo marca como leído (`markRead`). El leído no se revierte.

#### Vista 3 — Admin → Gestión de Mensajes (`showAdminMessagesModal`)

- Botón **"💬 Gestión de Mensajes"** en `showAdminModal()` (js/main.js), junto a los demás botones admin.
- **Formulario** (parte superior): título (input), tipo (select con los 5 `TYPES`), contenido (textarea, admite HTML), fecha inicio / fecha fin (inputs `date`). Botón "Crear mensaje".
- **Listado** (parte inferior): todos los mensajes con icono, título, fechas y botón **borrar** por cada uno (incluye los resúmenes de jornada creados externamente, para poder borrarlos).
- Crear → `POST /api/admin/messages` (valida; toast de error si el backend rechaza). Borrar → confirmación + `DELETE /api/admin/messages/:id`. Tras crear/borrar → actualiza cache y listado.
- Reutiliza `fetchMessages()` para el listado (mismo endpoint que el usuario normal; el admin solo necesita la vista adicional de gestión).

#### Integración en `js/main.js`

- `enterApp()`: tras las cargas iniciales, llamar a `fetchMessages()` y, si hay activos no leídos, `showMessagesEntryModal()`.
- `showProfileModal()`: añadir botón "💬 Mensajes".
- `showAdminModal()`: añadir botón "💬 Gestión de Mensajes".
- `AppState.messages`: nuevo campo para la lista en memoria.

### Estilos CSS

Añadir en `css/styles.css` una sección `.mensajes-*` reutilizando variables `:root` (`--ucl-card`, `--accent-*`, `--text-*`, `--radius-*`): modal, tarjeta de mensaje, badges leído/no leído, formulario admin, botones. Mobile vertical (≤480px, `100dvh`, scroll vertical, sin scroll horizontal).

### Manejo de errores

- 401 → `logout()`.
- 403 → toast "Acceso denegado" y cierre del modal.
- Fallo de red → toast + estado de error con botón "Reintentar" en el listado admin (patrón `progresoAdmin.js`).
- Al entrar, si la red falla pero hay cache → se muestran los mensajes cacheados; si no hay nada → no se muestra el modal (no bloquea la app).

## Archivos a modificar

| Proyecto | Archivo | Cambio |
|----------|---------|--------|
| api-porra | `db/models/Message.js` | Nuevo modelo `Message` |
| api-porra | `db/index.js` | Exportar `Message` |
| api-porra | `api/messageValidation.js` | Nuevo módulo `validateMessage` |
| api-porra | `server.js` | Endpoints `GET /api/messages`, `POST /api/messages/:id/read`, `POST /api/admin/messages`, `DELETE /api/admin/messages/:id` |
| api-porra | `tests/messageValidation.test.js` | Tests de `validateMessage` |
| porra-spa | `js/mensajes.js` | Nuevo módulo (lógica pura + cache + renders/modales) |
| porra-spa | `js/main.js` | `AppState.messages`, `fetchMessages` en `enterApp`, botones en `showProfileModal` y `showAdminModal`, modal de entrada |
| porra-spa | `css/styles.css` | Sección `.mensajes-*` |
| porra-spa | `tests/mensajes.test.js` | Tests de `isMessageActive`, `getActiveUnread`, `TYPES`/iconos |
| porra-spa | `index.html` | Incrementar `v=` de `js/main.js`, `css/styles.css`; añadir `js/mensajes.js?v=1` |

## Verificación

1. Backend: `node --test` pasa (incluye `tests/messageValidation.test.js`).
2. Login como usuario con mensaje activo no leído → al entrar aparece el modal con el mensaje; "Ok leído" lo marca y, si hay más, muestra el siguiente; cerrar salta sin marcar.
3. Mensaje fuera de fechas (pasado o futuro) → no aparece en el modal de entrada.
4. Perfil → "💬 Mensajes" lista todos los mensajes (incluidos pasados y leídos); reabrir uno lo marca como leído.
5. Un mensaje marcado como leído no vuelve a aparecer en el modal de entrada (recargando la página, usando la cache y tras un logout+login porque persiste en MongoDB).
6. Admin → "💬 Gestión de Mensajes": crear un mensaje con fechas y tipo, aparece en la lista; los resúmenes externos aparecen en la lista y se pueden borrar.
7. Usuario no admin → los endpoints `/api/admin/messages` responden 403.
8. `node --test tests/mensajes.test.js` pasa.
9. Contenido con HTML se renderiza correctamente; título con caracteres especiales se escapa.
10. Sin errores en consola; render responsivo en móvil vertical.