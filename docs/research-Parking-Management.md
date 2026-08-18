# Research — Parking Management System

**Metodología:** basada en el flujo Research → PRD → Tech Design → AGENTS.md/agent_docs → Build del repositorio [KhazP/vibe-coding-prompt-template](https://github.com/KhazP/vibe-coding-prompt-template).

**Estado del proyecto:** fase de investigación de dominio completada. No se ha iniciado PRD, arquitectura ni código.

**Tipo de proyecto:** portafolio educativo / AI-assisted coding. Prioridad: **producto correcto > arquitectura sofisticada > cantidad de funcionalidades.**

---

## 1. Idea inicial

Aplicación web para administrar un parqueadero, con un administrador/operador como usuario principal. Permite configurar puestos, visualizar disponibilidad, registrar entradas y salidas de vehículos, calcular automáticamente tiempo y costo de cada estadía, consultar historial y generar un comprobante de demostración (no factura electrónica legal).

---

## 2. Flujo operativo

**Flujo normal:**

```
Entrada del vehículo
  → Identificación (placa, tipo de vehículo)
  → Verificación de disponibilidad de puestos
  → Asignación de puesto
  → Apertura de ParkingSession (estado: active)
  → Estadía
  → Solicitud de salida
  → Cálculo de duración
  → Cálculo de tarifa (server-side, usando snapshot de la tarifa vigente)
  → Registro de pago
  → Cierre de sesión (estado: completed)
  → Generación de comprobante de demostración
```

**Casos excepcionales a contemplar en el diseño:**

- Vehículo sin placa legible o no registrada → registro manual por el operador.
- Puesto marcado como disponible en el sistema pero ocupado físicamente (drift) → el operador debe poder forzar un cambio de estado, quedando registrado en auditoría.
- Salida sin pago completo → estado de sesión `pending_payment` en lugar de forzar el flujo feliz.
- Estadías que cruzan tarifas diarias / pasan la noche.
- Cancelación de una asignación antes de que el vehículo llegue al puesto (relevante solo si se implementan reservas).
- Doble entrada del mismo vehículo (placa con sesión activa) → debe bloquearse a nivel de negocio y de base de datos.

---

## 3. Entidades principales

| Entidad | ¿Necesaria? | Notas |
|---|---|---|
| `User` | Sí | Admin u Operador, credenciales, rol |
| `ParkingLot` | Sí | Configuración general: nombre, dirección, capacidad, tarifas activas |
| `ParkingSpot` | Sí | `spot_number`, `vehicle_type` (nullable = acepta cualquiera), `status` |
| `Vehicle` | Sí, liviana | Solo placa y tipo — sin CRM de vehículos ni datos de dueño |
| `ParkingSession` | Sí — entidad central | `vehicle_id`, `spot_id`, `entry_time`, `exit_time`, `status`, `rate_snapshot` |
| `Rate` | Sí | Por tipo de vehículo, valor por hora |
| `Payment` | Sí | Monto, método, timestamp, `session_id` |
| `Invoice` (demo) | Sí | Documento post-pago, sin validez fiscal |
| `AuditLog` | Sí (versión ligera) | `user_id`, `action`, `timestamp` — necesario porque el MVP tiene dos roles operando el mismo sistema |

**Regla de integridad crítica:** una `ParkingSession` activa por vehículo y por puesto (unicidad a nivel de base de datos, no solo lógica de aplicación), para evitar doble asignación por condiciones de carrera cuando dos operadores actúan simultáneamente.

**Tarifa como snapshot:** la tarifa aplicada se congela en el momento de crear la sesión, para que cambios posteriores en `Rate` no alteren el cobro de sesiones ya en curso o cerradas.

---

## 4. Estados

- **Puesto (`ParkingSpot.status`):** `available`, `occupied`, `out_of_service`.
- **Sesión (`ParkingSession.status`):** `active`, `pending_payment`, `completed`, `cancelled`.
- **Pago (`Payment.status`):** `pending`, `paid` (y opcionalmente `failed` si se requiere).
- **Factura demo:** un único estado, `generated` — no aplican estados de facturación fiscal (emitida/anulada/rechazada por DIAN).
- **Vehículo:** sin estado propio; se deriva de si tiene una `ParkingSession` activa.

---

## 5. Tarifación — DECISIÓN TOMADA

**Modelo elegido:** fracción de hora con redondeo hacia arriba.

```
horas_a_cobrar = ceil(duración_en_minutos / 60)
costo = horas_a_cobrar × valor_hora_según_tipo_vehículo
```

- Sin tope diario en el MVP (queda como mejora futura).
- Tarifas diferenciadas por tipo de vehículo.
- Alternativas consideradas y descartadas para el MVP: cobro proporcional por minuto (más "justo" pero más difícil de explicar en el comprobante y poco usado en la práctica); tarifa plana por bloques de tiempo; tarifas especiales por horario/día.

---

## 6. Diseño del parqueadero (layout) — DECISIÓN TOMADA

**Modelo elegido:** grid uniforme (filas × columnas), sin zonas.

- El admin define filas y columnas al configurar el parqueadero.
- Cada celda es un puesto numerado, con color según estado.
- El tamaño del grid se fija al crear el parqueadero y se ajusta después agregando/quitando puestos individuales (no mediante un "redimensionar grid" completo).
- Alternativas descartadas para el MVP: lista/tabla sin mapa visual (menor valor de portafolio); layout con posición X/Y libre tipo editor drag-and-drop (alto valor visual pero complejidad significativamente mayor); zonas con tipos de puesto (pospuesto, no crítico para el MVP).

---

## 7. Roles y permisos — DECISIÓN TOMADA

**Modelo elegido:** dos roles — **Admin** y **Operador**.

| Acción | Admin | Operador |
|---|---|---|
| Configurar parqueadero y puestos | ✅ | ❌ |
| Configurar tarifas | ✅ | ❌ |
| Gestionar usuarios | ✅ | ❌ |
| Registrar entradas/salidas | ✅ | ✅ |
| Cobrar / registrar pagos | ✅ | ✅ |
| Ver dashboard e historial | ✅ | ✅ (alcance a definir en PRD) |

Consecuencia directa de esta decisión: se requiere middleware de autorización en el backend que bloquee al rol `operator` en los endpoints de configuración y tarifas, y sube de prioridad la auditoría básica (saber quién ejecutó cada acción).

---

## 8. Seguridad — riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Acceso no autorizado | Autenticación obligatoria, sesiones/tokens con expiración |
| Escalamiento de privilegios | Rol verificado en el backend en cada endpoint sensible, nunca solo en frontend |
| Manipulación de tarifas | Solo `Admin` escribe en `Rate`; la tarifa aplicada se congela como snapshot en la sesión |
| Manipulación de pagos / precio desde el frontend | El monto se calcula siempre en el servidor a partir de `entry_time`, `exit_time` y `rate` — nunca se acepta un monto enviado por el cliente |
| Doble asignación de puesto / race conditions | Constraint de unicidad en base de datos (un `spot_id` solo puede tener una sesión `active`) + transacción atómica al crear la sesión |
| Acceso a datos de otros usuarios | Si en el futuro es multi-tenant, todo query debe filtrar por `parking_lot_id` del usuario autenticado |
| Manipulación de registros históricos | Sesiones y pagos cerrados no son editables directamente — solo "anulables" con registro de auditoría, nunca borrado físico |
| Exposición de información sensible | No almacenar más datos del vehículo/cliente de los estrictamente necesarios (placa, tipo) |

---

## 9. Facturación — demo vs. legal

**Comprobante interno de demostración (sí entra al MVP):**
- Número de comprobante interno (secuencial propio, no fiscal).
- Datos del parqueadero (nombre, dirección).
- Placa y tipo de vehículo.
- Hora de entrada, hora de salida, duración total.
- Tarifa aplicada y desglose del cálculo.
- Valor total, método de pago.
- Aviso visible: *"Documento de demostración — sin validez fiscal"*.

**Facturación electrónica legal (fuera de alcance — contexto informativo):**
En Colombia, una factura electrónica real debe validarse en tiempo real ante la DIAN, incluir un CUFE (Código Único de Facturación Electrónica, de 64 caracteres, que actúa como huella digital del documento), firma digital, NIT del emisor y receptor, y generarse en formato XML con representación gráfica en PDF, bajo la Resolución 000165 de 2023 y sus actualizaciones (Resolución 000202 de 2025). Nada de este flujo se implementa en este proyecto; se documenta únicamente para que el comprobante demo se vea realista sin pretender tener validez legal.

---

## 10. Dashboard — métricas

**Incluidas en el MVP:**
- Puestos disponibles / ocupados (y % de ocupación actual).
- Vehículos dentro en el momento.
- Ingresos del día.
- Estadías activas (lista corta).
- Tiempo promedio de permanencia.

**Descartadas para el MVP:** gráficas de tendencia histórica, comparativos entre zonas, proyecciones de ingresos — bajo valor para un parqueadero pequeño con un solo lote, y fuera del foco del portafolio.

---

## 11. Clasificación de alcance (MVP scoping)

### MUST HAVE
- Autenticación con roles Admin / Operador y autorización en backend.
- CRUD de puestos + configuración del parqueadero (grid filas × columnas).
- Visualización tipo grid con estado por color.
- Registro de entrada, asignación de puesto, registro de salida.
- Cálculo automático de duración y costo (server-side, fracción de hora redondeada hacia arriba).
- Configuración de tarifas por tipo de vehículo.
- Registro de pago.
- Comprobante de demostración.
- Historial de estadías y pagos.
- Dashboard con las 5 métricas del punto 10.
- Auditoría básica (usuario, acción, timestamp).
- Constraint de unicidad para evitar doble asignación de puesto.

### SHOULD HAVE
- Tope de tarifa diaria.
- Estado `out_of_service` con motivo de texto libre.

### COULD HAVE
- Reservas (estado `reserved` en puesto y sesión).
- Layout con posición libre X/Y (editor visual tipo drag-and-drop).
- Zonas y tipos de puesto en el layout.
- Tarifas especiales por horario/día.

### OUT OF SCOPE
- Facturación electrónica legal ante la DIAN.
- Catálogo/CRM de vehículos recurrentes con datos de dueño.
- Multi-parqueadero / multi-tenant.
- Notificaciones push/SMS, pasarelas de pago reales, reconocimiento de placas por cámara.

---

## 12. Decisiones tomadas en esta fase

1. **Tarifación:** fracción de hora con redondeo hacia arriba, sin tope diario en el MVP.
2. **Layout:** grid uniforme (filas × columnas), sin zonas.
3. **Roles:** dos roles — Admin y Operador, con permisos diferenciados.

## 13. Supuestos de diseño (no bloqueantes, ajustables antes del PRD)

- El grid se define una vez al crear el parqueadero y se ajusta después agregando/quitando puestos individuales.
- `out_of_service` no requiere un motivo estructurado, solo texto libre opcional.
- Fracción de redondeo = 60 minutos (no 15 ni 30), salvo indicación contraria.

---

## 14. Próximo paso

Con esta investigación cerrada, el proyecto está listo para pasar a **PRD-Parking-Management-MVP.md**, usando `part2-prd-mvp.md` del repositorio de referencia como base del prompt.
