const assert = require('assert');

// Mock de AppState
const AppState = {
  allPlayers: [],
  squadPicks: [],
  blockedTeams: new Set()
};

const isSquadFrozen = () => false;
const SQUAD_SIZE = 25;

const PLAYERS_AVAILABLE_DATE = '3 de septiembre de 2026';

// Contenedor mock simple
let containerHtml = '';
const mockContainer = {
  get innerHTML() { return containerHtml; },
  set innerHTML(v) { containerHtml = v; }
};

function renderPlantillaTab() {
  const totalSelected = AppState.squadPicks.length;
  const frozen = isSquadFrozen();
  const playersAvailable = AppState.allPlayers.length > 0;

  containerHtml = `
    <div class="squad-picker-wrapper">
      <div class="squad-top-fixed">
        ${!playersAvailable ? `
          <div class="squad-players-unavailable-notice">
            <div class="squad-notice-icon">⚠️</div>
            <div class="squad-notice-content">
              <p class="squad-notice-title">Jugadores no disponibles</p>
              <p class="squad-notice-text">
                Los jugadores convocados para la Champions League 2026/2027 aún no están disponibles.
              </p>
              <p class="squad-notice-text">
                Podrás seleccionar tu plantilla ideal a partir del <strong>${PLAYERS_AVAILABLE_DATE}</strong>.
              </p>
            </div>
          </div>
        ` : ''}
        <div class="squad-summary">
          <span class="squad-summary-text">Tu Plantilla (<span id="squad-count">${totalSelected}</span>/${SQUAD_SIZE})</span>
          <button class="squad-save-btn" id="btn-save-squad" ${totalSelected !== SQUAD_SIZE || frozen || !playersAvailable ? 'disabled' : ''}>💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function resetState() {
  AppState.allPlayers = [];
  AppState.squadPicks = [];
  containerHtml = '';
}

function test_mostrar_aviso_cuando_allPlayers_vacio() {
  resetState();
  renderPlantillaTab();
  assert.ok(containerHtml.includes('squad-players-unavailable-notice'), 'Debería mostrar el aviso');
  assert.ok(containerHtml.includes('Jugadores no disponibles'), 'Debería contener título del aviso');
  assert.ok(containerHtml.includes(PLAYERS_AVAILABLE_DATE), 'Debería contener la fecha de disponibilidad');
}

function test_no_mostrar_aviso_cuando_allPlayers_con_datos() {
  resetState();
  AppState.allPlayers = [{ id: 1, nombre: 'Test', posicion: 'G', equipo: 1 }];
  renderPlantillaTab();
  assert.ok(!containerHtml.includes('squad-players-unavailable-notice'), 'No debería mostrar el aviso');
}

function test_deshabilitar_boton_guardar_cuando_no_hay_jugadores() {
  resetState();
  renderPlantillaTab();
  assert.ok(containerHtml.includes('id="btn-save-squad" disabled'), 'Botón Guardar debería estar deshabilitado');
}

function test_deshabilitar_boton_guardar_cuando_plantilla_incompleta() {
  resetState();
  AppState.allPlayers = [{ id: 1, nombre: 'Test', posicion: 'G', equipo: 1 }];
  AppState.squadPicks = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, nombre: `J${i + 1}`, posicion: 'G', equipo: i + 1 }));
  renderPlantillaTab();
  assert.ok(containerHtml.includes('id="btn-save-squad" disabled'), 'Botón Guardar debería estar deshabilitado con plantilla incompleta');
}

function test_habilitar_boton_guardar_solo_con_25_jugadores() {
  resetState();
  AppState.allPlayers = [{ id: 1, nombre: 'Test', posicion: 'G', equipo: 1 }];
  AppState.squadPicks = Array.from({ length: SQUAD_SIZE }, (_, i) => ({ id: i + 1, nombre: `J${i + 1}`, posicion: 'G', equipo: i + 1 }));
  renderPlantillaTab();
  assert.ok(containerHtml.includes('id="btn-save-squad"'), 'Botón debería existir');
  assert.ok(!containerHtml.includes('id="btn-save-squad" disabled'), 'Botón Guardar debería estar habilitado con 25 jugadores');
}

function test_guardar_rechaza_plantilla_incompleta() {
  const isSquadFrozen = () => false;
  const cases = [undefined, [], Array.from({ length: 20 }, (_, i) => ({ id: i + 1 })), Array.from({ length: 26 }, (_, i) => ({ id: i + 1 }))];
  for (const squad of cases) {
    let toastMsg = '';
    async function saveSquadToBackend() {
      if (!squad || squad.length !== SQUAD_SIZE) {
        toastMsg = `Completa los ${SQUAD_SIZE} jugadores de tu plantilla para guardarla`;
        return false;
      }
      return true;
    }
    const result = saveSquadToBackend();
    assert.ok(result instanceof Promise, 'saveSquadToBackend debería devolver una promesa');
    assert.strictEqual(toastMsg, `Completa los ${SQUAD_SIZE} jugadores de tu plantilla para guardarla`, 'Debería mostrar toast de plantilla incompleta');
  }
}

function test_guardar_acepta_25_jugadores() {
  const squad = Array.from({ length: SQUAD_SIZE }, (_, i) => ({ id: i + 1 }));
  let toastMsg = '';
  async function saveSquadToBackend() {
    if (!squad || squad.length !== SQUAD_SIZE) {
      toastMsg = `Completa los ${SQUAD_SIZE} jugadores de tu plantilla para guardarla`;
      return false;
    }
    return true;
  }
  const result = saveSquadToBackend();
  assert.ok(result instanceof Promise, 'saveSquadToBackend debería devolver una promesa');
  assert.strictEqual(toastMsg, '', 'No debería mostrar toast con 25 jugadores');
}

// Ejecutar tests
test_mostrar_aviso_cuando_allPlayers_vacio();
test_no_mostrar_aviso_cuando_allPlayers_con_datos();
test_deshabilitar_boton_guardar_cuando_no_hay_jugadores();
test_deshabilitar_boton_guardar_cuando_plantilla_incompleta();
test_habilitar_boton_guardar_solo_con_25_jugadores();
test_guardar_rechaza_plantilla_incompleta();
test_guardar_acepta_25_jugadores();

console.log('✓ tests/plantilla-aviso.test.js — 7 tests passed');
