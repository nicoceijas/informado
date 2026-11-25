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
| 24/11 | Calibración 1: Sindicales gana sobre cualquier sección; Ciudad solo sobre secciones genéricas; se descartan notas automáticas (clima, quiniela, horóscopo). Cada corrida reaplica las reglas a toda la semana. |

## Pendientes del usuario

- [x] Activar GitHub Pages (24/11). App publicada en https://nicoceijas.github.io/informado/
- [ ] Instalar la app en el celular y usarla 2 semanas. Domingo: «Armá tu semana» y «Enviar feedback».

## Pendientes técnicos

- [x] Relevar feeds RSS y sitemaps de cada diario.
- [x] Tabla de secciones de cada diario → Política, Economía, Internacionales, Sindicales, Ciudad, Fútbol.
- [ ] Crónica: leer la home directamente (versión 1.1).
- [x] Recolector (cada 2 h, minuto 17 UTC) y clasificador de temas, con 11 pruebas.
- [x] Agrupador y puntaje (umbral 0,30, ventana 72 h, grupos de más de 35 notas se parten).
- [x] App web instalable: Hoy, Semana, Tema comparado, Armá tu semana, Guardadas, búsqueda de temas propios, feedback como issue.
- [x] Modo lectura (25/11): una nota por pantalla con título y bajada en letra grande, tamaño ajustable, tema oscuro, deslizar para pasar de nota. Desde cada tema y desde Guardadas.
- [ ] Fusionar temas desde la app (versión 1.1).
- [ ] Modo lectura con texto completo: propuesto el 25/11 (servidor personal en Vercel, con clave, sin guardar texto y respetando los muros de pago). **En conversación, no aprobado.**
- [ ] Tareas programadas de revisión (diaria y semanal).

## Propuestas pendientes de aprobación

Detectadas en la revisión diaria. No se aplicó ninguna; cada una espera el «sí» o el «no» de Nico.

1. **Las corridas programadas casi no se disparan (25/11).** Entre el 24/11 19:30 y el 25/11 09:45 UTC hubo una sola corrida programada (03:34) de las ~7 esperadas cada 2 h; los datos quedaron 4,5 h sin actualizar. Es una limitación conocida del `schedule` de GitHub Actions (demora o saltea corridas). *Cambio sugerido, a elegir:* (a) agregar un segundo horario en el mismo workflow (por ejemplo minutos 17 y 47) para que, si se saltea uno, entre el otro; o (b) que la revisión diaria dispare una corrida manual cuando la última tenga más de 3 h. Ninguna tiene costo.
2. **Notas repetidas dentro de un tema.** En «recesión técnica» la misma nota de Perfil (id `aWvO15i42sut`) aparece 3 veces porque cambió el slug y una vez vino sin `www`. En «clima AMBA» una nota de Ámbito (`…n6348454`) figura dos veces con fechas y títulos distintos (el diario la retituló al día siguiente y quedó guardada en dos días). Inflan la cantidad de notas del tema. *Cambio sugerido:* deduplicar por URL normalizada (sin `www`, y por el id final de la nota cuando el diario lo tiene) también entre días distintos, quedándose con la versión más reciente.
3. **Títulos de tema desactualizados.** El tema principal de la semana se titula «El Indec publica el dato que confirmará si la economía entró en recesión técnica», cuando 24 de sus 30 notas ya informan que entró. El del dólar se titula «a cuánto cerró este jueves 19 de noviembre». *Cambio sugerido:* elegir el título entre las notas de las últimas 24 h del tema (la más representativa de ese tramo), no entre todas.
4. **Notas de servicio que se cuelan como temas.** «Dólar blue hoy» (35 notas, puesto 7 de la semana y en Hoy) y «Buen tiempo en el AMBA y alertas…» (Ciudad, puesto 9) son cotizaciones y pronósticos diarios, no temas de debate. Las exclusiones actuales («clima hoy en», «pronostico del tiempo para») no los atrapan. *Cambio sugerido:* sumar a `excluir_titulos` patrones como «dolar blue hoy», «dolar hoy», «como estara el clima», «como estara el tiempo», o que esos grupos no puedan ser propuestos.
5. **Miss Universo clasificado como Internacionales** y propuesto en Hoy (tema `e5836b66f2`, 19 notas de Clarín e Infobae). Entra por la sección `internacional/` de la URL. *Cambio sugerido:* palabras clave de espectáculos/certámenes (miss universo, reality, farándula) que manden la nota a «otros» por encima de la sección.

## Revisiones diarias

- **25/11:** 9 diarios, 0 errores, 3.391 notas en 7 días. La corrida programada de las 03:34 falló al publicar en Pages (error transitorio de GitHub; las siguientes publicaron bien). Como no hubo corridas programadas después de las 05:15, se disparó una corrida manual a las 09:45 (sin cambios de código): recolectó 154 notas nuevas y publicó bien. Propuestas 1 a 5 arriba.

## Datos

- Notas: `datos/notas/AAAA-MM-DD.json` (por fecha de publicación, hora argentina). Se conservan 21 días.
- Última corrida: `datos/ultima_recoleccion.json` (notas por fuente, errores y totales de 7 días).
- La «semana pasada» se completa con el tiempo: los feeds traen sobre todo las últimas 48 h, así que la primera semana completa queda disponible el 1/12.

## Métricas de calidad

Se completan cuando haya curaduría real. Metas iniciales: 9 o más de 12 temas confirmados por semana, 2 o menos agregados a mano.
