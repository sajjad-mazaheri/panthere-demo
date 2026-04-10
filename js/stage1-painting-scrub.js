// stage1-painting-scrub.js -- frame-by-frame painting sequence
// loads a frame sequence, maps scroll progress to frame index

import * as THREE from 'three';
import { clamp01, smooth01, mapRange, viewportAtDepth } from './utils.js';

const state = {
  ready: false,
  root: null,
  plane: null,
  frameBorder: null,
  material: null,
  stillTexture: null,
  imageAspect: 1,
  frameTextures: [],
  framesReady: false,
  framePromise: null,
  lastFrameIndex: -1,
  lookTarget: new THREE.Vector3(),
  shrinkT: 0,       // exposed so main.js can sync diamond to shrink
  extractT: 0,      // how far into the extraction phase
};

// timings match STAGE_FLOW in main.js
const STAGE_ONE_TIMINGS = {
  appearStart: 0.232,
  appearEnd: 0.272,
  videoStart: 0.258,
  videoEnd: 0.402,
  gatherStart: 0.402,
  gatherEnd: 0.52,
  // shrink sub-phases (within gatherStart→gatherEnd)
  shrinkEnd: 0.49,      // painting finishes shrinking here
  extractStart: 0.48,   // diamond starts extracting here
};
const PLANE_Z = -3.52;
const PLANE_SCALE = 1.0;

function scalePlaneToCover(camera) {
  if (!state.plane || !camera) return;
  const viewport = viewportAtDepth(camera, PLANE_Z);
  const viewportAspect = viewport.width / viewport.height;
  const imageAspect = state.imageAspect || 1;
  let width = viewport.width * PLANE_SCALE;
  let height = viewport.height * PLANE_SCALE;
  if (imageAspect > viewportAspect) {
    height = viewport.height * PLANE_SCALE;
    width = height * imageAspect;
  } else {
    width = viewport.width * PLANE_SCALE;
    height = width / imageAspect;
  }
  state.plane.scale.set(width, height, 1);
  // match frame border to painting size
  if (state.frameBorder) {
    state.frameBorder.scale.set(width, height, 1);
  }
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

function buildFrameUrls(frameDir, frameCount, frameExtension = 'webp', framePadding = 3) {
  return Array.from({ length: frameCount }, (_, i) => {
    const num = String(i + 1).padStart(framePadding, '0');
    return `${frameDir}/${num}.${frameExtension}`;
  });
}

function preloadFrameTextures(frameDir, frameCount, frameExtension, framePadding) {
  const urls = buildFrameUrls(frameDir, frameCount, frameExtension, framePadding);
  return Promise.all(urls.map((url) => loadTexture(url)));
}

function bootstrapFrameSequence(frameDir, frameCount, frameExtension, framePadding) {
  state.framePromise = preloadFrameTextures(frameDir, frameCount, frameExtension, framePadding)
    .then((textures) => {
      state.frameTextures = textures;
      state.framesReady = textures.length > 0;
      state.lastFrameIndex = -1;
    })
    .catch((error) => {
      console.warn('[Panthere] Unable to load stage-1 frame sequence. Keeping the still frame.', error);
      state.frameTextures = [];
      state.framesReady = false;
      state.lastFrameIndex = -1;
    });
  return state.framePromise;
}

function setDisplayedTexture(texture) {
  if (!state.material || !texture || state.material.map === texture) return;
  state.material.map = texture;
  state.material.needsUpdate = true;
}

function updateFrameTexture(progress) {
  if (!state.framesReady || !state.material || state.frameTextures.length === 0) return;
  const frameIndex = THREE.MathUtils.clamp(
    Math.floor(clamp01(progress) * state.frameTextures.length),
    0, state.frameTextures.length - 1,
  );
  if (frameIndex === state.lastFrameIndex) return;
  state.lastFrameIndex = frameIndex;
  setDisplayedTexture(state.frameTextures[frameIndex]);
}

// free GPU memory after painting stage is done
export function disposeFrameTextures() {
  state.frameTextures.forEach((tex) => tex.dispose());
  state.frameTextures = [];
  state.framesReady = false;
  state.lastFrameIndex = -1;
}

export async function initStageOnePainting(scene, camera, {
  stillUrl, frameDir, frameCount = 0, frameExtension = 'webp', framePadding = 3,
}) {
  if (state.ready) return state;

  state.stillTexture = await loadTexture(stillUrl);
  state.imageAspect = (state.stillTexture.image?.width && state.stillTexture.image?.height)
    ? state.stillTexture.image.width / state.stillTexture.image.height
    : 1;

  state.root = new THREE.Group();
  state.root.visible = false;
  scene.add(state.root);

  state.material = new THREE.MeshBasicMaterial({
    map: state.stillTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  state.material.toneMapped = false;

  state.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), state.material);
  state.plane.position.z = PLANE_Z;
  state.plane.renderOrder = -56;
  state.root.add(state.plane);

  // gilded frame border that appears during shrink-to-frame
  const frameBorderMat = new THREE.MeshBasicMaterial({
    color: 0xc4a265,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  frameBorderMat.toneMapped = false;
  // thin border made of 4 planes around the painting
  const borderGroup = new THREE.Group();
  const borderThickness = 0.018;
  const borderInset = 0.5; // half of 1×1 plane
  const hBar = new THREE.PlaneGeometry(1 + borderThickness * 2, borderThickness);
  const vBar = new THREE.PlaneGeometry(borderThickness, 1);
  const top = new THREE.Mesh(hBar, frameBorderMat);
  top.position.set(0, borderInset + borderThickness * 0.5, 0);
  const bottom = new THREE.Mesh(hBar, frameBorderMat);
  bottom.position.set(0, -borderInset - borderThickness * 0.5, 0);
  const left = new THREE.Mesh(vBar, frameBorderMat);
  left.position.set(-borderInset - borderThickness * 0.5, 0, 0);
  const right = new THREE.Mesh(vBar, frameBorderMat);
  right.position.set(borderInset + borderThickness * 0.5, 0, 0);
  borderGroup.add(top, bottom, left, right);
  borderGroup.position.z = PLANE_Z + 0.01;
  borderGroup.visible = false;
  state.frameBorder = borderGroup;
  state.root.add(borderGroup);

  scalePlaneToCover(camera);
  state.lastFrameIndex = -1;
  state.ready = true;

  if (frameDir && frameCount > 0) {
    await bootstrapFrameSequence(frameDir, frameCount, frameExtension, framePadding);
  }

  return state;
}

export function updateStageOnePainting(camera, progress, mouse) {
  if (!state.ready || !state.root || !state.plane || !state.material) return;

  const stageVisible = progress >= STAGE_ONE_TIMINGS.appearStart && progress < STAGE_ONE_TIMINGS.gatherEnd;
  state.root.visible = stageVisible;

  if (!stageVisible) {
    if (progress < STAGE_ONE_TIMINGS.appearStart) {
      state.lastFrameIndex = -1;
      setDisplayedTexture(state.stillTexture);
      state.material.opacity = 0;
    }
    return;
  }

  const appearT = smooth01(mapRange(progress, STAGE_ONE_TIMINGS.appearStart, STAGE_ONE_TIMINGS.appearEnd));
  const scrubT = mapRange(progress, STAGE_ONE_TIMINGS.videoStart, STAGE_ONE_TIMINGS.videoEnd);
  const videoT = smooth01(scrubT);
  const gatherT = smooth01(mapRange(progress, STAGE_ONE_TIMINGS.gatherStart, STAGE_ONE_TIMINGS.gatherEnd));
  const mouseX = mouse ? mouse.x : 0;
  const mouseY = mouse ? mouse.y : 0;

  // scrub frames during video range; keep LAST frame during gather
  if (progress >= STAGE_ONE_TIMINGS.videoStart && state.framesReady) {
    if (progress <= STAGE_ONE_TIMINGS.videoEnd) {
      updateFrameTexture(scrubT);
    } else {
      // lock to final frame during shrink-to-frame
      updateFrameTexture(1.0);
    }
  } else {
    setDisplayedTexture(state.stillTexture);
  }

  // camera movement during painting
  camera.position.x = mouseX * 0.085 + THREE.MathUtils.lerp(0, 0.028, videoT);
  camera.position.y = mouseY * 0.045 - gatherT * 0.018;
  camera.position.z = THREE.MathUtils.lerp(4.92, 4.82, videoT);
  state.lookTarget.set(mouseX * 0.05, mouseY * 0.03, PLANE_Z);
  camera.lookAt(state.lookTarget);

  scalePlaneToCover(camera);

  // shrink sub-phases: painting shrinks first, then diamond extracts
  const shrinkT = smooth01(mapRange(progress, STAGE_ONE_TIMINGS.gatherStart, STAGE_ONE_TIMINGS.shrinkEnd));
  const extractT = smooth01(mapRange(progress, STAGE_ONE_TIMINGS.extractStart, STAGE_ONE_TIMINGS.gatherEnd));
  state.shrinkT = shrinkT;
  state.extractT = extractT;

  // painting shrinks to ~38% with a golden frame border
  const shrinkScale = THREE.MathUtils.lerp(1.0, 0.38, shrinkT);
  const fadeStart = 0.7;  // painting starts fading after 70% of shrink
  const frameOpacity = appearT * THREE.MathUtils.lerp(1.0, 0.0, clamp01((shrinkT - fadeStart) / (1 - fadeStart)));
  state.material.opacity = frameOpacity;

  // show gilded frame border during shrink
  if (state.frameBorder) {
    const borderVisible = shrinkT > 0.05 && shrinkT < 0.98;
    state.frameBorder.visible = borderVisible;
    if (borderVisible) {
      const borderAlpha = Math.min(shrinkT * 4, 1) * (1 - clamp01((shrinkT - 0.8) * 5));
      state.frameBorder.children.forEach((mesh) => {
        mesh.material.opacity = borderAlpha;
      });
    }
  }

  state.root.position.x = 0;
  state.root.position.y = THREE.MathUtils.lerp(0, 0.25, shrinkT);
  state.root.position.z = THREE.MathUtils.lerp(0, -0.4, shrinkT);
  state.root.rotation.x = 0;
  state.root.rotation.y = 0;
  state.root.rotation.z = 0;
  state.root.scale.set(shrinkScale, shrinkScale, 1);
}

export function getPaintingShrinkProgress() {
  return { shrinkT: state.shrinkT, extractT: state.extractT };
}

export function hideStageOnePainting() {
  if (!state.ready || !state.root) return;
  state.root.visible = false;
}
