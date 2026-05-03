import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 60%)" }} />
      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">LeadPilot</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-zinc-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="text-zinc-300">Email</Label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                data-testid="input-email"
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300">Password</Label>
              </div>
              <div className="relative mt-1">
                <Input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 pr-10"
                  data-testid="input-password"
                  {...register("password", { required: "Password is required" })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
              loading={login.isPending}
              data-testid="btn-login"
            >
              Sign in <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-6">
          Don't have an account?{" "}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300">
            Sign up free
          </Link>
        </p>
        {import.meta.env.DEV && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-center">
            <p className="text-xs text-zinc-600">Demo: <span className="text-zinc-400 font-mono">test@leadpilot.io</span> / <span className="text-zinc-400 font-mono">Test1234!</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
