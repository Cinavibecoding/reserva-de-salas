
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reservations
CREATE TABLE public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sala_id TEXT NOT NULL,
  sala_nombre TEXT NOT NULL,
  piso_externo TEXT NOT NULL DEFAULT '',
  ubicacion TEXT NOT NULL,
  capacidad INT,
  fecha DATE NOT NULL,
  inicio TIME NOT NULL,
  fin TIME NOT NULL,
  solicitante TEXT NOT NULL,
  numero_bc TEXT NOT NULL,
  telefono_banco TEXT NOT NULL,
  correo_solicitante TEXT NOT NULL,
  responsable_actividad TEXT DEFAULT '',
  actividad TEXT NOT NULL,
  motivo TEXT NOT NULL,
  aforo INT NOT NULL,
  acomodo_sala TEXT NOT NULL,
  cantidad_mesas INT NOT NULL DEFAULT 0,
  cantidad_sillas INT NOT NULL DEFAULT 0,
  detalle_acomodo TEXT DEFAULT '',
  req_wifi BOOLEAN NOT NULL DEFAULT false,
  req_tv BOOLEAN NOT NULL DEFAULT false,
  req_sonido BOOLEAN NOT NULL DEFAULT false,
  req_pizarra BOOLEAN NOT NULL DEFAULT false,
  req_atril BOOLEAN NOT NULL DEFAULT false,
  otros_requerimientos TEXT DEFAULT '',
  comentarios TEXT DEFAULT '',
  correos_notificados TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fin_after_inicio CHECK (fin > inicio)
);

CREATE INDEX idx_reservas_fecha_sala ON public.reservas (fecha, sala_id, piso_externo);

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservas_select_authenticated" ON public.reservas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reservas_insert_own" ON public.reservas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reservas_delete_own_or_admin" ON public.reservas
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reservas_update_own_or_admin" ON public.reservas
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Server-side overlap prevention
CREATE OR REPLACE FUNCTION public.check_reserva_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reservas
    WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND sala_id = NEW.sala_id
      AND COALESCE(piso_externo, '') = COALESCE(NEW.piso_externo, '')
      AND fecha = NEW.fecha
      AND inicio < NEW.fin
      AND fin > NEW.inicio
  ) THEN
    RAISE EXCEPTION 'OVERLAP: Ya existe una reserva en esa sala y horario.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservas_no_overlap
  BEFORE INSERT OR UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.check_reserva_overlap();
