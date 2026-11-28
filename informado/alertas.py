"""Alertas meteorológicas oficiales del SMN para el AMBA (decisión de Nico del 27/11).

Reemplaza la señal que se leía en los títulos de los diarios («Alerta en el AMBA» solo si el título
lo decía). Lee el feed CAP del Servicio Meteorológico Nacional, registrado en la OMM:
https://ssl.smn.gob.ar/CAP/AR.php

El formato CAP 1.2 es un estándar: el feed es un índice (RSS o Atom) que enlaza a un archivo por
alerta, o trae las alertas adentro. De cada alerta se toma el fenómeno, el nivel (amarilla, naranja,
roja, según la severidad CAP), la vigencia y las zonas. El SMN manda las zonas como polígonos sin
nombre: se prueba si contienen puntos de referencia del AMBA. Entra si alguna zona es del AMBA y si está vigente ahora o empieza
en las próximas 36 horas.

Si el SMN falla, se guarda el error y la app vuelve a la señal de los diarios. Para revisar qué
nombres de zona usa el SMN, el archivo guarda una muestra en «zonas_vistas».

Salida: datos/alertas_smn.json. Uso: python -m informado.alertas
"""
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .texto import coincidencias, normalizar

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "datos" / "alertas_smn.json"
FEED = "https://ssl.smn.gob.ar/CAP/AR.php"
PAGINA = "https://www.smn.gob.ar/alertas"
UA = "InformadoBot/0.1 (+https://github.com/nicoceijas/informado)"
MAX_ALERTAS = 60

# Ciudad de Buenos Aires y partidos del AMBA, como palabras completas sobre el nombre de la zona.
# Nombres que no se repiten en otras provincias:
ZONAS_AMBA = ["ciudad autonoma de buenos aires", "ciudad de buenos aires", "capital federal", "caba",
              "area metropolitana", "amba", "gran buenos aires", "conurbano", "la matanza", "lanus",
              "lomas de zamora", "florencio varela", "berazategui", "esteban echeverria", "hurlingham",
              "jose c paz", "moron", "vicente lopez", "la plata", "berisso", "ensenada", "canuelas",
              "ezeiza", "tres de febrero", "quilmes", "zona baja de tigre", "zona baja de san fernando"]
# Nombres que también son departamentos o ciudades de otras provincias (San Fernando en Chaco,
# Ituzaingó en Corrientes, Moreno en Santiago del Estero...): cuentan solo si la zona dice «Buenos Aires».
ZONAS_AMBA_AMBIGUAS = ["almirante brown", "avellaneda", "general san martin", "ituzaingo", "malvinas argentinas",
                       "merlo", "moreno", "san fernando", "san isidro", "san miguel", "tigre", "escobar",
                       "pilar", "presidente peron", "san vicente", "marcos paz", "general rodriguez"]


# El SMN no nombra las zonas (areaDesc viene vacío): manda polígonos. Se prueba si alguno contiene
# estos puntos del AMBA (latitud, longitud).
PUNTOS_AMBA = {"Ciudad de Buenos Aires": (-34.6037, -58.3816), "zona norte (Tigre)": (-34.4260, -58.5797),
               "zona norte (San Isidro)": (-34.4708, -58.5286), "zona oeste (Morón)": (-34.6534, -58.6198),
               "zona oeste (La Matanza)": (-34.7700, -58.6250), "zona oeste (Pilar)": (-34.4587, -58.9142),
               "zona sur (Quilmes)": (-34.7203, -58.2546), "zona sur (Lomas de Zamora)": (-34.7609, -58.4064),
               "La Plata": (-34.9214, -57.9545)}


def dentro(punto, poligono):
    """Punto en polígono (rayos). `poligono` es una lista de (latitud, longitud)."""
    y, x = punto
    adentro = False
    for (y1, x1), (y2, x2) in zip(poligono, poligono[1:] + poligono[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            adentro = not adentro
    return adentro


def zonas_por_poligono(texto_poligono):
    try:
        pol = [tuple(float(v) for v in par.split(",")) for par in texto_poligono.split()]
    except ValueError:
        return []
    if len(pol) < 3:
        return []
    return [nombre for nombre, punto in PUNTOS_AMBA.items() if dentro(punto, pol)]


def es_amba(zona):
    z = normalizar(zona)
    if coincidencias(z, ZONAS_AMBA):
        return True
    return bool(coincidencias(z, ZONAS_AMBA_AMBIGUAS)) and "buenos aires" in z


NIVELES = [("roja", ["roja", "rojo", "extreme"]), ("naranja", ["naranja", "severe"]),
           ("amarilla", ["amarilla", "amarillo", "moderate"])]


def bajar(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(3_000_000)


def local(tag):
    return tag.rsplit("}", 1)[-1]


def hijos(el, nombre):
    return [c for c in el if local(c.tag) == nombre]


def texto(el, nombre):
    for c in el:
        if local(c.tag) == nombre:
            return (c.text or "").strip()
    return ""


def fecha(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def enlaces_del_indice(raiz):
    """Enlaces a cada alerta en un índice RSS o Atom."""
    out = []
    for el in raiz.iter():
        nombre = local(el.tag)
        if nombre == "link":
            href = el.get("href") or (el.text or "").strip()
            if href and href.startswith("http") and href not in out:
                out.append(href)
    return out


def leer_cap(raiz):
    """Una alerta CAP → lista de avisos (uno por bloque <info> en castellano)."""
    infos = [i for i in hijos(raiz, "info")]
    es = [i for i in infos if texto(i, "language").lower().startswith("es")] or infos
    out = []
    for info in es:
        params = " ".join(f"{texto(p, 'valueName')} {texto(p, 'value')}" for p in hijos(info, "parameter"))
        evento, titular = texto(info, "event"), texto(info, "headline")
        bolsa = normalizar(" ".join([evento, titular, params, texto(info, "severity")]))
        nivel = next((n for n, pal in NIVELES if coincidencias(bolsa, pal)), None)
        zonas, amba = [], []
        for a in hijos(info, "area"):
            if texto(a, "areaDesc"):
                zonas.append(texto(a, "areaDesc"))
            for pol in hijos(a, "polygon"):
                amba += [z for z in zonas_por_poligono(pol.text or "") if z not in amba]
        out.append({"evento": evento, "titular": titular, "nivel": nivel,
                    "desde": texto(info, "onset") or texto(info, "effective") or texto(raiz, "sent"),
                    "hasta": texto(info, "expires"), "zonas": zonas, "amba_poligono": amba})
    return out


def main():
    ahora = datetime.now(timezone.utc)
    datos = {"actualizado": ahora.isoformat(timespec="seconds"), "fuente": "SMN", "url": PAGINA,
             "ok": False, "amba": [], "zonas_vistas": []}
    try:
        crudo = bajar(FEED)
        raiz = ET.fromstring(crudo)
        avisos, muestra = [], {"indice": crudo[:1500].decode("utf-8", "ignore")}
        if local(raiz.tag) == "alert":
            avisos += leer_cap(raiz)
        else:
            alertas_dentro = [el for el in raiz.iter() if local(el.tag) == "alert"]
            for a in alertas_dentro:
                avisos += leer_cap(a)
            if not alertas_dentro:
                for url in [u for u in enlaces_del_indice(raiz) if u != FEED][:MAX_ALERTAS]:
                    try:
                        sub_crudo = bajar(url)
                        sub = ET.fromstring(sub_crudo)
                    except (OSError, ET.ParseError):
                        continue
                    if local(sub.tag) == "alert":
                        muestra.setdefault("alerta", sub_crudo[:6000].decode("utf-8", "ignore"))
                        avisos += leer_cap(sub)
        vistas = []
        for av in avisos:
            for z in av["zonas"]:
                if z not in vistas:
                    vistas.append(z)
            hasta, desde = fecha(av["hasta"]), fecha(av["desde"])
            if hasta and hasta < ahora:
                continue
            if desde and desde > ahora + timedelta(hours=36):
                continue
            amba = [z for z in av["zonas"] if es_amba(z)] + av.pop("amba_poligono", [])
            if amba:
                datos["amba"].append({**av, "zonas": amba})
        # El SMN parte una misma alerta en varios archivos (un polígono cada uno): se juntan.
        juntas = {}
        for a in datos["amba"]:
            k = (a["evento"], a["nivel"])
            if k in juntas:
                juntas[k]["zonas"] += [z for z in a["zonas"] if z not in juntas[k]["zonas"]]
                juntas[k]["hasta"] = max(juntas[k]["hasta"] or "", a["hasta"] or "")
            else:
                juntas[k] = a
        datos["amba"] = list(juntas.values())
        orden = {"roja": 0, "naranja": 1, "amarilla": 2, None: 3}
        datos["amba"].sort(key=lambda a: (orden.get(a["nivel"], 3), a["desde"] or ""))
        datos["zonas_vistas"] = vistas[:80]
        datos["avisos_leidos"] = len(avisos)
        if not vistas and not avisos:  # el feed no trajo alertas legibles: muestra para revisar el formato
            datos["muestra"] = muestra
        datos["ok"] = True
    except (OSError, ET.ParseError, ValueError) as e:
        datos["error"] = f"{type(e).__name__}: {e}"[:200]
    SALIDA.parent.mkdir(exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in datos.items() if k != "zonas_vistas"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
