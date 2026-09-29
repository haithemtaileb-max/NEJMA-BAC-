'use client';

import { Bounds, Html, OrbitControls, useBounds, useGLTF, useProgress } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Component, Suspense, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';

import { buildDemoSkeleton } from './demo-skeleton';

export interface AnatomyViewState {
  selected: string | null;
  hidden: ReadonlySet<string>;
  isolate: boolean;
  xray: boolean;
}

interface AnatomyCanvasProps {
  /** GLB/GLTF URL; null renders the built-in demo skeleton. */
  modelUrl: string | null;
  view: AnatomyViewState;
  /** Increment to re-frame the camera (on the selection if any). */
  resetKey: number;
  onSelect: (structure: string | null) => void;
  onStructures: (structures: string[]) => void;
  onError: () => void;
  loadingLabel: string;
}

const SELECTED_EMISSIVE = new THREE.Color('#14b8a6');
const HOVER_EMISSIVE = new THREE.Color('#475569');
const NO_EMISSIVE = new THREE.Color('#000000');

/** Structure key of a mesh: explicit userData, else its name, else its parent's name. */
function structureOf(object: THREE.Object3D): string {
  return (object.userData.structure as string | undefined) || object.name || object.parent?.name || object.uuid;
}

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  return meshes;
}

/** Give every mesh its own material so highlighting one never tints another. */
function prepare(root: THREE.Object3D): THREE.Object3D {
  for (const mesh of meshesOf(root)) {
    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const material =
      source instanceof THREE.MeshStandardMaterial ? source.clone() : new THREE.MeshStandardMaterial({ color: '#e8dcc3', roughness: 0.6 });
    mesh.material = material;
    mesh.userData.structure = structureOf(mesh);
  }
  return root;
}

function applyAppearance(root: THREE.Object3D, view: AnatomyViewState, hovered: string | null) {
  for (const mesh of meshesOf(root)) {
    const key = mesh.userData.structure as string;
    const material = mesh.material as THREE.MeshStandardMaterial;
    const isSelected = key === view.selected;
    const faded = view.xray && !isSelected;

    mesh.visible = !view.hidden.has(key) && !(view.isolate && view.selected !== null && !isSelected);
    material.emissive.copy(isSelected ? SELECTED_EMISSIVE : key === hovered ? HOVER_EMISSIVE : NO_EMISSIVE);
    material.emissiveIntensity = isSelected ? 0.3 : 0.25;
    material.transparent = faded;
    material.opacity = faded ? 0.18 : 1;
    material.depthWrite = !faded;
  }
}

function isShown(object: THREE.Object3D | null): boolean {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function InteractiveModel({ root, view, resetKey, onSelect, onStructures }: { root: THREE.Object3D } & Pick<AnatomyCanvasProps, 'view' | 'resetKey' | 'onSelect' | 'onStructures'>) {
  const invalidate = useThree((s) => s.invalidate);
  const bounds = useBounds();
  const [hovered, setHovered] = useState<string | null>(null);
  const reportStructures = useEffectEvent(() => onStructures([...new Set(meshesOf(root).map((m) => m.userData.structure as string))]));

  useEffect(() => reportStructures(), [root]);

  useEffect(() => {
    applyAppearance(root, view, hovered);
    invalidate();
  }, [root, view, hovered, invalidate]);

  // Frame the selection (or the whole model) when asked.
  const frame = useEffectEvent(() => {
    const selected = meshesOf(root).filter((m) => m.userData.structure === view.selected && m.visible);
    if (selected.length) {
      const box = new THREE.Box3();
      for (const m of selected) box.expandByObject(m);
      bounds.refresh(box).clip().fit();
    } else {
      bounds.refresh().clip().fit();
    }
  });
  useEffect(() => frame(), [resetKey]);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  // Invisible meshes still intersect rays: let the event fall through to the next hit.
  const pick = (event: ThreeEvent<PointerEvent | MouseEvent>) => (isShown(event.object) ? structureOf(event.object) : null);

  return (
    <primitive
      object={root}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        const key = pick(e);
        if (!key) return;
        e.stopPropagation();
        onSelect(key === view.selected ? null : key);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        const key = pick(e);
        if (!key) return;
        e.stopPropagation();
        setHovered(key);
      }}
      onPointerOut={() => setHovered(null)}
    />
  );
}

function GltfModel({ url, ...rest }: { url: string } & Pick<AnatomyCanvasProps, 'view' | 'resetKey' | 'onSelect' | 'onStructures'>) {
  // `true` enables Draco-compressed meshes (decoder fetched from Google's gstatic CDN).
  const { scene } = useGLTF(url, true);
  const root = useMemo(() => prepare(scene.clone(true)), [scene]);
  return <InteractiveModel root={root} {...rest} />;
}

function DemoModel(props: Pick<AnatomyCanvasProps, 'view' | 'resetKey' | 'onSelect' | 'onStructures'>) {
  const root = useMemo(() => prepare(buildDemoSkeleton()), []);
  return <InteractiveModel root={root} {...props} />;
}

function Loading({ label }: { label: string }) {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="whitespace-nowrap rounded-xl bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow">
        {label} {Math.round(progress)} %
      </div>
    </Html>
  );
}

/** A GLB that fails to load (404, CORS, corrupt file) must not crash the page. */
class ModelErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function AnatomyCanvas({ modelUrl, onError, loadingLabel, ...rest }: AnatomyCanvasProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [0, 1, 3], fov: 38, near: 0.01, far: 100 }}
      onPointerMissed={() => rest.onSelect(null)}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.8} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} />
      <hemisphereLight args={['#ffffff', '#64748b', 0.4]} />

      <ModelErrorBoundary key={modelUrl ?? 'demo'} onError={onError}>
        <Suspense fallback={<Loading label={loadingLabel} />}>
          <Bounds fit clip observe margin={1.15}>
            {modelUrl ? <GltfModel url={modelUrl} {...rest} /> : <DemoModel {...rest} />}
          </Bounds>
        </Suspense>
      </ModelErrorBoundary>

      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={0.2} maxDistance={12} />
    </Canvas>
  );
}
