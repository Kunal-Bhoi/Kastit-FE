// The hero ring: a solitaire built procedurally in three.js (no model files).
// Units: the band's inner radius is 1.

import * as THREE from './vendor/three-0.185.1/three.module.min.js';
import { RoomEnvironment } from './vendor/three-0.185.1/RoomEnvironment.js';

const METALS = {
  yellow18: { color: 0xf2c46e, roughness: 0.14 },
  rose18: { color: 0xf0b49c, roughness: 0.15 },
  platinum: { color: 0xe2e0dc, roughness: 0.12 },
  gold22: { color: 0xf8bb45, roughness: 0.13 },
};

// Stone profiles as [radius, height] from the culet (bottom point) up to the table (top face).
const BRILLIANT = [[0.001, -0.86], [1, -0.03], [1, 0.03], [0.8, 0.17], [0.55, 0.3], [0.001, 0.3]];
const STEP = [[0.001, -0.72], [0.38, -0.56], [0.72, -0.3], [1, -0.03], [1, 0.03], [0.86, 0.13], [0.7, 0.21], [0.001, 0.21]];

const CUTS = {
  round: { profile: BRILLIANT, seg: 24, phi: 0, sx: 1, sz: 1, size: 1, prongs: 6 },
  oval: { profile: BRILLIANT, seg: 24, phi: 0, sx: 0.84, sz: 1.2, size: 1, prongs: 6 },
  princess: { profile: STEP, seg: 4, phi: Math.PI / 4, sx: 1, sz: 1, size: 1.16, prongs: 4 },
  emerald: { profile: STEP, seg: 8, phi: Math.PI / 8, sx: 0.84, sz: 1.22, size: 1.06, prongs: 4 },
};

const GEM_R = 0.41;          // stone radius
const GIRDLE_Y = 1.53;       // height of the stone's widest point

// Band cross-section: a rounded rectangle (superellipse) centred on rMid.
export const BAND = { rMid: 1.075, halfT: 0.075, halfW: 0.16, exp: 0.55 };
const BAND_TOP = BAND.rMid + BAND.halfT;   // outer radius of the band

export const CLAW_R = 0.028;  // claw wire radius
const RAIL_R = 0.022;         // gallery rail wire radius
const RAIL_Y = -0.2;          // rail height, relative to the girdle

// Height of the stone's top surface at a given fraction of its radius.
function crownHeightAt(profile, rad) {
  for (let i = profile.length - 1; i > 0; i--) {
    const [r1, y1] = profile[i], [r0, y0] = profile[i - 1];
    if (y1 > 0 && rad >= r1 && rad <= r0) return y1 + ((rad - r1) / (r0 - r1)) * (y0 - y1);
  }
  return 0;
}

/**
 * Where every claw runs, in head space (origin at the stone's girdle centre).
 * Each claw starts buried in the band, comes out through its top surface, passes
 * through the gallery rail, grips the stone's widest point and ends on the crown.
 * Pure maths, no rendering, so the attachment can be checked without a browser.
 */
export function headLayout(cutKey) {
  const cut = CUTS[cutKey];
  const r = GEM_R * cut.size;
  const railR = r * 0.74;               // claw distance from centre at rail height (before sx/sz)
  const step = (Math.PI * 2) / cut.prongs;
  const offset = cut.prongs === 4 ? cut.phi : step / 2;   // corners, or evenly round a round stone
  const tipRad = 0.9;
  const tipY = crownHeightAt(cut.profile, tipRad) * r + CLAW_R * 0.4;
  const shell = (rho, x) => Math.sqrt(rho * rho - x * x) - GIRDLE_Y;   // y on a band circle of radius rho

  const claws = [];
  for (let k = 0; k < cut.prongs; k++) {
    const a = offset + k * step;
    const sa = Math.sin(a), ca = Math.cos(a);
    const dx = sa * cut.sx, dz = ca * cut.sz;
    const xb = sa * 0.12, zb = ca * 0.08;   // footprint on the band, kept well inside its width
    const xe = sa * 0.15, ze = ca * 0.1;
    claws.push({
      angle: a,
      points: [
        [xb, shell(BAND.rMid, xb), zb],                 // anchored in the middle of the band's metal
        [xe, shell(BAND_TOP + 0.015, xe), ze],          // just out of the band's top surface
        [dx * railR, RAIL_Y, dz * railR],               // through the gallery rail
        [dx * r * 1.04, 0, dz * r * 1.04],              // against the stone's widest point
        [dx * r * tipRad, tipY, dz * r * tipRad],       // folded over onto the crown
      ],
    });
  }
  // The rail follows the stone's outline (round, oval, square, octagon) and passes
  // through every claw, which all sit on the outline's corners.
  const railPoints = [];
  const vert = (i) => {
    const a = cut.phi + (i / cut.seg) * Math.PI * 2;
    return [Math.sin(a) * cut.sx * railR, Math.cos(a) * cut.sz * railR];
  };
  const perEdge = cut.seg >= 16 ? 1 : 8;
  for (let i = 0; i < cut.seg; i++) {
    const [x0, z0] = vert(i), [x1, z1] = vert(i + 1);
    for (let j = 0; j < perEdge; j++) {
      const t = perEdge === 1 ? 0 : 0.06 + (0.88 * j) / (perEdge - 1);   // trims each corner slightly to round it
      railPoints.push([x0 + (x1 - x0) * t, RAIL_Y, z0 + (z1 - z0) * t]);
    }
  }

  return { r, cut, claws, rail: { points: railPoints, y: RAIL_Y }, tip: { rad: tipRad, y: tipY } };
}

export function initRing(canvas, initial, { reducedMotion = false, onReady, spin: startSpin = 0.6 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 2.1, 7.2);
  camera.lookAt(0, 0.28, 0);

  const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2b0, 1.4);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  // ── materials ──
  const metal = new THREE.MeshPhysicalMaterial({
    color: METALS[initial.metal].color,
    metalness: 1,
    roughness: METALS[initial.metal].roughness,
    clearcoat: 0.35,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.25,
    side: THREE.DoubleSide,
  });
  const targetColor = metal.color.clone();
  let targetRoughness = metal.roughness;

  const gemMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0,
    transmission: 1,
    thickness: 0.6,
    ior: 2.42,
    dispersion: 4,
    specularIntensity: 1,
    envMapIntensity: 2.6,
    flatShading: true,
  });

  const ring = new THREE.Group();
  scene.add(ring);

  // ── band: a comfort-fit cross-section swept round the finger ──
  const profile = [];
  const N = 64;
  const { rMid, halfT, halfW, exp } = BAND;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    profile.push(new THREE.Vector2(
      rMid + halfT * Math.sign(c) * Math.pow(Math.abs(c), exp),
      halfW * Math.sign(s) * Math.pow(Math.abs(s), exp),
    ));
  }
  const bandGeo = new THREE.LatheGeometry(profile, 160);
  bandGeo.rotateX(Math.PI / 2);
  ring.add(new THREE.Mesh(bandGeo, metal));

  // ── head: stone, claws and gallery rail; rebuilt when the cut changes ──
  const head = new THREE.Group();
  head.position.y = GIRDLE_Y;
  ring.add(head);

  // little glints that flash on the crown
  const glintTex = makeGlintTexture();
  const glints = Array.from({ length: 3 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glintTex, color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    s.userData = { t: Math.random() * 4, period: 2.6 + Math.random() * 2.4 };
    head.add(s);
    return s;
  });

  function buildHead(cutKey) {
    for (const child of [...head.children]) {
      if (child.isSprite) continue;
      head.remove(child);
      child.traverse?.((o) => o.geometry?.dispose());
    }
    const { r, cut, claws, rail: railSpec } = headLayout(cutKey);

    const pts = cut.profile.map(([x, y]) => new THREE.Vector2(x, y));
    const gemGeo = new THREE.LatheGeometry(pts, cut.seg, cut.phi);
    gemGeo.scale(r * cut.sx, r, r * cut.sz);
    head.add(new THREE.Mesh(gemGeo, gemMat));

    for (const claw of claws) {
      const curve = new THREE.CatmullRomCurve3(claw.points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
      head.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, CLAW_R, 12), metal));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(CLAW_R * 1.25, 16, 12), metal);
      tip.position.copy(curve.getPoint(1));
      head.add(tip);
    }

    const railCurve = new THREE.CatmullRomCurve3(railSpec.points.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
    head.add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 192, RAIL_R, 10, true), metal));

    glints.forEach((g, i) => {
      const a = i * 2.1 + 0.4;
      g.position.set(Math.sin(a) * r * 0.55 * cut.sx, r * 0.3, Math.cos(a) * r * 0.55 * cut.sz);
    });
  }
  buildHead(initial.cut);

  // ── interaction: drag to turn, otherwise a slow showroom spin ──
  let spin = startSpin, tilt = 0, velocity = 0, dragging = false, lastX = 0, lastY = 0, idleFor = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velocity = dx * 0.008;
    spin += velocity;
    tilt = THREE.MathUtils.clamp(tilt + dy * 0.004, -0.5, 0.5);
    idleFor = 0;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ── changes from the brief / controls ──
  let popT = 1, pendingCut = null, currentCut = initial.cut;
  window.addEventListener('kastit:ring', (e) => {
    const { metal: m, cut } = e.detail;
    targetColor.setHex(METALS[m].color);
    targetRoughness = METALS[m].roughness;
    if (cut !== currentCut) { pendingCut = cut; popT = 0; }
  });

  // ── sizing & visibility ──
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);

  // ── render loop ──
  const timer = new THREE.Timer();
  let readySent = false;

  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.05);
    if (!visible || document.hidden) return;

    if (!dragging) {
      idleFor += dt;
      velocity *= 0.94;
      spin += velocity + (reducedMotion ? 0 : dt * 0.35 * Math.min(1, idleFor / 1.5));
      tilt *= 0.97;
    }
    ring.rotation.y = spin;
    ring.rotation.x = tilt;
    ring.position.y = reducedMotion ? 0 : Math.sin(timer.getElapsed() * 0.9) * 0.05;

    metal.color.lerp(targetColor, 1 - Math.pow(0.002, dt));
    metal.roughness += (targetRoughness - metal.roughness) * (1 - Math.pow(0.002, dt));

    // the head shrinks away, swaps cut, and springs back
    if (popT < 1) {
      popT = Math.min(1, popT + dt * 2.4);
      if (pendingCut && popT >= 0.4) { buildHead(pendingCut); currentCut = pendingCut; pendingCut = null; }
      const s = popT < 0.4 ? 1 - easeIn(popT / 0.4) : easeOutBack((popT - 0.4) / 0.6);
      head.scale.setScalar(Math.max(0.001, s));
    }

    if (!reducedMotion) {
      glints.forEach((g) => {
        g.userData.t += dt;
        const p = (g.userData.t % g.userData.period) / g.userData.period;
        const flash = p < 0.12 ? Math.sin((p / 0.12) * Math.PI) : 0;
        g.material.opacity = flash;
        g.material.rotation = g.userData.t * 0.8;
        g.scale.setScalar(0.12 + flash * 0.16);
      });
    }

    renderer.render(scene, camera);
    if (!readySent) { readySent = true; onReady?.(); }
  });
}

function easeIn(t) { return t * t; }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function makeGlintTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;
  const core = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.15, 'rgba(255,250,235,0.7)');
  core.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[size, 3], [3, size]]) {
    const ray = g.createLinearGradient(mid - w / 2, mid - h / 2, mid + w / 2, mid + h / 2);
    ray.addColorStop(0, 'rgba(255,255,255,0)');
    ray.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    ray.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ray;
    g.fillRect(mid - w / 2, mid - h / 2, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
