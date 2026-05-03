import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useSignup } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowRight, Check, Eye, EyeOff, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (!pw) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Weak", color: "bg-red-500" };
  if (score <= 3) return { level: 2, label: "Fair", color: "bg-yellow-500" };
  return { level: 3, label: "Strong", color: "bg-green-500" };
}

export default function SignupPage() {
  const [, navigate] = useLocation();
  const signup = useSignup();
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>();
  const strength = getPasswordStrength(pw);

  const onSubmit = async (data: SignupForm) => {
    try {
      await signup.mutateAsync(data);
      navigate("/app/dashboard");
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Animated mesh gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="mesh-gradient-orb absolute w-[700px] h-[700px] -top-48 -right-48 opacity-20"
          style={{ background: "radial-gradient(circle, #6366f1 0%, #4338ca 40%, transparent 70%)" }}
        />
        <div
          className="mesh-gradient-orb-2 absolute w-[500px] h-[500px] -bottom-32 -left-32 opacity-15"
          style={{ background: "radial-gradient(circle, #a78bfa 0%, #7c3aed 40%, transparent 70%)" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo + headline */}
        <motion.div
          className="text-center mb-7"
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
          <h1 className="text-2xl font-bold text-white">Start prospecting smarter</h1>
          <p className="text-zinc-400 text-sm mt-1">50 free credits — no credit card required</p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl shadow-xl shadow-black/20">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-zinc-300 text-xs font-medium">First name</Label>
                  <Input
                    autoComplete="given-name"
                    placeholder="Jane"
                    className="mt-1.5 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-indigo-500/50 h-10 transition-colors"
                    data-testid="input-first-name"
                    {...register("firstName", { required: "Required" })}
                  />
                  {errors.firstName && <p className="text-xs text-red-400 mt-1">{errors.firstName.message}</p>}
                </div>
                <div>
                  <Label className="text-zinc-300 text-xs font-medium">Last name</Label>
                  <Input
                    autoComplete="family-name"
                    placeholder="Smith"
                    className="mt-1.5 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-indigo-500/50 h-10 transition-colors"
                    data-testid="input-last-name"
                    {...register("lastName", { required: "Required" })}
                  />
                  {errors.lastName && <p className="text-xs text-red-400 mt-1">{errors.lastName.message}</p>}
                </div>
              </div>

              <div>
                <Label className="text-zinc-300 text-xs font-medium">Work email</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="jane@company.com"
                  className="mt-1.5 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-indigo-500/50 h-10 transition-colors"
                  data-testid="input-email"
                  {...register("email", { required: "Email required" })}
                />
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <Label className="text-zinc-300 text-xs font-medium">Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 pr-10 focus:border-indigo-500/50 h-10 transition-colors"
                    data-testid="input-password"
                    {...register("password", {
                      required: "Password required",
                      minLength: { value: 8, message: "Minimum 8 characters" },
                      onChange: (e) => setPw(e.target.value),
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pw && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map(l => (
                        <div key={l} className={`h-1 flex-1 rounded-full transition-colors ${strength.level >= l ? strength.color : "bg-white/10"}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-zinc-500">{strength.label}</span>
                  </div>
                )}
                {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-10 font-medium shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all mt-1"
                loading={signup.isPending}
                data-testid="btn-signup"
              >
                Create free account <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            {/* Perks below button */}
            <div className="mt-5 pt-4 border-t border-white/[0.06] grid grid-cols-1 gap-1.5">
              {[
                "50 free credits to start",
                "No credit card required",
                "Cancel or downgrade anytime",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-zinc-500">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-indigo-400" />
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.p
          className="text-center text-sm text-zinc-500 mt-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Sign in
          </Link>
        </motion.p>

        {/* Social proof */}
        <motion.div
          className="mt-6 flex items-center justify-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <div className="flex -space-x-1.5">
            {["SK", "MT", "PM", "JR"].map((av) => (
              <div key={av} className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 border border-[#0a0a0f] flex items-center justify-center text-[8px] font-bold text-white">
                {av}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}
          </div>
          <p className="text-xs text-zinc-600 ml-1">500+ growth teams</p>
        </motion.div>
      </div>
    </div>
  );
}
