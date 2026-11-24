"""Recolector de Informado.

Baja los RSS y sitemaps de config/fuentes.yaml, normaliza cada nota y la guarda en
datos/notas/AAAA-MM-DD.json (fecha de publicación, hora argentina). Las notas ya vistas
se actualizan: si llegó primero por sitemap y después por RSS, se completa la bajada.

Nunca guarda el cuerpo de la nota: solo título, bajada recortada, fecha, sección y enlace.

Uso: python -m informado.recolectar
"""
import hashlib
import json
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import yaml

from .clasificar import Clasificador
from .texto import limpiar_html, recortar_palabras

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos"
NOTAS = DATOS / "notas"
AR = timezone(timedelta(hours=-3))
VENTANA_DIAS = 7       # no se guardan notas publicadas antes de esto
RETENCION_DIAS = 21    # archivos diarios más viejos se borran


def local(tag):
    return tag.rsplit("}", 1)[-1]


def hijo(el, *nombres):
    for c in el:
        if local(c.tag) in nombres:
            return c
    return None


def texto_de(el):
    return (el.text or "").strip() if el is not None else ""


def bajar(url, ua, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(8_000_000)


def parsear_fecha(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=AR)
    return d.astimezone(timezone.utc)


def url_canonica(url):
    p = urlparse(url.strip())
    return urlunparse((p.scheme or "https", p.netloc.lower(), p.path, "", "", ""))


def id_nota(url):
    return hashlib.sha1(url_canonica(url).encode()).hexdigest()[:12]


def seccion_de_url(url):
    partes = [p for p in urlparse(url).path.split("/") if p]
    if not partes:
        return ""
    s = partes[0].lower()
    # Tramos que no son sección: años (Página/12) o el slug de la nota (Ámbito, Popular).
    if re.fullmatch(r"\d{4}", s) or (len(partes) == 1) or (len(s) > 30 and re.search(r"\d", s)):
        return ""
    return s


def leer_rss(data):
    root = ET.fromstring(data)
    for it in root.iter():
        if local(it.tag) not in ("item", "entry"):
            continue
        link_el = hijo(it, "link")
        link = texto_de(link_el) or (link_el.get("href", "") if link_el is not None else "")
        if not link:
            continue
        cats = [texto_de(c) or c.get("term", "") for c in it if local(c.tag) == "category"]
        yield {
            "url": link,
            "titulo": limpiar_html(texto_de(hijo(it, "title"))),
            "bajada": limpiar_html(texto_de(hijo(it, "description", "summary"))),
            "fecha": parsear_fecha(texto_de(hijo(it, "pubDate", "published", "updated"))),
            "categorias": [c for c in cats if c],
        }


def leer_sitemap(data):
    root = ET.fromstring(data)
    for u in root.iter():
        if local(u.tag) != "url":
            continue
        loc = ""
        titulo = fecha = kw = ""
        for c in u.iter():
            n = local(c.tag)
            if n == "loc" and not loc:
                loc = texto_de(c)
            elif n == "title":
                titulo = texto_de(c)
            elif n == "publication_date":
                fecha = texto_de(c)
            elif n == "keywords":
                kw = texto_de(c)
        if loc and titulo:
            yield {
                "url": loc,
                "titulo": limpiar_html(titulo),
                "bajada": "",
                "fecha": parsear_fecha(fecha),
                "palabras_clave": [k.strip() for k in kw.split(",") if k.strip()],
            }


def cargar_dia(dia):
    f = NOTAS / f"{dia}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    return {}


def guardar_dia(dia, notas):
    NOTAS.mkdir(parents=True, exist_ok=True)
    orden = dict(sorted(notas.items(), key=lambda kv: kv[1]["fecha"], reverse=True))
    (NOTAS / f"{dia}.json").write_text(json.dumps(orden, ensure_ascii=False, indent=0), encoding="utf-8")


def main():
    fuentes = yaml.safe_load((RAIZ / "config/fuentes.yaml").read_text(encoding="utf-8"))
    temas = yaml.safe_load((RAIZ / "config/temas.yaml").read_text(encoding="utf-8"))
    clasif = Clasificador(temas)
    ua = fuentes["user_agent"]
    pausa = fuentes.get("pausa_entre_pedidos_seg", 1)
    max_bajada = fuentes.get("recorte_bajada_palabras", 40)
    excl_comunes = set(fuentes.get("excluir_secciones_comunes", []))
    ahora = datetime.now(timezone.utc)
    desde = ahora - timedelta(days=VENTANA_DIAS)

    dias = {}  # dia -> dict de notas, cargado a demanda
    registro = {"inicio": ahora.isoformat(timespec="seconds"), "fuentes": {}, "totales": {}}

    def obtener_dia(dia):
        if dia not in dias:
            dias[dia] = cargar_dia(dia)
        return dias[dia]

    for clave, d in fuentes["diarios"].items():
        if d.get("activo", True) is False:
            continue
        excl = excl_comunes | set(d.get("excluir_secciones", []))
        tareas = [("rss", k, u) for k, u in (d.get("rss") or {}).items()]
        tareas += [("sitemap", "sitemap", u) for u in (d.get("sitemaps") or [])]
        for tipo, nombre_feed, url in tareas:
            etiqueta = f"{clave}/{tipo}:{nombre_feed}"
            est = {"leidas": 0, "nuevas": 0, "actualizadas": 0, "excluidas": 0, "viejas": 0}
            try:
                data = bajar(url, ua)
                items = list(leer_rss(data) if tipo == "rss" else leer_sitemap(data))
            except (urllib.error.URLError, ET.ParseError, TimeoutError, OSError) as e:
                est["error"] = f"{type(e).__name__}: {e}"[:200]
                registro["fuentes"][etiqueta] = est
                time.sleep(pausa)
                continue
            for it in items:
                est["leidas"] += 1
                if not it["fecha"] or it["fecha"] < desde or it["fecha"] > ahora + timedelta(hours=2):
                    est["viejas"] += 1
                    continue
                sec = seccion_de_url(it["url"])
                if not sec and tipo == "rss" and nombre_feed != "ultimo":
                    sec = nombre_feed.replace("_", "-")
                if sec in excl:
                    est["excluidas"] += 1
                    continue
                nid = id_nota(it["url"])
                dia = it["fecha"].astimezone(AR).date().isoformat()
                notas = obtener_dia(dia)
                bajada = recortar_palabras(it.get("bajada", ""), max_bajada)
                pc = it.get("palabras_clave", []) or it.get("categorias", [])
                ahora_txt = ahora.isoformat(timespec="seconds")
                if nid in notas:
                    n = notas[nid]
                    cambio = False
                    if bajada and not n.get("bajada"):
                        n["bajada"] = bajada
                        cambio = True
                    if pc and not n.get("palabras_clave"):
                        n["palabras_clave"] = pc
                        cambio = True
                    if etiqueta not in n["fuentes"]:
                        n["fuentes"].append(etiqueta)
                        cambio = True
                    n["visto_ultimo"] = ahora_txt
                    if cambio:
                        n["tema"], n["motivo"] = clasif.clasificar(n, d.get("tema_por_defecto"))
                        est["actualizadas"] += 1
                    continue
                n = {
                    "id": nid,
                    "diario": clave,
                    "url": url_canonica(it["url"]),
                    "titulo": it["titulo"],
                    "bajada": bajada,
                    "fecha": it["fecha"].isoformat(timespec="seconds"),
                    "seccion": sec,
                    "palabras_clave": pc,
                    "edicion_impresa": any("edicion impresa" in k.lower().replace("ó", "o") for k in pc),
                    "fuentes": [etiqueta],
                    "visto_primero": ahora_txt,
                    "visto_ultimo": ahora_txt,
                }
                n["tema"], n["motivo"] = clasif.clasificar(n, d.get("tema_por_defecto"))
                notas[nid] = n
                est["nuevas"] += 1
            registro["fuentes"][etiqueta] = est
            time.sleep(pausa)

    for dia, notas in dias.items():
        if notas:
            guardar_dia(dia, notas)

    # Retención
    limite = (ahora.astimezone(AR) - timedelta(days=RETENCION_DIAS)).date().isoformat()
    for f in NOTAS.glob("*.json"):
        if f.stem < limite:
            f.unlink()

    # Totales de los últimos 7 días, para la revisión diaria
    por_diario, por_tema = {}, {}
    for f in sorted(NOTAS.glob("*.json"))[-VENTANA_DIAS:]:
        for n in json.loads(f.read_text(encoding="utf-8")).values():
            por_diario[n["diario"]] = por_diario.get(n["diario"], 0) + 1
            por_tema[n["tema"]] = por_tema.get(n["tema"], 0) + 1
    registro["fin"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    registro["totales"] = {"por_diario_7d": por_diario, "por_tema_7d": por_tema,
                           "errores": sum(1 for e in registro["fuentes"].values() if "error" in e)}
    DATOS.mkdir(exist_ok=True)
    (DATOS / "ultima_recoleccion.json").write_text(json.dumps(registro, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(registro["totales"], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
