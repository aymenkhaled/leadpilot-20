import React, { useRef, useEffect, useState, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { Link } from "wouter";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
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

// ─── CSS Globe Fallback (no WebGL needed) ─────────────────────────────────────
function CSSGlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative w-80 h-80">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-transparent border border-indigo-500/30 animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent border border-indigo-400/20 animate-[spin_15s_linear_infinite_reverse]" />
        <div className="absolute inset-8 rounded-full bg-gradient-to-br from-indigo-400/15 to-transparent border border-indigo-300/10 animate-[spin_10s_linear_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 opacity-60 blur-xl animate-pulse" />
        </div>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-indigo-400/60"
            style={{
              top: `${50 + 40 * Math.sin((i / 8) * Math.PI * 2)}%`,
              left: `${50 + 40 * Math.cos((i / 8) * Math.PI * 2)}%`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 3D Globe Component ──────────────────────────────────────────────────────
function IntentGlobe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y += 0.001;
    }
  });

  // Generate random particles on sphere surface
  const count = 150;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    positions[i * 3] = 1.6 * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = 1.6 * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = 1.6 * Math.cos(phi);
  }

  return (
    <group>
      <Stars radius={80} depth={50} count={3000} factor={3} saturation={0.5} fade speed={0.5} />

      {/* Main globe */}
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh ref={meshRef}>
          <Sphere args={[1.4, 64, 64]}>
            <MeshDistortMaterial
              color="#6366f1"
              attach="material"
              distort={0.15}
              speed={2}
              roughness={0.2}
              metalness={0.8}
              wireframe={false}
              transparent
              opacity={0.85}
            />
          </Sphere>
        </mesh>

        {/* Grid lines */}
        <mesh>
          <Sphere args={[1.42, 32, 32]}>
            <meshBasicMaterial color="#a78bfa" wireframe transparent opacity={0.15} />
          </Sphere>
        </mesh>
      </Float>

      {/* Floating particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={count}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#a78bfa" size={0.05} sizeAttenuation transparent opacity={0.8} />
      </points>

      {/* Outer glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.8, 0.02, 16, 100]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.3} />
      </mesh>
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
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -80]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold">LeadPilot</span>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">2.0</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
              Start free <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16">
        {/* Background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-radial-gradient" style={{ background: "radial-gradient(ellipse at 60% 50%, rgba(99,102,241,0.15) 0%, transparent 60%)" }} />

        <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <div className="space-y-6">
            <div>
              <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs px-3 py-1">
                <Zap className="w-3 h-3 mr-1" /> Intent-driven B2B prospecting
              </Badge>
            </div>

            <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight">
              Turn every new{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                job posting
              </span>{" "}
              into a booked meeting
            </h1>

            <p className="text-lg text-zinc-400 leading-relaxed max-w-xl">
              LeadPilot detects intent signals from 30+ job boards, enriches decision-makers with waterfall AI,
              and lets an autonomous agent draft, send, and follow up — all while you focus on closing.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 px-8">
                  Start free — no credit card
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5">
                <Play className="w-4 h-4" />
                Watch demo
              </Button>
            </div>

            <div className="flex items-center gap-6 text-sm text-zinc-500">
              {["50 free credits", "No card required", "Cancel anytime"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right: 3D Globe */}
          <div className="relative h-[500px] md:h-[600px]">
            <WebGLErrorBoundary fallback={<CSSGlobeFallback />}>
              <Suspense fallback={<div className="w-full h-full rounded-2xl bg-indigo-500/5 border border-indigo-500/10 animate-pulse" />}>
                <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
                  <ambientLight intensity={0.4} />
                  <pointLight position={[10, 10, 10]} intensity={1} color="#6366f1" />
                  <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a78bfa" />
                  <IntentGlobe />
                </Canvas>
              </Suspense>
            </WebGLErrorBoundary>
            <SignalToasts />
          </div>
        </div>
      </section>

      {/* Logo bar */}
      <section className="py-12 border-y border-white/5">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-zinc-600 mb-6">Trusted by growth teams at</p>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {["Vercel", "Linear", "Notion", "Stripe", "Figma", "Airtable"].map((brand) => (
              <div key={brand} className="text-zinc-600 font-semibold text-lg hover:text-zinc-400 transition-colors">
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento grid: features */}
      <section id="features" className="py-24 container mx-auto px-6">
        <div className="text-center mb-12">
          <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4">Features</Badge>
          <h2 className="text-4xl font-bold mb-4">Everything you need to close more deals</h2>
          <p className="text-zinc-400 max-w-xl mx-auto">From intent signal detection to autonomous outreach — the entire B2B prospecting loop in one platform.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className={`${feature.size} relative rounded-2xl border ${feature.bg} p-6 cursor-default overflow-hidden backdrop-blur-sm`}
              >
                <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at top left, ${feature.color.replace("text-", "").replace("-400", "")} 0%, transparent 70%)` }} />
                <Icon className={`w-8 h-8 ${feature.color} mb-4`} />
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-24 bg-white/2">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <Badge className="bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-4">Comparison</Badge>
            <h2 className="text-4xl font-bold mb-4">Why LeadPilot wins</h2>
          </div>
          <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-4 bg-white/5 px-6 py-4">
              <div className="text-sm font-semibold text-zinc-300">Feature</div>
              <div className="text-sm font-bold text-indigo-400 text-center">LeadPilot</div>
              <div className="text-sm text-zinc-500 text-center">Apollo</div>
              <div className="text-sm text-zinc-500 text-center">Clay</div>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={row.feature} className={`grid grid-cols-4 px-6 py-3 ${i % 2 === 0 ? "bg-white/2" : ""}`}>
                <div className="text-sm text-zinc-300">{row.feature}</div>
                <div className="flex justify-center">{row.us ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-zinc-600" />}</div>
                <div className="flex justify-center">{row.apollo ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-zinc-600" />}</div>
                <div className="flex justify-center">{row.clay ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-zinc-600" />}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 container mx-auto px-6">
        <div className="text-center mb-4">
          <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 mb-4">Pricing</Badge>
          <h2 className="text-4xl font-bold mb-4">Simple, transparent pricing</h2>
          <p className="text-zinc-400 mb-2">BYOK saves you 80% on enrichment costs</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-10">
          {PRICING.map((plan) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`rounded-2xl border p-6 relative ${plan.featured ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_60px_rgba(99,102,241,0.2)]" : "border-white/10 bg-white/3"}`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-600 text-white text-xs px-3 py-1">Most Popular</Badge>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <div className="text-3xl font-black">${plan.price}<span className="text-sm font-normal text-zinc-400">/mo</span></div>
                <div className="text-sm text-zinc-400 mt-1">{plan.credits.toLocaleString()} credits/month</div>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.href}>
                <Button className={`w-full ${plan.featured ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "border border-white/10 bg-transparent hover:bg-white/5 text-white"}`}>
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-sm text-zinc-500 mt-6">BYOK users save 80–90% on enrichment. <a href="#faq" className="text-indigo-400 hover:underline">Learn more →</a></p>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white/2">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">What customers say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TESTIMONIALS.map((t) => (
              <motion.div
                key={t.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-white/10 bg-white/3 p-6"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.author}</div>
                    <div className="text-xs text-zinc-500">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 container mx-auto px-6 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Frequently asked questions</h2>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border border-white/10 rounded-xl px-4">
              <AccordionTrigger className="text-left text-sm font-medium text-zinc-200 hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-zinc-400 leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA footer */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.2) 0%, transparent 70%)" }} />
        <div className="container mx-auto px-6 text-center relative">
          <h2 className="text-5xl font-black mb-4">Ready to fill your calendar?</h2>
          <p className="text-zinc-400 text-lg mb-8 max-w-xl mx-auto">
            50 free credits. No credit card. Start detecting intent signals in minutes.
          </p>
          <Link href="/signup">
            <Button size="xl" className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl shadow-indigo-500/30 px-12 h-14 text-lg font-semibold rounded-xl">
              Start free — no credit card
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <p className="text-sm text-zinc-600 mt-4">Join 500+ growth teams already using LeadPilot</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-sm text-zinc-600">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center">
            <Target className="w-3 h-3 text-white" />
          </div>
          <span className="font-semibold text-zinc-400">LeadPilot 2.0</span>
        </div>
        <p>© 2026 LeadPilot. All rights reserved.</p>
      </footer>
    </div>
  );
}
