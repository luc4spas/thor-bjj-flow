-- 1. Remove ambos os triggers (o antigo trg_gerar_parcelas e o atual trg_gerar_parcelas_contrato)
--    para eliminar a duplicidade de lançamentos financeiros ao criar um contrato.
DROP TRIGGER IF EXISTS trg_gerar_parcelas ON public.contratos;
DROP TRIGGER IF EXISTS trg_gerar_parcelas_contrato ON public.contratos;

-- 2. Recria a função corrigindo o cálculo da data de vencimento:
--    - Se o dia de vencimento no mês de data_inicio já passou (ex: início 23/11 e vencimento dia 10),
--      a primeira parcela passa automaticamente para o próximo mês (10/12), evitando datas retroativas.
--    - Respeita o último dia do mês (ex: vencimento dia 30 em fevereiro vira 28/02 ou 29/02).
CREATE OR REPLACE FUNCTION public.gerar_parcelas_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_duracao INT;
  v_cobranca public.plano_cobranca;
  v_tipo public.plano_tipo;
  v_titular uuid;
  v_valor_parcela NUMERIC(10,2);
  i INT;
  v_mes_base DATE;
  v_mes_alvo DATE;
  v_ultimo_dia INT;
  v_venc DATE;
BEGIN
  SELECT duracao_meses, cobranca, tipo
    INTO v_duracao, v_cobranca, v_tipo
    FROM public.planos WHERE id = NEW.id_plano;

  SELECT titular_id INTO v_titular FROM public.alunos WHERE id = NEW.id_aluno;
  IF v_tipo = 'familia' AND v_titular IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Calcula o primeiro vencimento no mês de data_inicio (limitado ao último dia do mês)
  v_mes_base := date_trunc('month', NEW.data_inicio)::date;
  v_ultimo_dia := EXTRACT(DAY FROM (v_mes_base + interval '1 month - 1 day'))::int;
  v_venc := v_mes_base + (LEAST(NEW.dia_vencimento, v_ultimo_dia) - 1);

  -- Se o dia de vencimento no mês inicial já passou, inicia a cobrança no mês seguinte
  IF v_venc < NEW.data_inicio THEN
    v_mes_base := (v_mes_base + interval '1 month')::date;
    v_ultimo_dia := EXTRACT(DAY FROM (v_mes_base + interval '1 month - 1 day'))::int;
    v_venc := v_mes_base + (LEAST(NEW.dia_vencimento, v_ultimo_dia) - 1);
  END IF;

  IF v_cobranca = 'a_vista' THEN
    INSERT INTO public.transacoes
      (id_aluno, id_contrato, tipo, categoria, descricao, valor, data_vencimento, status)
    VALUES
      (NEW.id_aluno, NEW.id, 'receita', 'Mensalidade',
       'Pagamento à vista (' || v_duracao || ' meses)',
       NEW.valor_total, v_venc, 'pendente');
    RETURN NEW;
  END IF;

  v_valor_parcela := ROUND(NEW.valor_total / v_duracao, 2);
  FOR i IN 0..(v_duracao - 1) LOOP
    v_mes_alvo := (v_mes_base + (i || ' month')::interval)::date;
    v_ultimo_dia := EXTRACT(DAY FROM (v_mes_alvo + interval '1 month - 1 day'))::int;
    v_venc := v_mes_alvo + (LEAST(NEW.dia_vencimento, v_ultimo_dia) - 1);

    INSERT INTO public.transacoes
      (id_aluno, id_contrato, tipo, categoria, descricao, valor, data_vencimento, status)
    VALUES
      (NEW.id_aluno, NEW.id, 'receita', 'Mensalidade',
       'Parcela ' || (i+1) || '/' || v_duracao,
       v_valor_parcela, v_venc, 'pendente');
  END LOOP;
  RETURN NEW;
END $function$;

-- 3. Garante apenas UM trigger na tabela contratos
CREATE TRIGGER trg_gerar_parcelas_contrato
  AFTER INSERT ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.gerar_parcelas_contrato();
