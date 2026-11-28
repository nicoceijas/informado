"""Fechas de los avisos de «Antes de salir» (decisión de Nico del 27/11).

Un aviso solo sirve si el hecho es hoy o próximamente. Se lee la fecha en el título y la bajada,
siempre contando desde el día en que se publicó la nota: «mañana» en una nota del jueves es el
viernes. Se reconocen «hoy», «esta noche», «mañana» (no «esta mañana» ni «por la mañana», que son
la mañana del mismo día), «pasado mañana», «ayer», los días de la semana («el lunes», «este viernes
27», «el jueves pasado», «el próximo martes»), fechas escritas («30 de noviembre», «30/11»), «el fin
de semana», «la semana que viene» y años lejanos («para 2027»).

Todas las funciones reciben el texto ya normalizado (sin tildes, minúsculas, sin signos salvo «/»).
"""
import re
from datetime import date, timedelta

DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]
HORIZONTE_DIAS = 14  # más allá de esto no es «próximamente»

_DIA = re.compile(r"\b(?:(este|el|del|proximo|el proximo|este proximo)\s+)?(" + "|".join(DIAS) +
                  r")(?:\s+(\d{1,2}))?(\s+pasado)?\b")
_FECHA_MES = re.compile(r"\b(\d{1,2})\s+de\s+(" + "|".join(MESES) + r")\b")
_FECHA_BARRA = re.compile(r"\b(\d{1,2})/(\d{1,2})\b")
_MANANA = re.compile(r"\b(\w+\s+)?(\w+\s+)?manana\b")
_HOY = re.compile(r"\b(hoy|esta noche|esta tarde|en este momento|ahora mismo)\b")
_AYER = re.compile(r"\b(ayer|anoche)\b")
_FINDE = re.compile(r"\bfin de semana( largo)?\b")
_SEMANA_QUE_VIENE = re.compile(r"\b(la semana que viene|la proxima semana)\b")
_ANIO = re.compile(r"\b(?:para|en|de cara a|durante)\s+(?:el\s+)?(20\d\d)\b")


def _fecha_con_dia(numero, publicada):
    """Un día del mes («viernes 27») en el mes de la nota o el siguiente."""
    for k in (0, 1, -1):
        m = publicada.month + k
        y = publicada.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        try:
            d = date(y, m, numero)
        except ValueError:
            continue
        if -20 <= (d - publicada).days <= 40:
            return d
    return None


def fechas_en(txt, publicada):
    """Lista de rangos (desde, hasta) mencionados en el texto, contados desde `publicada`."""
    out = []
    if re.search(r"\bpasado manana\b", txt):
        out.append((publicada + timedelta(days=2),) * 2)
    for m in _MANANA.finditer(re.sub(r"\bpasado manana\b", " ", txt)):
        previas = " ".join(x.strip() for x in (m.group(1) or "", m.group(2) or "") if x)
        if re.search(r"(^|\s)(esta|la|cada|toda la)$", previas):
            out.append((publicada, publicada))  # «esta mañana», «por la mañana», «a la mañana»
        else:
            out.append((publicada + timedelta(days=1),) * 2)
    if _HOY.search(txt):
        out.append((publicada, publicada))
    if _AYER.search(txt):
        out.append((publicada - timedelta(days=1),) * 2)
    for m in _DIA.finditer(txt):
        prefijo, dia, numero, pasado = m.groups()
        if numero:
            d = _fecha_con_dia(int(numero), publicada)
            if d:
                out.append((d, d))
                continue
        dif = (DIAS.index(dia) - publicada.weekday()) % 7
        if pasado:
            dif = dif - 7 if dif else -7
        elif prefijo and "proximo" in prefijo and dif == 0:
            dif = 7
        d = publicada + timedelta(days=dif)
        out.append((d, d))
    for m in _FECHA_MES.finditer(txt):
        d = _fecha_completa(int(m.group(1)), MESES.index(m.group(2)) + 1, publicada)
        if d:
            out.append((d, d))
    for m in _FECHA_BARRA.finditer(txt):
        dia, mes = int(m.group(1)), int(m.group(2))
        if (dia, mes) == (24, 7) or not 1 <= mes <= 12:  # «24/7»
            continue
        d = _fecha_completa(dia, mes, publicada)
        if d:
            out.append((d, d))
    m = _FINDE.search(txt)
    if m:
        if publicada.weekday() >= 5:  # sábado o domingo: el fin de semana en curso
            sab = publicada - timedelta(days=publicada.weekday() - 5)
        else:
            sab = publicada + timedelta(days=5 - publicada.weekday())
        out.append((sab, sab + timedelta(days=2 if m.group(1) else 1)))
    if _SEMANA_QUE_VIENE.search(txt):
        lun = publicada + timedelta(days=7 - publicada.weekday())
        out.append((lun, lun + timedelta(days=6)))
    for m in _ANIO.finditer(txt):
        anio = int(m.group(1))
        if anio > publicada.year:
            out.append((date(anio, 1, 1), date(anio, 12, 31)))
    return out


def _fecha_completa(dia, mes, publicada):
    for y in (publicada.year, publicada.year + 1, publicada.year - 1):
        try:
            d = date(y, mes, dia)
        except ValueError:
            return None
        if -180 <= (d - publicada).days <= 185:
            return d
    return None


def estado_por_fecha(rangos, hoy):
    """(estado, fecha): «Hoy», «Mañana» o una fecha corta («Lun 30/11») si es próximamente; (None, None)
    si ya pasó o queda demasiado lejos. Con varias fechas, manda la más cercana que todavía no pasó."""
    vigentes = sorted((r for r in rangos if r[1] >= hoy), key=lambda r: r[0])
    if not vigentes:
        return None, None
    desde, hasta = vigentes[0]
    if desde <= hoy <= hasta:
        return "Hoy", hoy
    if desde == hoy + timedelta(days=1):
        return "Mañana", desde
    if (desde - hoy).days <= HORIZONTE_DIAS:
        return f"{DIAS_CORTOS[desde.weekday()]} {desde.day}/{desde.month}", desde
    return None, None
