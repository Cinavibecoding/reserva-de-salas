// Conexión real a Supabase removida intencionalmente para esta demo pública.
// La versión real de esta app se conecta a una base de datos en vivo de la
// organización original — para no exponer ni escribir sobre esos datos reales,
// esta demo usa un almacén en memoria (persistido en localStorage del navegador)
// que imita la misma interfaz de consultas. El inicio de sesión de administrador
// también se desactivó (ver AdminLoginFAB) y ambos se pueden reactivar apuntando
// este archivo de vuelta al cliente real de Supabase.

type Reserva = Record<string, any>;

const STORAGE_KEY = "reservas-demo-v1";

// Fecha local (no UTC) para que coincida con fechaHoyISO() del componente —
// toISOString() usa UTC y puede caer en el día siguiente según la zona horaria.
function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SEED: Reserva[] = [
  {
    id: "demo-1",
    user_id: null,
    sala_id: "sala-3",
    sala_nombre: "Sala 3",
    piso_externo: "",
    ubicacion: "Piso 5",
    capacidad: 35,
    fecha: hoyLocal(),
    inicio: "09:00:00",
    fin: "11:00:00",
    solicitante: "María Gómez",
    numero_bc: "12345",
    telefono_banco: "0212-1234",
    correo_solicitante: "maria.gomez@empresa.com",
    responsable_actividad: "María Gómez",
    actividad: "Taller de inducción",
    motivo: "Onboarding de nuevos ingresos",
    aforo: 25,
    acomodo_sala: "Escuela / Capacitación",
    cantidad_mesas: 10,
    cantidad_sillas: 25,
    detalle_acomodo: "",
    req_wifi: true,
    req_tv: true,
    req_sonido: false,
    req_pizarra: true,
    req_atril: false,
    otros_requerimientos: "",
    comentarios: "",
    correos_notificados: [],
    created_at: new Date().toISOString(),
    estado: "aprobada",
    motivo_rechazo: null,
    revisado_por: null,
    revisado_en: null,
  },
  {
    id: "demo-2",
    user_id: null,
    sala_id: "sala-9",
    sala_nombre: "Sala 9",
    piso_externo: "",
    ubicacion: "Piso 5",
    capacidad: 16,
    fecha: hoyLocal(),
    inicio: "14:00:00",
    fin: "15:00:00",
    solicitante: "Carlos Pérez",
    numero_bc: "67890",
    telefono_banco: "0212-5678",
    correo_solicitante: "carlos.perez@empresa.com",
    responsable_actividad: "Carlos Pérez",
    actividad: "Entrevista",
    motivo: "Proceso de selección",
    aforo: 3,
    acomodo_sala: "Consultorio / entrevista",
    cantidad_mesas: 1,
    cantidad_sillas: 3,
    detalle_acomodo: "",
    req_wifi: true,
    req_tv: false,
    req_sonido: false,
    req_pizarra: false,
    req_atril: false,
    otros_requerimientos: "",
    comentarios: "",
    correos_notificados: [],
    created_at: new Date().toISOString(),
    estado: "pendiente",
    motivo_rechazo: null,
    revisado_por: null,
    revisado_en: null,
  },
  {
    id: "demo-3",
    user_id: null,
    sala_id: "sala-6",
    sala_nombre: "Sala 6",
    piso_externo: "",
    ubicacion: "Piso 5",
    capacidad: 35,
    fecha: hoyLocal(),
    inicio: "16:00:00",
    fin: "17:00:00",
    solicitante: "Ana Torres",
    numero_bc: "24680",
    telefono_banco: "0212-2468",
    correo_solicitante: "ana.torres@empresa.com",
    responsable_actividad: "Ana Torres",
    actividad: "Presentación de resultados",
    motivo: "Cierre de trimestre",
    aforo: 15,
    acomodo_sala: "Auditorio",
    cantidad_mesas: 0,
    cantidad_sillas: 15,
    detalle_acomodo: "",
    req_wifi: true,
    req_tv: true,
    req_sonido: true,
    req_pizarra: false,
    req_atril: true,
    otros_requerimientos: "",
    comentarios: "",
    correos_notificados: [],
    created_at: new Date().toISOString(),
    estado: "aprobada",
    motivo_rechazo: null,
    revisado_por: null,
    revisado_en: null,
  },
];

function load(): Reserva[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* usa semilla por defecto */
  }
  return structuredClone(SEED);
}

function save(rows: Reserva[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* almacenamiento no disponible, se pierde al recargar */
  }
}

let rows = load();

function matches(row: Reserva, filters: [string, any][]) {
  return filters.every(([k, v]) => String(row[k]) === String(v));
}

class MockQuery implements PromiseLike<{ data: any; error: any }> {
  private table: string;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: [string, any][] = [];
  private order_: [string, boolean][] = [];
  private payload: any = null;
  private single = false;

  constructor(table: string) {
    this.table = table;
  }
  select(_cols?: string) {
    if (this.op !== "insert") this.op = "select";
    return this;
  }
  insert(payload: any) {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push([col, val]);
    return this;
  }
  order(col: string) {
    this.order_.push([col, true]);
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  private run() {
    if (this.table !== "reservas") {
      return { data: this.single ? null : [], error: null };
    }
    if (this.op === "insert") {
      const row = { ...this.payload, id: this.payload.id ?? `demo-${Date.now()}`, estado: this.payload.estado ?? "pendiente", created_at: new Date().toISOString() };
      rows = [row, ...rows];
      save(rows);
      return { data: [row], error: null };
    }
    if (this.op === "delete") {
      rows = rows.filter((r) => !matches(r, this.filters));
      save(rows);
      return { data: null, error: null };
    }
    if (this.op === "update") {
      rows = rows.map((r) => (matches(r, this.filters) ? { ...r, ...this.payload } : r));
      save(rows);
      return { data: null, error: null };
    }
    // select
    let result = rows.filter((r) => matches(r, this.filters));
    for (const [col] of this.order_) {
      result = [...result].sort((a, b) => String(a[col]).localeCompare(String(b[col])));
    }
    if (this.single) return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled as any);
  }
}

function noopChannel() {
  const channel = {
    on() {
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  return channel;
}

export const supabase = {
  from(table: string) {
    return new MockQuery(table);
  },
  channel(_name: string) {
    return noopChannel();
  },
  removeChannel(_channel: any) {
    /* no-op */
  },
  auth: {
    async getSession() {
      return { data: { session: null } };
    },
    onAuthStateChange(_cb: (event: string, session: any) => void) {
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signOut() {
      /* no-op: no hay sesión real en esta demo */
    },
    async getUser() {
      return { data: { user: null } };
    },
    async signInWithPassword() {
      return { error: { message: "El inicio de sesión está desactivado en esta demo pública." } };
    },
  },
};
