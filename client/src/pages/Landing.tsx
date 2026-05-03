import React, { useRef, useEffect, useState, useMemo, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { Link } from "wouter";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Float, Stars } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowRight, Zap, Bot, Layers, Key, Globe, Users, Check, X, ChevronRight, Star,
  TrendingUp, Shield, Target, BarChart3, Mail, Play,
} from "lucide-react";

// ─── WebGL Error Boundary ─────────────────────────────────────────────────────
interface EBState { hasError: boolean }
class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, EBState> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) { console.warn("WebGL not available:", error.message); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ─── CSS Fallback: Neural Signal Network ─────────────────────────────────────
const CSS_NODES = [
  { angle: 0,   r: 130, color: "#10b981", label: "Series B $40M" },
  { angle: 60,  r: 115, color: "#6366f1", label: "12 DevOps hires" },
  { angle: 120, r: 140, color: "#f59e0b", label: "AWS → GCP" },
  { angle: 195, r: 120, color: "#ec4899", label: "New CTO hired" },
  { angle: 255, r: 135, color: "#3b82f6", label: "Series A $12M" },
  { angle: 315, r: 110, color: "#8b5cf6", label: "Stack migration" },
];

function CSSGlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative" style={{ width: 340, height: 340 }}>
        {/* Rings */}
        <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-[spin_22s_linear_infinite]" />
        <div className="absolute inset-6 rounded-full border border-violet-500/15 animate-[spin_16s_linear_infinite_reverse]" />
        <div className="absolute inset-12 rounded-full border border-indigo-400/10 animate-[spin_11s_linear_infinite]" />

        {/* Center orb */}
        <div className="absolute inset-[38%] rounded-full bg-gradient-to-br from-indigo-500 to-violet-600"
          style={{ boxShadow: "0 0 60px 20px rgba(99,102,241,0.35)" }} />
        <div className="absolute inset-[42%] rounded-full bg-white/10 animate-pulse" />

        {/* LeadPilot label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-[10px] font-bold text-indigo-300 tracking-widest mt-20 select-none">LEADPILOT</div>
        </div>

        {/* Signal nodes orbiting */}
        {CSS_NODES.map((node, i) => {
          const rad = (node.angle * Math.PI) / 180;
          const cx = 50 + (node.r / 3.4) * Math.cos(rad);
          const cy = 50 + (node.r / 3.4) * Math.sin(rad);
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%,-50%)" }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.25, duration: 0.5 }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full border whitespace-nowrap"
                style={{
                  backgroundColor: `${node.color}18`,
                  borderColor: `${node.color}40`,
                  boxShadow: `0 0 12px ${node.color}30`,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: node.color }} />
                <span className="text-[10px] font-medium" style={{ color: node.color }}>{node.label}</span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3D: Pulsing Signal Node ──────────────────────────────────────────────────
function SignalNode({ position, color, delay = 0, size = 0.13 }: {
  position: [number, number, number]; color: string; delay?: number; size?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime + delay;
      meshRef.current.scale.setScalar(0.85 + 0.18 * Math.sin(t * 2.2));
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.7 + 0.5 * Math.sin(t * 2.2);
    }
    if (glowRef.current) {
      const t = state.clock.elapsedTime + delay;
      glowRef.current.scale.setScalar(1.0 + 0.4 * Math.sin(t * 1.8));
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.08 + 0.06 * Math.sin(t * 1.8);
    }
  });

  const col = new THREE.Color(color);

  return (
    <Float speed={1.8 + delay * 0.3} rotationIntensity={0} floatIntensity={0.35}>
      <group position={position}>
        {/* Glow halo */}
        <mesh ref={glowRef}>
          <sphereGeometry args={[size * 2.8, 12, 12]} />
          <meshBasicMaterial color={col} transparent opacity={0.12} />
        </mesh>
        {/* Core */}
        <mesh ref={meshRef}>
          <sphereGeometry args={[size, 18, 18]} />
          <meshStandardMaterial
            color={col}
            emissive={col}
            emissiveIntensity={0.9}
            roughness={0.15}
            metalness={0.6}
          />
        </mesh>
      </group>
    </Float>
  );
}

// ─── 3D: Network connection lines ─────────────────────────────────────────────
function NetworkLines({ nodes }: { nodes: [number, number, number][] }) {
  const ref = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const pts: number[] = [];
    // Hub spokes (center → each node)
    for (const n of nodes) pts.push(0, 0, 0, n[0], n[1], n[2]);
    // Cross-links between every-other node for a web feel
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i], b = nodes[(i + 2) % nodes.length];
      pts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [nodes]);

  useFrame((state) => {
    if (ref.current) {
      (ref.current.material as THREE.LineBasicMaterial).opacity =
        0.22 + 0.1 * Math.sin(state.clock.elapsedTime * 1.3);
    }
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#6366f1" transparent opacity={0.25} />
    </lineSegments>
  );
}

// ─── 3D: Particle traveling along an edge ─────────────────────────────────────
function DataStream({ from, to, color, speed = 0.5 }: {
  from: [number, number, number]; to: [number, number, number]; color: string; speed?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const col = new THREE.Color(color);

  useFrame((state) => {
    if (ref.current) {
      const t = (state.clock.elapsedTime * speed) % 1;
      ref.current.position.set(
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t,
      );
      (ref.current.material as THREE.MeshBasicMaterial).opacity =
        Math.sin(t * Math.PI) * 0.9;
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.038, 8, 8]} />
      <meshBasicMaterial color={col} transparent opacity={0.9} />
    </mesh>
  );
}

// ─── 3D: Ambient particle cloud ───────────────────────────────────────────────
function ParticleCloud({ count = 220 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.5 + Math.random() * 1.8;
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi + Math.random() * 0.5;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.0008;
      ref.current.rotation.x = 0.05 * Math.sin(state.clock.elapsedTime * 0.2);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#818cf8" size={0.04} sizeAttenuation transparent opacity={0.55} />
    </points>
  );
}

// ─── 3D: Main Signal Network Scene ───────────────────────────────────────────
const NODE_DATA: Array<{ pos: [number, number, number]; color: string; delay: number }> = [
  { pos: [2.0,  0.4,  0.5],  color: "#10b981", delay: 0.0 },
  { pos: [-1.5, 1.3,  0.8],  color: "#6366f1", delay: 0.6 },
  { pos: [0.7,  -1.9, 0.4],  color: "#f59e0b", delay: 1.1 },
  { pos: [-1.9, -0.7, -0.5], color: "#ec4899", delay: 1.6 },
  { pos: [0.6,  1.6,  -1.7], color: "#3b82f6", delay: 2.1 },
  { pos: [-0.4, -0.6, -2.1], color: "#8b5cf6", delay: 2.6 },
];

function SignalNetwork() {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0018;
      // Subtle mouse parallax
      groupRef.current.rotation.x +=
        (mouse.y * 0.12 - groupRef.current.rotation.x) * 0.04;
    }
  });

  const nodePositions = NODE_DATA.map(n => n.pos);

  return (
    <group ref={groupRef}>
      <Stars radius={90} depth={55} count={2200} factor={3} saturation={0.2} fade speed={0.25} />

      {/* Central hub sphere */}
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.4}>
        <mesh>
          <Sphere args={[1.15, 72, 72]}>
            <MeshDistortMaterial
              color="#6366f1"
              attach="material"
              distort={0.22}
              speed={2.8}
              roughness={0.08}
              metalness={0.92}
              transparent
              opacity={0.92}
            />
          </Sphere>
        </mesh>

        {/* Wireframe shell */}
        <mesh>
          <Sphere args={[1.18, 28, 28]}>
            <meshBasicMaterial color="#a78bfa" wireframe transparent opacity={0.08} />
          </Sphere>
        </mesh>

        {/* Equatorial ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.42, 0.025, 16, 120]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.45} />
        </mesh>

        {/* Tilted accent ring */}
        <mesh rotation={[Math.PI / 2.4, 0.6, 0]}>
          <torusGeometry args={[1.62, 0.012, 12, 80]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.22} />
        </mesh>
      </Float>

      {/* Signal nodes */}
      {NODE_DATA.map((n, i) => (
        <SignalNode key={i} position={n.pos} color={n.color} delay={n.delay} />
      ))}

      {/* Network connection lines */}
      <NetworkLines nodes={nodePositions} />

      {/* Data stream particles on each spoke */}
      {NODE_DATA.map((n, i) => (
        <DataStream
          key={`stream-${i}`}
          from={[0, 0, 0]}
          to={n.pos}
          color={n.color}
          speed={0.38 + i * 0.07}
        />
      ))}

      {/* Reverse-direction streams on alternating edges */}
      {NODE_DATA.filter((_, i) => i % 2 === 0).map((n, i) => (
        <DataStream
          key={`stream-rev-${i}`}
          from={n.pos}
          to={[0, 0, 0]}
          color={n.color}
          speed={0.28 + i * 0.1}
        />
      ))}

      {/* Ambient particle cloud */}
      <ParticleCloud count={240} />

      {/* Colored light sources */}
      <pointLight position={[3, 2, 2]} intensity={1.2} color="#6366f1" />
      <pointLight position={[-3, -2, -2]} intensity={0.7} color="#a78bfa" />
      <pointLight position={[0, 3, -3]} intensity={0.5} color="#10b981" />
    </group>
  );
}

// ─── Signal Toast Overlay ─────────────────────────────────────────────────────
const SIGNALS = [
  { company: "Acme Corp", signal: "just raised $40M Series B", icon: "💰", color: "text-emerald-400" },
  { company: "BuildFast AI", signal: "hiring 12 engineers this month", icon: "📈", color: "text-blue-400" },
  { company: "DataFlow Inc", signal: "new CTO just joined", icon: "👤", color: "text-violet-400" },
  { company: "Nexus Labs", signal: "migrating off AWS → GCP", icon: "🔧", color: "text-cyan-400" },
  { company: "Orbit SaaS", signal: "Series A announced $12M", icon: "🚀", color: "text-yellow-400" },
];

function SignalToasts() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(v => (v + 1) % SIGNALS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-8 left-4 right-4 pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={visible}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.4 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex items-center gap-3 max-w-sm"
        >
          <span className="text-lg">{SIGNALS[visible].icon}</span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{SIGNALS[visible].company}</div>
            <div className={`text-xs ${SIGNALS[visible].color} truncate`}>{SIGNALS[visible].signal}</div>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Landing Page Sections ────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Zap,
    title: "Intent Signals",
    description: "Detect funding rounds, hiring spikes, leadership changes, and tech migrations — all triggering instant outreach.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    size: "col-span-2 row-span-1",
  },
  {
    icon: Bot,
    title: "Agentic SDR",
    description: "Multi-step AI agent researches, drafts, and follows up autonomously. Full trace of every decision.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    size: "col-span-1 row-span-2",
  },
  {
    icon: Layers,
    title: "Waterfall Enrichment",
    description: "Drag-and-drop provider ordering. A-Leads → Prospeo → Apollo → Hunter. Stop when email found.",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    size: "col-span-1 row-span-1",
  },
  {
    icon: Key,
    title: "BYOK Key Vault",
    description: "Bring your own API keys. AES-256-GCM encryption. 0.1 credits vs 1.0. Never logged.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    size: "col-span-1 row-span-1",
  },
  {
    icon: Globe,
    title: "30+ Job Scrapers",
    description: "LinkedIn, Indeed, Upwork, Freelancer, RemoteOK, Glassdoor, Wellfound, and 25 more platforms.",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    size: "col-span-1 row-span-1",
  },
  {
    icon: Users,
    title: "Champion Tracking",
    description: "Mark contacts as champions. Get alerted when they change jobs. Re-engage at their new company.",
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
    size: "col-span-1 row-span-1",
  },
];

const COMPARISON = [
  { feature: "Job posting → signal detection", us: true, apollo: false, clay: false },
  { feature: "Agentic SDR with step trace", us: true, apollo: false, clay: true },
  { feature: "BYOK saves 80% on enrichment", us: true, apollo: false, clay: false },
  { feature: "30+ job board scrapers", us: true, apollo: false, clay: false },
  { feature: "Hiring spike intent signal", us: true, apollo: false, clay: false },
  { feature: "Champion tracking", us: true, apollo: true, clay: false },
  { feature: "Waterfall enrichment designer", us: true, apollo: false, clay: true },
  { feature: "Webhook API", us: true, apollo: true, clay: true },
  { feature: "AES-256 encrypted key vault", us: true, apollo: false, clay: false },
  { feature: "Autonomous follow-up sequences", us: true, apollo: false, clay: false },
  { feature: "CSV export all data", us: true, apollo: true, clay: true },
  { feature: "Free tier (no credit card)", us: true, apollo: false, clay: false },
];

const PRICING = [
  {
    name: "Free",
    price: 0,
    credits: 50,
    features: ["50 credits/month", "3 job platforms", "Manual enrichment", "Email support"],
    cta: "Get started free",
    href: "/signup",
    featured: false,
  },
  {
    name: "Pro",
    price: 79,
    credits: 2000,
    features: ["2,000 credits/month", "All 30+ platforms", "Waterfall enrichment", "BYOK discounts", "Agent SDR", "Priority support"],
    cta: "Start Pro",
    href: "/signup",
    featured: true,
  },
  {
    name: "Agency",
    price: 249,
    credits: 10000,
    features: ["10,000 credits/month", "Unlimited workspaces", "White-label ready", "Webhook API", "Dedicated CSM", "SLA guarantee"],
    cta: "Start Agency",
    href: "/signup",
    featured: false,
  },
  {
    name: "Scale",
    price: 799,
    credits: 50000,
    features: ["50,000 credits/month", "Custom enrichment pipelines", "SLA 99.9%", "Dedicated infrastructure", "White-glove onboarding", "24/7 phone support"],
    cta: "Contact sales",
    href: "/signup",
    featured: false,
  },
];

const TESTIMONIALS = [
  {
    quote: "We booked 14 meetings in the first week. The intent signals are wild — we caught a company right as they raised Series A.",
    author: "Sarah K.",
    role: "Founder, GrowthStack",
    avatar: "SK",
  },
  {
    quote: "LeadPilot replaced three different tools for us. BYOK alone saves us $800/month versus Apollo.",
    author: "Marcus T.",
    role: "Head of Sales, DevSquad",
    avatar: "MT",
  },
  {
    quote: "The agentic SDR actually sends emails that sound human. Our reply rate went from 2% to 11%.",
    author: "Priya M.",
    role: "CEO, Catalyze Agency",
    avatar: "PM",
  },
];

const FAQ = [
  {
    q: "How is LeadPilot different from Apollo or Clay?",
    a: "LeadPilot is job-posting-first. We detect intent signals from new hires (someone hiring a DevOps engineer signals they have infra pain) and turn them into enriched outreach opportunities. Apollo is a database; Clay is a spreadsheet. We're an autonomous prospecting loop.",
  },
  {
    q: "What does BYOK mean and how much does it save?",
    a: "BYOK = Bring Your Own Keys. You provide your own API keys for enrichment providers like Hunter, Prospeo, or A-Leads. You're charged 0.1 credits per enrichment (vs 1.0 for managed). Agencies using BYOK save 80–90% on enrichment costs.",
  },
  {
    q: "What job platforms do you support?",
    a: "LinkedIn, Indeed, Glassdoor, Google Jobs, ZipRecruiter, Upwork, Freelancer, RemoteOK, We Work Remotely, Wellfound, Dice, Monster, Naukri, PeoplePerHour, and 15+ more. New scrapers added monthly.",
  },
  {
    q: "How does the agentic SDR work?",
    a: "The agent: 1) Researches the account from the job post, 2) Identifies the best decision-maker via enrichment, 3) Drafts a personalized email referencing the trigger signal, 4) Waits for your approval (or sends autonomously), 5) Monitors for replies and drafts follow-ups. Full step trace visible in the UI.",
  },
  {
    q: "Is my API key data secure?",
    a: "Yes. All API keys are encrypted with AES-256-GCM at rest. Keys are never logged, never sent to the frontend after save, and we never use them for anything other than enrichment on your behalf.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No lock-in. Cancel from the billing portal instantly. Your data is exportable at any time.",
  },
  {
    q: "Do you have a free trial?",
    a: "Yes — 50 credits on signup, no credit card required. Enough to scrape 2–3 job boards, enrich ~30 companies, and try the agent on a few opportunities.",
  },
  {
    q: "Does the agent send emails automatically?",
    a: "Only if you enable Autonomous mode. By default, the agent drafts emails and waits for your approval. You can also set it to Draft-only mode where it never sends without your action.",
  },
  {
    q: "What enrichment providers do you support?",
    a: "Waterfall enrichment tries providers in your configured order: A-Leads → Prospeo → Apollo → Hunter.io → RocketReach. When BYOK is enabled, it uses your key for that provider at 0.1 credit cost instead of 1.0. You can reorder the waterfall in Settings → Waterfall.",
  },
  {
    q: "Can I use LeadPilot for freelance / agency client work?",
    a: "Absolutely. The Agency plan ($249/mo) supports unlimited workspaces — one per client — with white-label-ready output, webhook API for CRM sync, and a dedicated customer success manager.",
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -80]);

  const BRANDS = ["Rippling", "Loom", "Superhuman", "Retool", "Coda", "Segment", "Pendo", "Brex", "Rippling", "Loom", "Superhuman", "Retool", "Coda", "Segment", "Pendo", "Brex"];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* Announcement bar */}
      <div className="relative bg-gradient-to-r from-indigo-600/20 via-violet-600/15 to-indigo-600/20 border-b border-indigo-500/15 py-2 px-4 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>New: Champion Tracking now available — get alerted when your contacts change jobs</span>
          <a href="#features" className="text-indigo-400 hover:text-indigo-300 font-medium ml-1 transition-colors">Learn more →</a>
        </div>
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.06]">
        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/25 to-transparent" />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/30">
            <Target className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">LeadPilot</span>
          <span className="text-[10px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-medium">2.0</span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm text-zinc-500">
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white transition-colors">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/30 transition-all">
              Start free <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 60% 50%, rgba(99,102,241,0.14) 0%, transparent 60%)" }} />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0f] to-transparent" />

        <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <motion.div
            className="space-y-7"
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs px-3 py-1.5 rounded-full font-medium">
                <Zap className="w-3 h-3 text-indigo-400" />
                Intent-driven B2B prospecting
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
              </div>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-[3.75rem] font-black leading-[1.04] tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Turn every new{" "}
              <span className="relative">
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent bg-[length:200%] animate-gradient-x">
                  job posting
                </span>
              </span>{" "}
              into a booked meeting
            </motion.h1>

            <motion.p
              className="text-lg text-zinc-400 leading-relaxed max-w-xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              LeadPilot detects intent signals from 30+ job boards, enriches decision-makers with waterfall AI,
              and lets an autonomous agent draft, send, and follow up — all while you focus on closing.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Link href="/signup">
                <div className="relative inline-flex">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl blur opacity-60 group-hover:opacity-100 transition-opacity" />
                  <Button size="lg" className="relative bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 px-8 transition-all hover:shadow-indigo-500/50 rounded-xl">
                    Start free — no credit card
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </Link>
              <Button size="lg" variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5 hover:border-white/20 transition-all rounded-xl">
                <Play className="w-4 h-4 fill-current" />
                Watch demo
              </Button>
            </motion.div>

            <motion.div
              className="flex flex-wrap items-center gap-5 text-sm text-zinc-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.5 }}
            >
              {["50 free credits", "No card required", "Cancel anytime"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-indigo-400" />
                  </div>
                  {item}
                </div>
              ))}
            </motion.div>

            {/* Mini stat bar */}
            <motion.div
              className="grid grid-cols-4 gap-3 pt-3 border-t border-white/[0.06]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.5 }}
            >
              {[
                { value: "30+", label: "Job platforms", color: "from-indigo-400 to-violet-400" },
                { value: "80%", label: "BYOK savings", color: "from-green-400 to-emerald-400" },
                { value: "11%", label: "Reply rate", color: "from-yellow-400 to-orange-400" },
                { value: "500+", label: "Teams using", color: "from-violet-400 to-pink-400" },
              ].map(({ value, label, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-xl font-black bg-gradient-to-r ${color} bg-clip-text text-transparent tabular-nums`}>{value}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: 3D Globe */}
          <div className="relative h-[480px] md:h-[580px]">
            {/* Glow ring behind canvas */}
            <div className="absolute inset-8 rounded-full bg-indigo-500/5 blur-3xl" />
            <WebGLErrorBoundary fallback={<CSSGlobeFallback />}>
              <Suspense fallback={<div className="w-full h-full rounded-2xl bg-indigo-500/5 border border-indigo-500/10 animate-pulse" />}>
                <Canvas camera={{ position: [0, 0, 4.8], fov: 48 }}>
                  <ambientLight intensity={0.3} />
                  <SignalNetwork />
                </Canvas>
              </Suspense>
            </WebGLErrorBoundary>
            <SignalToasts />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-12 border-y border-white/[0.05]" style={{ background: "linear-gradient(to bottom, rgba(10,10,15,0.8), rgba(10,10,15,1))" }}>
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: "500+", label: "Growth teams", color: "from-indigo-400 to-violet-400", bg: "bg-indigo-500/10 border-indigo-500/15" },
              { value: "2.4M+", label: "Job postings scraped", color: "from-violet-400 to-purple-400", bg: "bg-violet-500/10 border-violet-500/15" },
              { value: "11%", label: "Average reply rate", color: "from-green-400 to-emerald-400", bg: "bg-green-500/10 border-green-500/15" },
              { value: "< 5 min", label: "From signal to pitch", color: "from-yellow-400 to-orange-400", bg: "bg-yellow-500/10 border-yellow-500/15" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className={`rounded-xl border ${stat.bg} p-4 text-center backdrop-blur-sm`}
              >
                <div className={`text-3xl font-black mb-1.5 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent tabular-nums`}>
                  {stat.value}
                </div>
                <div className="text-xs text-zinc-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Marquee logo bar */}
      <section className="py-10 border-b border-white/[0.05] overflow-hidden">
        <p className="text-xs text-zinc-600 text-center mb-6 uppercase tracking-widest font-medium">Trusted by growth teams at</p>
        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#0a0a0f] to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none" />
          <div className="animate-marquee">
            {BRANDS.map((brand, i) => (
              <div key={`brand-${i}`} className="shrink-0 mx-8 text-zinc-600 font-semibold text-base hover:text-zinc-400 transition-colors cursor-default select-none">
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 container mx-auto px-6">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs px-3 py-1.5 rounded-full font-medium mb-5">
            How it works
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            From job post to <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">booked meeting</span>
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto">Three automated steps replace a full SDR workflow.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              step: "01",
              icon: Globe,
              title: "Detect intent signals",
              desc: "LeadPilot continuously monitors 30+ job boards. When a company posts roles that signal buying intent — DevOps hires, security roles, new funding — we flag it instantly.",
              color: "text-indigo-400",
              bg: "bg-indigo-500/10 border-indigo-500/20",
              glow: "group-hover:shadow-indigo-500/20",
            },
            {
              step: "02",
              icon: Users,
              title: "Enrich decision-makers",
              desc: "Waterfall enrichment finds the right contact using A-Leads → Prospeo → Apollo → Hunter. BYOK mode cuts costs by 80%. Verified email, LinkedIn, title — everything you need.",
              color: "text-violet-400",
              bg: "bg-violet-500/10 border-violet-500/20",
              glow: "group-hover:shadow-violet-500/20",
            },
            {
              step: "03",
              icon: Bot,
              title: "Agent SDR closes the loop",
              desc: "The AI agent researches the account, drafts a hyper-personalized email referencing the trigger signal, waits for your approval or sends autonomously, then follows up.",
              color: "text-green-400",
              bg: "bg-green-500/10 border-green-500/20",
              glow: "group-hover:shadow-green-500/20",
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className={`group relative rounded-2xl border ${item.bg} p-6 transition-all duration-300 hover-glow cursor-default`}
              >
                {/* Step number */}
                <div className="text-[10px] font-black text-zinc-700 mb-4 tracking-widest">{item.step}</div>
                <div className={`w-10 h-10 rounded-xl ${item.bg} border flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <h3 className="text-base font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                {/* Connector between steps */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 -right-3 z-10">
                    <ChevronRight className="w-5 h-5 text-zinc-700" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Features bento grid */}
      <section id="features" className="py-24 container mx-auto px-6">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-3 py-1.5 rounded-full font-medium mb-5">
            Features
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Everything you need to close more</h2>
          <p className="text-zinc-400 max-w-xl mx-auto">From intent signal detection to autonomous outreach — the entire B2B prospecting loop in one platform.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className={`${feature.size} relative rounded-2xl border ${feature.bg} p-6 cursor-default overflow-hidden backdrop-blur-sm hover-glow transition-all`}
              >
                {/* Top gradient line */}
                <div className="absolute top-0 left-0 right-0 h-px opacity-60" style={{
                  background: `linear-gradient(to right, transparent, ${feature.color.includes("yellow") ? "#eab308" : feature.color.includes("indigo") ? "#6366f1" : feature.color.includes("violet") ? "#a78bfa" : feature.color.includes("cyan") ? "#06b6d4" : feature.color.includes("green") ? "#22c55e" : "#ec4899"}, transparent)`
                }} />
                <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(ellipse at top left, currentColor 0%, transparent 65%)` }} />
                <Icon className={`w-8 h-8 ${feature.color} mb-4`} />
                <h3 className="text-base font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-24" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.01), rgba(10,10,15,1))" }}>
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs px-3 py-1.5 rounded-full font-medium mb-5">
              Comparison
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Why LeadPilot wins</h2>
            <p className="text-zinc-400">Purpose-built for job-signal prospecting. Not a database. Not a spreadsheet.</p>
          </motion.div>
          <motion.div
            className="max-w-3xl mx-auto rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/50"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Gradient header */}
            <div className="relative grid grid-cols-4 px-6 py-4 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-violet-500/8 to-indigo-500/5" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
              <div className="relative text-sm font-semibold text-zinc-300">Feature</div>
              <div className="relative text-sm font-bold text-indigo-300 text-center">LeadPilot</div>
              <div className="relative text-sm text-zinc-500 text-center">Apollo</div>
              <div className="relative text-sm text-zinc-500 text-center">Clay</div>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={row.feature} className={`grid grid-cols-4 px-6 py-3 border-b border-white/[0.04] last:border-0 ${i % 2 === 0 ? "bg-white/[0.015]" : ""}`}>
                <div className="text-sm text-zinc-300 pr-2">{row.feature}</div>
                <div className="flex justify-center">
                  {row.us
                    ? <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-400" /></div>
                    : <X className="w-4 h-4 text-zinc-700" />}
                </div>
                <div className="flex justify-center">
                  {row.apollo
                    ? <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500/70" /></div>
                    : <X className="w-4 h-4 text-zinc-700" />}
                </div>
                <div className="flex justify-center">
                  {row.clay
                    ? <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center"><Check className="w-3 h-3 text-emerald-500/70" /></div>
                    : <X className="w-4 h-4 text-zinc-700" />}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 container mx-auto px-6">
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs px-3 py-1.5 rounded-full font-medium mb-5">
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Simple, transparent pricing</h2>
          <p className="text-zinc-400 mb-2">BYOK saves you <span className="text-green-400 font-semibold">80%</span> on enrichment costs</p>
        </motion.div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 max-w-6xl mx-auto mt-10">
          {PRICING.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: plan.featured ? -6 : -3, transition: { duration: 0.2 } }}
            >
              {plan.featured ? (
                /* Gradient border wrap for featured */
                <div className="gradient-border-wrap">
                  <div className="relative rounded-2xl bg-[#0f0f18] p-6 h-full">
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg shadow-indigo-500/30">
                        Most Popular
                      </div>
                    </div>
                    <div className="mb-6 pt-2">
                      <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                      <div className="text-3xl font-black text-white">${plan.price}<span className="text-sm font-normal text-zinc-400">/mo</span></div>
                      <div className="text-sm text-zinc-400 mt-1">{plan.credits.toLocaleString()} credits/month</div>
                    </div>
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-zinc-200">
                          <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 text-indigo-400" />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href={plan.href}>
                      <Button className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 font-medium">
                        {plan.cta}
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 h-full hover:border-white/15 transition-colors">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                    <div className="text-3xl font-black">${plan.price}<span className="text-sm font-normal text-zinc-400">/mo</span></div>
                    <div className="text-sm text-zinc-400 mt-1">{plan.credits.toLocaleString()} credits/month</div>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                        <Check className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}>
                    <Button className="w-full border border-white/10 bg-transparent hover:bg-white/[0.05] text-zinc-300 hover:text-white transition-colors">
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        <p className="text-center text-sm text-zinc-600 mt-8">
          BYOK users save 80–90% on enrichment.{" "}
          <a href="#faq" className="text-indigo-400 hover:text-indigo-300 transition-colors">Learn more →</a>
        </p>
      </section>

      {/* Testimonials marquee */}
      <section className="py-24 overflow-hidden" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.01), transparent)" }}>
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">What customers say</h2>
            <div className="flex justify-center gap-1 mt-3">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
              <span className="text-sm text-zinc-400 ml-2">4.9/5 from 200+ reviews</span>
            </div>
          </motion.div>

          {/* Marquee testimonials */}
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#0a0a0f] to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none" />
            <div className="animate-marquee gap-5">
              {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                <div
                  key={i}
                  className="shrink-0 w-72 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 mx-2.5"
                >
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed mb-4">"{t.quote}"</p>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{t.author}</div>
                      <div className="text-[10px] text-zinc-500">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 container mx-auto px-6 max-w-3xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Frequently asked</h2>
          <p className="text-zinc-400">Everything you need to know before getting started.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border border-white/[0.07] rounded-xl px-5 bg-white/[0.02] hover:border-white/12 transition-colors"
              >
                <AccordionTrigger className="text-left text-sm font-medium text-zinc-200 hover:text-white hover:no-underline py-4 transition-colors">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-400 leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </section>

      {/* CTA section */}
      <section className="py-28 relative overflow-hidden">
        {/* Dramatic radial glow */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center 40%, rgba(99,102,241,0.18) 0%, transparent 65%)" }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:40px_40px]" />

        <motion.div
          className="container mx-auto px-6 text-center relative"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-3 py-1.5 rounded-full font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            50 credits — no credit card required
          </div>

          <h2 className="text-5xl md:text-6xl font-black mb-5 tracking-tight">Ready to fill your calendar?</h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-lg mx-auto">
            Start detecting intent signals in minutes. No setup fee, cancel anytime.
          </p>

          <div className="relative inline-flex">
            {/* Animated pulse rings */}
            <div className="absolute -inset-3 rounded-2xl border border-indigo-500/20 animate-[pulse-ring_2.5s_ease-out_infinite]" />
            <div className="absolute -inset-5 rounded-2xl border border-indigo-500/10 animate-[pulse-ring_2.5s_ease-out_infinite_0.5s]" />
            <Link href="/signup">
              <Button size="lg" className="relative bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-2xl shadow-indigo-500/40 px-12 h-14 text-lg font-semibold rounded-xl transition-all">
                Start free — no credit card
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>

          <p className="text-sm text-zinc-600 mt-8">Join 500+ growth teams already using LeadPilot</p>
          <div className="flex flex-wrap justify-center gap-5 mt-5 text-xs text-zinc-600">
            {["SOC 2 compliant", "GDPR ready", "AES-256 encrypted", "99.9% uptime SLA", "No setup fee", "Cancel anytime"].map(item => (
              <div key={item} className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-full bg-indigo-500/15 flex items-center justify-center">
                  <Check className="w-2 h-2 text-indigo-400" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-14 text-sm text-zinc-600">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-zinc-300">LeadPilot 2.0</span>
              </div>
              <p className="text-xs text-zinc-700 max-w-xs">The intent-driven B2B prospecting platform for growth teams.</p>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-zinc-600">
              <a href="#how-it-works" className="hover:text-zinc-300 transition-colors">How it works</a>
              <a href="#features" className="hover:text-zinc-300 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-zinc-300 transition-colors">FAQ</a>
              <Link href="/login" className="hover:text-zinc-300 transition-colors">Log in</Link>
              <Link href="/signup" className="hover:text-zinc-300 transition-colors">Sign up</Link>
              <a href="https://twitter.com/leadpilot" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">𝕏 Twitter</a>
              <span className="hover:text-zinc-400 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-zinc-400 cursor-pointer transition-colors">Terms</span>
            </div>
          </div>
          <div className="border-t border-white/[0.05] mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-zinc-700 text-xs">© {new Date().getFullYear()} LeadPilot, Inc. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-zinc-700">
              <span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-zinc-600" /> SOC 2 compliant</span>
              <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-zinc-600" /> GDPR ready</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
