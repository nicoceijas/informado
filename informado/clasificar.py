"""Asigna a cada nota uno de los temas de config/temas.yaml, o "otros".

Orden de decisión (documentado también en config/temas.yaml):
  1. Sección en `secciones_otros` → otros.
  2. Temas con prioridad alta (Sindicales, Ciudad) si hay coincidencia de palabras clave.
  3. Sección que pertenece a un tema.
  4. Secciones condicionales (deportes → Fútbol solo si habla de fútbol).
  5. Tema por defecto del diario (Olé → Fútbol).
  6. Sección genérica, desconocida o ausente → el tema con más palabras clave.
  7. Nada → otros.
"""
from .texto import coincidencias, normalizar


class Clasificador:
    def __init__(self, cfg_temas: dict):
        self.temas = cfg_temas["temas"]
        self.otros = set(cfg_temas.get("secciones_otros", []))
        self.genericas = set(cfg_temas.get("secciones_genericas", []))
        self.por_seccion = {}
        for clave, t in self.temas.items():
            for s in t.get("secciones", []):
                self.por_seccion[s] = clave
        self.alta = [k for k, t in self.temas.items() if t.get("prioridad") == "alta"]

    def clasificar(self, nota: dict, tema_por_defecto: str | None = None) -> tuple[str, str]:
        """Devuelve (tema, motivo). El motivo queda guardado para poder auditar."""
        sec = nota.get("seccion") or ""
        texto = normalizar(" ".join([nota.get("titulo", ""), nota.get("bajada", ""),
                                     " ".join(nota.get("palabras_clave", []))]))

        if sec in self.otros:
            return "otros", f"seccion:{sec}"

        for clave in self.alta:
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
