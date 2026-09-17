import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Mail,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  AlertTriangle,
  Phone,
  Hash,
  Armchair,
  Table2,
  LayoutTemplate,
  MapPin,
  Monitor,
  Wifi,
  Volume2,
  ClipboardList,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AdminPanel } from "@/components/AdminPanel";
import { HistorialReservas } from "@/components/HistorialReservas";

export const Route = createFileRoute("/reservas")({
  component: ReservasPage,
});

const CONFIG = {
  nombreBanco: "Banco",
  tituloSistema: "Reserva de Salas",
  horarioInicio: 7,
  horarioFin: 19,
  duracionMaximaHoras: 8,
};

type Sala = {
  id: string;
  nombre: string;
  ubicacion: string;
  capacidad: number;
  requierePiso: boolean;
};

const SALAS: Sala[] = [
  { id: "sala-3", nombre: "Sala 3", ubicacion: "Piso 5", capacidad: 35, requierePiso: false },
  { id: "sala-6", nombre: "Sala 6", ubicacion: "Piso 5", capacidad: 28, requierePiso: false },
  { id: "sala-9", nombre: "Sala 9", ubicacion: "Piso 5", capacidad: 16, requierePiso: false },
  { id: "sala-12", nombre: "Sala 12", ubicacion: "Piso 5", capacidad: 14, requierePiso: false },
  { id: "sala-satelite", nombre: "Sala satélite", ubicacion: "Pisos 14 al 22", capacidad: 6, requierePiso: true },
];

const PISOS_EXTERNOS = [14, 15, 16, 17, 18, 19, 20, 21, 22];

const ACOMODOS_SALA = [
  "Auditorio",
  "Auditorio con pasillo central",
  "Teatro",
  "Escuela / Capacitación",
  "Mesa en U",
  "Mesa imperial",
  "Mesas redondas",
  "Consultorio / entrevista",
  "Sala libre de mesas y sillas",
  "Semicírculo",
  "Otro",
];

const REQUERIMIENTOS_TECNICOS = [
  { key: "wifi" as const, label: "WiFi", icon: Wifi },
  { key: "tv" as const, label: "TV / pantalla", icon: Monitor },
  { key: "sonido" as const, label: "Sonido / corneta", icon: Volume2 },
  { key: "pizarra" as const, label: "Pizarra / rotafolio", icon: ClipboardList },
];

type Reserva = {
  id: string;
  user_id: string | null;
  sala_id: string;
  sala_nombre: string;
  piso_externo: string;
  ubicacion: string;
  capacidad: number | null;
  fecha: string;
  inicio: string;
  fin: string;
  solicitante: string;
  numero_bc: string;
  telefono_banco: string;
  correo_solicitante: string;
  responsable_actividad: string;
  actividad: string;
  motivo: string;
  aforo: number;
  acomodo_sala: string;
  cantidad_mesas: number;
  cantidad_sillas: number;
  detalle_acomodo: string;
  req_wifi: boolean;
  req_tv: boolean;
  req_sonido: boolean;
  req_pizarra: boolean;
  req_atril: boolean;
  otros_requerimientos: string;
  comentarios: string;
  correos_notificados: string[];
  created_at: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
};

function generarHoras() {
  const horas: string[] = [];
  for (let h = CONFIG.horarioInicio; h < CONFIG.horarioFin; h += 1) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
  }
  return horas;
}

function fechaHoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function addHours(time: string, amount: number) {
  const total = timeToMinutes(time) + Number(amount) * 60;
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}:00`;
}

function normalizeTime(t: string) {
  // Postgres returns "HH:MM:SS"; ensure HH:MM for compare
  return t.length >= 5 ? `${t.slice(0, 5)}:00` : `${t}:00`;
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

function soloDigitos(valor: string) {
  return String(valor || "").replace(/\D/g, "");
}

function validarBC(bc: string) {
  return /^\d{4,6}$/.test(String(bc || "").trim());
}

function validarTelefonoBanco(telefono: string) {
  const digits = soloDigitos(telefono);
  return digits.length >= 3 && digits.length <= 15;
}

function descargarCSV(reservas: Reserva[]) {
  const headers = [
    "ID", "Fecha", "Sala", "PisoSalaExterna", "Ubicacion", "HoraInicio", "HoraFin",
    "Solicitante", "NumeroBC", "TelefonoBanco", "CorreoSolicitante", "ResponsableActividad",
    "Actividad", "Motivo", "Aforo", "AcomodoSala", "CantidadMesas", "CantidadSillas",
    "DetalleAcomodo", "WiFi", "TV", "Sonido", "Pizarra",
    "OtrosRequerimientos", "Comentarios", "FechaCreacion",
  ];
  const rows = reservas.map((r) => [
    r.id, r.fecha, r.sala_nombre, r.piso_externo || "", r.ubicacion, r.inicio, r.fin,
    r.solicitante, r.numero_bc, r.telefono_banco, r.correo_solicitante, r.responsable_actividad,
    r.actividad, r.motivo, r.aforo, r.acomodo_sala, r.cantidad_mesas, r.cantidad_sillas,
    r.detalle_acomodo,
    r.req_wifi ? "Sí" : "No", r.req_tv ? "Sí" : "No", r.req_sonido ? "Sí" : "No",
    r.req_pizarra ? "Sí" : "No",
    r.otros_requerimientos, r.comentarios, r.created_at,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reservas-salas-${fechaHoyISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReservasPage() {
  const { user, isAdmin } = useAuth();
  const horas = useMemo(() => generarHoras(), []);
  const [fecha, setFecha] = useState(fechaHoyISO());
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "pendiente" | "aprobada" | "rechazada">("todas");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [slotSeleccionado, setSlotSeleccionado] = useState<{ sala: Sala; hora: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [rechazoModal, setRechazoModal] = useState<{ id: string; sala: string } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [pendientesGlobal, setPendientesGlobal] = useState<Reserva[]>([]);

  const [form, setForm] = useState({
    solicitante: "",
    numeroBC: "",
    telefonoBanco: "",
    correoSolicitante: "",
    responsableActividad: "",
    actividad: "",
    motivo: "",
    aforo: "",
    pisoExterno: "3",
    duracion: 1,
    acomodoSala: ACOMODOS_SALA[0],
    cantidadMesas: 0,
    cantidadSillas: 0,
    detalleAcomodo: "",
    requerimientosTecnicos: { wifi: false, tv: false, sonido: false, pizarra: false },
    otrosRequerimientos: "",
    comentarios: "",
  });

  async function cargarReservas() {
    setLoadingList(true);
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("fecha", fecha)
      .order("inicio");
    setLoadingList(false);
    if (error) {
      toast.error("Error cargando reservas: " + error.message);
      return;
    }
    setReservas((data || []) as Reserva[]);
  }

  async function cargarPendientesGlobal() {
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("estado", "pendiente")
      .order("fecha")
      .order("inicio");
    if (!error) setPendientesGlobal((data || []) as Reserva[]);
  }

  useEffect(() => {
    cargarReservas();
    cargarPendientesGlobal();
    const channel = supabase
      .channel("reservas-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => {
        cargarReservas();
        cargarPendientesGlobal();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const reservasFiltradas = useMemo(() => {
    return reservas.filter((r) => {
      const texto = `${r.sala_nombre} piso ${r.piso_externo || ""} ${r.solicitante} ${r.numero_bc} ${r.telefono_banco} ${r.correo_solicitante} ${r.responsable_actividad} ${r.actividad} ${r.motivo} ${r.acomodo_sala} ${r.comentarios}`.toLowerCase();
      const coincideTexto = texto.includes(busqueda.toLowerCase());
      const coincideEstado = filtroEstado === "todas" || r.estado === filtroEstado;
      return coincideTexto && coincideEstado;
    });
  }, [reservas, busqueda, filtroEstado]);

  const reservasPendientes = useMemo(
    () => reservas.filter((r) => r.estado === "pendiente"),
    [reservas]
  );

  const resumen = useMemo(() => {
    const totalHoras = reservas.reduce((acc, r) => acc + (timeToMinutes(r.fin) - timeToMinutes(r.inicio)) / 60, 0);
    const totalMesas = reservas.reduce((acc, r) => acc + Number(r.cantidad_mesas || 0), 0);
    const totalSillas = reservas.reduce((acc, r) => acc + Number(r.cantidad_sillas || 0), 0);
    const totalAforo = reservas.reduce((acc, r) => acc + Number(r.aforo || 0), 0);
    return { total: reservas.length, totalHoras, totalMesas, totalSillas, totalAforo };
  }, [reservas]);

  function mismaSalaReserva(r: Reserva, sala: Sala, pisoExterno: string | null) {
    if (r.sala_id !== sala.id) return false;
    if (sala.requierePiso) return String(r.piso_externo) === String(pisoExterno);
    return true;
  }

  function reservasParaCelda(sala: Sala, hora: string) {
    const fin = addHours(hora, 1);
    // Solo las reservas APROBADAS ocupan la celda; pendientes y rechazadas no bloquean.
    return reservas.filter(
      (r) => r.sala_id === sala.id && r.estado === "aprobada" && overlaps(hora, fin, r.inicio, r.fin)
    );
  }

  function resetForm(sala: Sala) {
    setForm({
      solicitante: "",
      numeroBC: "",
      telefonoBanco: "",
      correoSolicitante: "",
      responsableActividad: "",
      actividad: "",
      motivo: "",
      aforo: "",
      pisoExterno: sala?.requierePiso ? "3" : "",
      duracion: 1,
      acomodoSala: ACOMODOS_SALA[0],
      cantidadMesas: 0,
      cantidadSillas: 0,
      detalleAcomodo: "",
      requerimientosTecnicos: { wifi: false, tv: false, sonido: false, pizarra: false },
      otrosRequerimientos: "",
      comentarios: "",
    });
  }

  function abrirReserva(sala: Sala, hora: string) {
    if (!sala.requierePiso) {
      const fin = addHours(hora, 1);
      const ocupada = reservas.find(
        (r) => mismaSalaReserva(r, sala, null) && r.estado === "aprobada" && overlaps(hora, fin, r.inicio, r.fin)
      );
      if (ocupada) {
        toast.warning(`Ya existe una reserva aprobada en ${ocupada.sala_nombre} de ${ocupada.inicio.slice(0,5)} a ${ocupada.fin.slice(0,5)}.`);
        return;
      }
    }
    setSlotSeleccionado({ sala, hora });
    resetForm(sala);
    setModalAbierto(true);
  }

  async function guardarReserva() {
    if (!slotSeleccionado) return;
    if (!form.solicitante.trim()) return toast.error("Debes indicar el nombre del solicitante.");
    if (!validarBC(form.numeroBC)) return toast.error("El número de BC debe tener entre 4 y 6 dígitos.");
    if (!validarTelefonoBanco(form.telefonoBanco)) return toast.error("Debes indicar un teléfono válido.");
    if (!form.correoSolicitante.trim()) return toast.error("Debes indicar el correo del solicitante.");
    if (!form.actividad.trim()) return toast.error("Debes indicar la actividad.");
    if (!form.motivo.trim()) return toast.error("Debes indicar el motivo.");
    if (!form.aforo || Number(form.aforo) < 1) return toast.error("Debes indicar el aforo.");
    if (slotSeleccionado.sala.requierePiso && !form.pisoExterno) return toast.error("Debes seleccionar el piso.");

    const inicio = `${slotSeleccionado.hora}:00`;
    const fin = addHours(slotSeleccionado.hora, Number(form.duracion));
    if (timeToMinutes(fin) > CONFIG.horarioFin * 60) {
      return toast.error(`La reserva no puede pasar de las ${CONFIG.horarioFin}:00.`);
    }

    setGuardando(true);
    const { error } = await supabase.from("reservas").insert({
      sala_id: slotSeleccionado.sala.id,
      sala_nombre: slotSeleccionado.sala.nombre,
      piso_externo: slotSeleccionado.sala.requierePiso ? form.pisoExterno : "",
      ubicacion: slotSeleccionado.sala.requierePiso ? `Piso ${form.pisoExterno}` : slotSeleccionado.sala.ubicacion,
      capacidad: slotSeleccionado.sala.capacidad,
      fecha,
      inicio,
      fin,
      solicitante: form.solicitante.trim(),
      numero_bc: soloDigitos(form.numeroBC),
      telefono_banco: form.telefonoBanco.trim(),
      correo_solicitante: form.correoSolicitante.trim(),
      responsable_actividad: form.responsableActividad.trim(),
      actividad: form.actividad.trim(),
      motivo: form.motivo.trim(),
      aforo: Number(form.aforo),
      acomodo_sala: form.acomodoSala,
      cantidad_mesas: Number(form.cantidadMesas || 0),
      cantidad_sillas: Number(form.cantidadSillas || 0),
      detalle_acomodo: form.detalleAcomodo.trim(),
      req_wifi: form.requerimientosTecnicos.wifi,
      req_tv: form.requerimientosTecnicos.tv,
      req_sonido: form.requerimientosTecnicos.sonido,
      req_pizarra: form.requerimientosTecnicos.pizarra,
      otros_requerimientos: form.otrosRequerimientos.trim(),
      comentarios: form.comentarios.trim(),
    });
    setGuardando(false);

    if (error) {
      if (error.message.includes("OVERLAP") || error.code === "23514") {
        toast.error("Ese horario se cruza con otra reserva existente.");
      } else {
        toast.error("Error al guardar: " + error.message);
      }
      return;
    }
    toast.success("Solicitud enviada. Un administrador la revisará pronto.");
    setModalAbierto(false);
    cargarReservas();
  }

  async function eliminarReserva(id: string) {
    const { error } = await supabase.from("reservas").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Reserva eliminada.");
    cargarReservas();
  }

  async function aprobarReserva(id: string) {
    if (!user) return;
    const { error } = await supabase
      .from("reservas")
      .update({ estado: "aprobada", motivo_rechazo: null, revisado_por: user.id, revisado_en: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      if (error.message.includes("OVERLAP") || error.code === "23514") {
        toast.error("No se puede aprobar: ya hay otra reserva aprobada en ese horario.");
      } else {
        toast.error("Error al aprobar: " + error.message);
      }
      return;
    }
    toast.success("Reserva aprobada.");
    cargarReservas();
  }

  async function rechazarReserva(id: string, motivo: string) {
    if (!user) return;
    const { error } = await supabase
      .from("reservas")
      .update({ estado: "rechazada", motivo_rechazo: motivo.trim() || null, revisado_por: user.id, revisado_en: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Error al rechazar: " + error.message);
      return;
    }
    toast.success("Reserva rechazada.");
    setRechazoModal(null);
    setMotivoRechazo("");
    cargarReservas();
  }

  function toggleReq(key: keyof typeof form.requerimientosTecnicos) {
    setForm((prev) => ({
      ...prev,
      requerimientosTecnicos: { ...prev.requerimientosTecnicos, [key]: !prev.requerimientosTecnicos[key] },
    }));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-slate-900 px-4 py-2 text-center text-xs font-medium text-slate-200">
        Esta página fue modificada por temas de confidencialidad y sensibilidad corporativa — no expone datos ni información real de la empresa original. Aquí está el proyecto completamente funcional y usable tal como se construyó.
      </div>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Building2 className="h-4 w-4" /> {CONFIG.nombreBanco} · Solicitudes de reserva
              {isAdmin && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Admin</span>}
            </div>
            <h1 className="text-2xl font-bold lg:text-3xl">{CONFIG.tituloSistema}</h1>
            <p className="text-sm text-slate-500">
              Registra solicitudes de salas. La validación/aprobación se realiza manualmente después.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-2xl bg-amber-500 text-white hover:bg-amber-600"
              onClick={() => document.getElementById("panel-pendientes")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <AlertTriangle className="mr-1 h-4 w-4" />
              Pendientes
              <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-amber-700">
                {pendientesGlobal.length}
              </span>
            </Button>
            <Button variant="outline" className="rounded-2xl" onClick={() => descargarCSV(reservas)}>
              <Download className="mr-1 h-4 w-4" /> Exportar CSV
            </Button>
            <Button className="rounded-2xl bg-blue-700 hover:bg-blue-800" onClick={() => abrirReserva(SALAS[0], horas[0])}>
              <Plus className="mr-1 h-4 w-4" /> Nueva solicitud
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Solicitudes" value={resumen.total} icon={<CalendarDays className="h-4 w-4" />} />
          <StatCard label="Horas reservadas" value={resumen.totalHoras} icon={<Clock className="h-4 w-4" />} />
          <StatCard label="Aforo total" value={resumen.totalAforo} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Mesas" value={resumen.totalMesas} icon={<Table2 className="h-4 w-4" />} />
          <StatCard label="Sillas" value={resumen.totalSillas} icon={<Armchair className="h-4 w-4" />} />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr_220px]">
            <label className="space-y-1">
              <span className="flex items-center gap-1 text-sm font-semibold"><CalendarDays className="h-4 w-4" /> Fecha</span>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500" />
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-1 text-sm font-semibold"><Search className="h-4 w-4" /> Buscar</span>
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por sala, solicitante, actividad..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500" />
            </label>
            <label className="space-y-1">
              <span className="flex items-center gap-1 text-sm font-semibold"><CheckCircle2 className="h-4 w-4" /> Estado</span>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-500">
                <option value="todas">Todas</option>
                <option value="pendiente">Pendientes</option>
                <option value="aprobada">Aprobadas</option>
                <option value="rechazada">Rechazadas</option>
              </select>
            </label>
          </div>
        </div>

        {user && (
          <div className="rounded-xl border bg-white px-4 py-2 text-xs text-slate-600">
            Sesión: <strong>{user.email}</strong> ·{" "}
            {isAdmin ? (
              <span className="font-semibold text-blue-700">Administrador (puedes aprobar/rechazar)</span>
            ) : (
              <span className="font-semibold text-slate-700">Esta cuenta no es administrador</span>
            )}
          </div>
        )}


        <div className="overflow-x-auto rounded-2xl border bg-white">
          <div className="min-w-[800px]">
            <div className="grid border-b bg-slate-50" style={{ gridTemplateColumns: `90px repeat(${SALAS.length}, minmax(150px,1fr))` }}>
              <div className="p-3 text-xs font-semibold uppercase text-slate-500">Hora</div>
              {SALAS.map((sala) => (
                <div key={sala.id} className="border-l p-3">
                  <div className="text-sm font-semibold">{sala.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {sala.ubicacion}{sala.requierePiso ? " · piso al reservar" : ` · cap. ${sala.capacidad}`}
                  </div>
                </div>
              ))}
            </div>
            {horas.map((hora) => (
              <div key={hora} className="grid border-b" style={{ gridTemplateColumns: `90px repeat(${SALAS.length}, minmax(150px,1fr))` }}>
                <div className="flex items-center gap-1 p-3 text-sm font-semibold text-slate-500">
                  <Clock className="h-3 w-3" /> {hora}
                </div>
                {SALAS.map((sala) => {
                  const reservasCelda = reservasParaCelda(sala, hora).filter((r) => reservasFiltradas.some((rf) => rf.id === r.id));
                  const ocupada = reservasCelda.length > 0;
                  return (
                    <button
                      key={sala.id}
                      onClick={() => abrirReserva(sala, hora)}
                      className={`min-h-[105px] border-l p-3 text-left transition hover:ring-2 hover:ring-blue-300 ${ocupada ? "bg-red-50 text-red-950" : "bg-emerald-50 hover:bg-emerald-100"}`}
                    >
                      {ocupada ? (
                        <div className="space-y-1">
                          {reservasCelda.slice(0, 3).map((r) => (
                            <div key={r.id} className="text-xs">
                              <div className="font-semibold">{r.actividad}</div>
                              <div>{r.inicio.slice(0,5)} - {r.fin.slice(0,5)}{r.piso_externo ? ` · Piso ${r.piso_externo}` : ""}</div>
                              <div className="text-slate-600">{r.solicitante} · {r.aforo} pers.</div>
                            </div>
                          ))}
                          {reservasCelda.length > 3 && <div className="text-xs">+{reservasCelda.length - 3} más</div>}
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-800">
                          <div className="font-semibold">Disponible</div>
                          <div>Clic para solicitar</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 lg:col-span-2">
            <h2 className="mb-3 text-lg font-bold">Solicitudes registradas</h2>
            <div className="space-y-3">
              {loadingList && <p className="text-sm text-slate-500">Cargando...</p>}
              {!loadingList && reservasFiltradas.length === 0 && (
                <p className="text-sm text-slate-500">No hay solicitudes para los filtros seleccionados.</p>
              )}
              {reservasFiltradas.map((r) => {
                const puedeEliminar = isAdmin;
                return (
                  <div key={r.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 text-sm">
                        <div className="flex flex-wrap items-center gap-2 font-semibold">
                          <MapPin className="h-4 w-4" /> {r.sala_nombre}{r.piso_externo ? ` · Piso ${r.piso_externo}` : ""}
                          {r.estado === "pendiente" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pendiente</span>}
                          {r.estado === "aprobada" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Aprobada</span>}
                          {r.estado === "rechazada" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Rechazada</span>}
                        </div>
                        <div className="text-slate-600">{r.fecha} · {r.inicio.slice(0,5)} - {r.fin.slice(0,5)}</div>
                        <div className="font-medium">{r.actividad} · {r.aforo} personas</div>
                        <div className="text-slate-600">Solicitante: {r.solicitante} · BC {r.numero_bc} · Tel. {r.telefono_banco}</div>
                        {r.responsable_actividad && <div className="text-slate-600">Responsable: {r.responsable_actividad}</div>}
                        <div className="flex flex-wrap gap-2 pt-1 text-xs">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5"><LayoutTemplate className="mr-1 inline h-3 w-3" />{r.acomodo_sala}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5"><Table2 className="mr-1 inline h-3 w-3" />{r.cantidad_mesas} mesas</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5"><Armchair className="mr-1 inline h-3 w-3" />{r.cantidad_sillas} sillas</span>
                        </div>
                        <div className="text-slate-600">Motivo: {r.motivo}</div>
                        {r.detalle_acomodo && <div className="text-slate-600">Detalle montaje: {r.detalle_acomodo}</div>}
                        {r.otros_requerimientos && <div className="text-slate-600">Otros: {r.otros_requerimientos}</div>}
                        {r.comentarios && <div className="text-slate-600">Comentarios: {r.comentarios}</div>}
                        {r.estado === "rechazada" && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                            <strong>Motivo de rechazo:</strong> {r.motivo_rechazo || "Sin motivo especificado"}
                          </div>
                        )}
                      </div>
                      {puedeEliminar && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="rounded-xl">
                              <Trash2 className="mr-1 h-3 w-3" /> Cancelar reserva
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Cancelar esta reserva?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. La reserva de <strong>{r.sala_nombre}</strong> del {r.fecha} ({r.inicio.slice(0,5)} - {r.fin.slice(0,5)}) será eliminada permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Volver</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => eliminarReserva(r.id)}
                              >
                                Sí, cancelar reserva
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 text-lg font-bold">Notas</h2>
            <div className="space-y-2 text-sm text-slate-600">
              <p><strong>Sala externa:</strong> selecciona piso 3 al 11 al reservar.</p>
              <p><strong>Sin estado:</strong> la página solo registra solicitudes. La aprobación queda manual.</p>
              <p><strong>Sin doble reserva:</strong> el sistema rechaza horarios que se cruzan.</p>
              <p><strong>Admin:</strong> puede eliminar cualquier reserva. Los demás solo las suyas.</p>
            </div>
          </div>
        </div>

        {isAdmin && (
        <div id="panel-pendientes" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-md">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-amber-900">
              <AlertTriangle className="h-5 w-5" /> Solicitudes pendientes de aprobación
            </h2>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-semibold text-amber-900">
              {pendientesGlobal.length} pendiente{pendientesGlobal.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mb-3 text-xs text-amber-800">Mostrando todas las solicitudes pendientes (de cualquier fecha).</p>
          {pendientesGlobal.length === 0 ? (
            <p className="text-sm text-amber-800">No hay solicitudes pendientes.</p>
          ) : (
            <div className="space-y-3">
              {pendientesGlobal.map((r) => (
                <div key={r.id} className="rounded-xl border border-amber-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-1 font-semibold"><MapPin className="h-4 w-4" /> {r.sala_nombre}{r.piso_externo ? ` · Piso ${r.piso_externo}` : ""}</div>
                      <div className="text-slate-600">{r.fecha} · {r.inicio.slice(0,5)} - {r.fin.slice(0,5)}</div>
                      <div className="font-medium">{r.actividad} · {r.aforo} personas</div>
                      <div className="text-slate-600">Solicitante: {r.solicitante} · BC {r.numero_bc}</div>
                      <div className="text-slate-600">Tel. {r.telefono_banco} · {r.correo_solicitante}</div>
                      {r.responsable_actividad && <div className="text-slate-600">Responsable: {r.responsable_actividad}</div>}
                      <div className="text-slate-600">Motivo: {r.motivo}</div>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{r.acomodo_sala}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{r.cantidad_mesas} mesas</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">{r.cantidad_sillas} sillas</span>
                        {r.req_wifi && <span className="rounded-full bg-blue-100 px-2 py-0.5">Wi-Fi</span>}
                        {r.req_tv && <span className="rounded-full bg-blue-100 px-2 py-0.5">TV</span>}
                        {r.req_sonido && <span className="rounded-full bg-blue-100 px-2 py-0.5">Sonido</span>}
                        {r.req_pizarra && <span className="rounded-full bg-blue-100 px-2 py-0.5">Pizarra</span>}
                      </div>
                      {r.detalle_acomodo && <div className="text-slate-600">Detalle: {r.detalle_acomodo}</div>}
                      {r.otros_requerimientos && <div className="text-slate-600">Otros: {r.otros_requerimientos}</div>}
                      {r.comentarios && <div className="text-slate-600">Comentarios: {r.comentarios}</div>}
                    </div>
                    <div className="flex flex-row gap-2 lg:flex-col">
                      {isAdmin ? (
                        <>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                                <CheckCircle2 className="mr-1 h-4 w-4" /> Aprobar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Aprobar esta reserva?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se confirmará la reserva de <strong>{r.sala_nombre}</strong> el {r.fecha} de {r.inicio.slice(0,5)} a {r.fin.slice(0,5)}. El horario quedará bloqueado para otros.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Volver</AlertDialogCancel>
                                <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={() => aprobarReserva(r.id)}>
                                  Sí, aprobar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => { setRechazoModal({ id: r.id, sala: r.sala_nombre }); setMotivoRechazo(""); }}
                          >
                            <X className="mr-1 h-4 w-4" /> Rechazar
                          </Button>
                        </>
                      ) : (
                        <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs italic text-slate-500">
                          Solo el administrador puede aprobar o rechazar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {isAdmin && <AdminPanel />}

        {isAdmin && <HistorialReservas />}
      </main>

      {/* El inicio de sesión de administrador se desactivó para esta demo pública.
          El componente sigue en el repo (AdminLoginFAB) y se puede reactivar en cualquier momento. */}


      {modalAbierto && slotSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold">Nueva solicitud de reserva</h2>
                <p className="text-sm text-slate-500">{slotSeleccionado.sala.nombre} · {fecha} · desde {slotSeleccionado.hora}</p>
              </div>
              <button onClick={() => setModalAbierto(false)} className="rounded-full p-2 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Esta solicitud no queda aprobada automáticamente. Luego será revisada manualmente.</p>
              </div>

              <h3 className="font-semibold">Datos del solicitante</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Solicitante" icon={<UserRound className="h-4 w-4" />}>
                  <input value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} placeholder="Nombre y apellido" className={inputCls} />
                </Field>
                <Field label="Número de BC" icon={<Hash className="h-4 w-4" />} hint="Entre 4 y 6 dígitos.">
                  <input value={form.numeroBC} onChange={(e) => setForm({ ...form, numeroBC: soloDigitos(e.target.value).slice(0, 6) })} placeholder="Ej. 1234" className={inputCls} />
                </Field>
                <Field label="Teléfono banco" icon={<Phone className="h-4 w-4" />}>
                  <input value={form.telefonoBanco} onChange={(e) => setForm({ ...form, telefonoBanco: e.target.value })} placeholder="Extensión o teléfono" className={inputCls} />
                </Field>
                <Field label="Correo solicitante" icon={<Mail className="h-4 w-4" />}>
                  <input value={form.correoSolicitante} onChange={(e) => setForm({ ...form, correoSolicitante: e.target.value })} placeholder="usuario@banco.com" className={inputCls} />
                </Field>
                <Field label="Responsable de la actividad">
                  <input value={form.responsableActividad} onChange={(e) => setForm({ ...form, responsableActividad: e.target.value })} placeholder="Si es distinto al solicitante" className={inputCls} />
                </Field>
              </div>

              <h3 className="font-semibold">Datos de la reserva</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {slotSeleccionado.sala.requierePiso && (
                  <Field label="Piso sala externa">
                    <select value={form.pisoExterno} onChange={(e) => setForm({ ...form, pisoExterno: e.target.value })} className={inputCls}>
                      {PISOS_EXTERNOS.map((p) => <option key={p} value={p}>Piso {p}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Duración">
                  <select value={form.duracion} onChange={(e) => setForm({ ...form, duracion: Number(e.target.value) })} className={inputCls}>
                    {Array.from({ length: CONFIG.duracionMaximaHoras }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>{h} hora{h > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Aforo">
                  <input type="number" min={1} value={form.aforo} onChange={(e) => setForm({ ...form, aforo: e.target.value })} placeholder="Cantidad de personas" className={inputCls} />
                </Field>
                <Field label="Actividad / Evento">
                  <input value={form.actividad} onChange={(e) => setForm({ ...form, actividad: e.target.value })} placeholder="Reunión, inducción, taller..." className={inputCls} />
                </Field>
                <Field label="Motivo">
                  <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Motivo de la solicitud" className={inputCls} />
                </Field>
              </div>

              <h3 className="font-semibold">Montaje y requerimientos</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Acomodo de sala">
                  <select value={form.acomodoSala} onChange={(e) => setForm({ ...form, acomodoSala: e.target.value })} className={inputCls}>
                    {ACOMODOS_SALA.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="Detalle del acomodo">
                  <input value={form.detalleAcomodo} onChange={(e) => setForm({ ...form, detalleAcomodo: e.target.value })} placeholder="Ej. mesas en U, pasillo central..." className={inputCls} />
                </Field>
                <Field label="Mesas">
                  <input type="number" min={0} value={form.cantidadMesas} onChange={(e) => setForm({ ...form, cantidadMesas: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Sillas">
                  <input type="number" min={0} value={form.cantidadSillas} onChange={(e) => setForm({ ...form, cantidadSillas: Number(e.target.value) })} className={inputCls} />
                </Field>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {REQUERIMIENTOS_TECNICOS.map((req) => {
                  const Icon = req.icon;
                  const checked = form.requerimientosTecnicos[req.key];
                  return (
                    <button
                      key={req.key}
                      type="button"
                      onClick={() => toggleReq(req.key)}
                      className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold transition ${checked ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                    >
                      <Icon className="h-4 w-4" /> {req.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Otros requerimientos</span>
                  <textarea value={form.otrosRequerimientos} onChange={(e) => setForm({ ...form, otrosRequerimientos: e.target.value })} rows={3} placeholder="Ej. micrófonos, montaje previo..." className={inputCls} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Comentarios</span>
                  <textarea value={form.comentarios} onChange={(e) => setForm({ ...form, comentarios: e.target.value })} rows={3} placeholder="Observación adicional" className={inputCls} />
                </label>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t p-5 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-2xl px-5" onClick={() => setModalAbierto(false)} disabled={guardando}>Cancelar</Button>
              <Button className="rounded-2xl bg-blue-700 px-5 hover:bg-blue-800" onClick={guardarReserva} disabled={guardando}>
                {guardando ? "Guardando..." : "Registrar solicitud"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {rechazoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b p-5">
              <h3 className="text-lg font-bold text-slate-900">Rechazar reserva</h3>
              <p className="mt-1 text-sm text-slate-500">
                Sala: <span className="font-semibold">{rechazoModal.sala}</span>
              </p>
            </div>
            <div className="space-y-2 p-5">
              <label className="block text-sm font-semibold text-slate-700">
                Motivo del rechazo
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={4}
                placeholder="Explica brevemente por qué se rechaza la solicitud. Este motivo será visible para quien solicitó la sala."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                autoFocus
              />
              <p className="text-xs text-slate-400">
                Si lo dejas vacío, se rechazará sin motivo específico.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t p-5 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="rounded-2xl px-5"
                onClick={() => { setRechazoModal(null); setMotivoRechazo(""); }}
              >
                Cancelar
              </Button>
              <Button
                className="rounded-2xl bg-red-600 px-5 text-white hover:bg-red-700"
                onClick={() => rechazarReserva(rechazoModal.id, motivoRechazo)}
              >
                <X className="mr-1 h-4 w-4" /> Confirmar rechazo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500";

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">{icon} {label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Field({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="flex items-center gap-1 text-sm font-semibold">{icon} {label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
