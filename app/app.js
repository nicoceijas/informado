/* Informado · app del celular. Sin dependencias.
 * Lee datos/actual.json (generado cada 2 h por GitHub Actions).
 * Pantallas: Hoy (Tu día + agenda), Temas (historias de 7 días) y Guardadas.
 * Lo que hace el usuario (sacar, sumar, unir, renombrar, fijar, guardar, reportes sin enviar) vive en este dispositivo (localStorage).
 * Diseño aprobado por Nico el 25/11 (maqueta final, sin modo lectura).
 */
'use strict';
const REPO = 'nicoceijas/informado';
const COLOR = {politica:'var(--politica)',economia:'var(--economia)',sindicales:'var(--sindicales)',
  internacionales:'var(--internacionales)',ciudad:'var(--ciudad)',futbol:'var(--futbol)'};
const CLARO = {politica:'#E8EEFC',economia:'#E3F4F1',sindicales:'#FEF0E1',internacionales:'#F1EAFE',ciudad:'#FCE7F1',futbol:'#E4F4E9'};
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
const ui = {filtro: null, como: false, afuera: false, renombrando: false, uniendo: false};
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
  flecha: '<svg class="flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>',
  lapiz: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  unir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8M8 17h8M18 7v10"/><circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2"/></svg>',
  diario: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
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
const propuesta = h => contiene(h, D.semana.propuestos);
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
const cap = h => `<span class="cap" style="color:${COLOR[h.seccion] || 'var(--gris)'};background:${CLARO[h.seccion] || '#ECEDEA'}">${esc(h.seccion_nombre)}</span>`;
const senales = h => `<span class="senal">${ICONO.diario}${h.n_diarios} de ${activos()} diarios</span>${h.tapas ? `<span class="senal">${ICONO.tapa}En la tapa de ${h.tapas}</span>` : ''}`;
function barritas(h) { const m = Math.max(...h.dias, 1); return `<span class="barritas" aria-label="Notas por día">${h.dias.map(v => `<i class="${v ? '' : 'cero'}" style="height:${Math.max(3, 14 * v / m)}px"></i>`).join('')}</span>`; }
const banderaTitulo = h => `<button class="flag" data-reportar-titulo="${h.id}" aria-label="Reportar un error en el nombre de este tema">${ICONO.bandera}</button>`;
const num = h => `<span class="num" style="background:${COLOR[h.seccion] || 'var(--gris)'}" aria-label="Puesto ${h.puesto} de la semana">${h.puesto}</span>`;
const botonComo = () => `<button class="como" data-como>${ICONO.info}${ui.como ? 'Ocultar la explicación' : '¿Qué significa el número?'}</button>${ui.como ? `<div class="explica">
  <p><b>El número es el puesto del tema en la semana.</b> Muestra hacia dónde va la agenda de los diarios, según dos cosas:</p>
  <p><b>Repercusión (60%):</b> cuántos diarios lo cubren, durante cuántos días y con cuántas notas.</p>
  <p style="margin:0"><b>Jerarquía (40%):</b> qué tan arriba lo ponen en su portada y si sale en la edición impresa.</p></div>` : ''}`;
function filaHistoria(h, {conCap = false, boton = ''} = {}) {
  const a = `<a class="fl-cab" href="#tema/${h.id}">${num(h)}
    <span class="tx"><b>${esc(nombre(h))}</b><span class="ult">${esc(h.ultimo)}</span>
    <small>${conCap ? cap(h) : ''}${h.hoy ? `<span class="estado nuevo">+${h.hoy} hoy</span>` : ''}${h.mano ? '<span class="estado mano">Unido a mano</span>' : ''}${senales(h)}</small>
    <small>${h.n_notas} notas · desde el ${esc(diaSemana(h.desde))} ${barritas(h)}</small></span>${boton ? '' : ICONO.flecha}</a>`;
  return `<div class="fl"><div class="fila-acc">${a}${boton}${banderaTitulo(h)}</div></div>`;
}

/* ---------- Tu día ---------- */
const ICO_TD = {
  clima: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 2A3 3 0 0 0 7 18z"/></svg>',
  dolar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M16 7.5c0-1.9-1.8-3-4-3s-4 1.1-4 3 1.8 2.6 4 3 4 1.2 4 3.2-1.8 3-4 3-4-1.1-4-3"/></svg>',
  paros: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="13" rx="3"/><path d="M4 11h16M8 21l1.5-4M16 21l-1.5-4"/></svg>',
};
const FLECHA_TD = '<svg class="tf-fl" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const notasCompactas = ns => ns.map(n => `<a class="tf-nota" href="${esc(n.url)}" target="_blank" rel="noopener"><span>${esc(nombreDiario(n.diario))} <i>· ${esc(horaCorta(n.fecha))}</i></span>${esc(n.titulo)}</a>`).join('');
const filaTuDia = (ico, titulo, sub, det) => `<div class="tf"><button class="tf-cab" data-abrir aria-expanded="false"><span class="td-ico">${ico}</span><span class="tf-tx"><b>${titulo}</b><small>${sub}</small></span>${FLECHA_TD}</button><div class="tf-det">${det}</div></div>`;
function tuDiaHTML() {
  const t = D.tu_dia;
  if (!t) return '';
  const filas = [], plural = n => n > 1 ? 's' : '';
  if (t.clima.notas.length) filas.push(filaTuDia(ICO_TD.clima, 'Clima',
    `${t.clima.alerta_amba ? '<span class="estado hoy">Alerta en el AMBA</span>' : '<span class="estado">Pronóstico</span>'}${t.clima.notas.length} nota${plural(t.clima.notas.length)}`, notasCompactas(t.clima.notas)));
  if (t.dolar.notas.length) filas.push(filaTuDia(ICO_TD.dolar, 'Dólar', `Cotización del día · ${t.dolar.notas.length} nota${plural(t.dolar.notas.length)}`, notasCompactas(t.dolar.notas)));
  if (t.paros.length) {
    const hoyN = t.paros.filter(p => p.estado === 'Hoy').length;
    const clase = e => e === 'Hoy' ? 'hoy' : (e === 'Sin paro' ? 'ok' : '');
    filas.push(filaTuDia(ICO_TD.paros, 'Paros y transporte',
      `${t.paros.length} asunto${plural(t.paros.length)}${hoyN ? ` · <span class="estado hoy" style="margin:0 0 0 4px">${hoyN} hoy</span>` : ''}`,
      t.paros.map(p => `<div class="evento"><b>${esc(p.quien)}</b><small><span class="estado ${clase(p.estado)}">${esc(p.estado)}</span>${esc(p.notas[0] ? p.notas[0].titulo : '')}</small>
        <details><summary>${p.notas.length} nota${plural(p.notas.length)} ›</summary>${notasCompactas(p.notas)}${p.tema_id && DE_TEMA[p.tema_id] ? `<a class="tf-nota" href="#tema/${DE_TEMA[p.tema_id].id}" style="color:var(--azul);font-weight:600">Ver el tema ›</a>` : ''}</details></div>`).join('')));
  }
  if (!filas.length) return '';
  return `<section class="tudia" aria-label="Tu día"><h3>Tu día <span>actualizado ${esc(hace(D.generado))}</span></h3>${filas.join('')}</section>`;
}

/* ---------- indicadores ---------- */
const pesos = v => '$ ' + Number(v).toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 2});
const fechaCorta = iso => iso ? `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}` : '';
const fuenteCorta = f => String(f || '').split(/,? vía | \(/)[0];
function indicadoresHTML() {
  if (!IND) return '';
  const tiles = [], viejo = d => d.actualizado === false ? ' · sin actualizar' : '';
  const { dolar: d, riesgo_pais: r, inflacion: i } = IND;
  if (d) tiles.push(`<a class="ind-t" href="${esc(d.url)}" target="_blank" rel="noopener"><span class="ind-n">Dólar BNA</span><span class="ind-v">${esc(pesos(d.venta))}</span><span class="ind-s">venta</span><span class="ind-s">compra ${esc(pesos(d.compra))}</span><span class="ind-f${d.actualizado === false ? ' viejo' : ''}" title="${esc(d.fuente)}">${esc(fuenteCorta(d.fuente))} · ${esc(fechaCorta(d.fecha))}${viejo(d)}</span></a>`);
  if (r) tiles.push(`<a class="ind-t" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="ind-n">Riesgo país</span><span class="ind-v">${esc(Number(r.valor).toLocaleString('es-AR'))}</span><span class="ind-s">puntos básicos</span><span class="ind-f${r.actualizado === false ? ' viejo' : ''}" title="${esc(r.fuente)}">${esc(fuenteCorta(r.fuente))} (EMBI) · ${esc(fechaCorta(r.fecha))}${viejo(r)}</span></a>`);
  if (i) tiles.push(`<a class="ind-t" href="${esc(i.url)}" target="_blank" rel="noopener"><span class="ind-n">Inflación</span><span class="ind-v">${esc(String(i.valor).replace('.', ','))}%</span><span class="ind-s">${esc(i.mes_nombre || i.mes)}</span><span class="ind-f${i.actualizado === false ? ' viejo' : ''}" title="${esc(i.fuente)}">${esc(fuenteCorta(i.fuente))} · mensual${viejo(i)}</span></a>`);
  return tiles.length ? `<section class="ind" aria-label="Indicadores">${tiles.join('')}</section>` : '';
}

/* ---------- Hoy ---------- */
function vistaHoy() {
  const vistos = new Set();
  const agenda = (D.hoy.historias || []).map(id => DE_TEMA[id]).filter(h => h && !vistos.has(h.id) && vistos.add(h.id))
    .sort((a, b) => b.hoy - a.hoy || a.puesto - b.puesto).slice(0, 12);
  app.innerHTML = `
  <header class="cab"><div class="fila"><span class="meta">${esc(fechaLarga(D.hoy.fecha))}</span><span class="meta">Actualizado ${esc(hace(D.generado))}</span></div><h1>Hoy</h1></header>
  ${indicadoresHTML()}
  ${tuDiaHTML()}
  <section class="seccion"><div class="titulo"><h2>En la agenda de hoy</h2><span class="meta">${agenda.length} temas</span></div>
    ${botonComo()}
    ${agenda.length ? `<div class="caja">${agenda.map(h => `<div class="fl"><div class="fila-acc"><a class="fl-cab" href="#tema/${h.id}">${num(h)}
      <span class="tx"><b>${esc(nombre(h))}</b><span class="ult">${esc(ultimoDeHoy(h))}</span>
      <small>${cap(h)}<span class="estado nuevo">${h.hoy} nota${h.hoy > 1 ? 's' : ''} hoy</span>${senales(h)}</small></span>${ICONO.flecha}</a>${banderaTitulo(h)}</div></div>`).join('')}</div>`
      : '<p class="vacio">Todavía no hay temas cubiertos por dos o más diarios hoy.</p>'}
    <a class="btn" href="#temas" style="align-self:flex-start">Todos los temas de la semana ›</a></section>`;
}
function ultimoDeHoy(h) { const d = h.feed.find(x => x.dia === D.hoy.fecha); return d ? d.eventos[0].titulo : h.ultimo; }

/* ---------- Temas ---------- */
function vistaTemas() {
  const c = cur();
  const lista = HS.filter(h => enSemana(h, c));
  const afuera = HS.filter(h => !enSemana(h, c) && (contiene(h, D.semana.afuera || []) || contiene(h, c.quitados))).slice(0, 15);
  const secs = Object.keys(D.secciones).filter(s => lista.some(h => h.seccion === s));
  if (ui.filtro && !secs.includes(ui.filtro)) ui.filtro = null;
  let filas = '';
  secs.filter(s => !ui.filtro || s === ui.filtro).forEach(s => {
    filas += `<div class="grupo" style="color:${COLOR[s] || 'var(--gris)'}">${esc(D.secciones[s])}</div>` + lista.filter(h => h.seccion === s).map(h => filaHistoria(h)).join('');
  });
  if (c.propios.length && !ui.filtro) {
    filas += '<div class="grupo" style="color:var(--gris)">Tus temas</div>' + c.propios.map((p, i) => `<div class="fl"><div class="fila-acc"><a class="fl-cab" href="#buscar/${encodeURIComponent(p)}">
      <span class="num" style="background:var(--gris)">+</span><span class="tx"><b>${esc(p)}</b><small>Tema propio · ver notas que coinciden</small></span></a>
      <button class="btn" data-quitar-propio="${i}" aria-label="Quitar el tema propio ${esc(p)}">Quitar</button></div></div>`).join('');
  }
  const total = lista.length + c.propios.length;
  app.innerHTML = `
  <header class="cab"><div class="fila"><h1>Temas</h1><span class="meta">últimos 7 días</span></div></header>
  <div class="agregar"><input id="nuevo-tema" type="text" placeholder="Agregar un tema…" autocomplete="off" aria-label="Agregar un tema"><div class="sugs" id="sugs" hidden></div></div>
  ${botonComo()}
  <div class="tchips" role="group" aria-label="Filtrar por sección"><button class="${ui.filtro ? '' : 'on'}" data-filtro="">Tu semana · ${total}</button>${secs.map(s => `<button class="${ui.filtro === s ? 'on' : ''}" data-filtro="${s}">${esc(D.secciones[s])}</button>`).join('')}</div>
  ${filas ? `<div class="caja">${filas}</div>` : '<p class="vacio">Tu semana está vacía. Sumá temas desde «Temas que quedaron afuera».</p>'}
  ${afuera.length ? `<details class="afuera"${ui.afuera ? ' open' : ''}><summary><span class="tx"><b>Temas que quedaron afuera · ${afuera.length}</b><small>Tuvieron menos cobertura. Podés sumarlos a tu semana.</small></span>
    <span class="ver"><span class="ver-txt">${ui.afuera ? 'Ocultar' : 'Ver'}</span>${ICONO.abajo}</span></summary>
    <div class="caja">${afuera.map(h => filaHistoria(h, {conCap: true, boton: `<button class="btn" data-sumar="${h.id}">Sumar</button>`})).join('')}</div></details>` : ''}
  <section class="cierre"><b>Cerrar la semana</b><p>Los domingos, revisá la lista y tocá «Enviar mi semana». Lo que sacaste y lo que sumaste le enseña al sistema qué es tema para vos.${c.quitados.length || c.sumados.length ? ` Esta semana: ${c.quitados.length} sacado${c.quitados.length === 1 ? '' : 's'}, ${c.sumados.length} sumado${c.sumados.length === 1 ? '' : 's'}.` : ''}${c.confirmada ? ' Ya la enviaste; podés volver a enviarla.' : ''}${!esNico() && pendientes().length ? ` Además tenés ${plural(pendientes().length, 'reporte', 'reportes')} de errores sin enviar.` : ''}</p>
    <div class="acciones"><button class="btn" data-enviar>Enviar mi semana</button>${!esNico() && pendientes().length ? '<button class="btn" data-abrir-envio style="background:#fff;color:var(--azul)">Enviar reportes</button>' : ''}</div></section>`;
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
  return `<div class="hn"><div class="cuerpo"><span class="d">${esc(nombreDiario(n.diario))} <i>· ${esc(horaCorta(n.fecha))}${conDia ? ' · ' + esc(diaSemana(n.fecha.slice(0, 10))) : ''}</i></span>
    <span class="t">${esc(n.titulo)}</span>${n.bajada ? `<span class="b">${esc(n.bajada)}</span>` : ''}<a class="leer" href="${esc(n.url)}" target="_blank" rel="noopener">Leer en ${esc(nombreDiario(n.diario))} ↗</a></div>
    <span style="display:flex;flex-direction:column"><button class="pin${on ? ' on' : ''}" data-pin="${esc(n.id)}" aria-label="${on ? 'Desfijar' : 'Fijar arriba'}">${ICONO.pin}</button>
    <button class="flag" data-reportar-nota="${esc(n.id)}" aria-label="Reportar un error con esta nota">${ICONO.bandera}</button></span></div>`;
}
function etiquetaDia(dia) {
  const ayer = new Date(new Date(D.hoy.fecha + 'T12:00:00-03:00') - 864e5).toISOString().slice(0, 10);
  const base = diaSemana(dia); const cap1 = base.charAt(0).toUpperCase() + base.slice(1);
  return dia === D.hoy.fecha ? 'Hoy · ' + cap1 : dia === ayer ? 'Ayer · ' + cap1 : cap1;
}
function vistaHistoria(id) {
  const h = H[id] || DE_TEMA[id];
  if (!h) { vistaGuardado(id); return; }
  if (h.id !== id) { location.replace('#tema/' + h.id); return; }
  const c = cur(), g = guardadas().temas[h.id], fij = fijadas();
  const ids = new Set(h.feed.flatMap(d => d.eventos.flatMap(e => e.notas)));
  const pins = Object.keys(fij).filter(i => ids.has(i) && NOTA[i]).sort((a, b) => fij[b].localeCompare(fij[a])).map(i => NOTA[i]);
  const m = Math.max(...h.dias, 1);
  const hoy = new Date(D.hoy.fecha + 'T12:00:00-03:00');
  const letras = h.dias.map((_, k) => DIAS_CORTOS[new Date(hoy - (6 - k) * 864e5).getUTCDay()]);
  const titulo = ui.renombrando
    ? `<div class="renombrar"><input id="nuevo-nombre" type="text" value="${esc(nombre(h))}" aria-label="Nombre del tema"><button class="btn" data-guardar-nombre>Listo</button></div>
       <p class="meta" style="margin:0 0 6px">El nombre queda en este celular. Automático: «${esc(h.titulo)}»${nombre(h) !== h.titulo ? ' · <button class="como" data-nombre-auto style="padding:0">volver al automático</button>' : ''}</p>`
    : `<div class="titulo-tema"><h1>${esc(nombre(h))}</h1><button class="lapiz" data-renombrar aria-label="Renombrar el tema">${ICONO.lapiz}</button><button class="lapiz" data-reportar-titulo="${h.id}" aria-label="Reportar un error en el nombre de este tema">${ICONO.bandera}</button></div>`;
  const opciones = ui.uniendo ? HS.filter(x => x.id !== h.id).slice(0, 40) : [];
  app.innerHTML = `<a class="volver" href="javascript:history.back()">‹ Volver</a>
  <div><span class="etq" style="color:${COLOR[h.seccion] || 'var(--gris)'}">${esc(h.seccion_nombre)}</span>${h.mano ? ` <span class="estado mano" style="margin-left:6px">Unido a mano · ${h.temas.length} temas</span> <button class="como" data-separar style="padding:0 4px">deshacer</button>` : ''}</div>
  ${titulo}
  <p class="ultimo">Lo último: ${esc(h.ultimo)}</p>
  <section class="porque"><span class="tit">Por qué está Nº ${h.puesto} de la semana</span>
    <div class="medida"><div class="fila-m"><span>Repercusión</span><span>${h.convergencia} de 100</span></div><div class="bar"><i style="width:${h.convergencia}%"></i></div><small>Lo cubren ${h.n_diarios} de ${activos()} diarios, durante ${h.n_dias} día${h.n_dias > 1 ? 's' : ''}, con ${h.n_notas} notas.</small></div>
    <div class="medida"><div class="fila-m"><span>Jerarquía</span><span>${h.jerarquia} de 100</span></div><div class="bar"><i style="width:${h.jerarquia}%"></i></div><small>${h.tapas ? `Estuvo en lo más alto de la portada de ${h.tapas} diario${h.tapas > 1 ? 's' : ''}.` : 'No llegó a lo más alto de ninguna portada.'}</small></div>
  </section>
  <p class="meta" style="margin:10px 0 0">Desde el ${esc(diaSemana(h.desde))} · notas por día:</p>
  <div class="dias7">${h.dias.map((v, k) => `<div><i class="${v ? '' : 'cero'}" style="height:${v ? Math.max(6, 38 * v / m) : 3}px" title="${v} notas"></i><span>${letras[k]}</span></div>`).join('')}</div>
  <div class="acciones" style="margin-top:12px"><button class="btn${g ? ' on' : ''}" data-guardar-tema="${h.id}">${ICONO.guardar}${g ? 'Guardado' : 'Guardar'}</button>
    <button class="btn${ui.uniendo ? ' on' : ''}" data-unir>${ICONO.unir}Unir con otro tema</button>
    <button class="btn" data-semana="${h.id}">${enSemana(h, c) ? '− Sacar de mi semana' : '+ Sumar a mi semana'}</button></div>
  ${ui.uniendo ? `<section class="unir"><b style="font-size:14px">¿Con qué tema lo unís?</b><input id="buscar-union" type="text" placeholder="Buscar un tema…" autocomplete="off">
    <div id="opciones-union">${opcionesUnion(opciones, '')}</div></section>` : ''}
  ${pins.length ? `<section class="fijadas"><div class="tit">${ICONO.pin} Fijadas por vos</div>${pins.map(n => notaHistoria(n, true)).join('')}</section>` : ''}
  ${h.feed.map((dia, di) => `<div class="dia-cab"><span>${esc(etiquetaDia(dia.dia))}</span><span style="font-weight:500">${dia.eventos.reduce((a, e) => a + e.notas.length, 0)} notas</span></div>
    ${dia.eventos.map((e, k) => { const ns = e.notas.map(i => NOTA[i]).filter(Boolean); return `<article class="ev${di === 0 && k === 0 ? ' abierta' : ''}"><button class="ev-cab" data-ev><span class="t">${esc(e.titulo)}</span>
      <small>${esc(horaCorta(e.fecha))} · ${ns.length} diario${ns.length > 1 ? 's' : ''} ${ns.map(n => `<span class="dchip">${esc(nombreDiario(n.diario))}</span>`).join('')}</small></button>
      <div class="ev-notas">${ns.map(n => notaHistoria(n, false)).join('')}</div></article>`; }).join('')}`).join('')}
  <p class="aviso">Arriba lo más nuevo; bajando, cómo fue empezando. Tocá una tarjeta para ver qué publicó cada diario, el alfiler para fijar una nota arriba y la banderita para avisar de un error.</p>
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
  if (!t) { app.innerHTML = '<p class="vacio">Este tema ya no está en la semana actual.</p><a class="volver" href="#temas">‹ Volver a Temas</a>'; return; }
  app.innerHTML = `<a class="volver" href="#guardadas">‹ Guardadas</a><span class="etq" style="color:${COLOR[t.seccion] || 'var(--gris)'}">${esc(t.seccion_nombre || '')}</span>
    <h1 style="font-size:25px;line-height:1.2;margin:6px 0">${esc(t.titulo)}</h1><p class="meta">Ya no está en la semana actual. Estas son las notas que tenía cuando lo guardaste.</p>
    <section class="seccion"><div class="caja" style="padding:0 14px">${(t.notas || []).map(n => notaHistoria(n, true)).join('')}</div></section>`;
}

/* ---------- Guardadas ---------- */
function vistaGuardadas() {
  const g = guardadas(), fij = fijadas();
  const temas = Object.values(g.temas).sort((a, b) => b.guardado.localeCompare(a.guardado));
  const conPins = HS.filter(h => h.feed.some(d => d.eventos.some(e => e.notas.some(i => fij[i]))));
  const viejas = Object.values(g.notas).sort((a, b) => (b.guardada || '').localeCompare(a.guardada || ''));
  const fila = t => H[t.id] || DE_TEMA[t.id] ? filaHistoria(H[t.id] || DE_TEMA[t.id], {conCap: true})
    : `<div class="fl"><a class="fl-cab" href="#tema/${t.id}"><span class="tx"><b>${esc(t.titulo)}</b><small>${esc(t.seccion_nombre || '')} · ya no está en la semana actual</small></span>${ICONO.flecha}</a></div>`;
  app.innerHTML = `
  <header class="cab"><h1 data-modo-nico>Guardadas</h1></header>
  <section class="seccion"><div class="titulo"><span class="etq" style="color:var(--gris)">Temas guardados · ${temas.length}</span></div>
    ${temas.length ? `<div class="caja">${temas.map(fila).join('')}</div>` : '<p class="vacio">Todavía no guardaste temas. Usá «Guardar» dentro de un tema.</p>'}</section>
  <section class="seccion"><div class="titulo"><span class="etq" style="color:var(--gris)">Temas con notas fijadas · ${conPins.length}</span></div>
    ${conPins.length ? `<div class="caja">${conPins.map(h => filaHistoria(h, {conCap: true})).join('')}</div>` : '<p class="vacio">Fijá una nota con el alfiler dentro de un tema.</p>'}</section>
  ${viejas.length ? `<section class="seccion"><div class="titulo"><span class="etq" style="color:var(--gris)">Notas guardadas · ${viejas.length}</span></div>
    <div class="caja" style="padding:0 14px">${viejas.map(n => `<div class="hn"><div class="cuerpo"><span class="d">${esc(nombreDiario(n.diario))}${n.tema ? ` <i>· ${esc(n.tema).slice(0, 40)}</i>` : ''}</span><span class="t">${esc(n.titulo)}</span>
      <a class="leer" href="${esc(n.url)}" target="_blank" rel="noopener">Leer en ${esc(nombreDiario(n.diario))} ↗</a></div><button class="pin on" data-quitar-guardada="${esc(n.id)}" aria-label="Quitar de guardadas">${ICONO.guardar}</button></div>`).join('')}</div></section>` : ''}
  ${reportesGuardadasHTML()}
  <p class="aviso">Todo se guarda en este celular. Las notas se leen siempre en el sitio del diario.</p>`;
}

/* ---------- buscar un tema propio ---------- */
async function vistaBuscar(texto) {
  app.innerHTML = `<a class="volver" href="#temas">‹ Temas</a><h1 style="font-size:25px;margin:6px 0">${esc(texto)}</h1><p class="cargando">Buscando…</p>`;
  if (!busqueda) busqueda = await (await fetch('datos/notas_semana.json', {cache: 'no-cache'})).json();
  const palabras = norm(texto).split(/\s+/).filter(w => w.length > 2);
  const hits = busqueda.filter(n => { const t = norm(n.t); return palabras.every(w => t.includes(w)); }).slice(0, 60);
  const diarios = new Set(hits.map(n => n.d));
  app.innerHTML = `<a class="volver" href="#temas">‹ Temas</a><h1 style="font-size:25px;margin:6px 0">${esc(texto)}</h1>
    <p class="meta">${hits.length} notas de ${diarios.size} diarios en la semana · búsqueda en títulos</p>
    ${hits.length ? `<div class="caja" style="padding:0 14px;margin-top:12px">${hits.map(n => `<div class="hn"><div class="cuerpo"><span class="d">${esc(nombreDiario(n.d))} <i>· ${esc(n.f.slice(8, 10) + '/' + n.f.slice(5, 7) + ' ' + n.f.slice(11, 16))}</i></span><span class="t">${esc(n.t)}</span><a class="leer" href="${esc(n.u)}" target="_blank" rel="noopener">Leer en ${esc(nombreDiario(n.d))} ↗</a></div></div>`).join('')}</div>`
      : '<p class="vacio">No hay notas con esas palabras. Probá con menos palabras.</p>'}`;
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
  const propuestos = D.semana.propuestos;
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
    JSON.stringify({semana: D.semana.hasta, propuestos, quitados: c.quitados, sumados: c.sumados, propios: c.propios, uniones: misUniones, nombres: misNombres, confirmada: new Date().toISOString()}), '```',
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
  if ('como' in ds) { ui.como = !ui.como; recargar(); return; }
  if (ds.filtro !== undefined) { ui.filtro = ds.filtro || null; render(); return; }
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
  const nav = {hoy: 'hoy', temas: 'temas', tema: 'temas', buscar: 'temas', guardadas: 'guardadas', reportes: 'guardadas'}[vista] || 'hoy';
  document.querySelectorAll('.barra a').forEach(a => { if (a.dataset.vista === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  // Direcciones viejas (Semana, Armá, modo lectura) llevan a Temas.
  if (['semana', 'curar', 'leer'].includes(vista)) { location.replace('#temas'); return; }
  if (vista === 'temas') vistaTemas();
  else if (vista === 'tema') vistaHistoria(arg);
  else if (vista === 'guardadas') vistaGuardadas();
  else if (vista === 'reportes') vistaReportes();
  else if (vista === 'buscar') vistaBuscar(decodeURIComponent(arg || ''));
  else vistaHoy();
  actualizarPildora();
}
window.addEventListener('hashchange', () => { ui.renombrando = false; ui.uniendo = false; render(); window.scrollTo(0, 0); });

async function iniciar() {
  // Modo Nico por enlace: …/informado/?soy=nico lo prende y ?soy=otro lo apaga (también: 5 toques en «Guardadas»).
  const soy = new URLSearchParams(location.search).get('soy');
  if (soy === 'nico' || soy === 'otro') { guardar('modo_nico', soy === 'nico'); history.replaceState(null, '', location.pathname + location.hash); setTimeout(() => toast(soy === 'nico' ? 'Modo Nico: los reportes van directo a GitHub' : 'Modo Nico apagado'), 600); }
  try {
    const r = await fetch('datos/actual.json', {cache: 'no-cache'});
    D = await r.json();
    IND = await fetch('datos/indicadores.json', {cache: 'no-cache'}).then(x => x.ok ? x.json() : null).catch(() => null);
    prepararHistorias();
    render();
  } catch (e) {
    app.innerHTML = '<p class="vacio">No se pudieron cargar los datos. Revisá la conexión y volvé a abrir la app.</p>';
  }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
iniciar();
