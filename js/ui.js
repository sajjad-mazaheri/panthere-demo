// ui.js -- configurator buttons, product card, text overlay show/hide

import { ringState } from './ring.js';
import { METALS, EYES, PAVE, lerpMaterial } from './materials.js';

export function initUI() {
  initConfiguratorButtons();
}

function initConfiguratorButtons() {
  // metal buttons
  document.querySelectorAll('.metal-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const metalKey = btn.dataset.metal;
      if (metalKey === ringState.currentMetal) return;
      document.querySelectorAll('.metal-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ringState.currentMetal = metalKey;
      lerpMaterial(ringState.metalMaterial, METALS[metalKey], 0.6);
      const el = document.getElementById('selected-metal');
      if (el) el.textContent = METALS[metalKey].label;
    });
  });

  // eye gem buttons
  document.querySelectorAll('.eye-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eyeKey = btn.dataset.eye;
      if (eyeKey === ringState.currentEye) return;
      document.querySelectorAll('.eye-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ringState.currentEye = eyeKey;
      lerpMaterial(ringState.eyeMaterial, EYES[eyeKey], 0.6);
      const label = document.getElementById('eye-label');
      if (label) label.textContent = EYES[eyeKey].label;
      const el = document.getElementById('selected-eye');
      if (el) el.textContent = EYES[eyeKey].productText;
    });
  });

  // pave buttons
  document.querySelectorAll('.pave-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const paveKey = btn.dataset.pave;
      if (paveKey === ringState.currentPave) return;
      document.querySelectorAll('.pave-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ringState.currentPave = paveKey;
      lerpMaterial(ringState.diamondMaterial, PAVE[paveKey], 0.6);
    });
  });
}

// configurator with stagger reveal
export function showConfigurator() {
  const el = document.getElementById('configurator');
  if (!el || el.classList.contains('active')) return;
  el.classList.add('active');

  // stagger each config group
  const groups = el.querySelectorAll('.config-group');
  groups.forEach((group, i) => {
    group.style.opacity = '0';
    group.style.transform = 'translateY(12px)';
    group.style.transition = 'none';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        group.style.transition = `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`;
        group.style.opacity = '1';
        group.style.transform = 'translateY(0)';
      });
    });
  });
}

export function hideConfigurator() {
  const el = document.getElementById('configurator');
  if (el) el.classList.remove('active');
}

export function showProductCard() {
  const el = document.getElementById('product-card');
  if (!el || el.classList.contains('active')) return;
  el.classList.add('active');

  // price counter animation
  const priceEl = el.querySelector('.price');
  if (priceEl && !priceEl.dataset.animated) {
    priceEl.dataset.animated = '1';
    const target = 27800;
    const duration = 1200;
    const start = performance.now();
    function tick() {
      const t = Math.min((performance.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(eased * target);
      priceEl.textContent = `\u20AC ${val.toLocaleString('it-IT')}`;
      if (t < 1) requestAnimationFrame(tick);
    }
    tick();
  }

  // ref typewriter
  const refEl = el.querySelector('.ref');
  if (refEl && !refEl.dataset.animated) {
    refEl.dataset.animated = '1';
    const fullText = refEl.textContent;
    refEl.textContent = '';
    let idx = 0;
    function typeChar() {
      if (idx <= fullText.length) {
        refEl.textContent = fullText.slice(0, idx);
        idx++;
        setTimeout(typeChar, 35);
      }
    }
    setTimeout(typeChar, 400);
  }
}

export function hideProductCard() {
  const el = document.getElementById('product-card');
  if (el) el.classList.remove('active');
}

export function showText(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  if (id === 'text-stage2') document.body.classList.add('stage2-caption-active');
}

export function hideText(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
  if (id === 'text-stage2') document.body.classList.remove('stage2-caption-active');
}
