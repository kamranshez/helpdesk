import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "../lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFields = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!sessionPending && session) {
      navigate("/", { replace: true });
    }
  }, [session, sessionPending, navigate]);

  async function onSubmit(data: LoginFields) {
    const { error: signInError } = await authClient.signIn.email(data);
    if (signInError) {
      setError("root", { message: signInError.message ?? "Invalid email or password." });
    } else {
      navigate("/", { replace: true });
    }
  }

  if (sessionPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary/8 border-r border-border flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
            ❖
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>Helpdesk</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-normal text-foreground leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Support made<br />
            <em>simple.</em>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Manage support tickets, collaborate with your team, and let AI handle the repetitive work.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Helpdesk</p>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile branding */}
          <div className="lg:hidden text-center space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-1">
              ❖
            </div>
            <h1 className="text-2xl font-normal text-foreground" style={{ fontFamily: "var(--font-heading)" }}>Helpdesk</h1>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-normal text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {errors.root && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                className="h-10"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                className="h-10"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-10 mt-2">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
