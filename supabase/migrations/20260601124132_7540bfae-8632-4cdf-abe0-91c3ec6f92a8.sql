
-- Permitir reservas anónimas (sin login)
ALTER TABLE public.reservas ALTER COLUMN user_id DROP NOT NULL;

-- Eliminar políticas previas de reservas
DROP POLICY IF EXISTS reservas_insert_own ON public.reservas;
DROP POLICY IF EXISTS reservas_select_authenticated ON public.reservas;
DROP POLICY IF EXISTS reservas_update_own_or_admin ON public.reservas;
DROP POLICY IF EXISTS reservas_delete_own_or_admin ON public.reservas;

-- Cualquiera (anon o autenticado) ve reservas aprobadas; admins ven todo
CREATE POLICY reservas_select_public ON public.reservas FOR SELECT
  TO anon, authenticated
  USING (estado = 'aprobada' OR public.has_role(auth.uid(), 'admin'));

-- Cualquiera puede crear una solicitud (queda en estado pendiente, sin user_id)
CREATE POLICY reservas_insert_public ON public.reservas FOR INSERT
  TO anon, authenticated
  WITH CHECK (estado = 'pendiente' AND user_id IS NULL);

-- Solo admins pueden actualizar (aprobar/rechazar)
CREATE POLICY reservas_update_admin ON public.reservas FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Solo admins pueden eliminar
CREATE POLICY reservas_delete_admin ON public.reservas FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Grants para acceso público vía Data API
GRANT SELECT, INSERT ON public.reservas TO anon;

-- Permitir que admins vean todos los perfiles (para gestionar otros admins por correo)
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
