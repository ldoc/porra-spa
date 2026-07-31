# Directrices para Agentes de IA y Especificaciones del Proyecto

Este documento establece las normas de desarrollo, la arquitectura de código y las especificaciones del producto para la aplicación **Porra SPA**. Todos los agentes de IA (incluyendo Gemini) deben consultar y cumplir estas pautas en cada interacción o cambio en la base de código.

---

## 1. Visión del Producto

**Porra SPA** es una aplicación web (Single Page Application) orientada a la participación en una porra para la **UEFA Champions League de la temporada 2026/2027**.

- **Público Objetivo**: Usuarios conocidos a los cuales se les proporcionará un código de acceso único para realizar sus predicciones, consultar sus puntuaciones, la clasificación del resto de jugadores y otras estadísticas relativas al torneo.
- **Dispositivos**: Conexión orientada principalmente a dispositivos móviles (smartphones), con soporte responsivo para PC / laptops.
- **Experiencia de Usuario (UX)**: Diseño nativo app-like, fluido, rápido e intuitivo.
- **Orientación Exclusiva**: **Vertical (Portrait mode)**. Toda la interfaz debe estar diseñada, optimizada y probada para pantallas verticales.

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
│   ├── calendar.json # 144 partidos de la fase de grupos (8 jornadas)
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

// Login
POST /api/auth/login
Body: { username, password }
Response: { ok, token, user: { username, avatar } }

// Registro
POST /api/auth/register
Body: { username, password, invitationCode }
Response: { ok, token, user: { username } }

// Obtener perfil
GET /api/auth/profile?username=nombreusuario
Response: { ok, avatar }

// Guardar perfil
POST /api/auth/profile
Body: { username, avatar }
Response: { ok, avatar }

// Configuración del torneo
GET /api/config
Response: { ok, config: { championsFreezeDate, championsFreezeLabel, totalMatches, squadSize } }

// Avatares ya cogidos
GET /api/avatars/taken
Response: { ok, taken: ["⚽", "🏆", ...] }
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
  "username": "nombreusuario",
  "passwordHash": "salt:hash",
  "avatar": "⚽",
  "createdAt": "2026-07-31T00:00:00.000Z"
}
```

#### Cierre de Sesión

- El botón "Cerrar Sesión" en la pestaña Perfil elimina `session_token` y `porra_ucl_user` de localStorage.
- Se muestra el overlay de autenticación.

#### Navegación de la Aplicación

La aplicación utiliza una estructura de navegación con:

1. **Header Superior**: Muestra avatar y nombre del usuario. Al hacer clic, accede a la pestaña Perfil.
2. **Menú Inferior (4 items)**:
   - **Inicio**: Pantalla de bienvenida con avisos de pendientes y freeze de Champions
   - **Clasificación**: Tabla de posiciones de todos los participantes
   - **Pronósticos**: Wizard para introducir marcadores de los 144 partidos
   - **Plantilla**: Selección de 11 jugadores para la plantilla ideal

**Pestañas disponibles:**
- `tab-inicio`: Pantalla de bienvenida con resumen de estado del usuario
- `tab-clasificacion`: Tabla de clasificación general
- `tab-pronosticos`: Wizard de predicciones de partidos
- `tab-plantilla`: Selección de plantilla ideal (11 jugadores)

**Flujo de usuario:**
1. Tras registro/login → entra directamente a pestaña Inicio
2. Los pronósticos y plantilla se guardan localmente en `localStorage`
3. Los datos se persisten automáticamente al modificar marcadores o selección
4. Desde Inicio se puede navegar a Pronósticos o Plantilla pulsando en las tarjetas de aviso

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
1. **Pronósticos por Jornada**: Apuestas y marcadores exactos en los encuentros de la Champions League 2026/2027.
2. **Clasificación General**: Tabla acumulada de puntos y aciertos por cada jugador registrado con su avatar y plantilla ideal.
3. **Estadísticas de Porra**: Tendencias comunitarias y desglose de predicciones.
4. **Pestaña Inicio**: Pantalla de bienvenida con avatar del usuario, avisos de partidos/pendientes y countdown de freeze de Champions.
