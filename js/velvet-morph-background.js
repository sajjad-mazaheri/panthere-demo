// velvet-morph-background.js -- procedural velvet cloth with FBM noise shader
// replaces the static velvet PNG when GPU is available

import * as THREE from 'three';

const BACKGROUND_DISTANCE = 17;
const BACKGROUND_OVERSCAN = 1.16;
const ENTRY_START = 0.688;
const ENTRY_END = 0.818;
const SPLIT_START = 0.886;
const SPLIT_END = 0.952;
const FINAL_HIDE_START = 0.938;
const FINAL_HIDE_END = 0.946;
const PLANE_SEGMENTS_X = 72;
const PLANE_SEGMENTS_Y = 44;

let cameraRef = null;
let rendererRef = null;
let velvetTexture = null;
let velvetMesh = null;
let velvetMaterial = null;
let ready = false;
let viewportWidth = 0;
let viewportHeight = 0;
let layoutWidth = 1;
let layoutHeight = 1;
const mouseUvCurrent = new THREE.Vector2(0.5, 0.5);
const mouseUvTarget = new THREE.Vector2(0.5, 0.5);
const mouseUvPrevious = new THREE.Vector2(0.5, 0.5);
let mouseEnergy = 0;

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothRange(value, min, max) {
  return THREE.MathUtils.smoothstep(value, min, max);
}

function buildMaterial(texture) {
  const shaderHelpers = `
    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.45);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 5; i++) {
        value += noise(p) * amplitude;
        p = p * 2.02 + vec2(11.4, 7.9);
        amplitude *= 0.5;
      }
      return value;
    }
  `;

  const vertexShader = `
    uniform float uTime;
    uniform float uAssemble;
    uniform float uSplit;
    uniform vec2 uMouse;
    uniform float uMouseVelocity;

    varying vec2 vUv;
    varying float vFoldLight;
    varying float vCursorWave;

    ${shaderHelpers}

    void main() {
      vUv = uv;

      vec3 transformed = position;
      float entryEnergy = 1.0 - uAssemble;
      float splitForce = uSplit * uSplit;

      float clothNoise = fbm(uv * 3.8 + vec2(uTime * 0.045, -uTime * 0.038));
      float foldA = sin(uv.y * 8.5 - uTime * 0.72 + clothNoise * 2.2);
      float foldB = cos(uv.x * 6.1 + uTime * 0.56 - clothNoise * 1.6);
      float foldC = sin((uv.x + uv.y) * 5.2 - uTime * 0.35 + clothNoise * 2.7);
      float seam = 1.0 - smoothstep(0.0, 0.38, abs(uv.y - 0.5) * 2.0);
      float cursorDistance = distance(uv, uMouse);
      float cursorInfluence = exp(-cursorDistance * 8.5);
      float cursorRipple = sin(cursorDistance * 34.0 - uTime * 4.2) * cursorInfluence * (0.08 + uMouseVelocity * 0.22);
      vec2 cursorPush = (uv - uMouse) / max(cursorDistance, 0.0001);
      cursorPush *= cursorInfluence;

      transformed.z += (foldA * 0.12 + foldB * 0.08 + foldC * 0.06) * (0.26 + entryEnergy * 0.42);
      transformed.x += cos(uv.y * 6.0 - uTime * 0.44 + clothNoise * 2.8) * 0.05 * (0.28 + entryEnergy * 0.5);
      transformed.y += sin(uv.x * 7.2 + uTime * 0.58 - clothNoise * 2.1) * 0.07 * (0.34 + entryEnergy * 0.54);
      transformed.z += cursorRipple * (0.8 + uAssemble * 0.26);
      transformed.x += cursorPush.x * (0.04 + uMouseVelocity * 0.12);
      transformed.y += cursorPush.y * (0.03 + uMouseVelocity * 0.1);

      transformed.y += sign(uv.y - 0.5) * splitForce * (0.95 + seam * 0.36);
      transformed.x += (uv.y - 0.5) * splitForce * 0.26 * (0.6 + foldB * 0.4);
      transformed.z += seam * splitForce * (0.22 + clothNoise * 0.18);

      vFoldLight = clothNoise * 0.6 + foldA * 0.22 + foldB * 0.18;
      vCursorWave = cursorInfluence * (0.4 + uMouseVelocity * 0.8);

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uAssemble;
    uniform float uSplit;
    uniform vec2 uMouse;
    uniform float uMouseVelocity;

    varying vec2 vUv;
    varying float vFoldLight;
    varying float vCursorWave;

    ${shaderHelpers}

    float revealField(vec2 uv) {
      vec2 flowUv = uv;
      flowUv += vec2(
        sin(uv.y * 4.6 + uTime * 0.22) * 0.018,
        cos(uv.x * 3.8 - uTime * 0.18) * 0.015
      );

      float d1 = distance(flowUv, vec2(-0.18, 0.24)) * 0.82;
      float d2 = distance(flowUv, vec2(1.14, 0.18)) * 0.86;
      float d3 = distance(flowUv, vec2(0.18, 1.12)) * 0.78;
      float d4 = distance(flowUv, vec2(0.92, -0.14)) * 0.88;
      float d5 = distance(flowUv, vec2(1.08, 0.82)) * 0.92;

      float field = min(min(d1, d2), min(min(d3, d4), d5));
      float organic = fbm(flowUv * 4.8 + vec2(1.6, -2.4));
      float threads = sin(flowUv.x * 11.0 + organic * 4.2) * cos(flowUv.y * 8.4 - organic * 3.1) * 0.028;

      field += (organic - 0.5) * 0.2 + threads;
      return clamp(field, 0.0, 1.25);
    }

    void main() {
      vec4 texel = texture2D(uTexture, vUv);
      float field = revealField(vUv);

      float reveal = smoothstep(field - 0.15, field + 0.028, uAssemble);
      float bodyJoin = smoothstep(0.72, 0.97, uAssemble);
      reveal = max(reveal, bodyJoin * (1.0 - smoothstep(0.24, 0.96, field)));

      float edgeNoise = fbm(vUv * 7.2 + vec2(uTime * 0.06, -uTime * 0.05));
      float edgePulse = sin((vUv.x + vUv.y) * 10.0 - uTime * 0.7) * 0.02;
      reveal = clamp(reveal + (edgeNoise - 0.5) * 0.1 + edgePulse, 0.0, 1.0);

      float splitFade = 1.0 - uSplit * 0.9;
      float alpha = texel.a * reveal * uOpacity * splitFade;
      if (alpha < 0.002) discard;

      float grain = fbm(vUv * 8.4 + vec2(3.2, -1.1));
      float cursorGlow = exp(-distance(vUv, uMouse) * 7.5) * (0.08 + uMouseVelocity * 0.22);
      float foldShade = 1.05 + vFoldLight * 0.08 + (grain - 0.5) * 0.06 + vCursorWave * 0.05;
      vec3 liftedColor = mix(texel.rgb, pow(max(texel.rgb, vec3(0.0)), vec3(0.62)) * 1.75, 0.88);
      vec3 color = liftedColor * (1.48 + uAssemble * 0.16) * foldShade + vec3(0.09, 0.016, 0.018);
      color += vec3(0.14, 0.02, 0.024) * cursorGlow;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uAssemble: { value: 0 },
      uSplit: { value: 0 },
      uMouse: { value: mouseUvCurrent.clone() },
      uMouseVelocity: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });

  material.toneMapped = false;
  return material;
}

function rebuildLayout(force = false) {
  if (!ready || !cameraRef || !velvetMesh) return;
  if (!force && viewportWidth === window.innerWidth && viewportHeight === window.innerHeight) return;

  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;

  const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(cameraRef.fov * 0.5)) * BACKGROUND_DISTANCE;
  const frustumWidth = frustumHeight * cameraRef.aspect;

  layoutWidth = frustumWidth * BACKGROUND_OVERSCAN;
  layoutHeight = frustumHeight * BACKGROUND_OVERSCAN;
  velvetMesh.scale.set(layoutWidth, layoutHeight, 1);
}

function loadTexture() {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      './assets/bg-velvet.png',
      (texture) => resolve(texture),
      undefined,
      reject
    );
  });
}

export async function initVelvetMorphBackground(scene, camera, renderer) {
  if (ready) return;

  cameraRef = camera;
  rendererRef = renderer;

  velvetTexture = await loadTexture();
  velvetTexture.colorSpace = THREE.SRGBColorSpace;
  velvetTexture.wrapS = THREE.ClampToEdgeWrapping;
  velvetTexture.wrapT = THREE.ClampToEdgeWrapping;
  velvetTexture.generateMipmaps = true;
  if (rendererRef?.capabilities) {
    velvetTexture.anisotropy = Math.min(8, rendererRef.capabilities.getMaxAnisotropy());
  }

  velvetMaterial = buildMaterial(velvetTexture);
  const geometry = new THREE.PlaneGeometry(1, 1, PLANE_SEGMENTS_X, PLANE_SEGMENTS_Y);
  velvetMesh = new THREE.Mesh(geometry, velvetMaterial);
  velvetMesh.visible = false;
  velvetMesh.position.set(0, 0, -BACKGROUND_DISTANCE);
  velvetMesh.renderOrder = -2;

  if (!camera.parent) {
    scene.add(camera);
  }
  camera.add(velvetMesh);

  ready = true;
  rebuildLayout(true);
}

export function isVelvetMorphReady() {
  return ready;
}

export function updateVelvetMorphBackground(progress, mouse) {
  if (!ready || !velvetMesh || !velvetMaterial) return;

  rebuildLayout();

  const assemble = smoothRange(progress, ENTRY_START, ENTRY_END);
  const split = smoothRange(progress, SPLIT_START, SPLIT_END);
  const finalHide = smoothRange(progress, FINAL_HIDE_START, FINAL_HIDE_END);
  const opacity = clamp01(assemble * (1 - split * 0.88) * (1 - finalHide));

  velvetMesh.visible = opacity > 0.002;
  if (!velvetMesh.visible) return;

  const mouseX = mouse ? mouse.x : 0;
  const mouseY = mouse ? mouse.y : 0;
  const time = performance.now() * 0.001;
  const entryLift = (1 - assemble) * 0.42;
  mouseUvTarget.set(mouseX * 0.5 + 0.5, mouseY * 0.5 + 0.5);
  mouseUvCurrent.lerp(mouseUvTarget, 0.16);
  const mouseDelta = mouseUvCurrent.distanceTo(mouseUvPrevious);
  mouseEnergy = THREE.MathUtils.lerp(mouseEnergy, mouseDelta * 14, 0.18);
  mouseUvPrevious.copy(mouseUvCurrent);

  velvetMaterial.uniforms.uTime.value = time;
  velvetMaterial.uniforms.uOpacity.value = opacity;
  velvetMaterial.uniforms.uAssemble.value = assemble;
  velvetMaterial.uniforms.uSplit.value = split;
  velvetMaterial.uniforms.uMouse.value.copy(mouseUvCurrent);
  velvetMaterial.uniforms.uMouseVelocity.value = mouseEnergy;

  velvetMesh.position.set(
    0,
    -entryLift * 0.16,
    -BACKGROUND_DISTANCE + entryLift
  );
  velvetMesh.rotation.z = 0;
  velvetMesh.rotation.x = 0;
}
