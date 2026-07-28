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
├── data/             # Ficheros JSON con información de jugadores, equipos, partidos, etc.
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
   - Tras el uso correcto, se registrará en la base de datos que dicho código ha sido consumido.

4. **Registro de Perfil (Nombre y Avatar)**:
   - Tras validar el código correctamente, se solicitará al usuario que introduzca su **Nombre de Jugador** y seleccione un **Avatar** personalizado para distinguirse en las clasificaciones.
   - Esta información de perfil y avatar quedará vinculada al usuario en la base de datos.

### 5.2. Datos y APIs (`data/`, `api/`, `extract/`)
1. **Modelos de Datos (`data/`)**: Almacenamiento estructurado JSON de jugadores, equipos de la Champions League 2026/2027, partidos, jornadas y predicciones.
2. **Servicios / API (`api/`)**: Módulos encargados de interactuar con el backend o servicios de persistencia de datos.
3. **Scripts de Extracción (`extract/`)**: Herramientas para obtener automáticamente datos y resultados actualizados de SofaScore.

### 5.3. Pronósticos, Clasificación y Estadísticas (Champions League 2026/2027)
1. **Pronósticos por Jornada**: Permitir la apuesta en los partidos de la Champions League 2026/2027.
2. **Clasificación General**: Mostrar la tabla de puntos acumulados por cada jugador registrado con su avatar y nombre.
3. **Estadísticas de Porra**: Visualización de aciertos, tendencias de voto de la comunidad y comparativa entre participantes.
