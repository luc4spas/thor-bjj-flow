import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBRL } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

export const Route = createFileRoute("/app/relatorios")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <Relatorios />
    </ProtectedRoute>
  ),
});

function Relatorios() {
  const { data: trans } = useQuery({
    queryKey: ["rel-trans"],
    queryFn: async () => {
      const { data } = await supabase.from("transacoes").select("tipo,valor,status,data_vencimento");
      return data ?? [];
    },
  });
  const { data: alunos } = useQuery({
    queryKey: ["rel-alunos"],
    queryFn: async () => (await supabase.from("alunos").select("faixa")).data ?? [],
  });

  const totalRecebido = (trans ?? []).filter((t) => t.tipo === "receita" && t.status === "pago").reduce((s, t) => s + Number(t.valor), 0);
  const totalDespesas = (trans ?? []).filter((t) => t.tipo === "despesa" && t.status === "pago").reduce((s, t) => s + Number(t.valor), 0);
  const saldo = totalRecebido - totalDespesas;

  const porFaixa = Object.entries((alunos ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.faixa] = (acc[a.faixa] ?? 0) + 1;
    return acc;
  }, {})).map(([faixa, qtd]) => ({ faixa, qtd }));

  const cores = ["#e5e7eb", "#9ca3af", "#fde047", "#fb923c", "#16a34a", "#3b82f6", "#a855f7", "#92400e", "#0a0a0a"];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Kpi title="Total Recebido" value={fmtBRL(totalRecebido)} />
        <Kpi title="Total Pago (Despesas)" value={fmtBRL(totalDespesas)} />
        <Kpi title="Saldo" value={fmtBRL(saldo)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Distribuição de Alunos por Faixa</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porFaixa}>
                <CartesianGrid stroke="oklch(0.22 0 0)" strokeDasharray="3 3" />
                <XAxis dataKey="faixa" stroke="oklch(0.65 0 0)" fontSize={12} />
                <YAxis stroke="oklch(0.65 0 0)" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "oklch(0.11 0 0)", border: "1px solid oklch(0.22 0 0)", borderRadius: 8 }} />
                <Bar dataKey="qtd" name="Alunos" radius={[6, 6, 0, 0]}>
                  {porFaixa.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card><CardContent className="p-6">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </CardContent></Card>
  );
}
