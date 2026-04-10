// paper-tear.js -- paper tear transition effect for stage 1 reveal

import * as THREE from 'three';

const state = {
  mesh: null,
  material: null,
  planeZ: -2.8,
  zoomScale: 1.06,
};

function viewportAtDepth(camera, worldZ) {
  const distance = Math.abs(camera.position.z - worldZ);
  const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  return {
    width: height * camera.aspect,
    height,
  };
}

function createFiberTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#6a6966';
  ctx.fillRect(0, 0, size, size);

  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const grain = 124 + (Math.random() - 0.5) * 62;
      const cloud = Math.sin(x * 0.055) * 6 + Math.cos(y * 0.038) * 6;
      const value = THREE.MathUtils.clamp(grain + cloud, 42, 214);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  for (let i = 0; i < 560; i += 1) {
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    const len = 18 + Math.random() * 62;
    const angle = Math.random() * Math.PI * 2;
    ctx.lineWidth = 0.35 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + Math.cos(angle) * len, startY + Math.sin(angle) * len);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 220; i += 1) {
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    const len = 24 + Math.random() * 48;
    const angle = (Math.random() - 0.5) * 0.8;
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(
      startX + Math.cos(angle) * len * 0.4,
      startY + Math.sin(angle) * len * 1.2,
      startX + Math.cos(angle) * len,
      startY + Math.sin(angle) * len * 0.55
    );
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createReliefTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const broad = Math.sin(x * 0.014 + y * 0.009) * 26;
      const medium = Math.sin(x * 0.048 - y * 0.036) * 15;
      const fine = Math.sin(x * 0.14 + y * 0.12) * 5;
      const noise = (Math.random() - 0.5) * 18;
      const value = THREE.MathUtils.clamp(128 + broad + medium + fine + noise, 0, 255);

      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 120; i += 1) {
    const y = Math.random() * size;
    const amp = 8 + Math.random() * 15;
    const phase = Math.random() * Math.PI * 2;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const yy = y + Math.sin(x * 0.015 + phase) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMonochromePaintingTexture(image) {
  const width = Math.min(1024, image.naturalWidth || image.width);
  const height = Math.max(2, Math.round(width * ((image.naturalHeight || image.height) / (image.naturalWidth || image.width))));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);

  const source = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const lumaData = new Float32Array(width * height);

  for (let i = 0; i < lumaData.length; i += 1) {
    const offset = i * 4;
    lumaData[i] = source.data[offset] * 0.299 + source.data[offset + 1] * 0.587 + source.data[offset + 2] * 0.114;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const left = lumaData[y * width + Math.max(0, x - 1)];
      const right = lumaData[y * width + Math.min(width - 1, x + 1)];
      const up = lumaData[Math.max(0, y - 1) * width + x];
      const down = lumaData[Math.min(height - 1, y + 1) * width + x];
      const luma = lumaData[idx];
      const edge = Math.min(1, (Math.abs(luma - right) + Math.abs(luma - down) + Math.abs(luma - left) + Math.abs(luma - up)) / 180);
      const emboss = THREE.MathUtils.clamp(128 + (luma - left) * 0.9 + (luma - up) * 0.9, 0, 255);
      const brush = Math.sin(x * 0.018 + y * 0.009) * 7 + Math.cos(y * 0.028 - x * 0.01) * 5;
      const grain = (Math.random() - 0.5) * 22;
      const value = THREE.MathUtils.clamp(
        luma * 0.62 + emboss * 0.18 + edge * 95 + brush + grain,
        0,
        255
      );
      const out = idx * 4;
      output.data[out] = value;
      output.data[out + 1] = value;
      output.data[out + 2] = value;
      output.data[out + 3] = 255;
    }
  }

  ctx.putImageData(output, 0, 0);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 120; i += 1) {
    const startX = Math.random() * width;
    const startY = Math.random() * height;
    const len = 20 + Math.random() * 70;
    const angle = Math.random() * Math.PI * 2;
    ctx.lineWidth = 0.4 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + Math.cos(angle) * len, startY + Math.sin(angle) * len);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 90; i += 1) {
    const startX = Math.random() * width;
    const startY = Math.random() * height;
    const len = 26 + Math.random() * 80;
    const angle = (Math.random() - 0.5) * 0.6;
    ctx.lineWidth = 0.8 + Math.random() * 1.1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(
      startX + Math.cos(angle) * len * 0.45,
      startY + Math.sin(angle) * len * 1.1,
      startX + Math.cos(angle) * len,
      startY + Math.sin(angle) * len * 0.55
    );
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createPaintingDepthTexture(image) {
  const width = Math.min(1024, image.naturalWidth || image.width);
  const height = Math.max(2, Math.round(width * ((image.naturalHeight || image.height) / (image.naturalWidth || image.width))));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);

  const source = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const lumaData = new Float32Array(width * height);

  for (let i = 0; i < lumaData.length; i += 1) {
    const offset = i * 4;
    lumaData[i] = source.data[offset] * 0.299 + source.data[offset + 1] * 0.587 + source.data[offset + 2] * 0.114;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const left = lumaData[y * width + Math.max(0, x - 1)];
      const right = lumaData[y * width + Math.min(width - 1, x + 1)];
      const up = lumaData[Math.max(0, y - 1) * width + x];
      const down = lumaData[Math.min(height - 1, y + 1) * width + x];
      const center = lumaData[idx];
      const blur = (center * 4 + left + right + up + down) / 8;
      const emboss = THREE.MathUtils.clamp(128 + (center - left) * 1.1 + (center - up) * 0.9, 0, 255);
      const edge = Math.min(1, (Math.abs(center - right) + Math.abs(center - down)) / 132);
      const canvasNoise = Math.sin(x * 0.022 + y * 0.016) * 10 + Math.cos(y * 0.028 - x * 0.014) * 8;
      const grain = (Math.random() - 0.5) * 18;
      const value = THREE.MathUtils.clamp(
        blur * 0.7 + emboss * 0.16 + edge * 96 + canvasNoise + grain,
        0,
        255
      );

      const out = idx * 4;
      output.data[out] = value;
      output.data[out + 1] = value;
      output.data[out + 2] = value;
      output.data[out + 3] = 255;
    }
  }

  ctx.putImageData(output, 0, 0);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 100; i += 1) {
    const startX = Math.random() * width;
    const startY = Math.random() * height;
    const len = 24 + Math.random() * 84;
    const angle = Math.random() * Math.PI * 2;
    ctx.lineWidth = 0.45 + Math.random() * 0.9;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + Math.cos(angle) * len, startY + Math.sin(angle) * len);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createTransitionMaterial(paintingTexture, paintingMonoTexture, paintingDepthTexture, fiberTexture, reliefTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPainting: { value: paintingTexture },
      uPaintingMono: { value: paintingMonoTexture },
      uPaintingDepth: { value: paintingDepthTexture },
      uFiber: { value: fiberTexture },
      uRelief: { value: reliefTexture },
      uProgress: { value: 0 },
      uAlpha: { value: 1 },
      uCenter: { value: new THREE.Vector2(0.688, 0.48) },
      uTexel: { value: new THREE.Vector2(1 / paintingTexture.image.width, 1 / paintingTexture.image.height) },
      uAspect: { value: 1 },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    },
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      uniform float uProgress;
      uniform vec2 uCenter;
      uniform float uAspect;

      varying vec2 vUv;
      varying float vFrontier;
      varying float vBand;
      varying float vInner;
      varying float vFiber;
      varying float vShell;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amplitude;
          p *= 2.04;
          amplitude *= 0.52;
        }
        return value;
      }

      float maskRange(float x, float start, float end, float feather) {
        float outer = 1.0 - smoothstep(start, start + feather, x);
        float inner = 1.0 - smoothstep(end, end + feather, x);
        return clamp(outer - inner, 0.0, 1.0);
      }

      void main() {
        vUv = uv;

        vec3 transformed = position;
        vec2 centered = uv - uCenter;
        centered.x *= uAspect;
        float radial = length(centered);
        float angle = atan(centered.y, centered.x);

        float progress = smoothstep(0.0, 1.0, uProgress);
        float n1 = fbm(uv * 5.8 + vec2(2.7, 1.9));
        float n2 = fbm(vec2(angle * 0.92 + 2.4, radial * 5.8 + 1.2));
        float revealRadius = mix(0.01, 1.08, progress);
        float radiusNoise = (n1 - 0.5) * 0.05 * (1.0 - progress * 0.25) + (n2 - 0.5) * 0.035;

        vFrontier = radial - (revealRadius + radiusNoise);
        vBand = exp(-abs(vFrontier) * 16.5);
        vInner = smoothstep(0.08, -0.16, vFrontier);
        vFiber = n1;

        vec2 dir = normalize(centered + vec2(0.0001));
        float peel = vBand * smoothstep(0.08, 0.95, progress) * (0.52 + n1 * 0.42);
        float ridge = smoothstep(0.12, 0.94, vBand) * (0.42 + n2 * 0.38);
        float strata = smoothstep(0.66, 0.96, sin(vFrontier * 96.0 + n1 * 6.2) * 0.5 + 0.5)
          * smoothstep(0.28, -0.02, vFrontier);
        float shellOuter = maskRange(vFrontier, 0.2, 0.125, 0.022) * peel;
        float shellMid = maskRange(vFrontier, 0.125, 0.045, 0.02) * peel;
        float shellInner = maskRange(vFrontier, 0.06, -0.025, 0.018) * peel;
        vShell = shellOuter * 0.95 + shellMid * 0.72 + shellInner * 0.48;
        transformed.xy += dir * vBand * 0.042 * peel;
        transformed.xy += dir * ridge * 0.008 * peel;
        transformed.xy += dir * shellOuter * 0.012;
        transformed.xy += dir * shellMid * 0.007;
        transformed.xy += dir * shellInner * 0.0035;
        transformed.z += vBand * 0.125 * peel;
        transformed.z += ridge * 0.04 * peel;
        transformed.z += strata * 0.026 * peel;
        transformed.z += shellOuter * (0.132 + n1 * 0.018);
        transformed.z += shellMid * (0.076 + n2 * 0.012);
        transformed.z += shellInner * (0.042 + n1 * 0.01);
        transformed.z += vInner * 0.012 * sin((uv.x + uv.y) * 8.0) * (1.0 - progress * 0.78);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uPainting;
      uniform sampler2D uPaintingMono;
      uniform sampler2D uPaintingDepth;
      uniform sampler2D uFiber;
      uniform sampler2D uRelief;
      uniform float uProgress;
      uniform float uAlpha;
      uniform vec2 uCenter;
      uniform vec2 uTexel;
      uniform float uAspect;
      uniform float uTime;
      uniform vec2 uMouse;

      varying vec2 vUv;
      varying float vFrontier;
      varying float vBand;
      varying float vInner;
      varying float vFiber;
      varying float vShell;

      float luminance(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }

      vec3 samplePainting(vec2 uv) {
        return texture2D(uPainting, uv).rgb;
      }

      vec3 samplePaintingMono(vec2 uv) {
        return texture2D(uPaintingMono, uv).rgb;
      }

      float samplePaintingDepth(vec2 uv) {
        return texture2D(uPaintingDepth, uv).r;
      }

      float edgeDetect(vec2 uv) {
        vec3 c = samplePainting(uv);
        vec3 cx = samplePainting(uv + vec2(uTexel.x * 2.0, 0.0));
        vec3 cy = samplePainting(uv + vec2(0.0, uTexel.y * 2.0));
        vec3 cdx = samplePainting(uv - vec2(uTexel.x * 2.0, 0.0));
        vec3 cdy = samplePainting(uv - vec2(0.0, uTexel.y * 2.0));
        return clamp(length(c - cx) + length(c - cy) + length(c - cdx) + length(c - cdy), 0.0, 1.0);
      }

      float maskRange(float x, float start, float end, float feather) {
        float outer = 1.0 - smoothstep(start, start + feather, x);
        float inner = 1.0 - smoothstep(end, end + feather, x);
        return clamp(outer - inner, 0.0, 1.0);
      }

      void main() {
        float progress = smoothstep(0.0, 1.0, uProgress);
        vec2 centered = vUv - uCenter;
        centered.x *= uAspect;
        vec2 dir = normalize(centered + vec2(0.0001));
        float finalResolve = smoothstep(0.7, 0.88, progress);

        vec2 fiberWarp = (texture2D(uFiber, vUv * 2.35 + vec2(uTime * 0.002, -uTime * 0.003)).rg - 0.5);
        float relief = texture2D(uRelief, vUv * 2.0 + vec2(-uTime * 0.001, uTime * 0.0008)).r;
        float reliefFine = texture2D(uRelief, vUv * 5.2 + vec2(uTime * 0.0018, -uTime * 0.0014)).r;
        float colorResolve = smoothstep(0.8, 0.95, progress) * smoothstep(0.12, 0.985, vInner);
        vec2 paintUv = vUv + fiberWarp * 0.01 * (1.0 - colorResolve) * smoothstep(0.06, 1.0, vInner);
        paintUv += uMouse * 0.0025 * (1.0 - progress) * smoothstep(0.1, 1.0, vInner);

        float depthBase = samplePaintingDepth(paintUv);
        vec2 depthFlow = dir * (depthBase - 0.5) * 0.028 * (1.0 - colorResolve);
        paintUv += depthFlow;

        vec3 painting = samplePainting(paintUv);
        vec3 originalPainting = samplePainting(vUv);
        vec3 monoPainting = samplePaintingMono(paintUv + fiberWarp * 0.006);
        float paintDepth = samplePaintingDepth(paintUv);
        float paintDepthDx = samplePaintingDepth(paintUv + vec2(uTexel.x * 2.0, 0.0));
        float paintDepthDy = samplePaintingDepth(paintUv + vec2(0.0, uTexel.y * 2.0));
        float luma = luminance(painting);
        float edge = edgeDetect(vUv);
        float fiber = texture2D(uFiber, vUv * 4.2 + vec2(-uTime * 0.014, uTime * 0.01)).r;
        float reliefDx = texture2D(uRelief, vUv * 2.1 + vec2(uTexel.x * 3.0, 0.0)).r;
        float reliefDy = texture2D(uRelief, vUv * 2.1 + vec2(0.0, uTexel.y * 3.0)).r;
        vec3 paperNormal = normalize(vec3((relief - reliefDx) * 2.8, (relief - reliefDy) * 2.8, 1.0));
        vec3 paintNormal = normalize(vec3((paintDepth - paintDepthDx) * 7.2, (paintDepth - paintDepthDy) * 7.2, 1.0));
        vec3 lightDir = normalize(vec3(-0.42, 0.58, 0.7));
        vec3 shadowDir = normalize(vec3(0.45, -0.22, 0.62));
        float reliefLight = clamp(dot(paperNormal, lightDir), 0.0, 1.0);
        float reliefShadow = clamp(dot(paperNormal, shadowDir), 0.0, 1.0);
        float paintLight = clamp(dot(paintNormal, lightDir), 0.0, 1.0);
        float paintShadow = clamp(dot(paintNormal, shadowDir), 0.0, 1.0);
        float strataLines = smoothstep(0.74, 0.96, sin(vFrontier * 128.0 + relief * 8.0 + reliefFine * 10.0) * 0.5 + 0.5);

        vec3 etchedBase = monoPainting * 0.92;
        vec3 contour = mix(vec3(0.18), vec3(0.92), smoothstep(0.12, 0.9, edge * 0.8 + reliefFine * 0.2));
        vec3 intermediate = mix(etchedBase, contour, smoothstep(0.24, 0.9, edge * 0.82 + relief * 0.1) * 0.32);
        intermediate += vec3((paintDepth - 0.5) * 0.08);
        intermediate += vec3(edge * 0.045 + paintLight * 0.025 + reliefLight * 0.03);
        intermediate -= vec3(paintShadow * 0.014 + reliefShadow * 0.014);
        intermediate *= mix(vec3(0.97), vec3(1.02), fiber * 0.06 + relief * 0.05);
        intermediate *= mix(0.97, 1.0, smoothstep(0.12, 0.75, vInner));

        vec3 interior = mix(intermediate, painting, colorResolve);

        float edgeMask = smoothstep(0.14, 0.98, vBand) * (1.0 - smoothstep(-0.18, -0.52, vFrontier));
        float highlight = edgeMask * clamp(dot(dir, normalize(vec2(-0.55, 0.84))) * 0.5 + 0.5, 0.0, 1.0);
        float shadow = edgeMask * clamp(dot(dir, normalize(vec2(0.58, -0.8))) * 0.5 + 0.5, 0.0, 1.0);
        float edgeGlow = edgeMask * smoothstep(0.08, -0.015, vFrontier);
        float paperCrust = edgeMask * (0.42 + relief * 0.28 + reliefFine * 0.2);
        float layerStrata = edgeMask * strataLines * (1.0 - smoothstep(-0.12, -0.32, vFrontier));
        float shellOuter = maskRange(vFrontier, 0.23, 0.13, 0.026);
        float shellMid = maskRange(vFrontier, 0.145, 0.04, 0.022);
        float shellInner = maskRange(vFrontier, 0.07, -0.03, 0.02);
        float shellVein = maskRange(vFrontier, 0.095, 0.0, 0.016);
        float frayNoise = texture2D(uFiber, vUv * 9.8 + vec2(uTime * 0.004, -uTime * 0.003)).r;
        float cutNoise = texture2D(uRelief, vUv * 7.6 + vec2(-uTime * 0.003, uTime * 0.002)).r;
        float shellFray = smoothstep(0.28, 0.94, frayNoise * 0.65 + cutNoise * 0.35);
        float shellMicro = smoothstep(0.62, 0.96, sin(vFrontier * 220.0 + frayNoise * 18.0 + cutNoise * 13.0) * 0.5 + 0.5);
        float shellStutter = smoothstep(0.48, 0.96, sin(vFrontier * 310.0 + frayNoise * 24.0 + cutNoise * 21.0) * 0.5 + 0.5);
        shellOuter *= mix(0.24, 0.42, shellFray);
        shellMid *= mix(0.18, 0.32, shellFray);
        shellInner *= mix(0.12, 0.22, shellFray);
        shellVein *= mix(0.08, 0.16, shellFray) * mix(0.85, 1.02, shellStutter);
        float shellMask = clamp(shellOuter + shellMid + shellInner + shellVein, 0.0, 1.0);

        vec3 frontierTexture = monoPainting * 0.96;
        frontierTexture += vec3(edge * 0.035 + reliefLight * 0.018);
        frontierTexture *= mix(vec3(0.98), vec3(1.02), relief * 0.1 + fiber * 0.06);
        frontierTexture *= mix(0.98, 1.03, shellFray);
        frontierTexture = mix(frontierTexture, originalPainting, finalResolve);

        vec3 frontSurface = mix(vec3(0.09), vec3(0.18), fiber * 0.22 + relief * 0.2 + paintDepth * 0.22);
        frontSurface = mix(frontSurface, frontierTexture * 0.52, smoothstep(0.34, -0.02, vFrontier));
        frontSurface += vec3(0.024) * reliefLight * 0.2;
        frontSurface += vec3(0.022) * paintLight * 0.18;
        frontSurface -= vec3(0.01) * reliefShadow * 0.12;
        frontSurface -= vec3(0.012) * paintShadow * 0.12;
        frontSurface = mix(frontSurface, originalPainting, finalResolve);

        vec3 edgeColor = mix(vec3(0.34), vec3(0.76), paperCrust);
        edgeColor = mix(edgeColor, frontierTexture * 0.88, 0.42);
        edgeColor += vec3(0.04) * reliefLight * 0.24;
        edgeColor += vec3(0.03) * paintLight * 0.18;
        edgeColor -= vec3(0.016) * reliefShadow * 0.14;
        edgeColor -= vec3(0.014) * paintShadow * 0.12;
        edgeColor += vec3(0.022) * layerStrata * 0.22;
        edgeColor += vec3(0.016) * edgeGlow * 0.04;
        edgeColor += vec3(0.012) * shellMicro * shellMask;
        edgeColor -= vec3(0.006) * (1.0 - shellFray) * shellMask;
        edgeColor = mix(edgeColor, originalPainting, finalResolve);

        vec3 shellTexOuter = mix(frontierTexture * 0.46, monoPainting * 0.18 + vec3(0.1), 0.35 + reliefFine * 0.18);
        vec3 shellTexMid = mix(frontierTexture * 0.62, monoPainting * 0.26 + vec3(0.14), 0.3 + relief * 0.22);
        vec3 shellTexInner = mix(frontierTexture * 0.8, monoPainting * 0.38 + vec3(0.19), 0.28 + paintDepth * 0.2);

        shellTexOuter += vec3(0.045) * (reliefLight * 0.8 + highlight * 0.3);
        shellTexMid += vec3(0.055) * (paintLight * 0.85 + highlight * 0.22);
        shellTexInner += vec3(0.04) * (paintLight * 0.65 + reliefLight * 0.22);

        shellTexOuter -= vec3(0.035) * (reliefShadow * 0.85 + shadow * 0.25);
        shellTexMid -= vec3(0.03) * (paintShadow * 0.72 + shadow * 0.2);
        shellTexInner -= vec3(0.024) * (paintShadow * 0.55 + shadow * 0.15);

        vec3 layeredShell = frontSurface;
        layeredShell = mix(layeredShell, shellTexOuter, shellOuter);
        layeredShell = mix(layeredShell, shellTexMid, shellMid);
        layeredShell = mix(layeredShell, shellTexInner, shellInner);
        layeredShell = mix(layeredShell, frontierTexture * 0.92 + vec3(0.07), shellVein * 0.5);
        layeredShell += vec3(0.03) * vShell * layerStrata;
        layeredShell -= vec3(0.02) * shellMask * smoothstep(0.22, -0.02, vFrontier);
        layeredShell += frontierTexture * shellMicro * shellMask * 0.08;
        layeredShell += vec3(0.028) * shellStutter * shellMask;
        layeredShell -= vec3(0.014) * (1.0 - shellFray) * shellMask;

        float inside = smoothstep(0.08, -0.04, vFrontier);
        float nearEdgeOuter = edgeMask * (1.0 - inside);
        vec3 color = mix(layeredShell, interior, inside);
        color = mix(color, edgeColor, edgeMask);
        color = mix(color, layeredShell, (1.0 - inside) * (1.0 - edgeMask) * smoothstep(0.22, 0.0, vFrontier));

        float outerMist = exp(-max(vFrontier, 0.0) * 11.5) * nearEdgeOuter * 0.012;
        color += frontierTexture * outerMist * 0.06;
        color = mix(color, originalPainting, finalResolve);

        gl_FragColor = vec4(color, uAlpha);
      }
    `,
  });
}

export function initPaperTear(scene, camera, paintingUrl) {
  if (state.mesh) return Promise.resolve(state);

  return new Promise((resolve, reject) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      paintingUrl,
      (paintingTexture) => {
        paintingTexture.colorSpace = THREE.SRGBColorSpace;
        paintingTexture.minFilter = THREE.LinearFilter;
        paintingTexture.magFilter = THREE.LinearFilter;

        const paintingMonoTexture = createMonochromePaintingTexture(paintingTexture.image);
        const paintingDepthTexture = createPaintingDepthTexture(paintingTexture.image);
        const fiberTexture = createFiberTexture();
        const reliefTexture = createReliefTexture();
        state.material = createTransitionMaterial(
          paintingTexture,
          paintingMonoTexture,
          paintingDepthTexture,
          fiberTexture,
          reliefTexture
        );
        state.mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1, 140, 140),
          state.material
        );
        state.mesh.position.set(0, 0, state.planeZ);
        state.mesh.visible = false;
        state.mesh.renderOrder = -50;
        scene.add(state.mesh);

        const viewport = viewportAtDepth(camera, state.planeZ);
        state.mesh.scale.set(viewport.width * state.zoomScale, viewport.height * state.zoomScale, 1);
        resolve(state);
      },
      undefined,
      reject
    );
  });
}

export function updatePaperTear(camera, progress, anchorPercent, mouse, alpha = 1) {
  if (!state.mesh || !state.material) return;

  const viewport = viewportAtDepth(camera, state.planeZ);
  const uniforms = state.material.uniforms;
  const t = THREE.MathUtils.clamp(progress, 0, 1);

  state.mesh.visible = alpha > 0.001 && t < 0.999;
  state.mesh.scale.set(viewport.width * state.zoomScale, viewport.height * state.zoomScale, 1);
  uniforms.uProgress.value = t;
  uniforms.uAlpha.value = THREE.MathUtils.clamp(alpha, 0, 1);
  uniforms.uCenter.value.set(anchorPercent.x / 100, 1 - anchorPercent.y / 100);
  uniforms.uAspect.value = camera.aspect;
  uniforms.uTime.value = performance.now() * 0.001;
  uniforms.uMouse.value.set(mouse ? mouse.x : 0, mouse ? mouse.y : 0);
}

export function hidePaperTear() {
  if (!state.mesh) return;
  state.mesh.visible = false;
}
