---
name: Porra UCL — Stadium Midnight
description: Porra privada Champions 2026/27 — deportiva, emocionante y trepidante bajo estadio nocturno
colors:
  abyss: "#050B18"
  navy: "#0A142F"
  card: "#121E3D"
  card-hover: "#19284F"
  surface: "#1B2B54"
  pitch-emerald: "#10B981"
  floodlight-cyan: "#06B6D4"
  champions-gold: "#F59E0B"
  knockout-violet: "#8B5CF6"
  ice-white: "#F8FAFC"
  mist-silver: "#94A3B8"
  slate-muted: "#64748B"
  border-subtle: "rgba(255,255,255,0.1)"
  glow-cyan: "rgba(6,182,212,0.3)"
typography:
  display:
    fontFamily: "'Outfit', Inter, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Outfit', Inter, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "'Outfit', Inter, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "'Outfit', Inter, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "'Outfit', Inter, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.pitch-emerald}"
    textColor: "{colors.abyss}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  button-primary-hover:
    backgroundColor: "{colors.floodlight-cyan}"
    textColor: "{colors.abyss}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.floodlight-cyan}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ice-white}"
    rounded: "{rounded.md}"
    padding: "14px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ice-white}"
    rounded: "{rounded.md}"
    padding: "16px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.md}"
    padding: "8px 2px"
---

# Design System: Porra UCL — Stadium Midnight

## Overview

**Creative North Star: "The Stadium Midnight"**

La porra vive bajo los focos de una noche europea: un abismo marino profundo (#050B18) que respira, capas elevadas en navy y card, y destellos de neón que marcan cada acierto. Es deportiva, emocionante y trepidante — no editorial ni etérea. Cada interacción debe sentirse como un toque táctil en el banquillo: inmediata, con glow y micro-escala, nunca flotante ni pastel.

Denso pero quirúrgico. La densidad viene de los 4 sistemas de puntuación (144 partidos + liguilla + eliminatorias + plantilla) y la precisión viene del uso restringido del color: dos acentos fríos dominantes (Pitch Emerald y Floodlight Cyan) que siempre van juntos en degradado, oro solo para lo consagrado (campeón, mejor para ti, countdown) y violeta solo para knockout. El fondo nunca es claro; el contraste se construye por elevación, no por inversión.

La interfaz es 100% portrait, 460px máx, app-like con blur de estadio (16–20px) en header y nav, y sin scroll horizontal. El anti-mundo es el modo claro: no existe, no se documenta, no se improvisa.

**Key Characteristics:**
- Estadio nocturno elevado — capas oscuras + sombras reales + glow focal
- Degradado dual Pitch Emerald → Floodlight Cyan como firma única
- Táctil y trepidante — scale 0.92–0.97 y feedback instantáneo en cada tap
- Densidad tabular con legibilidad — tablas 36 filas, alternancia sutil, badges y chips
- Sin modo claro — dark-only, contraste por elevación

## Colors

Paleta oscura fría con neón funcional: el fondo respira en azules abisales, el contenido flota en cards elevadas y el color solo aparece para señalar acierto, selección y jerarquía competitiva.

### Primary
- **Pitch Emerald** (#10B981): Gol, acierto de plantilla y estado "done". Usado en degradado con cyan en botones primarios, badges de fase y .done. Nunca solo sobre blanco — siempre sobre abyss/card.
- **Floodlight Cyan** (#06B6D4): Selección, navegación activa, foco y neblina. Color de `nav-item.active`, `input:focus`, glow (`rgba(6,182,212,0.3)`) y segunda parada del degradado primary. Es el acento interactivo por defecto.

### Secondary
- **Champions Gold** (#F59E0B): Consagración y urgencia dorada. Countdown hacia hito de fase, marcador real resaltado, badge dorado "⚡ Mejor para ti" y gradiente de warning. Uso ≤8% de la pantalla.
- **Knockout Violet** (#8B5CF6): Eliminatorias y distinción de fase final. Borde y tag de semifinales/cuartos. Complemento frío que nunca compite con emerald/cyan en la misma fila.

### Neutral
- **Abyss** (#050B18): Canvas global (`html,body`, `#app-viewport` base). Casi negro azulado, absorbe el glow.
- **Stadium Navy** (#0A142F): Header y bottom-nav (`rgba(10,20,47,0.9–0.95)` + blur). Segunda capa más clara que abyss, ancla la cáscara.
- **Card Midnight** (#121E3D): Cards, leaderboard, hoy-card, squad-selected. Superficie por defecto del contenido.
- **Card Hover** (#19284F): Estado presionado de cards (`:active`, `.open`). Un paso más luminoso que card.
- **Surface Elevated** (#1B2B54): Inputs, chips, avatar-option, fondos de búsqueda. La capa más alta del stack.
- **Ice White** (#F8FAFC): Texto primario y títulos con gradiente `white → cyan`. Siempre sobre oscuros.
- **Mist Silver** (#94A3B8): Texto secundario y subtítulos.
- **Slate Muted** (#64748B): Labels (11px uppercase), placeholders, iconos inactivos y `nav-item` reposo.
- **Border Subtle** (rgba(255,255,255,0.1)): Única línea divisoria del sistema — bordes de cards/inputs/nav. Nunca más opaca.
- **Glow Cyan** (rgba(6,182,212,0.3)): Halo de foco. Solo aparece en foco/hover de elementos interactivos.

### Named Rules
**The No Light Mode Rule.** El sistema es dark-only. Nunca inventes variantes claras, fondos blancos o pasteles para tablas/cards; la elevación se resuelve subiendo de abyss → navy → card → surface, no invirtiendo el tema.
**The Dual Neon Rule.** El degradado 135deg Pitch Emerald → Floodlight Cyan es indivisible. No uses emerald solo como sólido primario ni cyan solo como primario; el botón primario, el banner UCL y el brand-icon siempre fusionan ambos.
**The Gold Scarcity Rule.** Champions Gold aparece en ≤1 elemento hero por vista (countdown, marcador real, badge). Si pintas todo de oro, nada es campeón.

## Typography

**Display Font:** Outfit (con Inter como fallback y stack sistema)
**Body Font:** Outfit / Inter (mismo stack, peso regula jerarquía)
**Label Font:** Outfit (condensado, uppercase)

**Character:** Outfit aporta hombros anchos y terminales recortados — atlético y tabular sin ser técnico. Inter suaviza lectura larga. La jerarquía se marca por peso (800→700→600) y tamaño, no por color.

### Hierarchy
- **Display** (800, 1.5rem / 24px, 1.1): Saludos de Inicio (`inicio-greeting`, `auth-title`). Solo 1 por vista, con tracking -0.02em.
- **Headline** (700, 1.25rem, 1.2): Títulos de sección (`section-title`, `rules-title-main`). En mayúsculas suaves con icono emoji prefijo.
- **Title** (700, 1.125rem, 1.3): Nombres de equipo, card titles (`squad-chip-name`, `inicio-card-title`). Truncado con ellipsis si desborda.
- **Body** (500–600, 1rem, 1.5): Contenido leído — descripciones, inputs, celdas de tabla. Máx ~60ch dentro de 460px, siempre sobre card/surface.
- **Label** (700, 0.75rem / 11px, 0.05em, uppercase): `form-label`, `fasesFechas` labels, `hoy-card-header` meta. Color Slate Muted, nunca Ice White.

### Named Rules
**The Weight Ladder Rule.** Nunca uses 400 para títulos ni 800 para body. 800 = display, 700 = headline/label, 600 = body activo/input, 500 = body lectura. Si rompes la escalera, la tabla de 36 filas pierde escaneo.
**The Uppercase Minimum Rule.** Solo labels de 10–11px van en uppercase con tracking 0.05em. Nada por encima de 0.875rem se pone en mayúsculas.

## Layout

Modelo **app-viewport 460px centrado** con cáscara fija. `#app-viewport` es flex column: header (64px + safe-top) + `.app-content` scrolleable (16px padding, gap 20px, scrollbar oculto) + `bottom-nav` (68px + safe-bottom). En desktop ≥500px, viewport se centra con `height:92dvh`, `max-height:880px`, `border-radius:38px`, `border:8px solid #1E293B` y fondo radial `#0e1a3a → #03060D` para efecto estadio encajado.

Densidad trepidante pero respirable: gaps de 8–16px entre cards, 10px gaps en grids de 4 (avatar-grid), y secciones con `gap:12px` (plantilla). Tablas usan ancho fluido con columnas fijas Pts/DG/GF y truncado de nombre. Plantilla y Final-Predictions usan patrón header fijo + scroll (`squad-top-fixed` + `squad-scroll-content` con thumb 4px) para no perder el CTAs.

Breakpoints: solo 1 — 500px (activa el marco de dispositivo) y `max-width:900px + landscape` muestra `orientation-warning` fullscreen (gira a vertical). No hay grid de 12 columnas; es single-column portrait con cards apiladas. Espaciado rítmico ancla a 8px (xs 8, sm 12, md 16, lg 20, xl 24).

## Elevation & Depth

Elevado con sombras — no plano. La profundidad se construye en dos estratos: **sombra de tarjeta** para separación y **glow cian** para foco. El blur es estructural, no decorativo.

### Shadow Vocabulary
- **Card Depth** (`box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.4)` / `--shadow-card`): Cards, banner UCL, inicio-card, hoy-card. Sombra doble, difusa y pesada — hace que card flote sobre abyss. Siempre presente en reposo.
- **Glow Focus** (`box-shadow: 0 0 24px rgba(6,182,212,0.3)` / `--shadow-glow`, y variante 0 0 12px en inputs/tabs): Botón primario, `input:focus`, `avatar-option.selected`, `btn-wizard-next`. Halo frío que indica interactividad. Nunca en cards estáticas.
- **Backdrop Blur** (`backdrop-filter: blur(16px)` header/nav, `blur(20px)` modales): Header `rgba(10,20,47,0.9)` y nav `0.95` dejan ver el contenido blurread. Modal overlay `rgba(0,0,0,0.6)` + `blur(20px)` en `.rules-modal-content`.

### Named Rules
**The Glow-Only-On-Action Rule.** Ninguna superficie muestra glow en reposo excepto el botón primario (marca). El glow aparece en `:focus`, `.selected`, `.active` o `:hover` en desktop. Si todo brilla, nada destaca.
**The Blur Is Structure Rule.** Header y nav siempre llevan blur; no son opacos. Si quitas el blur, el scroll pierde la sensación de profundidad de estadio y el contenido choca con la cáscara.

## Shapes

Lenguaje redondeado medio-grande, táctil y enfocado. Esquinas nunca afiladas, nunca píldora total excepto en pills. Radio escalado: `sm 8px` para alertas y badges internos, `md 14px` para cards/inputs/botones/chips (forma por defecto del sistema), `lg 20px` para banner UCL y héroes, `full 9999px` solo para pills (`user-status-pill`, `nav-item` icon bg), avatares circulares (`border-radius:50%`) y dots/pills. La viewport desktop añade `38px` como radio de dispositivo — único radio extra-grande y solo en ese breakpoint. Bordes siempre `1px solid rgba(255,255,255,0.1)`; en selección se reemplazan por `1px solid floodlight-cyan` o `pitch-emerald`. Sin clipping geométrico ni diagonales.

## Components

### Buttons
- **Shape:** Redondeado medio (14px / `--radius-md`), generoso y táctil. Nunca 4px.
- **Primary:** Degradado 135deg Pitch Emerald → Floodlight Cyan, texto #021319 (casi negro para contraste), padding 14px, Outfit 800 1rem, `box-shadow: glow`, `scale(0.97)` en `:active`. Full-width en auth. Es el único botón con sombra permanente.
- **Hover / Focus:** En desktop el glow se intensifica; en móvil el feedback es scale, no glow. `:disabled` opacidad 0.5.
- **Ghost / Text:** `btn-text` y `back-btn` — transparente, texto Floodlight Cyan 600, padding 8px, `opacity 0.8` en hover. Sin borde.
- **Secondary / Tab:** `btn-tab` — surface + border subtle, texto slate muted 600 13px; `.active` se vuelve sólido Pitch Emerald con texto blanco y borde emerald.

### Chips
- **Style:** `squad-chip` surface + border subtle + 14px radius + 8px 10px padding; avatar 36px circular con borde subtle; nombre 0.875rem 700 ellipsis, subtexto 10px muted.
- **State:** Selección no es chip sino `avatar-option.selected` — fondo `rgba(6,182,212,0.2)`, borde cyan, `scale(1.08)` + glow. Remover es píldora roja 28px `rgba(239,68,68,0.2)` + `#FCA5A5`.

### Cards / Containers
- **Corner Style:** 14px md por defecto (hoy-card, inicio-card, squad-selected-section). Banner UCL 20px lg.
- **Background:** Card Midnight (#121E3D) para cards; Surface (#1B2B54) para insumos internos. Gradientes sutiles solo en estados freeze (`card → 8% gold/red/green`).
- **Shadow Strategy:** Siempre `shadow-card` en reposo; `glow` solo en selección.
- **Border:** 1px border-subtle en reposo; cambia a cyan/emerald/gold según estado.
- **Internal Padding:** 16px cards, 12px secciones internas, 14px inputs.

### Inputs / Fields
- **Style:** `input-field` / `squad-search-input` — surface, border subtle, 14px radius, 14px padding (con 40px left para icono búsqueda), texto Ice White 600 1rem.
- **Focus:** `border-color: floodlight-cyan` + `box-shadow: 0 0 12px glow-cyan` (halo corto, no el glow grande del botón). Sin outline.
- **Error / Disabled:** `error-alert` fondo `rgba(239,68,68,0.15)` + borde `0.4` + texto `#FCA5A5` 0.75rem 600; disabled inputs opacidad reducida.

### Navigation
- **Style:** Bottom-nav 5→6 items (Inicio, Clasificación, Resultados, Pronósticos, Plantilla, Estadísticas) — flex space-around, `rgba(10,20,47,0.95)` + blur16, border-top subtle. `nav-item` column, gap 3px, 8.5px 600, icono 20px stroke 2, `text-muted`.
- **Active:** `color: floodlight-cyan`, `stroke: floodlight-cyan`. Sin fondo activo — solo color.
- **Interaction:** `:active scale(0.92)` trepidante. Sin hover en móvil.

### Banner UCL (Signature)
Degradado `135deg #0B193C → #1E1B4B → #047857`, 20px radius, `shadow-card`, borde `rgba(255,255,255,0.15)`, decor `⭐ 🏆 ⭐` 0.3 opacity top-right. Tag interior pill `rgba(6,182,212,0.2)` + borde cyan 0.4, 11px 700 uppercase cyan.

### Modal / Rules
Overlay `rgba(0,0,0,0.6)` + blur 20px; content surface/card con 20px radius + `0 20px 40px rgba(0,0,0,0.8)`. Header con título + close `×`, body scrolleable, footer con actions. Variante `rules-modal` añade chips de navegación con `.active` emerald.

## Do's and Don'ts

### Do:
- **Do** usar el degradado emerald→cyan indivisible para cada CTA primario — es la firma trepidante del sistema.
- **Do** mantener el stack de elevación abyss → navy → card → surface y aplicar `shadow-card` en reposo + `glow` solo en foco/selección.
- **Do** respetar `460px` max-width y ocultar scrollbars (`display:none` + `scrollbar-width:none`) — el scroll es táctil, no de escritorio.
- **Do** truncar nombres de equipo/jugador con `ellipsis` y `max-width:100%` en nav y chips — la tabla de 36 no debe romper layout.
- **Do** activar `orientation-warning` fullscreen en landscape <900px — el producto es vertical-only por contrato.

### Don't:
- **Don't** crear modo claro, fondos blancos o grises claros para cards/tablas — viola The No Light Mode Rule.
- **Don't** separar Pitch Emerald y Floodlight Cyan en sólidos aislados para primarios — viola The Dual Neon Rule.
- **Don't** aplicar glow a todas las cards en reposo — reserva `shadow-glow` para `button-primary` y estados activos.
- **Don't** usar radios <8px en cards/inputs o píldora total en cards — el lenguaje es 14px md por defecto.
- **Don't** añadir frameworks CSS (Tailwind/Bootstrap) o fuentes distintas a Outfit/Inter — el sistema es vanilla con `:root` tokens; romperlo invalida DESIGN.md y cache-busting `?v=X`.
