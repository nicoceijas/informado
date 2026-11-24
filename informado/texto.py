"""Utilidades de texto: normalización y búsqueda de palabras completas."""
import re
import unicodedata
from functools import lru_cache


def normalizar(texto: str) -> str:
    """Minúsculas, sin tildes y con espacios simples."""
    if not texto:
        return ""
    t = unicodedata.normalize("NFKD", texto)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = re.sub(r"[^\w\s/]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def limpiar_html(texto: str) -> str:
    if not texto:
        return ""
    t = re.sub(r"<[^>]+>", " ", texto)
    t = (t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"')
          .replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">"))
    return re.sub(r"\s+", " ", t).strip()


def recortar_palabras(texto: str, maximo: int) -> str:
    palabras = texto.split()
    if len(palabras) <= maximo:
        return texto
    return " ".join(palabras[:maximo]) + "…"


@lru_cache(maxsize=None)
def _patron(palabras: tuple) -> re.Pattern:
    alternativas = sorted((re.escape(normalizar(p)) for p in palabras if p), key=len, reverse=True)
    return re.compile(r"(?<!\w)(?:" + "|".join(alternativas) + r")(?!\w)")


def coincidencias(texto_normalizado: str, palabras) -> list:
    """Palabras (o frases) de la lista que aparecen completas en el texto ya normalizado."""
    if not palabras:
        return []
    return _patron(tuple(palabras)).findall(texto_normalizado)
