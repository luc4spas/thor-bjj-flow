import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/financeiro")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <Financeiro />
    </ProtectedRoute>
  ),
});

function Financeiro() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"receita" | "despesa">("receita");
  const [openDespesa, setOpenDespesa] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["transacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacoes")
        .select("id,tipo,categoria,descricao,valor,data_vencimento,data_pagamento,status,id_aluno,alunos(nome)")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = (data ?? []).filter((t) => t.tipo === tab);
  const today = new Date().toISOString().slice(0, 10);

  async function marcarPago(id: string) {
    const { error } = await supabase.from("transacoes").update({
      status: "pago", data_pagamento: today,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Pagamento registrado!"); qc.invalidateQueries({ queryKey: ["transacoes"] }); qc.invalidateQueries({ queryKey: ["dashboard-financeiro"] }); }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Contas a Receber e a Pagar</p>
        </div>
        <Button onClick={() => setOpenDespesa(true)}><Plus className="mr-2 h-4 w-4" /> Nova Despesa</Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="receita">Contas a Receber</TabsTrigger>
          <TabsTrigger value="despesa">Contas a Pagar</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">{tab === "receita" ? "Aluno" : "Categoria"}</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && list.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sem registros.</td></tr>}
                {list.map((t) => {
                  const atrasado = t.status === "pendente" && t.data_vencimento < today;
                  return (
                    <tr key={t.id} className={["border-t border-border hover:bg-muted/20", atrasado ? "bg-[var(--danger-row)]" : ""].join(" ")}>
                      <td className="px-4 py-3">{fmtDate(t.data_vencimento)}</td>
                      <td className="px-4 py-3">{tab === "receita" ? (t.alunos?.nome ?? "—") : t.categoria}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.descricao ?? "—"}</td>
                      <td className="px-4 py-3 font-medium">{fmtBRL(t.valor)}</td>
                      <td className="px-4 py-3">
                        <span className={[
                          "rounded-full px-2 py-0.5 text-xs",
                          t.status === "pago" ? "bg-success/15 text-success" : atrasado ? "bg-primary/20 text-primary" : "bg-warning/15 text-warning",
                        ].join(" ")}>
                          {t.status === "pago" ? "Pago" : atrasado ? "Atrasado" : "Pendente"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(t.data_pagamento)}</td>
                      <td className="px-4 py-3 text-right">
                        {t.status === "pendente" && (
                          <Button size="sm" variant="outline" onClick={() => marcarPago(t.id)}>
                            <Check className="mr-1 h-3 w-3" /> Pagar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <DespesaDialog open={openDespesa} onOpenChange={setOpenDespesa} onSaved={() => qc.invalidateQueries({ queryKey: ["transacoes"] })} />
    </div>
  );
}

function DespesaDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [categoria, setCategoria] = useState("Aluguel");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [venc, setVenc] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function salvar() {
    if (!valor) return toast.error("Informe o valor");
    setBusy(true);
    const { error } = await supabase.from("transacoes").insert({
      tipo: "despesa", categoria, descricao: descricao || null,
      valor: Number(valor), data_vencimento: venc, status: "pendente",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Despesa adicionada"); onSaved(); onOpenChange(false); setDescricao(""); setValor(""); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Aluguel", "Salário", "Material", "Marketing", "Utilidades", "Outros"].map((c) =>
                  <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Valor</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Vencimento</Label><Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
