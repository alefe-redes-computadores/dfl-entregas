#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PROJECT="$HOME/storage/shared/Documents/dfl-entregas"
cd "$PROJECT"

echo "=== DFL ENTREGAS — MODAL CONFIRMAÇÕES / FECHAR FORA ==="
echo "Projeto: $PWD"

test "$PWD" = "$PROJECT" || { echo "ERRO: diretório incorreto."; exit 1; }

FILE="app/confirmacoes/page.tsx"
test -f "$FILE" || { echo "ERRO: $FILE não encontrado."; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/modal-confirmacoes-fechar-fora-$STAMP"
mkdir -p "$BACKUP/app/confirmacoes"
cp "$FILE" "$BACKUP/$FILE"

python <<'PY'
from pathlib import Path

p = Path("app/confirmacoes/page.tsx")
t = p.read_text()

old = '<div className="fixed inset-0 z-[120] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center">\n          <div className="w-full max-w-lg rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">'

new = '''<div
          className="fixed inset-0 z-[120] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          onClick={() => setIsBatchOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >'''

count = t.count(old)
if count != 1:
    raise SystemExit(f"ERRO: esperado 1 bloco do modal, encontrado {count}. Nada foi escrito.")

p.write_text(t.replace(old, new, 1))
print("Backdrop do modal atualizado.")
PY

echo
echo "=== DIFF CHECK ==="
git diff --check -- "$FILE"

echo
echo "=== TYPESCRIPT ==="
rm -rf .next
node ./node_modules/typescript/bin/tsc --noEmit

echo
echo "=== GUARDA ==="
grep -n -C 3 -E "setIsBatchOpen\(false\)|stopPropagation" "$FILE" | tail -n 40

echo
echo "=== DIFF DO MODAL ==="
git diff -- "$FILE"

echo
echo "MODAL CORRIGIDO."
echo "Backup: $BACKUP"
echo "Nenhum commit ou push foi feito."
