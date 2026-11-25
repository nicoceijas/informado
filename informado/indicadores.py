"""Indicadores del día: dólar Banco Nación (compra y venta), riesgo país e inflación mensual.

Cada dato lleva su fuente y su fecha. Si una fuente falla, se conserva el último valor conocido
(marcado como no actualizado) y la corrida sigue. Aprobado por Nico el 25/11.

Fuentes:
- Dólar: Banco Nación, cotización de billetes (bna.com.ar/Personas). Respaldo: DolarApi («oficial»,
  que publica la cotización del Banco Nación).
- Riesgo país: EMBI de JP Morgan, vía ArgentinaDatos (no hay fuente oficial gratuita).
- Inflación: INDEC (IPC nacional, variación mensual), vía la API de Series de Tiempo de datos.gob.ar.
  Respaldo: API de estadísticas del BCRA, que replica el dato del INDEC.

Uso: python -m informado.indicadores
"""
import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "datos" / "indicadores.json"
AR = timezone(timedelta(hours=-3))
UA = "InformadoBot/0.1 (+https://github.com/nicoceijas/informado)"
UA_NAVEGADOR = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]


def bajar(url, ua=UA, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(2_000_000).decode("utf-8", "ignore")


def numero_ar(txt):
    """«1.440,50» → 1440.5"""
    return float(txt.replace(".", "").replace(",", "."))


def dolar_bna():
    html = bajar("https://www.bna.com.ar/Personas", ua=UA_NAVEGADOR)
    # La primera tabla («Cotización Billetes») trae: Dolar U.S.A | compra | venta.
    m = re.search(r"Dolar\s*U\.?S\.?A\.?(.{0,400}?)(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}).{0,200}?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})",
                  html, re.S | re.I)
    if not m:
        raise ValueError("no se encontró la fila del dólar en la página del Banco Nación")
    compra, venta = numero_ar(m.group(2)), numero_ar(m.group(3))
    f = re.search(r"(\d{1,2}/\d{1,2}/\d{4})", html)
    fecha = datetime.strptime(f.group(1), "%d/%m/%Y").date().isoformat() if f else datetime.now(AR).date().isoformat()
    return {"compra": compra, "venta": venta, "fecha": fecha, "fuente": "Banco Nación",
            "url": "https://www.bna.com.ar/Personas"}


def dolar_respaldo():
    d = json.loads(bajar("https://dolarapi.com/v1/dolares/oficial"))
    return {"compra": float(d["compra"]), "venta": float(d["venta"]),
            "fecha": d.get("fechaActualizacion", "")[:10] or datetime.now(AR).date().isoformat(),
            "fuente": "Banco Nación, vía DolarApi", "url": "https://www.bna.com.ar/Personas"}


def riesgo_pais():
    d = json.loads(bajar("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimo"))
    return {"valor": round(float(d["valor"])), "fecha": d["fecha"][:10], "fuente": "JP Morgan (EMBI), vía ArgentinaDatos",
            "url": "https://argentinadatos.com/"}


def inflacion():
    url = ("https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26:percent_change"
           "&last=1&format=json")
    d = json.loads(bajar(url))
    fecha, valor = d["data"][-1]
    return {"valor": round(100 * float(valor), 1), "mes": fecha[:7], "fuente": "INDEC, vía datos.gob.ar",
            "url": "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31"}


def inflacion_respaldo():
    # Variable 27 del BCRA: «Inflación mensual (variación en %)», que publica el dato del INDEC.
    desde = (datetime.now(AR) - timedelta(days=120)).date().isoformat()
    d = json.loads(bajar(f"https://api.bcra.gob.ar/estadisticas/v3.0/monetarias/27?desde={desde}"))
    ultimo = max(d["results"], key=lambda r: r["fecha"])
    return {"valor": round(float(ultimo["valor"]), 1), "mes": ultimo["fecha"][:7], "fuente": "INDEC, vía BCRA",
            "url": "https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31"}


def obtener(nombre, *funciones, previo=None, registro=None):
    errores = []
    for f in funciones:
        try:
            dato = f()
            dato["actualizado"] = True
            return dato
        except Exception as e:  # noqa: BLE001 — una fuente caída no frena la corrida
            errores.append(f"{f.__name__}: {type(e).__name__}: {e}"[:200])
    if registro is not None:
        registro[nombre] = errores
    if previo:
        return {**previo, "actualizado": False}
    return None


def main():
    previo = json.loads(SALIDA.read_text(encoding="utf-8")) if SALIDA.exists() else {}
    errores = {}
    datos = {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dolar": obtener("dolar", dolar_bna, dolar_respaldo, previo=previo.get("dolar"), registro=errores),
        "riesgo_pais": obtener("riesgo_pais", riesgo_pais, previo=previo.get("riesgo_pais"), registro=errores),
        "inflacion": obtener("inflacion", inflacion, inflacion_respaldo, previo=previo.get("inflacion"), registro=errores),
        "errores": errores,
    }
    if datos["inflacion"] and datos["inflacion"].get("mes"):
        a, m = datos["inflacion"]["mes"].split("-")
        datos["inflacion"]["mes_nombre"] = f"{MESES[int(m) - 1]} {a}"
    SALIDA.parent.mkdir(exist_ok=True)
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(datos, ensure_ascii=False))


if __name__ == "__main__":
    main()
