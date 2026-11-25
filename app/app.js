/* Informado · app del celular. Sin dependencias.
 * Lee datos/actual.json (generado cada 2 h por GitHub Actions).
 * La curaduría y las guardadas viven en este dispositivo (localStorage).
 */
'use strict';
const REPO = 'nicoceijas/informado';
const COLOR = {politica:'var(--politica)',economia:'var(--economia)',sindicales:'var(--sindicales)',
  internacionales:'var(--internacionales)',ciudad:'var(--ciudad)',futbol:'var(--futbol)'};
const DIAS = ['D','L','M','M','J','V','S'];
let D = null;            // datos
let T = {};              // temas por id
let busqueda = null;     // notas de la semana para la búsqueda (carga diferida)
const app = document.getElementById('app');

/* ---------- utilidades ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const leer = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch (e) { return def; } };
const nombreDiario = k => (D.diarios[k] || {}).nombre || k;
const hora = iso => new Date(iso).toLocaleString('es-AR', {weekday:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'America/Argentina/Buenos_Aires'});
const fechaLarga = iso => { const f = new Date(iso + 'T12:00:00-03:00').toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', timeZone:'America/Argentina/Buenos_Aires'}); return f.charAt(0).toUpperCase() + f.slice(1); };
const fechaCorta = iso => new Date(iso + 'T12:00:00-03:00').toLocaleDateString('es-AR', {day:'numeric', month:'short', timeZone:'America/Argentina/Buenos_Aires'});
const hace = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`; };
function toast(txt) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = txt; document.body.appendChild(t); setTimeout(() => t.remove(), 1800); }
const ICONO = {
  guardar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  libro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0zM12 5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0z"/></svg>',
};

/* ---------- curaduría y guardadas ---------- */
const claveCur = () => 'cur:' + D.semana.hasta;
function cur() { return leer(claveCur(), {quitados: [], sumados: [], propios: [], confirmada: null}); }
function setCur(c) { guardar(claveCur(), c); }
function temasDeMiSemana() {
  const c = cur();
  const ids = D.semana.propuestos.filter(i => !c.quitados.includes(i)).concat(c.sumados.filter(i => T[i]));
  return [...new Set(ids)].map(i => T[i]).filter(Boolean);
}
const guardadas = () => leer('guardadas', {notas: {}, temas: {}});
function alternarNota(n, tema) {
  const g = guardadas();
  if (g.notas[n.id]) delete g.notas[n.id];
  else g.notas[n.id] = {...n, tema: tema ? tema.titulo : '', seccion: tema ? tema.seccion : '', guardada: new Date().toISOString(), leida: false};
  guardar('guardadas', g);
  toast(g.notas[n.id] ? 'Nota guardada' : 'Nota quitada');
  return !!g.notas[n.id];
}
function alternarTema(t) {
  const g = guardadas();
  if (g.temas[t.id]) delete g.temas[t.id];
  else g.temas[t.id] = {id: t.id, titulo: t.titulo, seccion: t.seccion, seccion_nombre: t.seccion_nombre, guardado: new Date().toISOString(), notas: t.notas};
  guardar('guardadas', g);
  toast(g.temas[t.id] ? 'Tema guardado' : 'Tema quitado');
  return !!g.temas[t.id];
}

/* ---------- piezas ---------- */
function tarjetaTema(t, extra = '') {
  const pct = Math.max(4, Math.min(100, t.puntaje));
  const tapas = t.n_tapas_home ? ` · arriba en ${t.n_tapas_home} home${t.n_tapas_home > 1 ? 's' : ''}` : '';
  return `<a class="tarjeta" href="#tema/${t.id}">
    <span class="etq" style="color:${COLOR[t.seccion] || 'var(--gris)'};letter-spacing:0;text-transform:none">${esc(t.seccion_nombre)}</span>
    <span class="t">${esc(t.titulo)}</span>
    <span class="meta">${t.diarios.length} diarios · ${Object.keys(t.dias).length} días · ${t.n_notas} notas${tapas}</span>
    <span class="barra-p" aria-label="Puntaje ${t.puntaje} de 100"><span style="width:${pct}%;background:${COLOR[t.seccion] || 'var(--gris)'}"></span></span>
    ${t.en_seguimiento ? '<span class="tag seg">En seguimiento</span>' : ''}${extra}
  </a>`;
}
function filaDiarios() {
  return `<div class="chips" aria-label="Ir a los diarios">${Object.entries(D.diarios).filter(([, d]) => d.activo !== false)
    .map(([, d]) => `<a class="chip" href="${esc(d.home)}" target="_blank" rel="noopener">${esc(d.nombre)}</a>`).join('')}</div>`;
}
function notaHTML(n, tema) {
  const g = guardadas().notas[n.id];
  const etiq = [n.edicion_impresa ? '<span class="tag imp">EDICIÓN IMPRESA</span>' : '',
    n.home_mejor_pos && n.home_mejor_pos <= 10 ? '<span class="tag imp">ARRIBA EN LA HOME</span>' : ''].join('');
  return `<article class="nota">
    <div class="top"><strong style="font-size:13px">${esc(nombreDiario(n.diario))}</strong><span class="meta">· ${esc(hora(n.fecha))}</span>${etiq}</div>
    <span class="t">${esc(n.titulo)}</span>
    ${n.bajada ? `<span class="b">${esc(n.bajada)}</span>` : ''}
    <div class="pie"><a href="${esc(n.url)}" target="_blank" rel="noopener">Leer en ${esc(nombreDiario(n.diario))} ↗</a>
    <button class="icono${g ? ' on' : ''}" aria-label="${g ? 'Quitar de guardadas' : 'Guardar nota'}" data-guardar-nota="${esc(n.id)}" data-tema="${tema ? esc(tema.id) : ''}">${ICONO.guardar}</button></div>
  </article>`;
}

/* ---------- vistas ---------- */
function vistaHoy() {
  const c = cur();
  const hoy = D.hoy.temas.map(i => T[i]).filter(t => t && !c.quitados.includes(t.id)).slice(0, 12);
  const afecta = D.afecta.map(a => `<a class="tarjeta" href="${a.tema_id ? '#tema/' + a.tema_id : esc(a.nota.url)}" ${a.tema_id ? '' : 'target="_blank" rel="noopener"'}>
      <span class="top" style="display:flex;gap:6px;align-items:center"><span class="tag ${a.cuando === 'mañana' ? 'hoy' : 'hoy2'}">${a.cuando.toUpperCase()}</span><span class="meta">${esc(nombreDiario(a.nota.diario))}</span></span>
      <span style="font-size:15px;font-weight:700;line-height:1.35">${esc(a.nota.titulo)}</span>
      <span class="meta">${esc(a.motivo.join(' · '))}</span></a>`).join('');
  app.innerHTML = `
  <header class="cab"><div class="fila"><span class="meta">${esc(fechaLarga(D.hoy.fecha))}</span><span class="meta">Actualizado ${esc(hace(D.generado))}</span></div>
    <h1>Hoy</h1></header>
  ${filaDiarios()}
  ${D.tu_dia ? tuDiaHTML() : afecta ? `<section class="afecta" aria-label="Afecta tu día"><div class="cab2">${ICONO.alerta}<span>Afecta tu día · ${D.afecta.length}</span></div>${afecta}</section>` : ''}
  <section class="seccion"><div class="titulo"><h2>Temas de hoy</h2><span class="meta">${hoy.length} temas</span></div>
    ${hoy.length ? hoy.map(t => tarjetaTema(t)).join('') : '<p class="vacio">Todavía no hay temas cubiertos por dos o más diarios hoy.</p>'}</section>
  <section class="seccion"><a class="tarjeta oscuro" href="#semana"><span style="font-size:15px;font-weight:700">Tu semana</span><span class="b">${temasDeMiSemana().length} temas del ${esc(fechaCorta(D.semana.desde))} al ${esc(fechaCorta(D.semana.hasta))} ›</span></a></section>`;
}

function vistaSemana() {
  const c = cur();
  const mios = temasDeMiSemana();
  const porSec = {};
  mios.forEach(t => (porSec[t.seccion] = porSec[t.seccion] || []).push(t));
  const orden = Object.keys(D.secciones);
  const propios = c.propios.map(p => `<a class="tarjeta" href="#buscar/${encodeURIComponent(p)}"><span class="etq" style="color:var(--gris);text-transform:none;letter-spacing:0">Tema propio</span><span class="t">${esc(p)}</span><span class="meta">Ver notas que coinciden ›</span></a>`).join('');
  app.innerHTML = `
  <header class="cab"><div class="fila"><h1>Semana</h1><span class="meta">${esc(fechaCorta(D.semana.desde))} – ${esc(fechaCorta(D.semana.hasta))}</span></div>
    <span class="meta">Criterio: ${esc(D.semana.criterio)}${c.confirmada ? ' · curada por vos' : ' · propuesta automática'}</span></header>
  <a class="tarjeta azul" href="#curar"><span style="font-size:15px;font-weight:700">Armá tu semana</span><span class="b">Sacá o sumá temas. Se guarda en este celular.</span></a>
  ${orden.filter(s => porSec[s]).map(s => `<section class="seccion"><div class="titulo"><span class="etq" style="color:${COLOR[s]}">${esc(D.secciones[s])}</span></div>${porSec[s].map(t => tarjetaTema(t)).join('')}</section>`).join('')}
  ${propios ? `<section class="seccion"><div class="titulo"><span class="etq" style="color:var(--gris)">Tus temas</span></div>${propios}</section>` : ''}
  <section class="seccion"><div class="titulo"><h2>Más temas de la semana</h2></div>
    <div class="lista">${D.temas.filter(t => !mios.includes(t)).slice(0, 25).map(t => `<div class="it"><a class="txt" href="#tema/${t.id}" style="padding-left:10px"><b>${esc(t.titulo)}</b><small>${esc(t.seccion_nombre)} · ${t.diarios.length} diarios · puntaje ${t.puntaje}</small></a></div>`).join('')}</div></section>
  <p class="aviso">Un tema es un grupo de notas de al menos dos diarios que hablan de lo mismo. Puntaje: 60% convergencia (cuántos diarios, días y notas) + 40% jerarquía (lugar en la home y edición impresa).</p>`;
}

/* ---------- pantalla Temas y «Tu día» (aprobadas por Nico el 25/11) ---------- */
let filtroTemas = null;
const horaCorta = iso => new Date(iso).toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires'});
const FLECHA = '<svg class="tf-fl" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const ICO_TD = {
  clima: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 2A3 3 0 0 0 7 18z"/></svg>',
  dolar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M16 7.5c0-1.9-1.8-3-4-3s-4 1.1-4 3 1.8 2.6 4 3 4 1.2 4 3.2-1.8 3-4 3-4-1.1-4-3"/></svg>',
  paros: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="13" rx="3"/><path d="M4 11h16M8 21l1.5-4M16 21l-1.5-4"/></svg>',
};
function notasCompactas(ns) {
  return ns.map(n => `<a class="tf-nota" href="${esc(n.url)}" target="_blank" rel="noopener"><span>${esc(nombreDiario(n.diario))} <i>· ${esc(horaCorta(n.fecha))}</i></span>${esc(n.titulo)}</a>`).join('');
}
function filaTuDia(ico, titulo, sub, det) {
  return `<div class="tf"><button class="tf-cab" data-abrir aria-expanded="false"><span class="td-ico">${ico}</span><span class="tf-tx"><b>${titulo}</b><small>${sub}</small></span>${FLECHA}</button><div class="tf-det">${det}</div></div>`;
}
function tuDiaHTML() {
  const t = D.tu_dia;
  if (!t) return '';
  const filas = [];
  if (t.clima.notas.length) filas.push(filaTuDia(ICO_TD.clima, 'Clima',
    `${t.clima.alerta_amba ? '<span class="estado hoy">Alerta en el AMBA</span>' : '<span class="estado">Pronóstico</span>'}${t.clima.notas.length} nota${t.clima.notas.length > 1 ? 's' : ''}`,
    notasCompactas(t.clima.notas)));
  if (t.dolar.notas.length) filas.push(filaTuDia(ICO_TD.dolar, 'Dólar', `Cotización del día · ${t.dolar.notas.length} nota${t.dolar.notas.length > 1 ? 's' : ''}`, notasCompactas(t.dolar.notas)));
  if (t.paros.length) {
    const hoyN = t.paros.filter(p => p.estado === 'Hoy').length;
    const clase = e => e === 'Hoy' ? 'hoy' : (e === 'Sin paro' ? 'ok' : '');
    filas.push(filaTuDia(ICO_TD.paros, 'Paros y transporte',
      `${t.paros.length} asunto${t.paros.length > 1 ? 's' : ''}${hoyN ? ` · <span class="estado hoy" style="margin:0 0 0 4px">${hoyN} hoy</span>` : ''}`,
      t.paros.map(p => `<div class="evento"><b>${esc(p.quien)}</b><small><span class="estado ${clase(p.estado)}">${esc(p.estado)}</span>${esc(p.notas[0] ? p.notas[0].titulo : '')}</small>
        <details><summary>${p.notas.length} nota${p.notas.length > 1 ? 's' : ''} ›</summary>${notasCompactas(p.notas)}${p.tema_id && T[p.tema_id] ? `<a class="tf-nota" href="#tema/${p.tema_id}" style="color:var(--azul);font-weight:600">Ver el tema completo ›</a>` : ''}</details></div>`).join('')));
  }
  if (!filas.length) return '';
  return `<section class="tudia" aria-label="Tu día"><h3>Tu día <span>actualizado ${esc(hace(D.generado))}</span></h3>${filas.join('')}</section>`;
}
function filaTema(t, i, c) {
  const porDiario = {};
  t.notas.forEach(n => { if (!porDiario[n.diario]) porDiario[n.diario] = n; });
  const accion = D.semana.propuestos.includes(t.id) ? `<button class="btn" data-quitar="${t.id}">Sacar de mi semana</button>`
    : c.sumados.includes(t.id) ? `<button class="btn" data-sumar="${t.id}">Sacar de mi semana</button>`
    : `<button class="btn" data-sumar="${t.id}">Sumar a mi semana</button>`;
  return `<div class="tf"><button class="tf-cab" data-abrir aria-expanded="false">
    <span class="tf-num" style="background:${COLOR[t.seccion] || 'var(--gris)'}">${i}</span>
    <span class="tf-tx"><b>${esc(t.titulo)}</b><small>${esc(t.seccion_nombre)} · ${t.diarios.length} diarios · ${t.n_notas} notas</small></span>${FLECHA}</button>
    <div class="tf-det">${notasCompactas(Object.values(porDiario))}
      <div class="tf-acc"><a class="btn" href="#tema/${t.id}">Tema completo ›</a><a class="btn" href="#leer/${t.id}/0">${ICONO.libro}Modo lectura</a>${accion}</div></div></div>`;
}
function vistaTemas(modo) {
  modo = modo === 'semana' ? 'semana' : 'hoy';
  const c = cur();
  const lista = modo === 'semana' ? temasDeMiSemana()
    : D.hoy.temas.map(i => T[i]).filter(t => t && !c.quitados.includes(t.id)).slice(0, 12);
  const propios = modo === 'semana' ? c.propios : [];
  const secs = Object.keys(D.secciones).filter(s => lista.some(t => t.seccion === s));
  if (filtroTemas && !secs.includes(filtroTemas)) filtroTemas = null;
  let filas = '';
  secs.filter(s => !filtroTemas || s === filtroTemas).forEach(s => {
    filas += `<div class="tgrupo" style="color:${COLOR[s] || 'var(--gris)'}">${esc(D.secciones[s])}</div>` +
      lista.filter(t => t.seccion === s).map(t => filaTema(t, lista.indexOf(t) + 1, c)).join('');
  });
  if (propios.length && !filtroTemas) {
    filas += '<div class="tgrupo" style="color:var(--gris)">Tus temas</div>' + propios.map(p => `<div class="tf tf-propio"><a class="tf-cab" href="#buscar/${encodeURIComponent(p)}" style="text-decoration:none">
      <span class="tf-num">+</span><span class="tf-tx"><b>${esc(p)}</b><small>Tema propio · ver notas que coinciden</small></span>${FLECHA}</a></div>`).join('');
  }
  const total = lista.length + propios.length;
  app.innerHTML = `
  <header class="cab"><div class="fila"><h1>Temas</h1><span class="meta">${modo === 'semana' ? `${esc(fechaCorta(D.semana.desde))} – ${esc(fechaCorta(D.semana.hasta))}` : esc(fechaLarga(D.hoy.fecha))}</span></div></header>
  <nav class="segt" aria-label="Período"><a href="#temas/hoy" ${modo === 'hoy' ? 'aria-current="page"' : ''}>Hoy</a><a href="#temas/semana" ${modo === 'semana' ? 'aria-current="page"' : ''}>Semana</a></nav>
  <div class="agregar"><input id="nuevo-tema" type="text" placeholder="Agregar un tema…" autocomplete="off" aria-label="Agregar un tema"><div class="sugs" id="sugs" hidden></div></div>
  ${modo === 'hoy' ? tuDiaHTML() : ''}
  ${total ? `<div class="tchips" role="group" aria-label="Filtrar por sección" style="margin-top:12px"><button class="${filtroTemas ? '' : 'on'}" data-filtro="">Todos · ${total}</button>${secs.map(s => `<button class="${filtroTemas === s ? 'on' : ''}" data-filtro="${s}">${esc(D.secciones[s])}</button>`).join('')}</div>
  <div class="tlista">${filas}</div>` : '<p class="vacio">Todavía no hay temas cubiertos por dos o más diarios.</p>'}
  <p class="aviso">Tocá un tema para ver una nota por diario. El número es su puesto y el color, su sección.</p>`;
}
function sugerirTemas(texto) {
  const caja = document.getElementById('sugs');
  if (!caja) return;
  const v = texto.trim();
  if (!v) { caja.hidden = true; caja.innerHTML = ''; return; }
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const palabras = norm(v).split(/\s+/).filter(w => w.length > 2);
  const mios = new Set(temasDeMiSemana().map(t => t.id));
  const hits = palabras.length ? D.temas.filter(t => !mios.has(t.id) && palabras.every(w => norm(t.titulo + ' ' + t.notas.map(n => n.titulo).join(' ')).includes(w))).slice(0, 4) : [];
  caja.innerHTML = hits.map(t => `<button data-sumar-sug="${t.id}">${esc(t.titulo)}<small>${esc(t.seccion_nombre)} · ${t.diarios.length} diarios · sumar a mi semana</small></button>`).join('') +
    `<button class="propio" data-propio-nuevo>+ Agregar «${esc(v)}» como tema propio</button>`;
  caja.hidden = false;
}

function vistaTema(id) {
  const t = T[id];
  if (!t) { app.innerHTML = '<p class="vacio">Este tema ya no está en la semana actual.</p><a class="volver" href="#semana">‹ Volver a Semana</a>'; return; }
  const g = guardadas().temas[id];
  const maxDia = Math.max(...Object.values(t.dias));
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(new Date(D.semana.hasta + 'T12:00:00-03:00') - i * 864e5);
    const k = d.toISOString().slice(0, 10), v = t.dias[k] || 0;
    dias.push(`<div><i class="${v ? '' : 'cero'}" style="height:${v ? Math.max(8, 44 * v / maxDia) : 3}px" title="${v} notas"></i><span>${DIAS[d.getUTCDay()]}</span></div>`);
  }
  const porDiario = {};
  t.notas.forEach(n => (porDiario[n.diario] = porDiario[n.diario] || []).push(n));
  const bloques = Object.entries(porDiario).map(([d, ns]) => notaHTML(ns[0], t) +
    (ns.length > 1 ? `<details><summary class="mas" style="list-style:none;text-align:center">${ns.length - 1} nota${ns.length > 2 ? 's' : ''} más de ${esc(nombreDiario(d))}</summary><div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">${ns.slice(1).map(n => notaHTML(n, t)).join('')}</div></details>` : '')).join('');
  const activos = Object.values(D.diarios).filter(d => d.activo !== false).length;
  app.innerHTML = `
  <a class="volver" href="javascript:history.back()">‹ Volver</a>
  <span class="etq" style="color:${COLOR[t.seccion] || 'var(--gris)'}">${esc(t.seccion_nombre)}</span>
  <h1 style="font-size:25px;line-height:1.2;margin:6px 0">${esc(t.titulo)}</h1>
  <p class="meta" style="margin:0 0 10px">${t.diarios.length} diarios · ${t.n_notas} notas · ${t.terminos.map(esc).join(' · ')}</p>
  <div class="acciones"><a class="btn" href="#leer/${t.id}/0">${ICONO.libro}Modo lectura</a><button class="btn${g ? ' on' : ''}" data-guardar-tema="${t.id}">${ICONO.guardar}${g ? 'Guardado' : 'Guardar tema'}</button>
    ${t.en_seguimiento ? '<span class="btn on">En seguimiento</span>' : ''}</div>
  <section class="seccion"><div class="tarjeta" style="gap:10px"><strong style="font-size:13px">Por qué es tema</strong>
    <span class="b">Lo cubrieron ${t.diarios.length} de ${activos} diarios en ${Object.keys(t.dias).length} días. Puntaje ${t.puntaje} de 100: convergencia ${t.convergencia}, jerarquía ${t.jerarquia}.</span>
    <div class="dias" aria-label="Notas por día">${dias.join('')}</div></div></section>
  <section class="seccion"><div class="titulo"><h2>Cómo lo contó cada diario</h2></div>${bloques}</section>`;
}

function vistaCurar() {
  const c = cur();
  const filas = D.semana.propuestos.map(i => T[i]).filter(Boolean).map(t => {
    const on = !c.quitados.includes(t.id);
    return `<div class="it ${on ? '' : 'quitado'}"><button class="check ${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${on ? 'Quitar' : 'Volver a sumar'}: ${esc(t.titulo)}" data-quitar="${t.id}"><span>${on ? ICONO.check : ''}</span></button>
      <a class="txt" href="#tema/${t.id}"><b>${esc(t.titulo)}</b><small>${esc(t.seccion_nombre)} · ${t.diarios.length} diarios · puntaje ${t.puntaje}</small></a></div>`;
  }).join('');
  const candidatos = D.temas.filter(t => !D.semana.propuestos.includes(t.id)).slice(0, 15).map(t => {
    const on = c.sumados.includes(t.id);
    return `<div class="it"><button class="check ${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${on ? 'Quitar' : 'Sumar'}: ${esc(t.titulo)}" data-sumar="${t.id}"><span>${on ? ICONO.check : ''}</span></button>
      <a class="txt" href="#tema/${t.id}"><b>${esc(t.titulo)}</b><small>${esc(t.seccion_nombre)} · ${t.diarios.length} diarios · puntaje ${t.puntaje}</small></a></div>`;
  }).join('');
  const propios = c.propios.map((p, i) => `<div class="it"><button class="check on" aria-label="Quitar tema propio: ${esc(p)}" data-propio="${i}"><span>${ICONO.check}</span></button><a class="txt" href="#buscar/${encodeURIComponent(p)}"><b>${esc(p)}</b><small>Tema propio · ver notas ›</small></a></div>`).join('');
  const n = D.semana.propuestos.length - c.quitados.length;
  app.innerHTML = `
  <header class="cab"><h1 style="font-size:28px">Armá tu semana</h1>
    <span class="meta">Propuesta del ${esc(fechaCorta(D.semana.desde))} al ${esc(fechaCorta(D.semana.hasta))}. Tocá el cuadrado para sacar o volver a sumar.</span></header>
  <section class="seccion"><div class="titulo"><span class="etq" style="color:var(--azul)">Propuestos · ${n} de ${D.semana.propuestos.length}</span></div><div class="lista">${filas}</div></section>
  <section class="seccion"><div class="titulo"><span class="etq" style="color:var(--gris)">Sumar otros temas</span></div><div class="lista">${candidatos}</div></section>
  <section class="seccion"><div class="tarjeta" style="gap:8px"><label class="l" for="propio">Agregar un tema propio</label>
    <div style="display:flex;gap:8px"><input id="propio" type="text" placeholder="Ej.: transporte en el conurbano" autocomplete="off"><button class="btn" data-agregar>Agregar</button></div>
    <span class="meta">Busca notas de la semana que contengan esas palabras.</span></div>
    ${propios ? `<div class="lista">${propios}</div>` : ''}</section>
  <section class="seccion"><button class="btn prim" data-confirmar>${c.confirmada ? 'Semana confirmada ✓ · volver a confirmar' : 'Confirmar mi semana'}</button>
    <button class="btn sec" data-feedback>Enviar feedback al sistema</button>
    <p class="aviso">«Enviar feedback» abre GitHub con tu curaduría ya escrita: solo tocás «Submit». Con eso calibro el algoritmo. Si no confirmás, queda la propuesta automática.</p></section>`;
}

function vistaGuardadas(pestana = 'notas') {
  const g = guardadas();
  const notas = Object.values(g.notas).sort((a, b) => b.guardada.localeCompare(a.guardada));
  const temas = Object.values(g.temas).sort((a, b) => b.guardado.localeCompare(a.guardado));
  const cuerpo = pestana === 'notas'
    ? (notas.length ? notas.map(n => `<article class="nota"><div class="top"><strong style="font-size:13px">${esc(nombreDiario(n.diario))}</strong>${n.tema ? `<span class="meta">· ${esc(n.tema).slice(0, 40)}</span>` : ''}</div>
        <span class="t" style="${n.leida ? 'color:var(--suave)' : ''}">${esc(n.titulo)}</span>
        <div class="pie"><span class="meta">${n.leida ? 'Leída' : 'Sin leer'}</span><a href="${esc(n.url)}" target="_blank" rel="noopener" data-leida="${esc(n.id)}">Leer ↗</a>
        <button class="icono on" aria-label="Quitar de guardadas" data-quitar-guardada="${esc(n.id)}">${ICONO.guardar}</button></div></article>`).join('')
      : '<p class="vacio">Todavía no guardaste notas. Tocá el ícono de marcador en cualquier nota.</p>')
    : (temas.length ? temas.map(t => `<a class="tarjeta" href="${T[t.id] ? '#tema/' + t.id : '#guardado/' + t.id}"><span class="etq" style="color:${COLOR[t.seccion] || 'var(--gris)'};text-transform:none;letter-spacing:0">${esc(t.seccion_nombre)}</span><span class="t">${esc(t.titulo)}</span><span class="meta">${t.notas.length} notas${T[t.id] ? '' : ' · ya no está en la semana actual'}</span></a>`).join('')
      : '<p class="vacio">Todavía no guardaste temas.</p>');
  app.innerHTML = `
  <header class="cab"><h1>Guardadas</h1></header>
  <div class="seg2" role="tablist"><button role="tab" aria-selected="${pestana === 'notas'}" data-pestana="notas">Notas · ${notas.length}</button><button role="tab" aria-selected="${pestana === 'temas'}" data-pestana="temas">Temas · ${temas.length}</button></div>
  ${pestana === 'notas' && notas.length ? `<a class="btn" href="#leer/guardadas/0" style="margin-top:12px">${ICONO.libro}Leer en modo lectura</a>` : ''}
  <section class="seccion">${cuerpo}</section>
  <p class="aviso">Se guarda el enlace, el título y la bajada en este celular. La nota se lee siempre en el sitio del diario.</p>`;
}

function vistaGuardado(id) {
  const t = guardadas().temas[id];
  if (!t) { location.hash = '#guardadas'; return; }
  app.innerHTML = `<a class="volver" href="#guardadas">‹ Guardadas</a><h1 style="font-size:25px;line-height:1.2;margin:6px 0">${esc(t.titulo)}</h1>
    <section class="seccion">${t.notas.map(n => notaHTML(n, null)).join('')}</section>`;
}

async function vistaBuscar(texto) {
  app.innerHTML = `<a class="volver" href="#semana">‹ Semana</a><h1 style="font-size:25px;margin:6px 0">${esc(texto)}</h1><p class="cargando">Buscando…</p>`;
  if (!busqueda) busqueda = await (await fetch('datos/notas_semana.json', {cache: 'no-cache'})).json();
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const palabras = norm(texto).split(/\s+/).filter(w => w.length > 2);
  const hits = busqueda.filter(n => { const t = norm(n.t); return palabras.every(w => t.includes(w)); }).slice(0, 60);
  const diarios = new Set(hits.map(n => n.d));
  app.innerHTML = `<a class="volver" href="#semana">‹ Semana</a><h1 style="font-size:25px;margin:6px 0">${esc(texto)}</h1>
    <p class="meta">${hits.length} notas de ${diarios.size} diarios en la semana · búsqueda en títulos</p>
    <section class="seccion">${hits.length ? hits.map(n => notaHTML({id: n.i, diario: n.d, titulo: n.t, url: n.u, fecha: n.f + ':00-03:00'}, null)).join('') : '<p class="vacio">No hay notas con esas palabras. Probá con menos palabras.</p>'}</section>`;
}

/* ---------- modo lectura ---------- */
// Una nota por pantalla: diario, título y bajada en letra grande, sin distracciones.
// El texto completo se lee siempre en el sitio del diario (no se copia ni se guarda).
const prefLectura = () => leer('lectura', {tam: 21, oscuro: false});
function notasParaLeer(fuente) {
  if (fuente === 'guardadas') return {titulo: 'Guardadas', volver: '#guardadas', notas: Object.values(guardadas().notas).sort((a, b) => b.guardada.localeCompare(a.guardada))};
  const t = T[fuente];
  if (!t) return null;
  const vistos = new Set(), primero = [], resto = [];
  t.notas.forEach(n => (vistos.has(n.diario) ? resto : (vistos.add(n.diario), primero)).push(n));
  const conBajada = n => n.bajada ? 0 : 1;  // primero las notas que traen bajada
  primero.sort((a, b) => conBajada(a) - conBajada(b));
  return {titulo: t.titulo, volver: '#tema/' + t.id, notas: primero.concat(resto), tema: t};
}
function vistaLeer(fuente, i) {
  const datos = notasParaLeer(fuente);
  if (!datos || !datos.notas.length) { location.hash = '#hoy'; return; }
  const total = datos.notas.length;
  i = Math.max(0, Math.min(total - 1, +i || 0));
  const n = datos.notas[i], p = prefLectura();
  const g = guardadas().notas[n.id];
  document.body.classList.add('leyendo');
  document.body.classList.toggle('oscura', p.oscuro);
  app.innerHTML = `
  <div class="lector" style="--tam:${p.tam}px">
    <div class="lector-barra">
      <a class="icono" href="${datos.volver}" aria-label="Salir del modo lectura"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></a>
      <span class="meta lector-pos">${i + 1} de ${total}</span>
      <button class="icono" data-tam="-1" aria-label="Achicar letra">A−</button>
      <button class="icono" data-tam="1" aria-label="Agrandar letra">A+</button>
      <button class="icono" data-oscuro aria-label="${p.oscuro ? 'Tema claro' : 'Tema oscuro'}">${p.oscuro ? '☀' : '☾'}</button>
    </div>
    <div class="lector-prog"><span style="width:${100 * (i + 1) / total}%"></span></div>
    <article class="lector-nota" id="lector-nota">
      <p class="lector-tema">${esc(datos.titulo)}</p>
      <p class="lector-diario"><strong>${esc(nombreDiario(n.diario))}</strong> · ${esc(hora(n.fecha))}${n.edicion_impresa ? ' · edición impresa' : ''}</p>
      <h1 class="lector-titulo">${esc(n.titulo)}</h1>
      ${n.bajada ? `<p class="lector-bajada">${esc(n.bajada)}</p>` : '<p class="lector-bajada lector-sin">Este diario no publica bajada para esta nota.</p>'}
      <div class="lector-acciones">
        <a class="btn prim" href="${esc(n.url)}" target="_blank" rel="noopener" data-leida="${esc(n.id)}">Leer la nota completa en ${esc(nombreDiario(n.diario))} ↗</a>
        <button class="btn sec${g ? ' on' : ''}" data-guardar-nota="${esc(n.id)}" data-tema="${datos.tema ? datos.tema.id : ''}">${ICONO.guardar}${g ? 'Guardada' : 'Guardar para después'}</button>
      </div>
    </article>
    <div class="lector-nav">
      ${i > 0 ? `<a class="btn sec" href="#leer/${fuente}/${i - 1}">‹ Anterior</a>` : '<span></span>'}
      ${i < total - 1 ? `<a class="btn sec" href="#leer/${fuente}/${i + 1}">Siguiente ›</a>` : `<a class="btn sec" href="${datos.volver}">Terminar ✓</a>`}
    </div>
    <p class="aviso" style="text-align:center">Deslizá hacia los costados para pasar de nota.</p>
  </div>`;
  // Deslizar con el dedo
  const art = document.getElementById('lector-nota');
  let x0 = null, y0 = null;
  art.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, {passive: true});
  art.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const j = dx < 0 ? i + 1 : i - 1;
      if (j >= 0 && j < total) location.hash = `#leer/${fuente}/${j}`;
    }
    x0 = null;
  }, {passive: true});
}

/* ---------- eventos ---------- */
app.addEventListener('click', e => {
  const el = e.target.closest('button, a[data-leida]');
  if (!el) return;
  const ds = el.dataset;
  const c = cur();
  if ('abrir' in ds) { const f = el.parentElement; const ab = f.classList.toggle('abierta'); el.setAttribute('aria-expanded', ab); return; }
  if (ds.filtro !== undefined) { filtroTemas = ds.filtro || null; render(); return; }
  if (ds.sumarSug) { if (!c.sumados.includes(ds.sumarSug)) c.sumados.push(ds.sumarSug); setCur(c); toast('Tema sumado a tu semana'); location.hash = '#temas/semana'; render(); return; }
  if ('propioNuevo' in ds) { const v = (document.getElementById('nuevo-tema') || {}).value; if (v && v.trim()) { c.propios.push(v.trim()); setCur(c); toast('Tema propio agregado'); location.hash = '#temas/semana'; render(); } return; }
  if (ds.guardarNota) {
    const t = T[ds.tema];
    const n = (t ? t.notas : []).find(x => x.id === ds.guardarNota) || (busqueda || []).map(b => ({id: b.i, diario: b.d, titulo: b.t, url: b.u, fecha: b.f})).find(x => x.id === ds.guardarNota)
      || Object.values(guardadas().temas).flatMap(x => x.notas).find(x => x.id === ds.guardarNota)
      || guardadas().notas[ds.guardarNota];
    if (n) {
      const on = alternarNota(n, t); el.classList.toggle('on', on); el.setAttribute('aria-label', on ? 'Quitar de guardadas' : 'Guardar nota');
      if (el.classList.contains('sec')) el.innerHTML = ICONO.guardar + (on ? 'Guardada' : 'Guardar para después');
    }
  } else if (ds.guardarTema) { alternarTema(T[ds.guardarTema]); render(); }
  else if (ds.quitar) { const i = ds.quitar; c.quitados = c.quitados.includes(i) ? c.quitados.filter(x => x !== i) : c.quitados.concat(i); setCur(c); render(); }
  else if (ds.sumar) { const i = ds.sumar; c.sumados = c.sumados.includes(i) ? c.sumados.filter(x => x !== i) : c.sumados.concat(i); setCur(c); render(); }
  else if (ds.propio !== undefined) { c.propios.splice(+ds.propio, 1); setCur(c); render(); }
  else if ('agregar' in ds) { const v = document.getElementById('propio').value.trim(); if (v) { c.propios.push(v); setCur(c); render(); toast('Tema agregado'); } }
  else if ('confirmar' in ds) { c.confirmada = new Date().toISOString(); setCur(c); toast('Semana confirmada'); location.hash = '#semana'; }
  else if ('feedback' in ds) { enviarFeedback(); }
  else if (ds.tam) { const p = prefLectura(); p.tam = Math.max(16, Math.min(30, p.tam + 2 * +ds.tam)); guardar('lectura', p); render(); }
  else if ('oscuro' in ds) { const p = prefLectura(); p.oscuro = !p.oscuro; guardar('lectura', p); render(); }
  else if (ds.pestana) { vistaGuardadas(ds.pestana); }
  else if (ds.quitarGuardada) { const g = guardadas(); delete g.notas[ds.quitarGuardada]; guardar('guardadas', g); vistaGuardadas('notas'); }
  else if (ds.leida) { const g = guardadas(); if (g.notas[ds.leida]) { g.notas[ds.leida].leida = true; guardar('guardadas', g); } }
});
app.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'propio') app.querySelector('[data-agregar]').click();
  if (e.key === 'Enter' && e.target.id === 'nuevo-tema') { const b = app.querySelector('[data-propio-nuevo]'); if (b) b.click(); }
});
app.addEventListener('input', e => { if (e.target.id === 'nuevo-tema') sugerirTemas(e.target.value); });

function enviarFeedback() {
  const c = cur();
  const linea = i => T[i] ? `- ${T[i].titulo} (${T[i].seccion}, puntaje ${T[i].puntaje}, id ${i})` : `- id ${i}`;
  const cuerpo = [
    `Semana del ${D.semana.desde} al ${D.semana.hasta} · datos generados ${D.generado}`, '',
    `### Confirmados (${D.semana.propuestos.length - c.quitados.length} de ${D.semana.propuestos.length})`, ...D.semana.propuestos.filter(i => !c.quitados.includes(i)).map(linea), '',
    `### Quitados (${c.quitados.length})`, ...c.quitados.map(linea), '',
    `### Sumados de la lista (${c.sumados.length})`, ...c.sumados.map(linea), '',
    `### Temas propios (${c.propios.length})`, ...c.propios.map(p => `- ${p}`), '',
    '### Comentarios', '(opcional: escribí acá lo que quieras)', '',
    '<!-- datos para el calibrador -->', '```json', JSON.stringify({semana: D.semana.hasta, propuestos: D.semana.propuestos, ...c}), '```',
  ].join('\n');
  const url = `https://github.com/${REPO}/issues/new?labels=curaduria&title=${encodeURIComponent('Curaduría semana ' + D.semana.hasta)}&body=${encodeURIComponent(cuerpo)}`;
  window.open(url, '_blank', 'noopener');
}

/* ---------- navegación ---------- */
function render() {
  const [vista, arg] = (location.hash.slice(1) || 'hoy').split('/');
  const nav = {hoy: 'hoy', semana: 'semana', temas: 'temas', tema: 'semana', buscar: 'semana', curar: 'curar', guardadas: 'guardadas', guardado: 'guardadas', leer: 'semana'}[vista] || 'hoy';
  if (vista !== 'leer') { document.body.classList.remove('leyendo', 'oscura'); }
  document.querySelectorAll('.barra a').forEach(a => { if (a.dataset.vista === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (vista === 'leer') { const partes = location.hash.slice(1).split('/'); vistaLeer(partes[1], partes[2]); return; }
  if (vista === 'semana') vistaSemana();
  else if (vista === 'temas') vistaTemas(arg);
  else if (vista === 'tema') vistaTema(arg);
  else if (vista === 'curar') vistaCurar();
  else if (vista === 'guardadas') vistaGuardadas();
  else if (vista === 'guardado') vistaGuardado(arg);
  else if (vista === 'buscar') vistaBuscar(decodeURIComponent(arg || ''));
  else vistaHoy();
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

async function iniciar() {
  try {
    const r = await fetch('datos/actual.json', {cache: 'no-cache'});
    D = await r.json();
    T = Object.fromEntries(D.temas.map(t => [t.id, t]));
    render();
  } catch (e) {
    app.innerHTML = '<p class="vacio">No se pudieron cargar los datos. Revisá la conexión y volvé a abrir la app.</p>';
  }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
iniciar();
