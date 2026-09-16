import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/reservas`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Iniciando sesión...");
        navigate({ to: "/reservas" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/reservas" });
      }
    } catch (err: any) {
      toast.error(err.message || "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-700" />
          <span className="text-lg font-semibold">Reserva de Salas</span>
        </div>
        <h1 className="mb-1 text-2xl font-bold">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {mode === "login" ? "Accede al sistema de reservas." : "Regístrate con tu correo del banco."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Nombre completo</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
              />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>

          <Button type="submit" disabled={loading} className="w-full rounded-2xl bg-blue-700 hover:bg-blue-800">
            {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-sm text-blue-700 hover:underline"
        >
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">
          La primera cuenta creada será administrador.
        </p>
      </div>
    </div>
  );
}
