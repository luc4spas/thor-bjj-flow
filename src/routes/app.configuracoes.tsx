import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/format";
import type { AppRole } from "@/lib/auth-context";
import { Plus, Trash } from "lucide-react";

export const Route = createFileRoute("/app/configuracoes")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <Config />
    </ProtectedRoute>
  ),
});

function Config() {
  const qc = useQueryClient();

  const { data: planos } = useQuery({
    queryKey: ["cfg-planos"],
    queryFn: async () => (await supabase.from("planos").select("*").order("duracao_meses")).data ?? [],
  });
  const { data: perfis } = useQuery({
    queryKey: ["cfg-perfis"],
    queryFn: async () => (await supabase.from("perfis").select("id,nome,email,role").order("nome")).data ?? [],
  });

  const [nome, setNome] = useState(""); const [dur, setDur] = useState("1"); const [valor, setValor] = useState("");

  async function addPlano() {
    if (!nome || !valor) return toast.error("Preencha nome e valor");
    const { error } = await supabase.from("planos").insert({ nome, duracao_meses: Number(dur), valor_padrao: Number(valor) });
    if (error) toast.error(error.message);
    else { toast.success("Plano adicionado"); setNome(""); setValor(""); qc.invalidateQueries({ queryKey: ["cfg-planos"] }); }
  }

  async function delPlano(id: string) {
    const { error } = await supabase.from("planos").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Plano removido"); qc.invalidateQueries({ queryKey: ["cfg-planos"] }); }
  }

  async function changeRole(id: string, role: AppRole) {
    const { error } = await supabase.from("perfis").update({ role }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Perfil atualizado"); qc.invalidateQueries({ queryKey: ["cfg-perfis"] }); }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Planos e usuários</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Planos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_160px_auto]">
            <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Bimestral" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Duração (meses)</Label><Input type="number" min={1} value={dur} onChange={(e) => setDur(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Valor Padrão</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            <Button className="self-end" onClick={addPlano}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Nome</th><th>Duração</th><th>Valor</th><th></th></tr></thead>
            <tbody>
              {(planos ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2 font-medium">{p.nome}</td>
                  <td>{p.duracao_meses} m</td>
                  <td>{fmtBRL(p.valor_padrao)}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => delPlano(p.id)}><Trash className="h-4 w-4 text-primary" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Usuários e Permissões</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Nome</th><th>E-mail</th><th>Papel</th></tr></thead>
            <tbody>
              {(perfis ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-2">{u.nome ?? "—"}</td>
                  <td className="text-muted-foreground">{u.email}</td>
                  <td>
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v as AppRole)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="instructor">Instructor</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
