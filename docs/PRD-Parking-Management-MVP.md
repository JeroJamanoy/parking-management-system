# PRD — Parking Management System (MVP)

**Metodología:** vibe-coding-prompt-template — fase 2 de 4 (Research → **PRD** → Tech Design → AGENTS.md/agent_docs → Build).
**Documento fuente:** `research-Parking-Management.md`.
**Naturaleza del documento:** contrato funcional del MVP. No contiene arquitectura técnica, estructura de carpetas, endpoints, ni definiciones de base de datos.

---

## 1. Product Overview

Parking Management System es una aplicación web para operar un parqueadero de un solo lote. Permite configurar puestos, registrar entradas y salidas de vehículos, calcular automáticamente el costo de cada estadía, registrar pagos, consultar historial y generar un comprobante interno de demostración. Es un proyecto de portafolio de Ingeniería de Sistemas, con calidad suficiente para ser explicado técnicamente en una entrevista.

## 2. Problem Statement

Un parqueadero pequeño que opera de forma manual (cuaderno, hojas de cálculo o cálculo mental) no tiene control confiable de cuántos puestos están ocupados en tiempo real, es propenso a errores de cálculo de tarifa, no deja rastro auditable de quién cobró qué, y no puede demostrar de forma consistente cuánto debe pagar un cliente. El sistema resuelve esto centralizando el estado del parqueadero y automatizando el cálculo del cobro.

## 3. Product Vision

Un sistema operativo simple y confiable para un parqueadero de un solo lote, donde cualquier miembro del personal (Admin u Operador) pueda ver el estado real de los puestos, registrar una estadía completa sin ambigüedad, y confiar en que el monto cobrado es siempre correcto y verificable.

## 4. Goals

- Reflejar en todo momento el estado real de ocupación del parqueadero.
- Garantizar que cada vehículo y cada puesto tengan como máximo una sesión activa.
- Calcular el costo de cada estadía de forma automática, consistente y no manipulable desde el cliente.
- Dejar un historial y una auditoría mínima de lo ocurrido.
- Producir un comprobante de demostración legible, sin pretender validez fiscal.

## 5. Non-Goals

- No es un sistema de facturación electrónica legal ante la DIAN.
- No gestiona múltiples parqueaderos ni es multi-tenant.
- No mantiene un CRM de clientes/propietarios de vehículos.
- No incluye reservas, pagos electrónicos reales, notificaciones, ni reconocimiento automático de placas.
- No optimiza asignación de puestos ni predice demanda.

## 6. Target Users

Personal operativo de un parqueadero pequeño o mediano: dueño/administrador del negocio y personal de turno encargado de recibir y despachar vehículos.

## 7. Personas / User Roles

### 7.1 Admin
Dueño o encargado general del parqueadero. Configura el negocio (parqueadero, puestos, tarifas), gestiona usuarios, y también puede operar el día a día (entradas, salidas, pagos).

### 7.2 Operador
Personal de turno. Opera el día a día: registra entradas, asigna puestos, registra salidas y pagos, y consulta historial y dashboard con el mismo nivel de detalle que el Admin. No puede configurar el parqueadero, los puestos, las tarifas, ni gestionar usuarios.

> **Decisión confirmada:** el Operador tiene acceso de **lectura completa** a historial y dashboard (incluyendo ingresos), en el mismo nivel que el Admin. La diferencia entre roles está exclusivamente en las acciones de **configuración** (parqueadero, puestos, tarifas, usuarios), no en la visibilidad de datos operativos.

## 8. User Journeys

### 8.1 Journey — Operador registra una estadía completa
El operador llega a su turno, ve el grid de puestos y sabe de inmediato cuáles están libres. Un vehículo llega, el operador registra su placa y tipo, el sistema le sugiere o le permite elegir un puesto disponible, y la estadía queda activa. Horas después, el vehículo sale: el operador busca la sesión activa, el sistema calcula el monto a cobrar, el operador registra el pago y el sistema genera el comprobante. El puesto vuelve a estar disponible automáticamente.

### 8.2 Journey — Admin configura el negocio antes de operar
El Admin crea el parqueadero, define filas y columnas del grid, configura las tarifas por tipo de vehículo, y crea las cuentas de los operadores. A partir de ahí, el negocio queda listo para operar.

### 8.3 Journey — Admin revisa el desempeño del día
El Admin abre el dashboard y ve ocupación actual, ingresos del día, estadías activas y tiempo promedio de permanencia, sin necesidad de revisar registros uno por uno.

## 9. Core User Flows

### 9.1 Flujo de entrada (feliz)
Operador/Admin autenticado → selecciona "Registrar entrada" → ingresa placa (obligatoria) y tipo de vehículo → sistema muestra puestos disponibles compatibles con el tipo de vehículo → selecciona puesto → sistema valida que el vehículo no tenga sesión activa y que el puesto esté disponible → crea `ParkingSession` (`active`) → puesto pasa a `occupied`.

### 9.2 Flujo de salida y pago (feliz)
Operador/Admin selecciona una sesión activa → solicita salida → sistema calcula duración y costo con la tarifa congelada de la sesión → se muestra el desglose → se registra el pago → sesión pasa a `completed`, pago a `paid` → puesto vuelve a `available` → se genera el comprobante de demostración.

### 9.3 Flujo de salida sin pago completo
Igual al 9.2 hasta el cálculo del monto, pero el cliente no paga en el momento → sesión pasa a `pending_payment` (el puesto se libera igualmente, ya que el vehículo ya salió físicamente) → el pago se completa después desde el historial → sesión pasa a `completed`.

### 9.4 Flujo de configuración (Admin)
Admin crea el parqueadero → define filas × columnas → sistema genera el grid de puestos → Admin ajusta tipo de vehículo por puesto si aplica → Admin configura tarifas por tipo de vehículo → Admin crea cuentas de operadores.

## 10. Functional Requirements

| # | Requisito |
|---|---|
| FR-01 | El sistema debe permitir autenticación de usuarios con rol Admin u Operador. |
| FR-02 | El Admin debe poder configurar el parqueadero (nombre, dirección, grid de filas × columnas). |
| FR-03 | El sistema debe generar automáticamente los puestos según el grid definido. |
| FR-04 | El Admin debe poder agregar o retirar puestos individuales después de la configuración inicial. |
| FR-05 | El sistema debe mostrar visualmente el estado de cada puesto (`available`, `occupied`, `out_of_service`). |
| FR-06 | El sistema debe permitir registrar la entrada de un vehículo con placa obligatoria y tipo de vehículo. |
| FR-07 | El sistema debe impedir la entrada de un vehículo que ya tenga una sesión activa. |
| FR-08 | El sistema debe impedir asignar un puesto que ya tenga una sesión activa. |
| FR-09 | El sistema debe calcular automáticamente, en el servidor, la duración y el costo de cada estadía. |
| FR-10 | El Admin debe poder configurar tarifas por tipo de vehículo. |
| FR-11 | La tarifa aplicada a una sesión debe congelarse en el momento de creación de la sesión. |
| FR-12 | El sistema debe permitir registrar el pago de una sesión. |
| FR-13 | El sistema debe permitir cerrar una sesión sin pago completo, dejándola en estado `pending_payment`. |
| FR-14 | El sistema debe generar un comprobante interno de demostración por cada sesión completada y pagada. |
| FR-15 | El sistema debe mantener un historial consultable de sesiones y pagos. |
| FR-16 | El sistema debe mostrar un dashboard con las métricas operativas definidas en la sección 18. |
| FR-17 | El sistema debe registrar una auditoría básica de acciones relevantes. |
| FR-18 | El sistema debe restringir en el backend las acciones de configuración (parqueadero, puestos, tarifas, usuarios) exclusivamente al rol Admin. |

## 11. User Stories

### Authentication
- **US-AUTH-001** — Como usuario del sistema, quiero iniciar sesión con mis credenciales, para acceder solo a las funciones que corresponden a mi rol.
- **US-AUTH-002** — Como usuario del sistema, quiero que mi sesión expire tras un periodo de inactividad, para reducir el riesgo de acceso no autorizado desde una sesión abierta.

### Parking Configuration
- **US-CONFIG-001** — Como admin, quiero crear el parqueadero definiendo filas y columnas, para generar automáticamente el grid de puestos.
- **US-CONFIG-002** — Como admin, quiero configurar tarifas por tipo de vehículo, para que el sistema calcule el cobro correcto de cada estadía.
- **US-CONFIG-003** — Como admin, quiero editar una tarifa existente, para ajustar precios sin afectar sesiones ya cerradas o en curso.

### Parking Spots
- **US-SPOT-001** — Como admin, quiero agregar un puesto individual al grid, para ampliar la capacidad del parqueadero.
- **US-SPOT-002** — Como admin, quiero retirar un puesto individual, para reflejar cambios físicos del parqueadero.
- **US-SPOT-003** — Como admin u operador, quiero marcar un puesto como `out_of_service`, para evitar que se asignen puestos dañados o inutilizables.
- **US-SPOT-004** — Como admin u operador, quiero volver a marcar un puesto `out_of_service` como `available`, para reincorporarlo a la operación normal.

### Vehicle Entry
- **US-ENTRY-001** — Como operador, quiero registrar la entrada de un vehículo indicando su placa y tipo, para iniciar correctamente su estadía.
- **US-ENTRY-002** — Como operador, quiero ver únicamente los puestos disponibles compatibles con el tipo de vehículo, para asignar un puesto válido sin errores.
- **US-ENTRY-003** — Como operador, quiero que el sistema rechace el registro si el vehículo ya tiene una sesión activa, para evitar sesiones duplicadas.
- **US-ENTRY-004** — Como operador, quiero que el sistema rechace la asignación de un puesto que ya está ocupado, para evitar doble asignación.

### Active Sessions
- **US-SESSION-001** — Como admin u operador, quiero ver la lista de sesiones activas en tiempo real, para saber qué vehículos siguen dentro del parqueadero.
- **US-SESSION-002** — Como admin u operador, quiero ver cuánto tiempo lleva cada sesión activa, para anticipar el monto aproximado a cobrar.

### Vehicle Exit
- **US-EXIT-001** — Como operador, quiero registrar la salida de un vehículo, para calcular automáticamente el monto a cobrar.
- **US-EXIT-002** — Como operador, quiero ver el desglose del cálculo (duración, horas cobradas, tarifa aplicada, total), para poder explicárselo al cliente.
- **US-EXIT-003** — Como operador, quiero poder cerrar una salida aunque el cliente no pague en el momento, para no bloquear la liberación del puesto.

### Payments
- **US-PAYMENT-001** — Como admin u operador, quiero registrar el pago de una sesión, para cerrarla como completada.
- **US-PAYMENT-002** — Como admin u operador, quiero completar el pago de una sesión que quedó en `pending_payment`, para cerrar estadías pendientes.
- **US-PAYMENT-003** — Como admin u operador, quiero que el monto a pagar se calcule siempre en el servidor, para evitar que se manipule desde el navegador.

### Receipts
- **US-RECEIPT-001** — Como admin u operador, quiero generar el comprobante de demostración de una sesión completada, para entregar constancia al cliente.
- **US-RECEIPT-002** — Como admin u operador, quiero que el comprobante indique claramente que no tiene validez fiscal, para no inducir a error sobre su naturaleza.

### History
- **US-HISTORY-001** — Como admin u operador, quiero consultar el historial completo de sesiones, para revisar estadías pasadas.
- **US-HISTORY-002** — Como admin u operador, quiero consultar el historial de pagos, para verificar cobros realizados.
- **US-HISTORY-003** — Como admin u operador, quiero filtrar el historial por rango de fechas, para encontrar registros específicos.

### Dashboard
- **US-DASHBOARD-001** — Como admin u operador, quiero ver un resumen de ocupación y actividad del día, para entender la operación sin revisar registros uno por uno.

### User Management
- **US-USER-001** — Como admin, quiero crear cuentas de operador, para dar acceso al personal de turno.
- **US-USER-002** — Como admin, quiero desactivar la cuenta de un operador, para revocar su acceso cuando deje de trabajar en el negocio.

### Audit
- **US-AUDIT-001** — Como admin, quiero consultar quién realizó cada acción sensible (configuración, tarifas, anulaciones), para tener trazabilidad del uso del sistema.

## 12. Acceptance Criteria

*(Se listan los criterios de las historias MUST HAVE más críticas; el resto sigue el mismo patrón Given/When/Then y debe completarse antes del cierre del MVP.)*

**US-ENTRY-001 / US-ENTRY-003**
```
Given un vehículo con placa "ABC123" sin sesión activa
When el operador registra su entrada indicando placa y tipo de vehículo
Then debe crearse una ParkingSession en estado "active"

Given un vehículo con placa "ABC123" que ya tiene una sesión activa
When el operador intenta registrar una nueva entrada con la misma placa
Then el sistema debe rechazar la operación
And debe mostrar un mensaje indicando que el vehículo ya está dentro
```

**US-ENTRY-004 / doble asignación**
```
Given un puesto en estado "available"
When el operador asigna ese puesto a un vehículo entrante
Then el puesto debe pasar a "occupied"
And debe crearse una sesión activa asociada a ese vehículo y puesto

Given un puesto que ya tiene una sesión activa
When otro operador intenta asignar el mismo puesto simultáneamente
Then solo una de las dos operaciones debe tener éxito
And la segunda debe fallar con un mensaje de puesto no disponible
```

**US-EXIT-001 / US-EXIT-002 (cálculo de tarifa)**
```
Given una sesión activa con entrada a las 10:00 y tarifa de $X por hora para su tipo de vehículo
When el operador registra la salida a las 10:30
Then el sistema debe calcular 1 hora cobrada (fracción redondeada hacia arriba)
And el monto debe ser 1 × $X

Given la misma sesión
When la salida ocurre a las 11:01
Then el sistema debe calcular 2 horas cobradas
And el monto debe ser 2 × $X
```

**US-PAYMENT-001 / US-EXIT-003 (pago incompleto)**
```
Given una sesión con salida registrada y monto calculado
When el cliente no puede pagar el total en el momento
Then el operador debe poder cerrar la sesión como "pending_payment"
And el puesto debe volver a "available"

Given una sesión en "pending_payment"
When un admin u operador registra el pago completo posteriormente
Then la sesión debe pasar a "completed"
And el pago debe quedar en estado "paid"
```

**US-CONFIG-003 (tarifa congelada)**
```
Given una sesión activa creada con la tarifa vigente de $X
When el admin modifica la tarifa a $Y mientras la sesión sigue activa
Then el cálculo final de esa sesión debe seguir usando $X, no $Y
```

**FR-18 / permisos**
```
Given un usuario autenticado con rol "operator"
When intenta modificar una tarifa o la configuración del parqueadero
Then el backend debe rechazar la operación por falta de autorización
And la restricción no debe depender únicamente de ocultar el botón en el frontend
```

**US-RECEIPT-002**
```
Given una sesión completada y pagada
When se genera el comprobante
Then debe incluir un aviso visible de que no tiene validez fiscal
And debe incluir número de comprobante, placa, tipo de vehículo, horas de entrada/salida, duración, tarifa aplicada, desglose, total y método de pago
```

## 13. Business Rules

- **BR-001** — Un vehículo (identificado por placa) no puede tener más de una `ParkingSession` activa a la vez.
- **BR-002** — Un puesto no puede estar asociado a más de una `ParkingSession` activa a la vez.
- **BR-003** — El costo de una sesión se calcula usando la tarifa congelada (snapshot) en el momento de creación de la sesión, no la tarifa vigente al momento del cálculo.
- **BR-004** — El monto a pagar nunca puede ser proporcionado por el cliente/frontend; siempre se calcula en el servidor a partir de `entry_time`, `exit_time` y la tarifa congelada.
- **BR-005** — Una sesión en estado `completed` no puede editarse directamente; cualquier corrección requiere un mecanismo de anulación auditado (fuera del MVP si no se especifica lo contrario — ver Open Questions).
- **BR-006** — La fórmula de cálculo es `horas_a_cobrar = ceil(duración_en_minutos / 60)`; `costo = horas_a_cobrar × valor_hora_del_tipo_de_vehículo`.
- **BR-007** — La placa es un campo obligatorio para registrar una entrada; no se permite crear una sesión sin placa.
- **BR-008** — Solo el rol Admin puede crear, editar o eliminar tarifas, configurar el parqueadero/puestos, y gestionar usuarios.
- **BR-009** — Tanto Admin como Operador pueden registrar entradas, salidas, pagos, y consultar historial y dashboard completos.
- **BR-010** — Un puesto solo puede pasar a `out_of_service` si no tiene una sesión activa asociada.
- **BR-011** — Una sesión solo puede pasar a `completed` si su pago asociado está en estado `paid`.
- **BR-012** — Toda acción de configuración (tarifas, puestos, usuarios) y toda anulación deben quedar registradas en `AuditLog` con usuario y timestamp.
- **BR-013** — El comprobante de demostración debe indicar explícitamente que no tiene validez fiscal.

## 14. State Transitions

### ParkingSpot
```
available → occupied         (al asignar un vehículo entrante; automático)
occupied → available          (al completar o dejar pending_payment una salida; automático)
available → out_of_service    (admin u operador, solo si no tiene sesión activa)
out_of_service → available    (admin u operador)
```
No están permitidas transiciones directas `occupied → out_of_service`: primero debe cerrarse la sesión asociada.

### ParkingSession
```
active → completed         (pago registrado completo en el momento de salida)
active → pending_payment   (salida registrada sin pago completo)
pending_payment → completed (pago completado posteriormente)
active → cancelled         (admin u operador, solo antes de cualquier pago — ej. entrada registrada por error)
```
`completed` y `cancelled` son estados finales; no tienen transiciones salientes.

### Payment
```
pending → paid
```
No existe transición de reversa dentro del MVP (un pago pagado no puede volver a `pending`).

### Invoice (comprobante demo)
```
(no existe) → generated
```
Estado único; se genera una sola vez por sesión completada.

## 15. Data Requirements

*(Nivel de producto, no de esquema técnico — el modelo de datos definitivo pertenece al Tech Design.)*

- **User:** identificador, credenciales, rol (`admin` | `operator`), estado activo/inactivo.
- **ParkingLot:** nombre, dirección, dimensiones del grid (filas, columnas).
- **ParkingSpot:** número, tipo de vehículo aceptado (opcional), estado.
- **Vehicle:** placa (obligatoria), tipo de vehículo — dato liviano, sin información de propietario.
- **ParkingSession:** vehículo, puesto, hora de entrada, hora de salida, estado, tarifa aplicada (snapshot), monto calculado.
- **Rate:** tipo de vehículo, valor por hora, vigencia.
- **Payment:** sesión asociada, monto, método, estado, timestamp.
- **Invoice:** sesión asociada, número de comprobante, contenido mostrado (ver sección 19).
- **AuditLog:** usuario, acción, entidad afectada, timestamp.

## 16. Error States

| Situación | Comportamiento esperado |
|---|---|
| Placa vacía al registrar entrada | Bloquear el registro, mostrar mensaje de campo obligatorio. |
| Vehículo ya tiene sesión activa | Bloquear el registro, mostrar mensaje explicando que el vehículo ya está dentro. |
| Puesto ya ocupado al momento de asignar | Bloquear la asignación, mostrar mensaje de puesto no disponible, refrescar el grid. |
| No hay puestos disponibles del tipo requerido | Informar claramente que no hay capacidad disponible para ese tipo de vehículo. |
| Tarifa no configurada para el tipo de vehículo | Bloquear el registro de entrada hasta que exista una tarifa vigente para ese tipo. |
| Operador intenta modificar tarifa o configuración | Rechazar en backend con mensaje de permisos insuficientes. |
| Intento de pago con monto distinto al calculado por el servidor | Rechazar la operación; el monto siempre se toma del cálculo del servidor. |

## 17. Edge Cases

| Caso | Comportamiento esperado |
|---|---|
| 0 minutos de estadía | Se cobra 1 hora (fracción mínima, `ceil(0/60) = 0`, pero el mínimo cobrable es 1 hora por regla de negocio — ver nota abajo). |
| 1 minuto de estadía | 1 hora cobrada. |
| Exactamente 60 minutos | 1 hora cobrada. |
| 61 minutos | 2 horas cobradas. |
| Salida al día siguiente (estadía larga) | El cálculo aplica igual sobre la duración total en minutos; no hay tope diario en el MVP (ver Non-Goals / Future Scope). |
| Vehículo ya registrado (placa duplicada activa) | Ver BR-001 / US-ENTRY-003. |
| Puesto ocupado al momento de asignar | Ver BR-002 / US-ENTRY-004. |
| Ningún puesto disponible | Ver tabla de Error States. |
| Tarifa inexistente para el tipo de vehículo | Ver tabla de Error States. |
| Tarifa modificada durante una sesión activa | La sesión conserva la tarifa congelada al crearse (BR-003). |
| Operador intenta modificar tarifa | Rechazado en backend (BR-008). |
| Operador intenta configurar el parqueadero | Rechazado en backend (BR-008). |
| Pago incompleto | Sesión pasa a `pending_payment` (US-EXIT-003). |
| Doble asignación simultánea del mismo puesto | Solo una operación tiene éxito (Acceptance Criteria de US-ENTRY-004). |
| Puesto fuera de servicio | No aparece como disponible para asignación (BR-010). |
| Vehículo con placa inválida o no legible | Se exige ingreso manual de una placa válida; no se permite continuar sin ella (decisión confirmada, BR-007). |

> **Nota sobre 0 minutos:** matemáticamente `ceil(0/60) = 0`, pero cobrar $0 por una estadía real no es una regla de negocio razonable. Se establece como regla explícita que **toda estadía cobra un mínimo de 1 hora**, independientemente de la duración exacta. Esto se documenta como **BR-014** (añadida a la sección 13 en la versión consolidada del documento).

## 18. Dashboard Requirements

El dashboard debe mostrar, sin necesidad de navegación adicional:

1. Puestos disponibles (número).
2. Puestos ocupados (número).
3. Porcentaje de ocupación actual.
4. Vehículos dentro del parqueadero en este momento.
5. Ingresos del día (suma de pagos `paid` registrados en la fecha actual).
6. Estadías activas (lista corta con placa, puesto y tiempo transcurrido).
7. Tiempo promedio de permanencia (calculado sobre sesiones completadas).

No se incluyen gráficas históricas, comparativos ni proyecciones — están fuera de alcance (ver sección 21).

## 19. Receipt Requirements

El comprobante de demostración debe incluir, como mínimo:

- Número de comprobante (secuencial interno, no fiscal).
- Nombre y dirección del parqueadero.
- Placa y tipo de vehículo.
- Hora de entrada y hora de salida.
- Duración total de la estadía.
- Tarifa aplicada y desglose del cálculo (ej. "2 horas × $X = $Y").
- Total a pagar.
- Método de pago.
- Aviso visible: **"Documento de demostración — sin validez fiscal"**.

Explícitamente fuera de alcance: integración con la DIAN, CUFE real, firma digital, XML fiscal, validación electrónica o cualquier elemento de facturación electrónica legal.

## 20. Security Requirements

| Requisito de producto | Verificable como |
|---|---|
| Autenticación obligatoria para cualquier acción del sistema | No debe existir ninguna operación accesible sin sesión válida. |
| Autorización por rol aplicada en el servidor | Un usuario `operator` no puede ejecutar acciones de Admin aunque manipule la solicitud directamente (no solo ocultando botones). |
| Cálculo de precios exclusivamente en servidor | Ningún endpoint debe aceptar un monto o duración calculados por el cliente como fuente de verdad. |
| Protección contra doble asignación | Bajo intentos simultáneos, solo una asignación de puesto o de vehículo debe prosperar. |
| Integridad de sesiones completadas | No debe existir una vía de la aplicación para editar directamente una sesión `completed`. |
| Auditoría de acciones sensibles | Toda configuración, tarifa y anulación debe quedar registrada con usuario y timestamp. |
| Mínima recolección de datos | El sistema no almacena datos personales del conductor/propietario más allá de placa y tipo de vehículo. |

## 21. MVP Scope

**MUST HAVE:** autenticación; roles Admin/Operador con autorización en backend; configuración del parqueadero; grid de puestos; CRUD de puestos; estados de puesto; registro de entrada; asignación de puesto; registro de salida; cálculo automático de duración y costo; tarifas por tipo de vehículo; registro de pago; comprobante demo; historial de sesiones y pagos; dashboard; auditoría básica; protección contra doble asignación.

**SHOULD HAVE:** tope de tarifa diaria; motivo de texto libre para `out_of_service`.

**COULD HAVE:** reservas; layout X/Y; drag-and-drop; zonas; tarifas especiales por horario/día.

**OUT OF SCOPE:** facturación electrónica legal; CRM de vehículos; datos del propietario; multi-parqueadero/multi-tenant; notificaciones; SMS; pasarelas de pago reales; reconocimiento automático de placas.

## 22. Future Scope

Reservas de puestos, editor visual de layout (posición libre X/Y), zonas y tipos de puesto avanzados, tarifas por horario/día especial, tope de tarifa diaria, mecanismo formal de anulación de sesiones completadas, multi-parqueadero.

## 23. Success Criteria

- Un operador puede registrar una entrada completa (placa, tipo, puesto) sin ambigüedad.
- El sistema evita doble asignación de puesto y doble sesión activa del mismo vehículo, incluso bajo intentos simultáneos.
- El costo se calcula correctamente para los casos de la sección 17 (0, 1, 60, 61 minutos, estadías largas).
- Un administrador puede modificar tarifas sin afectar sesiones ya en curso o cerradas.
- Se puede completar una salida y registrar el pago, incluyendo el caso de pago incompleto.
- Se genera el comprobante demo con el aviso de no validez fiscal.
- El historial conserva sesiones completadas y es consultable por Admin y Operador.
- Las acciones de configuración y anulación quedan auditadas con usuario y timestamp.

## 24. MVP Release Criteria

- [ ] **Funcionalidad:** todo lo listado en MUST HAVE está implementado.
- [ ] **Seguridad:** autenticación y autorización por rol funcionan y están validadas en backend, no solo en UI.
- [ ] **Integridad:** no es posible crear dos sesiones activas para el mismo vehículo o el mismo puesto, incluso en pruebas de concurrencia.
- [ ] **Tarifación:** todos los casos de la sección 17 (edge cases de cálculo) pasan correctamente.
- [ ] **Pagos:** todo pago queda correctamente asociado a una única sesión, y toda sesión `completed` tiene un pago `paid`.
- [ ] **Historial:** los registros completados son consultables por Admin y Operador.
- [ ] **Auditoría:** las acciones de configuración, tarifas y anulaciones quedan registradas.
- [ ] **UX:** los flujos de entrada, salida y pago pueden completarse sin pasos ambiguos ni pantallas huérfanas.
- [ ] **Testing:** los casos críticos (BR-001 a BR-014, edge cases de tarifación) tienen pruebas automatizadas o verificación manual documentada.
- [ ] **Documentación:** el comportamiento implementado coincide con este PRD; cualquier desviación queda documentada.

## 25. Assumptions

- El parqueadero opera con un único lote (no multi-sede) durante todo el MVP.
- El grid se define una sola vez al crear el parqueadero y se ajusta después agregando/quitando puestos individuales, no redimensionando el grid completo.
- La fracción de redondeo de tarifa es de 60 minutos (no 15 ni 30).
- No existe tope de tarifa diaria en el MVP.
- El pago se registra siempre de forma manual/presencial (efectivo u otro medio no integrado); no hay pasarela de pago real.
- Toda estadía cobra un mínimo de 1 hora, incluso si la duración real es menor (BR-014).

## 26. Open Questions

- **¿Quién puede cancelar (`cancelled`) una sesión activa por error de registro — cualquier Admin/Operador, o solo Admin?** No bloqueante para iniciar el Tech Design, pero debe resolverse antes de definir permisos exactos de esa acción. *Recomendación: permitir a ambos roles cancelar una sesión `active` sin pago asociado, ya que corregir una entrada mal registrada es una operación de uso diario; reservar a Admin únicamente la anulación de una sesión `pending_payment` o `completed`, por su implicación financiera.*
- **¿Se requiere un mecanismo formal de "anulación" para sesiones `completed` con error (ej. pago duplicado, placa mal digitada), o queda completamente fuera del MVP?** BR-005 lo deja implícitamente fuera; si se necesita para el portafolio, debe agregarse como una capacidad explícita de Admin con auditoría, no como edición directa.
- **¿El grid soporta puestos que aceptan cualquier tipo de vehículo (`vehicle_type = null`) además de puestos restringidos a un tipo específico?** El Research lo deja abierto como "nullable = acepta cualquiera"; se asume que sí, pero conviene confirmarlo antes del Tech Design porque afecta la lógica de "puestos disponibles compatibles" (US-ENTRY-002).

---

## PRD Validation Report

**Requisitos cubiertos:** los 18 Functional Requirements, 27 User Stories agrupadas en 12 módulos, Acceptance Criteria Given/When/Then para los flujos MUST HAVE más críticos (entrada, doble asignación, cálculo de tarifa, pago incompleto, tarifa congelada, permisos, comprobante), 14 Business Rules, transiciones de estado completas para las 4 entidades con estado, requisitos de dashboard y comprobante, requisitos de seguridad verificables, y checklist de release.

**Decisiones heredadas del Research (no modificadas):**
- Tarifación por fracción de hora con redondeo hacia arriba, sin tope diario.
- Layout como grid uniforme, sin zonas ni posición libre.
- Entidades y estados definidos en el Research.
- Comprobante demo vs. facturación legal, con la misma separación explícita.

**Decisiones nuevas tomadas en el PRD:**
- El Operador tiene acceso de lectura completa a historial y dashboard, igual que el Admin (confirmado por el usuario).
- La placa es obligatoria en todos los casos; no se permite un identificador temporal (confirmado por el usuario).
- Toda estadía cobra un mínimo de 1 hora, incluso con 0 minutos de duración real (BR-014, para evitar cobros de $0 no razonables — el Research no lo especificaba explícitamente).
- Reglas de transición de estado explícitas para `ParkingSpot`, `ParkingSession`, `Payment` e `Invoice`, con restricción de que `occupied → out_of_service` no es una transición directa válida.
- Regla de cancelación (`active → cancelled`) añadida como capacidad necesaria para corregir errores de registro, con una recomendación de permisos (ver Open Questions).

**Ambigüedades resueltas:**
- Alcance de consulta del Operador (resuelta: historial completo).
- Política de placa no legible (resuelta: obligatoria siempre).
- Mínimo cobrable en estadías muy cortas (resuelta con BR-014, ya que el Research no lo cubría).

**Preguntas pendientes:** ver sección 26 (permisos de cancelación, mecanismo de anulación de sesiones completadas, puestos "cualquier tipo" vs. restringidos). Ninguna es bloqueante para iniciar el Tech Design.

**Funcionalidades excluidas explícitamente:** facturación electrónica legal, CRM de vehículos, datos de propietario, multi-parqueadero/multi-tenant, notificaciones, SMS, pasarelas de pago reales, reconocimiento automático de placas, reservas, layout X/Y con drag-and-drop, zonas, tarifas especiales por horario.

**Riesgos de scope creep:**
- La tentación más probable es convertir el "comprobante demo" en algo cercano a facturación real (agregar campos fiscales "por si acaso"). Debe resistirse activamente durante el Tech Design y el Build.
- La auditoría básica (BR-012) podría expandirse hacia un módulo de auditoría completo con UI dedicada — para el MVP basta con que el registro exista y sea consultable, no que tenga una interfaz sofisticada.
- El dashboard es un punto natural de "una métrica más no hace daño" — debe mantenerse limitado a las 7 métricas de la sección 18.

---

## Siguiente paso

Con el PRD aprobado, el proyecto está listo para pasar a **TechDesign-Parking-Management-MVP.md**, usando `part3-tech-design-mvp.md` del repositorio de referencia como base del prompt, adjuntando este PRD como contexto.
