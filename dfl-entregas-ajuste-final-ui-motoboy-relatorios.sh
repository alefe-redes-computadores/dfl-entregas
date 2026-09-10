#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PROJECT="$HOME/storage/shared/Documents/dfl-entregas"
cd "$PROJECT"

echo "=== DFL ENTREGAS — AJUSTE FINAL UI / MOTOBOY / RELATÓRIOS ==="
echo "Projeto: $PWD"

test "$PWD" = "$PROJECT" || { echo "ERRO: diretório incorreto."; exit 1; }

required=(
  "app/clientes/page.tsx"
  "app/motoboys/editar/page.tsx"
  "components/motoboys/MotoboyForm.tsx"
  "components/reports/SummaryCard.tsx"
  "lib/delivery-intelligence/buildOperationalMemory.ts"
)

for file in "${required[@]}"; do
  test -f "$file" || { echo "ERRO: arquivo ausente: $file"; exit 1; }
done

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "ERRO: existem alterações TRACKED não commitadas."
  git status --short --untracked-files=no
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/ajuste-final-ui-$STAMP"

for file in "${required[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$file")"
  cp "$file" "$BACKUP/$file"
done

python <<'PY'
from pathlib import Path

def once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERRO {label}: esperado 1 ocorrência em {path}, encontrado {count}")
    p.write_text(text.replace(old, new, 1))

# ------------------------------------------------------------
# CLIENTES — botão de voltar explícito e determinístico.
# ------------------------------------------------------------
p = Path("app/clientes/page.tsx")
t = p.read_text()

once(
    "app/clientes/page.tsx",
    "import { ChevronRight, Crown, MapPin, MessageCircle, PackageOpen, Plus, Search, Smartphone, Store, Trophy, UserRound } from 'lucide-react';",
    "import { ChevronLeft, ChevronRight, Crown, MapPin, MessageCircle, PackageOpen, Plus, Search, Smartphone, Store, Trophy, UserRound } from 'lucide-react';",
    "import ChevronLeft",
)

old_header = """    <header className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-500">Relacionamento</p><h1 className="font-heading text-2xl font-bold text-zinc-50">Clientes</h1></div><button onClick={()=>router.push('/clientes/novo')} className="flex h-11 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-zinc-950"><Plus size={18}/>Novo</button></header>"""

new_header = """    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => router.replace('/loja')}
          aria-label="Voltar para Minha Loja"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300 active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-500">
            Relacionamento
          </p>
          <h1 className="truncate font-heading text-2xl font-bold text-zinc-50">
            Clientes
          </h1>
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push('/clientes/novo')}
        className="flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-emerald-500 px-4 text-sm font-black text-zinc-950 active:scale-95"
      >
        <Plus size={18} />
        Novo
      </button>
    </header>"""

if old_header not in t:
    raise SystemExit("ERRO: header atual de Clientes não encontrado.")
t = t.replace(old_header, new_header, 1)
p.write_text(t)

# ------------------------------------------------------------
# MOTOBOY FORM — não enviar undefined dentro de payment_rule
# e corrigir visual dos campos monetários.
# ------------------------------------------------------------
p = Path("components/motoboys/MotoboyForm.tsx")
t = p.read_text()

old_rule = """  const buildRule=():MotoboyPaymentRule|undefined=>ruleType?{type:ruleType,fixed_amount:ruleType!=='per_delivery'?moneyNumber(fixed):undefined,delivery_fee:ruleType==='per_delivery'?moneyNumber(rate):undefined,threshold:ruleType==='fixed_plus_variable'?Number(threshold)||0:undefined,extra_fee:ruleType==='fixed_plus_variable'?moneyNumber(extra):undefined}:undefined;"""

new_rule = """  const buildRule = (): MotoboyPaymentRule | undefined => {
    if (!ruleType) return undefined;

    if (ruleType === 'fixed') {
      return {
        type: 'fixed',
        fixed_amount: moneyNumber(fixed),
      };
    }

    if (ruleType === 'per_delivery') {
      return {
        type: 'per_delivery',
        delivery_fee: moneyNumber(rate),
      };
    }

    return {
      type: 'fixed_plus_variable',
      fixed_amount: moneyNumber(fixed),
      threshold: Number(threshold) || 0,
      extra_fee: moneyNumber(extra),
    };
  };"""

if old_rule not in t:
    raise SystemExit("ERRO: buildRule atual não encontrado.")
t = t.replace(old_rule, new_rule, 1)

old_money = """function MoneyField({label,value,setValue}:{label:string;value:string;setValue:(value:string)=>void}){return <label className="mt-4 block text-[10px] font-bold text-zinc-500">{label}<div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">R$</span><input value={value} onChange={event=>setValue(moneyInput(event.target.value))} inputMode="numeric" placeholder="0,00" className="field pl-10"/></div></label>;}"""

new_money = """function MoneyField({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <label className="mt-4 block text-[10px] font-bold text-zinc-500">
      {label}
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
          R$
        </span>
        <input
          value={value}
          onChange={(event) => setValue(moneyInput(event.target.value))}
          inputMode="numeric"
          placeholder="0,00"
          className="h-[3.25rem] w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 pl-11 pr-4 text-sm font-bold text-zinc-100 outline-none transition focus:border-sky-500"
        />
      </div>
    </label>
  );
}"""

if old_money not in t:
    raise SystemExit("ERRO: MoneyField atual não encontrado.")
t = t.replace(old_money, new_money, 1)

p.write_text(t)

# ------------------------------------------------------------
# EDITAR MOTOBOY — retorno determinístico e erro mais informativo.
# ------------------------------------------------------------
p = Path("app/motoboys/editar/page.tsx")
t = p.read_text()

old_save = """const save=async(value:MotoboyFormValue)=>{setBusy(true);try{await update(motoboy.id,value);toast.success('Cadastro atualizado.');router.push(`/motoboys/details?id=${motoboy.id}`);}catch{toast.error('Não foi possível salvar.');}finally{setBusy(false);}};"""

new_save = """const save=async(value:MotoboyFormValue)=>{setBusy(true);try{await update(motoboy.id,value);toast.success('Cadastro atualizado.');router.replace(`/motoboys/details?id=${motoboy.id}`);}catch(error){console.error('Erro ao atualizar entregador:',error);toast.error('Não foi possível salvar.',{description:error instanceof Error?error.message:'Tente novamente.'});}finally{setBusy(false);}};"""

if old_save not in t:
    raise SystemExit("ERRO: save de editar motoboy não encontrado.")
t = t.replace(old_save, new_save, 1)
p.write_text(t)

# ------------------------------------------------------------
# RELATÓRIOS — valores financeiros sem quebra grotesca.
# ------------------------------------------------------------
p = Path("components/reports/SummaryCard.tsx")
t = p.read_text()

old_value = """          <div className="mt-2 break-words text-2xl font-black tracking-tight text-zinc-100">
            {value}
          </div>"""

new_value = """          <div
            className="mt-2 whitespace-nowrap text-[clamp(1.45rem,6.2vw,2rem)] font-black tracking-tight text-zinc-100"
            title={String(value)}
          >
            {value}
          </div>"""

if old_value not in t:
    raise SystemExit("ERRO: bloco de valor do SummaryCard não encontrado.")
t = t.replace(old_value, new_value, 1)
p.write_text(t)

# ------------------------------------------------------------
# INTELIGÊNCIA — gramática explícita.
# ------------------------------------------------------------
p = Path("lib/delivery-intelligence/buildOperationalMemory.ts")
t = p.read_text()

old_summary = """      summary: `${contextualAnomalies.length} rota${contextualAnomalies.length === 1 ? '' : 's'} ficou${contextualAnomalies.length === 1 ? '' : 'ram'} bem acima da mediana do próprio grupo de paradas.`,"""

new_summary = """      summary:
        contextualAnomalies.length === 1
          ? '1 rota ficou bem acima da mediana do próprio grupo de paradas.'
          : `${contextualAnomalies.length} rotas ficaram bem acima da mediana do próprio grupo de paradas.`,"""

if old_summary not in t:
    raise SystemExit("ERRO: summary contextual do insight não encontrado.")
t = t.replace(old_summary, new_summary, 1)
p.write_text(t)

print("Transformações aplicadas.")
PY

echo
echo "=== DIFF CHECK ==="
git diff --check

echo
echo "=== TYPESCRIPT ==="
node ./node_modules/typescript/bin/tsc --noEmit

echo
echo "=== GUARDAS ==="
grep -n -E "router\.replace\('/loja'\)|ChevronLeft" app/clientes/page.tsx | head -n 20
grep -n -E "type: 'fixed'|type: 'per_delivery'|type: 'fixed_plus_variable'|bg-zinc-900/60" components/motoboys/MotoboyForm.tsx
grep -n -E "whitespace-nowrap|clamp" components/reports/SummaryCard.tsx
grep -n -E "rotas ficaram|1 rota ficou" lib/delivery-intelligence/buildOperationalMemory.ts

echo
echo "=== DIFF STAT ==="
git diff --stat

echo
echo "=== STATUS TRACKED ==="
git status --short --untracked-files=no

echo
echo "AJUSTE FINAL APLICADO."
echo "Backup: $BACKUP"
echo "Ainda NÃO foi feito commit nem push."
