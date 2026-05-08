import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBRL } from "@/lib/format";
import { TrendingUp, AlertTriangle, Receipt } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <Dashboard />
    </ProtectedRoute>
  ),
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-financeiro"],
    queryFn: async () => {
      const { data: trans, error } = await supabase
        .from("transacoes")
        .select("tipo,valor,data_vencimento,data_pagamento,status");
      if (error) throw error;
      return trans ?? [];
    },
  });

  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const receitaPrevista = (data ?? [])
    .filter((t) => t.tipo === "receita" && new Date(t.data_vencimento) >= startMonth && new Date(t.data_vencimento) <= endMonth)
    .reduce((s, t) => s + Number(t.valor), 0);

  const inadimplencia = (data ?? [])
    .filter((t) => t.tipo === "receita" && t.status === "pendente" && new Date(t.data_vencimento) < today)
    .reduce((s, t) => s + Number(t.valor), 0);

  const contasPagar = (data ?? [])
    .filter((t) => t.tipo === "despesa" && t.status === "pendente")
    .reduce((s, t) => s + Number(t.valor), 0);

  // fluxo de caixa últimos 6 meses
  const chart = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - idx), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const inMonth = (data ?? []).filter((t) => {
      const dt = new Date(t.data_vencimento);
      return dt >= d && dt <= end;
    });
    return {
      mes: d.toLocaleDateString("pt-BR", { month: "short" }),
      receita: inMonth.filter((t) => t.tipo === "receita").reduce((s, t) => s + Number(t.valor), 0),
      despesa: inMonth.filter((t) => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor), 0),
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground">Visão geral do mês corrente</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Receita Prevista do Mês" value={fmtBRL(receitaPrevista)} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <KpiCard title="Inadimplência Crítica" value={fmtBRL(inadimplencia)} icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <KpiCard title="Contas a Pagar" value={fmtBRL(contasPagar)} icon={<Receipt className="h-5 w-5" />} tone="warning" />
      </div>

      <Card>
        <CardHeader><CardTitle>Fluxo de Caixa — últimos 6 meses</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="r" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.65 0.16 145)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.65 0.16 145)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="d" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.55 0.22 27)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.55 0.22 27)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.22 0 0)" strokeDasharray="3 3" />
                  <XAxis dataKey="mes" stroke="oklch(0.65 0 0)" fontSize={12} />
                  <YAxis stroke="oklch(0.65 0 0)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip contentStyle={{ background: "oklch(0.11 0 0)", border: "1px solid oklch(0.22 0 0)", borderRadius: 8 }} formatter={(v: number) => fmtBRL(v)} />
                  <Area type="monotone" dataKey="receita" name="Receita" stroke="oklch(0.65 0.16 145)" fill="url(#r)" />
                  <Area type="monotone" dataKey="despesa" name="Despesa" stroke="oklch(0.55 0.22 27)" fill="url(#d)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: "success" | "danger" | "warning" }) {
  const colors = {
    success: "text-success bg-success/10",
    danger: "text-primary bg-primary/15",
    warning: "text-warning bg-warning/10",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className={["flex h-12 w-12 items-center justify-center rounded-lg", colors[tone]].join(" ")}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
