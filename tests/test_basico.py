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
