
-- 1) Enum de estado
DO $$ BEGIN
  CREATE TYPE public.reserva_estado AS ENUM ('pendiente', 'aprobada', 'rechazada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Nuevas columnas
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS estado public.reserva_estado NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS revisado_por uuid,
  ADD COLUMN IF NOT EXISTS revisado_en timestamptz;

-- 3) Reservas existentes pasan a aprobadas para no romper nada
UPDATE public.reservas SET estado = 'aprobada' WHERE estado = 'pendiente' AND created_at < now();

-- 4) Trigger de solapamiento solo entre aprobadas
CREATE OR REPLACE FUNCTION public.check_reserva_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado <> 'aprobada' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservas
    WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND estado = 'aprobada'
      AND sala_id = NEW.sala_id
      AND COALESCE(piso_externo, '') = COALESCE(NEW.piso_externo, '')
      AND fecha = NEW.fecha
      AND inicio < NEW.fin
      AND fin > NEW.inicio
  ) THEN
    RAISE EXCEPTION 'OVERLAP: Ya existe una reserva aprobada en esa sala y horario.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_reserva_overlap ON public.reservas;
CREATE TRIGGER trg_check_reserva_overlap
BEFORE INSERT OR UPDATE ON public.reservas
FOR EACH ROW EXECUTE FUNCTION public.check_reserva_overlap();
