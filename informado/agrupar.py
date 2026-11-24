"""Agrupador de Informado: arma los temas de la semana y de hoy a partir de las notas.

Propuesta C (híbrida), sin IA en la corrida:
  1. Texto de cada nota: título (doble peso) + bajada + palabras clave del sitemap (doble peso).
  2. Limpieza: sin tildes, sin palabras vacías, raíz con Snowball, más pares de palabras.
  3. TF-IDF calculado sobre las últimas 3 semanas: sube lo inusual y baja lo de siempre.
  4. Dos notas se unen si su similitud supera UMBRAL y se publicaron con menos de 72 h de diferencia.
     Los grupos demasiado grandes se vuelven a partir con un umbral más exigente.
  5. Puntaje = 60% convergencia (diarios, días, notas) + 40% jerarquía (home y edición impresa).

Salida: datos/temas/actual.json (lo que lee la app) y datos/temas/notas_semana.json (búsqueda).
Uso: python -m informado.agrupar
"""
import hashlib
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import snowballstemmer
import yaml
from sklearn.feature_extraction.text import TfidfVectorizer

from .stopwords import CLAVES_GENERICAS, STOPWORDS
from .texto import coincidencias, normalizar

RAIZ = Path(__file__).resolve().parent.parent
NOTAS = RAIZ / "datos" / "notas"
SALIDA = RAIZ / "datos" / "temas"
AR = timezone(timedelta(hours=-3))

PARAMS = {
    "umbral": 0.30,            # similitud mínima para unir dos notas
    "umbral_paso": 0.06,       # cuánto se endurece al partir un grupo grande
    "max_grupo": 35,           # notas máximas antes de partir un grupo
    "ventana_horas": 72,       # diferencia máxima de publicación entre dos notas unidas
    "peso_convergencia": 0.6,
    "peso_jerarquia": 0.4,
    "min_diarios_tema": 2,     # un tema necesita al menos este número de diarios distintos
    "propuestos_por_seccion": 2,
    "total_propuestos": 12,
}

# "Afecta tu día": una palabra de afectación + un servicio o un lugar del AMBA.
AFECTA = ["paro", "paros", "cortes", "corte de", "corte total", "corte parcial", "corte de luz", "corte de agua",
          "marcha", "movilizacion", "desvio", "desvios", "interrupcion", "sin servicio", "piquete", "manifestacion",
          "feriado", "asueto", "medida de fuerza", "huelga", "tormenta", "tormentas", "alerta"]
AMBITO = ["colectivos", "colectivo", "subte", "subtes", "trenes", "tren", "autopista", "avenida", "caba", "amba",
          "conurbano", "gran buenos aires", "ciudad de buenos aires", "porteno", "portenos", "aysa", "edenor",
          "edesur", "transporte", "bancos", "bancarios", "aeroparque", "ezeiza", "vuelos", "clases", "escuelas",
          "plaza de mayo", "obelisco", "panamericana", "general paz", "acceso oeste", "riccheri"]
# Títulos que no sirven para nombrar un tema (servicio, transmisiones en vivo).
TITULOS_SERVICIO = ["en vivo", "minuto a minuto", "a cuanto cotiza", "a cuanto opera", "como ver", "donde ver",
                    "en que canal", "por donde pasan", "dia hora", "dia, hora", "horario y tv", "tv y streaming",
                    "que se sabe", "cuanto cobra", "cuanto gana"]

_stem = snowballstemmer.stemmer("spanish")
_superficie = defaultdict(Counter)  # raíz -> formas originales, para nombrar los términos


def tokens(texto):
    palabras = [w for w in normalizar(texto).split() if len(w) > 2 and not w.isdigit() and w not in STOPWORDS]
    raices = _stem.stemWords(palabras)
    for r, w in zip(raices, palabras):
        _superficie[r][w] += 1
    bigramas = [f"{a}_{b}" for a, b in zip(raices, raices[1:])]
    return raices + bigramas


def texto_nota(n):
    claves = [k for k in n.get("palabras_clave", []) if normalizar(k) not in CLAVES_GENERICAS]
    return " ".join([n["titulo"], n["titulo"], n.get("bajada", ""), " ".join(claves), " ".join(claves)])


def nombre_termino(t):
    partes = t.split("_")
    return " ".join(_superficie[p].most_common(1)[0][0] if _superficie[p] else p for p in partes)


class UnionFind:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, a):
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def union(self, a, b):
        self.p[self.find(a)] = self.find(b)


def componentes(indices, sim, tiempos, umbral):
    uf = UnionFind(len(indices))
    pos = {g: i for i, g in enumerate(indices)}
    sub = sim[indices][:, indices]
    filas, cols = np.nonzero(sub >= umbral)
    ventana = PARAMS["ventana_horas"] * 3600
    for a, b in zip(filas, cols):
        if a < b and abs(tiempos[indices[a]] - tiempos[indices[b]]) <= ventana:
            uf.union(a, b)
    grupos = defaultdict(list)
    for g in indices:
        grupos[uf.find(pos[g])].append(g)
    return list(grupos.values())


def agrupar(indices, sim, tiempos, umbral):
    salida = []
    for g in componentes(indices, sim, tiempos, umbral):
        if len(g) > PARAMS["max_grupo"] and umbral < 0.9:
            salida.extend(agrupar(g, sim, tiempos, umbral + PARAMS["umbral_paso"]))
        else:
            salida.append(g)
    return salida


def peso_jerarquia(n):
    p = n.get("home_mejor_pos")
    w = 0.0
    if p:
        w = 1.0 if p <= 3 else 0.7 if p <= 10 else 0.4 if p <= 25 else 0.15
    if n.get("edicion_impresa"):
        w = max(w, 0.8)
    return w


def puntuar(notas):
    diarios = {n["diario"] for n in notas}
    dias = {n["dia"] for n in notas}
    conv = (0.55 * min(len(diarios) / 6, 1) + 0.25 * min(len(dias) / 4, 1)
            + 0.20 * min(math.log1p(len(notas)) / math.log1p(15), 1))
    por_diario = defaultdict(float)
    for n in notas:
        por_diario[n["diario"]] = max(por_diario[n["diario"]], peso_jerarquia(n))
    jer = min(sum(por_diario.values()) / 4, 1)
    total = PARAMS["peso_convergencia"] * conv + PARAMS["peso_jerarquia"] * jer
    return round(100 * total), round(100 * conv), round(100 * jer)


def resumen_nota(n):
    return {k: n.get(k) for k in ("id", "diario", "titulo", "bajada", "url", "fecha", "edicion_impresa", "home_mejor_pos")}


def main():
    ahora = datetime.now(timezone.utc)
    hoy = ahora.astimezone(AR).date()
    todas = []
    for f in sorted(NOTAS.glob("*.json")):
        todas.extend(json.loads(f.read_text(encoding="utf-8")).values())
    for n in todas:
        n["_t"] = datetime.fromisoformat(n["fecha"]).timestamp()
        n["dia"] = datetime.fromisoformat(n["fecha"]).astimezone(AR).date().isoformat()

    # IDF sobre todo lo retenido (3 semanas): define qué es "habitual".
    vec = TfidfVectorizer(analyzer=tokens, sublinear_tf=True, min_df=2, max_df=0.25)
    vec.fit([texto_nota(n) for n in todas])

    desde = ahora - timedelta(days=7)
    semana = [n for n in todas if n["tema"] != "otros" and n["_t"] >= desde.timestamp()]
    X = vec.transform([texto_nota(n) for n in semana])
    sim = (X @ X.T).toarray()
    tiempos = [n["_t"] for n in semana]
    grupos = agrupar(list(range(len(semana))), sim, tiempos, PARAMS["umbral"])
    terminos = np.array(vec.get_feature_names_out())

    cfg_fuentes = yaml.safe_load((RAIZ / "config/fuentes.yaml").read_text(encoding="utf-8"))
    cfg_temas = yaml.safe_load((RAIZ / "config/temas.yaml").read_text(encoding="utf-8"))
    nombres_seccion = {k: t["nombre"] for k, t in cfg_temas["temas"].items()}

    temas = []
    for g in grupos:
        notas = [semana[i] for i in g]
        diarios = {n["diario"] for n in notas}
        if len(diarios) < PARAMS["min_diarios_tema"]:
            continue
        sub = sim[np.ix_(g, g)]
        def ajuste(n):
            a = 0.05 if n.get("bajada") else 0
            if coincidencias(normalizar(n["titulo"]), TITULOS_SERVICIO):
                a -= 1.0
            return a
        centralidad = sub.mean(axis=1) + np.array([ajuste(semana[i]) for i in g])
        rep = notas[int(np.argmax(centralidad))]
        centroide = np.asarray(X[g].mean(axis=0)).ravel()
        top = [nombre_termino(t) for t in terminos[np.argsort(centroide)[::-1][:8]] if centroide[vec.vocabulary_[t]] > 0]
        vistos, claves = set(), []
        for t in top:
            if not any(p in vistos for p in t.split()):
                claves.append(t)
                vistos.update(t.split())
            if len(claves) == 4:
                break
        seccion = Counter(n["tema"] for n in notas).most_common(1)[0][0]
        puntaje, conv, jer = puntuar(notas)
        dias = Counter(n["dia"] for n in notas)
        hoy_n = [n for n in notas if n["dia"] == hoy.isoformat()]
        notas.sort(key=lambda n: (-(peso_jerarquia(n)), n["_t"]))
        temas.append({
            "id": hashlib.sha1(min(n["id"] for n in notas).encode()).hexdigest()[:10],
            "titulo": rep["titulo"],
            "terminos": claves,
            "seccion": seccion,
            "seccion_nombre": nombres_seccion.get(seccion, seccion),
            "puntaje": puntaje, "convergencia": conv, "jerarquia": jer,
            "diarios": sorted(diarios),
            "n_notas": len(notas),
            "n_tapas_home": sum(1 for d in diarios if any(peso_jerarquia(n) >= 0.7 for n in notas if n["diario"] == d)),
            "dias": dict(sorted(dias.items())),
            "en_seguimiento": len(dias) >= 3 and bool(hoy_n),
            "activo_hoy": bool(hoy_n),
            "puntaje_hoy": puntuar(hoy_n)[0] if len({n["diario"] for n in hoy_n}) >= 2 else 0,
            "ultima": max(n["fecha"] for n in notas),
            "notas": [resumen_nota(n) for n in notas],
        })
    temas.sort(key=lambda t: -t["puntaje"])

    # Propuesta de la semana: hasta 2 por sección, completando hasta 12 con los de mayor puntaje.
    propuestos, por_sec = [], Counter()
    for t in temas:
        if por_sec[t["seccion"]] < PARAMS["propuestos_por_seccion"]:
            propuestos.append(t["id"])
            por_sec[t["seccion"]] += 1
    for t in temas:
        if len(propuestos) >= PARAMS["total_propuestos"]:
            break
        if t["id"] not in propuestos:
            propuestos.append(t["id"])
    propuestos = propuestos[:PARAMS["total_propuestos"]]

    hoy_ids = [t["id"] for t in sorted((t for t in temas if t["puntaje_hoy"]), key=lambda t: -t["puntaje_hoy"])]

    # Afecta tu día: últimas 36 h, palabra de afectación + ámbito AMBA/servicio.
    limite = ahora - timedelta(hours=36)
    afecta, vistos_t = [], set()
    id_tema = {n["id"]: t["id"] for t in temas for n in t["notas"]}
    for n in sorted(todas, key=lambda n: -n["_t"]):
        if n["_t"] < limite.timestamp():
            break
        txt = normalizar(n["titulo"] + " " + n.get("bajada", ""))
        a, b = coincidencias(txt, AFECTA), coincidencias(txt, AMBITO)
        if not (a and b):
            continue
        if n["tema"] in ("internacionales", "otros") and not coincidencias(txt, ["amba", "caba", "conurbano", "subte", "colectivos", "trenes"]):
            continue
        tid = id_tema.get(n["id"])
        if tid and tid in vistos_t:
            continue
        if tid:
            vistos_t.add(tid)
        manana = bool(coincidencias(txt, ["manana", "este " + ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"][(hoy.weekday() + 1) % 7]]))
        afecta.append({"nota": resumen_nota(n), "tema_id": tid, "cuando": "mañana" if manana else "hoy",
                       "motivo": sorted(set(a))[:2] + sorted(set(b))[:2]})
        if len(afecta) >= 8:
            break

    diarios = {k: {"nombre": d["nombre"], "home": d["home"], "impreso": d.get("impreso", False),
                   "activo": d.get("activo", True)} for k, d in cfg_fuentes["diarios"].items()}
    resultado = {
        "generado": ahora.isoformat(timespec="seconds"),
        "semana": {"desde": (hoy - timedelta(days=6)).isoformat(), "hasta": hoy.isoformat(),
                   "propuestos": propuestos, "criterio": "C · 60% convergencia + 40% jerarquía"},
        "hoy": {"fecha": hoy.isoformat(), "temas": hoy_ids},
        "afecta": afecta,
        "temas": temas,
        "secciones": nombres_seccion,
        "diarios": diarios,
        "parametros": PARAMS,
        "estadisticas": {"notas_semana": len(semana), "grupos": len(grupos), "temas": len(temas)},
    }
    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / "actual.json").write_text(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    busqueda = [{"i": n["id"], "d": n["diario"], "t": n["titulo"], "u": n["url"], "f": n["fecha"][:16], "s": n["tema"]}
                for n in sorted(semana, key=lambda n: -n["_t"])]
    (SALIDA / "notas_semana.json").write_text(json.dumps(busqueda, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(resultado["estadisticas"], ensure_ascii=False), "propuestos:", len(propuestos), "hoy:", len(hoy_ids), "afecta:", len(afecta))


if __name__ == "__main__":
    main()
