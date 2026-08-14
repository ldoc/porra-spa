# Datos de la Porra SPA

Esta carpeta contiene los ficheros JSON y recursos estáticos que alimentan la aplicación web de la **UEFA Champions League 2026/2027**.

---

## Resumen

| Fichero / carpeta     | Registros | Descripción                                      |
| --------------------- | --------- | ------------------------------------------------ |
| `teams.json`          | 36        | Equipos participantes en la competición          |
| `jugadores.json`      | 1 134     | Jugadores disponibles para la plantilla ideal      |
| `calendar.json`       | 189 (144 liga + 45 eliminatorias) | Partidos de liga y eliminatorias      |
| `imgEquipos/`         | 36        | Escudos de equipos (`{id}.webp`)                 |
| `imgJugadores/`       | 1 220     | Fotos de jugadores (`{id}.webp`)                 |
| `fases.json`          | 13        | Fases de la competición                          |
| `codes.json`          | 3         | Códigos de acceso (LEGACY, no usado)             |

---

## Equipos — `teams.json`

Array con los **36 equipos** clasificados para la Champions League.

### Campos

| Campo           | Tipo     | Descripción                                              |
| --------------- | -------- | -------------------------------------------------------- |
| `id`            | `number` | Identificador del equipo en SofaScore                    |
| `name`          | `string` | Nombre oficial del club                                  |
| `idCompetition` | `number` | Identificador del equipo en el contexto de la competición |
| `extension`     | `string` | Extensión de la imagen del escudo (`webp`)               |

### Ejemplo

```json
[
  {
    "idCompetition": 1917522,
    "name": "Arsenal",
    "id": 42,
    "extension": "webp"
  },
  {
    "idCompetition": 1917521,
    "name": "FC Bayern München",
    "id": 2672,
    "extension": "webp"
  }
]
```

---

## Jugadores — `jugadores.json`

Listado de jugadores utilizados en la **selección de plantilla ideal** (POR, DEF, MED, DEL).

### Campos

| Campo      | Tipo     | Descripción                                      |
| ---------- | -------- | ------------------------------------------------ |
| `id`       | `number` | Identificador del jugador en SofaScore           |
| `nombre`   | `string` | Nombre completo del jugador                      |
| `posicion` | `string` | Código de posición (ver tabla inferior)          |
| `club`     | `string` | Nombre del club al que pertenece                 |
| `equipo`   | `number` | ID del equipo (`id` en `teams.json`)             |
| `extension`| `string` | Extensión de la foto (`webp`)                    |

### Códigos de posición

| Código | Posición        | Uso en plantilla ideal |
| ------ | --------------- | ---------------------- |
| `G`    | Portero         | POR                    |
| `D`    | Defensa         | DEF                    |
| `M`    | Centrocampista  | MED                    |
| `F`    | Delantero       | DEL                    |

### Distribución actual

| Posición | Jugadores |
| -------- | --------- |
| Centrocampista (`M`) | 430 |
| Defensa (`D`)        | 351 |
| Delantero (`F`)      | 229 |
| Portero (`G`)        | 124 |

### Ejemplo

```json
[
  {
    "id": 804508,
    "nombre": "Viktor Gyökeres",
    "posicion": "F",
    "club": "Arsenal",
    "equipo": 42,
    "extension": "webp"
  },
  {
    "id": 934235,
    "nombre": "Bukayo Saka",
    "posicion": "F",
    "club": "Arsenal",
    "equipo": 42,
    "extension": "webp"
  }
]
```

---

## Calendario — `calendar.json`

Partidos de la **fase de liga** (144, 8 jornadas de 18 partidos) **y de las eliminatorias** (45: 16, octavos, cuartos, semis y final).

### Campos

| Campo              | Tipo     | Descripción                                      |
| ------------------ | -------- | ------------------------------------------------ |
| `id`               | `number` | Identificador único del partido en SofaScore     |
| `ronda`            | `number` | Número de jornada (1–8) en liga                  |
| `fase`             | `string` | `liga` (144) o fase eliminatoria: `16`, `8`, `4`, `semis`, `final` |
| `fecha`            | `number` | Fecha y hora del partido (timestamp Unix)        |
| `equipoLocal`      | `object` | Equipo que juega en casa (`id`, `name`)         |
| `equipoVisitante`  | `object` | Equipo visitante (`id`, `name`)                  |

### Ejemplo

```json
[
  {
    "ronda": 1,
    "fase": "liga",
    "id": 14566909,
    "fecha": 1758041100,
    "equipoLocal": {
      "id": 2825,
      "name": "Athletic Club"
    },
    "equipoVisitante": {
      "id": 42,
      "name": "Arsenal"
    }
  }
]
```

---

## Imágenes — `imgJugadores/` e `imgEquipos/`

Imágenes en formato **WEBP**, nombradas según su identificador:

```
imgJugadores/{id}.webp
imgEquipos/{id}.webp
```

Por ejemplo, el jugador con `"id": 804508` corresponde al fichero `imgJugadores/804508.webp`. Hay 86 fotos de jugadores sin entrada asociada en `jugadores.json` (huérfanas).

---

## Relaciones entre ficheros

```
teams.json ──(id)──► jugadores.json ──(id)──► imgJugadores/{id}.webp
     │
     └──(id)──► calendar.json
                    ├── equipoLocal.id
                    └── equipoVisitante.id
```
