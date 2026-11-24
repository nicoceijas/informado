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
