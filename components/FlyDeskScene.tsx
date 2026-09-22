'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, Sphere, Plane, Html, OrbitControls } from '@react-three/drei';
import type { Group, Mesh } from 'three';

const CAMERA_POSITION: [number, number, number] = [2.6, 1.3, 3.0];
const CONTROLS_TARGET: [number, number, number] = [0, 0.45, 0.05];
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

function SweepingCamera() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useRef<any>(null);
  const dragging = useRef(false);

  useFrame(({ camera, clock }) => {
    if (dragging.current || !controls.current) return;
    const azimuth = FRONT_AZIMUTH + Math.sin(clock.getElapsedTime() * 0.3) * ORBIT_RANGE;
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
// see note above).
const FLY_SCALE = 0.46;
const FLY_BASE_Y = KEYBOARD_TOP_Y + 0.15 * FLY_SCALE;

function LowPolyFly({ tradeStatus }: { tradeStatus: TradeStatus }) {
  const group = useRef<Group>(null);
  const wingL = useRef<Mesh>(null);
  const wingR = useRef<Mesh>(null);
  const legFrontL = useRef<Group>(null);
  const legFrontR = useRef<Group>(null);
  const jump = useRef(0);

  const glowColor = tradeStatus === 'profit' ? '#22c55e' : tradeStatus === 'loss' ? '#ef4444' : '#000000';
  const glowIntensity = tradeStatus === 'idle' ? 0 : 0.9;

  useFrame(({ clock }, delta) => {
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
      <Sphere args={[0.09, 8, 8]} position={[0.1, 0.04, 0.42]}>
        <meshStandardMaterial color="#b91c1c" emissive="#b91c1c" emissiveIntensity={0.4} />
      </Sphere>
      <Sphere args={[0.09, 8, 8]} position={[-0.1, 0.04, 0.42]}>
        <meshStandardMaterial color="#b91c1c" emissive="#b91c1c" emissiveIntensity={0.4} />
      </Sphere>
      <Plane ref={wingL} args={[0.45, 0.2]} position={[0.16, 0.1, 0.05]} rotation={[0, 0, 0.4]}>
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.35} side={2} />
      </Plane>
      <Plane ref={wingR} args={[0.45, 0.2]} position={[-0.16, 0.1, 0.05]} rotation={[0, 0, -0.4]}>
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.35} side={2} />
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

function Desk({
  statusColor, tradeStatus, candles, price,
}: { statusColor: string; tradeStatus: TradeStatus; candles: Candle[]; price: number }) {
  return (
    <group>
      {/* desk (top surface at y=0) */}
      <Box args={[2.6, 0.12, 1.6]} position={[0, DESK_TOP_Y - 0.06, 0]} receiveShadow>
        <meshStandardMaterial color="#2a2a35" roughness={0.9} />
      </Box>

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
      <Screen statusColor={statusColor} candles={candles} price={price} />

      {/* keyboard, flush on the desk, well clear of the monitor's footprint */}
      <Box args={[1.3, 0.06, 0.5]} position={[0, DESK_TOP_Y + 0.03, 0.45]}>
        <meshStandardMaterial color="#20202a" roughness={0.6} />
      </Box>

      <LowPolyFly tradeStatus={tradeStatus} />
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
  const statusColor = tradeStatus === 'profit' ? '#22c55e' : tradeStatus === 'loss' ? '#ef4444' : '#06b6d4';
  return (
    <div className={`w-full ${className}`}>
      <Canvas camera={{ position: [2.6, 1.3, 3.0], fov: 42 }} shadows>
        <color attach="background" args={['#05070a']} />
        <ambientLight intensity={0.35} color="#a78bfa" />
        <pointLight position={[-2, 1.6, -1]} intensity={0.8} color="#06b6d4" />
        <directionalLight position={[3, 4, 2]} intensity={0.9} castShadow />
        <SweepingCamera />
        <Desk statusColor={statusColor} tradeStatus={tradeStatus} candles={candles} price={price} />
      </Canvas>
    </div>
  );
}
