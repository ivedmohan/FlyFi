'use client';

import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Box, Sphere, Torus, Plane, Html, OrbitControls } from '@react-three/drei';
import { TextureLoader } from 'three';
import type { Group, Mesh } from 'three';

// Closer + lower than the original framing, with a wider FOV — pulls the fly toward
// the foreground (dominant, like the reference) while the wider angle still keeps the
// monitor and backdrop in frame. Target sits between the fly (z=KEYBOARD_Z≈0.45) and
// the monitor (z≈-0.35..0.3) rather than at the old target's z=0.05, so neither gets
// pushed to the frame edge.
const CAMERA_POSITION: [number, number, number] = [1.9, 0.85, 2.15];
const CONTROLS_TARGET: [number, number, number] = [0, 0.35, 0.15];
// Front-facing azimuth derived from the camera/target above (three.js spherical
// convention: theta = atan2(x, z)) — oscillate ±90° around it instead of a full
// spin, so the view never swings around to the empty back of the desk.
const FRONT_AZIMUTH = Math.atan2(
  CAMERA_POSITION[0] - CONTROLS_TARGET[0],
  CAMERA_POSITION[2] - CONTROLS_TARGET[2],
);
const ORBIT_RANGE = (90 * Math.PI) / 180;
const ORBIT_RADIUS = Math.hypot(
  CAMERA_POSITION[0] - CONTROLS_TARGET[0],
  CAMERA_POSITION[2] - CONTROLS_TARGET[2],
);

function SweepingCamera({ paused }: { paused: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useRef<any>(null);
  const dragging = useRef(false);
  // Accumulated total paused duration, subtracted from elapsed time — so resuming
  // continues the sweep from where it left off instead of jumping ahead by however
  // long the pause lasted.
  const pauseOffset = useRef(0);
  const pausedSince = useRef<number | null>(null);

  useFrame(({ camera, clock }) => {
    if (dragging.current || !controls.current) return;
    const now = clock.getElapsedTime();
    if (paused) {
      if (pausedSince.current === null) pausedSince.current = now;
      return; // leave the camera exactly where it is
    }
    if (pausedSince.current !== null) {
      pauseOffset.current += now - pausedSince.current;
      pausedSince.current = null;
    }
    const t = now - pauseOffset.current;
    const azimuth = FRONT_AZIMUTH + Math.sin(t * 0.3) * ORBIT_RANGE;
    camera.position.x = CONTROLS_TARGET[0] + ORBIT_RADIUS * Math.sin(azimuth);
    camera.position.z = CONTROLS_TARGET[2] + ORBIT_RADIUS * Math.cos(azimuth);
    camera.position.y = CAMERA_POSITION[1];
    controls.current.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enableZoom={false}
      enablePan={false}
      target={CONTROLS_TARGET}
      minAzimuthAngle={FRONT_AZIMUTH - ORBIT_RANGE}
      maxAzimuthAngle={FRONT_AZIMUTH + ORBIT_RANGE}
      onStart={() => {
        dragging.current = true;
      }}
      onEnd={() => {
        dragging.current = false;
      }}
    />
  );
}

export type TradeStatus = 'idle' | 'profit' | 'loss';

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

// Original procedural retro hacker-desk scene — plain primitives via drei's
// Box/Sphere/Plane helpers, no external model/asset. The fly is an original low-poly
// build (faceted low-segment spheres + plane wings), not modeled on any reference.
// No framer-motion-3d: its current release pins @react-three/fiber to an exact 8.2.2,
// which conflicts with the 9.x we need for React 19 — the jump/glow on `tradeStatus`
// is done with plain useFrame instead, same visual result.
//
// Vertical layout (world space, desk top = y 0): desk 0 to -0.12, stand foot 0 to
// 0.05, neck 0.05 to 0.3, monitor 0.3 to 1.3. Keyboard sits flush on the desk in
// front of the monitor (z 0.2 to 0.7); the fly stands on the keyboard facing the
// monitor (-Z), front legs tapping to suggest it's "typing".

const DESK_TOP_Y = 0;
const MONITOR_TOP_Y = 1.3;
const KEYBOARD_Z = 0.45;
const KEYBOARD_TOP_Y = DESK_TOP_Y + 0.06;

function MiniCandles({ candles }: { candles: Candle[] }) {
  if (candles.length === 0) return null;
  const w = 240;
  const h = 130;
  const max = Math.max(...candles.map((c) => c.h));
  const min = Math.min(...candles.map((c) => c.l));
  const range = max - min || 1;
  const slot = w / candles.length;
  const bw = Math.max(1, slot * 0.55);
  const y = (v: number) => (1 - (v - min) / range) * h;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {candles.map((c, i) => {
        const x = i * slot + slot / 2;
        const up = c.c >= c.o;
        const color = up ? '#22c55e' : '#ef4444';
        const top = y(Math.max(c.o, c.c));
        const bottom = y(Math.min(c.o, c.c));
        return (
          <g key={i}>
            <line x1={x} y1={y(c.h)} x2={x} y2={y(c.l)} stroke={color} strokeWidth="1" />
            <rect x={x - bw / 2} y={top} width={bw} height={Math.max(1, bottom - top)} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

const MONITOR_Z = -0.35;
const MONITOR_FRONT_Z = MONITOR_Z + 0.05; // front (screen) face of the 0.1-thick monitor box
const MONITOR_CENTER_Y = (MONITOR_TOP_Y + 0.3) / 2;

function Screen({ statusColor, candles, price }: { statusColor: string; candles: Candle[]; price: number }) {
  return (
    <group position={[0, MONITOR_CENTER_Y, MONITOR_FRONT_Z]}>
      <Plane args={[1.3, 0.85]}>
        <meshStandardMaterial color="#050505" emissive={statusColor} emissiveIntensity={0.35} roughness={0.4} />
      </Plane>
      <Html center transform distanceFactor={1.35} position={[0.1, 0, 0.01]} style={{ pointerEvents: 'none' }} occlude>
        <div
          style={{
            width: 260,
            height: 180,
            background: '#05070a',
            borderRadius: 4,
            padding: 8,
            fontFamily: 'monospace',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#06b6d4', fontSize: 9 }}>AVAX / USD</span>
            <span style={{ color: '#e5e7eb', fontSize: 9 }}>${price.toFixed(2)}</span>
          </div>
          <MiniCandles candles={candles} />
        </div>
      </Html>
      <pointLight position={[0, 0, 0.4]} color={statusColor} intensity={1.1} distance={2.2} />
    </group>
  );
}

// Original low-poly fly — faceted low-segment spheres, red eye spheres, two
// semi-transparent plane wings. Stands on the keyboard facing the monitor (-Z), front
// legs tapping in an alternating rhythm to suggest it's typing. `tradeStatus` drives
// an idle-vs-spring hop and a body glow via useFrame (framer-motion-3d substitute,
// see note above). Scaled up and given bigger/redder compound eyes and wider wings
// versus the original build, to read as the dominant foreground subject the way a
// close-up shot of a fly would, rather than a small prop on the desk.
const FLY_SCALE = 0.62;
const FLY_BASE_Y = KEYBOARD_TOP_Y + 0.15 * FLY_SCALE;

function LowPolyFly({ tradeStatus, paused }: { tradeStatus: TradeStatus; paused: boolean }) {
  const group = useRef<Group>(null);
  const wingL = useRef<Mesh>(null);
  const wingR = useRef<Mesh>(null);
  const legFrontL = useRef<Group>(null);
  const legFrontR = useRef<Group>(null);
  const jump = useRef(0);

  const glowColor = tradeStatus === 'profit' ? '#22c55e' : tradeStatus === 'loss' ? '#ef4444' : '#000000';
  const glowIntensity = tradeStatus === 'idle' ? 0 : 0.9;

  useFrame(({ clock }, delta) => {
    if (paused) return; // freeze wings/legs/bob exactly where they are
    const t = clock.getElapsedTime();
    const flap = Math.sin(t * 24) * 0.35;
    if (wingL.current) wingL.current.rotation.z = 0.4 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.4 - flap;

    // "typing": front legs tap up/down out of phase with each other
    const tap = Math.sin(t * 9) * 0.22;
    if (legFrontL.current) legFrontL.current.rotation.x = tap;
    if (legFrontR.current) legFrontR.current.rotation.x = -tap;

    const bob = Math.sin(t * 2) * 0.015;
    const targetJump = tradeStatus === 'profit' ? 0.12 : 0;
    jump.current += (targetJump - jump.current) * Math.min(1, delta * 8);
    if (group.current) group.current.position.y = FLY_BASE_Y + bob + jump.current;
  });

  return (
    <group ref={group} position={[0, FLY_BASE_Y, KEYBOARD_Z]} rotation={[0, Math.PI, 0]} scale={FLY_SCALE}>
      <Sphere args={[0.26, 8, 8]} position={[0, 0, -0.35]}>
        <meshStandardMaterial color="#1c1c22" emissive={glowColor} emissiveIntensity={glowIntensity} roughness={0.5} />
      </Sphere>
      <Sphere args={[0.22, 8, 8]} position={[0, 0, 0.05]}>
        <meshStandardMaterial color="#232329" emissive={glowColor} emissiveIntensity={glowIntensity} roughness={0.5} />
      </Sphere>
      <Sphere args={[0.16, 8, 8]} position={[0, 0.02, 0.32]}>
        <meshStandardMaterial color="#1c1c22" roughness={0.5} />
      </Sphere>
      <Sphere args={[0.14, 10, 10]} position={[0.13, 0.05, 0.43]}>
        <meshStandardMaterial color="#c0392b" emissive="#dc2626" emissiveIntensity={0.6} roughness={0.35} />
      </Sphere>
      <Sphere args={[0.14, 10, 10]} position={[-0.13, 0.05, 0.43]}>
        <meshStandardMaterial color="#c0392b" emissive="#dc2626" emissiveIntensity={0.6} roughness={0.35} />
      </Sphere>
      <Plane ref={wingL} args={[0.72, 0.3]} position={[0.2, 0.12, 0.02]} rotation={[0, 0, 0.35]}>
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.3} side={2} />
      </Plane>
      <Plane ref={wingR} args={[0.72, 0.3]} position={[-0.2, 0.12, 0.02]} rotation={[0, 0, -0.35]}>
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.3} side={2} />
      </Plane>

      {/* front legs — animated, "typing" on the keyboard */}
      <group ref={legFrontL} position={[0.2, -0.18, 0.15]}>
        <mesh rotation={[0, 0, -0.9]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
          <meshStandardMaterial color="#111114" />
        </mesh>
      </group>
      <group ref={legFrontR} position={[-0.2, -0.18, 0.15]}>
        <mesh rotation={[0, 0, 0.9]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
          <meshStandardMaterial color="#111114" />
        </mesh>
      </group>

      {/* middle + back legs — static */}
      {[-0.15, 0].map((z, i) => (
        <group key={i}>
          <mesh position={[0.2, -0.18, z]} rotation={[0, 0, -0.9]}>
            <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
            <meshStandardMaterial color="#111114" />
          </mesh>
          <mesh position={[-0.2, -0.18, z]} rotation={[0, 0, 0.9]}>
            <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
            <meshStandardMaterial color="#111114" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// A thin emissive box standing in for a neon strip light — cheaper and more reliable
// across GPUs than a real Line material at this scale, and consistent with how the
// fly's legs are already drawn (thin cylinders, not GL lines).
function NeonStrip({
  args, position, color = '#22d3ee', rotation,
}: {
  args: [number, number, number]; position: [number, number, number]; color?: string; rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} />
    </mesh>
  );
}

// Decorative twin-ring "speaker" prop, off to the side — an original nod to the kind
// of desk-clutter silhouette a reference cyberpunk-desk shot tends to have, not a
// model of any specific object.
function SpeakerProp() {
  return (
    <group position={[1.55, 0.32, -0.5]}>
      <Box args={[0.35, 0.64, 0.3]}>
        <meshStandardMaterial color="#15151c" roughness={0.8} />
      </Box>
      <Torus args={[0.1, 0.012, 8, 20]} position={[0, 0.14, 0.16]}>
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.2} toneMapped={false} />
      </Torus>
      <Torus args={[0.1, 0.012, 8, 20]} position={[0, -0.14, 0.16]}>
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.2} toneMapped={false} />
      </Torus>
    </group>
  );
}

// Procedural neon-city backdrop — a canyon of dark low-poly towers flanking the desk,
// receding away from camera, with a handful of bright vertical "light streak" accents
// scattered among them (evoking a rain-soaked skyline, not a literal building model).
// Seeded with a fixed small PRNG so it's deterministic across renders instead of
// reshuffling every mount.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOWER_COUNT = 22;
const TOWERS = (() => {
  const rand = mulberry32(1337);
  return Array.from({ length: TOWER_COUNT }, () => {
    const side = rand() < 0.5 ? -1 : 1;
    const x = side * (2.2 + rand() * 5);
    const z = -4 - rand() * 9;
    const height = 1.2 + rand() * 3.2;
    const width = 0.4 + rand() * 0.7;
    const hue = rand();
    const color = hue < 0.5 ? '#0d0d1a' : '#12101d';
    return { x, z, height, width, color };
  });
})();
const STREAK_COUNT = 14;
const STREAKS = (() => {
  const rand = mulberry32(4242);
  const palette = ['#22d3ee', '#a78bfa', '#f472b6'];
  return Array.from({ length: STREAK_COUNT }, () => {
    const side = rand() < 0.5 ? -1 : 1;
    return {
      x: side * (2 + rand() * 5.5),
      z: -3.5 - rand() * 9,
      y: 0.6 + rand() * 2.2,
      height: 0.4 + rand() * 1.1,
      color: palette[Math.floor(rand() * palette.length)],
    };
  });
})();

function CityBackdrop() {
  return (
    <group>
      {TOWERS.map((tw, i) => (
        <Box key={i} args={[tw.width, tw.height, tw.width]} position={[tw.x, tw.height / 2 - 0.2, tw.z]}>
          <meshStandardMaterial color={tw.color} roughness={0.85} />
        </Box>
      ))}
      {STREAKS.map((s, i) => (
        <NeonStrip key={i} args={[0.02, s.height, 0.02]} position={[s.x, s.y, s.z]} color={s.color} />
      ))}
      {/* a distant glowing horizon bar, echoing a skyline light strip */}
      <NeonStrip args={[9, 0.02, 0.02]} position={[0, 2.6, -8]} color="#a78bfa" />
    </group>
  );
}

// Official Avalanche logo (public/avalanche-logo.svg — downloaded unmodified from
// Wikimedia Commons, CC BY-SA 4.0, credited in README) as a small flat badge lying on
// the desk — FlyFi genuinely trades on Avalanche C-Chain via LFJ, so this identifies
// the real chain, not decorative branding for its own sake.
function AvaxBadge() {
  const texture = useLoader(TextureLoader, '/avalanche-logo.svg');
  return (
    <mesh position={[-0.95, DESK_TOP_Y + 0.002, 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.11, 32]} />
      <meshStandardMaterial map={texture} transparent roughness={0.4} />
    </mesh>
  );
}

function Desk({
  statusColor, tradeStatus, candles, price, paused,
}: { statusColor: string; tradeStatus: TradeStatus; candles: Candle[]; price: number; paused: boolean }) {
  return (
    <group>
      <CityBackdrop />

      {/* desk (top surface at y=0) */}
      <Box args={[2.6, 0.12, 1.6]} position={[0, DESK_TOP_Y - 0.06, 0]} receiveShadow>
        <meshStandardMaterial color="#2a2a35" roughness={0.9} />
      </Box>
      {/* neon accent along the desk's front edge, facing the fly/camera */}
      <NeonStrip args={[2.6, 0.012, 0.012]} position={[0, DESK_TOP_Y + 0.001, 0.8]} color="#22d3ee" />

      {/* monitor stand: foot 0 -> 0.05, neck 0.05 -> 0.3 */}
      <mesh position={[0, 0.025, MONITOR_Z]}>
        <cylinderGeometry args={[0.28, 0.3, 0.05, 16]} />
        <meshStandardMaterial color="#3a3a45" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.175, MONITOR_Z]}>
        <cylinderGeometry args={[0.07, 0.1, 0.25, 12]} />
        <meshStandardMaterial color="#3a3a45" roughness={0.7} />
      </mesh>

      {/* monitor body: 0.3 -> 1.3 */}
      <Box args={[1.5, 1.0, 0.1]} position={[0, MONITOR_CENTER_Y, MONITOR_Z]}>
        <meshStandardMaterial color="#2a2a35" roughness={0.6} />
      </Box>
      {/* neon outline tracing the monitor bezel */}
      <NeonStrip args={[1.52, 0.01, 0.01]} position={[0, MONITOR_TOP_Y, MONITOR_FRONT_Z]} color="#a78bfa" />
      <Screen statusColor={statusColor} candles={candles} price={price} />

      {/* keyboard, flush on the desk, well clear of the monitor's footprint */}
      <Box args={[1.3, 0.06, 0.5]} position={[0, DESK_TOP_Y + 0.03, 0.45]}>
        <meshStandardMaterial color="#20202a" roughness={0.6} />
      </Box>

      <SpeakerProp />
      <AvaxBadge />
      <LowPolyFly tradeStatus={tradeStatus} paused={paused} />
    </group>
  );
}

export default function FlyDeskScene({
  tradeStatus = 'idle',
  candles = [],
  price = 0,
  className = 'h-48',
}: {
  tradeStatus?: TradeStatus;
  candles?: Candle[];
  price?: number;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  const statusColor = tradeStatus === 'profit' ? '#22c55e' : tradeStatus === 'loss' ? '#ef4444' : '#06b6d4';
  return (
    <div className={`relative w-full ${className}`}>
      <button
        onClick={() => setPaused((p) => !p)}
        className="absolute right-2 top-2 z-10 rounded border border-white/15 bg-black/50 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-300 backdrop-blur transition hover:bg-black/70"
      >
        {paused ? 'resume motion' : 'pause motion'}
      </button>
      <Canvas camera={{ position: CAMERA_POSITION, fov: 50 }} shadows>
        <color attach="background" args={['#05070a']} />
        <ambientLight intensity={0.35} color="#a78bfa" />
        <pointLight position={[-2, 1.6, -1]} intensity={0.8} color="#06b6d4" />
        <directionalLight position={[3, 4, 2]} intensity={0.9} castShadow />
        <SweepingCamera paused={paused} />
        <Suspense fallback={null}>
          <Desk statusColor={statusColor} tradeStatus={tradeStatus} candles={candles} price={price} paused={paused} />
        </Suspense>
      </Canvas>
    </div>
  );
}
