import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db=new PGlite();
const schema=`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('11111111-1111-4111-8111-111111111111'); create table public.association_movements(id uuid primary key default gen_random_uuid(),date date not null,kind text not null,amount_cents bigint not null,account text not null,category text not null,project text not null,description text not null,private_note text not null,created_by uuid not null,updated_by uuid not null); create table public.association_receipts(id uuid primary key, movement_id uuid references public.association_movements(id)); create table public.association_audit(id bigint generated always as identity primary key,entity text,entity_id uuid,actor_id uuid,action text,after_data jsonb);`;
await db.exec(schema);
await db.exec(readFileSync(new URL('../supabase/migrations/20261127120448_anticipazioni_rimborsi.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20261127120537_anticipazioni_permesso_lock.sql',import.meta.url),'utf8'));
await db.exec('grant select,insert,update on public.association_movements to service_role; grant insert on public.association_receipts to service_role; grant insert on public.association_audit to service_role; grant usage,select on sequence public.association_audit_id_seq to service_role; set role service_role');
const actor='11111111-1111-4111-8111-111111111111',advance='22222222-2222-4222-8222-222222222222',p1='33333333-3333-4333-8333-333333333333',p2='44444444-4444-4444-8444-444444444444';
const create=`select public.association_create_advance('${advance}','${actor}','deposit','Presidente','2026-11-27',2000,'bank','Deposito da restituire','','Apertura conto')`;
await db.exec(create);await db.exec(create);
const pay=(id,n)=>`select public.association_reimburse_advance('${id}','${advance}','${actor}','2026-11-27',${n},'cash')`;
await db.exec(pay(p1,800));await db.exec(pay(p1,800));
try{await db.exec(pay(p2,1201));throw Error('overpayment accepted')}catch(e){if(!String(e).includes('superiore al residuo'))throw e;}
await db.exec(pay(p2,1200));
try{await db.exec(`update public.association_movements set amount_cents=100`);throw Error('update accepted')}catch(e){if(!String(e).includes('rettifica amministrativa'))throw e;}
try{await db.exec(`insert into public.association_receipts(id,movement_id) select gen_random_uuid(),id from public.association_movements where kind='income' limit 1`);throw Error('financial receipt accepted')}catch(e){if(!String(e).includes('non è una donazione'))throw e;}
const rows=(await db.query(`select kind,account,amount_cents,financial,advance_managed from public.association_movements order by amount_cents`)).rows;
if(rows.length!==3 || rows.filter(x=>x.financial&&x.advance_managed).length!==3)throw Error(JSON.stringify(rows));
const a2='55555555-5555-4555-8555-555555555555',p3='66666666-6666-4666-8666-666666666666';
await db.exec(`select public.association_create_advance('${a2}','${actor}','expense','Volontario','2026-11-27',3000,'bank','Materiali','Laboratorio','Acquisto colori')`);
await db.exec(`select public.association_reimburse_advance('${p3}','${a2}','${actor}','2026-11-27',1200,'bank')`);
const spend=(await db.query(`select financial,category,project from public.association_movements where description like 'Rimborso a Volontario%'`)).rows[0];
if(spend.financial||spend.category!=='Materiali'||spend.project!=='Laboratorio')throw Error(JSON.stringify(spend));
console.log('PASS: deposit, partial reimbursements, idempotency, overpayment rejection, immutable movements, expense classification');await db.close();
