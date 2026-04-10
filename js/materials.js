// materials.js -- PBR material configs + factories for metals, gems, diamonds

import * as THREE from 'three';

function createMetalSurfaceTexture(size = 256) {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const grain = (Math.random() - 0.5) * 26;
      const brushed = Math.sin((x / size) * Math.PI * 18) * 10;
      const cross = Math.sin((y / size) * Math.PI * 4) * 4;
      const value = Math.max(84, Math.min(178, 128 + grain + brushed + cross));

      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  return texture;
}

const sharedMetalSurface = createMetalSurfaceTexture();

export const METALS = {
  yellowGold: {
    label: 'Yellow Gold',
    color: 0xbf9650,
    metalness: 1,
    roughness: 0.14,
    envMapIntensity: 2.65,
    clearcoat: 0.42,
    clearcoatRoughness: 0.16,
    specularIntensity: 1,
    specularColor: 0xfff0c8,
    bumpScale: 0.012,
  },
  roseGold: {
    label: 'Rose Gold',
    color: 0xb7776d,
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: 2.45,
    clearcoat: 0.38,
    clearcoatRoughness: 0.18,
    specularIntensity: 0.95,
    specularColor: 0xffe0d8,
    bumpScale: 0.011,
  },
  whiteGold: {
    label: 'White Gold',
    color: 0xd5d0c7,
    metalness: 1,
    roughness: 0.115,
    envMapIntensity: 2.58,
    clearcoat: 0.44,
    clearcoatRoughness: 0.12,
    specularIntensity: 1.02,
    specularColor: 0xfff6e8,
    bumpScale: 0.01,
  },
  platinum: {
    label: 'Platinum',
    color: 0xe6ebf0,
    metalness: 1,
    roughness: 0.048,
    envMapIntensity: 3.28,
    clearcoat: 0.62,
    clearcoatRoughness: 0.065,
    specularIntensity: 1.2,
    specularColor: 0xf0f8ff,
    bumpScale: 0.007,
  },
};

export const EYES = {
  emerald: {
    label: 'Emerald',
    productText: 'emeralds',
    swatchColor: '#0E8F66',
    color: 0x0f8e66,
    transmission: 0.9,
    ior: 1.58,
    thickness: 1.2,
    roughness: 0.02,
    envMapIntensity: 1.9,
    emissive: 0x03150f,
    emissiveIntensity: 0.014,
    attenuationColor: 0x18aa74,
    attenuationDistance: 0.8,
    clearcoat: 0.18,
    clearcoatRoughness: 0.04,
    specularIntensity: 1.08,
    specularColor: 0xffffff,
  },
  sapphire: {
    label: 'Sapphire',
    productText: 'sapphires',
    swatchColor: '#2A56C6',
    color: 0x2852c4,
    transmission: 0.9,
    ior: 1.77,
    thickness: 1.25,
    roughness: 0.018,
    envMapIntensity: 1.95,
    emissive: 0x081235,
    emissiveIntensity: 0.016,
    attenuationColor: 0x3d72ff,
    attenuationDistance: 0.82,
    clearcoat: 0.2,
    clearcoatRoughness: 0.04,
    specularIntensity: 1.1,
    specularColor: 0xf4f8ff,
  },
  ruby: {
    label: 'Ruby',
    productText: 'rubies',
    swatchColor: '#C81F37',
    color: 0xc61f39,
    transmission: 0.88,
    ior: 1.77,
    thickness: 1.15,
    roughness: 0.022,
    envMapIntensity: 1.82,
    emissive: 0x21050b,
    emissiveIntensity: 0.014,
    attenuationColor: 0xd73448,
    attenuationDistance: 0.76,
    clearcoat: 0.18,
    clearcoatRoughness: 0.045,
    specularIntensity: 1.06,
    specularColor: 0xfff1f1,
  },
  amethyst: {
    label: 'Amethyst',
    productText: 'amethysts',
    swatchColor: '#8352BC',
    color: 0x8452bc,
    transmission: 0.9,
    ior: 1.544,
    thickness: 1.18,
    roughness: 0.02,
    envMapIntensity: 1.86,
    emissive: 0x180d28,
    emissiveIntensity: 0.014,
    attenuationColor: 0x9f6fe0,
    attenuationDistance: 0.84,
    clearcoat: 0.18,
    clearcoatRoughness: 0.045,
    specularIntensity: 1.06,
    specularColor: 0xf9f3ff,
  },
  tsavorite: {
    label: 'Tsavorite',
    productText: 'tsavorite garnets',
    swatchColor: '#169C56',
    color: 0x169b56,
    transmission: 0.9,
    ior: 1.74,
    thickness: 1.18,
    roughness: 0.018,
    envMapIntensity: 1.92,
    emissive: 0x04160d,
    emissiveIntensity: 0.014,
    attenuationColor: 0x27be69,
    attenuationDistance: 0.86,
    clearcoat: 0.2,
    clearcoatRoughness: 0.04,
    specularIntensity: 1.08,
    specularColor: 0xf3fff6,
  },
};

export const PAVE = {
  icyWhite: {
    label: 'Icy White',
    color: 0xfdfcf7,
    transmission: 0.08,
    ior: 2.05,
    thickness: 0.82,
    roughness: 0.011,
    envMapIntensity: 4.2,
    emissive: 0xffffff,
    emissiveIntensity: 0.004,
    attenuationColor: 0xfbfdff,
    attenuationDistance: 0.72,
    clearcoat: 0.4,
    clearcoatRoughness: 0.018,
    specularIntensity: 1.8,
    specularColor: 0xffffff,
  },
  warmChampagne: {
    label: 'Warm Champagne',
    color: 0xf3e3c7,
    transmission: 0.06,
    ior: 2.02,
    thickness: 0.8,
    roughness: 0.013,
    envMapIntensity: 3.9,
    emissive: 0xfff4e0,
    emissiveIntensity: 0.004,
    attenuationColor: 0xfff4e0,
    attenuationDistance: 0.78,
    clearcoat: 0.35,
    clearcoatRoughness: 0.02,
    specularIntensity: 1.6,
    specularColor: 0xfff9ed,
  },
};

export function createMetalMaterial(config) {
  return new THREE.MeshPhysicalMaterial({
    color: config.color,
    metalness: config.metalness,
    roughness: config.roughness,
    envMapIntensity: config.envMapIntensity,
    clearcoat: config.clearcoat,
    clearcoatRoughness: config.clearcoatRoughness,
    specularIntensity: config.specularIntensity,
    specularColor: new THREE.Color(config.specularColor),
    roughnessMap: sharedMetalSurface,
    bumpMap: sharedMetalSurface,
    bumpScale: config.bumpScale,
  });
}

export function createGemMaterial(config) {
  return new THREE.MeshPhysicalMaterial({
    color: config.color,
    metalness: 0,
    roughness: config.roughness,
    transmission: config.transmission,
    ior: config.ior,
    thickness: config.thickness,
    envMapIntensity: config.envMapIntensity,
    emissive: config.emissive,
    emissiveIntensity: config.emissiveIntensity,
    attenuationColor: new THREE.Color(config.attenuationColor),
    attenuationDistance: config.attenuationDistance,
    clearcoat: config.clearcoat,
    clearcoatRoughness: config.clearcoatRoughness,
    specularIntensity: config.specularIntensity,
    specularColor: new THREE.Color(config.specularColor),
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function createDiamondMaterial(config) {
  return new THREE.MeshPhysicalMaterial({
    color: config.color,
    metalness: 0,
    roughness: config.roughness,
    transmission: config.transmission,
    ior: config.ior,
    thickness: config.thickness,
    envMapIntensity: config.envMapIntensity,
    emissive: config.emissive,
    emissiveIntensity: config.emissiveIntensity,
    attenuationColor: new THREE.Color(config.attenuationColor),
    attenuationDistance: config.attenuationDistance,
    clearcoat: config.clearcoat,
    clearcoatRoughness: config.clearcoatRoughness,
    specularIntensity: config.specularIntensity,
    specularColor: new THREE.Color(config.specularColor),
    transparent: false,
  });
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// track active animations per material to cancel on rapid clicks
const _activeLerps = new WeakMap();

export function lerpMaterial(material, targetConfig, duration = 0.6) {
  // cancel any running animation on this material
  const prev = _activeLerps.get(material);
  if (prev) prev.cancelled = true;

  const state = { cancelled: false };
  _activeLerps.set(material, state);

  const startTime = performance.now();
  const startColor = material.color.clone();
  const targetColor = new THREE.Color(targetConfig.color);

  const numericKeys = [
    'metalness', 'roughness', 'envMapIntensity', 'clearcoat',
    'clearcoatRoughness', 'transmission', 'ior', 'thickness',
    'emissiveIntensity', 'attenuationDistance', 'specularIntensity', 'bumpScale',
  ];

  const startNumeric = {};
  const targetNumeric = {};
  for (const key of numericKeys) {
    if (targetConfig[key] !== undefined && material[key] !== undefined) {
      startNumeric[key] = material[key];
      targetNumeric[key] = targetConfig[key];
    }
  }

  const colorKeys = [
    ['emissive', targetConfig.emissive],
    ['specularColor', targetConfig.specularColor],
    ['attenuationColor', targetConfig.attenuationColor],
  ];
  const startColors = {};
  const targetColors = {};
  for (const [key, value] of colorKeys) {
    if (value !== undefined && material[key]) {
      startColors[key] = material[key].clone();
      targetColors[key] = new THREE.Color(value);
    }
  }

  function tick() {
    if (state.cancelled) return;

    const elapsed = (performance.now() - startTime) / 1000;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(t);

    material.color.lerpColors(startColor, targetColor, eased);
    for (const key of Object.keys(targetNumeric)) {
      material[key] = THREE.MathUtils.lerp(startNumeric[key], targetNumeric[key], eased);
    }
    for (const key of Object.keys(targetColors)) {
      material[key].lerpColors(startColors[key], targetColors[key], eased);
    }

    if (t < 1) requestAnimationFrame(tick);
    else _activeLerps.delete(material);
  }

  tick();
}
