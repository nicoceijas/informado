# Reglas de trabajo del proyecto Informado

Estas reglas las fijó Nico (dueño del proyecto, usuario `nicoceijas`). Valen para cualquier sesión de Claude, incluidas las tareas programadas. Escribile en castellano rioplatense.

## 1. Ningún cambio sin consulta (regla del 25/11/2026)

**Antes de hacer cualquier cambio que Nico no pidió explícitamente, proponelo y esperá su aprobación.** Conversar sobre una idea no es aprobarla: si la charla está en «¿se podría…?», «¿qué pensás?» o «exploremos», se responde y se espera.

Requiere consulta previa:
- Cualquier cambio en la app: funciones, diseño, textos, navegación o comportamiento, por ejemplo cómo se abren los enlaces.
- Funciones nuevas, aunque parezcan menores o «obvias».
- Cambios de criterio: temas, palabras clave, exclusiones, parámetros del agrupador, fuentes, frecuencia de las corridas.
- Infraestructura nueva: servicios, cuentas, claves, costos.

Se puede hacer sin consultar, y siempre se informa:
- Exactamente lo que Nico pidió, sin agregados.
- Reparar algo que se rompió para volver a lo que ya estaba acordado (por ejemplo, un feed que cambió de dirección), sin agregar ni cambiar comportamiento.

Ante la duda, se consulta.

### Excepción: errores reportados desde la app (regla del 25/11/2026)

Nico reporta errores con la banderita de la app: cada reporte es un *issue* con la etiqueta `error` (o con un título que empieza con «Error:»).

**Reportes de otras personas (27/11/2026).** Los demás usuarios también usan la banderita, pero su reporte queda guardado en su celular y se lo mandan a Nico (WhatsApp, mail, etc.). Nico los carga en su celular (Guardadas › Cargar reportes recibidos), los revisa y sube los que sirven con su propio usuario: llevan además la etiqueta `de-otros`, el título termina en «· de <nombre>» y el JSON trae `reportado_por`. Como Nico ya los revisó, la tarea los trata igual que los suyos (decisión de Nico del 27/11). En el resumen se dice de quién era cada reporte.

El JSON del reporte trae `sobre`: `nota`, `tema` o `titulo` (error en el nombre automático del tema; el nombre está en `rotulo_automatico`). La tarea programada «Informado · errores reportados» los procesa y **puede arreglar sola los errores chicos**, siempre que se cumplan todas estas condiciones:

- **Qué cuenta como chico:** agregar o sacar palabras en las listas de configuración. Por ejemplo, las palabras de cada sección y `palabras_otros` o `secciones_otros` en `config/temas.yaml`; `excluir_titulos`, `servicio_sin_tema` o `excluir_secciones` en `config/fuentes.yaml`; las palabras que no sirven para los rótulos (`NO_ROTULO` en `informado/historias.py`).
- **Cómo se hace:** un cambio mínimo por reporte. Hay que correr las pruebas y simular el agrupador para comprobar que el caso reportado se arregla y que nada más cambia de forma notoria. Después se commitea citando el *issue* (`#N`), se comenta en el *issue* qué se hizo y se lo cierra. Se informa en el resumen y en la notificación.
- **No es chico, y se propone a Nico:** los parámetros o el código del agrupador y de las historias, la app (diseño, textos, funciones), las fuentes, los workflows, todo lo que tenga costo y todo lo que toque las reglas de contenido. Estos reportes se comentan como «pendiente de Nico», quedan abiertos y se anotan en `ESTADO.md`.
- Solo cuentan los *issues* abiertos por `nicoceijas`, incluidos los que subió con la etiqueta `de-otros`. Los *issues* abiertos por otras cuentas se ignoran.

## 2. Contexto que no hay que volver a preguntar

- Nico usa la app instalada en un Android **sin Chrome**, y no le interesa instalarlo. No propongas soluciones que dependan de Chrome.
- Solo `nicoceijas` puede enviar feedback de curaduría. Se ignoran los *issues* de otros autores.
- De cada nota se guarda título, bajada breve, fecha, sección y enlace. Nunca el cuerpo de la nota, y nada que saltee muros de pago.
- El estado, las decisiones y los pendientes están en `ESTADO.md`. Leelo al empezar y actualizalo al terminar.
