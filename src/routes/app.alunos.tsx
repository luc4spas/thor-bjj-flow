import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { fmtDate } from "@/lib/format";
import { AlunoFormDialog } from "@/components/aluno-form-dialog";

export const Route = createFileRoute("/app/alunos")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin", "instructor"]}>
      <Alunos />
    </ProtectedRoute>
  ),
});

interface AlunoRow {
  id: string;
  nome: string;
  faixa: string;
  graus: number;
  data_nascimento: string | null;
  telefone: string | null;
  status_pagamento: "ok" | "atrasado" | "neutro";
}

function Alunos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const { data: alunos, isLoading } = useQuery({
    queryKey: ["alunos-list"],
    queryFn: async (): Promise<AlunoRow[]> => {
      const { data: alunosData, error } = await supabase
        .from("alunos")
        .select("id,nome,faixa,graus,data_nascimento,telefone")
        .order("nome");
      if (error) throw error;

      // Tentar buscar transações (somente owner/admin terão acesso por RLS)
      const { data: transData } = await supabase
        .from("transacoes")
        .select("id_aluno,status,data_vencimento,tipo");

      const today = new Date().toISOString().slice(0, 10);
      return (alunosData ?? []).map((a) => {
        const ts = (transData ?? []).filter((t) => t.id_aluno === a.id && t.tipo === "receita");
        let status: AlunoRow["status_pagamento"] = "neutro";
        if (transData) {
          const atrasado = ts.some((t) => t.status === "pendente" && t.data_vencimento < today);
          status = atrasado ? "atrasado" : "ok";
        }
        return { ...a, status_pagamento: status };
      });
    },
  });

  const filtered = (alunos ?? []).filter((a) => a.nome.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alunos</h1>
          <p className="text-sm text-muted-foreground">Cadastro e acompanhamento dos atletas</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo Aluno</Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Faixa</th>
              <th className="px-4 py-3">Graus</th>
              <th className="px-4 py-3">Nascimento</th>
              <th className="px-4 py-3">Telefone</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum aluno cadastrado.</td></tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <StatusDot status={a.status_pagamento} />
                </td>
                <td className="px-4 py-3 font-medium">{a.nome}</td>
                <td className="px-4 py-3">{a.faixa}</td>
                <td className="px-4 py-3">{a.graus}</td>
                <td className="px-4 py-3">{fmtDate(a.data_nascimento)}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.telefone ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlunoFormDialog open={open} onOpenChange={setOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["alunos-list"] })} />
    </div>
  );
}

function StatusDot({ status }: { status: AlunoRow["status_pagamento"] }) {
  const map = {
    ok: { color: "bg-success", title: "Em dia" },
    atrasado: { color: "bg-primary", title: "Possui parcela atrasada" },
    neutro: { color: "bg-muted-foreground/40", title: "Sem dados" },
  } as const;
  const m = map[status];
  return <span className={["inline-block h-3 w-3 rounded-full shadow", m.color].join(" ")} title={m.title} />;
}
