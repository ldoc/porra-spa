# Datos de la Porra SPA

Esta carpeta contiene los ficheros JSON y recursos estáticos que alimentan la aplicación web de la **UEFA Champions League 2026/2027**.

---

## Resumen

| Fichero / carpeta     | Registros | Descripción                                      |
| --------------------- | --------- | ------------------------------------------------ |
| `teams.json`          | 36        | Equipos participantes en la competición          |
| `jugadores.json`      | 1 273     | Jugadores disponibles para la plantilla ideal      |
| `calendar.json`       | 144       | Partidos de la fase de liga (8 jornadas)         |
| `imgJugadores/`       | 1 273     | Fotos de jugadores (`{id}.png`)                  |

---

## Equipos — `teams.json`

Array con los **36 equipos** clasificados para la Champions League.

### Campos

| Campo           | Tipo     | Descripción                                              |
| --------------- | -------- | -------------------------------------------------------- |
| `id`            | `number` | Identificador del equipo en SofaScore                    |
| `name`          | `string` | Nombre oficial del club                                  |
| `idCompetition` | `number` | Identificador del equipo en el contexto de la competición |

### Ejemplo

```json
[
  {
    "idCompetition": 1917522,
    "name": "Arsenal",
    "id": 42
  },
  {
    "idCompetition": 1917521,
    "name": "FC Bayern München",
    "id": 2672
  }
]
```

---

## Jugadores — `jugadores.json`

Listado de jugadores estrella utilizados en la **selección de plantilla ideal** (POR, DEF, MED, DEL).

### Campos

| Campo      | Tipo     | Descripción                                      |
| ---------- | -------- | ------------------------------------------------ |
| `id`       | `number` | Identificador del jugador en SofaScore           |
| `nombre`   | `string` | Nombre completo del jugador                      |
| `posicion` | `string` | Código de posición (ver tabla inferior)          |
| `club`     | `string` | Nombre del club al que pertenece                 |
| `equipo`   | `number` | ID del equipo (`id` en `teams.json`)             |

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
| Centrocampista (`M`) | 477 |
| Defensa (`D`)        | 396 |
| Delantero (`F`)      | 264 |
| Portero (`G`)        | 136 |

### Ejemplo

```json
[
  {
    "id": 804508,
    "nombre": "Viktor Gyökeres",
    "posicion": "F",
    "club": "Arsenal",
    "equipo": 42
  },
  {
    "id": 934235,
    "nombre": "Bukayo Saka",
    "posicion": "F",
    "club": "Arsenal",
    "equipo": 42
  }
]
```

---

## Calendario — `calendar.json`

Partidos de la **fase de liga**, organizados en **8 jornadas** (18 encuentros por jornada).

### Campos

| Campo              | Tipo     | Descripción                                      |
| ------------------ | -------- | ------------------------------------------------ |
| `id`               | `number` | Identificador único del partido en SofaScore     |
| `ronda`            | `number` | Número de jornada (1–8)                          |
| `fecha`            | `number` | Fecha y hora del partido (timestamp Unix)        |
| `equipoLocal`      | `object` | Equipo que juega en casa (`id`, `name`)         |
| `equipoVisitante`  | `object` | Equipo visitante (`id`, `name`)                  |

### Ejemplo

```json
[
  {
    "ronda": 1,
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

## Imágenes — `imgJugadores/`

Fotografías de los jugadores en formato PNG, nombradas según su identificador:

```
imgJugadores/{id}.png
```

Por ejemplo, el jugador con `"id": 804508` corresponde al fichero `imgJugadores/804508.png`.

---

## Relaciones entre ficheros

```
teams.json ──(id)──► jugadores.json ──(id)──► imgJugadores/{id}.png
     │
     └──(id)──► calendar.json
                    ├── equipoLocal.id
                    └── equipoVisitante.id
```
