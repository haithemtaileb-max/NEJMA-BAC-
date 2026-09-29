import {
  Activity,
  Apple,
  Atom,
  Baby,
  Beaker,
  BookOpen,
  Bone,
  Brain,
  Bug,
  ChartColumn,
  Dna,
  Droplets,
  FlaskConical,
  FlaskRound,
  Gem,
  HeartPulse,
  Hexagon,
  Layers,
  Leaf,
  Microscope,
  Mountain,
  Pill,
  Shield,
  Sigma,
  Skull,
  Smile,
  Stethoscope,
  TestTube,
  Users,
  type LucideProps,
} from 'lucide-react';

import { ToothIcon } from './tooth-icon';

/**
 * Icon names stored in `modules.icon` → components. Keeping an explicit map
 * (instead of importing all of lucide dynamically) keeps the bundle small.
 */
const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  activity: Activity,
  apple: Apple,
  atom: Atom,
  baby: Baby,
  beaker: Beaker,
  bone: Bone,
  'book-open': BookOpen,
  brain: Brain,
  bug: Bug,
  'chart-column': ChartColumn,
  dna: Dna,
  droplets: Droplets,
  'flask-conical': FlaskConical,
  'flask-round': FlaskRound,
  gem: Gem,
  'heart-pulse': HeartPulse,
  hexagon: Hexagon,
  layers: Layers,
  leaf: Leaf,
  microscope: Microscope,
  mountain: Mountain,
  pill: Pill,
  shield: Shield,
  sigma: Sigma,
  skull: Skull,
  smile: Smile,
  stethoscope: Stethoscope,
  'test-tube': TestTube,
  tooth: ToothIcon,
  users: Users,
};

export function ModuleIcon({ name, ...props }: LucideProps & { name: string }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon aria-hidden="true" {...props} />;
}
