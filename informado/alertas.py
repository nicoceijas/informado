"""Alertas meteorológicas oficiales del SMN para el AMBA (decisión de Nico del 27/11).

Reemplaza la señal que se leía en los títulos de los diarios («Alerta en el AMBA» solo si el título
lo decía). Lee el feed CAP del Servicio Meteorológico Nacional, registrado en la OMM:
https://ssl.smn.gob.ar/CAP/AR.php

El formato CAP 1.2 es un estándar: el feed es un índice (RSS o Atom) que enlaza a un archivo por
alerta, o trae las alertas adentro. De cada alerta se toma el fenómeno, el nivel (amarilla, naranja,
roja), la vigencia y las zonas. Entra si alguna zona es del AMBA y si está vigente ahora o empieza
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
        zonas = [texto(a, "areaDesc") for a in hijos(info, "area") if texto(a, "areaDesc")]
        out.append({"evento": evento, "titular": titular, "nivel": nivel,
                    "desde": texto(info, "onset") or texto(info, "effective") or texto(raiz, "sent"),
                    "hasta": texto(info, "expires"), "zonas": zonas})
    return out


def main():
    ahora = datetime.now(timezone.utc)
    datos = {"actualizado": ahora.isoformat(timespec="seconds"), "fuente": "SMN", "url": PAGINA,
             "ok": False, "amba": [], "zonas_vistas": []}
    try:
        raiz = ET.fromstring(bajar(FEED))
        avisos = []
        if local(raiz.tag) == "alert":
            avisos += leer_cap(raiz)
        else:
            alertas_dentro = [el for el in raiz.iter() if local(el.tag) == "alert"]
            for a in alertas_dentro:
                avisos += leer_cap(a)
            if not alertas_dentro:
                for url in enlaces_del_indice(raiz)[:MAX_ALERTAS]:
                    try:
                        sub = ET.fromstring(bajar(url))
                    except (OSError, ET.ParseError):
                        continue
                    if local(sub.tag) == "alert":
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
            amba = [z for z in av["zonas"] if es_amba(z)]
            if amba:
                datos["amba"].append({**av, "zonas": amba})
        orden = {"roja": 0, "naranja": 1, "amarilla": 2, None: 3}
        datos["amba"].sort(key=lambda a: (orden.get(a["nivel"], 3), a["desde"] or ""))
        datos["zonas_vistas"] = vistas[:80]
        datos["avisos_leidos"] = len(avisos)
        datos["ok"] = True
    except (OSError, ET.ParseError, ValueError) as e:
        datos["error"] = f"{type(e).__name__}: {e}"[:200]
    SALIDA.parent.mkdir(exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in datos.items() if k != "zonas_vistas"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
