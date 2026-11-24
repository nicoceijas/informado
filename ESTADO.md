# Estado del proyecto Informado

Última actualización: 24/11/2026

## Dónde estamos

- **Fase actual:** 2 · Agrupador de temas y app (próximo)
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
| 24/11 | Calibración 1: Sindicales gana sobre cualquier sección; Ciudad solo sobre secciones genéricas; se descartan notas automáticas (clima, quiniela, horóscopo). Cada corrida reaplica las reglas a toda la semana. |

## Pendientes del usuario

- Ninguno por ahora.

## Pendientes técnicos

- [x] Relevar feeds RSS y sitemaps de cada diario.
- [x] Tabla de secciones de cada diario → Política, Economía, Internacionales, Sindicales, Ciudad, Fútbol.
- [ ] Crónica: leer la home directamente (versión 1.1).
- [x] Recolector (cada 2 h, minuto 17 UTC) y clasificador de temas, con 11 pruebas.
- [ ] Agrupador y puntaje.
- [ ] App web instalable.
- [ ] Tareas programadas de revisión (diaria y semanal).

## Datos

- Notas: `datos/notas/AAAA-MM-DD.json` (por fecha de publicación, hora argentina). Se conservan 21 días.
- Última corrida: `datos/ultima_recoleccion.json` (notas por fuente, errores y totales de 7 días).
- La «semana pasada» se completa con el tiempo: los feeds traen sobre todo las últimas 48 h, así que la primera semana completa queda disponible el 1/12.

## Métricas de calidad

Se completan cuando haya curaduría real. Metas iniciales: 9 o más de 12 temas confirmados por semana, 2 o menos agregados a mano.
