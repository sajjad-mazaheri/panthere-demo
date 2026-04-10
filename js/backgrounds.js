// backgrounds.js / background layer transitions

import * as THREE from 'three';
import { mapSmoothRange } from './utils.js';
import {
  isVelvetMorphReady,
  updateVelvetMorphBackground,
} from './velvet-morph-background.js';
import { updatePaperTear, hidePaperTear } from './paper-tear.js';
import { hideStageOnePainting } from './stage1-painting-scrub.js';

// cache DOM refs once
let _bgBlack, _bgPainting, _bgSpace, _bgVelvetFull;
let _bgBoutique, _velvetTop, _velvetBottom;
let _cached = false;

function cacheElements() {
  if (_cached) return;
  _bgBlack = document.getElementById('bg-black');
  _bgPainting = document.querySelector('.bg-painting');
  _bgSpace = document.querySelector('.bg-space');
  _bgVelvetFull = document.getElementById('bg-velvet-full');
  _bgBoutique = document.querySelector('.bg-boutique');
  _velvetTop = document.getElementById('velvet-top');
  _velvetBottom = document.getElementById('velvet-bottom');
  _cached = true;
}

export function updateBackgrounds(p, mouse, camera, STAGE_FLOW, getMorphAnchorPercent) {
  cacheElements();

  const mouseX = mouse ? mouse.x : 0;
  const mouseY = mouse ? mouse.y : 0;
  const anchor = getMorphAnchorPercent();

  // paper tear reveal timing
  const tearReveal = mapSmoothRange(p, STAGE_FLOW.tearStart, STAGE_FLOW.revealEnd);
  const stageOneHandoff = mapSmoothRange(p, STAGE_FLOW.handoffStart, STAGE_FLOW.handoffEnd);
  const stageOneOverlayAlpha = 1 - stageOneHandoff;
  const tearTailFade = 1 - mapSmoothRange(p, STAGE_FLOW.revealEnd - 0.012, STAGE_FLOW.revealEnd + 0.002);
  const paperTearAlpha = stageOneOverlayAlpha * 0.42 * tearTailFade;

  // background transition curves
  const spaceEnter = mapSmoothRange(p, 0.47, 0.58);
  const spaceExit = mapSmoothRange(p, 0.64, 0.74);
  const velvetEnter = mapSmoothRange(p, 0.70, 0.80);
  const velvetSplit = mapSmoothRange(p, 0.89, 0.95);
  const boutiqueEnter = mapSmoothRange(p, 0.90, 0.97);
  const boutiqueBlur = mapSmoothRange(p, 0.94, 1.0);
  const finalCardEnter = mapSmoothRange(p, STAGE_FLOW.stage8Start, 0.985);
  const velvetMorphReady = isVelvetMorphReady();

  updateVelvetMorphBackground(p, mouse);

  // paper tear effect
  if (p < STAGE_FLOW.revealEnd && tearReveal > 0.008 && paperTearAlpha > 0.001) {
    updatePaperTear(camera, tearReveal, anchor, mouse, paperTearAlpha);
  } else {
    hidePaperTear();
  }

  if (p >= STAGE_FLOW.gatherEnd) {
    hideStageOnePainting();
  }

  // black overlay
  if (_bgBlack) {
    if (p < STAGE_FLOW.tearStart) {
      _bgBlack.style.opacity = '1';
      _bgBlack.style.maskImage = '';
      _bgBlack.style.webkitMaskImage = '';
      _bgBlack.style.filter = 'none';
      _bgBlack.style.transform = 'scale(1)';
      _bgBlack.style.pointerEvents = 'auto';
    } else if (p < STAGE_FLOW.revealEnd) {
      _bgBlack.style.opacity = String(stageOneOverlayAlpha * 0.014 * tearTailFade);
      _bgBlack.style.maskImage = '';
      _bgBlack.style.webkitMaskImage = '';
      _bgBlack.style.filter = 'none';
      _bgBlack.style.transform = 'scale(1)';
      _bgBlack.style.pointerEvents = 'none';
    } else {
      _bgBlack.style.opacity = '0';
      _bgBlack.style.maskImage = '';
      _bgBlack.style.webkitMaskImage = '';
      _bgBlack.style.filter = 'none';
      _bgBlack.style.transform = 'scale(1)';
      _bgBlack.style.pointerEvents = 'none';
    }
  }

  //  painting (hidden in V2, controlled by stage1-painting-scrub)
  if (_bgPainting) {
    _bgPainting.style.opacity = '0';
    _bgPainting.style.transformOrigin = 'center bottom';
    _bgPainting.style.clipPath = 'inset(0% 0% 0% 0%)';
    _bgPainting.style.webkitClipPath = _bgPainting.style.clipPath;
    _bgPainting.style.filter = 'none';
    _bgPainting.style.transform = 'translate3d(0, 0, 0) scale(1)';
  }

  //  space bg (stars)
  if (_bgSpace) {
    const opacity = THREE.MathUtils.clamp(spaceEnter * 1.08 * (1 - spaceExit * 0.9), 0, 1);
    const scale = THREE.MathUtils.lerp(1.23, 1.02, spaceEnter) - spaceExit * 0.02;
    const yShift = THREE.MathUtils.lerp(9.5, -1.2, spaceEnter) - spaceExit * 2.4;
    const rotateX = THREE.MathUtils.lerp(11, 0, spaceEnter);
    const rotateZ = mouseX * -0.38;
    const brightness = THREE.MathUtils.lerp(0.9, 1.16, spaceEnter);
    const contrast = THREE.MathUtils.lerp(1.02, 1.12, spaceEnter);
    const saturate = THREE.MathUtils.lerp(0.92, 1.2, spaceEnter);

    _bgSpace.style.opacity = String(opacity);
    _bgSpace.style.filter = `blur(${THREE.MathUtils.lerp(8, 0, spaceEnter).toFixed(2)}px) brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
    _bgSpace.style.transform = `perspective(2400px) translate3d(${mouseX * -0.9}%, ${mouseY * -0.38 + yShift}%, 0) rotateX(${rotateX.toFixed(3)}deg) rotateZ(${rotateZ.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
  }

  //  velvet full
  if (_bgVelvetFull) {
    const opacity = velvetMorphReady
      ? 0
      : THREE.MathUtils.clamp(velvetEnter * (1 - velvetSplit), 0, 1);
    const yShift = THREE.MathUtils.lerp(2.5, 0, velvetEnter);
    const scale = THREE.MathUtils.lerp(1.04, 1.0, velvetEnter) + velvetSplit * 0.015;

    _bgVelvetFull.style.opacity = String(opacity);
    _bgVelvetFull.style.filter = 'none';
    _bgVelvetFull.style.transform = `translate3d(${mouseX * -0.45}%, ${mouseY * -0.22 + yShift}%, 0) scale(${scale})`;
  }

  //  velvet split halves
  if (_velvetTop && _velvetBottom) {
    const splitOpacityBase = velvetMorphReady
      ? mapSmoothRange(p, 0.905, 0.948)
      : (velvetSplit > 0 && velvetSplit < 1 ? 1 : 0);
    const splitOpacity = splitOpacityBase * (1 - finalCardEnter);
    const splitDistance = THREE.MathUtils.lerp(0, 110, velvetSplit);
    const topScale = THREE.MathUtils.lerp(1.01, velvetMorphReady ? 1.09 : 1.06, velvetSplit);
    const bottomScale = THREE.MathUtils.lerp(1.01, velvetMorphReady ? 1.09 : 1.06, velvetSplit);
    const topX = mouseX * -0.22 * velvetSplit;
    const botX = mouseX * 0.22 * velvetSplit;
    const seamTwist = THREE.MathUtils.lerp(0, 1.25, velvetSplit);

    _velvetTop.style.opacity = String(splitOpacity);
    _velvetBottom.style.opacity = String(splitOpacity);
    _velvetTop.style.transform = `translate3d(${topX}%, ${-splitDistance}%, 0) scale(${topScale}) rotateZ(${-seamTwist}deg)`;
    _velvetBottom.style.transform = `translate3d(${botX}%, ${splitDistance}%, 0) scale(${bottomScale}) rotateZ(${seamTwist}deg)`;
  }

  //  boutique
  if (_bgBoutique) {
    const opacity = boutiqueEnter;
    const blur = Math.max(0, THREE.MathUtils.lerp(16, 0.42, boutiqueEnter) + boutiqueBlur * 1.15 - finalCardEnter * 0.95);
    const scale = THREE.MathUtils.lerp(1.3, 1.06, boutiqueEnter) + finalCardEnter * 0.26;
    const yShift = THREE.MathUtils.lerp(6, -1.6, boutiqueEnter) - finalCardEnter * 0.62;
    const saturation = THREE.MathUtils.lerp(0.78, 1.03, boutiqueEnter);
    const rotateY = mouseX * -1.4;
    const rotateX = mouseY * 0.9;

    _bgBoutique.style.opacity = String(opacity);
    _bgBoutique.style.filter = `blur(${Math.max(0, blur).toFixed(2)}px) saturate(${saturation.toFixed(3)})`;
    _bgBoutique.style.transformOrigin = 'center center';
    _bgBoutique.style.transform = `perspective(2200px) translate3d(${mouseX * -1.05}%, ${mouseY * -0.48 + yShift}%, 0) rotateX(${rotateX.toFixed(3)}deg) rotateY(${rotateY.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
  }
}
