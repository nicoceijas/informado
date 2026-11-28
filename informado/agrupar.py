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
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import snowballstemmer
import yaml
from sklearn.feature_extraction.text import TfidfVectorizer

from .historias import PARAMS_HISTORIAS, armar_historias, propuesta
from .stopwords import CLAVES_GENERICAS, STOPWORDS
from .fechas import estado_por_fecha, fechas_en
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
    # Poda de notas encadenadas (25/11): en grupos chicos, sale la nota que no comparte nada con
    # algún integrante (similitud < poda_cero) y cuyo único lazo es débil (< umbral + poda_margen).
    "poda_max_grupo": 6,
    "poda_cero": 0.01,
    "poda_margen": 0.05,
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
                    "que se sabe", "cuanto cobra", "cuanto gana",
                    # Clickbait (decisión de Nico del 27/11): el título esconde el dato para que entres.
                    "a que hora juega", "a que hora juegan", "a que hora es", "enterate", "lo que tenes que saber",
                    "lo que hay que saber", "todo lo que tenes que saber", "que zonas", "que municipios",
                    "uno por uno", "mira el video", "el video de", "las fotos de", "como ver"]

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


def podar(g, sim):
    """Saca las notas que entraron a un grupo chico por un solo lazo débil (encadenamiento).
    Ej.: «La política argentina ante la inteligencia artificial» se unía a «Tether invierte en Lemon…
    y la apuesta por la inteligencia artificial» y, por esa nota, a las demás de Lemon."""
    g, fuera = list(g), []
    while 3 <= len(g) <= PARAMS["poda_max_grupo"]:
        sub = sim[np.ix_(g, g)]
        otros = [np.delete(sub[k], k) for k in range(len(g))]
        cand = [k for k in range(len(g)) if (otros[k] < PARAMS["poda_cero"]).any()]
        if not cand:
            break
        k = min(cand, key=lambda k: otros[k].max())
        if otros[k].max() >= PARAMS["umbral"] + PARAMS["poda_margen"]:
            break
        fuera.append(g.pop(k))
    return g, fuera


def agrupar(indices, sim, tiempos, umbral):
    salida = []
    for g in componentes(indices, sim, tiempos, umbral):
        if len(g) > PARAMS["max_grupo"] and umbral < 0.9:
            salida.extend(agrupar(g, sim, tiempos, umbral + PARAMS["umbral_paso"]))
        else:
            queda, fuera = podar(g, sim)
            salida.append(queda)
            salida.extend([i] for i in fuera)
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


def categoria_servicio(titulo, categorias):
    """Categoría de servicio de una nota (dolar, clima, cotizaciones, pagos…) o None."""
    t = normalizar(titulo)
    for cat, patrones in categorias.items():
        if coincidencias(t, patrones):
            return cat
    return None


# «Tu día»: paros y transporte agrupados por asunto, con un estado.
GREMIOS = {"uta": "UTA", "ate": "ATE", "la fraternidad": "La Fraternidad", "cgt": "CGT", "cta": "CTA",
           "uom": "UOM", "camioneros": "Camioneros", "bancarios": "Bancarios", "la bancaria": "La Bancaria",
           "aeronavegantes": "Aeronavegantes", "apla": "APLA", "ctera": "CTERA", "suteba": "SUTEBA", "ute": "UTE",
           "metrodelegados": "Metrodelegados", "conadu": "CONADU", "fedun": "FEDUN", "utedyc": "UTEDYC",
           "gremios universitarios": "Gremios universitarios", "docentes universitarios": "Docentes universitarios",
           "docentes": "Docentes", "medicos": "Médicos", "residentes": "Residentes", "enfermeros": "Enfermeros"}
# «Antes de salir» (decisión de Nico del 27/11): solo lo que afecta el tránsito o el transporte de
# pasajeros. Un paro entra si toca el transporte (p. ej. ATE en los aeropuertos); los demás no.
SERVICIOS = {"colectivos": "colectivos", "colectivo": "colectivos", "trenes": "trenes", "tren": "trenes",
             "subte": "subte", "subtes": "subte", "premetro": "subte", "vuelos": "vuelos", "aeroparque": "vuelos",
             "ezeiza": "vuelos", "aeropuerto": "vuelos", "aeropuertos": "vuelos", "aerolineas": "vuelos",
             "controladores aereos": "vuelos", "autopista": "tránsito", "autopistas": "tránsito", "panamericana": "tránsito",
             "general paz": "tránsito", "riccheri": "tránsito", "accesos": "tránsito", "acceso oeste": "tránsito",
             "puente": "tránsito", "peajes": "tránsito", "transito": "tránsito", "calles": "tránsito",
             "avenida": "tránsito", "9 de julio": "tránsito", "taxis": "taxis", "transporte": "transporte"}
AFECTA_TRANSITO = ["paro", "paros", "huelga", "medida de fuerza", "asamblea", "cortes", "corte", "corte total",
                   "corte parcial", "cortaran", "cerraran", "cierre", "cierres", "desvio", "desvios",
                   "interrupcion", "sin servicio", "servicio reducido", "piquete", "demoras",
                   "cancelaciones", "cancelados", "funcionan con normalidad", "funciona con normalidad"]
# Los cortes de calles y rutas cuentan solo en el AMBA; los paros de colectivos, trenes, subte o vuelos, siempre.
TRANSITO_LOCAL = {"autopista", "autopistas", "puente", "peajes", "transito", "calles", "avenida", "accesos"}
MARCAS_AMBA = ["caba", "amba", "conurbano", "ciudad de buenos aires", "porteno", "portenos", "gran buenos aires",
               "lugones", "dellepiane", "25 de mayo", "perito moreno", "illia", "riccheri", "general paz",
               "panamericana", "acceso oeste", "acceso norte", "acceso sur", "buen ayre", "9 de julio",
               "puente pueyrredon", "la plata", "constitucion", "retiro", "once"]
# Una marcha corta el tránsito si dice adónde va.
MARCHA = ["marcha", "movilizacion", "manifestacion", "protesta"]
LUGARES_MARCHA = ["congreso", "plaza de mayo", "obelisco", "puente pueyrredon", "9 de julio", "casa rosada"]
NO_AFECTA = ["marcha atras", "puesta en marcha", "en marcha", "pone en marcha", "poner en marcha",
             "convenio colectivo", "convenios colectivos", "capacidad de movilizacion"]
SIN_PARO = ["acuerdo salarial", "cerro un acuerdo", "hubo acuerdo", "acordo", "acordaron", "se levanto",
            "levantaron", "levanto el paro", "se diluyo", "suspendio el paro", "suspendieron el paro",
            "suspenden el paro", "desactivo", "desactivaron", "no habra paro", "conciliacion obligatoria",
            "funciona con normalidad", "funcionan con normalidad"]
SIGUE_PARO = ["sin acuerdo", "no hubo acuerdo", "fracaso", "fracaso la negociacion", "rechazo", "rechazaron"]
CLIMA = ["tormenta", "tormentas", "lluvia", "lluvias", "calor", "temperatura", "temperaturas", "alerta amarilla",
         "alerta naranja", "alerta roja", "vientos", "granizo", "clima", "tiempo"]
DIAS_SEMANA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


def estado_aviso(notas, ahora, hoy):
    """(estado, fecha) de un aviso de «Antes de salir», o (None, None) si no sirve (decisión de Nico del
    27/11): solo vale si el hecho es hoy o próximamente. `notas` va de la más nueva a la más vieja."""
    reciente = notas[0]["_t"] >= (ahora - timedelta(hours=36)).timestamp()
    ult = normalizar(notas[0]["titulo"] + " " + notas[0].get("bajada", ""))
    if coincidencias(ult, SIN_PARO) and not coincidencias(ult, SIGUE_PARO):
        return ("Sin paro", hoy) if reciente else (None, None)
    rangos = []
    for n in notas:
        publicada = datetime.fromisoformat(n["fecha"]).astimezone(AR).date()
        rangos += fechas_en(normalizar(n["titulo"] + " " + n.get("bajada", "")), publicada)
    if rangos:
        return estado_por_fecha(rangos, hoy)
    return ("Sin fecha", None) if reciente else (None, None)


def armar_tu_dia(todas, ahora, hoy, id_tema, temas_por_id=None):
    """Bloque «Tu día»: clima y dólar del día (notas de servicio) y paros/transporte por asunto."""
    recientes = sorted((n for n in todas if n["_t"] >= (ahora - timedelta(hours=36)).timestamp()), key=lambda n: -n["_t"])
    # Los avisos miran 7 días: una nota del martes puede anunciar un corte para el sábado. La fecha decide.
    semana_avisos = sorted((n for n in todas if n["_t"] >= (ahora - timedelta(days=7)).timestamp()), key=lambda n: -n["_t"])

    def una_por_diario(notas, maximo):
        vistos, out = set(), []
        for n in notas:
            if n["diario"] not in vistos:
                vistos.add(n["diario"])
                out.append(resumen_nota(n))
            if len(out) >= maximo:
                break
        return out

    corte_dia = (ahora - timedelta(hours=20)).timestamp()
    clima = una_por_diario([n for n in recientes if n["_servicio"] == "clima" and n["_t"] >= corte_dia], 5)
    alerta_amba = any(coincidencias(normalizar(n["titulo"]), ["alerta", "alertas"]) and
                      coincidencias(normalizar(n["titulo"]), ["amba", "caba", "ciudad de buenos aires", "conurbano", "buenos aires"])
                      and not coincidencias(normalizar(n["titulo"]), ["resto del pais"])
                      for n in clima)
    dolar = una_por_diario([n for n in recientes if n["_servicio"] == "dolar" and n["_t"] >= corte_dia], 4)

    grupos = {}
    for n in semana_avisos:
        if n["_servicio"]:
            continue
        txt = normalizar(n["titulo"] + " " + n.get("bajada", ""))
        if coincidencias(normalizar(n["titulo"]), CLIMA):
            continue
        txt_sin = txt
        for x in NO_AFECTA:
            txt_sin = txt_sin.replace(x, " ")
        servs = set(coincidencias(txt_sin, list(SERVICIOS)))
        if servs and servs <= TRANSITO_LOCAL and n["tema"] != "ciudad" and not coincidencias(txt_sin, MARCAS_AMBA):
            servs = set()
        # Al menos una de las dos señales tiene que estar en el título (la bajada sola da falsos positivos).
        tit = normalizar(n["titulo"])
        for x in NO_AFECTA:
            tit = tit.replace(x, " ")
        transporte = servs and coincidencias(txt_sin, AFECTA_TRANSITO) and (
            coincidencias(tit, list(servs)) or coincidencias(tit, AFECTA_TRANSITO))
        marcha = coincidencias(tit, MARCHA) and coincidencias(tit, LUGARES_MARCHA)
        if not (transporte or marcha):
            continue
        if n["tema"] in ("internacionales", "otros") and not coincidencias(txt, ["amba", "caba", "conurbano", "subte", "colectivos", "trenes"]):
            continue
        gremio = next((GREMIOS[g] for g in GREMIOS if coincidencias(txt, [g])), None)
        servicio = next((SERVICIOS[x] for x in SERVICIOS if coincidencias(txt, [x])), None) or ("tránsito" if marcha else None)
        clave = id_tema.get(n["id"]) or f"{gremio}|{servicio}"
        g = grupos.setdefault(clave, {"gremio": gremio, "servicio": servicio, "notas": []})
        g["gremio"] = g["gremio"] or gremio
        g["servicio"] = g["servicio"] or servicio
        g["notas"].append(n)
    paros = []
    for g in grupos.values():
        ult = g["notas"][0]
        quien = " · ".join(x for x in (g["gremio"], g["servicio"]) if x) or "Servicios"
        tid = next((id_tema[n["id"]] for n in g["notas"] if n["id"] in id_tema), None)
        notas = g["notas"]
        if tid and temas_por_id and tid in temas_por_id:  # si el asunto es un tema, sus notas completas
            notas = sorted(temas_por_id[tid]["notas"], key=lambda n: n["fecha"], reverse=True)
        estado, cuando = estado_aviso(g["notas"], ahora, hoy)
        if not estado:
            continue
        paros.append({"quien": quien, "estado": estado, "fecha": cuando.isoformat() if cuando else None,
                      "tema_id": tid, "notas": una_por_diario(notas, 6)})
    orden = {"Hoy": 0, "Mañana": 1, "Sin paro": 2, "Sin fecha": 4}
    paros.sort(key=lambda p: (orden.get(p["estado"], 3), p["fecha"] or "", -len(p["notas"])))
    return {"clima": {"alerta_amba": alerta_amba, "notas": clima},
            "dolar": {"notas": dolar},
            "paros": paros[:6]}


def clave_nota(n, patrones_id):
    """Identifica la nota más allá de la URL exacta: sin «www», sin barra final y, si el diario
    pone un id propio en la URL (config: id_en_url), por ese id aunque cambie el resto."""
    p = urlparse(n["url"])
    patron = patrones_id.get(n["diario"])
    if patron:
        m = re.search(patron, p.path)
        if m:
            return n["diario"], "id:" + m.group(1)
    return n["diario"], p.netloc.lower().removeprefix("www.") + p.path.rstrip("/")


def deduplicar(notas, cfg_fuentes):
    """Una sola versión de cada nota: la que se vio por última vez (título vigente).
    Los archivos de datos no se tocan; esto rige para los temas y la búsqueda."""
    patrones = {k: d["id_en_url"] for k, d in cfg_fuentes["diarios"].items() if d.get("id_en_url")}
    elegidas = {}
    for n in notas:
        k = clave_nota(n, patrones)
        actual = elegidas.get(k)
        if actual is None or (n.get("visto_ultimo", ""), n["fecha"]) > (actual.get("visto_ultimo", ""), actual["fecha"]):
            elegidas[k] = n
    return list(elegidas.values())


def main():
    ahora = datetime.now(timezone.utc)
    hoy = ahora.astimezone(AR).date()
    todas = []
    for f in sorted(NOTAS.glob("*.json")):
        todas.extend(json.loads(f.read_text(encoding="utf-8")).values())
    cfg_fuentes = yaml.safe_load((RAIZ / "config/fuentes.yaml").read_text(encoding="utf-8"))
    todas = deduplicar(todas, cfg_fuentes)
    for n in todas:
        n["_t"] = datetime.fromisoformat(n["fecha"]).timestamp()
        n["dia"] = datetime.fromisoformat(n["fecha"]).astimezone(AR).date().isoformat()
    servicio = cfg_fuentes.get("servicio_sin_tema", {}) or {}
    for n in todas:
        n["_servicio"] = categoria_servicio(n["titulo"], servicio)

    # IDF sobre todo lo retenido (3 semanas): define qué es "habitual".
    vec = TfidfVectorizer(analyzer=tokens, sublinear_tf=True, min_df=2, max_df=0.25)
    vec.fit([texto_nota(n) for n in todas])

    desde = ahora - timedelta(days=7)
    semana_todas = [n for n in todas if n["tema"] != "otros" and n["_t"] >= desde.timestamp()]
    # Las notas de servicio (cotización del día, pronóstico) no forman temas; siguen en la búsqueda
    # y en «Afecta tu día».
    semana = [n for n in semana_todas if not n["_servicio"]]
    X = vec.transform([texto_nota(n) for n in semana])
    sim = (X @ X.T).toarray()
    tiempos = [n["_t"] for n in semana]
    grupos = agrupar(list(range(len(semana))), sim, tiempos, PARAMS["umbral"])
    terminos = np.array(vec.get_feature_names_out())

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
            # Pesa la nota de tapa (decisión de Nico del 27/11); la repercusión entre diarios ya la mide
            # la centralidad (cuánto se parece a la última nota de los demás diarios).
            a = (0.05 if n.get("bajada") else 0) + 0.15 * peso_jerarquia(n)
            if coincidencias(normalizar(n["titulo"]), TITULOS_SERVICIO):
                a -= 1.0
            return a
        # Nombre del tema: la última nota de cada diario, y de esas la que más se parece a las demás.
        # Así el título sigue lo que cuenta ahora la mayoría (p. ej. «entró en recesión» después del
        # dato, no la nota previa «confirmará si…»). Aprobado por Nico el 25/11.
        ultima = {}
        for k in range(len(g)):
            d = semana[g[k]]["diario"]
            if d not in ultima or semana[g[k]]["_t"] > semana[g[ultima[d]]]["_t"]:
                ultima[d] = k
        cand = list(ultima.values())
        centralidad = sub[np.ix_(cand, cand)].mean(axis=1) + np.array([ajuste(semana[g[k]]) for k in cand])
        rep = notas[cand[int(np.argmax(centralidad))]]
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

    tu_dia = armar_tu_dia(todas, ahora, hoy, id_tema, {t["id"]: t for t in temas})

    # Historias de 7 días (pantalla «Temas»): temas de la misma sección que hablan de lo mismo.
    historias = armar_historias(temas, hoy, tokens, [n["titulo"] for n in semana_todas])
    propuestas, afuera = propuesta(historias)                      # por impacto (por defecto)
    propuestas_cuota, afuera_cuota = propuesta(historias, cuota=True)  # variedad: hasta 2 por sección
    hoy_historias = [h["id"] for h in sorted((h for h in historias if h["hoy"]), key=lambda h: (-h["hoy"], h["puesto"]))]

    diarios = {k: {"nombre": d["nombre"], "home": d["home"], "impreso": d.get("impreso", False),
                   "activo": d.get("activo", True)} for k, d in cfg_fuentes["diarios"].items()}
    resultado = {
        "generado": ahora.isoformat(timespec="seconds"),
        "semana": {"desde": (hoy - timedelta(days=6)).isoformat(), "hasta": hoy.isoformat(),
                   "propuestos": propuestas, "afuera": afuera, "propuestos_temas": propuestos,
                   "propuestos_cuota": propuestas_cuota, "afuera_cuota": afuera_cuota,
                   "criterio": "C · 60% convergencia + 40% jerarquía"},
        "hoy": {"fecha": hoy.isoformat(), "temas": hoy_ids, "historias": hoy_historias},
        "afecta": afecta,
        "tu_dia": tu_dia,
        "historias": historias,
        "temas": temas,
        "secciones": nombres_seccion,
        "diarios": diarios,
        "parametros": {**PARAMS, "historias": PARAMS_HISTORIAS},
        "estadisticas": {"notas_semana": len(semana), "grupos": len(grupos), "temas": len(temas), "historias": len(historias)},
    }
    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / "actual.json").write_text(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    busqueda = [{"i": n["id"], "d": n["diario"], "t": n["titulo"], "u": n["url"], "f": n["fecha"][:16], "s": n["tema"]}
                for n in sorted(semana_todas, key=lambda n: -n["_t"])]
    (SALIDA / "notas_semana.json").write_text(json.dumps(busqueda, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(resultado["estadisticas"], ensure_ascii=False), "propuestos:", len(propuestos), "hoy:", len(hoy_ids), "afecta:", len(afecta))


if __name__ == "__main__":
    main()
