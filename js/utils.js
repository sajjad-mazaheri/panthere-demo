// utils.js — shared math helpers used across modules

import * as THREE from 'three';

export function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

// hermite smooth interpolation (0-1 in, 0-1 out)
export function smooth01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

// map value from [inMin, inMax] to [0, 1], clamped
export function mapRange(value, inMin, inMax) {
  return clamp01((value - inMin) / (inMax - inMin));
}

// map + smooth
export function mapSmoothRange(value, inMin, inMax) {
  return smooth01(mapRange(value, inMin, inMax));
}

// how much of the viewport (in world units) is visible at a given depth
export function viewportAtDepth(camera, worldZ) {
  const distance = Math.abs(camera.position.z - worldZ);
  const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  return { width: height * camera.aspect, height };
}

// overshoot ease-out (for eye gem pop-in etc)
export function easeBackOut(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
