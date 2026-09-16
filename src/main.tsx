import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { ReservasPage } from "./routes/reservas";
import "./styles.css";

// Entry propio para el build estático de esta demo: reemplaza el enrutador
// de TanStack Start (pensado para SSR) ya que aquí solo hay una página real
// (el login está desactivado, y "/" siempre redirigía a "/reservas").

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ReservasPage />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  </StrictMode>,
);
