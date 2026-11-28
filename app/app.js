/* Informado · app del celular. Sin dependencias.
 * Lee datos/actual.json (generado cada 2 h por GitHub Actions).
 * Pantallas: Hoy (clima, «Antes de salir» y la agenda de las 24 horas), Semana (historias de 7 días) y Guardadas.
 * Lo que hace el usuario (sacar, sumar, unir, renombrar, fijar, guardar, reportes sin enviar) vive en este dispositivo (localStorage).
 * Diseño G3 aprobado por Nico el 27/11 (paleta propia, líneas negras, caja «Antes de salir», botón de compartir).
 */
'use strict';
const REPO = 'nicoceijas/informado';
const DIAS_CORTOS = ['D','L','M','M','J','V','S'];
const DIAS_LARGOS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
let D = null;            // datos del servidor
let NOTA = {};           // notas por id
let HS = [];             // historias (con las uniones del usuario aplicadas), por puesto
let H = {};              // historias por id
let DE_TEMA = {};        // id de tema -> historia que lo contiene
let TEMA_DE_NOTA = {};   // id de nota -> id de tema
let busqueda = null;     // notas de la semana para buscar temas propios (carga diferida)
let IND = null;          // indicadores (dólar, riesgo país, inflación)
let SMN = null;          // alertas oficiales del SMN para el AMBA
const ui = {filtro: null, filtroHoy: null, vistaTema: 'historia', afuera: false, renombrando: false, uniendo: false};
const app = document.getElementById('app');

/* ---------- utilidades ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch (e) { return def; } };
const nombreDiario = k => (D.diarios[k] || {}).nombre || k;
const TZ = 'America/Argentina/Buenos_Aires';
const horaCorta = iso => new Date(iso).toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ});
const fechaLarga = iso => { const f = new Date(iso + 'T12:00:00-03:00').toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', timeZone: TZ}); return f.charAt(0).toUpperCase() + f.slice(1); };
const diaSemana = iso => { const d = new Date(iso + 'T12:00:00-03:00'); return `${DIAS_LARGOS[d.getUTCDay()]} ${d.getUTCDate()}`; };
const hace = iso => { const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`; };
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function toast(txt) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = txt; document.body.appendChild(t); setTimeout(() => t.remove(), 1800); }
const ICONO = {
  guardar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  flecha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  atras: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  compartir: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  menos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  lupa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  viento: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/></svg>',
  clima: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 2A3 3 0 0 0 7 18z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>',
  lapiz: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  unir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8M8 17h8M18 7v10"/><circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2"/></svg>',
  diario: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
  tapa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>',
  abajo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  bandera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
};

/* ---------- lo que guarda el usuario ---------- */
const claveCur = () => 'cur:' + D.semana.hasta;
function cur() { return leer(claveCur(), {quitados: [], sumados: [], propios: [], confirmada: null}); }
function setCur(c) { guardar(claveCur(), c); }
const uniones = () => leer('uniones', []);            // [[idTemaA, idTemaB], …]
const nombres = () => leer('nombres', {});            // idTema -> nombre puesto por el usuario
const fijadas = () => leer('fijadas', {});            // idNota -> fecha
const guardadas = () => leer('guardadas', {notas: {}, temas: {}});
const contiene = (h, ids) => h.temas.some(t => ids.includes(t));
const nombre = h => { const n = nombres(); const t = h.temas.find(x => n[x]); return t ? n[t] : h.titulo; };
// Orden de la semana (27/11): por impacto (los 12 de mayor puntaje, por defecto) o con variedad de secciones (hasta 2 por sección).
const ordenSemana = () => leer('orden_semana', 'impacto') === 'variedad' && D.semana.propuestos_cuota ? 'variedad' : 'impacto';
const listaPropuestos = () => ordenSemana() === 'variedad' ? D.semana.propuestos_cuota : D.semana.propuestos;
const listaAfuera = () => (ordenSemana() === 'variedad' ? D.semana.afuera_cuota : D.semana.afuera) || [];
const propuesta = h => contiene(h, listaPropuestos());
function enSemana(h, c = cur()) { return contiene(h, c.sumados) || (propuesta(h) && !contiene(h, c.quitados)); }

/* ---------- historias con las uniones del usuario ---------- */
function prepararHistorias() {
  NOTA = {}; TEMA_DE_NOTA = {};
  D.temas.forEach(t => t.notas.forEach(n => { NOTA[n.id] = n; TEMA_DE_NOTA[n.id] = t.id; }));
  const base = D.historias.map(h => ({...h, mano: false}));
  const padre = base.map((_, i) => i);
  const raiz = i => { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i]; } return i; };
  const indice = {};
  base.forEach((h, i) => h.temas.forEach(t => { indice[t] = i; }));
  uniones().forEach(([a, b]) => { if (indice[a] !== undefined && indice[b] !== undefined) padre[raiz(indice[a])] = raiz(indice[b]); });
  const grupos = {};
  base.forEach((h, i) => (grupos[raiz(i)] = grupos[raiz(i)] || []).push(h));
  HS = Object.values(grupos).map(g => g.length === 1 ? g[0] : fusionar(g)).sort((a, b) => a.puesto - b.puesto);
  H = {}; DE_TEMA = {};
  HS.forEach(h => { H[h.id] = h; h.temas.forEach(t => { DE_TEMA[t] = h; }); });
}
function fusionar(g) {
  g.sort((a, b) => a.puesto - b.puesto);
  const p = g[0], dias = {};
  g.forEach(h => h.feed.forEach(d => { (dias[d.dia] = dias[d.dia] || []).push(...d.eventos); }));
  const feed = Object.keys(dias).sort().reverse().map(dia => ({dia, eventos: dias[dia].sort((a, b) => b.fecha.localeCompare(a.fecha))}));
  const diarios = new Set();
  g.forEach(h => h.temas.forEach(t => { const tm = D.temas.find(x => x.id === t); if (tm) tm.diarios.forEach(d => diarios.add(d)); }));
  const porDia = p.dias.map((_, k) => g.reduce((s, h) => s + h.dias[k], 0));
  return {...p, mano: true, temas: g.flatMap(h => h.temas), feed, ultimo: feed[0].eventos[0].titulo,
    n_diarios: diarios.size, n_notas: g.reduce((s, h) => s + h.n_notas, 0), dias: porDia, n_dias: porDia.filter(Boolean).length,
    hoy: g.reduce((s, h) => s + h.hoy, 0), desde: g.map(h => h.desde).sort()[0],
    convergencia: Math.max(...g.map(h => h.convergencia)), jerarquia: Math.max(...g.map(h => h.jerarquia)), tapas: Math.max(...g.map(h => h.tapas))};
}

/* ---------- piezas ---------- */
const activos = () => Object.values(D.diarios).filter(d => d.activo !== false).length;
const estiloSec = s => `--s:var(--s-${s});--t:var(--t-${s})`;
const cap = h => `<span class="sec" style="${estiloSec(h.seccion)}">${esc(h.seccion_nombre)}</span>`;
const senales = (h, conHoy) => `<span class="senales">${conHoy && h.hoy ? `<span class="hoy">+${h.hoy} hoy</span>` : ''}<span>${ICONO.diario}${h.n_diarios} de ${activos()} diarios</span>${h.tapas ? `<span class="tapa">${ICONO.tapa}En la tapa de ${h.tapas}</span>` : ''}</span>`;
const dias7 = () => { const b = new Date(D.hoy.fecha + 'T12:00:00-03:00'); return [0, 1, 2, 3, 4, 5, 6].map(k => new Date(b - (6 - k) * 864e5).toISOString().slice(0, 10)); };
const letra = iso => DIAS_CORTOS[new Date(iso + 'T12:00:00-03:00').getUTCDay()];
const diaAR = iso => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
const flecha = () => `<span class="flecha" aria-hidden="true">${ICONO.flecha}</span>`;
function barritas(h) {
  const m = Math.max(...h.dias, 1), d = dias7();
  return `<span class="barras" role="img" aria-label="Notas por día: ${h.dias.map((v, k) => `${diaSemana(d[k])} ${v}`).join(', ')}">${h.dias.map(v => `<i class="${v ? '' : 'z'}" style="height:${v ? Math.max(4, Math.round(26 * v / m)) : 2}px"></i>`).join('')}${d.map((x, k) => `<b class="${k === 6 ? 'hoyd' : ''}">${letra(x)}</b>`).join('')}</span><span class="barras-cap">notas por día</span>`;
}
const banderaTitulo = h => `<button class="ib" data-reportar-titulo="${h.id}" aria-label="Reportar un error en el nombre de este tema">${ICONO.bandera}</button>`;
const num = h => `<span class="num" aria-label="Puesto ${h.puesto} de la semana">${h.puesto}</span>`;
const ultimaFecha = h => (h.feed[0] && h.feed[0].eventos[0] && h.feed[0].eventos[0].fecha) || D.generado;
function filaHistoria(h, {hora = false, conHoy = false, conNum = true, barras = true, bajada = null, boton = ''} = {}) {
  return `<div class="fila"><a href="#tema/${h.id}"><span class="sup">${conNum ? num(h) : ''}${hora ? `<span>${esc(horaCorta(ultimaFecha(h)))}</span>` : ''}${cap(h)}${h.mano ? '<span class="mano">Unido a mano</span>' : ''}</span>
    <span class="rot">${esc(nombre(h))}</span><span class="baj">${esc(bajada ?? h.ultimo)}</span>${senales(h, conHoy)}${barras ? barritas(h) : ''}</a>
    ${boton}<span class="acc-fila">${boton ? '' : flecha()}${banderaTitulo(h)}</span></div>`;
}
const cabecera = () => `<header class="cab"><h1>Informado</h1><span class="marco">Agrupador de noticias · ${activos()} diarios</span></header>`;
function chipsHTML(secs, actual, cual) {
  return `<div class="chips" role="group" aria-label="Filtrar por sección"><button class="${actual ? '' : 'on'}" data-filtro="" data-cual="${cual}">Todas</button>${secs.map(s =>
    `<button class="${actual === s ? 'on' : ''}" data-filtro="${s}" data-cual="${cual}" style="${estiloSec(s)}">${esc(D.secciones[s])}</button>`).join('')}</div>`;
}

/* ---------- clima, avisos e indicadores ---------- */
// Avisos: hoy y mañana van a «Antes de salir» (y al contador); lo anunciado para más adelante, a «Lo que viene» en la Semana.
const CERCA = {'Hoy': 'hoy', 'Sin paro': 'hoy', 'Mañana': 'manana'};
const avisos = () => (D.tu_dia && D.tu_dia.paros) || [];
const avisosCerca = () => avisos().filter(p => CERCA[p.estado]);
const avisosLejos = () => avisos().filter(p => !CERCA[p.estado]);
const estCls = e => e === 'Sin paro' ? 'ok' : CERCA[e] ? 'urg' : 'prox';
const tituloAviso = p => p.notas[0] ? p.notas[0].titulo : p.quien;
function avisoHTML(p) {
  const vistos = new Set(), ns = p.notas.filter(n => !vistos.has(n.diario) && vistos.add(n.diario));
  return `<div class="av"><span class="tipo"><span class="est ${estCls(p.estado)}">${esc(p.estado)}</span><span class="est">${esc(p.quien)}</span></span><p>${esc(tituloAviso(p))}</p>
    <span class="links">${ns.map(n => `<a class="link" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(nombreDiario(n.diario))} ↗</a>`).join('')}${p.tema_id && DE_TEMA[p.tema_id] ? `<a href="#tema/${DE_TEMA[p.tema_id].id}" style="font-weight:700;text-decoration:none">Ver el tema ›</a>` : ''}</span></div>`;
}
// Alerta oficial del SMN para el AMBA (27/11). Si el SMN no respondió, se usa la señal de los diarios.
function alertaSMN() {
  if (!SMN || !SMN.ok || !SMN.amba || !SMN.amba.length) return '';
  const a = SMN.amba[0], cuando = a.hasta ? ` · hasta las ${horaCorta(a.hasta)} del ${fechaCorta(a.hasta.slice(0, 10))}` : '';
  const titulo = a.nivel ? `Alerta ${a.nivel} por ${a.evento.toLowerCase()} en el AMBA` : (a.titular || `Alerta por ${a.evento.toLowerCase()} en el AMBA`);
  const zonas = a.zonas.slice(0, 4).join(', ') + (a.zonas.length > 4 ? ` y ${a.zonas.length - 4} zonas más` : '');
  return `<div class="alerta">${ICONO.viento}<div><b>${esc(titulo)}</b><span>${esc(zonas)}${esc(cuando)}. <a href="${esc(SMN.url)}" target="_blank" rel="noopener">Ver en el SMN ↗</a></span></div></div>`;
}
function climaHTML() {
  const smn = alertaSMN(), c = D.tu_dia && D.tu_dia.clima;
  if (!c || !c.notas.length) return smn;
  const alertaDiarios = c.alerta_amba && !(SMN && SMN.ok);
  const n = c.notas[0], leer = `<a href="${esc(n.url)}" target="_blank" rel="noopener"${alertaDiarios ? '' : ' class="link"'}>Leer en ${esc(nombreDiario(n.diario))} ↗</a>`;
  if (smn) return smn + `<div class="clima">${ICONO.clima}<div><b>Clima</b><span>${esc(n.titulo)}. ${leer}</span></div></div>`;
  return alertaDiarios ? `<div class="alerta">${ICONO.viento}<div><b>Alerta en el AMBA</b><span>${esc(n.titulo)}. ${leer}</span></div></div>`
    : `<div class="clima">${ICONO.clima}<div><b>Clima</b><span>${esc(n.titulo)}. ${leer}</span></div></div>`;
}
const pesos = v => '$ ' + Number(v).toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 2});
const fechaCorta = iso => iso ? `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}` : '';
const fuenteCorta = f => String(f || '').split(/,? vía | \(/)[0];
function indicadores() {
  if (!IND) return [];
  const {dolar: d, riesgo_pais: r, inflacion: i} = IND, out = [];
  if (d) out.push({n: 'Dólar BNA', v: pesos(d.venta), s: `venta · compra ${pesos(d.compra)}`, f: fuenteCorta(d.fuente), fecha: fechaCorta(d.fecha), u: d.url, viejo: d.actualizado === false});
  if (r) out.push({n: 'Riesgo país', v: Number(r.valor).toLocaleString('es-AR'), s: 'puntos básicos', f: fuenteCorta(r.fuente), fecha: fechaCorta(r.fecha), u: r.url, viejo: r.actualizado === false});
  if (i) out.push({n: 'Inflación', v: String(i.valor).replace('.', ',') + '%', s: `mensual · ${i.mes_nombre || i.mes}`, f: fuenteCorta(i.fuente), fecha: i.mes_nombre || i.mes, u: i.url, viejo: i.actualizado === false});
  return out;
}
const numsHTML = () => { const l = indicadores(); return l.length ? `<div class="nums">${l.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener"><span>${esc(x.n)}</span><b>${esc(x.v)}</b><small class="${x.viejo ? 'viejo' : ''}">${esc(x.f)} ↗</small></a>`).join('')}</div>` : ''; };
function cajaAntes() {
  const c = avisosCerca(), urg = c.filter(p => p.estado !== 'Sin paro'), p0 = urg[0] || c[0];
  return `<section class="cajaav"><a href="#antes"><span class="tx"><b>Antes de salir</b><span>${p0 ? `<span class="tag${p0.estado === 'Sin paro' ? ' ok' : ''}">${esc(p0.estado)}</span>${esc(tituloAviso(p0))}` : 'No hay cortes ni problemas en el transporte anunciados para hoy y mañana.'}</span></span>
    <span class="contador"><b>${c.length}</b>${c.length === 1 ? 'aviso' : 'avisos'}</span>${flecha()}</a>${numsHTML()}</section>`;
}
function regla24() {
  const ahora = horaCorta(new Date().toISOString()), pct = (+ahora.slice(0, 2) * 60 + +ahora.slice(3, 5)) / 1440 * 100;
  return `<div class="regla" role="img" aria-label="Son las ${ahora}"><span class="pasado" style="width:${pct}%"></span><span class="ahora" style="left:${pct}%"><span>Ahora ${ahora}</span></span></div><div class="horas"><span>0 h</span><span>6</span><span>12</span><span>18</span><span>24 h</span></div>`;
}

/* ---------- Hoy ---------- */
function vistaHoy() {
  const vistos = new Set();
  const agenda = (D.hoy.historias || []).map(id => DE_TEMA[id]).filter(h => h && !vistos.has(h.id) && vistos.add(h.id))
    .sort((a, b) => b.hoy - a.hoy || a.puesto - b.puesto).slice(0, 12);
  const secs = Object.keys(D.secciones).filter(s => agenda.some(h => h.seccion === s));
  if (ui.filtroHoy && !secs.includes(ui.filtroHoy)) ui.filtroHoy = null;
  const l = agenda.filter(h => !ui.filtroHoy || h.seccion === ui.filtroHoy);
  app.innerHTML = `${cabecera()}${climaHTML()}${cajaAntes()}
  <section class="d24"><div class="top"><b>Hoy</b><span>${esc(fechaLarga(D.hoy.fecha))} · lo que está en la agenda de los diarios en estas 24 horas</span></div>${regla24()}
    <div class="pie24">Se actualiza cada 2 horas · última actualización: ${esc(horaCorta(D.generado))} (${esc(hace(D.generado))})</div></section>
  ${chipsHTML(secs, ui.filtroHoy, 'filtroHoy')}
  ${l.length ? `<div class="caja">${l.map(h => filaHistoria(h, {hora: true, conNum: false, barras: false, bajada: ultimoDeHoy(h)})).join('')}</div>`
    : '<p class="vacio">Todavía no hay temas cubiertos por dos o más diarios hoy.</p>'}
  <div class="acciones"><a class="btn" href="#semana">Todos los temas de la semana ›</a></div>`;
}
function ultimoDeHoy(h) { const d = h.feed.find(x => x.dia === D.hoy.fecha); return d ? d.eventos[0].titulo : h.ultimo; }
function vistaAntes() {
  const c = avisosCerca(), hoyL = c.filter(p => CERCA[p.estado] === 'hoy'), man = c.filter(p => CERCA[p.estado] === 'manana'), l = indicadores();
  app.innerHTML = `<a class="volver" href="#hoy">${ICONO.atras}Volver</a><div class="tt"><h1>Antes de salir</h1></div>
  <p class="expl">Lo que afecta el tránsito y el transporte para hoy y mañana (cortes, paros de transporte, desvíos), según lo que publicaron los diarios.</p>
  <h3>Hoy</h3><div class="caja">${hoyL.map(avisoHTML).join('') || '<p class="vacio">Nada anunciado para hoy.</p>'}</div>
  <h3>Mañana</h3><div class="caja">${man.map(avisoHTML).join('') || '<p class="vacio">Nada anunciado para mañana.</p>'}</div>
  ${l.length ? `<h3>Los números</h3><div class="caja ind">${l.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener"><span>${esc(x.n)}<small class="link">${esc(x.f)} · ${esc(x.fecha)}${x.viejo ? ' · sin actualizar' : ''} ↗</small></span><b>${esc(x.v)}</b></a>`).join('')}</div>` : ''}
  <p class="expl" style="margin-top:14px">Lo anunciado para más adelante está en <a href="#proximos" style="font-weight:700">Semana › Lo que viene</a>.</p>`;
}
function vistaProximos() {
  const l = avisosLejos();
  app.innerHTML = `<a class="volver" href="#semana">${ICONO.atras}Volver</a><div class="tt"><h1>Lo que viene</h1></div>
  <p class="expl">Cortes y cambios en el tránsito y el transporte anunciados para los próximos días o sin fecha confirmada.</p>
  <div class="caja">${l.map(avisoHTML).join('') || '<p class="vacio">No hay nada anunciado.</p>'}</div>`;
}

/* ---------- Semana ---------- */
function vistaTemas() {
  const c = cur();
  const propuestas = HS.filter(h => propuesta(h) && !contiene(h, c.quitados));
  const sumados = HS.filter(h => !propuesta(h) && contiene(h, c.sumados));
  const afuera = HS.filter(h => !enSemana(h, c) && (contiene(h, listaAfuera()) || contiene(h, c.quitados))).slice(0, 15);
  const secs = Object.keys(D.secciones).filter(s => [...propuestas, ...sumados, ...afuera].some(h => h.seccion === s));
  if (ui.filtro && !secs.includes(ui.filtro)) ui.filtro = null;
  const f = h => !ui.filtro || h.seccion === ui.filtro, lej = avisosLejos(), p0 = lej[0];
  const propios = c.propios.map((p, i) => `<div class="fila"><a href="#buscar/${encodeURIComponent(p)}"><span class="sup"><span class="sec">Tema propio</span></span><span class="rot">${esc(p)}</span><span class="baj">Ver las notas de la semana que coinciden</span></a>
    <button class="sumar" data-quitar-propio="${i}" aria-label="Quitar el tema propio ${esc(p)}">Quitar</button></div>`).join('');
  const tuyos = sumados.filter(f).map(h => filaHistoria(h, {conHoy: true})).join('') + (ui.filtro ? '' : propios);
  app.innerHTML = `${cabecera()}
  <section class="cajaav"><a href="#proximos"><span class="tx"><b>Lo que viene</b><span>${p0 ? `<span class="tag prox">${esc(p0.estado)}</span>${esc(tituloAviso(p0))}` : 'Nada anunciado para los próximos días.'}</span></span>
    <span class="contador"><b>${lej.length}</b>${lej.length === 1 ? 'aviso' : 'avisos'}</span>${flecha()}</a></section>
  <h3>Semana · ${esc(diaSemana(D.semana.desde))} al ${esc(diaSemana(D.semana.hasta))}</h3>
  <div class="agregar"><label>${ICONO.lupa}<input id="nuevo-tema" type="search" placeholder="Buscar o agregar un tema…" autocomplete="off" aria-label="Buscar o agregar un tema"></label><div class="sugs" id="sugs" hidden></div></div>
  ${chipsHTML(secs, ui.filtro, 'filtro')}
  <div class="chips" role="group" aria-label="Ordenar la semana"><button class="${ordenSemana() === 'impacto' ? 'on' : ''}" data-orden="impacto">Por impacto</button><button class="${ordenSemana() === 'variedad' ? 'on' : ''}" data-orden="variedad">Variedad de secciones</button></div>
  <p class="expl">${ordenSemana() === 'variedad' ? 'Hasta dos temas por sección, ordenados por cuántos diarios los cubrieron y cuántas veces fueron tapa.' : 'Los 12 temas que más diarios cubrieron y que más veces fueron tapa.'}</p>
  ${propuestas.filter(f).length ? `<div class="caja">${propuestas.filter(f).map(h => filaHistoria(h, {conHoy: true})).join('')}</div>` : '<p class="vacio">Esta sección no tiene temas entre los de la semana.</p>'}
  <h3>Tu semana</h3>${tuyos ? `<div class="caja">${tuyos}</div>` : '<p class="expl">Sumá temas con «Sumar a mi semana» adentro de cada tema o desde «Lo que quedó afuera», o agregá uno propio con la búsqueda.</p>'}
  <h3>Lo que quedó afuera</h3><p class="expl">${ordenSemana() === 'variedad' ? 'Tuvieron cobertura pero no entraron (su sección ya tenía dos temas), o los sacaste vos.' : 'Tuvieron cobertura pero quedaron después de los 12 primeros, o los sacaste vos.'} Podés sumarlos a tu semana.</p>
  ${afuera.filter(f).length ? `<div class="caja">${afuera.filter(f).map(h => filaHistoria(h, {boton: `<button class="sumar" data-sumar="${h.id}">Sumar</button>`})).join('')}</div>` : '<p class="vacio">Nada de esta sección quedó afuera.</p>'}
  <h3>Cerrar la semana</h3>
  <section class="cierre"><p style="margin:0">Los domingos, revisá la lista y tocá «Enviar mi semana». Lo que sacaste y lo que sumaste le enseña al sistema qué es tema para vos.${c.quitados.length || c.sumados.length ? ` Esta semana: ${c.quitados.length} sacado${c.quitados.length === 1 ? '' : 's'}, ${c.sumados.length} sumado${c.sumados.length === 1 ? '' : 's'}.` : ''}${c.confirmada ? ' Ya la enviaste; podés volver a enviarla.' : ''}${!esNico() && pendientes().length ? ` Además tenés ${plural(pendientes().length, 'reporte', 'reportes')} de errores sin enviar.` : ''}</p>
    <div class="acciones"><button class="btn" data-enviar>${ICONO.check}Enviar mi semana</button>${!esNico() && pendientes().length ? `<button class="btn" data-abrir-envio>${ICONO.bandera}Enviar reportes</button>` : ''}</div></section>`;
}
function sugerirTemas(texto) {
  const caja = document.getElementById('sugs');
  if (!caja) return;
  const v = texto.trim();
  if (!v) { caja.hidden = true; caja.innerHTML = ''; return; }
  const palabras = norm(v).split(/\s+/).filter(w => w.length > 2);
  const c = cur();
  const hits = palabras.length ? HS.filter(h => { const t = norm(nombre(h) + ' ' + h.feed.map(d => d.eventos.map(e => e.titulo).join(' ')).join(' ')); return palabras.every(w => t.includes(w)); }).slice(0, 4) : [];
  caja.innerHTML = hits.map(h => enSemana(h, c)
      ? `<button data-ir="${h.id}">${esc(nombre(h))}<small>${esc(h.seccion_nombre)} · ya está en tu semana · abrir</small></button>`
      : `<button data-sumar="${h.id}" data-limpiar>${esc(nombre(h))}<small>${esc(h.seccion_nombre)} · ${h.n_diarios} diarios · sumar a mi semana</small></button>`).join('') +
    `<button class="propio" data-propio-nuevo>+ Agregar «${esc(v)}» como tema propio</button>`;
  caja.hidden = false;
}

/* ---------- Un tema ---------- */
function notaHistoria(n, conDia) {
  const on = !!fijadas()[n.id];
  return `<div class="hn"><div class="cuerpo"><span class="d"><b>${esc(nombreDiario(n.diario))}</b> · ${esc(horaCorta(n.fecha))}${conDia ? ' · ' + esc(diaSemana(diaAR(n.fecha))) : ''}</span>
    <span class="t">${esc(n.titulo)}</span>${n.bajada ? `<span class="b">${esc(n.bajada)}</span>` : ''}<a class="leer" href="${esc(n.url)}" target="_blank" rel="noopener">Leer en ${esc(nombreDiario(n.diario))} ↗</a></div>
    <span class="acc-fila"><button class="pin${on ? ' on' : ''}" data-pin="${esc(n.id)}" aria-label="${on ? 'Desfijar' : 'Fijar arriba'}">${ICONO.pin}</button>
    <button class="compartir" data-compartir-nota="${esc(n.id)}" aria-label="Compartir esta nota">${ICONO.compartir}</button>
    <button class="flag" data-reportar-nota="${esc(n.id)}" aria-label="Reportar un error con esta nota">${ICONO.bandera}</button></span></div>`;
}
function etiquetaDia(dia) {
  const ayer = new Date(new Date(D.hoy.fecha + 'T12:00:00-03:00') - 864e5).toISOString().slice(0, 10);
  const base = diaSemana(dia); const cap1 = base.charAt(0).toUpperCase() + base.slice(1);
  return dia === D.hoy.fecha ? 'Hoy · ' + cap1 : dia === ayer ? 'Ayer · ' + cap1 : cap1;
}
const notasDe = h => [...new Set(h.feed.flatMap(d => d.eventos.flatMap(e => e.notas)))].map(i => NOTA[i]).filter(Boolean).sort((a, b) => b.fecha.localeCompare(a.fecha));
function grillaHTML(h) {
  const d = dias7(), m = {};
  notasDe(h).forEach(n => { const k = d.indexOf(diaAR(n.fecha)); if (k < 0) return; (m[n.diario] = m[n.diario] || Array(7).fill(0))[k]++; });
  const filas = Object.keys(D.diarios).filter(k => D.diarios[k].activo !== false);
  return `<div class="grilla-w"><table class="grilla" aria-label="Notas por diario y por día"><thead><tr><th></th>${d.map(x => `<th>${letra(x)}</th>`).join('')}</tr></thead><tbody>${filas.map(k => { const v = m[k] || Array(7).fill(0);
    return `<tr><th>${esc(nombreDiario(k))}</th>${v.map((x, i) => `<td><i class="n${Math.min(x, 3)}" title="${esc(nombreDiario(k))}, ${esc(diaSemana(d[i]))}: ${x} notas"></i></td>`).join('')}</tr>`; }).join('')}</tbody></table></div>`;
}
function vistaHistoria(id) {
  const h = H[id] || DE_TEMA[id];
  if (!h) { vistaGuardado(id); return; }
  if (h.id !== id) { location.replace('#tema/' + h.id); return; }
  const c = cur(), g = guardadas().temas[h.id], fij = fijadas(), notas = notasDe(h);
  const pins = Object.keys(fij).filter(i => notas.some(n => n.id === i)).sort((a, b) => fij[b].localeCompare(fij[a])).map(i => NOTA[i]);
  const m = Math.max(...h.dias, 1), d = dias7();
  const titulo = ui.renombrando
    ? `<div class="renombrar"><input id="nuevo-nombre" type="text" value="${esc(nombre(h))}" aria-label="Nombre del tema"><button class="btn" data-guardar-nombre>Listo</button></div>
       <p class="meta" style="margin:0 0 6px">El nombre queda en este celular. Automático: «${esc(h.titulo)}»${nombre(h) !== h.titulo ? ' · <button class="como" data-nombre-auto style="padding:0">volver al automático</button>' : ''}</p>`
    : `<div class="tt"><h1>${esc(nombre(h))}</h1><button class="lapiz" data-renombrar aria-label="Cambiar el nombre del tema">${ICONO.lapiz}</button><button class="compartir" data-compartir-tema="${h.id}" aria-label="Compartir este tema">${ICONO.compartir}</button><button class="flag" data-reportar-titulo="${h.id}" aria-label="Reportar un error en el nombre de este tema">${ICONO.bandera}</button></div>`;
  const opciones = ui.uniendo ? HS.filter(x => x.id !== h.id).slice(0, 40) : [];
  const porDiario = {}; notas.forEach(n => { (porDiario[n.diario] = porDiario[n.diario] || []).push(n); });
  const faltan = Object.keys(D.diarios).filter(k => D.diarios[k].activo !== false && !porDiario[k]);
  const cuerpo = ui.vistaTema === 'diarios'
    ? Object.keys(D.diarios).filter(k => porDiario[k]).map(k => `<div class="dia">${esc(nombreDiario(k))}<span>${plural(porDiario[k].length, 'nota', 'notas')}</span></div><div class="caja">${porDiario[k].slice(0, 3).map(n => notaHistoria(n, true)).join('')}</div>`).join('')
      + (faltan.length ? `<p class="meta" style="margin-top:10px">No lo cubrieron: ${faltan.map(nombreDiario).join(', ')}.</p>` : '')
    : h.feed.map(dia => { const ns = [...new Set(dia.eventos.flatMap(e => e.notas))].map(i => NOTA[i]).filter(Boolean).sort((a, b) => b.fecha.localeCompare(a.fecha));
        return `<div class="dia">${esc(etiquetaDia(dia.dia))}<span>${plural(ns.length, 'nota', 'notas')}</span></div><div class="caja">${ns.map(n => notaHistoria(n, false)).join('')}</div>`; }).join('');
  app.innerHTML = `<a class="volver" href="javascript:history.back()">${ICONO.atras}Volver</a>
  <div>${cap(h)}${h.mano ? ` <span class="mano">Unido a mano · ${h.temas.length} temas</span> <button class="como" data-separar style="padding:0 4px">deshacer</button>` : ''}</div>
  ${titulo}
  <p class="bj"><small>Lo último</small>${esc(h.ultimo)}</p>${senales(h, true)}
  <div class="acciones"><button class="btn${g ? ' on' : ''}" data-guardar-tema="${h.id}">${ICONO.guardar}${g ? 'Guardado' : 'Guardar'}</button>
    <button class="btn${ui.uniendo ? ' on' : ''}" data-unir>${ICONO.unir}Unir con otro tema</button>
    <button class="btn" data-semana="${h.id}">${enSemana(h, c) ? `${ICONO.menos}Sacar de mi semana` : `${ICONO.mas}Sumar a mi semana`}</button></div>
  ${ui.uniendo ? `<section class="unir"><b style="font-size:14px">¿Con qué tema lo unís?</b><input id="buscar-union" type="text" placeholder="Buscar un tema…" autocomplete="off">
    <div id="opciones-union">${opcionesUnion(opciones, '')}</div></section>` : ''}
  <div class="panel"><h3>Notas por día</h3><div class="grande">${h.dias.map(v => `<div><small>${v || ''}</small><i class="${v ? '' : 'z'}" style="height:${v ? Math.max(4, Math.round(90 * v / m)) : 2}px"></i></div>`).join('')}</div>
    <div class="dias7">${d.map((x, k) => k === 6 ? '<b>Hoy</b>' : `<span>${letra(x)}</span>`).join('')}</div></div>
  <div class="panel"><h3>Quién lo cubrió</h3>${grillaHTML(h)}</div>
  ${pins.length ? `<div class="dia">Fijadas por vos<span></span></div><div class="caja">${pins.map(n => notaHistoria(n, true)).join('')}</div>` : ''}
  <div class="tabs" role="tablist"><button role="tab" data-v="historia" aria-selected="${ui.vistaTema !== 'diarios'}">La historia</button><button role="tab" data-v="diarios" aria-selected="${ui.vistaTema === 'diarios'}">Qué dijo cada diario</button></div>${cuerpo}
  <button class="reportar" data-reportar-tema="${h.id}">${ICONO.bandera}Reportar un error en este tema</button>`;
}
function opcionesUnion(lista, texto) {
  const ws = norm(texto).split(/\s+/).filter(w => w.length > 2);
  const hits = (ws.length ? HS.filter(x => x.id !== location.hash.split('/')[1] && ws.every(w => norm(nombre(x) + ' ' + x.ultimo + ' ' + x.titulo).includes(w))) : lista).slice(0, 12);
  return hits.length ? hits.map(x => `<button class="opcion" data-unir-con="${x.id}">${esc(nombre(x))}<small>Nº ${x.puesto} · ${esc(x.seccion_nombre)} · ${esc(x.ultimo).slice(0, 80)}</small></button>`).join('')
    : '<p class="meta">No hay temas con esas palabras.</p>';
}
function vistaGuardado(id) {
  const t = guardadas().temas[id];
  if (!t) { app.innerHTML = `<a class="volver" href="#semana">${ICONO.atras}Volver a la Semana</a><p class="vacio">Este tema ya no está en la semana actual.</p>`; return; }
  app.innerHTML = `<a class="volver" href="#guardadas">${ICONO.atras}Guardadas</a><div><span class="sec" style="${estiloSec(t.seccion)}">${esc(t.seccion_nombre || '')}</span></div>
    <div class="tt"><h1>${esc(t.titulo)}</h1></div><p class="expl">Ya no está en la semana actual. Estas son las notas que tenía cuando lo guardaste.</p>
    <div class="caja">${(t.notas || []).map(n => notaHistoria(n, true)).join('')}</div>`;
}

/* ---------- Guardadas ---------- */
function vistaGuardadas() {
  const g = guardadas(), fij = fijadas();
  const temas = Object.values(g.temas).sort((a, b) => b.guardado.localeCompare(a.guardado));
  const conPins = HS.filter(h => h.feed.some(d => d.eventos.some(e => e.notas.some(i => fij[i]))));
  const viejas = Object.values(g.notas).sort((a, b) => (b.guardada || '').localeCompare(a.guardada || ''));
  const fila = t => H[t.id] || DE_TEMA[t.id] ? filaHistoria(H[t.id] || DE_TEMA[t.id], {conHoy: true})
    : `<div class="fila"><a href="#tema/${t.id}"><span class="sup"><span class="sec" style="${estiloSec(t.seccion)}">${esc(t.seccion_nombre || '')}</span></span><span class="rot">${esc(t.titulo)}</span><span class="baj">Ya no está en la semana actual</span></a><span class="acc-fila">${flecha()}</span></div>`;
  app.innerHTML = `${cabecera()}
  <h3 data-modo-nico>Guardadas · ${plural(temas.length, 'tema', 'temas')}</h3>
  ${temas.length ? `<div class="caja">${temas.map(fila).join('')}</div>` : '<p class="expl">Todavía no guardaste temas. Usá «Guardar» adentro de un tema.</p>'}
  <h3>Temas con notas fijadas · ${conPins.length}</h3>
  ${conPins.length ? `<div class="caja">${conPins.map(h => filaHistoria(h)).join('')}</div>` : '<p class="expl">Fijá una nota con la chincheta adentro de un tema.</p>'}
  ${viejas.length ? `<h3>Notas guardadas · ${viejas.length}</h3><div class="caja">${viejas.map(n => `<div class="hn"><div class="cuerpo"><span class="d"><b>${esc(nombreDiario(n.diario))}</b>${n.tema ? ` · ${esc(n.tema).slice(0, 40)}` : ''}</span><span class="t">${esc(n.titulo)}</span>
      <a class="leer" href="${esc(n.url)}" target="_blank" rel="noopener">Leer en ${esc(nombreDiario(n.diario))} ↗</a></div><span class="acc-fila"><button class="pin on" data-quitar-guardada="${esc(n.id)}" aria-label="Quitar de guardadas">${ICONO.guardar}</button></span></div>`).join('')}</div>` : ''}
  ${reportesGuardadasHTML()}
  <p class="aviso">Todo se guarda en este celular. Las notas se leen siempre en el sitio del diario.</p>`;
}

/* ---------- buscar un tema propio ---------- */
async function vistaBuscar(texto) {
  app.innerHTML = `<a class="volver" href="#semana">${ICONO.atras}Semana</a><div class="tt"><h1>${esc(texto)}</h1></div><p class="cargando">Buscando…</p>`;
  if (!busqueda) busqueda = await (await fetch('datos/notas_semana.json', {cache: 'no-cache'})).json();
  const palabras = norm(texto).split(/\s+/).filter(w => w.length > 2);
  const hits = busqueda.filter(n => { const t = norm(n.t); return palabras.every(w => t.includes(w)); }).slice(0, 60);
  const diarios = new Set(hits.map(n => n.d));
  app.innerHTML = `<a class="volver" href="#semana">${ICONO.atras}Semana</a><div class="tt"><h1>${esc(texto)}</h1></div>
    <p class="expl">${hits.length} notas de ${diarios.size} diarios en la semana · búsqueda en títulos</p>
    ${hits.length ? `<div class="caja">${hits.map(n => `<div class="hn"><div class="cuerpo"><span class="d"><b>${esc(nombreDiario(n.d))}</b> · ${esc(n.f.slice(8, 10) + '/' + n.f.slice(5, 7) + ' ' + n.f.slice(11, 16))}</span><span class="t">${esc(n.t)}</span><a class="leer" href="${esc(n.u)}" target="_blank" rel="noopener">Leer en ${esc(nombreDiario(n.d))} ↗</a></div>
      <span class="acc-fila"><button class="compartir" data-compartir-busqueda="${esc(n.u)}" data-titulo="${esc(n.t)}" data-diario="${esc(n.d)}" aria-label="Compartir esta nota">${ICONO.compartir}</button></span></div>`).join('')}</div>`
      : '<p class="vacio">No hay notas con esas palabras. Probá con menos palabras.</p>'}`;
}

/* ---------- compartir un tema o una nota ---------- */
const DIR_APP = () => location.origin + location.pathname.replace(/index\.html$/, '');
const textoTema = h => `Comparto este tema que sigo en Informado: «${nombre(h)}».\nLo último: ${h.ultimo}\nLo cubren ${h.n_diarios} de ${activos()} diarios.\n\nMirá qué dice cada diario en Informado, el agrupador de noticias: ${DIR_APP()}#tema/${h.id}`;
const textoNota = n => `Comparto esta nota que leí en Informado: «${n.titulo}» (${nombreDiario(n.diario)}).\n${n.url}\n\nInformado junta y compara las noticias de ${activos()} diarios nacionales: ${DIR_APP()}`;
async function compartirContenido(titulo, texto) {
  try { if (navigator.share) { await navigator.share({title: titulo, text: texto}); return; } }
  catch (err) { if (err && err.name === 'AbortError') return; }
  abrirHoja(`<h3>Compartir</h3><textarea id="texto-compartir" readonly style="min-height:150px">${esc(texto)}</textarea>
    <div class="botones"><a class="btn" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">WhatsApp ↗</a><button class="btn" data-copiar-compartir>Copiar</button><button class="btn prim" data-cerrar-hoja>Listo</button></div>`, 'Compartir');
}

/* ---------- reportar un error ---------- */
// Celular de Nico («modo Nico»): la banderita abre GitHub con el error ya escrito (issue con la etiqueta «error»), como siempre.
// Los demás celulares guardan el reporte acá y se lo mandan a Nico con «Enviar reportes» (menú para compartir de Android).
// Nico los carga en su celular (#reportes), los revisa y sube los que sirven, con las etiquetas «error» y «de-otros».
// Una tarea programada los procesa: arregla sola lo chico y le propone a Nico lo estructural (reglas del 25/11 y 27/11, ver CLAUDE.md).
const TIPOS = {
  nota: ['No pertenece a este tema', 'Está en la sección equivocada', 'Es una nota de servicio (clima, dólar, horarios…)', 'Está repetida', 'Otro'],
  tema: ['El nombre está mal', 'Mezcla asuntos distintos', 'Debería unirse con otro tema', 'No es un tema (servicio o poca importancia)', 'Está en la sección equivocada', 'Otro'],
  titulo: ['El nombre está mal', 'Toma una reacción y no el hecho', 'Está cortado o no se entiende', 'Otro'],
};
const esNico = () => leer('modo_nico', false) === true;
const pendientes = () => leer('reportes_pendientes', []);   // reportes hechos en este celular, sin enviar
const recibidos = () => leer('reportes_recibidos', []);     // solo en el celular de Nico: reportes de otros
const miNombre = () => leer('mi_nombre', '');
const nuevoId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
let reporte = null;   // lo que se está reportando: {sobre, h, n, g}
let envio = null;     // lo que se está enviando: {paquete, ids}

function abrirHoja(html, etiqueta) {
  cerrarHoja();
  const velo = document.createElement('div');
  velo.className = 'velo'; velo.id = 'velo-reporte';
  velo.innerHTML = `<div class="hoja" role="dialog" aria-label="${esc(etiqueta)}">${html}</div>`;
  document.body.appendChild(velo);
}
function cerrarHoja() { const v = document.getElementById('velo-reporte'); if (v) v.remove(); }

function abrirReporte(sobre, id) {
  const idVista = location.hash.split('/')[1];
  const g = guardadas().temas[idVista];
  const n = sobre === 'nota' ? (NOTA[id] || ((g && g.notas) || []).find(x => x.id === id) || null) : null;
  const h = sobre === 'nota' ? (H[idVista] || DE_TEMA[TEMA_DE_NOTA[id]] || null) : (H[id] || DE_TEMA[id] || null);
  if (sobre !== 'nota' && !h) return;
  reporte = {sobre, h, n, g: h ? null : g};
  const titulo = h ? nombre(h) : (g ? g.titulo : '');
  const sobreTxt = sobre === 'nota' ? `${nombreDiario(n.diario)}: ${n.titulo}`
    : sobre === 'titulo' ? `«${titulo}»${titulo !== h.titulo ? ` · el automático es «${h.titulo}»` : ''}` : titulo;
  const nico = esNico();
  abrirHoja(`<h3>${{nota: 'Error con esta nota', tema: 'Error con este tema', titulo: 'Error con el nombre del tema'}[sobre]}</h3>
    <p class="sobre">${esc(sobreTxt)}</p>
    ${TIPOS[sobre].map((t, i) => `<label><input type="radio" name="tipo-error" value="${esc(t)}"${i === 0 ? ' checked' : ''}>${esc(t)}</label>`).join('')}
    <textarea id="comentario-error" placeholder="${sobre === 'titulo' ? 'Comentario (opcional): ¿cómo debería llamarse?' : 'Comentario (opcional): qué está mal y cómo debería ser'}"></textarea>
    ${!nico && !miNombre() ? '<input id="nombre-reporte" type="text" placeholder="Tu nombre (para que Nico sepa de quién es)" autocomplete="name">' : ''}
    <p class="meta" style="margin:0">${nico ? 'Se abre GitHub con el error ya escrito: solo tocás «Submit».' : 'Queda guardado en este celular. Cuando quieras, se lo mandás a Nico con «Enviar reportes».'}</p>
    <div class="botones"><button class="btn" data-cerrar-hoja>Cancelar</button><button class="btn prim" data-guardar-reporte>${nico ? 'Enviar a GitHub' : 'Guardar reporte'}</button></div>`, 'Reportar un error');
}
function armarDatos(tipo, comentario) {
  const {sobre, h, n, g} = reporte;
  return {id: nuevoId(), sobre, tipo, comentario,
    historia_id: h ? h.id : (g ? g.id : null), historia_titulo: h ? nombre(h) : (g ? g.titulo : null), rotulo_automatico: h ? h.titulo : null,
    temas: h ? h.temas : (g ? g.temas || [] : []), puesto: h ? h.puesto : null,
    seccion: h ? h.seccion : (g ? g.seccion : null), seccion_nombre: h ? h.seccion_nombre : (g ? g.seccion_nombre : null),
    nota_id: n ? n.id : null, nota_titulo: n ? n.titulo : null, nota_url: n ? n.url : null, diario: n ? n.diario : null,
    datos_generados: D.generado, semana: D.semana.hasta, enviado: new Date().toISOString()};
}
function guardarReporte() {
  const tipo = (document.querySelector('input[name="tipo-error"]:checked') || {}).value || 'Otro';
  const comentario = ((document.getElementById('comentario-error') || {}).value || '').trim();
  const nom = ((document.getElementById('nombre-reporte') || {}).value || '').trim();
  const datos = armarDatos(tipo, comentario);
  cerrarHoja();
  if (esNico()) { abrirIssue(datos); toast('Abriendo GitHub…'); return; }
  if (nom) guardar('mi_nombre', nom);
  const ps = pendientes().concat([datos]);
  guardar('reportes_pendientes', ps);
  toast(`Reporte guardado · ${plural(ps.length, 'sin enviar', 'sin enviar')}`);
  actualizarPildora();
}

// Abre el issue ya escrito. Si el reporte es de otra persona, lleva la etiqueta «de-otros» y su nombre.
function abrirIssue(d) {
  const de = d.reportado_por || null;
  const lineaSobre = d.sobre === 'nota' ? `Nota: ${nombreDiario(d.diario)} · ${d.nota_titulo}\n${d.nota_url}`
    : d.sobre === 'titulo' ? `Nombre automático: «${d.rotulo_automatico}»${d.historia_titulo !== d.rotulo_automatico ? ` (en el celular figuraba «${d.historia_titulo}»)` : ''}` : '';
  const json = JSON.stringify(d, null, 1).replace(/`/g, '\\u0060');
  const cuerpo = [`**${d.tipo}**`, '', de ? `Reportado por: ${de} (lo revisó y lo subió Nico)` : '', lineaSobre,
    `Tema: ${d.historia_titulo || '—'}${d.puesto ? ` (Nº ${d.puesto}, ${d.seccion_nombre})` : ''}`, '',
    d.comentario ? `Comentario: ${d.comentario}` : '', '', '<!-- datos para la tarea de errores -->', '```json', json, '```'].join('\n');
  const titulo = `Error: ${d.tipo} · ${String(d.nota_titulo || d.historia_titulo || '').slice(0, 70)}${de ? ` · de ${de}` : ''}`;
  window.open(`https://github.com/${REPO}/issues/new?labels=${de ? 'error,de-otros' : 'error'}&title=${encodeURIComponent(titulo)}&body=${encodeURIComponent(cuerpo)}`, '_blank', 'noopener');
}

/* --- enviar los reportes a Nico (celulares que no son el de Nico) --- */
function abrirEnvio() {
  const ps = pendientes();
  if (!ps.length) { toast('No hay reportes sin enviar'); return; }
  abrirHoja(`<h3>Enviar reportes a Nico</h3>
    <p class="sobre">${plural(ps.length, 'reporte guardado', 'reportes guardados')} en este celular.</p>
    <div class="lista-rep">${ps.map(r => `<div class="rep"><span><b>${esc(r.tipo)}</b><small>${esc(r.nota_titulo || r.historia_titulo || '')}</small></span>
      <button class="flag" data-borrar-pendiente="${esc(r.id)}" aria-label="Borrar este reporte">✕</button></div>`).join('')}</div>
    <input id="nombre-envio" type="text" value="${esc(miNombre())}" placeholder="Tu nombre" autocomplete="name" aria-label="Tu nombre">
    <p class="meta" style="margin:0">Se abre el menú para compartir: elegí WhatsApp, Gmail o lo que uses para mandárselo a Nico.</p>
    <div class="botones"><button class="btn" data-cerrar-hoja>Cancelar</button><button class="btn prim" data-compartir>Compartir</button></div>
    <button class="como" data-copiar-envio>¿No se abre el menú? Copiar el texto</button>`, 'Enviar reportes');
}
function armarEnvio() {
  const nom = ((document.getElementById('nombre-envio') || {}).value || '').trim() || miNombre() || 'sin nombre';
  if (nom !== 'sin nombre') guardar('mi_nombre', nom);
  const ps = pendientes();
  return {paquete: {informado_reportes: 1, de: nom, enviado: new Date().toISOString(), reportes: ps.map(r => ({...r, reportado_por: nom}))}, ids: ps.map(r => r.id)};
}
const textoPaquete = p => `Reportes de Informado · de ${p.de} · ${plural(p.reportes.length, 'reporte', 'reportes')}\n`
  + 'Para Nico: abrí Informado › Guardadas › Cargar reportes recibidos y pegá este mensaje entero (o cargá el archivo).\n\n' + JSON.stringify(p);
const nombreArchivo = p => `informado-reportes-${norm(p.de).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'anonimo'}-${p.enviado.slice(0, 10)}.txt`;
async function compartir(e) {
  envio = e;
  const texto = textoPaquete(e.paquete);
  // Android solo comparte ciertos tipos de archivo: .txt sí, .json no. Adentro va el JSON.
  const archivo = typeof File === 'function' ? new File([texto], nombreArchivo(e.paquete), {type: 'text/plain'}) : null;
  try {
    if (archivo && navigator.canShare && navigator.canShare({files: [archivo]})) await navigator.share({files: [archivo], title: 'Reportes de Informado'});
    else if (navigator.share) await navigator.share({title: 'Reportes de Informado', text: texto});
    else { mostrarTexto(); return; }
    terminarEnvio();
  } catch (err) {
    if (err && err.name === 'AbortError') return;   // cerró el menú sin elegir
    mostrarTexto();
  }
}
function mostrarTexto() {
  abrirHoja(`<h3>Copiá y mandale este texto a Nico</h3>
    <p class="meta" style="margin:0">Pegalo en WhatsApp, un mail o donde quieras.</p>
    <textarea id="texto-envio" readonly style="min-height:140px;font-size:12px">${esc(textoPaquete(envio.paquete))}</textarea>
    <div class="botones"><button class="btn" data-copiar-texto>Copiar</button><button class="btn prim" data-ya-enviado>Ya se lo mandé</button></div>`, 'Copiar reportes');
}
async function copiarTexto() {
  const t = document.getElementById('texto-envio'); if (!t) return;
  try { await navigator.clipboard.writeText(t.value); } catch (e) { t.select(); try { document.execCommand('copy'); } catch (e2) {} }
  toast('Texto copiado');
}
function terminarEnvio() {
  const ids = new Set(envio.ids);
  guardar('reportes_pendientes', pendientes().filter(r => !ids.has(r.id)));
  guardar('reportes_ultimo_envio', envio.paquete);
  cerrarHoja(); envio = null; toast('¡Gracias! Reportes enviados'); actualizarPildora();
  if (location.hash.startsWith('#guardadas')) render();
}

/* --- cargar los reportes recibidos (celular de Nico) --- */
const CAMPOS = ['id', 'sobre', 'tipo', 'comentario', 'historia_id', 'historia_titulo', 'rotulo_automatico', 'temas', 'puesto', 'seccion', 'seccion_nombre',
  'nota_id', 'nota_titulo', 'nota_url', 'diario', 'datos_generados', 'semana', 'enviado', 'reportado_por'];
function leerPaquete(texto) {
  const i = texto.indexOf('{'), j = texto.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('No encontré reportes en ese texto.');
  let p;
  try { p = JSON.parse(texto.slice(i, j + 1)); } catch (e) { throw new Error('El texto está incompleto: pedí que te lo vuelvan a mandar.'); }
  if (!p || !Array.isArray(p.reportes)) throw new Error('No encontré reportes en ese texto.');
  return p;
}
function limpiarReporte(x, de) {
  const r = {};
  CAMPOS.forEach(k => {
    const v = x[k];
    if (k === 'temas') r.temas = Array.isArray(v) ? v.filter(t => typeof t === 'string').slice(0, 50).map(t => t.slice(0, 80)) : [];
    else if (k === 'puesto') r.puesto = Number.isFinite(v) ? v : null;
    else r[k] = typeof v === 'string' ? v.slice(0, k === 'comentario' ? 1500 : 300) : null;
  });
  if (r.nota_url && !/^https:\/\//.test(r.nota_url)) r.nota_url = null;
  if (!TIPOS[r.sobre]) r.sobre = 'tema';
  r.tipo = r.tipo || 'Otro';
  r.reportado_por = (r.reportado_por || de || 'sin nombre').slice(0, 60);
  return r;
}
function cargarPaquete(texto) {
  const p = leerPaquete(texto);
  const de = typeof p.de === 'string' ? p.de : '';
  const lista = recibidos(), ya = new Set(lista.map(r => r.id));
  let nuevos = 0;
  p.reportes.forEach(x => {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || ya.has(x.id)) return;
    lista.push({...limpiarReporte(x, de), estado: 'nuevo', cargado: new Date().toISOString()}); ya.add(x.id); nuevos++;
  });
  guardar('reportes_recibidos', lista);
  toast(nuevos ? `${plural(nuevos, 'reporte nuevo', 'reportes nuevos')} de ${de || 'sin nombre'}` : 'Esos reportes ya estaban cargados');
  render(); actualizarPildora();
}
function sobreReporte(r) {
  return r.sobre === 'nota' ? `${nombreDiario(r.diario)}: ${r.nota_titulo || ''}` : r.sobre === 'titulo' ? `Nombre: «${r.rotulo_automatico || r.historia_titulo || ''}»` : `Tema: ${r.historia_titulo || ''}`;
}
const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-AR', {day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ}) : '';
function tarjetaReporte(r, acciones) {
  return `<div class="rep-c"><span class="rep-de">${esc(r.reportado_por || 'Vos')} · ${esc(fechaHora(r.enviado))}</span><b>${esc(r.tipo)}</b>
    <span class="sobre">${esc(sobreReporte(r))}</span>${r.historia_titulo && r.sobre === 'nota' ? `<small class="meta">Tema: ${esc(r.historia_titulo)}</small>` : ''}
    ${r.comentario ? `<p class="rep-com">«${esc(r.comentario)}»</p>` : ''}${r.nota_url ? `<a class="leer" href="${esc(r.nota_url)}" target="_blank" rel="noopener">Ver la nota ↗</a>` : ''}
    ${acciones}</div>`;
}
function vistaReportes() {
  if (!esNico()) { location.replace('#guardadas'); return; }
  const lista = recibidos(), nuevos = lista.filter(r => r.estado === 'nuevo'), viejos = lista.filter(r => r.estado !== 'nuevo').reverse(), propios = pendientes();
  app.innerHTML = `<a class="volver" href="#guardadas">‹ Guardadas</a>
  <header class="cab" style="padding-top:4px"><h1>Reportes recibidos</h1></header>
  <p class="meta" style="margin:0 4px 10px">Te los mandan por WhatsApp, mail o Bluetooth. Cargalos acá, revisalos y subí a GitHub los que sirvan.</p>
  <section class="carga"><label class="btn">Elegir el archivo<input type="file" id="archivo-reportes" accept=".txt,.json,text/plain,application/json" hidden></label>
    <textarea id="texto-reportes" placeholder="…o pegá acá el mensaje que te mandaron"></textarea>
    <button class="btn" data-cargar-texto>Cargar el texto pegado</button></section>
  ${propios.length ? `<section class="seccion"><div class="titulo"><span class="etq" style="color:var(--gris)">Tuyos, guardados en este celular · ${propios.length}</span></div>
    ${propios.map(r => tarjetaReporte(r, `<div class="botones"><button class="btn" data-borrar-pendiente="${esc(r.id)}">Borrar</button><button class="btn prim" data-subir-propio="${esc(r.id)}">Subir a GitHub</button></div>`)).join('')}</section>` : ''}
  <section class="seccion"><div class="titulo"><span class="etq" style="color:var(--gris)">Para revisar · ${nuevos.length}</span></div>
    ${nuevos.length ? nuevos.map(r => tarjetaReporte(r, `<div class="botones"><button class="btn" data-descartar="${esc(r.id)}">Descartar</button><button class="btn prim" data-subir="${esc(r.id)}">Subir a GitHub</button></div>`)).join('')
      : '<p class="vacio">No hay reportes para revisar.</p>'}</section>
  ${viejos.length ? `<details class="afuera revisados"><summary><span class="tx"><b>Ya revisados · ${viejos.length}</b><small>Subidos a GitHub o descartados.</small></span></summary>
    ${viejos.map(r => tarjetaReporte(r, `<small class="meta">${r.estado === 'subido' ? 'Subido a GitHub' : 'Descartado'}</small>`)).join('')}
    <button class="como" data-borrar-revisados>Borrar esta lista</button></details>` : ''}
  <p class="aviso">Cada reporte sube como un issue con las etiquetas «error» y «de-otros» y el nombre de quien lo mandó. Después lo procesa la tarea de errores, igual que los tuyos.</p>`;
}
function marcarRecibido(id, estado) {
  const lista = recibidos(); const r = lista.find(x => x.id === id); if (!r) return null;
  r.estado = estado; guardar('reportes_recibidos', lista); return r;
}

/* --- la píldora flotante y el modo Nico --- */
function actualizarPildora() {
  let p = document.getElementById('pildora-reportes');
  const vista = (location.hash.slice(1) || 'hoy').split('/')[0];
  const n = D ? (esNico() ? pendientes().length + recibidos().filter(r => r.estado === 'nuevo').length : pendientes().length) : 0;
  if (!n || vista === 'reportes') { if (p) p.remove(); document.body.classList.remove('con-pildora'); return; }
  if (!p) {
    p = document.createElement('button'); p.id = 'pildora-reportes'; p.className = 'pildora';
    p.addEventListener('click', () => { if (esNico()) location.hash = '#reportes'; else abrirEnvio(); });
    document.body.appendChild(p);
  }
  const domingo = new Date().toLocaleDateString('en-US', {weekday: 'short', timeZone: TZ}) === 'Sun';
  p.innerHTML = ICONO.bandera + esc(esNico() ? `Reportes para subir · ${n}` : domingo ? `Es domingo: enviá tus reportes · ${n}` : `Enviar reportes · ${n}`);
  p.classList.toggle('domingo', domingo && !esNico());
  document.body.classList.add('con-pildora');
}
function cambiarModoNico(si) {
  guardar('modo_nico', si);
  toast(si ? 'Modo Nico: los reportes van directo a GitHub' : 'Modo Nico apagado: los reportes se guardan en el celular');
  render();
}
let toquesNico = [];
function toqueNico() {
  const ahora = Date.now();
  toquesNico = toquesNico.filter(t => ahora - t < 3000).concat([ahora]);
  if (toquesNico.length >= 5) { toquesNico = []; cambiarModoNico(!esNico()); }
}
function reportesGuardadasHTML() {
  if (esNico()) {
    const n = recibidos().filter(r => r.estado === 'nuevo').length + pendientes().length;
    return `<section class="cierre"><b>Reportes de otros</b><p>${n ? `${plural(n, 'reporte', 'reportes')} para revisar.` : 'Cuando alguien te mande sus reportes, cargalos acá.'}</p>
      <a class="btn" href="#reportes">Cargar reportes recibidos</a></section>`;
  }
  const n = pendientes().length, u = leer('reportes_ultimo_envio', null);
  return `<section class="cierre"><b>Reportes de errores</b><p>${n ? `Tenés ${plural(n, 'reporte', 'reportes')} sin enviar.` : 'Usá la banderita para avisar de un error. Los reportes quedan guardados acá hasta que se los mandes a Nico.'}</p>
    ${n ? '<button class="btn" data-abrir-envio>Enviar reportes</button>' : ''}
    ${!n && u ? `<button class="como" data-reenviar style="padding:0">Volver a mandar el último envío (${plural(u.reportes.length, 'reporte', 'reportes')}, ${esc(fechaCorta(u.enviado))})</button>` : ''}</section>`;
}
document.body.addEventListener('click', e => {
  if (!e.target.closest('.velo')) return;
  if (e.target.classList.contains('velo') || e.target.closest('[data-cerrar-hoja]')) { cerrarHoja(); return; }
  const el = e.target.closest('button'); if (!el) return;
  const ds = el.dataset;
  if ('guardarReporte' in ds) { guardarReporte(); return; }
  if (ds.borrarPendiente) { guardar('reportes_pendientes', pendientes().filter(r => r.id !== ds.borrarPendiente)); actualizarPildora(); if (pendientes().length) abrirEnvio(); else cerrarHoja(); render(); return; }
  if ('compartir' in ds) { compartir(armarEnvio()); return; }
  if ('copiarEnvio' in ds) { envio = armarEnvio(); mostrarTexto(); return; }
  if ('copiarTexto' in ds) { copiarTexto(); return; }
  if ('yaEnviado' in ds) { terminarEnvio(); return; }
  if ('copiarCompartir' in ds) { const t = document.getElementById('texto-compartir'); if (t) { navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t.value).catch(() => {}) : (t.select(), document.execCommand('copy')); toast('Texto copiado'); } return; }
});

/* ---------- acciones ---------- */
function alternarSemana(id) {
  const h = H[id] || DE_TEMA[id]; if (!h) return;
  const c = cur(), t = h.temas;
  if (enSemana(h, c)) {
    c.sumados = c.sumados.filter(x => !t.includes(x));
    if (propuesta(h) && !contiene(h, c.quitados)) c.quitados.push(h.id);
    toast('Sacado de tu semana');
  } else {
    c.quitados = c.quitados.filter(x => !t.includes(x));
    if (!propuesta(h)) c.sumados.push(h.id);
    toast('Sumado a tu semana');
  }
  setCur(c);
}
function alternarGuardado(id) {
  const h = H[id]; if (!h) return;
  const g = guardadas();
  if (g.temas[h.id]) { delete g.temas[h.id]; toast('Tema quitado de Guardadas'); }
  else {
    const notas = h.feed.flatMap(d => d.eventos.flatMap(e => e.notas)).map(i => NOTA[i]).filter(Boolean).slice(0, 60);
    g.temas[h.id] = {id: h.id, titulo: nombre(h), seccion: h.seccion, seccion_nombre: h.seccion_nombre, temas: h.temas, guardado: new Date().toISOString(), notas};
    toast('Tema guardado');
  }
  guardar('guardadas', g);
}
function enviarSemana() {
  const c = cur();
  const linea = id => { const h = H[id] || DE_TEMA[id]; return h ? `- ${nombre(h)} (Nº ${h.puesto}, ${h.seccion}, id ${h.id})` : `- id ${id}`; };
  const propuestos = listaPropuestos();
  const confirmados = propuestos.filter(i => { const h = DE_TEMA[i]; return h && enSemana(h, c); });
  const misUniones = uniones(), misNombres = nombres();
  const cuerpo = [
    `Semana del ${D.semana.desde} al ${D.semana.hasta} · datos generados ${D.generado}`, '',
    `### Confirmados (${confirmados.length} de ${propuestos.length})`, ...confirmados.map(linea), '',
    `### Sacados (${c.quitados.length})`, ...c.quitados.map(linea), '',
    `### Sumados (${c.sumados.length})`, ...c.sumados.map(linea), '',
    `### Temas propios (${c.propios.length})`, ...c.propios.map(p => `- ${p}`), '',
    `### Uniones hechas a mano (${misUniones.length})`, ...misUniones.map(([a, b]) => `- ${linea(a).slice(2)} + ${linea(b).slice(2)}`), '',
    '### Comentarios', '(opcional: escribí acá lo que quieras)', '',
    '<!-- datos para el calibrador -->', '```json',
    JSON.stringify({semana: D.semana.hasta, orden: ordenSemana(), propuestos, quitados: c.quitados, sumados: c.sumados, propios: c.propios, uniones: misUniones, nombres: misNombres, confirmada: new Date().toISOString()}), '```',
  ].join('\n');
  c.confirmada = new Date().toISOString(); setCur(c);
  const url = `https://github.com/${REPO}/issues/new?labels=curaduria&title=${encodeURIComponent('Curaduría semana ' + D.semana.hasta)}&body=${encodeURIComponent(cuerpo)}`;
  window.open(url, '_blank', 'noopener');
}
function recargar() { prepararHistorias(); const y = scrollY; render(); scrollTo(0, y); }

/* ---------- eventos ---------- */
app.addEventListener('click', e => {
  if (e.target.closest('[data-modo-nico]')) { toqueNico(); return; }
  const el = e.target.closest('button');
  if (!el) return;
  const ds = el.dataset;
  if ('abrir' in ds) { const f = el.parentElement; const ab = f.classList.toggle('abierta'); el.setAttribute('aria-expanded', ab); return; }
  if ('ev' in ds) { el.parentElement.classList.toggle('abierta'); return; }
  if (ds.orden) { guardar('orden_semana', ds.orden); recargar(); return; }
  if (ds.filtro !== undefined) { ui[ds.cual === 'filtroHoy' ? 'filtroHoy' : 'filtro'] = ds.filtro || null; recargar(); return; }
  if (ds.v) { ui.vistaTema = ds.v; recargar(); return; }
  if (ds.compartirTema) { const h = H[ds.compartirTema] || DE_TEMA[ds.compartirTema]; if (h) compartirContenido('Informado · ' + nombre(h), textoTema(h)); return; }
  if (ds.compartirNota) { const t = guardadas().temas[location.hash.split('/')[1]]; const n = NOTA[ds.compartirNota] || ((t && t.notas) || []).find(x => x.id === ds.compartirNota); if (n) compartirContenido('Informado · ' + n.titulo, textoNota(n)); return; }
  if (ds.compartirBusqueda) { compartirContenido('Informado · ' + ds.titulo, textoNota({titulo: ds.titulo, url: ds.compartirBusqueda, diario: ds.diario})); return; }
  if (ds.ir) { location.hash = '#tema/' + ds.ir; return; }
  if (ds.sumar) { e.preventDefault(); alternarSemana(ds.sumar); if ('limpiar' in ds) { const i = document.getElementById('nuevo-tema'); if (i) i.value = ''; } recargar(); return; }
  if ('propioNuevo' in ds) { const v = (document.getElementById('nuevo-tema') || {}).value; if (v && v.trim()) { const c = cur(); c.propios.push(v.trim()); setCur(c); toast('Tema propio agregado'); recargar(); } return; }
  if (ds.quitarPropio !== undefined) { const c = cur(); c.propios.splice(+ds.quitarPropio, 1); setCur(c); recargar(); return; }
  if ('enviar' in ds) { enviarSemana(); recargar(); return; }
  if (ds.semana) { alternarSemana(ds.semana); recargar(); return; }
  if (ds.guardarTema) { alternarGuardado(ds.guardarTema); recargar(); return; }
  if (ds.pin) { const f = fijadas(); if (f[ds.pin]) { delete f[ds.pin]; toast('Nota desfijada'); } else { f[ds.pin] = new Date().toISOString(); toast('Nota fijada arriba'); } guardar('fijadas', f); recargar(); return; }
  if ('renombrar' in ds) { ui.renombrando = true; render(); const i = document.getElementById('nuevo-nombre'); if (i) { i.focus(); i.select(); } return; }
  if ('guardarNombre' in ds || 'nombreAuto' in ds) {
    const h = H[location.hash.split('/')[1]]; const n = nombres();
    h.temas.forEach(t => delete n[t]);
    const v = 'guardarNombre' in ds ? document.getElementById('nuevo-nombre').value.trim() : '';
    if (v && v !== h.titulo) n[h.id] = v;
    guardar('nombres', n); ui.renombrando = false; toast(v ? 'Nombre guardado' : 'Vuelve el nombre automático'); recargar(); return;
  }
  if ('unir' in ds) { ui.uniendo = !ui.uniendo; render(); const i = document.getElementById('buscar-union'); if (i) i.focus(); return; }
  if (ds.unirCon) {
    const h = H[location.hash.split('/')[1]], otro = H[ds.unirCon];
    if (h && otro) { guardar('uniones', uniones().concat([[h.id, otro.id]])); ui.uniendo = false; toast('Temas unidos'); prepararHistorias(); location.hash = '#tema/' + DE_TEMA[h.id].id; render(); }
    return;
  }
  if ('separar' in ds) { const h = H[location.hash.split('/')[1]]; guardar('uniones', uniones().filter(([a, b]) => !h.temas.includes(a) && !h.temas.includes(b))); toast('Unión deshecha'); prepararHistorias(); location.hash = '#tema/' + DE_TEMA[h.temas[0]].id; render(); return; }
  if (ds.reportarNota) { abrirReporte('nota', ds.reportarNota); return; }
  if (ds.reportarTema) { abrirReporte('tema', ds.reportarTema); return; }
  if (ds.reportarTitulo) { e.preventDefault(); abrirReporte('titulo', ds.reportarTitulo); return; }
  if ('abrirEnvio' in ds) { abrirEnvio(); return; }
  if ('reenviar' in ds) { const u = leer('reportes_ultimo_envio', null); if (u) compartir({paquete: u, ids: []}); return; }
  if (ds.borrarPendiente) { guardar('reportes_pendientes', pendientes().filter(r => r.id !== ds.borrarPendiente)); toast('Reporte borrado'); recargar(); actualizarPildora(); return; }
  if (ds.subirPropio) { const r = pendientes().find(x => x.id === ds.subirPropio); if (r) { abrirIssue(r); guardar('reportes_pendientes', pendientes().filter(x => x.id !== r.id)); toast('Abriendo GitHub…'); recargar(); actualizarPildora(); } return; }
  if (ds.subir) { const r = marcarRecibido(ds.subir, 'subido'); if (r) { abrirIssue(r); toast('Abriendo GitHub…'); recargar(); actualizarPildora(); } return; }
  if (ds.descartar) { marcarRecibido(ds.descartar, 'descartado'); toast('Reporte descartado'); recargar(); actualizarPildora(); return; }
  if ('cargarTexto' in ds) { const t = (document.getElementById('texto-reportes') || {}).value || ''; try { cargarPaquete(t); } catch (err) { toast(err.message); } return; }
  if ('borrarRevisados' in ds) { guardar('reportes_recibidos', recibidos().filter(r => r.estado === 'nuevo')); render(); return; }
  if (ds.quitarGuardada) { const g = guardadas(); delete g.notas[ds.quitarGuardada]; guardar('guardadas', g); render(); return; }
});
app.addEventListener('toggle', e => {
  if (!e.target.classList || !e.target.classList.contains('afuera') || e.target.classList.contains('revisados')) return;
  ui.afuera = e.target.open;
  const t = e.target.querySelector('.ver-txt'); if (t) t.textContent = e.target.open ? 'Ocultar' : 'Ver';
}, true);
app.addEventListener('change', async e => {
  if (e.target.id !== 'archivo-reportes' || !e.target.files || !e.target.files[0]) return;
  try { cargarPaquete(await e.target.files[0].text()); } catch (err) { toast(err.message || 'No se pudo leer el archivo'); }
  e.target.value = '';
});
app.addEventListener('input', e => {
  if (e.target.id === 'nuevo-tema') sugerirTemas(e.target.value);
  if (e.target.id === 'buscar-union') document.getElementById('opciones-union').innerHTML = opcionesUnion(HS.filter(x => x.id !== location.hash.split('/')[1]).slice(0, 40), e.target.value);
});
app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'nuevo-tema') { const b = app.querySelector('[data-propio-nuevo]'); if (b) b.click(); }
  if (e.key === 'Enter' && e.target.id === 'nuevo-nombre') { const b = app.querySelector('[data-guardar-nombre]'); if (b) b.click(); }
});

/* ---------- navegación ---------- */
function render() {
  const [vista, arg] = (location.hash.slice(1) || 'hoy').split('/');
  if (vista !== 'tema') { ui.renombrando = false; ui.uniendo = false; }
  const nav = {hoy: 'hoy', antes: 'hoy', semana: 'semana', proximos: 'semana', tema: 'semana', buscar: 'semana', guardadas: 'guardadas', reportes: 'guardadas'}[vista] || 'hoy';
  document.querySelectorAll('.barra a').forEach(a => { if (a.dataset.vista === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  // Direcciones viejas (Temas, Armá, modo lectura) llevan a la Semana.
  if (['temas', 'curar', 'leer'].includes(vista)) { location.replace('#semana'); return; }
  if (vista === 'semana') vistaTemas();
  else if (vista === 'antes') vistaAntes();
  else if (vista === 'proximos') vistaProximos();
  else if (vista === 'tema') vistaHistoria(arg);
  else if (vista === 'guardadas') vistaGuardadas();
  else if (vista === 'reportes') vistaReportes();
  else if (vista === 'buscar') vistaBuscar(decodeURIComponent(arg || ''));
  else vistaHoy();
  actualizarPildora();
}
window.addEventListener('hashchange', () => { ui.renombrando = false; ui.uniendo = false; cerrarHoja(); render(); window.scrollTo(0, 0); });

async function iniciar() {
  // Modo Nico por enlace: …/informado/?soy=nico lo prende y ?soy=otro lo apaga (también: 5 toques en «Guardadas»).
  const soy = new URLSearchParams(location.search).get('soy');
  if (soy === 'nico' || soy === 'otro') { guardar('modo_nico', soy === 'nico'); history.replaceState(null, '', location.pathname + location.hash); setTimeout(() => toast(soy === 'nico' ? 'Modo Nico: los reportes van directo a GitHub' : 'Modo Nico apagado'), 600); }
  try {
    const r = await fetch('datos/actual.json', {cache: 'no-cache'});
    D = await r.json();
    IND = await fetch('datos/indicadores.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
    SMN = await fetch('datos/alertas_smn.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
    prepararHistorias();
    render();
  } catch (e) {
    app.innerHTML = '<p class="vacio">No se pudieron cargar los datos. Revisá la conexión y volvé a abrir la app.</p>';
  }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
iniciar();
