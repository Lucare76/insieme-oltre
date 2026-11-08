-- Rettifica tracciata delle quote associative senza eliminare movimenti o ricevute.
-- Soltanto la RPC privilegiata puo' impostare lo stato di annullamento.
ALTER TABLE public.association_membership_fees
  ADD COLUMN cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN cancellation_reason text,
  ADD COLUMN cancelled_by uuid REFERENCES auth.users(id),
  ADD COLUMN cancelled_at timestamptz;
ALTER TABLE public.association_membership_fees
  ADD CONSTRAINT association_fee_cancel_state_check CHECK (
    (NOT cancelled AND cancellation_reason IS NULL AND cancelled_by IS NULL AND cancelled_at IS NULL)
    OR (cancelled AND cancellation_reason IS NOT NULL
        AND length(trim(cancellation_reason)) BETWEEN 10 AND 500
        AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
  );

-- Una quota annullata resta nello storico e non impedisce la registrazione
-- della quota corretta per lo stesso socio e anno.
ALTER TABLE public.association_membership_fees
  DROP CONSTRAINT association_membership_fees_person_id_fee_year_key;
CREATE UNIQUE INDEX association_membership_fees_active_year_unique
  ON public.association_membership_fees(person_id,fee_year) WHERE NOT cancelled;

-- La precedente guardia impediva ogni annullamento. Ora permette ESCLUSIVAMENTE
-- il passaggio attivo -> annullato quando la quota collegata e' gia' annullata
-- dalla stessa persona con la medesima motivazione.
CREATE OR REPLACE FUNCTION public.association_protect_membership_movement()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_fee public.association_membership_fees;
BEGIN
 SELECT * INTO v_fee FROM public.association_membership_fees
 WHERE movement_id=old.id LIMIT 1;
 IF NOT FOUND THEN RETURN CASE WHEN TG_OP='DELETE' THEN old ELSE new END; END IF;
 IF TG_OP='DELETE' THEN
   RAISE EXCEPTION 'movimento collegato a quota associativa: eliminazione vietata';
 END IF;
 IF NOT old.cancelled AND new.cancelled
    AND v_fee.cancelled
    AND v_fee.cancelled_by=new.updated_by
    AND v_fee.cancellation_reason=new.cancellation_reason
    AND (to_jsonb(new) - ARRAY['cancelled','cancellation_reason','updated_by','updated_at','version'])
      = (to_jsonb(old) - ARRAY['cancelled','cancellation_reason','updated_by','updated_at','version'])
 THEN RETURN new; END IF;
 RAISE EXCEPTION 'movimento collegato a quota associativa: usa la rettifica tracciata';
END $$;

CREATE OR REPLACE FUNCTION public.association_cancel_membership_fee(
 p_movement uuid, p_version integer, p_actor uuid, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_movement public.association_movements;
 v_fee public.association_membership_fees;
 v_after public.association_membership_fees;
BEGIN
 IF p_movement IS NULL OR p_actor IS NULL OR p_version IS NULL OR
    p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 500 THEN
   RAISE EXCEPTION 'dati di rettifica non validi' USING errcode='22023';
 END IF;
 SELECT * INTO v_movement FROM public.association_movements
   WHERE id=p_movement FOR UPDATE;
 IF NOT FOUND OR v_movement.cancelled OR v_movement.version<>p_version
 THEN RAISE EXCEPTION 'movimento gia annullato o modificato, aggiorna l elenco'
   USING errcode='40001'; END IF;
 SELECT * INTO v_fee FROM public.association_membership_fees
   WHERE movement_id=p_movement FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'nessuna quota collegata al movimento' USING errcode='22023'; END IF;
 IF v_fee.cancelled THEN RAISE EXCEPTION 'quota associativa gia annullata'
   USING errcode='40001'; END IF;
 -- Se l'email e' stata tentata o la ricevuta contabile e' gia' emessa,
 -- serve un'operazione manuale separata per non perdere la tracciabilita'.
 IF EXISTS (SELECT 1 FROM public.association_membership_receipt_deliveries
            WHERE fee_id=v_fee.id) THEN
   RAISE EXCEPTION 'ricevuta quota gia inviata o tentata: rettifica manuale necessaria'
    USING errcode='40001';
 END IF;
 IF EXISTS (SELECT 1 FROM public.association_receipts
            WHERE movement_id=p_movement AND NOT cancelled) THEN
   RAISE EXCEPTION 'annulla prima la ricevuta contabile collegata'
    USING errcode='40001';
 END IF;

 UPDATE public.association_membership_fees SET cancelled=true,
  cancellation_reason=trim(p_reason),cancelled_by=p_actor,cancelled_at=now()
  WHERE id=v_fee.id RETURNING * INTO v_after;
 UPDATE public.association_movements SET cancelled=true,
  cancellation_reason=trim(p_reason),updated_by=p_actor
  WHERE id=p_movement;
 INSERT INTO public.association_audit(entity,entity_id,actor_id,action,reason,before_data,after_data)
 VALUES('association_membership_fees',v_fee.id,p_actor,'cancel',
   trim(p_reason),to_jsonb(v_fee),to_jsonb(v_after));
 RETURN v_fee.id;
END $$;
REVOKE ALL ON FUNCTION public.association_cancel_membership_fee(uuid,integer,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.association_cancel_membership_fee(uuid,integer,uuid,text) TO service_role;

-- Le quote annullate non devono impedire nuovi versamenti reali.
CREATE OR REPLACE FUNCTION public.association_record_membership_fee(
 p_person uuid, p_year integer, p_cents bigint, p_paid_on date, p_account text, p_actor uuid
) RETURNS uuid
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_person public.association_register_people; v_movement uuid; v_fee uuid;
BEGIN
 SELECT * INTO v_person FROM public.association_register_people
  WHERE id=p_person AND register_kind='soci';
 IF NOT FOUND OR (v_person.ended_on IS NOT NULL AND v_person.ended_on<p_paid_on) THEN
  RAISE EXCEPTION 'socio non attivo alla data del pagamento'; END IF;
 IF p_year<extract(year FROM v_person.admitted_on)::integer
    OR p_year>extract(year FROM current_date)::integer+1
    OR p_year<2020 OR p_cents IS NULL OR p_cents<=0 OR p_cents>100000000
    OR p_paid_on IS NULL OR p_paid_on>current_date OR p_paid_on<v_person.admitted_on
    OR p_account NOT IN ('bank','cash') OR p_actor IS NULL THEN
  RAISE EXCEPTION 'dati della quota associativa non validi'; END IF;
 IF EXISTS(SELECT 1 FROM public.association_membership_fees
   WHERE person_id=p_person AND fee_year=p_year AND NOT cancelled) THEN
  RAISE EXCEPTION 'quota associativa gia registrata per questo anno' USING errcode='23505';
 END IF;
 INSERT INTO public.association_movements(date,kind,amount_cents,account,category,project,description,private_note,created_by,updated_by)
 VALUES(p_paid_on,'income',p_cents,p_account,'Quote associative','',
  'Quota associativa '||p_year::text||' - '||v_person.full_name,'',p_actor,p_actor)
 RETURNING id INTO v_movement;
 INSERT INTO public.association_membership_fees(person_id,fee_year,movement_id,amount_cents,paid_on,payment_account,created_by)
 VALUES(p_person,p_year,v_movement,p_cents,p_paid_on,p_account,p_actor)
 RETURNING id INTO v_fee;
 RETURN v_fee;
END $$;
REVOKE ALL ON FUNCTION public.association_record_membership_fee(uuid,integer,bigint,date,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.association_record_membership_fee(uuid,integer,bigint,date,text,uuid)
 TO service_role;
