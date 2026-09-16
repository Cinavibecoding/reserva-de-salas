import { useEffect, useState } from "react";
import { UserPlus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AdminRow = { user_id: string; email: string; full_name: string | null };

export function AdminPanel() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function cargar() {
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) {
      toast.error("No se pudo cargar la lista de admins: " + error.message);
      return;
    }
    const ids = (roles || []).map((r) => r.user_id);
    if (ids.length === 0) {
      setAdmins([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids);
    setAdmins(
      (profs || []).map((p) => ({ user_id: p.id, email: p.email, full_name: p.full_name }))
    );
  }

  useEffect(() => {
    cargar();
  }, []);

  async function agregarAdmin(e: React.FormEvent) {
    e.preventDefault();
    const correo = email.trim().toLowerCase();
    if (!correo) return;
    setLoading(true);
    try {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", correo)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) {
        toast.error(
          "No se encontró un usuario con ese correo. La persona debe crear primero una cuenta normal con su correo."
        );
        return;
      }
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.id, role: "admin" });
      if (insErr) {
        if (insErr.code === "23505") {
          toast.info("Ese usuario ya es administrador.");
        } else {
          throw insErr;
        }
      } else {
        toast.success(`${profile.email} ahora es administrador.`);
      }
      setEmail("");
      cargar();
    } catch (err: any) {
      toast.error("Error: " + (err.message || "no se pudo agregar"));
    } finally {
      setLoading(false);
    }
  }

  async function quitarAdmin(userId: string, correo: string) {
    if (!confirm(`¿Quitar permisos de administrador a ${correo}?`)) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");
    if (error) {
      toast.error("No se pudo quitar: " + error.message);
      return;
    }
    toast.success("Administrador removido.");
    cargar();
  }

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-900">
        <Shield className="h-5 w-5" /> Administradores
      </h2>
      <p className="mb-3 text-xs text-slate-600">
        Los administradores pueden aprobar/rechazar reservas. Para agregar uno nuevo, la persona
        primero debe registrarse en el sistema con su correo, y luego lo promueves aquí.
      </p>

      <form onSubmit={agregarAdmin} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@empresa.com"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <Button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-700 text-white hover:bg-blue-800"
        >
          <UserPlus className="mr-1 h-4 w-4" /> Promover a admin
        </Button>
      </form>

      <div className="space-y-2">
        {admins.length === 0 && (
          <p className="text-sm text-slate-500">No hay administradores registrados.</p>
        )}
        {admins.map((a) => (
          <div
            key={a.user_id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
          >
            <div className="text-sm">
              <div className="font-semibold">{a.email}</div>
              {a.full_name && <div className="text-xs text-slate-500">{a.full_name}</div>}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => quitarAdmin(a.user_id, a.email)}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Quitar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
