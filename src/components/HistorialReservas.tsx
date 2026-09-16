import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, History, Search, X } from "lucide-react";
import { toast } from "sonner";

type ReservaHistorial = {
  id: string;
  sala_nombre: string;
  piso_externo: string | null;
  ubicacion: string;
  fecha: string;
  inicio: string;
  fin: string;
  solicitante: string;
  numero_bc: string;
  telefono_banco: string;
  correo_solicitante: string;
  actividad: string;
  motivo: string;
  aforo: number;
  estado: "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
  created_at: string;
};

type Filtro = "todas" | "aprobada" | "rechazada";

function descargarHistorialCSV(rows: ReservaHistorial[], emails: Record<string, string>) {
  const headers = [
    "Estado", "Fecha", "HoraInicio", "HoraFin", "Sala", "Piso/Ubicacion",
    "Solicitante", "NumeroBC", "Telefono", "Correo", "Actividad", "Motivo",
    "Aforo", "MotivoRechazo", "RevisadoPor", "RevisadoEn", "FechaCreacion",
  ];
  const data = rows.map((r) => [
    r.estado, r.fecha, r.inicio?.slice(0, 5), r.fin?.slice(0, 5),
    r.sala_nombre, r.piso_externo ? `Piso ${r.piso_externo}` : r.ubicacion,
    r.solicitante, r.numero_bc, r.telefono_banco, r.correo_solicitante,
    r.actividad, r.motivo, r.aforo, r.motivo_rechazo || "",
    r.revisado_por ? emails[r.revisado_por] || r.revisado_por : "",
    r.revisado_en || "", r.created_at,
  ]);
  const csv = [headers, ...data]
    .map((row) => row.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const today = new Date().toISOString().slice(0, 10);
  link.download = `historial-reservas-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function HistorialReservas() {
  const [rows, setRows] = useState<ReservaHistorial[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .in("estado", ["aprobada", "rechazada"])
      .order("revisado_en", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      setLoading(false);
      toast.error("Error cargando historial: " + error.message);
      return;
    }
    const list = (data || []) as ReservaHistorial[];
    setRows(list);

    const ids = Array.from(
      new Set(list.map((r) => r.revisado_por).filter((v): v is string => !!v))
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email")
        .in("id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p) => { map[p.id] = p.email; });
      setEmails(map);
    } else {
      setEmails({});
    }
    setLoading(false);
  }

  useEffect(() => {
    cargar();
    const channel = supabase
      .channel("historial-reservas-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas" },
        () => cargar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtro !== "todas" && r.estado !== filtro) return false;
      if (desde && r.fecha < desde) return false;
      if (hasta && r.fecha > hasta) return false;
      if (q) {
        const texto = `${r.sala_nombre} ${r.solicitante} ${r.numero_bc} ${r.correo_solicitante} ${r.actividad} ${r.motivo} ${r.motivo_rechazo || ""}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filtro, busqueda, desde, hasta]);

  const totales = useMemo(() => ({
    total: filtradas.length,
    aprobadas: filtradas.filter((r) => r.estado === "aprobada").length,
    rechazadas: filtradas.filter((r) => r.estado === "rechazada").length,
  }), [filtradas]);

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <History className="h-5 w-5" /> Historial de reservaciones
          </h2>
          <p className="text-xs text-slate-500">
            Registro completo de solicitudes aprobadas y rechazadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {totales.total} en total
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            {totales.aprobadas} aprobadas
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            {totales.rechazadas} rechazadas
          </span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => descargarHistorialCSV(filtradas, emails)}
            disabled={filtradas.length === 0}
          >
            <Download className="mr-1 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(["todas", "aprobada", "rechazada"] as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filtro === f
                  ? "bg-white text-slate-900 shadow"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {f === "todas" ? "Todas" : f === "aprobada" ? "Aprobadas" : "Rechazadas"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por solicitante, sala, actividad..."
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <label className="flex flex-col text-xs text-slate-500">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-500">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
          />
        </label>
        {(busqueda || desde || hasta || filtro !== "todas") && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl"
            onClick={() => { setBusqueda(""); setDesde(""); setHasta(""); setFiltro("todas"); }}
          >
            Limpiar
          </Button>
        )}
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">Cargando historial...</p>
      ) : filtradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No hay reservaciones que coincidan con los filtros.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Fecha / Hora</th>
                <th className="py-2 pr-3">Sala</th>
                <th className="py-2 pr-3">Solicitante</th>
                <th className="py-2 pr-3">Actividad</th>
                <th className="py-2 pr-3">Revisado por</th>
                <th className="py-2 pr-3">Motivo rechazo</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id} className="border-b align-top last:border-0 hover:bg-slate-50">
                  <td className="py-2 pr-3">
                    {r.estado === "aprobada" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Aprobada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        <X className="h-3 w-3" /> Rechazada
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-700">
                    <div className="font-medium">{r.fecha}</div>
                    <div className="text-xs text-slate-500">{r.inicio?.slice(0, 5)} - {r.fin?.slice(0, 5)}</div>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">
                    <div className="font-medium">{r.sala_nombre}</div>
                    <div className="text-xs text-slate-500">
                      {r.piso_externo ? `Piso ${r.piso_externo}` : r.ubicacion}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">
                    <div className="font-medium">{r.solicitante}</div>
                    <div className="text-xs text-slate-500">BC {r.numero_bc}</div>
                    <div className="text-xs text-slate-500">{r.correo_solicitante}</div>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">
                    <div className="font-medium">{r.actividad}</div>
                    <div className="text-xs text-slate-500">{r.motivo}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600">
                    {r.revisado_por ? (
                      <>
                        <div className="font-medium text-slate-700">
                          {emails[r.revisado_por] || "Administrador"}
                        </div>
                        {r.revisado_en && (
                          <div className="text-slate-500">
                            {new Date(r.revisado_en).toLocaleString()}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-600">
                    {r.estado === "rechazada"
                      ? r.motivo_rechazo || <span className="text-slate-400">Sin motivo</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
