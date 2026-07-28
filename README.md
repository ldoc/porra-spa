# Porra SPA ⚽📱

Una aplicación web (Single Page Application) en HTML, CSS y JavaScript Vanilla orientada y optimizada para **dispositivos móviles en posición vertical (portrait mode)**.

## 🚀 Estructura del Proyecto

```text
.
├── index.html            # Vista y estructura HTML5 de la SPA
├── css/
│   └── styles.css        # Sistema de diseño, variables CSS y estilos mobile vertical
├── js/
│   └── main.js           # Lógica interactiva de eventos, navegación y toasts
├── AGENTS.md             # Directrices de desarrollo y especificaciones para Agentes IA
├── .agents/
│   └── AGENTS.md         # Reglas detectables automáticamente por agentes Gemini/Antigravity
└── README.md             # Documentación principal
```

## 📱 Características Clave de Diseño

1. **Mobile Vertical First**:
   - Ajuste dinámico de viewport con `100dvh` y soporte de áreas seguras (`safe-area-inset-*`).
   - En pantallas de escritorio, muestra un simulador/bisel móvil centrado.
   - Si se gira la pantalla a apaisado (landscape) en móvil, muestra una advertencia amistosa solicitando volver a posición vertical.
2. **Componentes Táctiles**:
   - Botones de pronóstico con área táctil óptima (`1`, `X`, `2`).
   - Micro-animaciones e interacción instantánea mediante notificaciones flotantes (Toast).
   - Menú de navegación inferior nativo estilo app (Bottom Navigation Bar).
3. **Guía para Agentes IA**:
   - Las reglas y especificaciones para el desarrollo están centralizadas en `AGENTS.md`.

## 🛠️ Cómo Probar la Aplicación

Puedes abrir directamente el archivo `index.html` en tu navegador o lanzar un servidor HTTP local de desarrollo:

```bash
# Servidor de desarrollo con Python
python3 -m http.server 8000
```
Luego abre `http://localhost:8000` en tu navegador y activa la vista de inspección móvil en posición vertical.