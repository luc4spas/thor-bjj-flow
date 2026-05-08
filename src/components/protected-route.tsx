import { useAuth, type AppRole } from "@/lib/auth-context";
import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function ProtectedRoute({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!role || !allow.includes(role)) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-semibold text-destructive">Acesso negado</p>
        <p className="text-muted-foreground">Você não tem permissão para acessar este módulo.</p>
        <Navigate to="/app/alunos" />
      </div>
    );
  }
  return <>{children}</>;
}
