"""Asigna a cada nota uno de los temas de config/temas.yaml, o "otros".

Orden de decisión (documentado también en config/temas.yaml):
  1. Sección en `secciones_otros` → otros.
  1b. Palabras de `palabras_otros` (espectáculos, certámenes) → otros, aunque la sección tenga tema.
  2. Temas con prioridad alta (Sindicales) si hay coincidencia de palabras clave.
  2b. Temas con prioridad media (Ciudad), solo en secciones genéricas o desconocidas.
  3. Sección que pertenece a un tema.
  4. Secciones condicionales (deportes → Fútbol solo si habla de fútbol).
  5. Tema por defecto del diario (Olé → Fútbol).
  6. Sección genérica, desconocida o ausente → el tema con más palabras clave.
  7. Nada → otros.
  Después, sobre las notas que quedaron en Fútbol (decisión del 27/11):
  8. Otros deportes (`futbol_otros_deportes`, p. ej. básquet) → otros.
  9. Fútbol del exterior (`futbol_exterior`) → otros, salvo Selección o clubes argentinos,
     campeones o algo que excede lo futbolístico.
"""
from .texto import coincidencias, normalizar


class Clasificador:
    def __init__(self, cfg_temas: dict):
        self.temas = cfg_temas["temas"]
        self.otros = set(cfg_temas.get("secciones_otros", []))
        self.palabras_otros = cfg_temas.get("palabras_otros", [])
        self.genericas = set(cfg_temas.get("secciones_genericas", []))
        self.por_seccion = {}
        for clave, t in self.temas.items():
            for s in t.get("secciones", []):
                self.por_seccion[s] = clave
        self.alta = [k for k, t in self.temas.items() if t.get("prioridad") == "alta"]
        self.media = [k for k, t in self.temas.items() if t.get("prioridad") == "media"]
        self.sin_prioridad = set(cfg_temas.get("secciones_sin_prioridad", []))
        self.condicionales = {s for t in self.temas.values() for s in t.get("secciones_condicionales", {})}
        self.exterior = cfg_temas.get("futbol_exterior") or {}
        self.otros_deportes = cfg_temas.get("futbol_otros_deportes") or []

    def conoce(self, seccion: str) -> bool:
        """True si la sección tiene una regla propia (tema, otros, genérica o condicional)."""
        return bool(seccion) and (seccion in self.por_seccion or seccion in self.otros
                                  or seccion in self.genericas or seccion in self.condicionales)

    def clasificar(self, nota: dict, tema_por_defecto: str | None = None) -> tuple[str, str]:
        """Devuelve (tema, motivo). El motivo queda guardado para poder auditar."""
        sec = nota.get("seccion") or ""
        texto = normalizar(" ".join([nota.get("titulo", ""), nota.get("bajada", ""),
                                     " ".join(nota.get("palabras_clave", []))]))
        tema, motivo = self._clasificar(sec, texto, tema_por_defecto)
        if tema == "futbol":
            return self._filtrar_futbol(sec, texto, motivo)
        return tema, motivo

    def _filtrar_futbol(self, sec: str, texto: str, motivo: str) -> tuple[str, str]:
        hallado = coincidencias(texto, self.otros_deportes)
        if hallado:
            return "otros", f"otro_deporte:{hallado[0]}"
        ext = self.exterior
        if not ext:
            return "futbol", motivo
        exterior = sec in set(ext.get("secciones", [])) or coincidencias(texto, ext.get("palabras", []))
        if not exterior:
            return "futbol", motivo
        for clave in ("salvo_local", "salvo_campeon", "salvo_extra"):
            hallado = coincidencias(texto, ext.get(clave, []))
            if hallado:
                return "futbol", f"{motivo}+{clave}:{hallado[0]}"
        return "otros", "futbol_exterior"

    def _clasificar(self, sec: str, texto: str, tema_por_defecto: str | None) -> tuple[str, str]:

        if sec in self.otros:
            return "otros", f"seccion:{sec}"

        hallado = coincidencias(texto, self.palabras_otros)
        if hallado:
            return "otros", f"palabras_otros:{','.join(sorted(set(hallado))[:3])}"

        for clave in ([] if sec in self.sin_prioridad else self.alta):
            hallado = coincidencias(texto, self.temas[clave].get("palabras", []))
            if hallado:
                return clave, f"palabras:{','.join(sorted(set(hallado))[:3])}"

        if sec not in self.sin_prioridad and (sec in self.genericas or not self.conoce(sec)):
            for clave in self.media:
                hallado = coincidencias(texto, self.temas[clave].get("palabras", []))
                if hallado:
                    return clave, f"palabras:{','.join(sorted(set(hallado))[:3])}"

        if sec in self.por_seccion:
            return self.por_seccion[sec], f"seccion:{sec}"

        for clave, t in self.temas.items():
            condicionales = t.get("secciones_condicionales", {})
            if sec in condicionales:
                hallado = coincidencias(texto, condicionales[sec])
                if hallado:
                    return clave, f"seccion:{sec}+palabras:{','.join(sorted(set(hallado))[:3])}"
                return "otros", f"seccion:{sec}"

        if tema_por_defecto:
            return tema_por_defecto, "diario"

        puntajes = {}
        for clave, t in self.temas.items():
            n = len(coincidencias(texto, t.get("palabras", [])))
            if n:
                puntajes[clave] = n
        if puntajes:
            mejor = max(puntajes, key=puntajes.get)
            return mejor, f"palabras:{puntajes[mejor]}"
        return "otros", "sin_coincidencias"
