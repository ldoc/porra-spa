# Diseño: Panel de Administración - Selección de todas las fases

**Fecha**: 2026-08-13
**Proyecto**: porra-spa
**Relacionado**: [`2026-08-13-desc-fases-design.md`](2026-08-13-desc-fases-design.md)

## Contexto

El panel de administración (`showAdminModal` en `js/main.js`) permite al admin cambiar la fase
de la competición. Actualmente el dropdown "Cambiar a:" solo ofrece la **fase previa** y la
**fase siguiente** a la fase actual (`adjacentFases`), y el botón "Cambiar Fase" se deshabilita
si no existe ninguna fase adyacente.

## Objetivo

Que el admin pueda seleccionar **cualquiera de las 13 fases disponibles**, ordenadas de más
antigua a más nueva (por `id` ascendente).

## Enfoque elegido: A

Usar directamente `AppState.fases` (que en `data/fases.json` ya están ordenadas por `id` de
1 a 13), en lugar de calcular las adyacentes.

## Cambios en `js/main.js` (`showAdminModal`, ~línea 2278)

1. **Eliminar** el bloque de cálculo de `adjacentFases` (búsqueda de prev/next por `id`).
2. **Generar opciones** para todas las fases de `AppState.fases`:

   ```js
   const optionsHtml = fases.map(f =>
     `<option value="${f.nombre}"${f.nombre === fase ? ' selected' : ''}>${f.desc || f.nombre}</option>`
   ).join('');
   ```

   - `value` sigue siendo el código interno (`f.nombre`), igual que hoy.
   - La etiqueta visible es `desc` (con fallback a `nombre`), igual que hoy.
   - La fase actual lleva `selected`.

3. **Quitar** el `disabled` condicional del botón "Cambiar Fase" (`adjacentFases.length === 0`):
   el botón queda siempre habilitado.
4. **Quitar** la rama de fallback del dropdown (opción única con `selected`).
5. **Mantener** el recuadro "Fase actual: `<getFaseDesc(fase)>`".
6. **Mantener** el guard existente en el handler del botón:
   `if (targetPhase === currentPhase) { showToast('Ya estás en esta fase'); return; }`.

## Sin cambios

- La lógica de confirmación (`showPhaseConfirmModal`) y el envío del código interno a la API.
- El resto del panel (botón "Gestionar Códigos de Invitación", modal de invitaciones).
- `getFaseLabel`, `getFaseDesc` y demás helpers.

## Cache-busting (obligatorio, AGENTS.md)

Al modificar `js/main.js`, incrementar la versión en `index.html`:
`<script src="js/main.js?v=63">` → `v=64`.

## Verificación

- `node --check js/main.js` sin errores.
- Tests existentes (`tests/*.test.js`) siguen pasando.
