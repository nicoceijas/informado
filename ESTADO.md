# Estado del proyecto Informado

Última actualización: 25/11/2026

## Reglas de trabajo

**Ningún cambio sin consulta (25/11):** cualquier cambio que Nico no pidió explícitamente se propone y se espera su aprobación antes de hacerlo. Esto incluye la app, las funciones nuevas, los criterios y la infraestructura. Conversar una idea no es aprobarla. Detalle completo en [CLAUDE.md](CLAUDE.md).

## Dónde estamos

- **Fase actual:** 3 · Prueba de uso (2 semanas, del 24/11 al 8/12)
- **Fase 2 terminada (24/11):** agrupador (177 temas con 2+ diarios por semana, 4 s por corrida), señal de jerarquía por posición en la home, app instalable. Todo corre cada 2 h.
- **Fase 1 terminada (24/11):** el recolector corre cada 2 horas en GitHub Actions. Primera corrida: ~2.500 notas de 9 diarios en menos de un minuto, sin errores.
- **Fase 0 terminada (24/11):** 9 de 10 diarios con fuentes verificadas. Resumen en `docs/fase0-fuentes.md`.
- **Próximo hito:** primera versión instalable en el celular (Hoy, Semana, Tema comparado, Armá tu semana, Guardadas)

## Decisiones tomadas

| Fecha | Decisión |
|---|---|
| 24/11 | Criterio de tema: propuesta C (híbrido convergencia 60% + jerarquía 40%, con curaduría del usuario los domingos). |
| 24/11 | Algoritmo programado y reproducible, sin consultar una IA en cada uso. Base: TF-IDF + agrupamiento; modelo de significado liviano a evaluar. |
| 24/11 | Infraestructura de la etapa de prueba: GitHub Actions (proceso cada 2 h) + GitHub Pages (app). Repositorio público. |
| 24/11 | Fuentes: solo diarios nacionales. Se guarda título, bajada breve y enlace; nunca la nota completa. |
| 24/11 | Agenda de la semana próxima e imágenes de tapa quedan para la versión 1.1. |
| 24/11 | Sindicales y Ciudad se asignan por palabras clave con prioridad sobre la sección, porque casi ningún diario tiene esas secciones. |
| 24/11 | Se excluyen las ediciones de otros países (Infobae, La Nación, Clarín, El Cronista) por la URL. |
| 24/11 | Crónica queda afuera de la versión 1: no tiene RSS ni sitemap públicos. |
| 24/11 | Jerarquía (40% del puntaje): posición de la nota en la home de cada diario (top 3, top 10, top 25) y marca de edición impresa de Página/12. |
| 24/11 | Un tema necesita notas de al menos 2 diarios. Propuesta semanal: hasta 2 por sección, completando 12 con los de mayor puntaje. |
| 24/11 | «Semana» usa los últimos 7 días móviles hasta que haya una semana calendario completa (1/12). |
| 25/11 | Regla: ningún cambio sin consulta previa (ver CLAUDE.md). Se revirtió la apertura de notas en Chrome, que se había hecho sin pedirla; Nico no usa Chrome. |
| 25/11 | Por ahora solo nicoceijas puede enviar feedback: la calibración semanal ignora los issues de otros autores. |
| 25/11 | El modo lectura muestra título y bajada; el texto completo se lee en el sitio del diario (no se copia ni se guarda el cuerpo de las notas). |
| 25/11 | Aprobado por Nico: deduplicar notas para temas y búsqueda (URL sin «www» ni barra final, id propio de Perfil, entre días distintos; queda la versión vista por última vez; los archivos de datos no se tocan). |
| 25/11 | Aprobado por Nico: las notas de servicio («dólar hoy», «dólar blue hoy», «cómo estará el clima/el tiempo») no forman temas; siguen en la búsqueda y en «Afecta tu día». Lista en `servicio_sin_tema` de `config/fuentes.yaml`. |
| 25/11 | Aprobado por Nico: «miss universo», «reality» y «farándula» mandan la nota a «otros» aunque la sección tenga tema (`palabras_otros` en `config/temas.yaml`). |
| 25/11 | Aprobado por Nico (opción A, aplicada): horario de respaldo en el minuto 47 de cada hora par; corre solo si la última recolección tiene más de 90 min. Así el ritmo sigue siendo de 2 h aunque GitHub saltee una corrida programada. |
| 25/11 | Aprobado por Nico: la publicación en Pages se reintenta hasta 3 veces (esperas de 15 s y 45 s) cuando GitHub todavía no lista el paquete recién subido. |
| 25/11 | Aprobado por Nico: títulos de tema (a) el título de cada nota se actualiza si el diario lo cambia; (b) el tema toma su nombre de la última nota de cada diario, eligiendo la que más se parece a las demás. |
| 25/11 | Aprobado por Nico: pantalla «Temas» como pestaña nueva (sin sacar Hoy ni Semana), con el bloque «Tu día» (clima, dólar, paros y transporte) y la regla de notas de servicio ampliada. |
| 25/11 | Aprobado por Nico (opción A): las corridas cada 2 h las marca una cadena en GitHub (`reloj.yml`): lanza la recolección, espera 120 min en el entorno «reloj» (wait timer, sin ocupar máquinas) y se relanza. Los horarios de `recolectar.yml` quedan de respaldo (solo corren si la última recolección tiene más de 90 min). Nada depende de intervenciones a mano. |
| 25/11 | Indicador de puesto: se mantiene el número y se explica («¿Qué significa el número?», «8 de 9 diarios · En la tapa de 3», «Por qué está Nº 1»). Maqueta v6 en revisión de Nico antes de programarla. |
| 25/11 | Aprobado por Nico: botón «Reportar un error» (banderita en cada nota y al pie de cada tema), que abre un *issue* con la etiqueta `error`. La tarea programada «Informado · errores reportados» arregla sola los errores chicos (listas de configuración) y le propone a Nico lo estructural. Excepción agregada a la regla 1 de CLAUDE.md. |
| 25/11 | Aprobado por Nico: indicadores arriba de Hoy (dólar BNA compra y venta, riesgo país, inflación mensual), cada uno con fuente y fecha (`informado/indicadores.py` → `datos/indicadores.json`). |
| 25/11 | Aprobado por Nico: poda de notas encadenadas en el agrupador (en grupos de 3 a 6, sale la nota que no comparte nada con algún integrante y cuyo único lazo es débil). |
| 25/11 | Rótulos con «e» delante de palabras con sonido i («e informe», «e INDEC»), pedido de Nico. |
| 24/11 | Calibración 1: Sindicales gana sobre cualquier sección; Ciudad solo sobre secciones genéricas; se descartan notas automáticas (clima, quiniela, horóscopo). Cada corrida reaplica las reglas a toda la semana. |

## Pendientes del usuario

- [x] Activar GitHub Pages (24/11). App publicada en https://nicoceijas.github.io/informado/
- [ ] Instalar la app en el celular y usarla 2 semanas. Domingo: «Armá tu semana» y «Enviar feedback».

## Pendientes técnicos

- [x] Relevar feeds RSS y sitemaps de cada diario.
- [x] Tabla de secciones de cada diario → Política, Economía, Internacionales, Sindicales, Ciudad, Fútbol.
- [ ] Crónica: leer la home directamente (versión 1.1).
- [x] Recolector (cada 2 h, minuto 17 UTC) y clasificador de temas, con 16 pruebas.
- [x] Agrupador y puntaje (umbral 0,30, ventana 72 h, grupos de más de 35 notas se parten).
- [x] App web instalable: Hoy, Semana, Tema comparado, Armá tu semana, Guardadas, búsqueda de temas propios, feedback como issue.
- [ ] Fusionar temas desde la app (versión 1.1).
- [x] «Tu día» (25/11): reemplaza «Afecta tu día» en Hoy y está arriba de Temas › Hoy. Clima (con «Alerta en el AMBA» solo si el título lo dice), dólar y paros/transporte por asunto, con estado (Hoy, Mañana, Anunciado, Sin paro).
- [x] Títulos (25/11): el recolector sigue el título que el diario le cambia a una nota; el tema toma su nombre de la última nota de cada diario.
- [x] Publicación con reintentos (25/11).
- [x] **Historias de la semana (25/11, maqueta final aprobada por Nico, sin modo lectura).** La barra queda en Hoy, Temas y Guardadas.
  - **Hoy:** «Tu día» y «En la agenda de hoy» (12 temas), con número de puesto, cápsula de sección, notas de hoy y «X de 9 diarios · En la tapa de N».
  - **Temas:** historias de 7 días (`informado/historias.py`): temas de la misma sección unidos por parecido (umbral 0,17; fútbol no se une solo), rótulo automático, «Agregar un tema…», «¿Qué significa el número?», tu semana por sección, «Temas que quedaron afuera» con «Sumar» y «Cerrar la semana / Enviar mi semana». Armá dejó de ser pestaña.
  - **Dentro de un tema:** renombrar (lápiz), «Por qué está Nº N» (repercusión y jerarquía), notas por día, Guardar, «Unir con otro tema» (y deshacer), «Sacar de mi semana», notas fijadas con alfiler y el feed por día de lo más nuevo a lo más viejo.
  - **Lo que guarda el celular:** uniones, nombres, fijadas y curaduría. El feedback semanal ahora incluye las uniones y los nombres.
- [ ] Modo lectura: se sacó el 25/11 porque así no servía. Volver a pensarlo más adelante.
- [ ] Modo lectura con texto completo: propuesto el 25/11 (servidor personal en Vercel, con clave, sin guardar texto y respetando los muros de pago). **En conversación, no aprobado.**
- [x] Tareas programadas: revisión diaria (6:43), calibración semanal (lunes 7:52) y errores reportados (todos los días a las 8:12, creada el 25/11). Las tres corren en la nube, sin pedir aprobación, y avisan al celular.

## Propuestas pendientes de aprobación

1. **Títulos de tema que siguen la reacción y no el hecho** (visto al aplicar el criterio aprobado el 25/11). Al mediodía del 25/11 el tema de la recesión pasó a llamarse «Luis Caputo: "La definición de recesión técnica es arbitraria"», porque las últimas notas de cada diario ya son reacciones. También quedó «A qué hora juega Boca hoy» como nombre de un tema de fútbol. *Cambios sugeridos, a elegir:* (a) tomar las últimas 2 o 3 notas de cada diario en vez de 1, para que pese el hecho y no solo la última reacción; (b) que las notas destacadas en la home pesen más al elegir el nombre; (c) sumar «a que hora juega» a los títulos que no sirven para nombrar un tema.
2. **Un mismo asunto partido en varios temas.** El homenaje a Santucho en la UBA aparece como 4 temas distintos (suspensión, carta del Gobierno, Villarruel, denuncia de un exjuez). *A estudiar:* bajar un poco el umbral de unión cuando comparten un nombre propio poco común.

1. **Cuota por sección en «Tu semana»** (visto al programar las historias, 25/11). La regla vigente (hasta 2 por sección y después se completa por puntaje) hace que temas con un número alto, como el Nº 4 y el Nº 5 de política, queden en «Temas que quedaron afuera», mientras entran el Nº 27 y el Nº 44 de Ciudad. Ahora que se ve el número, eso puede confundir. *A decidir:* mantener la cuota (asegura variedad de secciones) o tomar los 12 primeros por puntaje.
2. **Rótulos automáticos imperfectos** («Recesión técnica, trimestres y INDEC publica», «Paraguay, viaja y Javier»). Se pueden renombrar. *Posible mejora:* preferir nombres propios y sustantivos.

## Para retomar

La revisión diaria trae estos temas el día indicado. No se implementan sin una conversación con Nico.

- **Domingo 29/11 · Notas de opinión y periodistas.** Lo que se habló el 25/11:
  - **Opinión:** a Nico le gusta la idea de «Lecturas del fin de semana», sobre todo los domingos: columnas de opinión que recorren los temas de la semana, de varios diarios, con la opción de apagarla. Falta decidir si se hace, después de probar la app un fin de semana.
  - **Periodistas:** una ficha por periodista con enlaces adonde seguirlo (página de autor en cada diario, X, streaming, entrevistas). Solo enlaces: no se trae contenido de las redes. Queda para más adelante, si leer opinión desde la app resulta útil.
  - **Dato técnico:** hay que verificar qué diarios publican la firma de las notas en sus RSS.

## Revisiones diarias

- **25/11:** 9 diarios, 0 errores, 3.391 notas en 7 días. La corrida programada de las 03:34 falló al publicar en Pages (error transitorio de GitHub; las siguientes publicaron bien). Como no hubo corridas programadas después de las 05:15, se disparó una corrida manual a las 09:45 (sin cambios de código): recolectó 154 notas nuevas y publicó bien. Cinco propuestas. El 25/11 Nico aprobó deduplicar, excluir las notas de servicio y mandar Miss Universo a «otros» (aplicadas), y también el respaldo de corridas (falta elegir variante). El título de los temas sigue en conversación.

- **25/11 (mediodía):** desde las 11:35 UTC la publicación en Pages falla en todas las corridas («No artifacts named github-pages were found», justo después de subirlo bien). Ya había pasado a las 03:34 con el workflow original. Para descartar el cambio del respaldo, el control volvió a un solo trabajo, y sigue fallando igual. Todo indica un problema de GitHub. La recolección y los datos se guardan bien; la app muestra los datos de las 11:20 hasta que Pages vuelva a publicar.

- **25/11 (tarde):** la publicación en Pages volvió a andar desde las 12:08 UTC gracias al reintento (el primer intento sigue fallando y el segundo publica). En cambio, las corridas programadas siguen sin dispararse: después de las 12:16 no hubo ni la de las 13:17 ni el respaldo de las 13:47. A las 14:21 se lanzó una corrida a mano. *Propuesta:* si sigue así, que una tarea programada de Claude dispare el workflow cada 2 horas, en lugar de depender del `schedule` de GitHub. No tiene costo, pero es infraestructura nueva y necesita la aprobación de Nico.

- **25/11 (18:27 UTC):** Nico configuró la espera de 120 min en el entorno «reloj» y la cadena arrancó: lanzó la recolección, y su paso «esperar» quedó en espera («waiting»), como corresponde. Entre las 15:24 y las 18:27 el horario de GitHub no disparó ninguna corrida, lo que confirma que hacía falta la cadena. Para verificar en la revisión diaria: que haya una corrida de «Reloj (cada 2 horas)» cada ~2 h y una recolección lanzada por cada una.

- **25/11 (noche):** se encontró y reparó una falla previa: si dos corridas quedaban seguidas, la segunda no guardaba sus datos (chocaba con lo que había guardado la anterior) y aun así se marcaba como correcta. Ahora cada corrida parte de lo último de main, ante un choque ganan los datos más nuevos, y si no puede guardar, la corrida falla a la vista. Primer error cargado en la cola: #1 (nota de Lemon de La Nación mezclada con la de Kaszek).
- **Dato a mirar:** la inflación que publica datos.gob.ar está en septiembre (1,9%), aunque el INDEC ya publicó octubre. Si se confirma la demora, conviene usar el BCRA como fuente principal (lo decide Nico).

## Datos

- Notas: `datos/notas/AAAA-MM-DD.json` (por fecha de publicación, hora argentina). Se conservan 21 días.
- Última corrida: `datos/ultima_recoleccion.json` (notas por fuente, errores y totales de 7 días).
- La «semana pasada» se completa con el tiempo: los feeds traen sobre todo las últimas 48 h, así que la primera semana completa queda disponible el 1/12.

## Métricas de calidad

Se completan cuando haya curaduría real. Metas iniciales: 9 o más de 12 temas confirmados por semana, 2 o menos agregados a mano.
