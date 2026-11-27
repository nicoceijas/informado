from pathlib import Path

import yaml

from informado.clasificar import Clasificador
from informado.recolectar import leer_rss, leer_sitemap, seccion_de_url
from informado.texto import coincidencias, normalizar

RAIZ = Path(__file__).resolve().parent.parent
C = Clasificador(yaml.safe_load((RAIZ / "config/temas.yaml").read_text(encoding="utf-8")))


def tema(titulo, seccion="", bajada="", pc=None, defecto=None):
    return C.clasificar({"titulo": titulo, "bajada": bajada, "seccion": seccion,
                         "palabras_clave": pc or []}, defecto)[0]


def test_palabras_completas():
    t = normalizar("La provincia y el proyecto")
    assert coincidencias(t, ["pro"]) == []
    assert coincidencias(normalizar("Reunión del PRO"), ["pro"]) == ["pro"]
    assert coincidencias(normalizar("Paritaria docente"), ["paritaria"]) == ["paritaria"]


def test_seccion_directa():
    assert tema("Sesión por el Presupuesto 2027", "politica") == "politica"
    assert tema("El dólar superó los $1.600", "economia") == "economia"
    assert tema("Elecciones en Chile", "el-mundo") == "internacionales"


def test_sindicales_gana_sobre_seccion():
    assert tema("La CGT anunció un paro general para el jueves", "economia") == "sindicales"


def test_ciudad_por_palabras_en_sociedad():
    assert tema("Cambios en la frecuencia del subte en CABA", "sociedad") == "ciudad"


def test_otros_gana_primero():
    assert tema("Horóscopo de hoy", "horoscopo") == "otros"
    assert tema("Murió un actor del subte", "espectaculos") == "otros"


def test_deportes_condicional():
    assert tema("River ganó el clásico con un gol agónico", "deportes") == "futbol"
    assert tema("Murió la apneísta Jeanine Grasmeijer", "deportes") == "otros"


def test_ole_por_defecto_y_pagina12_sin_seccion():
    assert tema("La historia que compartió Ponzio", "river-plate") == "futbol"
    assert tema("Algo de Olé sin sección", "", defecto="futbol") == "futbol"
    assert tema("El Senado debate el Presupuesto del gobierno nacional", "") == "politica"


def test_seccion_de_url():
    assert seccion_de_url("https://www.clarin.com/politica/nota_0_abc.html") == "politica"
    assert seccion_de_url("https://www.pagina12.com.ar/2026/11/24/nota/") == ""
    assert seccion_de_url("https://www.ambito.com/el-papa-francisco-tuvo-visiones-del-diablo-n6348485") == ""


def test_lectores():
    rss = b"""<rss><channel><item><title>T&#237;tulo</title><link>https://x.com/politica/a</link>
    <description><![CDATA[<p>Bajada <b>breve</b></p>]]></description><pubDate>Tue, 24 Nov 2026 12:00:00 -0300</pubDate>
    <category>Pol\xc3\xadtica</category></item></channel></rss>"""
    it = next(leer_rss(rss))
    assert it["titulo"] == "Título" and it["bajada"] == "Bajada breve" and it["categorias"] == ["Política"]
    assert it["fecha"].isoformat() == "2026-11-24T15:00:00+00:00"
    sm = b"""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
    <url><loc>https://x.com/2026/11/24/a/</loc><news:news><news:publication_date>2026-11-24T18:00:00Z</news:publication_date>
    <news:title>Nota</news:title><news:keywords>Edici\xc3\xb3n Impresa, CGT</news:keywords></news:news></url></urlset>"""
    it = next(leer_sitemap(sm))
    assert it["palabras_clave"] == ["Edición Impresa", "CGT"]


def test_calibracion_1():
    assert tema("Grêmio venció 2-0 a Santos", "deportes") == "otros"
    assert tema("Cerúndolo, el tenista porteño, sigue en el Top 20", "deportes") == "otros"
    assert tema("Kicillof exigirá información salarial a las empresas", "politica") == "politica"
    assert tema("Ciro cantó en una bicicletería de Haedo", "zonales") == "ciudad"
    assert tema("Elecciones en España: quiénes podrán votar", "informacion-general") in ("internacionales", "politica")
    assert C.conoce("politica") and not C.conoce("honduras")


def test_ciudad_no_pisa_politica():
    assert tema("Karina Milei y la interna del PRO en CABA", "politica") == "politica"
    assert tema("Piñas en el andén de la línea D del subte", "sociedad") == "ciudad"
    assert tema("La CGT marcha en CABA", "politica") == "sindicales"


def test_agrupador_puntaje():
    from informado.agrupar import peso_jerarquia, puntuar, tokens
    assert "presupuest" in tokens("El Presupuesto presupuestario")
    assert peso_jerarquia({"home_mejor_pos": 2}) == 1.0
    assert peso_jerarquia({"edicion_impresa": True}) == 0.8
    uno = puntuar([{"diario": "a", "dia": "2026-11-24"}, {"diario": "b", "dia": "2026-11-24"}])[0]
    muchos = puntuar([{"diario": d, "dia": f"2026-11-2{i}", "home_mejor_pos": 1} for i, d in enumerate("abcdef")])[0]
    assert 0 < uno < muchos <= 100


def test_espectaculos_a_otros():
    assert tema("Jennifer Barreto, de Puerto Rico, ganó Miss Universo 2026", "internacional") == "otros"
    assert tema("Elecciones en Chile", "el-mundo") == "internacionales"


def test_deduplicar():
    from informado.agrupar import deduplicar
    cfg = {"diarios": {"perfil": {"id_en_url": "-([A-Za-z0-9]{12})/?$"}, "ambito": {}}}
    notas = [
        {"diario": "perfil", "url": "https://www.perfil.com/economia/argentina-entro-en-recesion-aWvO15i42sut",
         "titulo": "Argentina entró en recesión", "fecha": "2026-11-24T19:09:58+00:00", "visto_ultimo": "2026-11-24T19:20:00+00:00"},
        {"diario": "perfil", "url": "https://perfil.com/economia/argentina-entro-en-recesion-aWvO15i42sut",
         "titulo": "Argentina entró en recesión", "fecha": "2026-11-24T19:09:58+00:00", "visto_ultimo": "2026-11-24T21:20:00+00:00"},
        {"diario": "perfil", "url": "https://www.perfil.com/economia/la-actividad-entro-en-recesion-aWvO15i42sut",
         "titulo": "La actividad entró en recesión", "fecha": "2026-11-24T19:09:58+00:00", "visto_ultimo": "2026-11-25T05:15:00+00:00"},
        {"diario": "ambito", "url": "https://www.ambito.com/informacion-general/alerta-n6348454",
         "titulo": "Alerta amarilla", "fecha": "2026-11-24T01:51:00+00:00", "visto_ultimo": "2026-11-24T03:00:00+00:00"},
        {"diario": "ambito", "url": "https://www.ambito.com/informacion-general/alerta-n6348454",
         "titulo": "Buen tiempo en el AMBA", "fecha": "2026-11-25T02:45:00+00:00", "visto_ultimo": "2026-11-25T05:15:00+00:00"},
        {"diario": "ambito", "url": "https://www.ambito.com/economia/otra-nota-n6348999",
         "titulo": "Otra nota", "fecha": "2026-11-25T02:45:00+00:00", "visto_ultimo": "2026-11-25T05:15:00+00:00"},
    ]
    titulos = sorted(n["titulo"] for n in deduplicar(notas, cfg))
    assert titulos == ["Buen tiempo en el AMBA", "La actividad entró en recesión", "Otra nota"]


def test_actualizar_titulo():
    from informado.recolectar import actualizar_titulo
    n = {"titulo": "El Indec publica hoy el dato", "bajada": "", "fuentes": ["popular/rss:ultimo"]}
    assert actualizar_titulo(n, "La economía entró en recesión", "Dos trimestres de caída", "rss")
    assert n["titulo"] == "La economía entró en recesión" and n["bajada"] == "Dos trimestres de caída"
    assert n["titulos_anteriores"] == ["El Indec publica hoy el dato"]
    # El sitemap no pisa un título que vino del RSS.
    assert not actualizar_titulo(n, "Recesión técnica", "", "sitemap")
    assert n["titulo"] == "La economía entró en recesión"
    # Sin cambios no se toca nada.
    assert not actualizar_titulo(n, "La economía entró en recesión", "", "rss")


def test_servicio_y_estado_paro():
    from datetime import date
    from informado.agrupar import categoria_servicio, estado_paro
    cfg = yaml.safe_load((RAIZ / "config/fuentes.yaml").read_text(encoding="utf-8"))["servicio_sin_tema"]
    assert categoria_servicio("Dólar tarjeta hoy: a cuánto cotiza el dólar turista", cfg) == "dolar"
    assert categoria_servicio("Dólar hoy en Colombia: precio y cotización", cfg) == "cotizaciones_exterior"
    assert categoria_servicio("Semana de calor en el AMBA: qué días la temperatura estará por encima de 30", cfg) == "clima"
    assert categoria_servicio("ANSES: quiénes cobran hoy, miércoles 25 de noviembre", cfg) == "pagos"
    assert categoria_servicio("Decreto 1296: qué jubilados quedan fuera del bono y quiénes cobran", cfg) is None
    assert categoria_servicio("El Indec publica el dato de actividad", cfg) is None
    mie = date(2026, 11, 25)
    assert estado_paro(normalizar("Se diluyó el paro de colectivos: la UTA cerró un acuerdo salarial"), mie) == "Sin paro"
    assert estado_paro(normalizar("Sin acuerdo, la UTA confirmó el paro de colectivos para mañana"), mie) == "Mañana"
    assert estado_paro(normalizar("Paro de trenes hoy: cómo funcionan las líneas"), mie) == "Hoy"
    assert estado_paro(normalizar("ATE amenaza con paros en diciembre"), mie) == "Anunciado"


def test_historias():
    from datetime import date
    from informado.agrupar import tokens
    from informado.historias import armar_historias, frecuencias_semana, propuesta, rotulo
    def tema(i, sec, titulos, dia, puntaje=50):
        return {"id": f"t{i}", "seccion": sec, "seccion_nombre": sec.capitalize(), "titulo": titulos[0], "puntaje": puntaje,
                "convergencia": puntaje, "jerarquia": puntaje, "n_tapas_home": 1, "terminos": [],
                "notas": [{"id": f"n{i}{k}", "diario": f"d{k}", "titulo": t, "bajada": "", "url": f"https://x/{i}{k}",
                           "fecha": f"2026-11-{dia}T15:00:00+00:00", "home_mejor_pos": None} for k, t in enumerate(titulos)]}
    santucho = ["Suspendieron el homenaje a Mario Santucho en la UBA", "Polémica por el homenaje a Mario Santucho en la UBA"]
    temas = [tema(1, "politica", santucho, 23, 80),
             tema(2, "politica", ["Villarruel contra la UBA por el homenaje a Mario Santucho", "El homenaje a Mario Santucho divide a la UBA"], 24, 60),
             tema(3, "futbol", ["Boca venció a Racing en la Bombonera", "Boca ganó y sueña"], 24, 70),
             tema(4, "futbol", ["Boca y Racing: la previa del partido en la Bombonera", "Boca recibe a Racing"], 23, 40),
             tema(5, "economia", ["El dólar cerró en alza", "Subió el dólar"], 25, 30)]
    palabras = ["Mendoza vendimia", "Salta turismo", "Chubut pesca", "Misiones yerba", "Jujuy litio", "Neuquén petróleo",
                "Córdoba industria", "Tucumán azúcar", "Corrientes arroz", "Formosa algodón", "Catamarca minería", "Rioja olivos"]
    temas += [tema(10 + k, "economia", [f"{w} crece", f"{w} en alza"], 22, 20) for k, w in enumerate(palabras)]
    otros = [f"Nota de relleno número {k} sobre otra cosa distinta" for k in range(40)]
    hs = armar_historias(temas, date(2026, 11, 25), tokens, [n["titulo"] for t in temas for n in t["notas"]] + otros)
    por_tema = {t: h for h in hs for t in h["temas"]}
    assert por_tema["t1"] is por_tema["t2"]                 # Santucho: una sola historia
    assert por_tema["t3"] is not por_tema["t4"]             # fútbol no se une solo
    s = por_tema["t1"]
    assert s["id"] == "t1" and s["puesto"] == 1 and s["n_notas"] == 4 and s["feed"][0]["dia"] == "2026-11-24"
    assert "Santucho" in s["titulo"]
    assert [h["puesto"] for h in hs] == list(range(1, len(hs) + 1))
    prop, afuera = propuesta(hs)
    assert set(prop) | set(afuera) == {h["id"] for h in hs}
    df, n = frecuencias_semana(otros)
    assert rotulo(["La economía entró en recesión técnica", "Recesión técnica: qué dijo el Gobierno"], df, n).startswith("Recesión técnica")


def test_conjuncion():
    from informado.historias import conjuncion
    assert conjuncion("informe") == "e" and conjuncion("INDEC") == "e" and conjuncion("Iglesia") == "e"
    assert conjuncion("hijos") == "e" and conjuncion("hielo") == "y" and conjuncion("Senado") == "y"


def test_poda_encadenadas():
    import numpy as np
    from informado.agrupar import podar
    # 0 = Tether/Lemon (Cronista), 1 = Lemon (Clarín), 2 = IA (Perfil): 2 solo se parece a 0.
    sim = np.array([[1, .34, .30], [.34, 1, 0], [.30, 0, 1]])
    assert podar([0, 1, 2], sim) == ([0, 1], [2])
    # Si el lazo es fuerte, no se poda.
    sim2 = np.array([[1, .5, .45], [.5, 1, 0], [.45, 0, 1]])
    assert podar([0, 1, 2], sim2) == ([0, 1, 2], [])


def test_indicadores_sin_red(monkeypatch, tmp_path):
    import informado.indicadores as I
    html = '<table><tr><td class="tit">Dolar U.S.A</td><td>1.440,00</td><td>1.490,00</td></tr></table> 25/11/2026'
    monkeypatch.setattr(I, "bajar", lambda url, **k: html if "bna" in url else (_ for _ in ()).throw(OSError("sin red")))
    assert I.dolar_bna() == {"compra": 1440.0, "venta": 1490.0, "fecha": "2026-11-25", "fuente": "Banco Nación",
                             "url": "https://www.bna.com.ar/Personas"}
    # Si la fuente falla, queda el último valor conocido, marcado como no actualizado.
    previo = {"valor": 650, "fecha": "2026-11-24", "fuente": "x", "url": "y"}
    reg = {}
    assert I.obtener("riesgo_pais", I.riesgo_pais, previo=previo, registro=reg) == {**previo, "actualizado": False}
    assert reg["riesgo_pais"]


def test_inflacion_mes_mas_nuevo(monkeypatch):
    import json
    import informado.indicadores as I
    respuestas = {
        "datos.gob.ar": {"data": [["2026-09-01", 0.019]]},  # atrasada
        "bcra.gob.ar/estadisticas/v4.0": {"results": [{"idVariable": 27, "detalle": [
            {"fecha": "2026-10-31", "valor": 2.2}, {"fecha": "2026-09-30", "valor": 1.9}]}]},
        "argentinadatos": [{"fecha": "2026-09-30", "valor": 1.9}, {"fecha": "2026-10-31", "valor": 2.2}],
    }

    def bajar(url, **k):
        for clave, r in respuestas.items():
            if clave in url:
                return json.dumps(r)
        raise OSError("sin red")

    monkeypatch.setattr(I, "bajar", bajar)
    fuentes = (I.inflacion, I.inflacion_respaldo, I.inflacion_argentinadatos)
    d = I.obtener_mas_nuevo("inflacion", *fuentes)
    # Gana octubre; ante el empate entre BCRA y ArgentinaDatos, la fuente que figura primero.
    assert (d["mes"], d["valor"], d["fuente"], d["actualizado"]) == ("2026-10", 2.2, "INDEC, vía BCRA", True)
    # La v3.0 del BCRA (filas sueltas en «results») también se entiende.
    del respuestas["bcra.gob.ar/estadisticas/v4.0"]
    respuestas["bcra.gob.ar/estadisticas/v3.0"] = {"results": [{"idVariable": 27, "fecha": "2026-10-31", "valor": 2.2}]}
    assert I.inflacion_respaldo()["mes"] == "2026-10"
    # Si fallan todas, queda el valor anterior, marcado como no actualizado.
    respuestas.clear()
    previo = {"valor": 1.9, "mes": "2026-09", "fuente": "x", "url": "y"}
    reg = {}
    assert I.obtener_mas_nuevo("inflacion", *fuentes, previo=previo, registro=reg) == {**previo, "actualizado": False}
    assert len(reg["inflacion"]) == 3
