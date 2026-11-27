# Estado del proyecto Informado

Última actualización: 27/11/2026

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
| 27/11 | Aprobado por Nico: reportes de otras personas. En los celulares que no son el de Nico, la banderita guarda el reporte en el celular (con el nombre de quien reporta) y «Enviar reportes» (píldora flotante, Guardadas y «Cerrar la semana»; recordatorio los domingos) lo comparte como archivo .txt por el menú de Android, o como texto para copiar. En el celular de Nico («modo Nico»: enlace `?soy=nico` o 5 toques en el título «Guardadas»), la banderita sigue abriendo GitHub al momento, y «Cargar reportes recibidos» (#reportes) importa el archivo o el texto, muestra cada reporte y lo sube como issue con las etiquetas `error` y `de-otros`. La tarea de errores los trata igual que los de Nico (opción a). Banderitas nuevas en el nombre de cada tema: al lado del título y en las filas de Hoy, Temas y Guardadas (`sobre: "titulo"`). |
| 27/11 | Aprobado por Nico: la inflación se toma del mes más reciente entre datos.gob.ar, el BCRA y ArgentinaDatos, con la fuente que lo trajo. Motivo: datos.gob.ar seguía en septiembre con octubre ya publicado, y como no daba error, el respaldo nunca se consultaba. |
| 27/11 | Aprobado por Nico: la app pasa al diseño G3 (maqueta del 27/11). Paleta propia (morado, violeta, colorado, amarillo; azul solo para enlaces), líneas negras y esquinas rectas, letra Montserrat, solo tema claro (Nico descartó el oscuro el 27/11). Pantallas Hoy, Semana (antes «Temas») y Guardadas. Hoy: clima afuera, caja «Antes de salir» con contador (avisos de hoy y mañana) e indicadores, y la agenda de las 24 horas con filtro por sección. La Semana suma la caja «Lo que viene» (avisos para más adelante). Sale «¿Qué significa el número?» y «Por qué está Nº». Botón de compartir en temas y notas, con un texto que presenta Informado. |
| 24/11 | Calibración 1: Sindicales gana sobre cualquier sección; Ciudad solo sobre secciones genéricas; se descartan notas automáticas (clima, quiniela, horóscopo). Cada corrida reaplica las reglas a toda la semana. |

## Pendientes del usuario

- [x] Activar GitHub Pages (24/11). App publicada en https://nicoceijas.github.io/informado/
- [ ] Prender el «modo Nico» en tu celular (abrir https://nicoceijas.github.io/informado/?soy=nico o tocar 5 veces el título «Guardadas»). Sin eso, tus banderitas se guardan en el celular en vez de ir a GitHub.
- [ ] Instalar la app en el celular y usarla 2 semanas. Domingo: «Armá tu semana» y «Enviar feedback».

## Pendientes técnicos

- [x] Relevar feeds RSS y sitemaps de cada diario.
- [x] Tabla de secciones de cada diario → Política, Economía, Internacionales, Sindicales, Ciudad, Fútbol.
- [ ] Crónica: leer la home directamente (versión 1.1).
- [x] Recolector (cada 2 h, minuto 17 UTC) y clasificador de temas, con 16 pruebas.
- [x] Agrupador y puntaje (umbral 0,30, ventana 72 h, grupos de más de 35 notas se parten).
- [x] App web instalable: Hoy, Semana, Tema comparado, Armá tu semana, Guardadas, búsqueda de temas propios, feedback como issue.
- [ ] Fusionar temas desde la app (versión 1.1).
- [x] Reportes de errores de otras personas y banderitas en los nombres de los temas (27/11). Probado en un navegador simulado: guardar, compartir archivo, plan B de texto, cargar en el celular de Nico sin duplicar, issue con `de-otros` y modo Nico.
- [ ] «Enviar mi semana» (curaduría) de otras personas todavía abre GitHub, y la calibración lo ignora. Si hace falta, se puede llevar por el mismo camino que los reportes (sin decidir).
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

*Vistas en la revisión del 26/11.* Ninguna se aplicó.

- **A. Ediciones centroamericanas de Infobae.** El feed «mundo» de Infobae (`category/america`) trae notas de las ediciones de El Salvador, Panamá, Guatemala, Honduras, Cuba, Costa Rica, República Dominicana y Nicaragua: unas 110 por día, el 38% de lo que aporta Infobae. Pasa desde el arranque, no es una rotura. Se meten en temas («Panamá apuesta al Black Friday» quedó en «Cuándo es el Black Friday 2026 en la Argentina») y en «Tu día» («Honduras alerta por nueva estafa…»). *Cambio sugerido:* sumar `el-salvador, panama, guatemala, honduras, cuba, costa-rica, republica-dominicana, nicaragua` a `excluir_secciones` de Infobae, siguiendo la decisión del 24/11 de excluir las ediciones de otros países.
- **B. Notas automáticas de partidos de La Nación.** «X venció por 1-0 a Y, por la Champions League 2026» y «X vs. Y, por la Liga de Italia 2026: día, hora y cómo seguir online» engordan el tema del Manchester United (de 30 notas, 17 son de este tipo). *Cambio sugerido:* sumar «cómo seguir online» a `servicio_sin_tema`, y «venció por» + «por la (Champions League|Liga|Premier League)» a `excluir_titulos`.
- **C. Básquet dentro del Mundial Sub-17.** «La Selección de básquet recibe a Bahamas y Canadá en busca del Mundial 2027» (Página/12 e Infobae) entró al tema del Sub-17 de fútbol por «selección» y «Mundial». *Cambio sugerido:* sumar «básquet» a `palabras_otros`.
- **D. Tema de Paraguay demasiado amplio.** «Milei viajó a Paraguay…» junta 31 notas: la detención del hermano de Santiago Peña, el viaje de Milei, la visita del presidente de Polonia, Lula y el embajador, la mesa política y los «EN VIVO» de Clarín y La Nación, que hacen de puente. Algo parecido pasa en «Luis Caputo descartó su salida…», que se lleva notas de la reforma electoral y del tratado de patentes. *A estudiar (toca el agrupador):* que las notas «EN VIVO» no unan grupos, o que pesen menos.
- **E. «Tu día › Paros» con falsos positivos.** «Servicios · Anunciado» muestra la sanción a los policías del deck de Caballito, que no es un paro. «Bancarios · Anunciado» muestra las notas del paro universitario, así que el rótulo no corresponde. «colectivos · Anunciado» es un cambio de mano de calles por el Trambus. *A estudiar:* que el rótulo salga de la nota que más se repite y que «marcha atrás» o «sancionó» no cuenten como señal de paro.
- **#1 · Lemon (La Nación) metida en el tema de Kaszek** (error reportado, revisado el 26/11, *pendiente de Nico*). Se une a Kaszek por 0,301 (umbral 0,30), casi solo por «levantó US$ … millones» y «región». Con las notas de Tether y Lemon de El Cronista y Clarín no llega al umbral (0,261 y 0,192). No se arregla con las listas de configuración. *A elegir (toca el agrupador):* (a) «levantar» y «recaudar» como palabras vacías: corta el lazo falso, pero la nota quedaría sola (0,285 con El Cronista); (b) bajar el umbral a ~0,25 cuando comparten un nombre propio poco frecuente («Lemon»), igual que la propuesta 2 (Santucho). Con (a) y (b) juntas, la nota pasaría al tema correcto; (c) reasignar una nota al tema cuyo centro se le parece más (acá la diferencia es mínima: 0,276 contra 0,271).
- **F. Tema del papa León XIV que mezcla asuntos distintos** (visto en la revisión del 27/11). «La Iglesia festejó la aprobación de la ley contra la ludopatía…» (Internacionales, 20 notas de 7 diarios, rótulo «León XIV, García Cuerva y fracaso») junta el festejo de la Iglesia por la ley de ludopatía del Senado, el nombramiento de García Cuerva en el Vaticano, el fracaso de la COP31 (incluidas notas que no nombran al Papa), el procesamiento del hombre que amenazó al Papa y «Alba tejedora» (Página/12). El lazo es «León XIV»/«papa». Además, el festejo por una ley argentina queda en Internacionales, mientras la ley misma está en Política («Además de las leyes de Ludopatía I y II…», 2 notas). *A estudiar (toca el agrupador):* el mismo enfoque de la propuesta D, que una nota puente no una grupos; o que un nombre propio muy repetido en la semana («León XIV») pese menos como lazo.
- **Sobre la propuesta B (27/11): empeoró.** En el tema del Manchester United, 25 de 32 notas son de La Nación, casi todas automáticas («… por la Champions League 2026: día, hora y cómo seguir online»), y apareció otro tema armado así: «Los goles de Monza frente a Fiorentina» (7 notas automáticas de La Nación y 2 de Olé, con partidos de la Bundesliga). Sus historias («Champions League, seguir online y Saudí Pro», «Seguir online, Italia y Liga») encabezan la lista de historias de Hoy. El cambio sugerido sigue siendo el mismo.
- **Sobre la propuesta A (27/11):** sigue igual: el 26/11, 99 de las 295 notas de Infobae fueron de las ediciones centroamericanas.
- **Sobre la propuesta 2 de arriba (Santucho partido en 4 temas):** las historias ya juntan los 4 temas en «Mario Santucho, homenaje y UBA». En la pestaña Temas eso queda resuelto, pero en Hoy y en la propuesta semanal todavía no.

## Para retomar

La revisión diaria trae estos temas el día indicado. No se implementan sin una conversación con Nico.

- **Domingo 29/11 · Notas de opinión y periodistas.** Lo que se habló el 25/11:
  - **Opinión:** a Nico le gusta la idea de «Lecturas del fin de semana», sobre todo los domingos: columnas de opinión que recorren los temas de la semana, de varios diarios, con la opción de apagarla. Falta decidir si se hace, después de probar la app un fin de semana.
  - **Periodistas:** una ficha por periodista con enlaces adonde seguirlo (página de autor en cada diario, X, streaming, entrevistas). Solo enlaces: no se trae contenido de las redes. Queda para más adelante, si leer opinión desde la app resulta útil.
  - **Dato técnico:** hay que verificar qué diarios publican la firma de las notas en sus RSS.
- **Sin fecha · Cómo se organiza la Semana con el correr de los días.** Lo planteó Nico el 27/11, mientras se revisaban las maquetas. Se resuelve en una conversación aparte sobre organización de la información, no de diseño.
  - **Problema:** la Semana suma 7 días y Hoy mira 24 horas. A medida que la semana avanza y hay más notas, las dos páginas se separan: la Semana muestra temas que tuvieron su pico hace 2 o 3 días y Hoy, los del día. Los temas que siguen vivos aparecen en las dos, el usuario tiene que ir descartando entre una y otra, y lo de «Tu semana» se pierde.
  - **Idea de Nico:** que la Semana tenga dos maneras de ordenarse: por repercusión (ranking de incidencia en los medios) o por cronología. Y poder filtrar los temas que son solo de hoy.
  - **Propuesta de Claude (sin aprobar):**
    - Selector arriba con dos vistas.
    - **Por repercusión:** el ranking actual, con el momento de cada tema en la fila («Sigue hoy (+12 hoy)» o «Último movimiento: lunes») y un filtro «Solo los que siguen hoy».
    - **Día por día:** la semana leída como un diario (Miércoles 25, Martes 24…), con 3 a 5 temas por día. Cada tema aparece una sola vez, en el día de su pico, con una línea tipo «siguió hasta hoy».
    - **«Tu semana» como filtro fijo** al principio de la barra de secciones (como el chip «Tu semana · 12» de la app actual), visible en las dos vistas.
    - En la Semana, los temas que también están en Hoy no se sacan: llevan la marca «Sigue hoy».
    - Se arma con los datos que ya existen (cada tema trae sus notas por día). No toca el recolector.
  - **Preguntas abiertas:** (1) qué vista abre por defecto; (2) en «día por día», si el tema va en el día de su pico o en el día en que apareció; (3) si «Tu semana» es un filtro fijo o una vista propia.
  - **Relacionado:** en la maqueta G3 los avisos anunciados para más adelante (paros, cambios de servicio) van a una caja «Lo que viene» en la Semana. Nico sugirió que quizás haga falta una caja así para ordenar lo que viene.

## Revisiones diarias

- **25/11:** 9 diarios, 0 errores, 3.391 notas en 7 días. La corrida programada de las 03:34 falló al publicar en Pages (error transitorio de GitHub; las siguientes publicaron bien). Como no hubo corridas programadas después de las 05:15, se disparó una corrida manual a las 09:45 (sin cambios de código): recolectó 154 notas nuevas y publicó bien. Cinco propuestas. El 25/11 Nico aprobó deduplicar, excluir las notas de servicio y mandar Miss Universo a «otros» (aplicadas), y también el respaldo de corridas (falta elegir variante). El título de los temas sigue en conversación.

- **25/11 (mediodía):** desde las 11:35 UTC la publicación en Pages falla en todas las corridas («No artifacts named github-pages were found», justo después de subirlo bien). Ya había pasado a las 03:34 con el workflow original. Para descartar el cambio del respaldo, el control volvió a un solo trabajo, y sigue fallando igual. Todo indica un problema de GitHub. La recolección y los datos se guardan bien; la app muestra los datos de las 11:20 hasta que Pages vuelva a publicar.

- **25/11 (tarde):** la publicación en Pages volvió a andar desde las 12:08 UTC gracias al reintento (el primer intento sigue fallando y el segundo publica). En cambio, las corridas programadas siguen sin dispararse: después de las 12:16 no hubo ni la de las 13:17 ni el respaldo de las 13:47. A las 14:21 se lanzó una corrida a mano. *Propuesta:* si sigue así, que una tarea programada de Claude dispare el workflow cada 2 horas, en lugar de depender del `schedule` de GitHub. No tiene costo, pero es infraestructura nueva y necesita la aprobación de Nico.

- **25/11 (18:27 UTC):** Nico configuró la espera de 120 min en el entorno «reloj» y la cadena arrancó: lanzó la recolección, y su paso «esperar» quedó en espera («waiting»), como corresponde. Entre las 15:24 y las 18:27 el horario de GitHub no disparó ninguna corrida, lo que confirma que hacía falta la cadena. Para verificar en la revisión diaria: que haya una corrida de «Reloj (cada 2 horas)» cada ~2 h y una recolección lanzada por cada una.

- **25/11 (noche):** se encontró y reparó una falla previa: si dos corridas quedaban seguidas, la segunda no guardaba sus datos (chocaba con lo que había guardado la anterior) y aun así se marcaba como correcta. Ahora cada corrida parte de lo último de main, ante un choque ganan los datos más nuevos, y si no puede guardar, la corrida falla a la vista. Primer error cargado en la cola: #1 (nota de Lemon de La Nación mezclada con la de Kaszek).
- **26/11:** todo anduvo bien. 9 diarios, 0 errores, 5.065 notas en 7 días; los 9 aportaron en las últimas 24 h (de 52 en Popular a 339 en La Nación). La cadena «Reloj» disparó a horario (00:28, 02:28, 04:29, 06:29, 08:29 UTC) y todas las recolecciones publicaron bien. Sin reparaciones. Cinco propuestas nuevas (A a E). La inflación sigue en septiembre (1,9%).
- **27/11:** todo anduvo bien. 9 diarios, 0 errores, 6.603 notas en 7 días; los 9 aportaron en las últimas 24 h (de 58 en Popular a 325 en La Nación). La cadena «Reloj» disparó a horario (00:31, 02:31, 04:32, 06:32, 08:32 UTC) y todas las recolecciones publicaron bien; los respaldos programados también terminaron bien. Sin reparaciones. Una propuesta nueva (F, tema del papa León XIV) y la B empeoró. Nada en «Para retomar» para hoy (el próximo es el domingo 29/11).
- **27/11 (mañana, con Nico):** la corrida de las 12:33 UTC salió a horario (la cadena espera 120 min desde la anterior, a las 10:33). La inflación seguía en septiembre porque datos.gob.ar no había cargado octubre; Nico aprobó tomar el mes más reciente entre datos.gob.ar, el BCRA y ArgentinaDatos (`obtener_mas_nuevo` en `informado/indicadores.py`, con prueba). El lector del BCRA entiende la v4.0 y la v3.0 de su API. *Para verificar en la próxima revisión:* que `datos/indicadores.json` diga octubre y qué fuente lo trajo.

## Datos

- Notas: `datos/notas/AAAA-MM-DD.json` (por fecha de publicación, hora argentina). Se conservan 21 días.
- Última corrida: `datos/ultima_recoleccion.json` (notas por fuente, errores y totales de 7 días).
- La «semana pasada» se completa con el tiempo: los feeds traen sobre todo las últimas 48 h, así que la primera semana completa queda disponible el 1/12.

## Métricas de calidad

Se completan cuando haya curaduría real. Metas iniciales: 9 o más de 12 temas confirmados por semana, 2 o menos agregados a mano.
