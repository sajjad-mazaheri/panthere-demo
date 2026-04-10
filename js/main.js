// main.js -- orchestrates the scroll-driven 3D experience


import * as THREE from 'three';
import { initScene, scene, camera, renderer, controls, cursorLight, getCursorPoint, getMouse, activateGoldParticles, updateGoldParticles } from './scene.js';
import { loadRing, ringState, updateDiamondPhysics, returnToRest } from './ring.js';
import { initScroll, scrollState } from './scroll.js';
import { initUI, showConfigurator, hideConfigurator, showProductCard, hideProductCard, showText, hideText } from './ui.js';
import { createWireframeDiamond, animateWireframeDraw, getWireframe, getWireframeMaterial, syncWireframeToMesh, updateWireframeTilt, initWireframeMouseTilt } from './loader.js';
import { initPaperTear } from './paper-tear.js';
import { initStageOnePainting, updateStageOnePainting, getPaintingShrinkProgress } from './stage1-painting-scrub.js';
import { initVelvetMorphBackground } from './velvet-morph-background.js';
import { updateBackgrounds } from './backgrounds.js';
import { mapRange, mapSmoothRange, smooth01, easeBackOut } from './utils.js';

// state 

let loaded = false;
let wireframeComplete = false;
let modelLoaded = false;
let scrollEnabled = false;
let lastGoldBurst = false;
let orbitActive = false;
let productOrbitActive = false;
let animationStarted = false;

function browserSupportsWebP() {
  try {
    const canvas = document.createElement('canvas');
    if (!canvas.getContext) return false;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

// stage 1 painting config
const STAGE_ONE_IMAGE_EXTENSION = browserSupportsWebP() ? 'webp' : 'png';
const STAGE_ONE_STILL = `./assets/bg_painting.${STAGE_ONE_IMAGE_EXTENSION}`;
const STAGE_ONE_FRAME_DIR = './assets/bg-painting-video';
const STAGE_ONE_FRAME_COUNT = 24;
const STAGE_ONE_FRAME_EXTENSION = STAGE_ONE_IMAGE_EXTENSION;
const STAGE_ONE_FRAME_PADDING = 3;

// positioning constants
const STAGE_ONE_TARGET_SCREEN = { x: 54.2, y: 75.5 };
const STAGE_ONE_TARGET_WORLD_POINT = new THREE.Vector3(0.52, -0.7, 0);
const STAGE_ONE_WIREFRAME_START_SCALE = 0.74;
const STAGE_ONE_WIREFRAME_END_SCALE = 0.165;
const STAGE_ONE_DIAMOND_HOLD_SCALE = 0.56;
const STAGE_ONE_DIAMOND_SWAP_SCALE = 0.62;
const STAGE_ONE_DIAMOND_GATHER_SCALE = 1.12;
const STAGE_TWO_INTERACTIVE_END = 0.518;
const RING_MODEL_SCALE_MULTIPLIER = 0.7;
const STAGE4_EYE_REVEAL_YAW = -1.2;
const OPTIONAL_INIT_TIMEOUT_MS = 7000;
const CORE_INIT_TIMEOUT_MS = 18000;

// scroll ranges - single source of truth
export const STAGE_FLOW = {
  tearStart: 0.168,
  revealEnd: 0.236,
  handoffStart: 0.218,
  handoffEnd: 0.252,
  videoStart: 0.258,
  videoEnd: 0.402,
  gatherStart: 0.402,
  gatherEnd: 0.52,
  stage3Start: 0.518,
  stage3End: 0.58,
  stage4Start: 0.54,
  stage4End: 0.68,
  stage5Start: 0.67,
  stage5End: 0.82,
  stage6Start: 0.81,
  stage6End: 0.88,
  stage7Start: 0.87,
  stage7End: 0.95,
  stage8Start: 0.94,
};

const loadingState = { failed: false, wireframe: 0, model: 0 };

const defaultCameraPos = new THREE.Vector3(0, 0, 5);

// isolated diamond for stages 1-2
let isolatedDiamond = null;
const projectedAnchor = new THREE.Vector3();
const worldTempA = new THREE.Vector3();
const worldTempB = new THREE.Vector3();
const worldTempScale = new THREE.Vector3();
const stageOneTargetWorld = new THREE.Vector3();
const stageOneTargetRay = new THREE.Ray();
const stageOneTargetNdc = new THREE.Vector3();
const stageOneTargetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let revealHalo = null;
let stageOneTargetLocked = false;
let stage4StartYaw = 0;
let stage4YawCaptured = false;

// ── cached DOM refs ──

let _loaderBar, _loaderStatus, _loaderScreen, _scrollHint, _canvasEl;
let _domCached = false;

function cacheDom() {
  if (_domCached) return;
  _loaderBar = document.getElementById('loader-bar');
  _loaderStatus = document.getElementById('loader-status');
  _loaderScreen = document.getElementById('loader-screen');
  _scrollHint = document.getElementById('scroll-hint');
  _canvasEl = document.getElementById('canvas');
  _domCached = true;
}

// ── loader UI ──

function updateLoaderProgress() {
  if (!_loaderBar) return;
  const w = loadingState.wireframe * 0.35 + loadingState.model * 0.65;
  _loaderBar.style.width = `${Math.round(w * 100)}%`;
}

function setLoaderStatus(message, isError = false) {
  if (!_loaderStatus) return;
  _loaderStatus.textContent = message;
  _loaderStatus.classList.toggle('error', isError);
}

function setReadyHint(visible, text = 'Scroll to begin') {
  if (!_scrollHint) return;
  _scrollHint.textContent = text;
  _scrollHint.classList.toggle('visible', visible);
}

function startAnimationLoop() {
  if (animationStarted) return;
  animationStarted = true;
  animate();
}

// ── init helpers ──

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    promise.then(
      (v) => { window.clearTimeout(id); resolve(v); },
      (e) => { window.clearTimeout(id); reject(e); },
    );
  });
}

function continueWithout(promise, label) {
  return promise.catch((err) => {
    console.warn(`[Panthere] ${label} failed during init. Continuing without it.`, err);
    return null;
  });
}

// ── positioning helpers ──

function getRingModelScale() {
  return (ringState.baseScale || 1) * RING_MODEL_SCALE_MULTIPLIER;
}

function getStageOneTargetWorld() {
  if (camera) {
    stageOneTargetNdc.set(
      (STAGE_ONE_TARGET_SCREEN.x / 100) * 2 - 1,
      -(STAGE_ONE_TARGET_SCREEN.y / 100) * 2 + 1,
      0.5,
    );
    stageOneTargetNdc.unproject(camera);
    stageOneTargetRay.origin.copy(camera.position);
    stageOneTargetRay.direction.copy(stageOneTargetNdc).sub(camera.position).normalize();
    if (stageOneTargetRay.intersectPlane(stageOneTargetPlane, stageOneTargetWorld)) {
      return stageOneTargetWorld;
    }
  }
  return stageOneTargetWorld.copy(STAGE_ONE_TARGET_WORLD_POINT);
}

// how close the cursor is to an object on screen (0-1)
function getObjectScreenHover(object, mouse, radius = 0.22) {
  if (!object || !camera || !mouse) return 0;
  object.getWorldPosition(projectedAnchor);
  projectedAnchor.project(camera);
  if (projectedAnchor.z < -1.1 || projectedAnchor.z > 1.1) return 0;
  const dx = projectedAnchor.x - mouse.x;
  const dy = projectedAnchor.y - mouse.y;
  return THREE.MathUtils.clamp(1 - Math.hypot(dx, dy) / radius, 0, 1);
}

// screen % of the diamond/wireframe (paper tear anchor)
export function getMorphAnchorPercent() {
  const obj = (isolatedDiamond && isolatedDiamond.visible) ? isolatedDiamond : getWireframe();
  if (!obj || !camera) return { x: STAGE_ONE_TARGET_SCREEN.x, y: STAGE_ONE_TARGET_SCREEN.y };
  obj.getWorldPosition(projectedAnchor);
  projectedAnchor.project(camera);
  return {
    x: THREE.MathUtils.clamp((projectedAnchor.x * 0.5 + 0.5) * 100, 0, 100),
    y: THREE.MathUtils.clamp((-projectedAnchor.y * 0.5 + 0.5) * 100, 0, 100),
  };
}

function setEyeScale(mesh, factor) {
  if (!mesh) return;
  const base = mesh.userData.baseScale || worldTempScale.setScalar(1);
  mesh.scale.copy(base).multiplyScalar(factor);
}

// ── reveal halo (glow sprite behind diamond) ──

function setupRevealHalo() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size * 0.48, size * 0.46, 0, size * 0.5, size * 0.5, size * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.18, 'rgba(236,241,255,0.72)');
  g.addColorStop(0.4, 'rgba(188,201,230,0.22)');
  g.addColorStop(0.72, 'rgba(120,130,150,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  revealHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  revealHalo.visible = false;
  revealHalo.renderOrder = 12;
  scene.add(revealHalo);
}

function setRevealHalo(position, intensity, radius = 1) {
  if (!revealHalo) return;
  if (intensity <= 0.01) {
    revealHalo.visible = false;
    revealHalo.material.opacity = 0;
    return;
  }
  revealHalo.visible = true;
  revealHalo.position.copy(position);
  revealHalo.scale.setScalar(radius * 2.4);
  revealHalo.material.opacity = THREE.MathUtils.clamp(intensity, 0, 1) * 0.32;
}

// ── loader error messages ──

function describeInitError(error) {
  const msg = error?.message || String(error || '');
  if (window.location.protocol === 'file:') {
    return '3D model could not load. Open this demo through a local server such as Live Server.';
  }
  if (msg.includes('timed out')) {
    return '3D assets took too long to load. Check the local server, asset paths, and network access to decoder/CDN files.';
  }
  if (msg.includes('DRACO') || msg.includes('draco')) {
    return '3D decoder failed to load. Check network access to the Draco decoder files.';
  }
  return '3D model could not load. Check asset paths and network access, then reload.';
}

// INIT

async function init() {
  initScene();
  cacheDom();

  createWireframeDiamond(scene, './assets/ring.glb');

  // optional modules -- won't block if they fail
  const velvetMorphPromise = continueWithout(
    withTimeout(initVelvetMorphBackground(scene, camera, renderer), OPTIONAL_INIT_TIMEOUT_MS, 'Velvet morph background'),
    'Velvet morph background',
  );
  const stageOneTransitionPromise = continueWithout(
    withTimeout(initPaperTear(scene, camera, STAGE_ONE_STILL), OPTIONAL_INIT_TIMEOUT_MS, 'Stage 1 transition'),
    'Stage 1 transition',
  );
  const stageOnePaintingPromise = continueWithout(
    withTimeout(initStageOnePainting(scene, camera, {
      stillUrl: STAGE_ONE_STILL,
      frameDir: STAGE_ONE_FRAME_DIR,
      frameCount: STAGE_ONE_FRAME_COUNT,
      frameExtension: STAGE_ONE_FRAME_EXTENSION,
      framePadding: STAGE_ONE_FRAME_PADDING,
    }), OPTIONAL_INIT_TIMEOUT_MS, 'Stage 1 painting'),
    'Stage 1 painting',
  );

  setupRevealHalo();
  initWireframeMouseTilt();
  setLoaderStatus('Loading...');
  startAnimationLoop();

  // model load + wireframe draw
  const modelPromise = withTimeout(
    loadRing('./assets/ring.glb', scene, {
      onProgress: (progress) => {
        loadingState.model = Math.max(loadingState.model, Math.min(progress, 0.95));
        updateLoaderProgress();
      },
    }).then(() => {
      syncWireframeToMesh(ringState.anchorDiamond || ringState.diamonds[0]);
      modelLoaded = true;
      loadingState.model = 1;
      updateLoaderProgress();
    }),
    CORE_INIT_TIMEOUT_MS,
    '3D ring model',
  );

  const wireframePromise = withTimeout(
    modelPromise.then(() => animateWireframeDraw(2000, (progress) => {
      loadingState.wireframe = progress;
      updateLoaderProgress();
    }).then(() => {
      wireframeComplete = true;
      loadingState.wireframe = 1;
      updateLoaderProgress();
    })),
    CORE_INIT_TIMEOUT_MS,
    'Wireframe setup',
  );

  try {
    await Promise.all([wireframePromise, modelPromise, stageOneTransitionPromise, stageOnePaintingPromise, velvetMorphPromise]);
  } catch (error) {
    loadingState.failed = true;
    setLoaderStatus(describeInitError(error), true);
    setReadyHint(false);
    throw error;
  }

  setLoaderStatus('Ready');
  setReadyHint(true);
  initScroll();
  scrollEnabled = true;
  initUI();
  setupIsolatedDiamond();
  loaded = true;
}

// clone one diamond for stages 1-2 (before ring assembles)
function setupIsolatedDiamond() {
  if (ringState.diamonds.length === 0) return;
  const ref = ringState.anchorDiamond || ringState.diamonds[0];
  isolatedDiamond = ref.clone();
  isolatedDiamond.material = ringState.diamondMaterial.clone();
  // warm amber base so it sits naturally in the candlelit painting
  isolatedDiamond.material.color.set(0xf5e2b8);
  isolatedDiamond.material.transparent = true;
  isolatedDiamond.material.opacity = 1;
  isolatedDiamond.material.transmission = 0.04;
  isolatedDiamond.material.ior = 2.18;
  isolatedDiamond.material.thickness = 0.42;
  isolatedDiamond.material.roughness = 0.04;
  isolatedDiamond.material.envMapIntensity = (isolatedDiamond.material.envMapIntensity || 1) * 0.65;
  isolatedDiamond.material.clearcoat = 0.02;
  isolatedDiamond.material.clearcoatRoughness = 0.04;
  isolatedDiamond.material.emissive.set(0xc89040);
  isolatedDiamond.material.emissiveIntensity = 0.035;
  isolatedDiamond.material.specularIntensity = 1.2;
  isolatedDiamond.material.specularColor = new THREE.Color(0xffeebb);
  isolatedDiamond.material.attenuationColor = new THREE.Color(0xf0d090);
  isolatedDiamond.material.attenuationDistance = 2.0;
  isolatedDiamond.material.iridescence = 0;
  isolatedDiamond.material.sheen = 0;
  isolatedDiamond.visible = false;
  const bs = ringState.baseScale || 1;
  isolatedDiamond.scale.setScalar(STAGE_ONE_DIAMOND_HOLD_SCALE * bs);
  scene.add(isolatedDiamond);
}

// RENDER LOOP
 

function animate() {
  requestAnimationFrame(animate);

  const p = scrollState.progress;
  const mouse = getMouse();

  updateWireframeTilt();

  if (scrollEnabled) {
    updateLoaderVisibility(p);
    updateStageOnePainting(camera, p, mouse);
    updateStage1(p, mouse);
    updateStage2(p, mouse);
    updateStage3(p, mouse);
    updateStage4(p);
    updateStage5(p, mouse);
    updateStage6(p);
    updateStage7(p);
    updateStage8(p);
    updateBackgrounds(p, mouse, camera, STAGE_FLOW, getMorphAnchorPercent);
    updateGoldParticles();

    // reset camera in gap between stages
    if (p < STAGE_FLOW.stage6Start || p > STAGE_FLOW.stage8Start) {
      if (p > 0.58 && p < 0.68) {
        camera.position.lerp(defaultCameraPos, 0.05);
        camera.lookAt(0, 0, 0);
      }
    }

    // gentle spin between stages
    if (ringState.model && ringState.model.visible && p > 0.25 && p < 0.55) {
      ringState.model.rotation.y += 0.004;
    }
  }

  if (controls && controls.enabled) controls.update();
  renderer.render(scene, camera);
}


function updateLoaderVisibility(p) {
  if (!_loaderScreen || loadingState.failed) return;
  if (p > 0.01) {
    _loaderScreen.style.opacity = Math.max(0, 1 - mapRange(p, 0, 0.03));
    if (p > 0.03) _loaderScreen.style.display = 'none';
  }
}

// STAGE 1: wireframe shrinks, diamond swaps in (0 → ~0.26)

function updateStage1(p, mouse) {
  const wireframe = getWireframe();
  const wireframeMat = getWireframeMaterial();
  if (!wireframe) return;

  if (p < 0.08) stageOneTargetLocked = false;
  if (p >= STAGE_FLOW.videoStart) { wireframe.visible = false; return; }

  const shrinkT = mapSmoothRange(p, 0.0, 0.125);
  const swapT = mapSmoothRange(p, 0.114, 0.174);
  const targetWorld = getStageOneTargetWorld();
  const scale = THREE.MathUtils.lerp(STAGE_ONE_WIREFRAME_START_SCALE, STAGE_ONE_WIREFRAME_END_SCALE, shrinkT);

  wireframe.visible = swapT < 0.98;
  wireframe.scale.setScalar(scale);
  wireframe.position.x = THREE.MathUtils.lerp(0, targetWorld.x, shrinkT);
  wireframe.position.y = THREE.MathUtils.lerp(0.68, targetWorld.y, shrinkT) + Math.sin(shrinkT * Math.PI) * 0.012;

  // fade mouse tilt near painting
  const wireTiltInfluence = 1 - mapSmoothRange(p, 0.082, STAGE_FLOW.tearStart);
  wireframe.rotation.z += ((((mouse?.x ?? 0) * -0.05) * wireTiltInfluence) - wireframe.rotation.z) * 0.03;
  wireframe.rotation.x += (0 - wireframe.rotation.x) * 0.04;

  if (wireframeMat) wireframeMat.opacity = Math.pow(1 - swapT, 1.35) * 0.92;

  // swap wireframe -> real diamond
  if (isolatedDiamond) {
    const bsSwap = ringState.baseScale || 1;
    const wfScale = STAGE_ONE_DIAMOND_SWAP_SCALE * bsSwap;
    isolatedDiamond.visible = swapT > 0.02;
    isolatedDiamond.position.copy(wireframe.position);
    isolatedDiamond.position.y += THREE.MathUtils.lerp(0.01, 0.0, swapT);
    isolatedDiamond.scale.setScalar(THREE.MathUtils.lerp(wfScale * 1.02, wfScale, swapT));
    isolatedDiamond.rotation.y += 0.01 + swapT * 0.003;
    isolatedDiamond.rotation.x += (0 - isolatedDiamond.rotation.x) * 0.08;
    isolatedDiamond.rotation.z += (0 - isolatedDiamond.rotation.z) * 0.08;
    isolatedDiamond.material.opacity = Math.pow(swapT, 1.15);
    isolatedDiamond.material.emissiveIntensity = 0.035 + swapT * 0.01;

    const haloT = smooth01(mapRange(p, 0.154, 0.208));
    const touch = getObjectScreenHover(isolatedDiamond, mouse, 0.12);
    isolatedDiamond.getWorldPosition(worldTempA);
    const sparkle = touch * (0.74 + 0.26 * Math.sin(performance.now() * 0.024));
    isolatedDiamond.material.clearcoat = THREE.MathUtils.lerp(0.03, 0.055, touch);
    isolatedDiamond.material.envMapIntensity = THREE.MathUtils.lerp(1.95, 2.22, touch);
    isolatedDiamond.material.specularIntensity = THREE.MathUtils.lerp(1.78, 2.08, touch);
    setRevealHalo(isolatedDiamond.position, haloT * 0.08 + sparkle * 0.14, 0.08 + haloT * 0.12 + sparkle * 0.08);
  } else {
    const haloT = smooth01(mapRange(p, 0.154, 0.208));
    setRevealHalo(wireframe.position, haloT * 0.08, 0.08 + haloT * 0.12);
  }
}

// STAGE 2: diamond on painting, gathers to center (~0.12 → 0.528)
// 

function updateStage2(p, mouse) {
  if (p < 0.12 || p > STAGE_TWO_INTERACTIVE_END) {
    if (_canvasEl) _canvasEl.style.cursor = '';
    if (p > STAGE_TWO_INTERACTIVE_END) hideText('text-stage2');
    return;
  }
  if (!isolatedDiamond) return;

  const bs = getRingModelScale();
  const holdScale = STAGE_ONE_DIAMOND_HOLD_SCALE * bs;
  const targetWorld = getStageOneTargetWorld();
  const videoT = mapSmoothRange(p, STAGE_FLOW.videoStart, STAGE_FLOW.videoEnd);
  const gatherT = mapSmoothRange(p, STAGE_FLOW.gatherStart, STAGE_FLOW.gatherEnd);
  const hoverActivation = mapSmoothRange(p, STAGE_FLOW.gatherStart + 0.004, STAGE_FLOW.gatherEnd - 0.006);
  const touch = getObjectScreenHover(isolatedDiamond, mouse, 0.34);
  const stageTouch = touch * hoverActivation;
  const hoverPulse = stageTouch * (0.045 + 0.02 * Math.sin(performance.now() * 0.014));
  const hoverShiftX = (mouse?.x ?? 0) * 0.08 * stageTouch;
  const hoverShiftY = (mouse?.y ?? 0) * 0.05 * stageTouch + stageTouch * 0.035;

  // hide ring during this stage
  if (ringState.model) ringState.model.visible = false;
  if (ringState.ringBody) ringState.ringBody.visible = false;
  if (ringState.eyeLeft) ringState.eyeLeft.visible = false;
  if (ringState.eyeRight) ringState.eyeRight.visible = false;
  ringState.physicsEnabled = false;
  returnToRest();
  ringState.diamonds.forEach((d) => {
    d.visible = false;
    const rs = d.userData.restScale || d.scale;
    d.scale.copy(rs);
  });

  isolatedDiamond.visible = true;

  // two-phase animation synced to painting shrink:
  // phase 1 (shrinkT): diamond shrinks WITH the painting, stays anchored
  // phase 2 (extractT): diamond pulls forward out of the painting and grows
  const { shrinkT, extractT } = getPaintingShrinkProgress();

  // during shrink: diamond stays on painting and scales down with it
  // during extract: diamond moves to center and grows large
  const shrinkHoldScale = THREE.MathUtils.lerp(holdScale, holdScale * 0.42, shrinkT * (1 - extractT));
  const extractScale = THREE.MathUtils.lerp(shrinkHoldScale, STAGE_ONE_DIAMOND_GATHER_SCALE * bs, extractT);
  const extractZ = extractT * extractT * 1.6;

  // position: anchored to painting during shrink, then flies to center during extract
  const anchorX = targetWorld.x * THREE.MathUtils.lerp(1, 0.38, shrinkT);
  const anchorY = targetWorld.y * THREE.MathUtils.lerp(1, 0.38, shrinkT) + shrinkT * 0.25;
  isolatedDiamond.position.set(
    THREE.MathUtils.lerp(anchorX, 0, extractT) + hoverShiftX,
    THREE.MathUtils.lerp(anchorY, 0.03, extractT) + hoverShiftY,
    extractZ,
  );
  isolatedDiamond.scale.setScalar(extractScale * (1 + hoverPulse));
  isolatedDiamond.rotation.y += 0.016 + extractT * 0.025 + stageTouch * 0.01;

  const idleX = Math.sin(performance.now() * 0.0012) * 0.034;
  const idleZ = Math.cos(performance.now() * 0.00105) * 0.03;
  const hoverX = (mouse?.y ?? 0) * 0.4 * stageTouch;
  const hoverZ = (mouse?.x ?? 0) * -0.46 * stageTouch;
  isolatedDiamond.rotation.x += ((idleX + hoverX) - isolatedDiamond.rotation.x) * 0.14;
  isolatedDiamond.rotation.z += ((idleZ + hoverZ) - isolatedDiamond.rotation.z) * 0.14;

  isolatedDiamond.getWorldPosition(worldTempA);
  if (stageTouch > 0.001) {
    const sparkle = stageTouch * (0.72 + 0.28 * Math.sin(performance.now() * 0.018));
    setRevealHalo(worldTempA, sparkle * 0.18 + gatherT * 0.22, 0.11 + sparkle * 0.12 + gatherT * 0.38);
  } else if (gatherT > 0.001) {
    // brighter halo as diamond extracts from the painting
    setRevealHalo(worldTempA, gatherT * 0.18, 0.1 + gatherT * 0.36);
  }

  if (_canvasEl) _canvasEl.style.cursor = stageTouch > 0.08 ? 'pointer' : '';
  if (cursorLight) cursorLight.intensity = THREE.MathUtils.lerp(1.05, 2.2, stageTouch);

  // warm amber while on painting, transitions to clear as diamond extracts
  const warmth = THREE.MathUtils.clamp(1 - extractT * 1.4, 0, 1);
  isolatedDiamond.material.color.lerpColors(
    new THREE.Color(0xfafafa), new THREE.Color(0xf5e2b8), warmth,
  );
  isolatedDiamond.material.emissiveIntensity = warmth * 0.035 + stageTouch * 0.006;
  isolatedDiamond.material.envMapIntensity = THREE.MathUtils.lerp(0.65, 1.8, extractT) + stageTouch * 0.3;
  isolatedDiamond.material.roughness = THREE.MathUtils.lerp(0.04, 0.01, extractT);
  isolatedDiamond.material.transmission = THREE.MathUtils.lerp(0.04, 0.1, extractT);
  isolatedDiamond.material.clearcoat = THREE.MathUtils.lerp(0.02, 0.04, extractT) + stageTouch * 0.02;
  isolatedDiamond.material.specularIntensity = THREE.MathUtils.lerp(1.2, 1.9, extractT);

  if (p > 0.248 && p < STAGE_TWO_INTERACTIVE_END && videoT > 0.05) showText('text-stage2');
  else hideText('text-stage2');
}

// STAGE 3: diamonds multiply, cursor physics (0.528 → 0.58)

function updateStage3(p, mouse) {
  if (p < STAGE_TWO_INTERACTIVE_END || p > STAGE_FLOW.stage3End) {
    hideText('text-stage3');
    return;
  }

  const bs = getRingModelScale();
  const anchorDiamond = ringState.anchorDiamond || ringState.diamonds[0];
  const mergeStart = worldTempB.set(0, 0.03, 0);
  const morphT = mapSmoothRange(p, STAGE_TWO_INTERACTIVE_END, 0.572);
  const fadeT = mapSmoothRange(p, 0.548, 0.578);

  if (ringState.model) {
    ringState.model.visible = true;
    ringState.model.position.set(0, 0, 0);
    ringState.model.scale.setScalar(bs);
  }
  if (ringState.ringBody) ringState.ringBody.visible = false;
  if (ringState.eyeLeft) ringState.eyeLeft.visible = false;
  if (ringState.eyeRight) ringState.eyeRight.visible = false;

  if (anchorDiamond) {
    anchorDiamond.getWorldPosition(worldTempA);
    anchorDiamond.getWorldScale(worldTempScale);
  } else {
    worldTempA.set(0, 0, 0);
    worldTempScale.setScalar(0.17 * bs);
  }

  // merge isolated diamond into anchor
  if (isolatedDiamond) {
    if (fadeT < 0.995) {
      const targetScale = Math.max(worldTempScale.x, worldTempScale.y, worldTempScale.z, 0.165 * bs);
      const mergeArc = Math.sin(morphT * Math.PI) * 0.045;
      isolatedDiamond.visible = true;
      isolatedDiamond.position.set(
        THREE.MathUtils.lerp(mergeStart.x, worldTempA.x, morphT),
        THREE.MathUtils.lerp(mergeStart.y, worldTempA.y, morphT) + mergeArc * (1 - fadeT * 0.85),
        THREE.MathUtils.lerp(0, worldTempA.z, morphT),
      );
      isolatedDiamond.scale.setScalar(
        THREE.MathUtils.lerp(STAGE_ONE_DIAMOND_GATHER_SCALE * bs, targetScale * 0.94, morphT) * (1 - fadeT * 0.05),
      );
      const baseRotY = THREE.MathUtils.lerp(0.18, (anchorDiamond ? anchorDiamond.rotation.y : 0) - 0.42, morphT);
      const baseRotX = THREE.MathUtils.lerp(0.06, (anchorDiamond ? anchorDiamond.rotation.x : 0) + 0.5, morphT);
      const baseRotZ = THREE.MathUtils.lerp(0.02, (anchorDiamond ? anchorDiamond.rotation.z : 0) + 0.34, morphT);
      isolatedDiamond.rotation.y += (baseRotY - isolatedDiamond.rotation.y) * 0.06;
      const touch = getObjectScreenHover(isolatedDiamond, mouse, 0.24) * (1 - fadeT * 0.92);
      const hoverRotX = (mouse?.y ?? 0) * 0.16 * touch;
      const hoverRotZ = (mouse?.x ?? 0) * -0.18 * touch;
      isolatedDiamond.rotation.x += ((baseRotX + hoverRotX) - isolatedDiamond.rotation.x) * 0.08;
      isolatedDiamond.rotation.z += ((baseRotZ + hoverRotZ) - isolatedDiamond.rotation.z) * 0.08;
      isolatedDiamond.material.opacity = THREE.MathUtils.lerp(1, 0.08, fadeT);
      if (touch > 0.001) {
        isolatedDiamond.material.clearcoat = THREE.MathUtils.lerp(0.03, 0.05, touch);
        isolatedDiamond.material.envMapIntensity = THREE.MathUtils.lerp(2.0, 2.22, touch);
      }
      setRevealHalo(isolatedDiamond.position, 0.62 * (1 - fadeT) + touch * 0.1, 0.38 + (1 - fadeT) * 0.42 + touch * 0.05);
    } else {
      isolatedDiamond.visible = false;
    }
  }

  // reveal diamonds outward from anchor
  const totalDiamonds = ringState.diamonds.length;
  const anchorThresholdStart = STAGE_TWO_INTERACTIVE_END + 0.014;
  const anchorThresholdEnd = STAGE_TWO_INTERACTIVE_END + 0.052;
  const revealBase = STAGE_TWO_INTERACTIVE_END + 0.022;
  const revealSpread = 0.074;
  ringState.diamonds.forEach((diamond, index) => {
    const restScale = diamond.userData.restScale || diamond.scale;
    const rank = diamond.userData.revealRank ?? index;
    if (diamond === anchorDiamond) {
      const anchorAppear = mapSmoothRange(p, anchorThresholdStart, anchorThresholdEnd);
      diamond.visible = anchorAppear > 0.01;
      diamond.scale.copy(restScale).multiplyScalar(THREE.MathUtils.lerp(0.62, 1, anchorAppear));
    } else {
      const threshold = revealBase + (rank / Math.max(1, totalDiamonds - 1)) * revealSpread;
      const revealT = mapSmoothRange(p, threshold, threshold + 0.052);
      diamond.visible = revealT > 0.01;
      diamond.scale.copy(restScale).multiplyScalar(0.1 + revealT * 0.9);
    }
  });

  // text for assembly stage
  if (p > 0.53 && p < 0.575) showText('text-stage3');
  else hideText('text-stage3');

  if (p > 0.53 && p < 0.60) {
    ringState.physicsEnabled = true;
    updateDiamondPhysics(getCursorPoint());
  } else {
    ringState.physicsEnabled = false;
    returnToRest();
  }
}

// STAGE 4: ring body + eyes assemble (0.54 → 0.68)

function updateStage4(p) {
  if (p < STAGE_FLOW.stage4Start || p > STAGE_FLOW.stage4End) {
    stage4YawCaptured = false;
    if (p > STAGE_FLOW.stage4End) hideText('text-stage4');
    return;
  }

  setRevealHalo(worldTempA.set(0, 0, 0), 0, 0);
  ringState.physicsEnabled = false;
  returnToRest();

  const bs = getRingModelScale();
  const bodyT = mapSmoothRange(p, 0.54, 0.61);
  const settleT = mapSmoothRange(p, 0.57, 0.65);

  if (ringState.model) {
    if (!stage4YawCaptured) {
      stage4StartYaw = ringState.model.rotation.y;
      stage4YawCaptured = true;
    }
    ringState.model.visible = true;
    ringState.model.position.y = THREE.MathUtils.lerp(-1.4, 0, bodyT);
    ringState.model.scale.setScalar(bs);
    const revealPoseT = mapSmoothRange(p, STAGE_FLOW.stage4Start, 0.62);
    ringState.model.rotation.y = THREE.MathUtils.lerp(stage4StartYaw, STAGE4_EYE_REVEAL_YAW, revealPoseT);
  }
  if (ringState.ringBody) {
    ringState.ringBody.visible = true;
    ringState.ringBody.material.opacity = bodyT;
  }

  setDiamondRestState((1 - settleT) * 0.26);

  // eyes pop in with overshoot ease
  const eyeT = mapSmoothRange(p, 0.62, 0.67);
  if (ringState.eyeLeft) {
    ringState.eyeLeft.visible = eyeT > 0.01;
    setEyeScale(ringState.eyeLeft, easeBackOut(Math.max(0.001, eyeT)));
  }
  if (ringState.eyeRight) {
    ringState.eyeRight.visible = eyeT > 0.01;
    setEyeScale(ringState.eyeRight, easeBackOut(Math.max(0.001, eyeT)));
  }

  if (p > 0.62 && p < 0.67) showText('text-stage4');
  else hideText('text-stage4');
}

 
// STAGE 5: configurator + orbit controls (0.67 → 0.82)

function updateStage5(p, mouse) {
  if (p < STAGE_FLOW.stage5Start || p > STAGE_FLOW.stage5End) {
    hideText('text-stage5');
    if (p > STAGE_FLOW.stage5End) { hideConfigurator(); if (controls) controls.enabled = false; orbitActive = false; }
    if (p < STAGE_FLOW.stage5Start) hideConfigurator();
    return;
  }

  if (ringState.model) { ringState.model.visible = true; ringState.model.position.y = 0; }
  if (ringState.ringBody) { ringState.ringBody.visible = true; ringState.ringBody.material.opacity = 1; }
  setDiamondRestState(0);
  if (ringState.eyeLeft) { ringState.eyeLeft.visible = true; setEyeScale(ringState.eyeLeft, 1); }
  if (ringState.eyeRight) { ringState.eyeRight.visible = true; setEyeScale(ringState.eyeRight, 1); }

  const bs = getRingModelScale();
  const moveT = mapSmoothRange(p, 0.67, 0.75);
  // ring slides left and scales up for configurator
  const ringTargetX = -1.65;
  const ringTargetY = 0.08;
  if (ringState.model) {
    ringState.model.position.x = THREE.MathUtils.lerp(0, ringTargetX, moveT);
    ringState.model.position.y = THREE.MathUtils.lerp(0, ringTargetY, moveT);
    ringState.model.scale.setScalar(THREE.MathUtils.lerp(1.0, 1.61, moveT) * bs);
  }

  if (!orbitActive) {
    // camera follows ring closely so orbit radius stays tight
    const camX = THREE.MathUtils.lerp(0, ringTargetX + 0.15, moveT);
    camera.position.lerp(worldTempA.set(camX, 0.12, 3.85), 0.08);
    camera.lookAt(ringTargetX, ringTargetY, 0);
  }

  // "make it yours" text before configurator slides in
  if (p > 0.685 && p < 0.73) showText('text-stage5');
  else hideText('text-stage5');

  if (p > 0.71) showConfigurator();
  else hideConfigurator();

  if (p > 0.73 && p < STAGE_FLOW.stage5End) {
    if (controls && !orbitActive) {
      controls.target.set(ringTargetX, ringTargetY, 0);
      controls.minDistance = 2.5;
      controls.maxDistance = 6.0;
      controls.enabled = true;
      if (_canvasEl) _canvasEl.style.pointerEvents = 'auto';
      orbitActive = true;
    }
  } else if (controls && orbitActive) {
    controls.target.set(0, 0, 0);
    controls.minDistance = 0;
    controls.maxDistance = Infinity;
    controls.enabled = false;
    if (_canvasEl) _canvasEl.style.pointerEvents = 'none';
    orbitActive = false;
  }

  if (ringState.model && mouse && !orbitActive) {
    ringState.model.rotation.x += ((mouse.y * 0.06) - ringState.model.rotation.x) * 0.05;
    ringState.model.rotation.z += ((mouse.x * -0.04) - ringState.model.rotation.z) * 0.05;
    ringState.model.rotation.y += 0.002;
  }
}


// STAGE 6: (0.81 → 0.88)

function updateStage6(p) {
  if (p < STAGE_FLOW.stage6Start || p > STAGE_FLOW.stage6End) {
    if (p > STAGE_FLOW.stage6End) hideText('text-stage6');
    return;
  }

  if (controls) { controls.enabled = false; if (_canvasEl) _canvasEl.style.pointerEvents = 'none'; }
  orbitActive = false;
  hideConfigurator();

  const bs = getRingModelScale();
  if (ringState.model) {
    const returnT = mapRange(p, 0.81, 0.84);
    ringState.model.position.x = THREE.MathUtils.lerp(-1.65, 0, returnT);
    ringState.model.position.y = 0;
    ringState.model.scale.setScalar(1.3 * bs);
  }

  const orbitT = mapRange(p, 0.81, 0.87);
  const angle = orbitT * Math.PI * 2;
  camera.position.x = Math.sin(angle) * 5;
  camera.position.z = Math.cos(angle) * 5;
  camera.position.y = 1 + Math.sin(orbitT * Math.PI) * 0.5;
  camera.lookAt(0, 0, 0);

  if (!lastGoldBurst && orbitT > 0.3) { activateGoldParticles(); lastGoldBurst = true; }
  if (orbitT < 0.1) lastGoldBurst = false;

  const textT = mapRange(p, 0.83, 0.85);
  const textOutT = mapRange(p, 0.87, 0.88);
  if (textT > 0 && textOutT < 1) showText('text-stage6');
  else hideText('text-stage6');
}

// STAGE 7: camera resets, ring shrinks (0.87 → 0.95)

function updateStage7(p) {
  if (p < STAGE_FLOW.stage7Start || p > STAGE_FLOW.stage7End) return;

  camera.position.lerp(worldTempA.set(0, 0.3, 3.95), 0.08);
  camera.lookAt(0, 0.2, 0);

  const bs = getRingModelScale();
  if (ringState.model) {
    const shrinkT = mapSmoothRange(p, 0.87, 0.94);
    ringState.model.scale.setScalar(THREE.MathUtils.lerp(1.35, 1.15, shrinkT) * bs);
    ringState.model.position.set(
      THREE.MathUtils.lerp(0, 0.06, shrinkT),
      THREE.MathUtils.lerp(0, 0.34, shrinkT),
      0,
    );
    ringState.model.rotation.y += 0.002;
  }
}

// STAGE 8: product card (0.94 → 1.0)

function updateStage8(p) {
  if (p < STAGE_FLOW.stage8Start) { hideProductCard(); return; }

  const zoomOutT = mapSmoothRange(p, STAGE_FLOW.stage8Start, 1.0);
  const cardT = mapSmoothRange(p, 0.968, 0.993);

  if (!productOrbitActive) {
    camera.position.set(
      THREE.MathUtils.lerp(0, -0.18, zoomOutT),
      THREE.MathUtils.lerp(0.34, -0.04, zoomOutT),
      THREE.MathUtils.lerp(3.4, 5.6, zoomOutT),
    );
    camera.lookAt(
      THREE.MathUtils.lerp(0, 0.22, cardT),
      THREE.MathUtils.lerp(0.28, 0.08, zoomOutT),
      0,
    );
  }

  const bs = getRingModelScale();
  if (ringState.model) {
    ringState.model.position.set(
      THREE.MathUtils.lerp(0.06, 1.6, cardT),
      THREE.MathUtils.lerp(0.34, 0.18, cardT),
      0,
    );
    ringState.model.scale.setScalar(THREE.MathUtils.lerp(1.35, 1.08, zoomOutT) * bs);
    ringState.model.rotation.y += 0.0018;
  }

  if (cardT > 0.08) showProductCard();
  else hideProductCard();

  if (p > 0.965 && controls) {
    if (!productOrbitActive) {
      controls.target.set(0.44, 0.38, 0);
      controls.enabled = true;
      if (_canvasEl) _canvasEl.style.pointerEvents = 'auto';
      productOrbitActive = true;
    }
  } else if (controls && productOrbitActive) {
    controls.target.set(0, 0, 0);
    controls.enabled = false;
    if (_canvasEl) _canvasEl.style.pointerEvents = 'none';
    productOrbitActive = false;
  }
}

// ── helpers ──

function setDiamondRestState(offsetY = 0) {
  ringState.diamonds.forEach((diamond) => {
    const rest = diamond.userData.restPosition || diamond.position;
    const restScale = diamond.userData.restScale || diamond.scale;
    diamond.visible = true;
    diamond.position.set(rest.x, rest.y + offsetY, rest.z);
    diamond.scale.copy(restScale);
  });
}

// ── start ──
init().catch((err) => {
  console.error('[Panthere] Init error:', err);
});
