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

### Estructura de Directorios
```text
/
├── index.html        # Punto de entrada de la SPA
├── css/
│   └── styles.css    # Sistema de diseño, variables y estilos globales
├── js/
│   └── main.js       # Lógica principal y control de navegación
├── assets/           # Imágenes, iconos y recursos estáticos
├── data/             # Datos estáticos del torneo (ver data/README.md)
│   ├── README.md     # Esquemas, relaciones y documentación de modelos
│   ├── teams.json    # 36 equipos participantes
│   ├── jugadores.json # 1 273 jugadores para la plantilla ideal
│   ├── calendar.json # 144 partidos de la fase de grupos (8 jornadas)
│   └── imgJugadores/ # Fotos PNG de jugadores ({id}.png)
├── api/              # Ficheros de acceso e integración con las diferentes APIs necesarias
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
1. **Control de Acceso Bloqueado**:
   - Si el usuario aún no está registrado/autenticado, la aplicación mantendrá deshabilitadas las opciones de realizar pronósticos, consultar clasificaciones y demás acciones.
   - En su lugar, la pantalla principal mostrará una caja de entrada donde el usuario debe introducir el **código de acceso exclusivo** que se le enviará por WhatsApp o correo electrónico.

2. **Validación del Código**:
   - Al introducir el código, se verificará contra la base de datos (o archivo de datos del sistema).
   - Si el código **no existe**, se mostrará un mensaje de error claro y se denegará el acceso.

3. **Uso Único de Código**:
   - Cada código solo podrá ser utilizado una única vez por un usuario.
   - Tras el uso correcto, se registrará en la base de datos que dicho código ha sido consumido y se vincularán los datos referentes al usuario (Nombre, Nickname, Avatar, Predicciones de partidos y Plantilla ideal).

4. **Registro de Perfil (Nombre y Avatar)**:
   - Tras validar el código correctamente, se solicitará al usuario que introduzca su **Nombre de Jugador** y seleccione un **Avatar** personalizado para distinguirse en las clasificaciones.

5. **Registro de Predicción de Porra**:
   - Una vez introducidos el nombre/nickname y el avatar, se iniciará el asistente paso a paso (*wizard*) para completar las predicciones de los partidos de las 8 jornadas de la fase de grupos y la selección de la plantilla ideal.

6. **Predicción de Partidos (Wizard Paso a Paso)**:
   - Los partidos se obtienen de `data/calendar.json` (144 encuentros, 8 jornadas de 18 partidos).
   - Se mostrarán al usuario los partidos de la pantalla **de uno en uno**.
   - El usuario podrá introducir de manera fácil y táctil el **número de goles** que marcará cada equipo (con controles `+` / `-`).
   - Los equipos se mostrarán con su nombre y escudo (referenciados por `id` contra `data/teams.json`).
   - Botón **Siguiente** para avanzar y botón **Anterior** para ir marcha atrás si desea revisar o corregir alguna predicción.
   - En la parte superior se mostrará un **contador de progreso** con los partidos pronosticados y restantes.
   - Cada cambio de marcador se guardará de manera local para no perder información en ningún momento.

7. **Predicción de Plantilla Ideal**:
   - Una vez terminada la predicción de partidos, se mostrará la interfaz para confeccionar la **Plantilla Ideal de la Champions League**.
   - El usuario deberá seleccionar 4 posiciones clave: **un Portero (POR), un Defensa (DEF), un Centrocampista (MED) y un Delantero (DEL)**.
   - Los jugadores disponibles provienen de `data/jugadores.json`, filtrados por código de posición: `G` → POR, `D` → DEF, `M` → MED, `F` → DEL.
   - Cada jugador se muestra con su foto desde `data/imgJugadores/{id}.png`.
   - Al completar la plantilla ideal, el usuario pulsará el botón para finalizar y guardar su porra completa.

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
