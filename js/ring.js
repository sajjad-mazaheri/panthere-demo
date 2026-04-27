// ring.js -- loads the GLB model, assigns PBR materials, sets up cursor physics

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createMetalMaterial, createGemMaterial, createDiamondMaterial, METALS, EYES, PAVE } from './materials.js';

const DRACO_DECODER_PATH = 'https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/';
export const ringState = {
  model: null,
  ringBody: null,
  diamonds: [],         // All Diamond_Round meshes
  anchorDiamond: null,
  eyeLeft: null,
  eyeRight: null,
  metalMaterial: null,
  eyeMaterial: null,
  diamondMaterial: null,
  currentMetal: 'yellowGold',
  currentEye: 'emerald',
  currentPave: 'icyWhite',
  // Physics
  physicsDiamonds: [],
  physicsEnabled: false,
  physicsStrength: 0,
  // Scale
  baseScale: 1,
};


export function loadRing(url, scene, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();

    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    dracoLoader.setDecoderConfig({ type: 'js' });
    dracoLoader.preload();
    loader.setDRACOLoader(dracoLoader);

    ringState.model = null;
    ringState.ringBody = null;
    ringState.diamonds = [];
    ringState.anchorDiamond = null;
    ringState.eyeLeft = null;
    ringState.eyeRight = null;
    ringState.diamondMaterial = null;
    ringState.physicsDiamonds = [];

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        ringState.model = model;

        // Create materials
        ringState.metalMaterial = createMetalMaterial(METALS.yellowGold);
        ringState.eyeMaterial = createGemMaterial(EYES.emerald);
        ringState.diamondMaterial = createDiamondMaterial(PAVE.icyWhite);

        // Traverse and assign
        model.traverse((child) => {
          if (!child.isMesh) return;

          if (child.name.includes('Diamond_Round')) {
            ringState.diamonds.push(child);
            child.material = ringState.diamondMaterial;
            child.visible = false;
            child.userData.restPosition = child.position.clone();
            child.userData.restScale = child.scale.clone();
            }
          else if (child.name.startsWith('Diamond_Pear')) {
            if (!ringState.eyeLeft) {
              ringState.eyeLeft = child;
            } else {
              ringState.eyeRight = child;
            }
            child.material = ringState.eyeMaterial;
            child.visible = false;
            child.frustumCulled = false;
            child.renderOrder = 7;
            child.userData.baseScale = child.scale.clone();
          }
          else if (!ringState.ringBody) {
            ringState.ringBody = child;
            child.material = ringState.metalMaterial;
            child.material.transparent = true;
            child.material.opacity = 0;
            child.visible = false;
          }
        });

        // center model using bounding box
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        // wrap in container so we can transform without losing centering
        model.position.sub(center);

        const container = new THREE.Group();
        container.add(model);

        // auto-scale to fill ~2.5 units
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 2.5;
        if (maxDim > 0) {
          const scaleFactor = targetSize / maxDim;
          container.scale.setScalar(scaleFactor);
          ringState.baseScale = scaleFactor;
        } else {
          ringState.baseScale = 1;
        }

        // Hide entire model initially
        container.visible = false;
        scene.add(container);

        // Store the container as the "model" for positioning/scaling in main.js
        ringState.model = container;

        resolveAnchorDiamond();
        setupPhysicsDiamonds();

        dracoLoader.dispose();
        resolve(ringState);
      },
      (event) => {
        if (typeof onProgress === 'function' && event && event.total) {
          onProgress(event.loaded / event.total);
        }
      },
      (error) => {
        console.error('[Ring] Load error:', error);
        dracoLoader.dispose();
        reject(error);
      }
    );
  });
}

function setupPhysicsDiamonds() {
  ringState.physicsDiamonds = [];
  for (let i = 0; i < ringState.diamonds.length; i += 1) {
    const diamond = ringState.diamonds[i];
    const worldPos = new THREE.Vector3();
    diamond.getWorldPosition(worldPos);
    const restScale = diamond.userData.restScale ? diamond.userData.restScale.clone() : diamond.scale.clone();
    ringState.physicsDiamonds.push({
      mesh: diamond,
      restPosition: diamond.position.clone(),
      restScale,
      currentOffset: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      worldPos: worldPos,
      revealRank: diamond.userData.revealRank ?? i,
      maxOffset: 0.02 + Math.random() * 0.045,
    });
  }
}

function resolveAnchorDiamond() {
  if (!ringState.diamonds.length) return;

  const yValues = ringState.diamonds.map((diamond) => diamond.position.y);
  const maxY = Math.max(...yValues);
  const minY = Math.min(...yValues);
  const upperThreshold = minY + (maxY - minY) * 0.55;

  let bestDiamond = ringState.diamonds[0];
  let bestScore = Number.POSITIVE_INFINITY;

  ringState.diamonds.forEach((diamond) => {
    const { x, y, z } = diamond.position;
    const heightPenalty = y < upperThreshold ? 0.65 : 0;
    const score = Math.abs(x) * 1.2 + Math.abs(z) * 0.9 + heightPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestDiamond = diamond;
    }
  });

  ringState.anchorDiamond = bestDiamond;

  const anchorPosition = bestDiamond.position.clone();
  ringState.diamonds
    .slice()
    .sort((a, b) => anchorPosition.distanceTo(a.position) - anchorPosition.distanceTo(b.position))
    .forEach((diamond, index) => {
      diamond.userData.revealRank = index;
    });
}

// cursor repulsion physics
const _repulsion = new THREE.Vector3();
const _spring = new THREE.Vector3();
const _zeroVec = new THREE.Vector3();
const _localCursor = new THREE.Vector3();
const _delta = new THREE.Vector3();

export function updateDiamondPhysics(cursorPoint) {
  if (!ringState.physicsEnabled || !cursorPoint) return;

  for (const pd of ringState.physicsDiamonds) {
    _localCursor.copy(cursorPoint);
    pd.mesh.parent.worldToLocal(_localCursor);
    _delta.copy(pd.restPosition).sub(_localCursor);
    const distance = _delta.length();
    const influence = THREE.MathUtils.clamp(1 - distance / 0.55, 0, 1);

    if (influence > 0) {
      _repulsion.copy(_delta.normalize()).multiplyScalar(influence * influence * 0.012);
      pd.velocity.add(_repulsion);
    }

    _spring.copy(pd.currentOffset).multiplyScalar(-0.18);
    pd.velocity.add(_spring);

    pd.velocity.multiplyScalar(0.78);

    pd.currentOffset.add(pd.velocity);
    pd.currentOffset.clampLength(0, pd.maxOffset);
    pd.mesh.position.copy(pd.restPosition).add(pd.currentOffset);
  }
}

// Smoothly return all physics diamonds to rest
export function returnToRest() {
  for (const pd of ringState.physicsDiamonds) {
    pd.velocity.multiplyScalar(0.7);
    pd.currentOffset.lerp(_zeroVec, 0.16);
    pd.mesh.position.copy(pd.restPosition).add(pd.currentOffset);
  }
}
