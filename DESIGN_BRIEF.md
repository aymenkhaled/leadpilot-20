# LeadPilot 2.0 — Design Brief for Replit Agent

Use this document to recreate the exact UI/UX design system of this app in any new project. Paste this entire file as your starting prompt or reference.

---

## Overview

Dark, premium SaaS dashboard aesthetic. Deep near-black backgrounds with indigo/violet as the sole accent colour family. Dense, data-rich layouts with glassmorphism cards, soft glows, and subtle animations. The visual language is calm, technical, and trustworthy — think Linear meets Vercel.

---

## Tech Stack (exact)

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** with `tailwindcss-animate` plugin
- **shadcn/ui** component primitives (Radix UI under the hood)
- **Framer Motion** — page/element animations
- **@react-three/fiber + @react-three/drei + three.js** — 3D hero visuals on landing
- **TanStack Query v5** — server state
- **Wouter** — client-side routing
- **lucide-react** — all icons
- **Recharts** — charts/graphs
- **Inter** — sole typeface (Google Fonts or system fallback)

---

## CSS Variables (copy verbatim into `index.css`)

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 239 84% 67%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 239 84% 67%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 240 6% 6%;        /* #0a0a0f */
    --foreground: 0 0% 98%;
    --card: 240 6% 9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 6% 9%;
    --popover-foreground: 0 0% 98%;
    --primary: 239 84% 67%;         /* indigo-500 #6366f1 */
    --primary-foreground: 0 0% 100%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 239 84% 67%;
  }
}
```

### Global utility classes (add to `index.css`)

```css
/* Glass morphism */
.glass {
  @apply bg-white/5 backdrop-blur-xl border border-white/10;
}

/* Glow */
.glow-indigo { box-shadow: 0 0 60px rgba(99, 102, 241, 0.4); }
.glow-violet { box-shadow: 0 0 60px rgba(167, 139, 250, 0.4); }

/* Gradient text */
.gradient-text {
  @apply bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent;
}

/* Noise overlay (landing page texture) */
.noise {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { @apply bg-transparent; }
::-webkit-scrollbar-thumb { @apply bg-border rounded-full; }
::-webkit-scrollbar-thumb:hover { @apply bg-muted-foreground/50; }
```

---

## Tailwind Config Extensions (copy into `tailwind.config.ts`)

```ts
colors: {
  // shadcn semantic tokens (already above via CSS vars)
  indigo: {
    50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc",
    400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca",
    800: "#3730a3", 900: "#312e81",
  },
  violet: { 400: "#a78bfa", 500: "#8b5cf6" },
},
fontFamily: {
  sans: ["Inter", "system-ui", "sans-serif"],
  display: ["Inter", "system-ui", "sans-serif"],
},
keyframes: {
  "fade-in": {
    from: { opacity: "0", transform: "translateY(10px)" },
    to:   { opacity: "1", transform: "translateY(0)" },
  },
  float: {
    "0%, 100%": { transform: "translateY(0px)" },
    "50%":       { transform: "translateY(-20px)" },
  },
  glow: {
    "0%, 100%": { boxShadow: "0 0 20px rgba(99,102,241,0.3)" },
    "50%":       { boxShadow: "0 0 60px rgba(99,102,241,0.6)" },
  },
  "spin-slow": {
    from: { transform: "rotate(0deg)" },
    to:   { transform: "rotate(360deg)" },
  },
},
animation: {
  "fade-in":  "fade-in 0.5s ease-out forwards",
  float:      "float 6s ease-in-out infinite",
  glow:       "glow 3s ease-in-out infinite",
  "spin-slow":"spin-slow 20s linear infinite",
},
```

---

## Colour Usage Rules

| Use case | Class pattern |
|---|---|
| Primary action button | `bg-indigo-600 hover:bg-indigo-500 text-white` |
| Ghost/outline button | `border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10` |
| Active nav item | `bg-indigo-600/15 text-indigo-400` |
| Stat card icon | `bg-indigo-500/10 text-indigo-400` (or swap colour family) |
| Badge — plan/status | `bg-indigo-500/20 text-indigo-400` (vary: violet, yellow, green, red, zinc) |
| Card background | `bg-card/50 border-border/50` |
| Card hover border | `hover:border-indigo-500/30` |
| Page background | `bg-background` (mapped to `#0a0a0f` in dark) |
| Muted label | `text-muted-foreground` (maps to zinc-ish ~64% lightness) |
| Danger/low | `bg-red-500/5 border-red-500/20 text-red-400` |
| Success/good | `bg-green-500/10 text-green-400` |
| Warning | `bg-yellow-500/10 text-yellow-400` |
| Info/blue | `bg-blue-500/10 text-blue-400` |

---

## Typography Scale

| Element | Classes |
|---|---|
| Page title (h1) | `text-2xl font-bold` |
| Section heading | `text-lg font-semibold` |
| Card title | `text-sm font-semibold` |
| Body / labels | `text-sm` |
| Secondary / meta | `text-xs text-muted-foreground` |
| Micro / badges | `text-[10px] font-medium` |
| Gradient hero headline | `.gradient-text` on `text-4xl md:text-6xl font-bold` |

---

## Component Patterns

### Card
```tsx
<Card className="bg-card/50 border-border/50 hover:border-indigo-500/30 transition-colors">
  <CardContent className="p-5">…</CardContent>
</Card>
```

### Stat Card
```tsx
<Card className="bg-card/50 border-border/50 hover:border-indigo-500/30 transition-colors">
  <CardContent className="p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
    </div>
  </CardContent>
</Card>
```

### Glass Auth/Form Panel
```tsx
<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
  <div className="absolute inset-0"
    style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 60%)" }} />
  <div className="relative w-full max-w-sm">
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
      {/* form content */}
    </div>
  </div>
</div>
```

### Input (dark context)
```tsx
<Input className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600" />
```

### Badge variants
```tsx
/* Plan badges */
free:    "bg-zinc-500/20 text-zinc-400"
pro:     "bg-indigo-500/20 text-indigo-400"
agency:  "bg-violet-500/20 text-violet-400"
scale:   "bg-yellow-500/20 text-yellow-400"
```

### Button variants (extend CVA definition)
```ts
indigo:         "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 shadow-indigo-500/25"
"indigo-outline":"border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
```

### Progress / Credits bar
```tsx
<div className="w-full h-1.5 rounded-full bg-border mt-2">
  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
</div>
```

---

## App Shell Layout

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (w-56 expanded / w-16 collapsed)            │
│  ┌────┐  ┌──────────────────────────────────────┐   │
│  │Logo│  │  Main content (flex-1, overflow scroll)│   │
│  ├────┤  │  p-6 space-y-6 max-w-7xl mx-auto     │   │
│  │Nav │  │                                      │   │
│  │    │  │                                      │   │
│  ├────┤  │                                      │   │
│  │$   │  │                                      │   │
│  ├────┤  │                                      │   │
│  │User│  └──────────────────────────────────────┘   │
│  └────┘                                              │
└──────────────────────────────────────────────────────┘
```

- **Sidebar**: `flex flex-col h-full border-r border-border bg-card/50`
- **Logo area**: `h-14 px-4 border-b border-border` — `w-7 h-7 rounded-lg bg-indigo-600` icon
- **Nav items**: `px-2.5 py-2 rounded-lg text-sm` — active: `bg-indigo-600/15 text-indigo-400`
- **Credits widget**: `rounded-lg border p-3 bg-indigo-500/5 border-indigo-500/10`
- **Collapse toggle**: `w-6 h-6 rounded-full bg-card border border-border` floating button at `-right-3 top-16`
- **Main area**: `flex-1 flex flex-col overflow-hidden` → `ScrollArea` → `<main>`

---

## Landing Page Structure

```
Hero (full-screen dark, 3D orb right, headline left)
  ↓
Feature highlights (3-col grid cards)
  ↓
How it works (numbered steps)
  ↓
Social proof / testimonials
  ↓
Pricing (3-tier cards, middle tier highlighted with indigo border + glow)
  ↓
FAQ (Accordion)
  ↓
CTA banner
  ↓
Footer
```

### Hero section pattern
- Background: `bg-[#0a0a0f]` with radial indigo glow at top: `radial-gradient(ellipse at 60% -20%, rgba(99,102,241,0.15) 0%, transparent 50%)`
- `.noise` overlay for texture
- Left: animated headline, sub-copy, two CTAs, social proof row
- Right: `@react-three/fiber` Canvas with pulsing distorted sphere + orbiting signal nodes; falls back to pure CSS rings + orb when WebGL unavailable
- Headline: `text-4xl md:text-6xl font-bold` with `.gradient-text` on the key word

### 3D hero orb (React Three Fiber)
```tsx
<Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
  <ambientLight intensity={0.4} />
  <pointLight position={[5, 5, 5]} intensity={1} color="#6366f1" />
  <Float speed={2} rotationIntensity={0.5} floatIntensity={0.8}>
    <Sphere args={[1.2, 64, 64]}>
      <MeshDistortMaterial
        color="#6366f1" distort={0.4} speed={2}
        metalness={0.8} roughness={0.2}
        emissive="#4f46e5" emissiveIntensity={0.3}
      />
    </Sphere>
  </Float>
  <Stars radius={80} depth={50} count={3000} factor={3} saturation={0} fade />
</Canvas>
```

### CSS fallback (no WebGL)
- Three concentric spinning rings: `border border-indigo-500/20 animate-[spin_22s_linear_infinite]`
- Central orb: `bg-gradient-to-br from-indigo-500 to-violet-600` with `box-shadow: 0 0 60px 20px rgba(99,102,241,0.35)`
- 6 orbiting signal node pills at fixed angles, each with a unique colour, `animate-pulse` dot

### Pricing cards
```tsx
/* Standard tier */
<div className="rounded-2xl border border-border/50 bg-card/50 p-8">

/* Highlighted/popular tier */
<div className="rounded-2xl border-2 border-indigo-500 bg-indigo-500/5 p-8"
  style={{ boxShadow: "0 0 40px rgba(99,102,241,0.2)" }}>
  <div className="text-[10px] font-bold text-indigo-400 tracking-widest uppercase mb-2">Most Popular</div>
```

---

## Animation Conventions

- **Page sections**: `framer-motion` `initial={{ opacity:0, y:20 }}` → `whileInView={{ opacity:1, y:0 }}` with `viewport={{ once:true }}`
- **Staggered children**: `transition={{ delay: index * 0.1 }}`
- **Hover cards**: `whileHover={{ y: -2 }}`
- **Loading skeletons**: shadcn `<Skeleton className="h-4 w-24" />`
- **Data entry rows**: `animate-fade-in` custom keyframe

---

## Icon Usage

All icons from `lucide-react`. Sizing conventions:
- Sidebar nav: `w-4 h-4`
- Stat card: `w-4 h-4` inside `w-9 h-9` container
- Button inline: auto-sized via `[&_svg]:size-4` in CVA
- Hero feature icons: `w-5 h-5` or `w-6 h-6`

---

## Spacing & Sizing Conventions

| Token | Value |
|---|---|
| Page padding | `p-6` |
| Section gap | `space-y-6` |
| Card padding | `p-5` |
| Grid gap | `gap-4` or `gap-6` |
| Content max-width | `max-w-7xl mx-auto` |
| Border radius | `rounded-lg` (0.75rem) / `rounded-xl` / `rounded-2xl` for panels |
| Sidebar expanded | `w-56` |
| Sidebar collapsed | `w-16` |
| Header height | `h-14` |

---

## Dark Mode

Always apply the `dark` class on `<html>`. The entire app runs in dark mode only. Do not implement a light/dark toggle unless explicitly requested.

```tsx
// in index.html or root component effect
document.documentElement.classList.add("dark");
```

---

## Do / Don't

**Do:**
- Use `bg-card/50` not `bg-card` for most surfaces (subtle transparency)
- Use `/10`, `/15`, `/20` opacity suffixes for coloured backgrounds
- Keep text hierarchy tight: bold number, xs muted label, xs muted sub-text
- Add `transition-colors` to anything interactive
- Wrap 3D Canvas in a WebGL error boundary with a CSS fallback

**Don't:**
- Use white backgrounds anywhere in the app UI
- Use green as a primary colour (reserve for success states only)
- Use `font-size` larger than `text-2xl` inside cards
- Add drop shadows to cards (use border + slight bg instead)
- Animate layout-affecting properties (use `opacity` + `transform` only)
