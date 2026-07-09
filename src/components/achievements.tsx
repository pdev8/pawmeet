import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useFocusEffect } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { Renderer } from 'expo-three';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PixelRatio, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as THREE from 'three';

import { Icon } from './icon';
import { Fonts } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import type { Achievement, BadgeTint } from '@/lib/achievements';

// Collar colors per tint — bright "ice-cream party" pastels, one per badge.
const TINTS: Record<BadgeTint, number> = {
  gold: 0xffc400, // vivid amber
  silver: 0x2f7bff, // bright blue
  bronze: 0xff7a1f, // bright orange
  teal: 0x00d6bd, // bright teal
  purple: 0x9a2dff, // vivid violet
  green: 0x35d21f, // bright green
  orange: 0xff5a3d, // bright coral
  crimson: 0xff1f5a, // bright pink-red
};
const LOCKED = 0xb2b7c0;

// Buckle hardware, assorted across collars.
type Material = 'silver' | 'gold' | 'bronze' | 'wood';
// Metalness kept moderate: with no environment map, metals near 1.0 render black.
const MATERIALS: Record<Material, { color: number; metalness: number; roughness: number }> = {
  silver: { color: 0xd2d7e0, metalness: 0.5, roughness: 0.3 },
  gold: { color: 0xf0cf5a, metalness: 0.55, roughness: 0.28 },
  bronze: { color: 0xd08a4a, metalness: 0.5, roughness: 0.38 },
  wood: { color: 0x9a6636, metalness: 0.0, roughness: 0.8 },
};
const HARDWARE: Record<string, Material> = {
  first: 'bronze',
  regular: 'silver',
  'pack-leader': 'gold',
  host: 'silver',
  'super-host': 'gold',
  ambassador: 'bronze',
  'pet-parent': 'wood',
  'full-house': 'wood',
};

type PatternKind = 'spots' | 'specks' | 'stripes';
const PATTERNS: Record<string, PatternKind> = {
  first: 'spots',
  regular: 'stripes',
  'pack-leader': 'specks',
  host: 'spots',
  'super-host': 'stripes',
  ambassador: 'specks',
  'pet-parent': 'stripes',
  'full-house': 'spots',
};

const COLS = 4;
const LABEL_H = 30; // reserved for the RN label under each collar
// Bump on any geometry/material change: it's part of the GLView key, so the canvas
// remounts and rebuilds the 3D scene on Fast Refresh (the scene is built once in
// onContextCreate and otherwise won't pick up edits without a full reload).
const SCENE_VERSION = 15;

// Per-collar spin state the render loop reads and gestures write.
interface Spin {
  angle: number; // radians about the vertical axis
  vel: number; // radians per frame
}

/** Deterministic PRNG seeded from the collar id (stable scatter across renders). */
function seededRandom(seed: string) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  s = s % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function hexRgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

/** Generate a flat pattern texture — the collar color with white stripes/dots drawn
 * as if viewed face-on — so it maps cleanly onto the ring face as a painted design
 * (visual, not physical geometry). */
function makePatternTexture(colorNum: number, kind: PatternKind | null, seed: string) {
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  const [br, bg, bb] = hexRgb(colorNum);
  const cx = N / 2;
  const cy = N / 2;
  const spots: { x: number; y: number; r: number }[] = [];
  if (kind === 'spots' || kind === 'specks') {
    const rand = seededRandom(seed);
    const n = kind === 'spots' ? 22 : 42;
    const ringR = N * 0.4; // mid-band radius in texture space
    const dr = kind === 'spots' ? N * 0.035 : N * 0.02;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rr = ringR + (rand() - 0.5) * N * 0.07;
      spots.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, r: dr * (0.7 + rand() * 0.6) });
    }
  }
  const stripeCount = 16;
  for (let y = 0; y < N; y++) {
    const grad = 1.28 - 0.55 * (y / N); // top-to-bottom shading → dynamic color
    for (let x = 0; x < N; x++) {
      let white = false;
      if (kind === 'stripes') {
        const f = ((Math.atan2(y - cy, x - cx) / (Math.PI * 2)) * stripeCount) % 1;
        white = (f < 0 ? f + 1 : f) < 0.4;
      } else if (kind) {
        for (let s = 0; s < spots.length; s++) {
          const dx = x - spots[s].x;
          const dy = y - spots[s].y;
          if (dx * dx + dy * dy < spots[s].r * spots[s].r) {
            white = true;
            break;
          }
        }
      }
      // fine nylon-webbing crosshatch: two high-frequency diagonal gratings
      const weave = 1 + 0.11 * (Math.sin((x + y) * 1.3) + Math.sin((x - y) * 1.3)) * 0.5;
      const f = grad * weave;
      const idx = (y * N + x) * 4;
      data[idx] = Math.min(255, (white ? 255 : br) * f);
      data[idx + 1] = Math.min(255, (white ? 255 : bg) * f);
      data[idx + 2] = Math.min(255, (white ? 255 : bb) * f);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** A flat annular ring shape (outer circle with a concentric hole) for extrusion. */
function ringShape(ro: number, ri: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.absarc(0, 0, ri, 0, Math.PI * 2, true);
  s.holes.push(h);
  return s;
}

/** Trace a centered rounded rectangle onto a Shape or Path. */
function roundedRectPath(ctx: THREE.Shape | THREE.Path, w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

/** Build one collar: a flat, wide strap (extruded ring) + surface pattern + a real
 * frame-and-pin buckle. Returned as a THREE.Group that spins about its vertical axis. */
function buildCollar(item: Achievement, unit: number) {
  const group = new THREE.Group();
  const collarR = unit * 0.6; // centerline radius
  const strapW = unit * 0.077; // radial strap width (20% thinner)
  const T = unit * 0.1175; // strap thickness/depth (halved)
  const bev = Math.min(strapW, T) * 0.22;
  const Ro = collarR + strapW / 2;
  const Ri = collarR - strapW / 2;
  const color = item.earned ? TINTS[item.tint] : LOCKED;

  // Strap: an extruded ring — thin band, deep cross-section, softly beveled edges.
  const strapGeo = new THREE.ExtrudeGeometry(ringShape(Ro, Ri), {
    depth: T,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 2,
    curveSegments: 64,
  });
  strapGeo.translate(0, 0, -T / 2);
  // The pattern is painted onto the strap as a texture — no extra objects. Planar
  // extrude UVs are world XY, so repeat/offset remap them into the texture's 0..1.
  const kind = item.earned ? PATTERNS[item.id] ?? 'spots' : null;
  const tex = makePatternTexture(color, kind, item.id);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1 / (2 * Ro), 1 / (2 * Ro));
  tex.offset.set(0.5, 0.5);
  const strap = new THREE.Mesh(
    strapGeo,
    // matte, fabric-like nylon (low metalness, fairly rough)
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.68, metalness: 0.05, emissive: color, emissiveIntensity: 0.1 }),
  );
  group.add(strap);

  // Buckle: a thin RECTANGULAR metal frame that wraps around the collar at the
  // bottom (matching the band's rectangular cross-section), with a pin.
  const mat = MATERIALS[HARDWARE[item.id] ?? 'silver'];
  const metal = new THREE.MeshStandardMaterial({ color: mat.color, metalness: mat.metalness, roughness: mat.roughness });
  const border = Math.min(strapW, T) * 0.2; // thinner frame border
  const holeW = T * 1.0; // hugs the band's depth (local X → world Z)
  const holeH = strapW * 1.12; // hugs the band's width (local Y → world Y radial), close to the collar
  const fw = holeW + 2 * border;
  const fh = holeH + 2 * border;
  const bt = strapW * 2.3; // buckle length along the strap / around the circle (2x wider)
  const fr = Math.min(fw, fh) * 0.28; // slightly rounded corners
  const frameShape = new THREE.Shape();
  roundedRectPath(frameShape, fw, fh, fr);
  const hole = new THREE.Path();
  roundedRectPath(hole, holeW, holeH, Math.max(0.4, fr - border));
  frameShape.holes.push(hole);
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: bt,
    bevelEnabled: true,
    bevelThickness: bt * 0.18,
    bevelSize: bt * 0.18,
    bevelSegments: 1,
    curveSegments: 8,
  });
  frameGeo.translate(0, 0, -bt / 2);
  const buckle = new THREE.Group();
  buckle.add(new THREE.Mesh(frameGeo, metal));
  // clip seam dividing the clasp 4:5 along its length (the release joint) — bold + dark
  const seamZ = -bt / 2 + (4 / 9) * bt;
  const seam = new THREE.Mesh(
    new THREE.BoxGeometry(fw * 1.1, fh * 1.1, Math.max(0.8, bt * 0.16)),
    new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.3, roughness: 0.6 }),
  );
  seam.position.set(0, 0, seamZ);
  buckle.add(seam);
  // side-release tabs to show it clips / unclips: pronounced nubs on the housing side
  const tabLen = Math.max(border * 4, fh * 0.55);
  const tabZ = seamZ + bt * 0.22;
  const tabGeo = new THREE.BoxGeometry(fw * 0.85, tabLen, bt * 0.36);
  const tabA = new THREE.Mesh(tabGeo, metal);
  tabA.position.set(0, fh / 2 + tabLen * 0.42, tabZ);
  buckle.add(tabA);
  const tabB = new THREE.Mesh(tabGeo, metal);
  tabB.position.set(0, -(fh / 2 + tabLen * 0.42), tabZ);
  buckle.add(tabB);
  // orient the frame so it wraps the band (its depth runs along the ring tangent)
  buckle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
  buckle.position.set(0, -collarR, 0);
  group.add(buckle);

  return group;
}

/** Grid of achievement collars rendered in a single 3D canvas. Icons + labels are
 * crisp RN overlays; drag spins the collar under your finger, tap gives one turn. */
export function AchievementsGrid({ items }: { items: Achievement[] }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);

  const rows = Math.ceil(items.length / COLS);
  const cellW = width > 0 ? width / COLS : 0;
  const collarH = cellW; // collar occupies the top square of each cell
  const rowH = collarH + LABEL_H;
  const height = rows * rowH;

  // Shared mutable state read by the render loop / written by gestures.
  const spins = useRef<Spin[]>(items.map(() => ({ angle: 0, vel: 0 }))).current;
  // Drives each overlay icon's rotateY so it flips in sync with its 3D collar.
  const iconAngles = useRef(items.map(() => new Animated.Value(0))).current;
  const tilt = useRef({ x: 0, y: 0 });
  const meshes = useRef<THREE.Group[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const layout = useRef({ cellW, rowH, collarH });
  layout.current = { cellW, rowH, collarH };

  useEffect(() => {
    Accelerometer.setUpdateInterval(50);
    const sub = Accelerometer.addListener(({ x, y }) => (tilt.current = { x, y }));
    return () => sub.remove();
  }, []);

  // Reset every collar to facing forward whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      spins.forEach((s) => {
        s.angle = 0;
        s.vel = 0;
      });
    }, [spins]),
  );

  // Sync each overlay icon's rotation to its collar's spin, every frame. This lives
  // in its own effect (not the GL loop) so it survives Fast Refresh.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      for (let i = 0; i < iconAngles.length; i++) iconAngles[i].setValue(spins[i].angle);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [iconAngles, spins]);

  const hitTest = (x: number, y: number) => {
    const { cellW: cw, rowH: rh } = layout.current;
    if (!cw) return null;
    const rowCount = Math.ceil(items.length / COLS);
    // clamp to the nearest collar so touches at/just past a row edge still map to
    // the end collar (returning null there is why the ends were hard to spin)
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / cw)));
    const row = Math.max(0, Math.min(rowCount - 1, Math.floor(y / rh)));
    const i = row * COLS + col;
    return i < items.length ? i : null;
  };

  const K = 0.011; // radians of spin per px of drag
  const prevTx = useRef(0);
  const lastIdx = useRef<number | null>(null);
  const gesture = Gesture.Race(
    Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-4, 4]) // small threshold so edge collars register; vertical → scroll
      .onStart((e) => {
        prevTx.current = e.translationX;
        lastIdx.current = hitTest(e.x, e.y);
      })
      .onUpdate((e) => {
        const delta = e.translationX - prevTx.current;
        prevTx.current = e.translationX;
        const spinVal = Math.max(-0.6, Math.min(0.6, delta * K)); // capped spin speed
        const cur = hitTest(e.x, e.y);
        const from = lastIdx.current;
        // On a fast swipe the finger skips over several collars between frames, so
        // spin every collar crossed since the last frame (incl. the one you started
        // on) — not just the one currently under the finger.
        if (cur != null && from != null && Math.floor(from / COLS) === Math.floor(cur / COLS)) {
          const lo = Math.min(from, cur);
          const hi = Math.max(from, cur);
          for (let i = lo; i <= hi; i++) spins[i].vel = spinVal;
        } else {
          const i = cur ?? from;
          if (i != null) spins[i].vel = spinVal;
        }
        if (cur != null) lastIdx.current = cur;
      })
      .onEnd((e) => {
        const i = lastIdx.current;
        if (i != null) spins[i].vel = (e.velocityX * K) / 60; // release fling
      })
      .onFinalize(() => {
        lastIdx.current = null;
      }),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => {
        const i = hitTest(e.x, e.y);
        if (i != null) spins[i].vel = 0.32; // one fixed-speed turn, then decays
      }),
  );

  // (Re)build all collar meshes into the live scene. Split out of onContextCreate
  // so an effect can re-run it — otherwise geometry edits only show on a full reload.
  const rebuild = () => {
    const scene = sceneRef.current;
    const { cellW: cw, collarH: ch, rowH: rh } = layout.current;
    if (!scene || !cw) return;
    meshes.current.forEach((m) => scene.remove(m));
    const unit = cw * 0.5;
    meshes.current = items.map((item, i) => {
      const g = buildCollar(item, unit);
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      g.position.set(col * cw + cw / 2, height - (row * rh + ch / 2), 0); // y-up
      scene.add(g);
      return g;
    });
  };

  // Rebuild on layout change or when SCENE_VERSION is bumped, so edits appear on
  // Fast Refresh (the GL context + render loop persist; only the meshes swap).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => rebuild(), [width, height, SCENE_VERSION]);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const dpr = PixelRatio.get();
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0); // transparent so it blends with the screen

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, gl.drawingBufferWidth / dpr, gl.drawingBufferHeight / dpr, 0, -1000, 1000);
    camera.position.z = 10;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    scene.add(new THREE.HemisphereLight(0xdfefff, 0x40454f, 0.6));
    const keyL = new THREE.DirectionalLight(0xffffff, 1.0);
    keyL.position.set(-0.4, 1, 1.2);
    scene.add(keyL);
    const rimL = new THREE.DirectionalLight(0xffffff, 0.6);
    rimL.position.set(0.6, -0.4, 0.8);
    scene.add(rimL);

    sceneRef.current = scene;
    rebuild();

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = tilt.current;
      meshes.current.forEach((g, i) => {
        const s = spins[i];
        s.angle += s.vel; // gestures set vel; every collar coasts with friction
        s.vel *= 0.95;
        if (Math.abs(s.vel) < 0.0008) s.vel = 0;
        g.rotation.y = s.angle;
        g.rotation.x = -t.y * 0.35; // tilt parallax from the device
        g.rotation.z = t.x * 0.08;
      });
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    loop();
    return () => cancelAnimationFrame(raf);
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <GLView key={`gl-${Math.round(width)}`} style={{ width, height }} onContextCreate={onContextCreate} />
        )}
        {/* crisp RN overlays: the achievement icon centered on each collar + its label */}
        {cellW > 0 &&
          items.map((item, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            return (
              <View
                key={item.id}
                pointerEvents="none"
                style={[styles.cell, { left: col * cellW, top: row * rowH, width: cellW }]}>
                <Animated.View
                  style={{
                    height: collarH,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [
                      { perspective: 300 },
                      {
                        rotateY: iconAngles[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '57.29578deg'], // radians → degrees
                        }),
                      },
                    ],
                  }}>
                  <Icon sf={item.earned ? item.sf : 'lock.fill'} size={22} color={item.earned ? '#fff' : '#6b7280'} />
                </Animated.View>
                <Text
                  style={[styles.label, { color: item.earned ? p.text : p.textSecondary }]}
                  numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            );
          })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', position: 'relative' },
  cell: { position: 'absolute', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '700', textAlign: 'center', paddingTop: 2, fontFamily: Fonts?.rounded },
});
