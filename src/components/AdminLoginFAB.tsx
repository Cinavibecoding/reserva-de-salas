import { useState, type FormEvent } from "react";
import { Shield, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function AdminLoginFAB() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // El listener de useAuth verificará el rol; si no es admin, cerramos sesión.
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", u.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!roleData) {
          await supabase.auth.signOut();
          toast.error("Esta cuenta no tiene permisos de administrador.");
          return;
        }
      }
      toast.success("Sesión de administrador iniciada.");
      setOpen(false);
      setEmail("");
      setPassword("");
    } catch (err: any) {
      toast.error(err.message || "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  // Si ya está logueado como admin, mostrar botón de cerrar sesión
  if (user && isAdmin) {
    return (
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 shadow-lg">
        <Shield className="h-4 w-4 text-blue-700" />
        <span className="text-xs font-semibold text-blue-900">Admin: {user.email}</span>
        <Button size="sm" variant="ghost" className="h-7 rounded-lg px-2" onClick={signOut}>
          <LogOut className="mr-1 h-3 w-3" /> Salir
        </Button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg transition hover:bg-slate-50"
        aria-label="Inicio de sesión administrador"
      >
        <Shield className="h-4 w-4 text-blue-700" />
        Inicio de sesión
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Shield className="h-5 w-5 text-blue-700" /> Acceso administrador
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Solo para correos autorizados como administrador.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleLogin} className="space-y-4 p-5">
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
              <Button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-blue-700 hover:bg-blue-800"
              >
                {submitting ? "Entrando..." : "Entrar"}
              </Button>
              <p className="text-center text-xs text-slate-400">
                Si necesitas ser administrador, contacta al administrador actual.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
