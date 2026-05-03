import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowRight, Eye, EyeOff, Zap, Shield, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [showPw, setShowPw] = useState(false);
  const login = useLogin();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      await login.mutateAsync(data);
      navigate("/app/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated mesh gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="mesh-gradient-orb absolute w-[600px] h-[600px] -top-32 -left-32 opacity-25"
          style={{ background: "radial-gradient(circle, #6366f1 0%, #4338ca 40%, transparent 70%)" }}
        />
        <div
          className="mesh-gradient-orb-2 absolute w-[500px] h-[500px] -bottom-32 -right-16 opacity-15"
          style={{ background: "radial-gradient(circle, #a78bfa 0%, #7c3aed 40%, transparent 70%)" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/">
            <div className="inline-flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">LeadPilot</span>
              <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">2.0</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-zinc-400 text-sm mt-1">Sign in to your workspace</p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="relative">
            {/* Gradient border glow on focus */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-indigo-500/20 via-violet-500/10 to-indigo-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl shadow-xl shadow-black/20">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label className="text-zinc-300 text-xs font-medium">Email address</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="mt-1.5 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-indigo-500/50 focus:bg-white/[0.06] transition-colors h-10"
                    data-testid="input-email"
                    {...register("email", { required: "Email is required" })}
                  />
                  {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-zinc-300 text-xs font-medium">Password</Label>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 pr-10 focus:border-indigo-500/50 focus:bg-white/[0.06] transition-colors h-10"
                      data-testid="input-password"
                      {...register("password", { required: "Password is required" })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
                </div>

                <div className="relative pt-1">
                  <div className="absolute inset-0 rounded-xl bg-indigo-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Button
                    type="submit"
                    className="relative w-full bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
                    loading={login.isPending}
                    data-testid="btn-login"
                  >
                    Sign in <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>

        <motion.p
          className="text-center text-sm text-zinc-500 mt-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          Don't have an account?{" "}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Start free
          </Link>
        </motion.p>

        {/* Social proof */}
        <motion.div
          className="mt-8 flex justify-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
        >
          {[
            { icon: Zap, label: "30+ job platforms" },
            { icon: Shield, label: "AES-256 encrypted" },
            { icon: Users, label: "500+ teams" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px] text-zinc-600">
              <Icon className="w-3 h-3 text-indigo-500" />
              {label}
            </div>
          ))}
        </motion.div>

        {import.meta.env.DEV && (
          <motion.div
            className="mt-4 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-xs text-zinc-600">Demo: <span className="text-zinc-400 font-mono">test@leadpilot.io</span> / <span className="text-zinc-400 font-mono">Test1234!</span></p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
