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
| 25/11 | Aprobado por Nico (opción A): horario de respaldo en el minuto 47 de cada hora par; corre solo si la última recolección tiene más de 90 min. Así el ritmo sigue siendo de 2 h aunque GitHub saltee una corrida programada. |
| 24/11 | Calibración 1: Sindicales gana sobre cualquier sección; Ciudad solo sobre secciones genéricas; se descartan notas automáticas (clima, quiniela, horóscopo). Cada corrida reaplica las reglas a toda la semana. |

## Pendientes del usuario

- [x] Activar GitHub Pages (24/11). App publicada en https://nicoceijas.github.io/informado/
- [ ] Instalar la app en el celular y usarla 2 semanas. Domingo: «Armá tu semana» y «Enviar feedback».

## Pendientes técnicos

- [x] Relevar feeds RSS y sitemaps de cada diario.
- [x] Tabla de secciones de cada diario → Política, Economía, Internacionales, Sindicales, Ciudad, Fútbol.
- [ ] Crónica: leer la home directamente (versión 1.1).
- [x] Recolector (cada 2 h, minuto 17 UTC) y clasificador de temas, con 14 pruebas.
- [x] Agrupador y puntaje (umbral 0,30, ventana 72 h, grupos de más de 35 notas se parten).
- [x] App web instalable: Hoy, Semana, Tema comparado, Armá tu semana, Guardadas, búsqueda de temas propios, feedback como issue.
- [x] Modo lectura (25/11): una nota por pantalla con título y bajada en letra grande, tamaño ajustable, tema oscuro, deslizar para pasar de nota. Desde cada tema y desde Guardadas.
- [ ] Fusionar temas desde la app (versión 1.1).
- [ ] Modo lectura con texto completo: propuesto el 25/11 (servidor personal en Vercel, con clave, sin guardar texto y respetando los muros de pago). **En conversación, no aprobado.**
- [ ] Tareas programadas de revisión (diaria y semanal).

## Propuestas pendientes de aprobación

1. **Títulos de tema desactualizados.** **En conversación, no aprobada.** Nico señaló que tomar «las últimas 24 h» no resuelve el caso del Indec: dentro de esas 24 h conviven «confirmará si…» y «entró en recesión». Nueva propuesta: tomar la última nota de cada diario y elegir la que más se parece a las demás. El título cambia cuando la mayoría de los diarios cambió su manera de contarlo, no por un reloj. Simulación con los datos reales del tema Indec: a las 15:00 del 24/11 (antes del dato), «El INDEC publica un dato clave… que confirmaría la recesión técnica»; a las 16:30, a las 18:00 y el 25/11, «…Argentina entró en recesión técnica». Con el criterio actual sigue diciendo «confirmará». Probé y descarté «la nota más reciente» y «las últimas 8 notas»: elegían notas laterales (Caputo celebró el EMAE, «Golearon a Palmeiras…»).
2. **Pantalla «Temas» con todo a la vista.** **Pedido de Nico el 25/11; diseño en consulta.** Una sola pantalla con Hoy/Semana arriba, un campo fijo «Agregar un tema…» (busca entre los demás temas para sumarlos o lo agrega como tema propio) y la lista compacta de temas agrupada por sección, con una fila por tema. Al tocar una fila se despliegan las notas, una por diario, con «Tema completo», «Modo lectura» y «Sacar de mi semana». Maqueta con datos reales enviada en la conversación.
3. **Pronósticos que siguen pasando** (visto al probar la regla de servicio). «Semana de calor en el AMBA: qué días la temperatura estará por encima de los 30 grados» (5 notas) quedó propuesto en Ciudad. Los patrones aprobados no lo atrapan. *Cambio sugerido:* sumar «temperatura estara», «que dias» + «calor», o excluir los grupos donde todas las notas sean de clima.

## Revisiones diarias

- **25/11:** 9 diarios, 0 errores, 3.391 notas en 7 días. La corrida programada de las 03:34 falló al publicar en Pages (error transitorio de GitHub; las siguientes publicaron bien). Como no hubo corridas programadas después de las 05:15, se disparó una corrida manual a las 09:45 (sin cambios de código): recolectó 154 notas nuevas y publicó bien. Cinco propuestas. El 25/11 Nico aprobó deduplicar, excluir las notas de servicio y mandar Miss Universo a «otros» (aplicadas), y también el respaldo de corridas (falta elegir variante). El título de los temas sigue en conversación.

## Datos

- Notas: `datos/notas/AAAA-MM-DD.json` (por fecha de publicación, hora argentina). Se conservan 21 días.
- Última corrida: `datos/ultima_recoleccion.json` (notas por fuente, errores y totales de 7 días).
- La «semana pasada» se completa con el tiempo: los feeds traen sobre todo las últimas 48 h, así que la primera semana completa queda disponible el 1/12.

## Métricas de calidad

Se completan cuando haya curaduría real. Metas iniciales: 9 o más de 12 temas confirmados por semana, 2 o menos agregados a mano.
