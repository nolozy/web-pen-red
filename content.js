/**
 * Web Pen - Red
 * Injects a full-viewport canvas overlay plus a 4-button mini toolbar.
 * Scope is intentionally minimal: pen / cursor / clear / close. Colour is fixed.
 */
(() => {
  'use strict';

  if (window.__webPenRedLoaded) return;
  window.__webPenRedLoaded = true;

  const COLOR = '#FF0000';
  const LINE_WIDTH = 3;

  const ICONS = {
    pen:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4z"/><path d="M14.5 5.5l4 4"/></svg>',
    cursor:
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="wpr-filled"><path d="M5 2.5l13 8.4-5.7 1.2 2.6 5.6-2.5 1.2-2.6-5.6-4 3.6z"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16"/><path d="M9.5 6.5V4h5v2.5"/><path d="M6.5 6.5L7.5 20h9l1-13.5"/><path d="M10.5 10v6.5M13.5 10v6.5"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /** Stroke points are kept in document coordinates so they scroll with the page. */
  let strokes = [];
  let current = null;
  let penMode = false;
  let redrawQueued = false;

  let root = null;
  let canvas = null;
  let ctx = null;
  let toolbar = null;
  let penBtn = null;
  let cursorBtn = null;

  /* ---------- canvas ---------- */

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = document.documentElement.clientWidth || window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    redraw();
  }

  function applyTransform() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, -window.scrollX * dpr, -window.scrollY * dpr);
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = LINE_WIDTH;
  }

  function redraw() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyTransform();
    for (const stroke of strokes) drawStroke(stroke);
  }

  function drawStroke(stroke) {
    if (stroke.length === 0) return;
    ctx.beginPath();
    if (stroke.length === 1) {
      // A single tap renders as a dot.
      ctx.moveTo(stroke[0].x, stroke[0].y);
      ctx.lineTo(stroke[0].x + 0.01, stroke[0].y);
    } else {
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
    }
    ctx.stroke();
  }

  function queueRedraw() {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => {
      redrawQueued = false;
      redraw();
    });
  }

  /* ---------- drawing ---------- */

  function toDocPoint(e) {
    return { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
  }

  function onPointerDown(e) {
    if (!penMode || e.button !== 0) return;
    e.preventDefault();
    current = [toDocPoint(e)];
    strokes.push(current);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      // The pointer may already be gone; drawing still works without capture.
    }
    applyTransform();
    drawStroke(current);
  }

  function onPointerMove(e) {
    if (!current) return;
    e.preventDefault();
    const prev = current[current.length - 1];
    const pt = toDocPoint(e);
    current.push(pt);
    applyTransform();
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  function onPointerUp(e) {
    if (!current) return;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    current = null;
  }

  function clearAll() {
    strokes = [];
    current = null;
    redraw();
  }

  /**
   * Right-click clears everything. The canvas only receives events in pen mode,
   * so the page's own context menu is untouched while in cursor mode.
   */
  function onContextMenu(e) {
    if (!penMode) return;
    e.preventDefault();
    clearAll();
  }

  function isTypingTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  /**
   * Tab flips between pen and cursor. It is left alone while the caret is in a
   * form field and whenever a modifier is held, so normal focus navigation and
   * typing keep working.
   */
  function onKeyDown(e) {
    if (e.key !== 'Tab' || e.repeat) return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    if (!root || root.classList.contains('wpr-hidden')) return;
    if (isTypingTarget(document.activeElement)) return;
    e.preventDefault();
    e.stopPropagation();
    setPenMode(!penMode);
  }

  /* ---------- toolbar ---------- */

  function setPenMode(on) {
    penMode = on;
    current = null;
    root.classList.toggle('wpr-pen-active', on);
    penBtn.classList.toggle('wpr-active', on);
    cursorBtn.classList.toggle('wpr-active', !on);
    penBtn.setAttribute('aria-pressed', String(on));
    cursorBtn.setAttribute('aria-pressed', String(!on));
  }

  function makeButton(name, title, action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wpr-btn';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = ICONS[name];
    btn.__wprAction = action;
    // Mouse activation is handled by the pointer logic below (the panel takes
    // pointer capture while dragging, which retargets click events). This only
    // covers keyboard activation, where click carries detail === 0.
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.detail === 0) action();
    });
    return btn;
  }

  /**
   * The panel can be dragged from anywhere on it, buttons included. Pointer
   * capture is taken on press so a fast flick keeps following the cursor; a
   * press that never moves activates the button it started and ended on.
   */
  function enableDrag(el) {
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let dragging = false;
    let pointerId = null;
    let pressed = null;

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || pointerId !== null) return;
      const rect = el.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      originLeft = rect.left;
      originTop = rect.top;
      dragging = false;
      pointerId = e.pointerId;
      pressed = e.target.closest ? e.target.closest('.wpr-btn') : null;
      el.setPointerCapture(pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dx) + Math.abs(dy) < 4) return;
      dragging = true;
      el.classList.add('wpr-dragging');
      const maxLeft = Math.max(window.innerWidth - el.offsetWidth, 0);
      const maxTop = Math.max(window.innerHeight - el.offsetHeight, 0);
      // The stylesheet pins the panel with !important, so the drag position has
      // to be set at the same weight.
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('left', Math.min(Math.max(originLeft + dx, 0), maxLeft) + 'px', 'important');
      el.style.setProperty('top', Math.min(Math.max(originTop + dy, 0), maxTop) + 'px', 'important');
    });

    const end = (e, activate) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      const wasDragging = dragging;
      const btn = pressed;
      pointerId = null;
      pressed = null;
      dragging = false;
      el.classList.remove('wpr-dragging');
      if (!activate || wasDragging || !btn) return;
      // Only fire when the pointer is released over the button it started on.
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (under && under.closest && under.closest('.wpr-btn') === btn) btn.__wprAction();
    };
    el.addEventListener('pointerup', (e) => end(e, true));
    el.addEventListener('pointercancel', (e) => end(e, false));
  }

  /* ---------- lifecycle ---------- */

  function create() {
    root = document.createElement('div');
    root.id = 'wpr-root';

    canvas = document.createElement('canvas');
    canvas.id = 'wpr-canvas';
    root.appendChild(canvas);

    toolbar = document.createElement('div');
    toolbar.id = 'wpr-toolbar';

    penBtn = makeButton('pen', 'Pen (Tab)', () => setPenMode(true));
    cursorBtn = makeButton('cursor', 'Cursor (Tab)', () => setPenMode(false));
    const clearBtn = makeButton('trash', 'Clear all (right-click also clears)', clearAll);
    const closeBtn = makeButton('close', 'Close', destroy);

    toolbar.append(penBtn, cursorBtn, clearBtn, closeBtn);
    root.appendChild(toolbar);
    (document.body || document.documentElement).appendChild(root);

    resizeCanvas();
    setPenMode(true);
    enableDrag(toolbar);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('scroll', queueRedraw, true);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', onKeyDown, true);
  }

  function destroy() {
    if (!root) return;
    window.removeEventListener('scroll', queueRedraw, true);
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('keydown', onKeyDown, true);
    root.remove();
    root = canvas = ctx = toolbar = penBtn = cursorBtn = null;
    strokes = [];
    current = null;
    penMode = false;
  }

  function toggle() {
    if (!root) {
      create();
      return;
    }
    const hidden = root.classList.toggle('wpr-hidden');
    if (hidden) current = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'WEB_PEN_RED_TOGGLE') {
      toggle();
      sendResponse({ ok: true });
    }
  });
})();
