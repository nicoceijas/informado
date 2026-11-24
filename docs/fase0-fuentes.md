# Fase 0 · Relevamiento de fuentes

Fecha: 24/11/2026. Verificado desde GitHub Actions, donde va a correr el recolector. Detalle completo en `sondeo/RESULTADO.md`.

## Resultado por diario

| Diario | Impreso | Fuente principal | Volumen aprox. | Sección | Estado |
|---|---|---|---|---|---|
| La Nación | Sí | RSS por sección + sitemap | ~400 notas en RSS, 1000 en sitemap | URL y categoría | ✅ Excelente |
| Infobae | No | RSS por sección | 100 por sección | URL | ✅ Excelente |
| Ámbito | Sí | RSS por sección + sitemap | ~250 en RSS, 195 en sitemap (7 días) | URL y categoría | ✅ Muy bueno |
| Clarín | Sí | RSS por sección + sitemap | 10 por RSS, ~900 en sitemap (48 h) | URL | ✅ Bueno |
| Perfil | Sí | RSS general + sitemap | 50 en RSS, 340 en sitemap (48 h) | URL | ✅ Bueno |
| El Cronista | Sí | RSS + sitemap | ~100 | URL | ✅ Bueno |
| Diario Popular | Sí | RSS + sitemap | ~50 en RSS, 107 en sitemap | URL | ✅ Bueno |
| Olé | Sí | RSS + sitemap | 266 en sitemap (48 h) | Club en la URL | ✅ Bueno |
| Página/12 | Sí | RSS + sitemap | 25 en RSS, 100 en sitemap | No figura | ⚠️ Tema por palabras clave |
| Crónica | Sí | — | — | — | ❌ Sin feeds públicos. Para la versión 1.1 |

Ningún diario bloquea los pedidos desde GitHub, y todos los RSS que funcionan traen bajada (mediana de 25 a 45 palabras).

## Hallazgos que cambian el diseño

1. **Ningún diario tiene sección «Sindicales» ni, salvo Clarín y Perfil, «Ciudad».** Esos dos temas se asignan por palabras clave y tienen prioridad sobre la sección: un paro publicado en Economía va a Sindicales.
2. **Varios diarios mezclan ediciones de otros países** (Infobae: España, Colombia, México; La Nación y Clarín: notas para el público hispano de Estados Unidos; El Cronista: España y México). Se excluyen por la URL.
3. **Página/12 no indica la sección en la URL**, pero su sitemap marca las notas de la **edición impresa**. Es una señal de jerarquía que suma para la propuesta B.
4. **Los sitemaps traen palabras clave editoriales** (La Nación y Página/12), por ejemplo «Universidades, Javier Milei, Financiamiento universitario, Plaza de Mayo». Mejoran el agrupamiento sin costo.
5. **El agrupamiento por convergencia ya se ve en los datos crudos:** el homenaje a Mario Santucho en la UBA apareció el mismo día en La Nación, Clarín, Perfil y Diario Popular.

## Archivos

- `config/fuentes.yaml`: feeds y sitemaps de cada diario, más las secciones excluidas.
- `config/temas.yaml`: reglas para traducir secciones y palabras clave a los seis temas.
- `sondeo/`: el script de sondeo y su último resultado. Se puede volver a correr desde la pestaña Actions.
