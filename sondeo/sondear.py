"""Sondeo de fuentes: prueba feeds RSS, sitemaps de noticias y homes de cada diario.

Solo usa la biblioteca estándar. Guarda el resultado en sondeo/resultado.json
y un resumen legible en sondeo/RESULTADO.md.
"""
import json
import re
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(__file__).parent
CAND = json.loads((BASE / "candidatos.json").read_text(encoding="utf-8"))
UA = CAND["user_agent"]
UA_NAVEGADOR = ("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")


def bajar(url, ua=UA, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "*/*"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(3_000_000)
            return {"status": r.status, "bytes": len(data), "ms": int((time.time() - t0) * 1000),
                    "final_url": r.geturl(), "ctype": r.headers.get("Content-Type", "")}, data
    except urllib.error.HTTPError as e:
        return {"status": e.code, "error": str(e.reason)}, b""
    except Exception as e:  # noqa: BLE001
        return {"status": 0, "error": f"{type(e).__name__}: {e}"[:200]}, b""


def local(tag):
    return tag.rsplit("}", 1)[-1]


def primero(hijos, *nombres):
    """Devuelve el primer hijo presente. Ojo: un Element sin hijos es 'falso' en Python."""
    for n in nombres:
        el = hijos.get(n)
        if el is not None:
            return el
    return None


def seccion_de_url(url):
    partes = [p for p in urlparse(url).path.split("/") if p]
    if not partes:
        return "(raiz)"
    if len(partes) >= 2 and partes[0] in ("secciones", "seccion", "noticias", "notas"):
        return partes[1]
    return partes[0]


def analizar_feed(data):
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        return {"xml_ok": False, "error": str(e)[:120]}
    items = [el for el in root.iter() if local(el.tag) in ("item", "entry")]
    campos = set()
    categorias = set()
    ejemplos = []
    fechas = []
    bajadas = []
    secciones = {}
    for it in items:
        hijos = {local(c.tag): c for c in it}
        campos.update(hijos)
        for c in it:
            if local(c.tag) == "category":
                txt = (c.text or c.get("term") or "").strip()
                if txt:
                    categorias.add(txt)
        titulo = (hijos.get("title").text or "").strip() if hijos.get("title") is not None else ""
        desc_el = primero(hijos, "description", "summary")
        desc = re.sub(r"<[^>]+>", " ", (desc_el.text or "")) if desc_el is not None else ""
        desc = re.sub(r"\s+", " ", desc).strip()
        fecha_el = primero(hijos, "pubDate", "published", "updated")
        if fecha_el is not None and fecha_el.text:
            fechas.append(fecha_el.text.strip())
        bajadas.append(len(desc.split()))
        link_el = primero(hijos, "link")
        link = (link_el.text or link_el.get("href") or "").strip() if link_el is not None else ""
        if link:
            secciones[seccion_de_url(link)] = secciones.get(seccion_de_url(link), 0) + 1
        if len(ejemplos) < 2:
            ejemplos.append({"titulo": titulo[:140], "bajada": desc[:200], "bajada_palabras": len(desc.split())})
    return {"xml_ok": True, "items": len(items), "campos": sorted(campos),
            "categorias": sorted(categorias)[:40], "ejemplos": ejemplos,
            "bajada_mediana": sorted(bajadas)[len(bajadas) // 2] if bajadas else 0,
            "con_bajada": sum(1 for b in bajadas if b >= 5),
            "secciones_url": dict(sorted(secciones.items(), key=lambda x: -x[1])[:15]),
            "fecha_mas_nueva": fechas[0] if fechas else None,
            "fecha_mas_vieja": fechas[-1] if fechas else None}


def analizar_sitemap(data):
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        return {"xml_ok": False, "error": str(e)[:120]}
    urls = [el for el in root.iter() if local(el.tag) == "url"]
    news = [el for el in root.iter() if local(el.tag) == "news"]
    sub = [el for el in root.iter() if local(el.tag) == "sitemap"]
    secciones, campos_news, ejemplos, fechas = {}, set(), [], []
    for u in urls:
        loc = next((c.text for c in u.iter() if local(c.tag) == "loc"), "") or ""
        sec = seccion_de_url(loc)
        secciones[sec] = secciones.get(sec, 0) + 1
        for c in u.iter():
            if local(c.tag) in ("title", "keywords", "publication_date", "name", "language", "genres"):
                campos_news.add(local(c.tag))
            if local(c.tag) == "publication_date" and c.text:
                fechas.append(c.text.strip())
        if len(ejemplos) < 2:
            t = next((c.text for c in u.iter() if local(c.tag) == "title"), "")
            k = next((c.text for c in u.iter() if local(c.tag) == "keywords"), "")
            ejemplos.append({"loc": loc[:160], "titulo": (t or "")[:140], "keywords": (k or "")[:140]})
    sub_locs = [next((c.text for c in sm.iter() if local(c.tag) == "loc"), "") for sm in sub][:10]
    fechas.sort()
    return {"xml_ok": True, "urls": len(urls), "con_news": len(news), "subsitemaps": len(sub),
            "sub_locs": sub_locs, "campos_news": sorted(campos_news), "ejemplos": ejemplos,
            "secciones_url": dict(sorted(secciones.items(), key=lambda x: -x[1])[:20]),
            "rango_fechas": [fechas[0], fechas[-1]] if fechas else None}


def robots(home):
    info, data = bajar(home.rstrip("/") + "/robots.txt")
    txt = data.decode("utf-8", "ignore")
    sitemaps = re.findall(r"(?im)^sitemap:\s*(\S+)", txt)
    bloqueos = []
    actual = []
    for linea in txt.splitlines():
        l = linea.split("#")[0].strip()
        if l.lower().startswith("user-agent:"):
            actual.append(l.split(":", 1)[1].strip())
        elif l.lower().startswith("disallow:") and "*" in actual:
            v = l.split(":", 1)[1].strip()
            if v in ("/", "/rss", "/rss/", "/arc/"):
                bloqueos.append(v)
        elif l and not l.lower().startswith(("allow", "disallow", "crawl", "sitemap")):
            pass
        if l == "":
            actual = []
    return {"status": info["status"], "sitemaps": sitemaps[:15], "disallow_relevante": bloqueos}


def main():
    res = {"fecha": datetime.now(timezone.utc).isoformat(), "diarios": {}}
    for clave, d in CAND["diarios"].items():
        r = {"nombre": d["nombre"], "impreso": d["impreso"], "feeds": {}, "sitemaps": {}}
        r["robots"] = robots(d["home"])
        info, data = bajar(d["home"])
        r["home"] = info
        html = data.decode("utf-8", "ignore")
        r["rss_en_home"] = sorted(set(re.findall(r'<link[^>]+application/(?:rss|atom)\+xml[^>]+href="([^"]+)"', html)))[:10]
        if info["status"] != 200:
            info2, _ = bajar(d["home"], ua=UA_NAVEGADOR)
            r["home_ua_navegador"] = info2
        for sec, url in d["feeds"].items():
            info, data = bajar(url)
            if info["status"] == 200:
                info.update(analizar_feed(data))
            else:
                info2, data2 = bajar(url, ua=UA_NAVEGADOR)
                info["con_ua_navegador"] = info2["status"]
                if info2["status"] == 200:
                    info["analisis_ua_navegador"] = analizar_feed(data2)
            r["feeds"][sec] = {"url": url, **info}
            time.sleep(0.5)
        candidatos_sm = list(dict.fromkeys(d["sitemaps"] + [s for s in r["robots"]["sitemaps"] if "news" in s.lower()]))
        for url in candidatos_sm[:5]:
            info, data = bajar(url)
            if info["status"] == 200:
                info.update(analizar_sitemap(data))
            r["sitemaps"][url] = info
            time.sleep(0.5)
        res["diarios"][clave] = r
    (BASE / "resultado.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")

    lineas = [f"# Resultado del sondeo · {res['fecha'][:16]} UTC", ""]
    for clave, r in res["diarios"].items():
        lineas.append(f"## {r['nombre']} · home {r['home'].get('status')}")
        if r.get("rss_en_home"):
            lineas.append(f"- RSS declarados en la home: {r['rss_en_home']}")
        for sec, f in r["feeds"].items():
            if f.get("xml_ok"):
                lineas.append(f"- ✅ `{sec}` {f['items']} notas · con bajada {f['con_bajada']} · mediana {f['bajada_mediana']} palabras · secciones URL: {f['secciones_url']}")
            else:
                extra = f" (UA navegador: {f.get('con_ua_navegador')})" if "con_ua_navegador" in f else ""
                lineas.append(f"- ❌ `{sec}` estado {f.get('status')} {f.get('error', '')}{extra}")
        for url, s in r["sitemaps"].items():
            ok = "✅" if s.get("xml_ok") else "❌"
            lineas.append(f"- {ok} sitemap {urlparse(url).path} · {s.get('status')} · urls {s.get('urls', '-')} · news {s.get('con_news', '-')} · campos {s.get('campos_news', '-')} · fechas {s.get('rango_fechas')}")
            if s.get("secciones_url"):
                lineas.append(f"    - secciones URL: {s['secciones_url']}")
            if s.get("sub_locs"):
                lineas.append(f"    - subsitemaps: {s['sub_locs'][:5]}")
        lineas.append("")
    (BASE / "RESULTADO.md").write_text("\n".join(lineas), encoding="utf-8")


if __name__ == "__main__":
    main()
