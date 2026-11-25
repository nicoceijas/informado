"""Historias de la semana: une los temas que hablan de lo mismo a lo largo de 7 días.

Un tema (agrupar.py) junta notas publicadas con menos de 72 h de diferencia; una historia junta
temas de la misma sección que se parecen entre sí, para seguir un asunto toda la semana.
Aprobado por Nico el 25/11 (maqueta final).

- Unión automática: similitud TF-IDF entre temas de la misma sección por encima de
  PARAMS_HISTORIAS["umbral"]. En fútbol no se une solo (se mezclaba todo).
- El usuario puede unir más a mano desde la app (se guarda en su celular).
- Rótulo automático con las palabras más distintivas de los títulos, tal como aparecen escritas.
- Feed: por día (de lo más nuevo a lo más viejo); cada día, un evento por tema con una nota por diario.
"""
import math
import re
from collections import Counter
from datetime import datetime, timedelta, timezone

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from .stopwords import STOPWORDS
from .texto import normalizar

AR = timezone(timedelta(hours=-3))
PARAMS_HISTORIAS = {
    "umbral": 0.17,                  # similitud mínima entre dos temas para unirlos en una historia
    "secciones_sin_union": ["futbol"],
    "bono_por_tema": 4,              # puntaje extra por cada tema unido (logarítmico)
    "propuestas": 12,
    "afuera": 12,
    "por_seccion": 2,
}

# Palabras que no sirven para el rótulo (además de las palabras vacías).
NO_ROTULO = {normalizar(w) for w in [
    "hoy", "vivo", "dijo", "tras", "como", "que", "cual", "quien", "sobre", "segun", "ahora", "nuevo", "nueva",
    "años", "dia", "dias", "semana", "esta", "este", "todo", "todos", "video", "asi", "donde", "cuando", "gran",
    "puede", "hace", "frente", "contra", "entre", "desde", "hasta", "despues", "antes", "millones", "partido",
    "fue", "son", "era", "ser", "cuanto", "minuto", "vs", "noviembre", "diciembre", "enero", "lunes", "martes",
    "miercoles", "jueves", "viernes", "sabado", "domingo", "gobierno", "milei", "argentina", "argentino",
    "argentinos", "presidente", "dos", "tres", "mas", "menos", "muy", "sus", "les", "ante", "bajo", "cada"]}
PALABRA = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+")


VERBO = re.compile(r"(ó|aron|ieron|aba|aban|ía|ían|ará|erá|irá)$")


def _no_sirve(w):
    n = normalizar(w)
    if n in STOPWORDS or n in NO_ROTULO or len(n) < 3 or n.isdigit():
        return True
    # Verbos conjugados («entró», «acordaron», «murió»): ensucian el rótulo. Los nombres propios quedan.
    return w[0].islower() and bool(VERBO.search(w.lower()))


def _candidatos(titulo):
    ws = PALABRA.findall(titulo)
    out = set()
    for i, w in enumerate(ws):
        if not _no_sirve(w):
            out.add(w)
            if i + 1 < len(ws) and not _no_sirve(ws[i + 1]):
                out.add(w + " " + ws[i + 1])
    return out


def frecuencias_semana(titulos):
    """En cuántos títulos de la semana aparece cada palabra o par (para saber qué es habitual)."""
    df = Counter()
    for t in titulos:
        df.update({normalizar(c) for c in _candidatos(t)})
    return df, max(1, len(titulos))


def rotulo(titulos, df_semana, n_semana, k=3):
    """«Mario Santucho, UBA y homenaje»: las palabras más distintivas de la historia."""
    formas, df = {}, Counter()
    for t in titulos:
        vistos = set()
        for c in _candidatos(t):
            clave = normalizar(c)
            if clave in vistos:
                continue
            vistos.add(clave)
            df[clave] += 1
            formas.setdefault(clave, Counter())[c] += 1
    total = max(1, len(titulos))
    minimo = max(2, total * 0.12) if total > 2 else 1
    puntaje = {c: (v / total) * math.log(n_semana / (1 + df_semana.get(c, 0))) * (1.25 if " " in c else 1)
               for c, v in df.items() if v >= minimo}
    elegidos, usadas = [], set()
    for c in sorted(puntaje, key=lambda x: -puntaje[x]):
        if " " not in c:  # si hay un par que contiene la palabra y pesa parecido, va el par
            pares = [p for p in puntaje if " " in p and c in p.split() and puntaje[p] >= 0.5 * puntaje[c]]
            if pares:
                c = max(pares, key=lambda p: puntaje[p])
        ws = set(c.split())
        if ws & usadas:
            continue
        elegidos.append(c)
        usadas |= ws
        if len(elegidos) == k:
            break
    if not elegidos:
        return ""

    def escrita(c):  # la forma más usada; en minúscula si alguna vez aparece así (no es nombre propio)
        f = formas[c]
        minus = [x for x in f if x == x.lower()]
        return max(minus, key=f.get) if minus else max(f, key=f.get)

    palabras = [escrita(c) for c in elegidos]
    texto = palabras[0] if len(palabras) == 1 else ", ".join(palabras[:-1]) + " y " + palabras[-1]
    return texto[0].upper() + texto[1:]


def _dia(iso):
    return datetime.fromisoformat(iso).astimezone(AR).date().isoformat()


def unir_temas(temas, analizador, params=PARAMS_HISTORIAS):
    """Grupos de índices de temas que forman una misma historia."""
    if not temas:
        return []
    docs = [" ".join(n["titulo"] + " " + (n.get("bajada") or "") for n in t["notas"]) for t in temas]
    X = TfidfVectorizer(analyzer=analizador, sublinear_tf=True, max_df=0.2).fit_transform(docs)
    S = (X @ X.T).toarray()
    padre = list(range(len(temas)))

    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i

    for i in range(len(temas)):
        for j in range(i + 1, len(temas)):
            if (temas[i]["seccion"] == temas[j]["seccion"] and temas[i]["seccion"] not in params["secciones_sin_union"]
                    and S[i, j] > params["umbral"]):
                padre[raiz(i)] = raiz(j)
    grupos = {}
    for i in range(len(temas)):
        grupos.setdefault(raiz(i), []).append(i)
    return list(grupos.values())


def armar_historias(temas, hoy, analizador, titulos_semana, params=PARAMS_HISTORIAS):
    """Lista de historias ordenadas por puntaje, con su puesto (1 = la que más pesó en la semana)."""
    df_semana, n_semana = frecuencias_semana(titulos_semana)
    hoy_iso = hoy.isoformat()
    historias = []
    for grupo in unir_temas(temas, analizador, params):
        miembros = [temas[i] for i in grupo]
        # El id es el del tema que empezó primero: se mantiene aunque se sumen temas nuevos.
        ancla = min(miembros, key=lambda t: (min(n["fecha"] for n in t["notas"]), t["id"]))
        notas = {}
        for t in miembros:
            for n in t["notas"]:
                notas.setdefault(n["id"], (n, t["id"]))
        por_dia = {}
        for n, tid in notas.values():
            por_dia.setdefault(_dia(n["fecha"]), {}).setdefault(tid, []).append(n)
        feed = []
        for dia in sorted(por_dia, reverse=True):
            eventos = []
            for tid, ns in por_dia[dia].items():
                ns.sort(key=lambda n: n["fecha"], reverse=True)
                cabeza = min(ns, key=lambda n: (n.get("home_mejor_pos") or 99, -datetime.fromisoformat(n["fecha"]).timestamp()))
                vistos, una = set(), []
                for n in ns:
                    if n["diario"] not in vistos:
                        vistos.add(n["diario"])
                        una.append(n["id"])
                eventos.append({"tema": tid, "titulo": cabeza["titulo"], "fecha": ns[0]["fecha"], "notas": una})
            eventos.sort(key=lambda e: e["fecha"], reverse=True)
            feed.append({"dia": dia, "eventos": eventos})
        dias = Counter(_dia(n["fecha"]) for n, _ in notas.values())
        diarios = {n["diario"] for n, _ in notas.values()}
        historias.append({
            "id": ancla["id"],
            "temas": [t["id"] for t in sorted(miembros, key=lambda t: -t["puntaje"])],
            "seccion": ancla["seccion"],
            "seccion_nombre": ancla["seccion_nombre"],
            "titulo": rotulo([n["titulo"] for n, _ in notas.values()], df_semana, n_semana) or ancla["titulo"],
            "ultimo": feed[0]["eventos"][0]["titulo"],
            "n_diarios": len(diarios),
            "n_notas": len(notas),
            "n_dias": len(dias),
            "desde": min(dias),
            "dias": [dias.get((hoy - timedelta(days=k)).isoformat(), 0) for k in range(6, -1, -1)],
            "hoy": dias.get(hoy_iso, 0),
            "convergencia": max(t["convergencia"] for t in miembros),
            "jerarquia": max(t["jerarquia"] for t in miembros),
            "tapas": max(t.get("n_tapas_home", 0) for t in miembros),
            "puntaje": round(max(t["puntaje"] for t in miembros) + params["bono_por_tema"] * math.log(len(miembros)), 1),
            "feed": feed,
        })
    historias.sort(key=lambda h: (-h["puntaje"], -h["n_notas"]))
    for k, h in enumerate(historias, 1):
        h["puesto"] = k
    return historias


def propuesta(historias, params=PARAMS_HISTORIAS):
    """Tu semana (hasta 2 por sección, completando hasta 12 por puntaje) y las que quedaron afuera."""
    propuestas, por_sec = [], Counter()
    for h in historias:
        if por_sec[h["seccion"]] < params["por_seccion"]:
            propuestas.append(h["id"])
            por_sec[h["seccion"]] += 1
    for h in historias:
        if len(propuestas) >= params["propuestas"]:
            break
        if h["id"] not in propuestas:
            propuestas.append(h["id"])
    propuestas = propuestas[:params["propuestas"]]
    afuera = [h["id"] for h in historias if h["id"] not in propuestas][:params["afuera"]]
    return propuestas, afuera
