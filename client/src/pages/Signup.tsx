import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useSignup } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowRight, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export default function SignupPage() {
  const [, navigate] = useLocation();
  const signup = useSignup();
  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>();

  const onSubmit = async (data: SignupForm) => {
    try {
      await signup.mutateAsync(data);
      navigate("/app/dashboard");
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 60%)" }} />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">LeadPilot</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-zinc-400 text-sm mt-1">50 free credits — no credit card required</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-300 text-xs">First name</Label>
                <Input
                  placeholder="Jane"
                  className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                  data-testid="input-first-name"
                  {...register("firstName", { required: "Required" })}
                />
                {errors.firstName && <p className="text-xs text-red-400 mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <Label className="text-zinc-300 text-xs">Last name</Label>
                <Input
                  placeholder="Smith"
                  className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                  data-testid="input-last-name"
                  {...register("lastName", { required: "Required" })}
                />
                {errors.lastName && <p className="text-xs text-red-400 mt-1">{errors.lastName.message}</p>}
              </div>
            </div>
            <div>
              <Label className="text-zinc-300 text-xs">Work email</Label>
              <Input
                type="email"
                placeholder="jane@company.com"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                data-testid="input-email"
                {...register("email", { required: "Email required" })}
              />
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label className="text-zinc-300 text-xs">Password</Label>
              <Input
                type="password"
                placeholder="At least 8 characters"
                className="mt-1 bg-white/5 border-white/10 text-white placeholder:text-zinc-600"
                data-testid="input-password"
                {...register("password", { required: "Password required", minLength: { value: 8, message: "Minimum 8 characters" } })}
              />
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
              loading={signup.isPending}
              data-testid="btn-signup"
            >
              Create account <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="mt-4 space-y-1.5">
            {["50 free credits to start", "No credit card required", "Cancel or downgrade anytime"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-zinc-500">
                <Check className="w-3 h-3 text-indigo-400" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
