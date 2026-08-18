# Technical Design Document — Parking Management System (MVP)

**Fase:** Technical Design (Research → PRD → **Technical Design** → Agent Documentation → Build)
**Documentos fuente:** `PRD-Parking-Management-MVP.md` (principal), `research-Parking-Management.md` (contexto).
**Prioridad de diseño:** Correctness > Security > Simplicity > Maintainability > Scalability > Complexity.

Este documento define **cómo** se construye técnicamente lo que el PRD define como **qué**. No se escribe código todavía, no se genera `AGENTS.md`, `MEMORY.md` ni `REVIEW-CHECKLIST.md`.

---

## Resolución de Open Questions del PRD (antes de diseñar)

| Pregunta del PRD | Decisión confirmada por el usuario |
|---|---|
| ¿Quién puede cancelar una sesión `active`? | Admin y Operador, **solo si la sesión no tiene pago asociado**. |
| ¿Existe anulación de sesiones `completed`? | **No.** `completed` es un estado terminal e inmutable en el MVP. |
| ¿Los puestos aceptan cualquier tipo de vehículo? | Sí — `vehicle_type` es nullable; `null` = acepta cualquier tipo (heredado del Research, sin cambios). |

Estas tres decisiones son vinculantes para todo el diseño que sigue.

---

## 1. Executive Summary

**Sistema:** Parking Management System
**Versión:** MVP 1.0
**Patrón de arquitectura:** Monolito full-stack con backend-as-a-service (BaaS) relacional. Un único servicio de aplicación (frontend + capa de acceso a datos), sin microservicios, sin colas de mensajes, sin infraestructura distribuida.
**Esfuerzo estimado:** proyecto de portafolio individual, alcance para completarse en fases incrementales pequeñas (ver sección de Implementation Plan).

## 2. Architecture Overview

```
┌─────────────────────────────┐
│   Cliente (navegador)        │
│   Next.js App Router (web)   │
└───────────────┬──────────────┘
                │ HTTPS
                ▼
┌─────────────────────────────┐
│   Capa de aplicación          │
│   Next.js Route Handlers /   │
│   Server Actions (backend)   │
│   — autenticación            │
│   — autorización             │
│   — cálculo de tarifas        │
│   — validaciones de negocio   │
└───────────────┬──────────────┘
                │ SQL (cliente con service role / RLS)
                ▼
┌─────────────────────────────┐
│   Supabase (Postgres)         │
│   — tablas + constraints      │
│   — Row Level Security        │
│   — Auth (usuarios/sesiones)  │
│   — Realtime (canal de spots) │
└─────────────────────────────┘
```

No hay backend separado como servicio independiente: la "capa de aplicación" vive dentro del mismo proyecto Next.js (route handlers/server actions), que es lo único que tiene permiso de ejecutar operaciones sensibles (cálculo de tarifa, cambios de estado). El cliente nunca habla directamente con la base de datos para escrituras críticas.

## 3. Decisión central — Supabase vs Firebase

### 3.1 Tabla comparativa

| Criterio | Supabase | Firebase |
|---|---|---|
| 1. Modelo de datos | Relacional (Postgres) | Documental (Firestore, NoSQL) |
| 2. Relaciones | Nativas (FK) | Manuales, sin FK reales |
| 3. Integridad referencial | Garantizada por el motor | No existe a nivel de motor; se implementa en aplicación |
| 4. Constraints | `UNIQUE`, `CHECK`, `NOT NULL`, parciales | No existen constraints declarativos equivalentes |
| 5. Transacciones | ACID nativas (multi-tabla) | Transacciones limitadas, solo dentro de una misma colección/documento en la práctica común |
| 6. Concurrencia | Locks e índices únicos a nivel de motor | Optimistic concurrency vía reglas y reintentos en cliente/Cloud Functions |
| 7. Autenticación | Supabase Auth (email/password, OAuth, sesiones JWT) | Firebase Auth (equivalente en cobertura) |
| 8. Autorización | Row Level Security (SQL, por fila) + roles en backend | Firestore Security Rules (declarativas, no SQL) |
| 9. Seguridad | RLS + validaciones en servidor | Rules + Cloud Functions para lógica sensible |
| 10. RLS / equivalente | RLS nativo de Postgres, expresivo | Security Rules, expresividad menor para relaciones cruzadas |
| 11. TypeScript | Tipos generados desde el esquema SQL (`supabase gen types`) | Tipos manuales o generados por convención, sin esquema fuente único |
| 12. Consultas | SQL completo (joins, subqueries) | Consultas limitadas, sin joins nativos |
| 13. Agregaciones | `SUM`, `AVG`, `COUNT`, `GROUP BY` nativos | Requieren agregados precalculados o Cloud Functions |
| 14. Historial | Consultas directas sobre tablas con índices | Requiere modelar colecciones adicionales o desnormalizar |
| 15. Auditoría | Tabla `AuditLog` con FK a las entidades reales | Colección separada sin garantía de consistencia referencial |
| 16. Testing | Postgres local/Docker, migraciones versionadas, tests SQL | Emuladores de Firebase, pero sin verificación de integridad relacional |
| 17. Developer experience | SQL estándar, curva de aprendizaje transferible | Curva propia de Firestore/Rules, menos transferible |
| 18. Complejidad | Moderada (requiere saber SQL básico) | Baja al inicio, crece rápido al modelar relaciones |
| 19. Coste del MVP | Free tier suficiente (Postgres pequeño) | Free tier suficiente (Firestore pequeño) — comparable |
| 20. Facilidad de deployment | Alta (Supabase gestionado + Vercel) | Alta (Firebase Hosting/Functions) — comparable |
| 21. Explicabilidad en entrevista | SQL es universalmente entendido y verificable | Requiere explicar decisiones NoSQL específicas de Firestore |
| 22. Adecuación al tamaño del proyecto | Muy adecuado — dominio inherentemente relacional | Forzado — el dominio no es documental por naturaleza |
| 23. Riesgo de sobreingeniería | Bajo — el modelo relacional es el modelo natural del dominio | Medio-alto — requiere trabajo extra para simular relaciones e integridad |

### 3.2 El criterio decisivo

> ¿Cuál permite garantizar de forma más limpia la integridad y concurrencia requeridas por `ParkingSession` y `ParkingSpot`?

Este es el punto que inclina la decisión. Las reglas BR-001 y BR-002 del PRD ("un vehículo/puesto no puede tener más de una sesión activa") son, por naturaleza, **restricciones de integridad relacional bajo concurrencia**. En Postgres esto se resuelve con un **índice único parcial** (`UNIQUE INDEX ... WHERE status = 'active'`) evaluado atómicamente por el motor de base de datos — el motor mismo rechaza la segunda inserción concurrente, sin necesidad de lógica adicional. En Firestore no existe un mecanismo declarativo equivalente: habría que implementar esa unicidad con transacciones de documento + lecturas previas + reglas de seguridad personalizadas, lo cual es más código, más superficie de error, y más difícil de razonar y de explicar en una entrevista técnica.

### 3.3 Decisión

**Se elige Supabase (Postgres) como backend de datos, autenticación y autorización.**

**Razones:**
- El dominio del problema (parqueadero, sesiones, puestos, pagos) es intrínsecamente relacional: entidades con relaciones 1-a-muchos claras y una regla de integridad crítica que Postgres resuelve de forma nativa.
- Row Level Security permite expresar la autorización por rol directamente en la base de datos, como una segunda capa de defensa además del backend.
- SQL es el estándar que cualquier evaluador técnico reconoce inmediatamente — más fácil de explicar y de justificar decisión por decisión en una entrevista.
- El coste para el tamaño de este MVP es equivalente al de Firebase (ambos caben en el free tier).

**Ventajas:**
- Integridad de datos garantizada por el motor, no solo por la aplicación.
- Transacciones ACID reales para operaciones multi-tabla (ej. crear sesión + actualizar estado de puesto).
- Tipado end-to-end generado desde el esquema real.

**Desventajas / trade-offs aceptados:**
- Requiere que el desarrollador entienda SQL básico (aceptado: es justamente parte del valor educativo del proyecto).
- Supabase Realtime es algo menos maduro en world-scale que Firestore, pero irrelevante para el volumen de este MVP (un solo parqueadero, decenas de puestos).

**Por qué Firebase no es la mejor opción para este proyecto:**
Firebase brilla en apps con datos poco relacionados, alta escritura dispersa, y necesidad de sincronización offline-first (ej. apps móviles sociales). Ninguna de esas características describe este dominio. Forzar Firestore a modelar `ParkingSession` con integridad referencial y agregaciones financieras (`SUM` de ingresos del día) significa reconstruir a mano, en aplicación, exactamente lo que Postgres da gratis. Elegir Firebase aquí sería adoptar una tecnología por popularidad, no por adecuación al problema — lo contrario de lo que pide este documento.

## 4. Frontend

### 4.1 Next.js vs React + Vite

| Criterio | Next.js (App Router) | React + Vite |
|---|---|---|
| Routing | Basado en sistema de archivos, incluido | Requiere React Router, configuración manual |
| Rendering | SSR/SSG disponibles, aunque el MVP usa mayormente CSR con datos cargados en servidor para las pantallas iniciales | Solo CSR |
| Forms/validación | Compatible con cualquier librería (React Hook Form + Zod) | Igual |
| Autenticación | Integración directa con Supabase SSR (`@supabase/ssr`), cookies gestionadas por el framework | Requiere gestionar tokens manualmente en cliente |
| Server-side logic | Route Handlers permiten ejecutar el cálculo de tarifa y las validaciones críticas sin exponer un backend aparte | Requeriría un servidor Node/Express adicional |
| Developer experience | Un solo repositorio para frontend + lógica de servidor | Dos proyectos (frontend + backend) a mantener |
| Testing | Vitest + React Testing Library, igual que Vite | Igual |
| Deployment | Un solo deploy en Vercel | Dos deploys (frontend estático + backend) |
| Complejidad | Moderada, pero centralizada | Menor por proyecto individual, mayor en conjunto (dos sistemas) |

### 4.2 Decisión

**Se elige Next.js (App Router).**

La razón determinante no es SSR ni SEO (irrelevantes para una app operativa interna) sino que **Next.js evita tener que levantar un backend separado**. Con React + Vite necesitaríamos un servidor Node/Express adicional solo para poder ejecutar el cálculo de tarifa y las validaciones de forma confiable en servidor (BR-004: "el monto nunca puede ser proporcionado por el cliente"). Con Next.js, los **Route Handlers** cumplen ese rol dentro del mismo proyecto, sin infraestructura adicional.

**Qué usaremos realmente de Next.js (y qué NO):**
- ✅ App Router para páginas y layouts (Dashboard, Puestos, Historial, etc.).
- ✅ Route Handlers (`app/api/.../route.ts`) para toda operación que calcule dinero o cambie estado (entrada, salida, pago, configuración).
- ✅ Integración con `@supabase/ssr` para manejar la sesión de autenticación vía cookies.
- ❌ No usaremos Server Actions más allá de lo estrictamente necesario para formularios simples — se prefieren Route Handlers explícitos porque son más fáciles de testear y de explicar como "contratos de API" en una entrevista.
- ❌ No usaremos SSR/streaming avanzado, ISR, ni Edge Runtime — no aportan valor a una app operativa de uso interno.
- ❌ No usaremos middleware complejo — solo el necesario para proteger rutas (redirigir si no hay sesión).

## 5. UI

- **Prototipado:** el diseño visual se explora primero en **Lovable**. Lovable se usa exclusivamente como herramienta de exploración de UI/UX (layout del grid, paleta, disposición del dashboard) — no como generador del código final de producción.
- **Traducción a la app real:** los componentes visuales validados en Lovable se **reimplementan** dentro de la estructura Next.js + shadcn/ui del proyecto (no se copia el código generado por Lovable tal cual, ya que normalmente no sigue la arquitectura de datos definida aquí). Lovable funciona como "spec visual", este documento y el PRD como "spec funcional".
- **Librería UI:** shadcn/ui sobre Tailwind CSS — componentes accesibles por defecto (basados en Radix UI), consistentes con el enfoque "no reinventar lo que ya existe" del proyecto.
- **Estrategia de componentes:** componentes de UI genéricos (`Button`, `Badge`, `Table`) separados de componentes de dominio (`SpotGrid`, `SessionCard`, `ReceiptView`).
- **Responsive:** mobile-first para las pantallas operativas (entrada/salida se usan frecuentemente desde tablet o celular en el punto de acceso); el dashboard puede asumir pantalla de escritorio como caso principal.
- **Accesibilidad básica:** contraste adecuado en los colores de estado del grid (no depender solo del color — incluir also texto/ícono de estado), navegación por teclado en formularios, labels asociados a inputs.
- **Estados de UI:** cada vista de datos (grid, historial, dashboard) debe definir explícitamente sus tres estados: `loading` (skeleton), `error` (mensaje + reintento), `empty` (mensaje contextual, ej. "no hay puestos configurados todavía").

## 6. Database Design

Todas las entidades del Research/PRD se confirman como necesarias; ninguna se descarta ni se agrega.

### 6.1 `users` (gestionada por Supabase Auth + tabla de perfil)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | Igual al `id` de `auth.users` |
| `role` | `text` (`admin` \| `operator`) | `CHECK (role IN ('admin','operator'))` |
| `full_name` | `text` | |
| `is_active` | `boolean` | default `true`; desactivar en vez de borrar |
| `created_at` | `timestamptz` | default `now()` |

*Índice:* ninguno adicional (PK ya indexada). *FK:* `id` referencia `auth.users(id)`.

### 6.2 `parking_lots`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | |
| `name` | `text` | `NOT NULL` |
| `address` | `text` | nullable |
| `rows` | `int` | `NOT NULL`, `CHECK (rows > 0)` |
| `columns` | `int` | `NOT NULL`, `CHECK (columns > 0)` |
| `created_at` | `timestamptz` | default `now()` |

*Nota MVP:* se asume una única fila en esta tabla durante todo el MVP (single-tenant); no se implementa selector de parqueadero en UI.

### 6.3 `parking_spots`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | |
| `parking_lot_id` | `uuid` (FK → `parking_lots.id`) | `NOT NULL` |
| `spot_number` | `text` | `NOT NULL` |
| `vehicle_type` | `text` | nullable = acepta cualquier tipo; `CHECK` contra los tipos válidos de `rates.vehicle_type` |
| `status` | `text` (`available` \| `occupied` \| `out_of_service`) | `NOT NULL`, default `available` |
| `out_of_service_reason` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |

*Constraint:* `UNIQUE (parking_lot_id, spot_number)`.
*Índice:* sobre `status` (consultas frecuentes del grid y del dashboard).

### 6.4 `vehicles`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | |
| `plate` | `text` | `NOT NULL`, normalizada en mayúsculas sin espacios |
| `vehicle_type` | `text` | `NOT NULL` |
| `created_at` | `timestamptz` | default `now()` |

*Constraint:* `UNIQUE (plate)` — una placa identifica un único registro de vehículo; sesiones sucesivas del mismo vehículo reutilizan la fila.
*Nota:* tabla intencionalmente liviana — no almacena datos del propietario (Non-Goal del PRD).

### 6.5 `rates`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | |
| `vehicle_type` | `text` | `NOT NULL` |
| `hourly_price` | `numeric(10,2)` | `NOT NULL`, `CHECK (hourly_price > 0)` |
| `is_active` | `boolean` | default `true` |
| `created_at` | `timestamptz` | default `now()` |

*Constraint:* índice único parcial `UNIQUE (vehicle_type) WHERE is_active = true` — solo una tarifa activa por tipo de vehículo a la vez. Editar una tarifa = desactivar la anterior + crear una nueva fila (nunca `UPDATE` del valor), lo que preserva el historial de tarifas sin afectar snapshots ya tomados.

### 6.6 `parking_sessions` — entidad central

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | |
| `vehicle_id` | `uuid` (FK → `vehicles.id`) | `NOT NULL` |
| `spot_id` | `uuid` (FK → `parking_spots.id`) | `NOT NULL` |
| `status` | `text` (`active` \| `pending_payment` \| `completed` \| `cancelled`) | `NOT NULL`, default `active` |
| `entry_time` | `timestamptz` | `NOT NULL`, default `now()` |
| `exit_time` | `timestamptz` | nullable |
| `rate_snapshot_id` | `uuid` (FK → `rates.id`) | `NOT NULL` — referencia a la fila de tarifa vigente en el momento de creación |
| `rate_snapshot_price` | `numeric(10,2)` | `NOT NULL` — copia del valor numérico en el momento exacto de creación (ver 6.6.1) |
| `billable_hours` | `int` | nullable hasta el cálculo de salida |
| `total_amount` | `numeric(10,2)` | nullable hasta el cálculo de salida |
| `created_by` | `uuid` (FK → `users.id`) | quién registró la entrada |
| `closed_by` | `uuid` (FK → `users.id`) | nullable, quién cerró/canceló |
| `created_at` | `timestamptz` | default `now()` |

*Constraints de integridad (BR-001 y BR-002):*
```sql
CREATE UNIQUE INDEX one_active_session_per_vehicle
  ON parking_sessions (vehicle_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX one_active_session_per_spot
  ON parking_sessions (spot_id)
  WHERE status = 'active';
```
Estos dos índices únicos parciales son el mecanismo real que hace imposible, a nivel de motor de base de datos, que existan dos sesiones activas para el mismo vehículo o el mismo puesto — independientemente de qué tan rápido o simultáneo sea el intento.

#### 6.6.1 Por qué se guarda `rate_snapshot_id` **y** `rate_snapshot_price`

Guardar solo el `id` de la tarifa no es suficiente, porque si en el futuro se decide editar una tarifa mediante `UPDATE` (en vez de desactivar+crear, como se definió en 6.5), el snapshot se rompería silenciosamente. Guardar también el valor numérico (`rate_snapshot_price`) en el momento de creación de la sesión hace que la congelación de tarifa sea **inmune a cualquier cambio futuro en la tabla `rates`**, sin depender de que nadie respete la disciplina de "nunca hacer UPDATE". Es redundancia deliberada a favor de integridad histórica (BR-003).

### 6.7 `payments`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | |
| `session_id` | `uuid` (FK → `parking_sessions.id`) | `NOT NULL` |
| `amount` | `numeric(10,2)` | `NOT NULL`, `CHECK (amount > 0)` |
| `method` | `text` | libre (efectivo, otro) |
| `status` | `text` (`pending` \| `paid`) | `NOT NULL`, default `pending` |
| `paid_by` | `uuid` (FK → `users.id`) | quién registró el cobro |
| `created_at` | `timestamptz` | default `now()` |

*Constraint:* `UNIQUE (session_id)` — una sesión tiene como máximo un registro de pago (el modelo del MVP no soporta pagos parciales/múltiples).

### 6.8 `invoices` (comprobante demo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | |
| `session_id` | `uuid` (FK → `parking_sessions.id`) | `NOT NULL`, `UNIQUE` |
| `receipt_number` | `serial` / secuencia interna | `NOT NULL`, `UNIQUE` — numeración secuencial propia, no fiscal |
| `snapshot` | `jsonb` | copia inmutable de los datos mostrados en el comprobante (placa, tipo, horas, tarifa, total, método) en el momento de generación |
| `generated_at` | `timestamptz` | default `now()` |

*Por qué `jsonb` y no solo referencias:* el comprobante debe seguir siendo reproducible exactamente igual aunque cambien después los datos de `parking_lots` (nombre/dirección) — es, en esencia, un segundo nivel de snapshot, coherente con la misma filosofía aplicada a `rate_snapshot`.

### 6.9 `audit_logs`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` (PK) | |
| `user_id` | `uuid` (FK → `users.id`) | `NOT NULL` |
| `action` | `text` | ej. `rate.create`, `spot.create`, `session.cancel`, `user.deactivate` |
| `entity_type` | `text` | ej. `rate`, `parking_spot`, `parking_session` |
| `entity_id` | `uuid` | nullable |
| `metadata` | `jsonb` | detalles adicionales (valores antes/después cuando aplique) |
| `created_at` | `timestamptz` | default `now()` |

*Índice:* sobre `(entity_type, entity_id)` y sobre `created_at`, para consultas de auditoría por entidad o por fecha.

### 6.10 Diagrama relacional (alto nivel)

```
users (1) ───< parking_sessions (created_by / closed_by)
parking_lots (1) ───< parking_spots (1) ───< parking_sessions
vehicles (1) ───< parking_sessions
rates (1) ───< parking_sessions (rate_snapshot_id)
parking_sessions (1) ─── (1) payments
parking_sessions (1) ─── (1) invoices
users (1) ───< audit_logs
```

---

## 7. Database Integrity

| Regla del PRD | Mecanismo elegido | Justificación |
|---|---|---|
| Un vehículo no puede tener dos sesiones activas | **Índice único parcial** (`one_active_session_per_vehicle`) | El motor rechaza la segunda inserción concurrente sin lógica adicional; más simple y más confiable que un trigger. |
| Un puesto no puede tener dos sesiones activas | **Índice único parcial** (`one_active_session_per_spot`) | Igual razón que arriba. |
| Una sesión `completed` requiere pago `paid` | **Transacción + validación en Route Handler** (no un constraint SQL directo entre tablas distintas de forma declarativa simple) | Postgres no permite fácilmente un `CHECK` cross-tabla; se resuelve garantizando en una única transacción que el `UPDATE` de `payments.status = 'paid'` y el `UPDATE` de `parking_sessions.status = 'completed'` ocurren juntos o no ocurren. |
| Una sesión no puede modificarse después de `completed`/`cancelled` | **Application logic** (Route Handler rechaza el `UPDATE` si el estado actual no permite la transición) reforzada por **RLS** (política de `UPDATE` en `parking_sessions` que exige `status IN ('active','pending_payment')` en la fila objetivo) | Doble capa: aunque alguien accediera directamente a la base con las políticas RLS activas, la fila protegida no sería editable igualmente. |
| Un puesto `out_of_service` no puede recibir una nueva sesión | **Application logic** en el Route Handler de entrada (valida `spot.status = 'available'` antes de insertar) | No requiere constraint SQL porque la validación depende de leer el estado actual junto con otras reglas de negocio (tipo de vehículo compatible, etc.) — más claro como lógica de aplicación explícita. |
| Una tarifa aplicada a una sesión no cambia retroactivamente | **Snapshot duplicado** (`rate_snapshot_id` + `rate_snapshot_price`, sección 6.6.1) | Ver justificación arriba — inmune incluso a ediciones futuras de `rates`. |

**Por qué no se usan triggers:** ninguna de las reglas anteriores requiere reaccionar automáticamente a cambios en cascada que no puedan resolverse con un índice único, una transacción explícita, o una validación en el Route Handler antes de escribir. Añadir triggers aquí sería complejidad no justificada — más difícil de testear, de debuggear y de explicar en una entrevista que una transacción explícita en el backend.

---

## 8. Concurrencia

### 8.1 Caso principal: dos operadores asignan el mismo puesto simultáneamente

```
Operator A → POST /api/sessions (spot_id: A5, vehicle_plate: XYZ111)
Operator B → POST /api/sessions (spot_id: A5, vehicle_plate: ABC222)
             (llegan al servidor con ~10ms de diferencia)
```

**Paso a paso:**
1. Ambas solicitudes llegan al Route Handler de "crear sesión" casi simultáneamente.
2. Cada solicitud abre una transacción independiente en Postgres.
3. Cada transacción intenta `INSERT INTO parking_sessions (spot_id, ...) VALUES ('A5', ...)`.
4. El índice único parcial `one_active_session_per_spot` se evalúa **a nivel de motor**, no de aplicación: la primera transacción en confirmar (`COMMIT`) tiene éxito; la segunda recibe un error de violación de restricción única (`23505`) al intentar confirmar.
5. El Route Handler captura ese código de error específico y responde con `409 Conflict` y un mensaje de negocio ("Este puesto ya fue asignado a otro vehículo, actualiza la vista").
6. El frontend, al recibir `409`, refresca el estado del grid (vía Realtime o refetch) y muestra el mensaje de forma no destructiva — el operador ve inmediatamente que el puesto ya no está disponible y elige otro.

**Garantías:**
- **Operación atómica:** sí — la validación de unicidad ocurre dentro de la misma transacción que la inserción, no en un paso previo separado (evitando el clásico bug de "leer disponible, luego insertar" con ventana de carrera).
- **Integridad:** sí — imposible tener dos filas `active` para el mismo `spot_id`, garantizado por el motor.
- **Resultado determinista:** sí — siempre gana quien confirma primero; nunca hay un estado ambiguo.
- **Manejo del error en frontend:** mensaje claro, sin exponer detalles internos (nunca se muestra el código SQL `23505` al usuario).

### 8.2 Otros casos de concurrencia

| Caso | Comportamiento |
|---|---|
| Dos entradas simultáneas del mismo vehículo | Mismo mecanismo con `one_active_session_per_vehicle`; la segunda solicitud falla con `409` y mensaje "este vehículo ya tiene una sesión activa". |
| Dos salidas simultáneas de la misma sesión | La transición de estado (`active`/`pending_payment` → `completed`) se valida leyendo el estado actual dentro de la misma transacción (`SELECT ... FOR UPDATE`); la segunda solicitud, al encontrar que el estado ya cambió, es rechazada con `409` ("esta sesión ya fue cerrada"). |
| Pago duplicado | El constraint `UNIQUE (session_id)` en `payments` impide una segunda fila de pago para la misma sesión; la segunda solicitud de pago recibe `409`. |
| Doble actualización de estado (ej. dos admins marcando el mismo puesto `out_of_service`) | Idempotente por diseño: si el estado destino ya es el mismo, el Route Handler responde `200` sin error (no es una condición de error real, solo una operación redundante). |

---

## 9. Business Logic — dónde vive cada regla

| Tipo de lógica | Dónde se ejecuta | Ejemplos |
|---|---|---|
| Puramente visual | Cliente (React) | Resaltar el puesto seleccionado, animaciones, formato de fecha en pantalla. |
| Validación de entrada (forma) | Cliente (feedback inmediato) **y** servidor (fuente de verdad) | Placa no vacía, formato básico — el cliente valida para UX, el servidor vuelve a validar siempre. |
| Lógica de negocio (reglas BR-*) | Servidor (Route Handlers) | Compatibilidad de tipo de vehículo con puesto, transiciones de estado válidas. |
| Cálculo financiero | Servidor exclusivamente | `horas_a_cobrar` y `total_amount` — nunca se acepta un valor calculado por el cliente (BR-004). |
| Integridad de datos | Base de datos (constraints) + servidor (transacciones) | Índices únicos parciales, `CHECK`, transacciones multi-tabla. |
| Autorización | Servidor (Route Handler) + base de datos (RLS) | Doble capa: el backend verifica el rol antes de procesar, y RLS lo verifica de nuevo a nivel de fila. |

**Regla general del proyecto:** el frontend nunca es fuente de confianza. Todo lo que involucre dinero o cambio de estado crítico se recalcula y se revalida en servidor, sin importar lo que haya calculado o mostrado el cliente.

---

## 10. API / Backend Contracts

*(Diseño de casos de uso, no código. Los nombres de ruta son ilustrativos.)*

### 10.1 `POST /api/auth/login`
- **Actor:** Admin, Operador.
- **Input:** email, password.
- **Validaciones:** credenciales válidas, usuario `is_active = true`.
- **Autorización:** ninguna (endpoint público).
- **Lógica:** delega en Supabase Auth; crea sesión (cookie JWT).
- **Efectos secundarios:** ninguno registrado en `audit_logs` (login no es una acción sensible de negocio).
- **Output:** sesión establecida, datos básicos del usuario (id, rol).
- **Errores:** `401` credenciales inválidas; `403` usuario desactivado.

### 10.2 `POST /api/parking-lot` (create/update configuration)
- **Actor:** Admin únicamente.
- **Input:** nombre, dirección, filas, columnas.
- **Validaciones:** filas/columnas > 0.
- **Autorización:** rol `admin` (verificado en servidor + RLS).
- **Lógica:** crea/actualiza `parking_lots`; si es creación inicial, genera automáticamente `rows × columns` filas en `parking_spots` dentro de la misma transacción.
- **Efectos secundarios:** entrada en `audit_logs` (`parking_lot.configure`).
- **Output:** configuración guardada + lista de puestos generados.
- **Errores:** `400` valores inválidos; `403` rol no autorizado.

### 10.3 `POST /api/spots` / `PATCH /api/spots/:id`
- **Actor:** Admin (crear/retirar/tipo); Admin u Operador (marcar `out_of_service`/`available`).
- **Input:** número de puesto, tipo de vehículo aceptado, o cambio de estado + motivo.
- **Validaciones:** no se puede marcar `out_of_service` un puesto con sesión activa (BR de la sección 7).
- **Autorización:** según acción (ver matriz sección 12).
- **Lógica:** valida y actualiza `parking_spots.status`.
- **Efectos secundarios:** `audit_logs` (`spot.create`, `spot.status_change`).
- **Output:** puesto actualizado.
- **Errores:** `409` si tiene sesión activa; `403` si el rol no corresponde a la acción.

### 10.4 `POST /api/rates`
- **Actor:** Admin únicamente.
- **Input:** tipo de vehículo, valor por hora.
- **Validaciones:** valor > 0.
- **Autorización:** rol `admin`.
- **Lógica:** desactiva la tarifa activa anterior para ese tipo (si existe) e inserta una nueva fila activa, en una sola transacción (ver 6.5).
- **Efectos secundarios:** `audit_logs` (`rate.create`, con valores antes/después en `metadata`).
- **Output:** tarifa activa actualizada.
- **Errores:** `400` valor inválido; `403` rol no autorizado.

### 10.5 `POST /api/sessions` (register vehicle entry + assign spot)
- **Actor:** Admin, Operador.
- **Input:** placa (obligatoria), tipo de vehículo, `spot_id`.
- **Validaciones:** placa no vacía; puesto `available` y compatible con el tipo de vehículo; vehículo sin sesión activa; existe tarifa activa para ese tipo de vehículo.
- **Autorización:** cualquier usuario autenticado (Admin u Operador).
- **Lógica:** dentro de una transacción — busca o crea `vehicles` por placa; toma snapshot de la tarifa activa vigente; inserta `parking_sessions` (`active`); actualiza `parking_spots.status = 'occupied'`.
- **Efectos secundarios:** ninguno en `audit_logs` (operación rutinaria, no sensible — ver sección 12).
- **Output:** sesión creada con datos del vehículo y puesto.
- **Errores:** `400` placa vacía; `404` tarifa inexistente para el tipo de vehículo; `409` vehículo con sesión activa o puesto no disponible.

### 10.6 `POST /api/sessions/:id/calculate-exit`
- **Actor:** Admin, Operador.
- **Input:** `session_id` (la hora de salida la fija el servidor con `now()`, nunca el cliente).
- **Validaciones:** sesión en estado `active`.
- **Autorización:** cualquier usuario autenticado.
- **Lógica:** calcula `duración = now() - entry_time`; aplica `horas_a_cobrar = max(1, ceil(minutos/60))`; `total = horas_a_cobrar × rate_snapshot_price`; devuelve el desglose sin cambiar el estado todavía (paso previo a confirmar pago).
- **Output:** desglose (duración, horas cobradas, tarifa, total).
- **Errores:** `409` si la sesión no está `active`.

### 10.7 `POST /api/sessions/:id/complete` (registrar pago y cerrar)
- **Actor:** Admin, Operador.
- **Input:** `session_id`, método de pago. **No recibe el monto** — se recalcula en servidor a partir de los mismos datos que 10.6.
- **Validaciones:** sesión en `active` o `pending_payment`.
- **Autorización:** cualquier usuario autenticado.
- **Lógica (transacción única):** recalcula el monto en servidor; inserta `payments` (`paid`); actualiza `parking_sessions` (`completed`, `exit_time`, `total_amount`); actualiza `parking_spots.status = 'available'`; genera `invoices` con el snapshot de datos a mostrar.
- **Efectos secundarios:** ninguno adicional en `audit_logs` (el pago y comprobante quedan en sus propias tablas, ya auditables por existencia).
- **Output:** sesión cerrada + comprobante generado.
- **Errores:** `409` transición inválida.

### 10.8 `POST /api/sessions/:id/exit-without-payment`
- **Actor:** Admin, Operador.
- **Input:** `session_id`.
- **Validaciones:** sesión `active`.
- **Lógica:** recalcula el monto (queda registrado, sin pago asociado todavía); actualiza `parking_sessions` (`pending_payment`, `exit_time`, `total_amount`); libera el puesto (`available`).
- **Output:** sesión en `pending_payment` con monto pendiente.
- **Errores:** `409` transición inválida.

### 10.9 `POST /api/sessions/:id/cancel`
- **Actor:** Admin, Operador — **solo si la sesión no tiene pago asociado** (decisión confirmada).
- **Validaciones:** sesión en `active`; no existe fila en `payments` para esa sesión.
- **Lógica:** actualiza `parking_sessions` (`cancelled`); libera el puesto (`available`).
- **Efectos secundarios:** `audit_logs` (`session.cancel`).
- **Output:** sesión cancelada.
- **Errores:** `403` si la sesión ya tiene pago (independientemente del rol); `409` si no está `active`.

### 10.10 `GET /api/receipts/:sessionId`
- **Actor:** Admin, Operador.
- **Lógica:** retorna el `snapshot` almacenado en `invoices` (nunca recalcula desde datos actuales).
- **Output:** contenido del comprobante listo para mostrar/imprimir.

### 10.11 `GET /api/history` (sesiones y pagos)
- **Actor:** Admin, Operador (ambos con acceso completo, decisión del PRD).
- **Input:** filtros de rango de fechas (opcional).
- **Lógica:** consulta paginada sobre `parking_sessions` con `payments` e `invoices` relacionados.
- **Output:** lista paginada.

### 10.12 `GET /api/dashboard`
- **Actor:** Admin, Operador.
- **Lógica:** agregaciones (`COUNT`, `SUM`, `AVG`) sobre `parking_spots` y `parking_sessions` del día actual.
- **Output:** las 7 métricas definidas en el PRD.

### 10.13 `GET /api/audit`
- **Actor:** Admin únicamente.
- **Lógica:** consulta paginada sobre `audit_logs`, filtrable por entidad/usuario/fecha.
- **Output:** lista de eventos de auditoría.

---

## 11. Authentication

- **Mecanismo:** Supabase Auth con email + password (suficiente para un sistema de uso interno con Admin/Operador — no se requiere OAuth social).
- **Sesión:** JWT gestionado por Supabase, almacenado en cookies HTTP-only mediante `@supabase/ssr`, con refresh automático.
- **Expiración:** token de acceso de corta duración (config. por defecto de Supabase, ~1 hora) con refresh token de mayor duración; expiración de sesión total razonable para un turno de trabajo (config. estándar, sin necesidad de personalización especial para el MVP).
- **Recuperación de contraseña:** flujo estándar de Supabase Auth (email de restablecimiento) — suficiente, no se construye nada a medida.
- **Logout:** invalida la sesión del lado de Supabase y limpia cookies.
- **Protección de rutas:** middleware de Next.js redirige a login si no hay sesión válida antes de renderizar cualquier ruta protegida; los Route Handlers vuelven a verificar la sesión de forma independiente (nunca confían solo en el middleware).
- **Gestión de usuarios:** el Admin crea cuentas de Operador desde la aplicación (no se expone un flujo de auto-registro público — este no es un producto de cara al público).

## 12. Authorization — matriz

| Acción | Admin | Operador |
|---|---|---|
| Configurar parqueadero (parking lot) | ✅ | ❌ |
| Crear/editar/retirar puestos | ✅ | ❌ |
| Marcar puesto `out_of_service` / `available` | ✅ | ✅ |
| Configurar tarifas | ✅ | ❌ |
| Gestionar usuarios (crear/desactivar) | ✅ | ❌ |
| Registrar entrada | ✅ | ✅ |
| Registrar salida | ✅ | ✅ |
| Registrar pago | ✅ | ✅ |
| Cancelar sesión `active` sin pago | ✅ | ✅ |
| Cancelar sesión con pago asociado | ❌ (no existe ninguna vía — ver decisión confirmada) | ❌ |
| Consultar historial | ✅ | ✅ |
| Consultar dashboard | ✅ | ✅ |
| Consultar auditoría | ✅ | ❌ |

**Implementación en dos capas:**
1. **Route Handler:** cada endpoint verifica el rol del usuario autenticado antes de ejecutar cualquier lógica.
2. **Row Level Security (RLS):** políticas en las tablas `rates`, `parking_lots`, `users`, `audit_logs` que solo permiten `INSERT`/`UPDATE` a filas cuando `auth.uid()` corresponde a un usuario con `role = 'admin'`. Esto significa que incluso si un Route Handler tuviera un bug de autorización, la base de datos rechazaría igualmente la operación no autorizada.

## 13. Security Architecture

| Área | Diseño |
|---|---|
| Autenticación | Supabase Auth, JWT en cookies HTTP-only. |
| Autorización | Doble capa: verificación en servidor + RLS (sección 12). |
| Acceso a base de datos | El cliente del navegador nunca usa la `service_role key`; solo usa la `anon key` sujeta a RLS. Las operaciones que requieren bypass de RLS (ej. agregaciones de dashboard) se ejecutan exclusivamente desde Route Handlers en servidor, nunca desde el cliente. |
| RLS | Activado en todas las tablas con datos operativos y de configuración. |
| Validación de entrada | Esquemas de validación (ej. Zod) en cada Route Handler antes de tocar la base de datos. |
| Cálculos en servidor | Todo cálculo financiero se recalcula en servidor, nunca se confía en el valor recibido del cliente (secciones 9 y 10.6/10.7). |
| Secrets | `service_role key` y cualquier credencial sensible viven solo en variables de entorno del servidor, nunca en código ni en el bundle del cliente. |
| Variables de entorno | Ver sección 15. |
| XSS | React escapa por defecto; se evita `dangerouslySetInnerHTML`. |
| CSRF | Mitigado por el uso de cookies `SameSite` gestionadas por Supabase SSR; los Route Handlers que mutan estado requieren método `POST`/`PATCH` explícito, no `GET`. |
| Inyección SQL | Se usa exclusivamente el cliente de Supabase (consultas parametrizadas); no se construye SQL por concatenación de strings. |
| Rate limiting / abuso | Nivel básico suficiente para el MVP: límite de intentos de login gestionado por Supabase Auth; no se requiere una capa de rate limiting adicional para un sistema interno de bajo tráfico. |
| Logging | Errores de servidor se registran en logs de la plataforma de hosting (Vercel); eventos de negocio sensibles se registran en `audit_logs` (base de datos, no logs de texto). |
| Data minimization | Solo se almacena placa y tipo de vehículo — ningún dato del propietario/conductor (BR y Non-Goal del PRD). |

No se incluyen amenazas irrelevantes para este sistema (ej. protección contra bots de scraping masivo, DDoS a gran escala) porque el perfil de uso es un sistema interno de bajo tráfico, no una aplicación pública de alto volumen.

## 14. Error Handling

| Situación | Código HTTP | Mensaje al usuario |
|---|---|---|
| No autenticado | `401` | "Tu sesión expiró, inicia sesión de nuevo." |
| No autorizado (rol insuficiente) | `403` | "No tienes permisos para esta acción." |
| Puesto no disponible | `409` | "Este puesto ya no está disponible, elige otro." |
| Vehículo ya dentro | `409` | "Este vehículo ya tiene una sesión activa." |
| Sin puesto compatible | `404` / lista vacía | "No hay puestos disponibles para este tipo de vehículo." |
| Tarifa inexistente | `404` | "No hay una tarifa configurada para este tipo de vehículo. Contacta al administrador." |
| Transición de estado inválida | `409` | "Esta sesión ya fue cerrada o modificada, actualiza la vista." |
| Pago incompleto | *(no es error)* `200` | Se maneja como flujo válido (`pending_payment`), no como error. |
| Conflicto de asignación concurrente | `409` | Ver sección 8.1. |
| Falla de base de datos | `500` | "Ocurrió un error inesperado, intenta de nuevo." (sin detalles internos) |

Principio general: los mensajes explican **qué pasó** y **qué puede hacer el usuario**, sin exponer stack traces, nombres de tablas, ni detalles de infraestructura.

## 15. Environment Management

```
.env.local          # desarrollo local — nunca se commitea
.env.example         # plantilla sin valores reales — sí se commitea
Production env vars  # configuradas en el panel del proveedor de hosting (Vercel)
```

| Variable | Público/Secreto | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Público | URL del proyecto Supabase — seguro de exponer al cliente. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público | Clave anónima, sujeta a RLS — seguro de exponer al cliente. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreto** | Bypassa RLS — usada únicamente en Route Handlers de servidor (ej. agregaciones de dashboard). **Nunca** debe llegar al bundle del cliente ni a `NEXT_PUBLIC_*`. |

`.env.example` contiene solo los nombres de las variables, sin valores reales. Este documento tampoco incluye ningún valor real de credencial.

## 16. Performance

- **Consultas del dashboard:** agregaciones simples (`COUNT`, `SUM`, `AVG`) sobre tablas pequeñas (un solo parqueadero) — no requieren optimización especial en el MVP.
- **Historial:** paginación por cursor o por página simple (`LIMIT`/`OFFSET`) es suficiente para el volumen esperado.
- **Índices:** los definidos en la sección 6 (estado de puesto, sesiones activas, auditoría por entidad/fecha) cubren las consultas frecuentes reales; no se agregan índices especulativos.
- **Realtime:** ver sección 17 — se usa solo donde aporta valor directo.
- **Caching:** no se introduce una capa de caché (Redis u otra) — el volumen de datos de un solo parqueadero no lo justifica; sería complejidad sin beneficio medible.

No se aplica ninguna optimización que no esté justificada por un requisito real del PRD — evitar optimización prematura es una decisión explícita, no un descuido.

## 17. Realtime

| Dato | ¿Necesita tiempo real? | Decisión |
|---|---|---|
| Estado del grid de puestos | Sí — es el valor central del producto: "un operador debe poder saber rápidamente qué puestos están disponibles" (PRD, sección UX) | **Supabase Realtime** (suscripción a cambios en `parking_spots`) |
| Lista de sesiones activas | Sí, en menor medida — útil pero no crítico si se actualiza cada pocos segundos | **Supabase Realtime**, reutilizando el mismo canal (es prácticamente gratis técnicamente una vez que ya se paga el costo de integrarlo para el grid) |
| Dashboard | No — se consulta al entrar a la pantalla y se puede refrescar manualmente o con un polling ligero (ej. cada 30-60s) | **Polling manual/periódico**, no Realtime |
| Historial | No — datos consultados bajo demanda, no cambian mientras se están viendo | **Sin actualización automática** |

**Trade-off aceptado:** se activa Realtime solo para el grid de puestos y sesiones activas, porque ahí sí cambia la decisión operativa del usuario en el momento (qué puesto asignar). Para dashboard e historial, agregar Realtime sería complejidad sin beneficio perceptible — un simple refetch al entrar a la pantalla es suficiente y mucho más simple de mantener y de testear.

## 18. Project Structure

```
parking-management-system/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (protected)/
│   │   ├── dashboard/
│   │   ├── spots/                # grid + configuración de puestos
│   │   ├── entry/                # registrar entrada
│   │   ├── sessions/             # sesiones activas / salida
│   │   ├── history/
│   │   ├── rates/                # solo admin
│   │   ├── users/                # solo admin
│   │   └── audit/                # solo admin
│   └── api/
│       ├── parking-lot/
│       ├── spots/
│       ├── rates/
│       ├── sessions/
│       ├── receipts/
│       ├── history/
│       ├── dashboard/
│       └── audit/
├── domain/                       # lógica de negocio pura (funciones testeables sin I/O)
│   ├── pricing.ts                # cálculo de horas y costo (BR-006, BR-014)
│   ├── session-transitions.ts    # validación de transiciones de estado válidas
│   └── authorization.ts          # reglas de la matriz de la sección 12
├── data/                         # capa de acceso a datos (clientes de Supabase, queries)
│   ├── supabase-client.ts
│   ├── spots.ts
│   ├── sessions.ts
│   ├── rates.ts
│   └── audit.ts
├── components/
│   ├── ui/                       # shadcn/ui, genéricos
│   └── domain/                   # SpotGrid, SessionCard, ReceiptView, DashboardMetrics
├── lib/
│   ├── validation/                # esquemas Zod por endpoint
│   └── auth/                      # helpers de sesión/middleware
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── supabase/
│   └── migrations/                # migraciones SQL versionadas
├── .env.example
└── README.md
```

**Principio:** `domain/` contiene la lógica de negocio pura (sin dependencias de Next.js ni de Supabase), lo que la hace directamente testeable con unit tests rápidos. `data/` es la única capa que conoce Supabase. `app/api/` orquesta: valida input, llama a `domain/` y `data/`, y responde. No se crean carpetas vacías ni capas de abstracción (ej. "repositorios genéricos", "casos de uso" como clases) que no aporten valor real a este tamaño de proyecto.

## 19. Development Workflow

- **Git:** GitHub Flow simple — rama `main` siempre desplegable, ramas de feature (`feature/vehicle-entry`, `fix/rate-snapshot`) que se mergean vía Pull Request.
- **Commits:** mensajes descriptivos en imperativo (ej. "Add unique index for active sessions per spot"); no se exige un formato estricto tipo Conventional Commits para un proyecto individual, pero es una buena práctica opcional.
- **Migrations:** todas las migraciones SQL viven versionadas en `supabase/migrations/`, aplicadas con el CLI de Supabase — nunca cambios manuales directos en el dashboard de producción.
- **Code review:** al ser un proyecto individual de portafolio, el "review" se sustituye por una checklist de PR personal (¿tiene test?, ¿toca dinero o estado crítico?, ¿está en el alcance del PRD?).
- **Tests:** se corren localmente antes de cada PR; opcionalmente en CI (GitHub Actions) ejecutando `test` y `build` en cada push a `main`.
- **Linting/formatting:** ESLint + Prettier con configuración estándar de Next.js; se ejecutan como parte del mismo pipeline de CI.
- **Environment setup:** `git clone` → `npm install` → `cp .env.example .env.local` (completar con las claves del proyecto Supabase) → `npm run dev`. Sin pasos ambiguos ni dependencias implícitas no documentadas.

## 20. Technical Trade-offs — Why this architecture?

| Decisión | Alternativas consideradas | Por qué se descartaron | Complejidad aceptada | Complejidad evitada |
|---|---|---|---|---|
| Supabase vs Firebase | Firebase/Firestore | El dominio es relacional; Firestore obligaría a reconstruir a mano integridad, joins y agregaciones que Postgres da nativamente (sección 3). | Aprender SQL básico y RLS. | Reimplementar integridad referencial en aplicación. |
| Next.js vs React+Vite | React + Vite + backend Node separado | Requeriría mantener dos proyectos/deploys solo para tener un lugar confiable donde calcular precios en servidor. | Aprender App Router y Route Handlers. | Mantener un segundo servicio backend. |
| Realtime vs polling | Polling en todas las vistas / Realtime en todas las vistas | Realtime en todo agregaría complejidad sin beneficio en dashboard/historial; polling en todo perdería el valor real del grid en vivo. | Integrar un canal Realtime (uno solo). | Múltiples canales/suscripciones innecesarias. |
| Server logic vs client logic | Confiar en cálculos del cliente para agilizar el desarrollo | Viola directamente BR-004 y el requisito de seguridad más citado del PRD. | Recalcular todo en servidor en cada operación relevante. | Ninguna — esta no era una opción válida real. |
| Constraints vs application-only validation | Validar unicidad solo en el backend (leer-antes-de-escribir) | No es atómico: dos solicitudes simultáneas podrían leer "disponible" al mismo tiempo antes de que ninguna escriba (condición de carrera clásica). | Diseñar índices únicos parciales correctamente. | Bugs de concurrencia difíciles de reproducir y depurar. |
| Sin triggers | Usar triggers de Postgres para todas las reglas de integridad | Más difícil de testear y de explicar; ninguna regla del PRD requiere reacción en cascada que una transacción explícita no resuelva igual de bien. | Escribir la lógica explícitamente en Route Handlers. | Lógica "invisible" oculta en la base de datos, difícil de rastrear durante debugging. |

## 21. Technical Risks

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Condición de carrera no cubierta por los índices únicos actuales (ej. en un flujo futuro no contemplado) | Baja | Alto | Todo nuevo endpoint que toque `parking_sessions`/`parking_spots` debe revisarse explícitamente contra las reglas de la sección 7 antes de mergear. |
| Autorización incorrecta (bug en un Route Handler que olvida verificar rol) | Media | Alto | Doble capa: RLS actúa como red de seguridad incluso si el Route Handler tiene un bug (sección 12). |
| Error de cálculo de tarifa (redondeo, mínimo de 1 hora) | Media | Medio | Unit tests exhaustivos sobre `domain/pricing.ts` cubriendo los casos límite del PRD (0, 1, 60, 61 min). |
| Cambios de tarifa que rompan snapshots existentes | Baja | Alto | Snapshot duplicado (id + valor numérico) — inmune incluso a errores de disciplina en el equipo (sección 6.6.1). |
| Inconsistencia entre sesión y pago (ej. sesión `completed` sin pago `paid`) | Baja | Alto | Ambas escrituras ocurren en una única transacción (sección 10.7) — o se confirman juntas o ninguna se confirma. |
| Realtime desincronizado (el cliente no recibe un evento) | Media | Bajo | El intento de asignación siempre se revalida en servidor (sección 8); Realtime es solo una optimización de UX, nunca la fuente de verdad. |
| Migraciones mal versionadas | Baja | Medio | Uso disciplinado del CLI de Supabase para migraciones, nunca cambios manuales en producción. |
| Dependencia de un proveedor externo (Supabase) | Baja | Medio | Aceptado conscientemente — es exactamente el trade-off de elegir un BaaS gestionado sobre infraestructura propia; razonable para el tamaño y objetivo educativo de este proyecto. |

## 22. Implementation Plan

- **Phase 0 — Project setup:** repositorio, Next.js, Supabase (proyecto + CLI + migraciones iniciales), variables de entorno, CI básico.
- **Phase 1 — Auth & roles:** tabla `users`, integración de Supabase Auth, middleware de rutas protegidas, matriz de autorización base.
- **Phase 2 — Parking configuration:** `parking_lots`, `parking_spots`, generación de grid, RLS básico.
- **Phase 3 — Rates:** `rates`, endpoint de configuración, lógica de "una tarifa activa por tipo".
- **Phase 4 — Vehicle entry:** `vehicles`, `parking_sessions` (creación), índices únicos parciales, endpoint de entrada.
- **Phase 5 — Active sessions:** vista de sesiones activas, integración Realtime del grid.
- **Phase 6 — Exit & pricing:** `domain/pricing.ts`, endpoint de cálculo de salida, unit tests de tarifación.
- **Phase 7 — Payments:** `payments`, endpoint de cierre con pago, flujo `pending_payment`.
- **Phase 8 — Receipt:** `invoices`, generación y vista del comprobante.
- **Phase 9 — Dashboard & history:** agregaciones, paginación de historial.
- **Phase 10 — Audit:** `audit_logs`, instrumentación de las acciones sensibles listadas en el PRD.
- **Phase 11 — Security hardening:** revisión completa de RLS, revisión de que ningún cálculo dependa del cliente, pruebas de autorización.
- **Phase 12 — Testing & deployment:** completar la pirámide de testing (sección 24), deploy a producción (sección 26).

Cada fase depende de que la anterior esté funcionalmente completa; no se recomienda paralelizar fases que comparten las mismas tablas centrales (`parking_sessions`).

---

## 23. Testing Strategy

- **Unit:** tarifación (`domain/pricing.ts` — todos los casos de la sección 24), validaciones de transición de estado, funciones puras de `domain/`.
- **Integration:** flujo completo de entrada, salida, pago y cierre de sesión contra una base de datos Postgres real (local o de test), verificando que los constraints de la sección 7 se respetan.
- **Security:** verificación de que un usuario `operator` no puede ejecutar acciones exclusivas de Admin (a nivel de Route Handler y, por separado, a nivel de RLS directamente contra la base).
- **Concurrency:** pruebas que lanzan dos solicitudes simultáneas de asignación del mismo puesto / mismo vehículo y verifican que exactamente una tiene éxito.
- **End-to-End:** login → registrar entrada → ver sesión activa → registrar salida → pagar → ver comprobante generado (flujo feliz completo, con Playwright u otra herramienta equivalente).

No se define una estrategia de cobertura porcentual estricta (ej. "80% de cobertura") — para un MVP de portafolio, el criterio es que **todos los casos críticos de la sección 24 tengan una prueba**, no alcanzar un número arbitrario.

## 24. Test Cases críticos

**Tarifación**
- 0 min → 1 hora cobrada.
- 1 min → 1 hora cobrada.
- 60 min → 1 hora cobrada.
- 61 min → 2 horas cobradas.
- Estadía larga (ej. 30 horas) → se cobran 30 horas, sin tope diario.

**Integridad**
- Dos intentos de crear sesión activa para el mismo vehículo → uno tiene éxito, el otro falla con `409`.
- Dos intentos de asignar el mismo puesto → uno tiene éxito, el otro falla con `409`.

**Seguridad**
- Operador intenta modificar una tarifa → `403`.
- Operador intenta configurar el parqueadero → `403`.
- Usuario no autenticado intenta cualquier operación protegida → `401`.

**Estado**
- `active → completed` solo ocurre si el pago asociado queda `paid` en la misma transacción.
- `active → pending_payment` cuando no se completa el pago en el momento de salida.
- `pending_payment → completed` al completar el pago posteriormente.
- `completed` no admite ningún `UPDATE` posterior (verificado tanto en Route Handler como en RLS).

**Concurrencia**
- Dos asignaciones simultáneas sobre el mismo puesto → una gana, otra falla de forma determinista y con mensaje claro en frontend.

---

## 25. Deployment

- **Frontend hosting:** Vercel (integración nativa con Next.js, deploy automático desde `main`).
- **Backend/database hosting:** Supabase (proyecto gestionado — base de datos, Auth, Realtime).
- **Environment variables:** configuradas en el panel de Vercel para producción; `.env.local` solo en desarrollo (sección 15).
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY` configurada únicamente como variable de entorno de servidor en Vercel, nunca expuesta al bundle del cliente.
- **Migrations:** aplicadas con el CLI de Supabase como parte del flujo de despliegue (`supabase db push` o equivalente), nunca editadas manualmente en el dashboard de producción.
- **Database backups:** backups automáticos gestionados por Supabase (plan gratuito incluye backups con retención limitada — suficiente para un proyecto de portafolio; se documenta como limitación conocida, no como gap crítico).
- **Preview/staging:** Vercel genera automáticamente un deploy de preview por cada Pull Request, apuntando a un proyecto Supabase de desarrollo/staging separado del de producción.
- **Production:** rama `main` desplegada automáticamente tras pasar CI.
- **Dominio personalizado:** opcional, configurable directamente en Vercel si se desea para el portafolio.
- **Rollback básico:** Vercel permite revertir instantáneamente a un deploy anterior; las migraciones de base de datos se diseñan, cuando es posible, para ser aditivas (no destructivas) durante el MVP, minimizando el riesgo de necesitar un rollback de esquema.

No se diseña Docker, Kubernetes, ni infraestructura cloud propia — no existe una necesidad real para el tamaño y objetivo de este proyecto, y hacerlo sería sobreingeniería explícitamente fuera de la prioridad "Simplicity > Scalability" definida al inicio de este documento.

---

## 26. Technical Definition of Done

- [ ] Stack seleccionado y justificado (Next.js + Supabase, secciones 3-4).
- [ ] Arquitectura de alto nivel definida (sección 2).
- [ ] Modelo de base de datos completo para las 9 entidades (sección 6).
- [ ] Autenticación definida (sección 11).
- [ ] Autorización definida con matriz completa (sección 12).
- [ ] Seguridad definida (sección 13).
- [ ] Concurrencia definida con el caso crítico resuelto paso a paso (sección 8).
- [ ] Estrategia de testing definida (secciones 23-24).
- [ ] Deployment definido (sección 25).
- [ ] Variables de entorno definidas (sección 15).
- [ ] Riesgos técnicos identificados con mitigación (sección 21).
- [ ] Fases de implementación definidas y ordenadas (sección 22).

---

## 27. PRD Traceability Matrix

| PRD Requirement | Technical Solution |
|---|---|
| Autenticación (FR-01) | Supabase Auth + JWT en cookies (sección 11). |
| Roles Admin/Operador (FR-01, BR-008/009) | Tabla `users.role` + matriz de autorización en dos capas (sección 12). |
| Configuración del parqueadero (FR-02) | `parking_lots` + endpoint 10.2. |
| Puestos y grid (FR-03, FR-04, FR-05) | `parking_spots`, generación automática del grid en la misma transacción de creación del `parking_lot`. |
| Registro de entrada / asignación de puesto (FR-06) | Endpoint 10.5, `parking_sessions`. |
| Sesiones activas / integridad (BR-001, BR-002) | Índices únicos parciales (sección 6.6, 7). |
| Cálculo automático de duración y costo (FR-09, BR-006, BR-014) | `domain/pricing.ts`, endpoint 10.6, cálculo exclusivamente en servidor. |
| Tarifas por tipo de vehículo (FR-10) | `rates`, endpoint 10.4. |
| Tarifa congelada (BR-003) | `rate_snapshot_id` + `rate_snapshot_price` (sección 6.6.1). |
| Registro de pago (FR-12) | `payments`, endpoint 10.7. |
| Pago incompleto (US-EXIT-003) | Endpoint 10.8, estado `pending_payment`. |
| Monto calculado en servidor (BR-004) | Endpoints 10.6/10.7 nunca aceptan un monto del cliente. |
| Comprobante demo (FR-14, sección 19 del PRD) | `invoices` con `snapshot` en `jsonb`, endpoint 10.10. |
| Historial (FR-15) | Endpoint 10.11, consultable por Admin y Operador (decisión confirmada). |
| Dashboard (FR-16) | Endpoint 10.12, agregaciones SQL. |
| Auditoría (FR-17, BR-012) | `audit_logs`, instrumentado en los endpoints de configuración/tarifas/puestos/usuarios/cancelaciones. |
| Concurrencia / doble asignación (BR-002) | Sección 8, índices únicos parciales + manejo de `409`. |
| Sesión completed inmutable (BR-005) | Validación en Route Handler + política RLS de `UPDATE` restringida por estado (sección 7). |
| Seguridad general (sección 20 del PRD) | Sección 13 de este documento. |

---

## 28. No-Goals (reafirmados)

Explícitamente **no** se diseña infraestructura para:
- Facturación electrónica legal ante la DIAN, CUFE real, firma digital, XML fiscal.
- Multi-tenant / multi-parqueadero.
- CRM de vehículos o datos del propietario.
- Pasarela de pago real.
- Reconocimiento automático de placas.
- Reservas de puestos.
- Layout con posición libre X/Y o zonas.
- Tarifas especiales por horario/día.
- Mecanismo de anulación de sesiones `completed` (decisión confirmada en este documento).

Ningún esquema de base de datos, endpoint ni componente de este documento contempla estas funcionalidades.

---

## 29. Open Questions — estado final

| Pregunta | Estado |
|---|---|
| ¿Quién puede cancelar una sesión `active`? | **Resuelta:** Admin y Operador, solo si no tiene pago asociado. |
| ¿Existe anulación de sesiones `completed`? | **Resuelta:** no, `completed` es inmutable en el MVP. |
| ¿Los puestos aceptan cualquier tipo de vehículo? | **Resuelta (heredada):** sí, `vehicle_type` nullable. |

No quedan preguntas abiertas bloqueantes para pasar a la fase de Agent Documentation.

---

## 30. Handoff Context

**Producto:** Parking Management System — MVP de un solo parqueadero, dos roles (Admin, Operador), operación de entrada/salida/pago con comprobante interno de demostración.

**Stack:** Next.js (App Router) + Supabase (Postgres, Auth, RLS, Realtime) + shadcn/ui + Tailwind. Prototipado visual en Lovable, reimplementado dentro de esta arquitectura.

**Arquitectura:** monolito full-stack, sin microservicios. Route Handlers de Next.js como única puerta de entrada para operaciones que calculan dinero o cambian estado. `domain/` contiene lógica de negocio pura y testeable; `data/` es la única capa que habla con Supabase.

**Base de datos:** 9 tablas (sección 6), con dos índices únicos parciales como mecanismo central de integridad (`one_active_session_per_vehicle`, `one_active_session_per_spot`). Tarifas nunca se editan con `UPDATE`, siempre se desactivan y se crea una nueva fila. Snapshots duplicados (id + valor) para tarifas y comprobantes.

**Seguridad:** doble capa (Route Handler + RLS) en toda acción de configuración/tarifas/usuarios/auditoría. Ningún cálculo financiero se acepta del cliente.

**Testing:** pirámide ligera — unit en `domain/`, integration contra Postgres real, casos específicos de concurrencia y seguridad (secciones 23-24).

**Deployment:** Vercel (frontend) + Supabase (datos), sin infraestructura propia.

**Restricciones irreversibles/importantes:**
- La congelación de tarifa se implementa con snapshot duplicado, no solo por referencia — no simplificar esto en el Build.
- Los dos índices únicos parciales son el mecanismo real de integridad — no reemplazarlos por validaciones "leer antes de escribir" en aplicación.
- `completed` es un estado terminal real — no agregar ninguna vía de edición, ni siquiera "solo para el desarrollador durante testing", sin volver a esta decisión explícitamente.
- Cancelación de sesión `active` solo es válida si no existe fila en `payments` para esa sesión.

**Convenciones técnicas:** Route Handlers como contrato de API explícito (no Server Actions difusas); Zod para validación de input; nombres de acción de auditoría con patrón `entidad.acción` (ej. `rate.create`).

**Riesgos conocidos:** ver sección 21 — los más relevantes para el Build son la disciplina de transacciones (secciones 8 y 10.7) y la doble capa de autorización (sección 12).

**MVP boundaries:** ver sección 28 (No-Goals) — cualquier funcionalidad ahí listada que aparezca "necesaria" durante el Build debe tratarse como scope creep y confirmarse explícitamente antes de implementarse, no asumirse.

---

## Technical Design Validation Report

**Requisitos cubiertos:** los 18 Functional Requirements del PRD, las 14 Business Rules, las 4 transiciones de estado con sus restricciones, los 7 requisitos de seguridad, los edge cases de tarifación y concurrencia, y los criterios de MVP Release Criteria tienen una solución técnica explícita y trazable (sección 27).

**Decisiones técnicas principales:**
- Supabase (Postgres) sobre Firebase, por adecuación relacional del dominio y garantías de integridad bajo concurrencia (sección 3).
- Next.js (App Router) sobre React+Vite, para evitar un backend separado solo para calcular precios en servidor (sección 4).
- Índices únicos parciales como mecanismo central de integridad, sin triggers (secciones 7-8).
- Snapshot duplicado (id + valor) para tarifas y comprobantes (secciones 6.6.1, 6.8).
- Realtime limitado al grid de puestos y sesiones activas; polling/refetch para dashboard e historial (sección 17).
- Doble capa de autorización (Route Handler + RLS) en toda acción sensible (sección 12).

**Supabase vs Firebase:** decisión documentada con tabla comparativa de 23 criterios y justificación explícita del criterio decisivo (integridad y concurrencia de `ParkingSession`/`ParkingSpot`) — sección 3.

**Riesgos:** ocho riesgos identificados con probabilidad, impacto y mitigación (sección 21); ninguno de probabilidad e impacto simultáneamente altos sin mitigación definida.

**Decisiones pendientes:** ninguna bloqueante (sección 29). Las tres preguntas del PRD quedaron resueltas con confirmación explícita del usuario antes de generar este documento.

**Trade-offs:** documentados explícitamente en la sección 20, incluyendo qué complejidad se acepta y cuál se evita en cada decisión mayor.

**Posibles puntos débiles:**
- Los backups automáticos del plan gratuito de Supabase tienen retención limitada — aceptable para portafolio, pero debe mencionarse si el proyecto se presenta como "production-ready" en una entrevista.
- El MVP asume un único `parking_lot`; si en el futuro se quisiera multi-parqueadero, varias tablas (`parking_spots`, `rates`) necesitarían un `parking_lot_id` como parte de más constraints (ya está parcialmente preparado en `parking_spots`, pero `rates` no lo tiene — se documenta como deuda técnica consciente, no como descuido).

**Recomendaciones antes de pasar a Agent Documentation:**
1. Confirmar que el proyecto Supabase (dev/staging) esté creado antes de generar `AGENTS.md`, para que las migraciones iniciales puedan referenciarse con datos reales del proyecto.
2. Al generar `AGENTS.md`, incluir explícitamente las restricciones irreversibles de la sección "Handoff Context" como reglas que el agente de código no debe reinterpretar ni simplificar.
3. Mantener este documento y el PRD como fuente de verdad durante el Build — cualquier desviación detectada durante la implementación debe volver aquí para actualizarse, no resolverse silenciosamente en el código.

---

## Siguiente paso

Con el Technical Design aprobado, el proyecto está listo para pasar a **Agent Documentation** (`AGENTS.md`, `MEMORY.md`, `REVIEW-CHECKLIST.md`, `agent_docs/*`), usando `part4-notes-for-agent.md` del repositorio de referencia como base, con este documento y el PRD como contexto de entrada.
