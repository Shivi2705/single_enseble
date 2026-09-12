"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html, ContactShadows, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

// Loose type for the drei OrbitControls imperative handle (avoids a hard
// dependency on three-stdlib's internal types).
type OrbitControlsImpl = any;
import { NV_AXES, NV_AXIS_COLORS } from "@/lib/constants";

// --- Diamond cubic lattice generation -------------------------------------
// FCC lattice points + 2-atom basis (0,0,0) and (1/4,1/4,1/4), in units of
// the conventional cubic cell constant `a`. We build a small supercell and
// trim it to a sphere for a clean, presentation-ready view.

const A = 1.6; // visual lattice constant (arbitrary scene units)
const FCC_OFFSETS: [number, number, number][] = [
  [0, 0, 0],
  [0.5, 0.5, 0],
  [0.5, 0, 0.5],
  [0, 0.5, 0.5],
];
const BASIS: [number, number, number][] = [
  [0, 0, 0],
  [0.25, 0.25, 0.25],
];

interface Atom {
  pos: THREE.Vector3;
  kind: "carbon" | "nitrogen" | "vacancy";
}

function buildLattice(radiusCells = 1.6): Atom[] {
  const atoms: Atom[] = [];
  const range = 2;
  for (let i = -range; i <= range; i++) {
    for (let j = -range; j <= range; j++) {
      for (let k = -range; k <= range; k++) {
        for (const off of FCC_OFFSETS) {
          for (const b of BASIS) {
            const x = (i + off[0] + b[0]) * A;
            const y = (j + off[1] + b[1]) * A;
            const z = (k + off[2] + b[2]) * A;
            const v = new THREE.Vector3(x, y, z);
            if (v.length() <= radiusCells * A) {
              atoms.push({ pos: v, kind: "carbon" });
            }
          }
        }
      }
    }
  }
  return atoms;
}

function assignNVDefect(atoms: Atom[]): { atoms: Atom[]; vacancyPos: THREE.Vector3; nitrogenPos: THREE.Vector3 } {
  // Pick the atom nearest the origin as the vacancy, and its nearest
  // neighbor along +[111] as the substitutional nitrogen.
  let vacancyIdx = 0;
  let best = Infinity;
  atoms.forEach((a, idx) => {
    const d = a.pos.length();
    if (d < best) {
      best = d;
      vacancyIdx = idx;
    }
  });
  const vacancyPos = atoms[vacancyIdx].pos.clone();

  let nitrogenIdx = -1;
  let bestN = Infinity;
  atoms.forEach((a, idx) => {
    if (idx === vacancyIdx) return;
    const d = a.pos.distanceTo(vacancyPos);
    if (d < 0.5 * A && d < bestN) {
      bestN = d;
      nitrogenIdx = idx;
    }
  });

  const next = atoms.map((a, idx) => {
    if (idx === vacancyIdx) return { ...a, kind: "vacancy" as const };
    if (idx === nitrogenIdx) return { ...a, kind: "nitrogen" as const };
    return a;
  });

  return { atoms: next, vacancyPos, nitrogenPos: next[nitrogenIdx]?.pos.clone() ?? vacancyPos };
}

function AxisArrow({
  origin,
  direction,
  color,
  length = 2.4,
}: {
  origin: THREE.Vector3;
  direction: [number, number, number];
  color: string;
  length?: number;
}) {
  const dir = new THREE.Vector3(...direction).normalize();
  const end = origin.clone().addScaledVector(dir, length);
  const coneHeight = 0.32;
  const coneOrigin = end.clone().addScaledVector(dir, -coneHeight / 2);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir
  );

  return (
    <group>
      <Line points={[origin, end]} color={color} lineWidth={2.5} />
      <mesh position={coneOrigin} quaternion={quaternion}>
        <coneGeometry args={[0.11, coneHeight, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Atoms({
  atoms,
  spaceFilling,
}: {
  atoms: Atom[];
  spaceFilling: boolean;
}) {
  const carbonRadius = spaceFilling ? 0.62 : 0.22;
  const nitrogenRadius = spaceFilling ? 0.68 : 0.28;

  return (
    <group>
      {atoms.map((a, i) => {
        if (a.kind === "vacancy") {
          return (
            <group key={i} position={a.pos}>
              <mesh>
                <sphereGeometry args={[0.22, 20, 20]} />
                <meshStandardMaterial
                  color="#f43f5e"
                  emissive="#f43f5e"
                  emissiveIntensity={1.1}
                  transparent
                  opacity={0.55}
                />
              </mesh>
              <pointLight color="#f43f5e" intensity={2.2} distance={2} />
            </group>
          );
        }
        const color = a.kind === "nitrogen" ? "#3b82f6" : "#94a3b8";
        const radius = a.kind === "nitrogen" ? nitrogenRadius : carbonRadius;
        return (
          <mesh key={i} position={a.pos} castShadow receiveShadow>
            <sphereGeometry args={[radius, 20, 20]} />
            <meshStandardMaterial
              color={color}
              roughness={0.35}
              metalness={a.kind === "nitrogen" ? 0.1 : 0.05}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function UnitCellEdges({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const s = A;
  const corners: [number, number, number][] = [];
  for (const x of [0, s]) for (const y of [0, s]) for (const z of [0, s]) corners.push([x, y, z]);
  const edges: [number, number][] = [];
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      const [x1, y1, z1] = corners[i];
      const [x2, y2, z2] = corners[j];
      const diff = Math.abs(x1 - x2) + Math.abs(y1 - y2) + Math.abs(z1 - z2);
      if (Math.abs(diff - s) < 1e-6) edges.push([i, j]);
    }
  }
  const offset = new THREE.Vector3(-s / 2, -s / 2, -s / 2);
  return (
    <group>
      {edges.map(([i, j], idx) => (
        <Line
          key={idx}
          points={[
            new THREE.Vector3(...corners[i]).add(offset),
            new THREE.Vector3(...corners[j]).add(offset),
          ]}
          color="#94a3b8"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
      ))}
    </group>
  );
}

function AutoRotateGroup({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (enabled && ref.current) {
      ref.current.rotation.y += delta * 0.25;
    }
  });
  return <group ref={ref}>{children}</group>;
}

export interface DiamondViewerOptions {
  showUnitCell: boolean;
  showAxes: boolean;
  spaceFilling: boolean;
  autoRotate: boolean;
}

// `next/dynamic` (used to lazy-load this component, since it touches WebGL)
// does not forward refs to the wrapped component, so an imperative
// ref-based reset() API silently fails with a "function components cannot
// be given refs" warning. A `resetSignal` prop that the parent increments
// on each "Reset view" click avoids that entirely: bump the number, this
// effect sees it change, and calls the OrbitControls reset itself.
interface DiamondViewerProps {
  options: DiamondViewerOptions;
  resetSignal?: number;
}

export function DiamondViewer({ options, resetSignal }: DiamondViewerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    controlsRef.current?.reset();
  }, [resetSignal]);

  const { atoms, vacancyPos } = useMemo(() => {
    const raw = buildLattice(1.7);
    return assignNVDefect(raw);
  }, []);

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }} className="!touch-none">
      <PerspectiveCamera makeDefault position={[6, 5, 7]} fov={45} />
      <ambientLight intensity={0.55} />
        <directionalLight
          position={[6, 8, 4]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-6, -3, -4]} intensity={0.3} />

        <AutoRotateGroup enabled={options.autoRotate}>
          <Atoms atoms={atoms} spaceFilling={options.spaceFilling} />
          <UnitCellEdges visible={options.showUnitCell} />
          {options.showAxes &&
            NV_AXES.map((dir, i) => (
              <AxisArrow key={i} origin={vacancyPos} direction={dir} color={NV_AXIS_COLORS[i]} />
            ))}
          <Html
            position={vacancyPos.clone().addScaledVector(new THREE.Vector3(0, 1, 0), 0.5)}
            center
            distanceFactor={10}
          >
            <div className="pointer-events-none rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap">
              NV center
            </div>
          </Html>
        </AutoRotateGroup>

        <ContactShadows position={[0, -3.2, 0]} opacity={0.35} scale={12} blur={2.2} far={4} />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={20}
        />
      </Canvas>
  );
}
