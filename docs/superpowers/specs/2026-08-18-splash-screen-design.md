# Splash Screen — Diseño

## Objetivo

Añadir una pantalla de carga animada que se muestre al acceder a la web mientras la app carga. Usa la imagen de la copa de la Champions con asas de porras (del PDF UCLv2).

## Comportamiento

- **Visible**: Desde que el navegador carga `index.html` hasta que la app está lista
- **Duración mínima**: 2-3 segundos (para que se aprecie la animación)
- **Se oculta**: Cuando la app está lista Y han pasado mínimo 2-3 segundos
- **Transición**: Fade out suave → aparece auth overlay o la app

## Elementos visuales

1. **Fondo**: `#03060D` (el mismo de `html, body`, sin cambio)
2. **Imagen**: Copa de la Champions con asas de porras (`data/img/splash-trophy.png`)
   - Tamaño: ~260px de ancho
   - Efecto: Radial gradient mask que difumina bordes con el fondo
   - Glow: `drop-shadow` violeta pulsante
3. **Texto**: "Preparando la porra..." en `#94A3B8`, letter-spacing 3px, uppercase
4. **Dots**: 3 puntos violetas animados (pulsación escalonada)
5. **Línea decorativa**: Barra horizontal degradada violeta en la parte inferior

## Animación (secuencia)

| Tiempo | Elemento | Efecto |
|--------|----------|--------|
| 0s | Copa | Fade in + translateY(20px) → translateY(0) |
| 0s | Glow backdrop | Pulsación continua (0.5 → 1.1 scale) |
| 0.6s | Texto + dots | Fade in + translateY(20px) |
| 0.8s | Glow imagen | Intensifica drop-shadow |
| 2-3s | Todo | Fade out completo |

## Archivos a modificar

### `index.html`
- Añadir `div#splash-screen` como primer hijo de `body` (antes de `#app-viewport`)
- Visible por defecto (`display: flex`)
- Contiene: imagen, texto, dots, línea decorativa
- Añadir `<script>` tag para `splash-trophy.png` (o referencia directa)

### `css/styles.css`
- Nuevo bloque `#splash-screen` con estilos base
- Animaciones: `@keyframes splashFadeIn`, `@keyframes splashGlow`, `@keyframes splashDotPulse`
- `#splash-screen.hidden` con `opacity: 0; pointer-events: none;`
- Transición `opacity 0.6s ease-out`

### `js/main.js`
- Nuevo `hideSplashScreen()`:
  - Añade clase `hidden` al splash screen
  - Después de la transición, elimina el elemento del DOM
- Modificar `enterApp()`:
  - Calcular tiempo transcurrido desde `DOMContentLoaded`
  - Si < 2.5s, esperar hasta completar 2.5s antes de llamar `hideSplashScreen()`
  - Si >= 2.5s, llamar `hideSplashScreen()` directamente
- Variable global `const SPLASH_MIN_MS = 2500`

### `data/img/splash-trophy.png`
- Imagen extraída del PDF (768x1376, PNG con alpha)

## Cache-busting

Incrementar versión de `index.html` para CSS y JS (regla AGENTS.md).

## Testing

- Verificar que el splash aparece inmediatamente al cargar
- Verificar que se oculta tras ~2.5-3 segundos
- Verificar que la imagen carga correctamente
- Verificar que no interfiere con el auth overlay ni con la app
- Test unitario: `hideSplashScreen()` añade clase `hidden`
