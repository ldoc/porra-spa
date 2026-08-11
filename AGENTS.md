# Directrices para Agentes de IA y Especificaciones del Proyecto

Este documento establece las normas de desarrollo, la arquitectura de código y las especificaciones del producto para la aplicación **Porra SPA**. Todos los agentes de IA (incluyendo Gemini) deben consultar y cumplir estas pautas en cada interacción o cambio en la base de código.

---

> **⚠️ IMPORTANTE - Cache-busting**: Cuando se suban cambios a GitHub que afecten a `css/styles.css` o `js/main.js`, **SIEMPRE** incrementar la versión en `index.html`:
> - CSS: `<link rel="stylesheet" href="css/styles.css?v=X">`
> - JS: `<script src="js/main.js?v=X"></script>`
> Sin esto, el navegador no descargará los cambios y el usuario verá la versión anterior.

---

## 1. Visión del Producto

**Porra SPA** es una aplicación web (Single Page Application) orientada a la participación en una porra para la **UEFA Champions League de la temporada 2026/2027**.

- **Público Objetivo**: Usuarios conocidos a los cuales se les proporcionará un código de acceso único para realizar sus predicciones, consultar sus puntuaciones, la clasificación del resto de jugadores y otras estadísticas relativas al torneo.
- **Dispositivos**: Conexión orientada principalmente a dispositivos móviles (smartphones), con soporte responsivo para PC / laptops.
- **Experiencia de Usuario (UX)**: Diseño nativo app-like, fluido, rápido e intuitivo.
- **Orientación Exclusiva**: **Vertical (Portrait mode)**. Toda la interfaz debe estar diseñada, optimizada y probada para pantallas verticales.

### 1.1. Reglas de la Porra - Fase de Liga

#### Formato de la Fase de Liga

Todos los partidos de esta fase se juegan de acuerdo con un sistema de liga en el que cada club se enfrenta a ocho rivales distintos en enfrentamientos de partido único. Cada club juega cuatro partidos como local y cuatro partidos como visitante. Los enfrentamientos se definirán por sorteo. La fecha de celebración de este sorteo está prevista para el 27 de agosto de 2026. El comienzo de la fase de liga esta previsto para el 8 de septiembre de 2026.

De acuerdo con los resultados de estos partidos los clubes se clasificarán en un sistema de liga única obteniendo 3 puntos por victoria, 1 punto por empate y 0 puntos por derrota.

#### Criterios de Desempate

Si dos o más equipos están empatados al finalizar los partidos de la fase de liga, se aplican los siguientes criterios, en este orden, para determinar la clasificación final:

1. Mayor diferencia de goles
2. Mayor número de goles marcados
3. Mayor número de goles marcados como visitante
4. Mayor número de victorias
5. Mayor número de victorias como visitante
6. Mayor suma de puntos obtenidos por todos los rivales de la fase de liga
7. Mayor suma de diferencia de goles obtenida por todos los rivales de la fase de liga
8. Mayor suma de goles marcados por todos los rivales de la fase de liga
9. Menor número de puntos disciplinarios basado en el número total de tarjetas amarillas y tarjetas rojas recibidas (tarjeta amarilla = 1 punto, tarjeta roja = 3 puntos, expulsión por doble amarilla = 3 puntos)
10. Mayor coeficiente UEFA del club

#### Pronóstico de Resultados de la Fase de Liga

Cada participante deberá pronosticar el resultado de cada uno de los 144 partidos previstos para la fase de liga. En base a estos resultados se obtendrá un pronóstico de clasificación para la fase de liga.

#### Puntuación por Pronóstico de Partidos

| Concepto | Puntos |
|----------|--------|
| Acierto de resultado (victoria local, empate o victoria visitante) | 8 |
| Acierto de goles marcados por el equipo local | 3 |
| Acierto de goles marcados por el equipo visitante | 3 |
| Acierto de goles marcados por ambos equipos | 1 |
| **Puntuación máxima por partido** | **15** |

#### Puntuación por Pronóstico de Clasificación

Adicionalmente a la puntuación de los partidos, al finalizar la fase de liga se obtendrán puntos por acertar la posición final de cada equipo en la liga.

**Únicamente obtendrán puntos los equipos que hayan finalizado en una posición igual o superior al puesto 24.** Los puntos se asignan del siguiente modo:

| Posición | Puntos | Posición | Puntos | Posición | Puntos | Posición | Puntos |
|----------|--------|----------|--------|----------|--------|----------|--------|
| 1º | 60 | 7º | 21 | 13º | 12 | 19º | 6 |
| 2º | 51 | 8º | 18 | 14º | 11 | 20º | 5 |
| 3º | 43 | 9º | 16 | 15º | 10 | 21º | 4 |
| 4º | 36 | 10º | 15 | 16º | 9 | 22º | 3 |
| 5º | 30 | 11º | 14 | 17º | 8 | 23º | 2 |
| 6º | 25 | 12º | 13 | 18º | 7 | 24º | 1 |

**Regla de puntuación por clasificación**: Solo se recibirán los puntos por el valor más bajo de posición que ocupe un equipo teniendo en cuenta la posición pronosticada y la real.

> Ejemplo: Si se ha pronosticado que un equipo acaba en la posición 7 y finalmente acaba en la posición 3, solo se recibirán los puntos de la posición 7 (21 puntos). Si el equipo acaba en la posición 12, solo se recibirán los puntos de la posición 12 (13 puntos).

#### Puntuación de la Plantilla Ideal

Se seleccionará una plantilla compuesta por un total de 25 jugadores formada por 3 porteros, 8 defensas, 8 centrocampistas y 6 delanteros. En la plantilla no podrá haber más de un jugador del mismo club.

Los jugadores seleccionados recibirán puntos a lo largo de la competición de acuerdo con los siguientes criterios:

##### Puntuación Sofascore

Puntuación obtenida en cada partido según la aplicación Sofascore. 6 puntos Sofascore equivalen a 0 puntos. Si la puntuación Sofascore es superior a 6, se obtiene 1 punto por cada 0,3 puntos Sofascore recibidos. La puntuación máxima en Sofascore es de 10 puntos, por lo que el número máximo de puntos que se podrán recibir será de 13. En el caso de que la puntuación Sofascore sea inferior a 6, la puntuación recibida por el jugador será negativa. Hasta 5,7 puntos Sofascore el jugador recibirá un punto negativo (-1). Por debajo de ese valor, por cada 0,3 puntos Sofascore menos, el jugador recibirá un punto negativo adicional.

##### Puntuación por goles marcados

Por cada gol marcado en un partido el jugador recibirá 1 punto adicional. Dependiendo de su demarcación obtendrá puntos adicionales del siguiente modo:

| Demarcación | Puntos adicionales por gol |
|-------------|---------------------------|
| Delantero | +1 |
| Centrocampista | +2 |
| Defensa | +3 |
| Portero | +4 |

En el caso de que el gol se marque de penalti el jugador no recibe esta puntuación adicional por demarcación.

##### Porteros (penaltis parados y goles recibidos)

Esta puntuación aplica solo a los porteros. Los porteros recibirán una puntuación adicional negativa de 1 punto (-1) por cada gol recibido. En el caso de que el portero pare un penalti recibirá una puntuación adicional positiva de 3 puntos (+3).

##### Puntuación por portería a cero

Si al finalizar el partido el equipo no ha recibido goles, el portero recibirá una puntuación adicional positiva de 5 puntos (+5), y los defensas una puntuación adicional positiva de 2 puntos (+2), siempre y cuando en ambos casos hayan jugado más de 70 minutos.

---

## 2. Pautas Generales de Diseño (Mobile Vertical First)

1. **Pantalla y Contención (Portrait)**:
   - Toda la interfaz debe ajustarse al alto dinámico del viewport del móvil (`100dvh` / `100vh`).
   - Respetar los bordes de seguridad de dispositivos móviles (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
   - En pantallas anchas (escritorio/tablet), la aplicación debe centrarse en un contenedor con apariencia de smartphone móvil (anchura máxima aproximada de `480px`).

2. **Elementos Táctiles**:
   - Botones e interactivos con un área mínima de toque de **44x44px**.
   - Retroalimentación táctil con micro-animaciones (`active` states, transformaciones suaves).
   - Evitar scroll horizontal involuntario (`overflow-x: hidden`).

3. **Estética y Paleta de Colores**:
   - Modo oscuro premium por defecto (colores oscuros profundos `#0F172A`, `#1E293B` combinados con acentos vibrantes e.g. Verde Neón `#10B981` o Violeta `#8B5CF6`).
   - Tipografía moderna (e.g., 'Inter' u 'Outfit' cargadas vía Google Fonts).
   - Uso de efectos de cristal (glassmorphism) y gradientes limpios.

---

## 3. Stack Tecnológico y Reglas de Código

### Stack
- **HTML5**: Estructura semántica completa (`<header>`, `<main>`, `<nav>`, `<section>`, `<footer>`).
- **CSS3 (Vanilla)**:
  - Definición centralizada de variables CSS en `:root` (`css/styles.css`).
  - No usar frameworks CSS externos (sin Tailwind, Bootstrap, etc.) salvo petición explícita.
  - Uso de Flexbox y CSS Grid para diagramación.
- **JavaScript (Vanilla ES6+)**:
  - Código limpio, modular e impulsado por eventos.
  - Sin frameworks de JS pesados.
- **Backend**: API REST en `https://api-porra.vercel.app` (repositorio separado `api-porra`)
- **Persistencia**: GitHub como base de datos (via backend)
- **Autenticación**: JWT en localStorage

### Estructura de Directorios
```text
/
├── index.html        # Punto de entrada de la SPA
├── css/
│   └── styles.css    # Sistema de diseño, variables y estilos globales
├── js/
│   └── main.js       # Lógica principal, control de navegación y autenticación
├── assets/           # Imágenes, iconos y recursos estáticos
├── data/             # Datos estáticos del torneo (ver data/README.md)
│   ├── README.md     # Esquemas, relaciones y documentación de modelos
│   ├── teams.json    # 36 equipos participantes
│   ├── jugadores.json # 1 273 jugadores para la plantilla ideal
│   ├── calendar.json # 144 partidos de la fase de liga (8 jornadas)
│   └── imgJugadores/ # Fotos PNG de jugadores ({id}.png)
├── api/              # (Placeholder) Ficheros de integración con APIs
├── extract/          # Scripts para obtener información de SofaScore (NO subir en despliegues)
├── AGENTS.md         # Este fichero de directrices y especificaciones
└── README.md         # Documentación de inicio y uso del proyecto
```

---

## 4. Normas para los Agentes de IA

Cuando trabajes en este proyecto:
1. **Preserva el enfoque móvil vertical**: No introduzcas diseños que rompan la experiencia en smartphones verticales.
2. **Revisa las variables de CSS**: Reutiliza las variables definidas en `:root` (colores, espaciados, bordes) antes de añadir valores estáticos directos.
3. **Mantén el HTML semántico**: Usa identificadores `id` descriptivos y únicos para elementos interactivos.
4. **Validación de código**: Comprueba siempre que el código JS no lance excepciones en la consola y que los estilos sean responsivos.
5. **Carpeta de extracción (`extract/`)**: Ten en cuenta que la carpeta `extract/` contiene utilidades locales de scraping/extracción de SofaScore y no debe incluirse en el bundle ni subirse a despliegues de producción.
6. **Modelos de datos (`data/`)**: Consulta `data/README.md` antes de modificar o consumir los JSON. Usa los identificadores de SofaScore (`id`) como claves de relación entre ficheros.

---

## 5. Especificaciones del Producto

### 5.1. Registro y Autenticación de Usuarios

El sistema de autenticación utiliza **JWT (JSON Web Tokens)** almacenados en **localStorage** para persistir la sesión en la SPA sin necesidad de peticiones al servidor al recargar.

#### Flujo de Autenticación

1. **Paso 1 - Login/Registro**:
   - **Login**: El usuario introduce usuario y contraseña. Se envía POST a `/api/auth/login`.
   - **Registro**: El usuario introduce usuario, contraseña y código de invitación. Se envía POST a `/api/auth/register`.
   - El código de invitación es un fichero JSON en GitHub (`data/users/{clave}.json`) creado con GET `/nuevoUsuario`.
   - Si el código es válido y no ha sido usado, se guarda el JWT en `localStorage` como `session_token`.
   - Si el login es exitoso y el usuario ya tiene avatar, se entra directamente a la app.
   - Si el login es exitoso pero no tiene avatar, se muestra el paso 2 (selección de avatar).

2. **Paso 2 - Selección de Avatar**:
   - Se solicita al usuario que seleccione un **Avatar** de una cuadrícula dinámica (~50 opciones).
   - Los avatares ya cogidos por otros usuarios se obtienen de `GET /api/avatars/taken` y se excluyen.
   - Los datos se guardan en `localStorage` como `porra_ucl_user` y en el backend vía POST `/api/auth/profile`.
   - Una vez seleccionado el avatar, el usuario entra directamente a la pestaña Inicio.

#### Persistencia de Sesión

- El JWT se almacena en `localStorage` con clave `session_token`.
- Al recargar la página, `checkAuthStatus()` verifica el JWT localmente decodificándolo y comprobando la fecha de expiración.
- Si el token es válido, se muestra la app principal sin hacer llamada al servidor.
- Si el token ha expirado o no existe, se muestra el overlay de autenticación.

#### API del Backend

La SPA se comunica con el backend en `https://api-porra.vercel.app`:

```javascript
const API_BASE = 'https://api-porra.vercel.app';

// ─── Autenticación ────────────────────────────────────────────
POST /api/auth/register          // Body: { username, password, invitationCode }
POST /api/auth/login             // Body: { username, password }
GET  /api/auth/profile           // Query: ?username=xxx
POST /api/auth/profile           // Body: { avatar }
POST /api/auth/change-password   // Body: { currentPassword, newPassword }

// ─── Pronósticos de partidos ──────────────────────────────────
GET  /api/predictions            // Query: ?username=xxx (pre-freeze: solo propio)
PUT  /api/predictions            // Body: { predictions } (bloqueado tras freeze)
GET  /api/predictions/all        // Post-freeze: todos. Pre-freeze: solo propio

// ─── Fase Final ───────────────────────────────────────────────
GET  /api/final-predictions      // Query: ?username=xxx (pre-freeze: solo propio)
PUT  /api/final-predictions      // Body: { finalPredictions } (bloqueado tras finalsFreezeDate)

// ─── Plantilla ideal ──────────────────────────────────────────
GET  /api/squad                  // Query: ?username=xxx
PUT  /api/squad                  // Body: { squad } (bloqueado tras freeze)
GET  /api/squad/all              // Post-freeze: todos. Pre-freeze: solo propio

// ─── Configuración y jugadores ────────────────────────────────
GET  /api/config                 // { championsFreezeDate, finalsFreezeDate, squadSize, ... }
GET  /api/avatars/taken          // Avatares ya cogidos
GET  /api/players                // Todos los usuarios registrados

// ─── Estadísticas de partidos (Sofascore) ─────────────────────
GET  /api/match-stats            // Todos los matchstats almacenados
GET  /api/match-stats/:eventId   // Scraping en vivo de un partido específico
GET  /api/match-stats/updated    // Contador + última actualización
DELETE /api/match-stats/:eventId // Eliminar un matchstat

// ─── Administración (solo admins) ──────────────────────────────
GET    /api/admin/invitations       // Listar códigos de invitación
POST   /api/admin/invitations       // Crear nuevo código
DELETE /api/admin/invitations/:code // Eliminar código no usado

// ─── Legacy ───────────────────────────────────────────────────
GET  /usuario?clave=xxxx         // Buscar usuario por clave de invitación
```

#### Variables de Entorno Requeridas (Backend)

| Variable         | Descripción                                    |
|------------------|------------------------------------------------|
| `GITHUB_TOKEN`   | Personal Access Token de GitHub                |
| `JWT_SECRET`     | Secreto para firmar tokens JWT                 |
| `FRONTEND_URL`   | URL del frontend para configurar CORS          |

#### Modelo de Datos de Usuario (en Backend)

```json
{
  "clave": "string (unique, required, indexed)",
  "username": "string (unique, required, lowercase, indexed)",
  "passwordHash": "string (required, format: salt:hash via scrypt)",
  "avatar": "string | null (emoji seleccionado)",
  "squad": [{
    "id": "number (Sofascore player ID)",
    "nombre": "string",
    "posicion": "string (G/D/M/F)",
    "club": "string",
    "equipo": "number (Sofascore team ID)",
    "extension": "string (png/webp)"
  }],
  "predictions": {
    "[eventId]": { "home": "number|null", "away": "number|null" }
  },
  "finalPredictions": {
    "champion": "number|null (team ID)",
    "runnerUp": "number|null (team ID)",
    "semiFinalists": "[number] (max 2)",
    "quarterFinalists": "[number] (max 4)",
    "roundOf16": "[number] (max 8)",
    "roundOf32": "[number] (max 8)"
  },
  "createdAt": "Date"
}
```

#### Modelo de Datos de Estadísticas de Partidos (MatchStats)

```json
{
  "eventId": "number (unique, required, indexed - Sofascore event ID)",
  "stats": {
    "[homeTeamId]": { "goles": "number" },
    "[awayTeamId]": { "goles": "number" },
    "jugadores": [{
      "id": "number",
      "nombre": "string",
      "posicion": "string (G/D/M/F)",
      "equipo": "number (team ID)",
      "puntos": "number (Sofascore rating)",
      "goles": "number",
      "minutos": "number",
      "paradas": "number (goalkeeper saves)",
      "esSuplente": "boolean",
      "penaltiMarcado": "boolean",
      "penaltiParado": "boolean",
      "golesRecibidos": "number (goalkeeper only)"
    }]
  },
  "lastUpdated": "Date"
}
```

#### Modelo de Invitaciones (Invitation)

```json
{
  "code": "string (unique, required, indexed - 6 char hex)",
  "usedBy": "string | null (username)",
  "createdAt": "Date"
}
```

#### Configuración del Torneo (config.json)

| Clave | Valor | Descripción |
|-------|-------|-------------|
| `championsStartRoundsDate` | `"2026-07-01T21:00:00Z"` | Fecha de freeze de fase de liga (bloquea predictions y squad) |
| `championsStartRoundsLabel` | `"Fase de Grupos"` | Etiqueta legible de la fase |
| `finalsFreezeDate` | `"2026-12-01T00:00:00Z"` | Fecha de freeze de fase final (bloquea finalPredictions) |
| `finalsFreezeLabel` | `"Fase de Dieciseisavos"` | Etiqueta legible de la fase final |
| `totalMatches` | `144` | Total de partidos de fase de liga |
| `squadSize` | `25` | Tamaño de la plantilla ideal |
| `squadFormation.G` | `3` | Porteros en plantilla |
| `squadFormation.D` | `8` | Defensas en plantilla |
| `squadFormation.M` | `8` | Centrocampistas en plantilla |
| `squadFormation.F` | `6` | Delanteros en plantilla |

### 5.6. Scripts de Scraping (api-porra/scripts/)

Scripts para obtener datos de Sofascore y poblar MongoDB. **NO subir en despliegues de producción.**

| Script | Descripción | Uso |
|--------|-------------|-----|
| `calendario.js` | Obtiene los 144 partidos de las 8 jornadas de la fase de liga | `node scripts/calendario.js` |
| `equipos.js` | Obtiene los 36 equipos + logos de Sofascore | `node scripts/equipos.js` |
| `matchStats.js` | Módulo core: obtiene estadísticas de un partido por eventId (lineups, incidents, ratings) | Importado por otros scripts |
| `scrapeRounds.js` | Scraping por lotes de jornadas 1-2 (36 partidos) | `node scripts/scrapeRounds.js` |
| `scrapeRounds2to8.js` | Scraping por lotes de jornadas 2-8, saltando partidos existentes | `node scripts/scrapeRounds2to8.js` |
| `migrateToMongo.js` | Migración de datos de GitHub JSON a MongoDB | `node scripts/migrateToMongo.js` |

**Estructura de datos que genera matchStats:**

```javascript
{
  stats: {
    [homeTeamId]: { goles: 2 },
    [awayTeamId]: { goles: 1 },
    jugadores: [
      {
        id: 12345,
        nombre: "Player Name",
        posicion: "M",           // G/D/M/F
        equipo: 1234,            // Team ID
        puntos: 7.2,             // Sofascore rating
        goles: 1,
        minutos: 90,
        paradas: 0,              // Solo porteros
        esSuplente: false,
        penaltiMarcado: false,
        penaltiParado: false,    // Solo porteros
        golesRecibidos: 1        // Solo porteros
      }
    ]
  }
}
```

#### Cierre de Sesión

- El botón "Cerrar Sesión" en la pestaña Perfil elimina `session_token` y `porra_ucl_user` de localStorage.
- Se muestra el overlay de autenticación.

#### Navegación de la Aplicación

La aplicación utiliza una estructura de navegación con:

1. **Header Superior**: Muestra avatar y nombre del usuario. Al hacer clic, accede a la pestaña Perfil.
2. **Menú Inferior (5 items)**:
   - **Inicio**: Pantalla de bienvenida con avisos de pendientes y freeze de Champions
   - **Clasificación**: Tabla de posiciones de todos los participantes (obtenidos de `GET /api/players`)
   - **Pronósticos**: Wizard para introducir marcadores de los 144 partidos
   - **Plantilla**: Selección de 25 jugadores para la plantilla ideal (3G, 8D, 8M, 6F)
   - **Eliminatorias**: Predicciones de la fase de eliminatorias (campeón a dieciseisavos). Solo accesible tras confirmar los 144 pronósticos de liga

**Pestañas disponibles:**
- `tab-inicio`: Pantalla de bienvenida con resumen de estado del usuario
- `tab-clasificacion`: Tabla de clasificación general de usuarios (puntos reales)
- `tab-resultados`: Resultados de partidos por jornada y puntos de usuarios
- `tab-pronosticos`: Wizard de predicciones de partidos
- `tab-plantilla`: Selección de plantilla ideal (25 jugadores: 3G, 8D, 8M, 6F)
- `tab-final-predictions`: Predicciones de eliminatorias (24 equipos asignados a rondas). Solo accesible tras confirmar pronósticos

**Flujo de usuario:**
1. Tras registro/login → entra directamente a pestaña Inicio
2. Los pronósticos y plantilla se guardan localmente en `localStorage`
3. Los datos se persisten automáticamente al modificar marcadores o selección
4. Desde Inicio se puede navegar a Pronósticos o Plantilla pulsando en las tarjetas de aviso
5. Desde Pronósticos se puede acceder a Eliminatorias pulsando el botón "🏆 Eliminatorias" (solo visible tras confirmar los 144 pronósticos)

### 5.2. Datos y APIs (`data/`, `api/`, `extract/`)

#### Modelos de Datos (`data/`)

Datos estáticos del torneo extraídos de SofaScore. Documentación completa en `data/README.md`.

| Fichero | Registros | Uso en la app |
| --- | --- | --- |
| `teams.json` | 36 | Equipos participantes (`id`, `name`, `idCompetition`) |
| `jugadores.json` | 1 273 | Selección de plantilla ideal (`id`, `nombre`, `posicion`, `club`, `equipo`) |
| `calendar.json` | 144 | Wizard de pronósticos (`id`, `ronda`, `fecha`, `equipoLocal`, `equipoVisitante`) |
| `imgJugadores/` | 1 273 | Imágenes de jugadores en PNG, nombradas `{id}.png` |

**Relaciones entre ficheros:**

```text
teams.json ──(id)──► jugadores.json ──(id)──► imgJugadores/{id}.png
     │
     └──(id)──► calendar.json
                    ├── equipoLocal.id
                    └── equipoVisitante.id
```

Los **códigos de acceso**, **perfiles de usuario**, **predicciones** y **clasificaciones** no residen en `data/`; se gestionan a través de `api/` (persistencia en backend o servicios externos).

#### Servicios / API (`api/`)

Módulos encargados de interactuar con el backend o servicios de persistencia de datos (códigos, usuarios, predicciones, puntuaciones).

#### Scripts de Extracción (`extract/`)

Herramientas para obtener automáticamente datos y resultados actualizados de SofaScore y generar/actualizar los ficheros de `data/`.

### 5.3. Pronósticos, Clasificación y Estadísticas (Champions League 2026/2027)
1. **Pronósticos por Jornada**: Predicciones de marcadores exactos en los 144 partidos de la fase de liga de la Champions League 2026/2027 (15 puntos máximo por partido).
2. **Clasificación General**: Tabla acumulada de puntos y aciertos por cada jugador registrado con su avatar y plantilla ideal.
3. **Estadísticas de Porra**: Tendencias comunitarias y desglose de predicciones.
4. **Pestaña Inicio**: Pantalla de bienvenida con avatar del usuario, avisos de partidos/pendientes y countdown de freeze de Champions (8 septiembre 2026).
5. **Pronóstico de Clasificación**: Predicción de la posición final de cada equipo en la fase de liga (puntos por acertar posiciones del 1º al 24º).
6. **Clasificación Pronosticada**: Pantalla dinámica que muestra la clasificación de los 36 equipos calculada a partir de los marcadores pronosticados por el usuario.

### 5.3.1. Clasificación Pronosticada (Nueva Especificación)

#### Descripción

Pantalla modal que se abre desde la pestaña de Pronósticos y muestra la clasificación resultante de los 36 equipos de la fase de liga, calculada dinámicamente a partir de los marcadores introducidos por el usuario. La clasificación se recalcula cada vez que el usuario accede a la pantalla.

#### Acceso

- **Ubicación del botón**: Cabecera de la pestaña Pronósticos, junto al botón "Guardar en servidor"
- **Etiqueta del botón**: "Ver Clasificación" (con icono de tabla/classificación)
- **Comportamiento**: Al hacer clic se abre un modal overlay sobre la pantalla de pronósticos

#### Cálculo de la Clasificación

Para cada uno de los 36 equipos se acumulan las siguientes estadísticas a partir de `AppState.scorePredictions` y `AppState.matches`:

| Estadística | Descripción | Cálculo |
|-------------|-------------|---------|
| `PJ` | Partidos jugados | Conteo de partidos pronosticados donde participa el equipo |
| `V` | Victorias | Marcador donde el equipo tiene más goles que el rival |
| `E` | Empates | Marcador donde ambos equipos tienen los mismos goles |
| `D` | Derrotas | Marcador donde el equipo tiene menos goles que el rival |
| `GF` | Goles a favor | Suma de goles marcados por el equipo |
| `GC` | Goles en contra | Suma de goles recibidos por el equipo |
| `DG` | Diferencia de goles | `GF - GC` |
| `Pts` | Puntos | `V * 3 + E * 1` |

#### Criterios de Desempate

Cuando dos o más equipos están empatados en puntos, se aplican los siguientes criterios en orden (basados en las reglas UCL de la sección 1.1):

1. **Mayor diferencia de goles** (`DG`)
2. **Mayor número de goles marcados** (`GF`)
3. **Mayor número de goles marcados como visitante** (goles en partidos donde el equipo es visitante)
4. **Mayor número de victorias** (`V`)
5. **Mayor número de victorias como visitante** (victorias donde el equipo es visitante)
6. **Mayor suma de puntos de los rivales** (suma de puntos obtenidos por cada uno de sus 8 rivales en TODOS sus partidos de la fase de liga, no solo contra el equipo en cuestión)
7. **Mayor suma de diferencia de goles de los rivales** (suma de la diferencia de goles de cada uno de sus 8 rivales en TODOS sus partidos de la fase de liga)
8. **Mayor suma de goles marcados por los rivales** (suma de goles marcados por cada uno de sus 8 rivales en TODOS sus partidos de la fase de liga)

> **Nota**: Los criterios 9-10 (tarjetas y coeficiente UEFA) no son calculables con predicciones y se omiten.

> **Optimización de rendimiento**: Los criterios de desempate solo se aplican cuando es necesario. Los criterios 1-5 se evalúan secuencialmente y se detienen en el primero que resuelve el empate. Los criterios 6-8 (más costosos computacionalmente) solo se calculan si persiste el empate tras los 5 primeros, y únicamente para los equipos implicados en dicho empate.

#### Orden de la Tabla

Los equipos se ordenan de mayor a menor puntuación, aplicando los criterios de desempate secuencialmente:

```
1. Puntos (descendente)
2. Diferencia de goles (descendente)
3. Goles marcados (descendente)
4. Goles marcados como visitante (descendente)
5. Victorias (descendente)
6. Victorias como visitante (descendente)
7. Suma de puntos de los rivales (descendente)
8. Suma de diferencia de goles de los rivales (descendente)
9. Suma de goles marcados por los rivales (descendente)
```

#### Diseño de la Pantalla (Modal Overlay)

```
┌─────────────────────────────────────────┐
│  ← CLASIFICACIÓN PRONOSTICADA     (X)   │
├─────────────────────────────────────────┤
│  Partidos pronosticados: 108/144        │
│  ████████████████░░░░ 75%               │
├─────────────────────────────────────────┤
│  #  │ Escudo │ Equipo         │Pts│DG│GF│GC│V│E│D│
│  1  │ [img]  │ FC Barcelona   │24 │+16│28│12│8│0│0│
│  2  │ [img]  │ Real Madrid    │21 │+12│24│12│7│0│1│
│  3  │ [img]  │ Arsenal        │21 │+10│22│12│7│0│1│
│  ...│        │                │   │   │  │  │ │ │ │
│  36 │ [img]  │ Kairat Almaty  │ 0 │-20│ 4│24│0│0│8│
├─────────────────────────────────────────┤
│  Pts=Puntos  DG=Dif.Goles  GF=Goles+   │
│  GC=Goles-   V=Victorias   E=Empates    │
│  D=Derrotas                             │
└─────────────────────────────────────────┘
```

#### Elementos UI

1. **Cabecera del modal**:
   - Título "CLASIFICACIÓN PRONOSTICADA"
   - Botón (X) para cerrar el modal
   - Barra de progreso con contador de partidos pronosticados

2. **Tabla clasificatoria**:
   - Columna `#`: Posición del equipo (1-36)
   - Columna `Escudo`: Imagen del escudo del equipo (`data/imgEquipos/{id}.{ext}`)
   - Columna `Equipo`: Nombre del equipo
   - Columna `Pts`: Puntos totales
   - Columna `DG`: Diferencia de goles (con prefijo + o -)
   - Columna `GF`: Goles a favor
   - Columna `GC`: Goles en contra
   - Columna `V`: Victorias
   - Columna `E`: Empates
   - Columna `D`: Derrotas

3. **Pie de tabla**:
   - Leyenda de siglas (Pts, DG, GF, GC, V, E, D)

4. **Estilos**:
   - Modal overlay con fondo oscuro semitransparente
   - Tabla con scroll vertical si el contenido excede la pantalla
   - Estilos consistentes con el diseño existente (modo oscuro, variables CSS)
   - Filas alternas con opacidad sutil para legibilidad

#### Funciones JavaScript

| Función | Responsabilidad |
|---------|-----------------|
| `calculateStandings()` | Calcula la clasificación de los 36 equipos. Primero obtiene estadísticas básicas de cada equipo, luego calcula estadísticas de rivales **solo para equipos empatados en puntos** (criterios 6-8), y finalmente ordena según criterios de desempate UCL. Devuelve array ordenado. |
| `getTeamStats(teamId)` | Calcula estadísticas individuales de un equipo: PJ, V, E, D, GF, GC, DG, Pts, awayWins, awayGoals. |
| `getRivalsStats(teamId)` | Calcula las estadísticas acumuladas de los 8 rivales de un equipo en TODOS sus partidos. Devuelve `{ rivalPointsSum, rivalGDSum, rivalGFSum }` para los criterios 6-8. Solo se invoca cuando hay empate en puntos. |
| `findTeamMatches(teamId)` | Busca en `AppState.matches` todos los partidos donde participa un equipo (local o visitante). Usado por `getRivalsStats`. |
| `sortTeams(teams)` | Ordena array de equipos. Primero agrupa por puntos, luego aplica criterios 1-5 a cada grupo. Si hay empates persistentes, calcula criterios 6-8 **solo para los equipos empatados**. |
| `renderPredictedStandings()` | Genera HTML del modal con barra de progreso y tabla clasificatoria |
| `showPredictedStandingsModal()` | Abre el modal, calcula clasificación y renderiza |
| `closePredictedStandingsModal()` | Cierra el modal y limpia estado |

#### Estado de la Aplicación

No se añaden nuevas propiedades a `AppState`. La clasificación se calcula on-demand cada vez que se abre el modal.

#### Persistencia

- **No requiere persistencia**: La clasificación es un cálculo derivado de los pronósticos existentes
- **Cálculo dinámico**: Se recalcula al abrir el modal (no se almacena)

#### Datos Requeridos

- `AppState.scorePredictions`: Predicciones de marcadores del usuario `{ matchId: { home: number|null, away: number|null } }`
- `AppState.matches`: Array de partidos con `{ id, homeTeamId, awayTeamId, ... }`
- `AppState.teamsMap`: Mapa de equipos `{ teamId: { name, ext } }`
- `data/imgEquipos/{id}.{ext}`: Imágenes de escudos de equipos

### 5.3.2. Clasificación de Usuarios (Puntos Reales)

#### Descripción

Pestaña que muestra la clasificación de todos los participantes calculada con puntos reales obtenidos de las predicciones vs resultados reales almacenados en MongoDB (colección `matchstats`).

#### Reglas de Puntuación

Para cada partido con resultado disponible en `matchstats`, se calculan los puntos según las reglas de la sección 1.1:

| Concepto | Puntos | Descripción |
|----------|--------|-------------|
| Acierto de resultado (V/E/D) | 8 | El pronóstico indica el mismo resultado que el real (victoria local, empate o victoria visitante) |
| Acierto de goles del equipo local | 3 | Los goles pronosticados del equipo local coinciden con los reales |
| Acierto de goles del equipo visitante | 3 | Los goles pronosticados del equipo visitante coinciden con los reales |
| Acierto de goles de ambos equipos | 1 | Ambos goles (local y visitante) coinciden con los reales |
| **Máximo por partido** | **15** | |

#### Lógica de Cálculo

```javascript
// Para cada partido con resultado en matchstats:
function calculateMatchPoints(prediction, matchStats, match) {
  // prediction: { home: number, away: number } del usuario
  // matchStats.stats: { teamId: { goles: number }, ... }
  // match: { homeTeamId, awayTeamId, ... }
  
  const realHome = matchStats.stats[match.homeTeamId].goles;
  const realAway = matchStats.stats[match.awayTeamId].goles;
  
  let points = 0;
  let breakdown = [];
  
  // Acierto de resultado (V/E/D)
  const predResult = getMatchResult(prediction.home, prediction.away);
  const realResult = getMatchResult(realHome, realAway);
  if (predResult === realResult) {
    points += 8;
    breakdown.push('8 por acertar resultado');
  }
  
  // Acierto de goles local
  if (prediction.home === realHome) {
    points += 3;
    breakdown.push('3 por goles local');
  }
  
  // Acierto de goles visitante
  if (prediction.away === realAway) {
    points += 3;
    breakdown.push('3 por goles visitante');
  }
  
  // Acierto de ambos goles
  if (prediction.home === realHome && prediction.away === realAway) {
    points += 1;
    breakdown.push('1 por ambos goles');
  }
  
  return { points, breakdown };
}

function getMatchResult(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return 'H'; // Home win
  if (homeGoals < awayGoals) return 'A'; // Away win
  return 'D'; // Draw
}
```

#### Cálculo Total por Usuario

```javascript
function calculateUserTotalPoints(username, allMatchStats) {
  const predictions = AppState.allPredictions[username]; // Todas las predicciones del usuario
  let totalPoints = 0;
  let matchDetails = [];
  
  for (const match of AppState.matches) {
    const matchStats = allMatchStats.find(ms => ms.eventId === match.id);
    if (!matchStats) continue; // Partido sin resultado aún
    
    const prediction = predictions?.[match.id];
    if (!prediction || prediction.home === null || prediction.away === null) {
      // Partido no pronosticado
      matchDetails.push({
        match,
        points: 0,
        breakdown: ['Partido no pronosticado']
      });
      continue;
    }
    
    const { points, breakdown } = calculateMatchPoints(prediction, matchStats, match);
    totalPoints += points;
    matchDetails.push({ match, points, breakdown });
  }
  
  return { totalPoints, matchDetails };
}
```

#### Fuente de Datos

- **Predicciones de todos los usuarios**: `GET /api/predictions/all` (nuevo endpoint necesario)
- **Resultados de partidos**: `GET /api/match-stats` (nuevo endpoint necesario, devuelve todos los matchstats)
- **Lista de usuarios**: `GET /api/players`

#### Diseño de la Pantalla

```
┌─────────────────────────────────────────┐
│  CLASIFICACIÓN                          │
├─────────────────────────────────────────┤
│  Partidos con resultado: 18/144         │
│  ████████░░░░░░░░░░░░ 12.5%             │
├─────────────────────────────────────────┤
│  # │ Avatar │ Usuario      │ Puntos     │
│  1 │  ⚽    │ juan123      │ 145 pts    │
│  2 │  🏆    │ maria456     │ 132 pts    │
│  3 │  🦁    │ pedro789     │ 128 pts    │
│  ...                                    │
├─────────────────────────────────────────┤
│  Pulsar en usuario para ver desglose    │
└─────────────────────────────────────────┘
```

#### Perfil de Usuario (Modal con 2 tabs)

Al pulsar en un usuario se abre un modal con 2 pestañas: **Pronósticos** y **Plantilla**.

##### Tab 1: Pronósticos

Muestra todos los pronósticos del usuario vs resultados reales, agrupados por jornada.

- Se muestran **todos los partidos pronosticados** por el usuario
- Para partidos con resultado en matchstats, se muestra el resultado real y los puntos obtenidos
- Para partidos sin resultado, se muestra "Pendiente"

```
┌─────────────────────────────────────────┐
│  ← PERFIL: juan123               (X)   │
├─────────────────────────────────────────┤
│  [Pronósticos]  [Plantilla]             │
├─────────────────────────────────────────┤
│  JORNADA 1                              │
│  ┌─────────────────────────────────┐    │
│  │ Athletic Club                   │    │
│  │ Pronóstico: 2 - 1               │    │
│  │ Real:       0 - 2               │    │
│  │ → 3 pts (3 por goles local)     │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ PSV Eindhoven                   │    │
│  │ Pronóstico: 1 - 1               │    │
│  │ Real:       1 - 1               │    │
│  │ → 15 pts (8+3+3+1)             │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ Benfica                         │    │
│  │ Pronóstico: 2 - 0               │    │
│  │ Real:       ⏳ Pendiente         │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  Total: 48 pts                          │
└─────────────────────────────────────────┘
```

##### Tab 2: Plantilla

Muestra los 25 jugadores de la plantilla del usuario, agrupados por posición, con los puntos acumulados de cada jugador.

**Posiciones**: Portero, Defensa, Centrocampista, Delantero (nombres completos).

**Puntuación de jugadores**: Se calcula según las reglas de puntuación de la plantilla ideal definidas en la sección 1.1 (rating Sofascore, goles por demarcación, portería a cero, penaltis parados). Al pulsar sobre un jugador se muestra el desglose por partido.

```
┌─────────────────────────────────────────┐
│  ← PERFIL: juan123               (X)   │
├─────────────────────────────────────────┤
│  [Pronósticos]  [Plantilla]             │
├─────────────────────────────────────────┤
│  PORTEROS                               │
│  ┌─────┐ ┌─────┐ ┌─────┐              │
│  │ foto│ │ foto│ │ foto│              │
│  │ Don │ │ Cour│ │ Neuer│              │
│  │ 14  │ │ 13  │ │ 14  │              │
│  └─────┘ └─────┘ └─────┘              │
│  DEFENSAS                               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │ ... │ │ ... │ │ ... │ │ ... │     │
│  └─────┘ └─────┘ └─────┘ └─────┘     │
│  CENTROCAMPISTAS                        │
│  ...                                    │
│  DELANTEROS                             │
│  ...                                    │
├─────────────────────────────────────────┤
│  Puntos totales plantilla: 181          │
└─────────────────────────────────────────┘
```

#### Funciones JavaScript

| Función | Responsabilidad |
|---------|-----------------|
| `fetchMatchStats()` | Obtiene todos los matchstats del backend y los almacena en `AppState.matchStats` |
| `fetchAllPredictions()` | Obtiene las predicciones de todos los usuarios del backend |
| `calculateMatchPoints(prediction, matchStats, match)` | Calcula puntos y desglose de predicciones para un partido individual |
| `calculateUserTotalPoints(username)` | Calcula puntos totales de predicciones y desglose detallado para un usuario |
| `calculatePlayerMatchPoints(playerData, squadPlayer, matchStat)` | Calcula puntos de un jugador de plantilla en un partido (rating, goles, portería a cero, penaltis) |
| `calculateSquadPoints(squad, matchStats)` | Calcula puntos de toda la plantilla de un usuario con desglose por jugador y partido |
| `renderClasificacionTab()` | Renderiza la pestaña de clasificación con puntos totales (predicciones + plantilla) |
| `showUserProfileModal(username)` | Abre modal con 2 tabs: pronósticos y plantilla del usuario |
| `showPlayerPointsBreakdown(detail)` | Abre modal con desglose de puntos de un jugador por partido |
| `renderSquadTab(container, username)` | Renderiza la tab de plantilla con puntos calculados y desglose |
| `getMatchResult(homeGoals, awayGoals)` | Devuelve 'H', 'A' o 'D' según el resultado del partido |

#### Estado de la Aplicación

```javascript
AppState.matchStats = [];           // Array de todos los matchstats del backend
AppState.allPredictions = {};       // { username: { matchId: { home, away } } }
AppState.userPoints = {};           // { username: { totalPoints, matchDetails } }
AppState.squadsCache = {};          // { username: squad[] } - caché de plantillas para resultados
```

#### Persistencia

- **No requiere persistencia local**: Los datos se obtienen del backend
- **Cálculo dinámico**: Se recalcula al abrir la pestaña o al recibir nuevos datos

### 5.3.3. Resultados por Jornada (Nueva Especificación)

#### Descripción

Pestaña que muestra los resultados de los partidos jugados, agrupados por jornada, y debajo de cada jornada un desglose de los puntos obtenidos por cada jugador en esos partidos.

#### Criterio de Visibilidad

Solo se muestran las **jornadas que tengan al menos un partido con resultado** en `matchstats`. Las jornadas sin partidos disputados no se muestran.

#### Diseño de la Pantalla

```
┌─────────────────────────────────────────┐
│  RESULTADOS                             │
├─────────────────────────────────────────┤
│  JORNADA 1 (6 partidos)                 │
├─────────────────────────────────────────┤
│  Athletic Club  0 - 2  Arsenal          │
│  ─────────────────────────────────────  │
│  Puntos por jugador:                    │
│  juan123: 11 pts (8 por acertar         │
│           resultado, 3 por goles local) │
│  maria456: 3 pts (3 por goles local)    │
│  pedro789: 0 pts (Partido no            │
│            pronosticado)                │
│  ─────────────────────────────────────  │
│  PSV  1 - 1  Royale Union               │
│  ─────────────────────────────────────  │
│  Puntos por jugador:                    │
│  juan123: 8 pts (8 por acertar          │
│           resultado)                    │
│  maria456: 12 pts (8 por acertar        │
│            resultado, 3 por goles       │
│            local, 1 por ambos goles)    │
│  pedro789: 0 pts (Partido no            │
│            pronosticado)                │
│  ...                                    │
├─────────────────────────────────────────┤
│  JORNADA 2 (6 partidos)                 │
│  ...                                    │
└─────────────────────────────────────────┘
```

#### Estructura de Datos

```javascript
// Datos procesados para renderizado
AppState.resultsByJourney = [
  {
    journey: 'Jornada 1',
    matches: [
      {
        match: { id: 14566909, homeTeam: 'Athletic Club', awayTeam: 'Arsenal', ... },
        stats: { home: 0, away: 2 },
        playerPoints: [
          { username: 'juan123', points: 11, breakdown: ['8 por acertar resultado', '3 por goles local'] },
          { username: 'maria456', points: 3, breakdown: ['3 por goles local'] },
          { username: 'pedro789', points: 0, breakdown: ['Partido no pronosticado'] }
        ]
      },
      // ... más partidos de la jornada
    ]
  },
  // ... más jornadas
];
```

#### Flujo de Datos

1. **Obtener matchstats**: `GET /api/match-stats` → Array de todos los partidos con resultado
2. **Obtener predicciones**: `GET /api/predictions/all` → Predicciones de todos los usuarios
3. **Agrupar por jornada**: Usar `AppState.matches` para obtener la jornada de cada partido
4. **Calcular puntos**: Para cada partido, calcular puntos de cada usuario
5. **Renderizar**: Mostrar jornadas con partidos, partidos con resultado, puntos por usuario

#### Funciones JavaScript

| Función | Responsabilidad |
|---------|-----------------|
| `renderResultadosTab()` | Renderiza la pestaña completa de resultados |
| `groupMatchesByJourney()` | Agrupa los partidos con resultado por jornada |
| `renderJourneySection(journey)` | Renderiza una sección de jornada con sus partidos |
| `renderMatchResult(match, stats)` | Renderiza el resultado de un partido |
| `renderPlayerPointsForMatch(match, playerPoints)` | Renderiza los puntos de cada jugador para un partido |

#### Diseño Visual

- **Jornadas**: Encabezado con nombre de jornada y número de partidos disputados
- **Partidos**: Tarjeta con equipos, escudos y marcador
- **Puntos**: Lista debajo de cada partido con usuario, puntos y desglose
- **Partidos no pronosticados**: Mostrar "Partido no pronosticado - 0 puntos"
- **Colores**: Usar colores del sistema de diseño existente (verde para aciertos, gris para sin pronóstico)

### 5.4. Plantilla Ideal (Nueva Especificación)

#### Estructura de la Plantilla

La plantilla ideal consta de **25 jugadores** distribuidos por posición:

| Posición | Cantidad | Etiqueta |
|----------|----------|----------|
| **G** (Portero) | 3 | Porteros |
| **D** (Defensa) | 8 | Defensas |
| **M** (Centrocampista) | 8 | Centrocampistas |
| **F** (Delantero) | 6 | Delanteros |

#### Restricciones

1. **Un solo jugador por equipo**: No pueden repetirse equipos entre los 25 jugadores seleccionados (36 equipos disponibles, 25 posiciones → siempre habrá equipos disponibles).
2. **Distribución fija por posición**: Se deben respetar las cantidades exactas por cada tipo de jugador.
3. **Sin duplicados**: Un jugador no puede seleccionarse más de una vez.

#### Interfaz de Selección (UI)

La pantalla de selección muestra **25 casillas** agrupadas por posición:

```
┌─────────────────────────────────────┐
│         PLANTILLA IDEAL             │
├─────────────────────────────────────┤
│ PORTEROS (0/3)                      │
│ ┌─────┐ ┌─────┐ ┌─────┐            │
│ │  +  │ │  +  │ │  +  │            │
│ └─────┘ └─────┘ └─────┘            │
├─────────────────────────────────────┤
│ DEFENSAS (0/8)                      │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │  +  │ │  +  │ │  +  │ │  +  │   │
│ └─────┘ └─────┘ └─────┘ └─────┘   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │  +  │ │  +  │ │  +  │ │  +  │   │
│ └─────┘ └─────┘ └─────┘ └─────┘   │
├─────────────────────────────────────┤
│ CENTROCAMPISTAS (0/8)               │
│ ... (similar a defensas)            │
├─────────────────────────────────────┤
│ DELANTEROS (0/6)                    │
│ ... (6 casillas)                    │
└─────────────────────────────────────┘
```

**Flujo de interacción:**

1. El usuario ve las 25 casillas vacías agrupadas por posición con contador (ej: "PORTEROS (0/3)")
2. Al hacer clic en una casilla vacía → Se abre panel de búsqueda filtrado por esa posición
3. El panel muestra jugadores de la posición seleccionada, excluyendo equipos ya bloqueados
4. Al seleccionar un jugador → Se asigna a la casilla, se bloquea su equipo, se actualiza contador
5. Al hacer clic en una casilla con jugador → Se muestra el jugador con opción de eliminar (X)
6. Al eliminar → Se desbloquea el equipo si no queda ningún otro jugador de ese equipo

#### Estado de la Aplicación

```javascript
AppState.squadPicks = [];        // Array de hasta 25 jugadores
AppState.activeSlot = null;      // { position: 'G', index: 0 } - casilla activa
AppState.blockedTeams = new Set(); // IDs de equipos ya elegidos
```

#### Constantes

```javascript
const SQUAD_SIZE = 25;
const SQUAD_FORMATION = {
  G: { count: 3, label: 'Porteros' },
  D: { count: 8, label: 'Defensas' },
  M: { count: 8, label: 'Centrocampistas' },
  F: { count: 6, label: 'Delanteros' }
};
```

#### Funciones Principales

| Función | Responsabilidad |
|---------|-----------------|
| `renderPlantillaTab()` | Renderiza toda la pestaña con casillas agrupadas |
| `renderSquadSlots()` | Genera HTML de las 25 casillas por posición |
| `openSlotSearch(position)` | Abre panel de búsqueda filtrado por posición |
| `selectPlayerForSlot(playerId)` | Asigna jugador a la casilla activa |
| `addPlayerToSquad(playerId)` | Valida y añade jugador al estado |
| `removePlayerFromSquad(index)` | Elimina jugador y desbloquea equipo |
| `validateSquad()` | Comprueba plantilla completa y válida |
| `saveSquadToBackend()` | Envía plantilla al servidor via PUT /api/squad |
| `refreshSquadUI()` | Refresca todas las casillas y contadores |

#### Persistencia

- **localStorage**: Clave `porra_ucl_squad` para persistencia local
- **Backend**: Endpoint `PUT /api/squad` para persistencia en servidor
- **Sincronización**: Al cargar la app, se obtiene plantilla del backend si existe

### 5.5. Eliminatorias (Predicciones de Eliminatorias)

#### Descripción

Pestaña que permite al usuario predecir el cuadro completo de eliminatorias de la Champions League, asignando los 24 equipos clasificados de la fase de liga a cada ronda: campeón, subcampeón, semifinalistas, cuartos de final, octavos de final y dieciseisavos.

**Importante:** Los equipos disponibles se calculan a partir de la **clasificación pronosticada** por el usuario (no la clasificación real). La pestaña solo es accesible tras confirmar los 144 pronósticos de liga.

#### Distribución de Equipos

| Ronda | Cantidad | Descripción |
|-------|----------|-------------|
| Campeón | 1 | Equipo ganador de la Champions League |
| Subcampeón | 1 | Equipo finalista |
| Semifinalistas | 2 | Equipos en semifinales |
| Cuartos de final | 4 | Equipos en cuartos de final |
| Octavos de final | 8 | Equipos en octavos de final |
| Dieciseisavos | 8 | Equipos en treintaidosavos (ronda previa) |
| **Total** | **24** | Los 24 equipos de la fase de liga |

#### Restricciones

1. **Requiere confirmación**: La pestaña solo es accesible tras confirmar los 144 pronósticos de liga (`predictionsConfirmed = true`)
2. **24 equipos**: Se asignan los 24 equipos de la clasificación pronosticada por el usuario (puestos 1-24)
3. **Sin repetir equipos**: Cada equipo solo puede asignarse a una ronda
4. **Congelación**: Las predicciones de eliminatorias se pueden guardar mientras `predictionsConfirmed` sea true. Una vez confirmado, los pronósticos de liga no se pueden editar
5. **Edición**: Los usuarios pueden modificar sus predicciones de eliminatorias libremente

#### Interfaz de Selección (UI)

La pantalla utiliza un sistema de **selección por toque** (tap-to-place):

```
┌─────────────────────────────────────────┐
│  ← Volver  [Guardar]    🏆 ELIMINATORIAS │
├─────────────────────────────────────────┤
│  Selecciona un equipo y toca una casilla │
├─────────────────────────────────────────┤
│  Equipos disponibles (24)               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ img │ │ img │ │ img │ │ img │ ...   │
│  │Team1│ │Team2│ │Team3│ │Team4│       │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
├─────────────────────────────────────────┤
│  🏆 Campeón        🥈 Subcampeón        │
│  ┌──────────┐     ┌──────────┐         │
│  │    +     │     │    +     │         │
│  └──────────┘     └──────────┘         │
├─────────────────────────────────────────┤
│  ⚔️ Semifinalistas (2)                  │
│  ┌──────┐ ┌──────┐                     │
│  │  +   │ │  +   │                     │
│  └──────┘ └──────┘                     │
├─────────────────────────────────────────┤
│  🏅 Cuartos de final (4)                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  +   │ │  +   │ │  +   │ │  +   │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
├─────────────────────────────────────────┤
│  ⚡ Octavos de final (8)                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  +   │ │  +   │ │  +   │ │  +   │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  +   │ │  +   │ │  +   │ │  +   │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
├─────────────────────────────────────────┤
│  📋 Dieciseisavos (8)                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  +   │ │  +   │ │  +   │ │  +   │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  +   │ │  +   │ │  +   │ │  +   │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
└─────────────────────────────────────────┘
```

**Flujo de interacción:**

1. **Seleccionar equipo**: Toca un equipo en la lista de disponibles (se resalta con borde cyan)
2. **Asignar a ronda**: Toca una casilla vacía en la ronda deseada
3. **Eliminar asignación**: Toca el botón ✕ en una casilla ocupada
4. **Deseleccionar**: Toca de nuevo el equipo seleccionado para quitar la selección
5. **Guardar**: Pulsa "Guardar" en la cabecera para persistir en el servidor

**Layout de la pantalla:**

- **Header fijo** (`.final-predictions-fixed`): Banner de freeze, hint de selección, pool de equipos
- **Área scrolleable** (`.final-predictions-scroll`): Podium (campeón/subcampeón) + zonas de drop

**Colores por ronda (border-left):**
- Campeón: `--accent-gold` + 🏆
- Subcampeón: `--accent-silver` + 🥈
- Semifinalistas: `--accent-primary` (violeta) + ⚔️
- Cuartos: `--accent-cyan` + 🏅
- Octavos: `--accent-green` + ⚡
- Dieciseisavos: `--text-muted` (gris) + 📋

#### Estado de la Aplicación

```javascript
AppState.finalPredictions = null;      // Objeto con predicciones o null
AppState.selectedFinalTeam = null;     // ID del equipo seleccionado en el pool
AppState.hasUnsavedFinalChanges = false; // Bandera de cambios sin guardar
```

**Estructura de `finalPredictions`:**

```javascript
{
  champion: Number | null,       // ID del equipo campeón
  runnerUp: Number | null,       // ID del equipo subcampeón
  semiFinalists: [Number],       // Array de IDs (máx 2)
  quarterFinalists: [Number],    // Array de IDs (máx 4)
  roundOf16: [Number],           // Array de IDs (máx 8)
  roundOf32: [Number]            // Array de IDs (máx 8)
}
```

#### Funciones JavaScript

| Función | Responsabilidad |
|---------|-----------------|
| `renderFinalPredictionsTab()` | Renderiza la pestaña completa: header fijo, pool de equipos, podium y zonas de drop |
| `setupFinalPredictionsTapToPlace()` | Configura listeners de click para chips del pool, slots vacíos del podium y drop zones |
| `addTeamToZone(teamId, zoneId, index)` | Asigna un equipo a una zona específica (champion, runnerUp, semiFinalists, etc.) |
| `removeTeamFromZone(zoneId, index)` | Elimina un equipo de una zona y lo devuelve al pool |
| `saveFinalPredictionsToBackend()` | Guarda las predicciones en el servidor via PUT /api/final-predictions |
| `fetchFinalPredictionsFromBackend()` | Obtiene las predicciones del servidor y las carga en AppState |
| `isFinalsFrozen()` | Comprueba si la fecha actual supera `finalsFreezeDate` |
| `showUnsavedFinalChangesModal()` | Muestra modal de confirmación si hay cambios sin guardar |

#### Persistencia

- **Backend**: Endpoint `GET/PUT /api/final-predictions` para persistencia en MongoDB
- **Campo en User schema**: `finalPredictions` (Mixed type)
- **Freeze**: Controlado por `finalsFreezeDate` en config.json

#### Datos Requeridos

- `AppState.realStandings`: Array de equipos clasificados de la fase de liga (puestos 1-24)
- `AppState.teamsMap`: Mapa de equipos `{ teamId: { name, ext } }`
- `data/imgEquipos/{id}.{ext}`: Imágenes de escudos de equipos



## Reglas basicas de la porra

- Desde la fecha actual hasta el día antes del primer partido de la jornada 1 cada usuario podra ver y modificar su plantilla y sus pronosticos de resultados
- Los demas jugadores no podran durante este tiempo ver la plantilla ni los pronosticos de resultados de los otros, cada uno ve lo suyo (esto va por la pantalla de clasificacion donde puedes pinchar en otro jugador y ver su plantilla y resultados)
- Una vez enpezada la jornada 1 se bloqueara el acceso a la edicion de la plantilla y los pronosticos de resultados para todos los jugadores (la fecha estara definida en "championsFreezeDate") y los demas jugadores tendran acceso a ver la plantilla y los pronosticos de resultados de los otros desde clasificacion.
- Los partidos se iran subiendo a medida que se conozcan los resultados mediante el script de api-porra math-stats
- Según se vayan subiendo partidos el usuario deberia poder verlos en la app (hay que ver si tenemos esto ya imlpementado, no se si al subir uno o varios partidos el usuario ya los tendria disponibles)



