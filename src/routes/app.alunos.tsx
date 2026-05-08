import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { fmtDate } from "@/lib/format";
import { AlunoFormDialog, type AlunoEditPayload } from "@/components/aluno-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { PaginationBar, usePagination } from "@/components/pagination-bar";

export const Route = createFileRoute("/app/alunos")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin", "instructor"]}>
      <Alunos />
    </ProtectedRoute>
  ),
});

interface AlunoRow extends AlunoEditPayload {
  status_pagamento: "ok" | "atrasado" | "neutro";
}

function Alunos() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const canManage = role === "owner" || role === "admin";

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<AlunoEditPayload | null>(null);
  const [deleting, setDeleting] = useState<AlunoRow | null>(null);
  const [filter, setFilter] = useState("");
  const [faixaF, setFaixaF] = useState<string>("todas");
  const [statusF, setStatusF] = useState<"todos" | "ok" | "atrasado" | "neutro">("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: alunos, isLoading } = useQuery({
    queryKey: ["alunos-list"],
    queryFn: async (): Promise<AlunoRow[]> => {
      const { data: alunosData, error } = await supabase
        .from("alunos")
        .select("id,nome,faixa,graus,data_nascimento,telefone,email,id_responsavel")
        .order("nome");
      if (error) throw error;

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

  async function handleDelete() {
    if (!deleting) return;
    // Limpar dependências (não há FK cascade)
    await supabase.from("transacoes").delete().eq("id_aluno", deleting.id);
    await supabase.from("contratos").delete().eq("id_aluno", deleting.id);
    const { error } = await supabase.from("alunos").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Aluno removido");
      qc.invalidateQueries({ queryKey: ["alunos-list"] });
      qc.invalidateQueries({ queryKey: ["transacoes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] });
    }
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alunos</h1>
          <p className="text-sm text-muted-foreground">Cadastro e acompanhamento dos atletas</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Aluno
          </Button>
        )}
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
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum aluno cadastrado.</td></tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3"><StatusDot status={a.status_pagamento} /></td>
                <td className="px-4 py-3 font-medium">{a.nome}</td>
                <td className="px-4 py-3">{a.faixa}</td>
                <td className="px-4 py-3">{a.graus}</td>
                <td className="px-4 py-3">{fmtDate(a.data_nascimento)}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.telefone ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(a); setOpenForm(true); }}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(a)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlunoFormDialog
        open={openForm}
        onOpenChange={(v) => { setOpenForm(v); if (!v) setEditing(null); }}
        aluno={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["alunos-list"] })}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => { if (!v) setDeleting(null); }}
        title="Excluir aluno"
        description={`Excluir "${deleting?.nome}" removerá também contratos e parcelas vinculadas. Confirmar?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
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
