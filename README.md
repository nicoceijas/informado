# Informado

Los temas de la semana y de hoy, comparados entre diarios nacionales argentinos. Es un prototipo personal.

- **App:** https://nicoceijas.github.io/informado/ (se instala en el celular con «Agregar a pantalla de inicio»)
- **Estado del proyecto:** [ESTADO.md](ESTADO.md)

## Cómo funciona

Cada 2 horas (marcado por `.github/workflows/reloj.yml`, una cadena que espera 120 min en el entorno «reloj» y se relanza sola), GitHub Actions:

1. **Recolecta** (`informado/recolectar.py`) los RSS y sitemaps de 9 diarios (`config/fuentes.yaml`). De cada nota guarda solo título, bajada breve, fecha, sección y enlace. También registra la posición de cada nota en la home del diario.
2. **Clasifica** cada nota en Política, Economía, Internacionales, Sindicales, Ciudad o Fútbol (`config/temas.yaml`).
3. **Agrupa** (`informado/agrupar.py`) las notas de distintos diarios que hablan de lo mismo, con TF-IDF y similitud, sin IA externa. Puntúa cada tema: 60% convergencia + 40% jerarquía.
4. **Publica** la app con los datos en GitHub Pages.

La curaduría («Armá tu semana») y las notas guardadas quedan en el celular. El botón «Enviar feedback» abre un *issue* con la curaduría para calibrar el algoritmo.

## Carpetas

| Carpeta | Contenido |
|---|---|
| `config/` | Fuentes y reglas de temas, editables |
| `informado/` | Recolector, clasificador y agrupador (Python) |
| `app/` | App web instalable (HTML, CSS, JS sin dependencias) |
| `datos/notas/` | Notas por día (21 días) |
| `datos/temas/` | Temas calculados que lee la app |
| `sondeo/` | Verificación de fuentes |
| `docs/` | Documentación de fases |
