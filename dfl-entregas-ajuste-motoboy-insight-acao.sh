#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PROJECT="$HOME/storage/shared/Documents/dfl-entregas"
cd "$PROJECT"

echo "=== DFL ENTREGAS — AJUSTE MOTOboy + AÇÃO DO INSIGHT ==="
echo "Projeto: $PWD"

test "$PWD" = "$PROJECT" || { echo "ERRO: diretório incorreto."; exit 1; }

for file in components/motoboys/MotoboyForm.tsx components/home/OperationalRadar.tsx; do
  test -f "$file" || { echo "ERRO: arquivo ausente: $file"; exit 1; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/ajuste-motoboy-insight-$STAMP"
mkdir -p "$BACKUP/components/motoboys" "$BACKUP/components/home"
cp components/motoboys/MotoboyForm.tsx "$BACKUP/components/motoboys/MotoboyForm.tsx"
cp components/home/OperationalRadar.tsx "$BACKUP/components/home/OperationalRadar.tsx"

python <<'PY'
from pathlib import Path

def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERRO {label}: esperado 1 ocorrência, encontrado {count}.")
    p.write_text(text.replace(old, new, 1))

# ------------------------------------------------------------
# 1) Motoboy — alinhar campos do grid
# ------------------------------------------------------------
p = Path("components/motoboys/MotoboyForm.tsx")
t = p.read_text()

old = """      {ruleType==='fixed'&&<MoneyField label="Valor da diária" value={fixed} setValue={setFixed}/>} {ruleType==='per_delivery'&&<MoneyField label="Valor por entrega" value={rate} setValue={setRate}/>} {ruleType==='fixed_plus_variable'&&<div className="mt-4 grid grid-cols-2 gap-3"><MoneyField label="Base fixa" value={fixed} setValue={setFixed}/><label className="text-[10px] font-bold text-zinc-500">Entregas inclusas<input type="number" min="0" value={threshold} onChange={event=>setThreshold(event.target.value)} className="field mt-1"/></label><div className="col-span-2"><MoneyField label="Valor por entrega extra" value={extra} setValue={setExtra}/></div></div>}"""

new = """      {ruleType==='fixed'&&<div className="mt-4"><MoneyField label="Valor da diária" value={fixed} setValue={setFixed}/></div>} {ruleType==='per_delivery'&&<div className="mt-4"><MoneyField label="Valor por entrega" value={rate} setValue={setRate}/></div>} {ruleType==='fixed_plus_variable'&&<div className="mt-4 grid grid-cols-2 gap-3"><MoneyField label="Base fixa" value={fixed} setValue={setFixed}/><label className="block text-[10px] font-bold text-zinc-500">Entregas inclusas<input type="number" min="0" value={threshold} onChange={event=>setThreshold(event.target.value)} className="field mt-1"/></label><div className="col-span-2 mt-1"><MoneyField label="Valor por entrega extra" value={extra} setValue={setExtra}/></div></div>}"""

if old not in t:
    raise SystemExit("ERRO: bloco das regras de pagamento não encontrado.")
t = t.replace(old, new, 1)

old_money_label = """    <label className="mt-4 block text-[10px] font-bold text-zinc-500">"""
new_money_label = """    <label className="block text-[10px] font-bold text-zinc-500">"""

if old_money_label not in t:
    raise SystemExit("ERRO: margem antiga do MoneyField não encontrada.")
t = t.replace(old_money_label, new_money_label, 1)

p.write_text(t)

# ------------------------------------------------------------
# 2) Radar — leitura completa -> Relatórios
#    + ação direta para revisar a rota principal
# ------------------------------------------------------------
p = Path("components/home/OperationalRadar.tsx")
t = p.read_text()

old_click = """            onClick={() => router.push('/loja')}"""
new_click = """            onClick={() => router.push('/relatorios')}"""

if old_click not in t:
    raise SystemExit("ERRO: destino antigo /loja do Radar não encontrado.")
t = t.replace(old_click, new_click, 1)

old_buttons = """          <button
            type="button"
            onClick={() => hideForToday(signal.id)}
            className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-3 text-[9px] font-black text-zinc-600 active:scale-95"
          >
            <EyeOff size={13} />
            Ocultar por hoje
          </button>"""

new_buttons = """          <div className="mt-3 flex flex-wrap gap-2">
            {signal.entityIds?.[0] && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/rotas/details?id=${encodeURIComponent(signal.entityIds![0])}`,
                  )
                }
                className="flex h-9 items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 text-[9px] font-black text-amber-400 active:scale-95"
              >
                Revisar rota
              </button>
            )}

            <button
              type="button"
              onClick={() => hideForToday(signal.id)}
              className="flex h-9 items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-3 text-[9px] font-black text-zinc-600 active:scale-95"
            >
              <EyeOff size={13} />
              Ocultar por hoje
            </button>
          </div>"""

if old_buttons not in t:
    raise SystemExit("ERRO: botão Ocultar por hoje do Radar não encontrado.")
t = t.replace(old_buttons, new_buttons, 1)

p.write_text(t)

print("Ajustes escritos.")
PY

echo
echo "=== DIFF CHECK ==="
git diff --check -- components/motoboys/MotoboyForm.tsx components/home/OperationalRadar.tsx

echo
echo "=== TYPESCRIPT ==="
rm -rf .next
node ./node_modules/typescript/bin/tsc --noEmit

echo
echo "=== GUARDAS ==="
grep -n -E "Base fixa|Entregas inclusas|Valor por entrega extra" components/motoboys/MotoboyForm.tsx
grep -n -E "router.push\('/relatorios'\)|Revisar rota|Ocultar por hoje|rotas/details" components/home/OperationalRadar.tsx

echo
echo "=== DIFF STAT ==="
git diff --stat

echo
echo "=== STATUS TRACKED ==="
git status --short --untracked-files=no

echo
echo "AJUSTE CONCLUÍDO."
echo "Backup: $BACKUP"
echo "Nenhum commit ou push foi feito."
