import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const FAIXAS = ["Branca", "Cinza", "Amarela", "Laranja", "Verde", "Azul", "Roxa", "Marrom", "Preta"];

export interface AlunoEditPayload {
  id: string;
  nome: string;
  data_nascimento: string | null;
  faixa: string;
  graus: number;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  id_responsavel: string | null;
}

function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  aluno?: AlunoEditPayload | null;
}

export function AlunoFormDialog({ open, onOpenChange, onSaved, aluno }: Props) {
  const isEdit = !!aluno;
  const [tab, setTab] = useState("dados");
  const [busy, setBusy] = useState(false);

  // Aluno
  const [nome, setNome] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [faixa, setFaixa] = useState("Branca");
  const [graus, setGraus] = useState("0");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  // Responsavel
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [respTel, setRespTel] = useState("");
  const [respEmail, setRespEmail] = useState("");
  // Contrato (só na criação)
  const [planoId, setPlanoId] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [valorTotal, setValorTotal] = useState("");
  const [diaVenc, setDiaVenc] = useState("10");

  const { data: planos } = useQuery({
    queryKey: ["planos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("planos").select("*").order("duracao_meses");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    setTab("dados");
    if (aluno) {
      setNome(aluno.nome);
      setDataNasc(aluno.data_nascimento ?? "");
      setFaixa(aluno.faixa);
      setGraus(String(aluno.graus));
      setTelefone(aluno.telefone ?? "");
      setEmail(aluno.email ?? "");
      // Carregar responsável se houver
      if (aluno.id_responsavel) {
        supabase.from("responsaveis").select("*").eq("id", aluno.id_responsavel).maybeSingle()
          .then(({ data }) => {
            if (data) {
              setRespNome(data.nome ?? "");
              setRespCpf(data.cpf ?? "");
              setRespTel(data.telefone ?? "");
              setRespEmail(data.email ?? "");
            }
          });
      } else {
        setRespNome(""); setRespCpf(""); setRespTel(""); setRespEmail("");
      }
    } else {
      setNome(""); setDataNasc(""); setFaixa("Branca"); setGraus("0");
      setTelefone(""); setEmail(""); setRespNome(""); setRespCpf(""); setRespTel(""); setRespEmail("");
      setPlanoId(""); setValorTotal(""); setDiaVenc("10");
      setDataInicio(new Date().toISOString().slice(0, 10));
    }
  }, [open, aluno]);

  useEffect(() => {
    if (planoId && planos && !isEdit) {
      const p = planos.find((x) => x.id === planoId);
      if (p && !valorTotal) setValorTotal(String(p.valor_padrao));
    }
  }, [planoId, planos, isEdit, valorTotal]);

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome do aluno");
    if (!isEdit) {
      if (!planoId) return toast.error("Selecione um plano (contrato é obrigatório)");
      if (!valorTotal) return toast.error("Informe o valor total do contrato");
    }

    setBusy(true);
    try {
      let idResponsavel: string | null = aluno?.id_responsavel ?? null;
      if (respNome.trim()) {
        if (idResponsavel) {
          const { error } = await supabase.from("responsaveis").update({
            nome: respNome, cpf: respCpf || null, telefone: respTel || null, email: respEmail || null,
          }).eq("id", idResponsavel);
          if (error) throw error;
        } else {
          const { data: r, error: er } = await supabase.from("responsaveis").insert({
            nome: respNome, cpf: respCpf || null, telefone: respTel || null, email: respEmail || null,
          }).select("id").single();
          if (er) throw er;
          idResponsavel = r.id;
        }
      }

      if (isEdit) {
        const { error } = await supabase.from("alunos").update({
          nome, data_nascimento: dataNasc || null, faixa, graus: Number(graus),
          telefone: telefone || null, email: email || null, id_responsavel: idResponsavel,
        }).eq("id", aluno!.id);
        if (error) throw error;
        toast.success("Aluno atualizado");
      } else {
        const { data: alunoNovo, error: ea } = await supabase.from("alunos").insert({
          nome, data_nascimento: dataNasc || null, faixa, graus: Number(graus),
          telefone: telefone || null, email: email || null, id_responsavel: idResponsavel,
        }).select("id").single();
        if (ea) throw ea;

        const plano = planos?.find((p) => p.id === planoId)!;
        const inicio = new Date(dataInicio + "T00:00:00");
        const fim = new Date(inicio); fim.setMonth(fim.getMonth() + plano.duracao_meses);

        const { error: ec } = await supabase.from("contratos").insert({
          id_aluno: alunoNovo.id,
          id_plano: planoId,
          data_inicio: dataInicio,
          data_fim: fim.toISOString().slice(0, 10),
          valor_total: Number(valorTotal),
          dia_vencimento: Number(diaVenc),
          status: "ativo",
        });
        if (ec) throw ec;
        toast.success("Aluno cadastrado e parcelas geradas!");
      }

      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erro ao salvar");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Aluno" : "Novo Aluno"}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className={isEdit ? "grid w-full grid-cols-2" : "grid w-full grid-cols-3"}>
            <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
            <TabsTrigger value="resp">Responsável</TabsTrigger>
            {!isEdit && <TabsTrigger value="contrato">Contrato *</TabsTrigger>}
          </TabsList>

          <TabsContent value="dados" className="space-y-4 pt-4">
            <Field label="Nome *"><Input value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de Nascimento"><Input type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} /></Field>
              <Field label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
            </div>
            <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Faixa">
                <Select value={faixa} onValueChange={setFaixa}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FAIXAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Graus"><Input type="number" min={0} max={4} value={graus} onChange={(e) => setGraus(e.target.value)} /></Field>
            </div>
          </TabsContent>

          <TabsContent value="resp" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">Opcional para alunos maiores de idade</p>
            <Field label="Nome"><Input value={respNome} onChange={(e) => setRespNome(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CPF"><Input value={respCpf} onChange={(e) => setRespCpf(e.target.value)} /></Field>
              <Field label="Telefone"><Input value={respTel} onChange={(e) => setRespTel(e.target.value)} /></Field>
            </div>
            <Field label="E-mail"><Input value={respEmail} onChange={(e) => setRespEmail(e.target.value)} /></Field>
          </TabsContent>

          {!isEdit && (
            <TabsContent value="contrato" className="space-y-4 pt-4">
              <Field label="Plano *">
                <Select value={planoId} onValueChange={setPlanoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                  <SelectContent>
                    {planos?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} — {p.duracao_meses}m — R$ {Number(p.valor_padrao).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Data Início"><Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></Field>
                <Field label="Valor Total *"><Input type="number" step="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} /></Field>
                <Field label="Dia Vencimento"><Input type="number" min={1} max={28} value={diaVenc} onChange={(e) => setDiaVenc(e.target.value)} /></Field>
              </div>
              <p className="text-xs text-muted-foreground">As parcelas mensais serão geradas automaticamente conforme a duração do plano.</p>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{busy ? "Salvando…" : isEdit ? "Salvar Alterações" : "Salvar Aluno"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
