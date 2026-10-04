#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$HOME/projects/dfl-entregas"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$HOME/storage/downloads/dfl-entregas-backups/operacao-ifood-rotas-$STAMP"
mkdir -p "$BACKUP"

REQ=(lib/ifood-order-parser.ts lib/route-stops.ts lib/route-intelligence.ts hooks/useOptimizedDeliveries.ts components/home/RouteAccordion.tsx store/useAppStore.ts)
for f in "${REQ[@]}"; do
  [ -f "$f" ] || { echo "ABORTADO: ausente $f"; exit 1; }
  mkdir -p "$BACKUP/$(dirname "$f")"; cp -a "$f" "$BACKUP/$f"
done

python - <<'PY'
from pathlib import Path
import re
def R(p): return Path(p).read_text()
def W(p,s): Path(p).write_text(s)

# 1. Parser iFood V4: cabeçalhos tolerantes + fuzzy seguro de clientes conhecidos.
p="lib/ifood-order-parser.ts"; s=R(p)
old="""const IFOOD_HEADER =
  /^\\s*#?(\\d{4})\\s+(\\d{8})\\s*$/;

function explicitIfoodHeader(line: string) {
  const match = line.match(IFOOD_HEADER);
  if (!match) return null;

  return {
    orderId: match[1],
    ifoodId: match[2],
  };
}"""
new="""const IFOOD_HEADER_PATTERNS = [
  /^\\s*#?(\\d{3,6})\\s+(\\d{8})\\s*$/,
  /^\\s*#?(\\d{3,6})\\s*[-–—|•·:]\\s*(\\d{8})\\s*$/,
  /^\\s*(?:pedido|n[º°o.]?\\s*(?:do\\s+)?pedido)\\s*[:#-]?\\s*#?(\\d{3,6})\\b[\\s\\S]{0,28}?\\b(?:id\\s*(?:ifood|do\\s+ifood|do\\s+pedido)?|ifood\\s+id)\\s*[:#-]?\\s*(\\d{8})\\s*$/i,
];

function explicitIfoodHeader(line: string) {
  for (const pattern of IFOOD_HEADER_PATTERNS) {
    const match = line.match(pattern);
    if (match) return { orderId: match[1], ifoodId: match[2] };
  }
  return null;
}"""
if old not in s: raise SystemExit("ABORTADO parser: cabeçalho mudou")
s=s.replace(old,new)

needle="""function longestKnownMatch(
  source: string,
  values: string[] = [],
) {
  const haystack = ` ${normalizedComparable(source)} `;

  return [...values]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => {
      const needle = normalizedComparable(candidate);
      return needle.length >= 3 && haystack.includes(` ${needle} `);
    }) || '';
}"""
repl="""function editDistance(a: string, b: string) {
  const left = normalizedComparable(a);
  const right = normalizedComparable(b);
  const row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const hold = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (left[i - 1] === right[j - 1] ? 0 : 1));
      prev = hold;
    }
  }
  return row[right.length];
}

function longestKnownMatch(source: string, values: string[] = []) {
  const comparable = normalizedComparable(source);
  const haystack = ` ${comparable} `;
  const exact = [...values].filter(Boolean).sort((a,b)=>b.length-a.length).find(candidate => {
    const needle = normalizedComparable(candidate);
    return needle.length >= 3 && haystack.includes(` ${needle} `);
  });
  if (exact) return exact;

  // Fuzzy conservador: acento/pontuação já foram removidos; aqui toleramos
  // um pequeno erro de digitação apenas quando a linha parece ser um nome.
  if (!comparable || comparable.length < 4 || comparable.length > 48 || /\\d/.test(comparable)) return '';
  let best = ''; let bestScore = 0;
  for (const candidate of values.filter(Boolean)) {
    const target = normalizedComparable(candidate);
    if (target.length < 4 || Math.abs(target.length - comparable.length) > 3) continue;
    const distance = editDistance(comparable, target);
    const score = 1 - distance / Math.max(comparable.length, target.length);
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return bestScore >= 0.84 ? best : '';
}"""
if needle not in s: raise SystemExit("ABORTADO parser: known match mudou")
s=s.replace(needle,repl)

# Multiple order segmentation: only authoritative headers/explicit IDs; no arbitrary 8-digit fallback.
old="""        ifoodId:
          header?.ifoodId ||
          explicitIfoodId(line) ||
          safeEightDigitCandidate(line),"""
new="""        ifoodId:
          header?.ifoodId ||
          explicitIfoodId(line),"""
if old not in s: raise SystemExit("ABORTADO parser: segmentador mudou")
s=s.replace(old,new)
W(p,s)

# 2. Urgência é regra operacional soberana, inclusive quando há ordem manual.
p="lib/route-stops.ts"; s=R(p)
old="""  // Urgência atua somente na fila automática. Uma parada que já recebeu
  // ordem manual continua exatamente onde o operador a colocou.
  if (result.some((group) =>
    group.deliveries.some((delivery) => delivery.order_source === 'manual'),
  )) return result;
  const automatic = result.filter((group) =>
    group.deliveries.every((delivery) => delivery.order_source !== 'manual'),
  );
  const urgentKeys = new Set(automatic.filter((group) => group.urgent).map((group) => group.key));
  if (!urgentKeys.size) return result;

  const urgent = result.filter((group) => urgentKeys.has(group.key));
  const remaining = result.filter((group) => !urgentKeys.has(group.key));
  return [...urgent, ...remaining];"""
new="""  // Regra operacional V4: urgência é soberana. Ordem manual continua
  // preservada DENTRO dos blocos urgente/normal, mas nunca deixa uma
  // entrega urgente escondida no meio/fim da rota.
  const urgent = result.filter((group) => group.urgent);
  if (!urgent.length) return result;
  const normal = result.filter((group) => !group.urgent);
  return [...urgent, ...normal];"""
if old not in s: raise SystemExit("ABORTADO route-stops: regra urgência mudou")
s=s.replace(old,new)
W(p,s)

# 3. RouteAccordion: expansão operacional persistente sem Firestore.
p="components/home/RouteAccordion.tsx"; s=R(p)
s=s.replace("import { useMemo, useState } from 'react';","import { useEffect, useMemo, useState } from 'react';")
old="  const [isOpen, setIsOpen] = useState(defaultOpen);"
new="""  const [isOpen, setIsOpen] = useState(defaultOpen);
  const routeUiKey = 'dfl-route-last-open-v2';"""
if old not in s: raise SystemExit("ABORTADO accordion: state mudou")
s=s.replace(old,new,1)
anchor="""  const isCompleted = route.status === 'fechada';

  const motoboyObj"""
inject="""  const isCompleted = route.status === 'fechada';

  useEffect(() => {
    if (isVirtualRoute || typeof window === 'undefined') return;
    const remembered = localStorage.getItem(routeUiKey);
    const rememberedExists = remembered && allRoutes.some((item) => item.id === remembered && item.status !== 'fechada');
    const assembling = allRoutes.filter((item) => item.status === 'aberta' && !routeStartedAt(item) && !isSyntheticOperationalRoute(item));
    const running = allRoutes.filter((item) => item.status === 'aberta' && Boolean(routeStartedAt(item)) && !isSyntheticOperationalRoute(item));
    const preferred = rememberedExists
      ? remembered
      : assembling[0]?.id || running[0]?.id || null;
    setIsOpen(defaultOpen || preferred === route.id);
  }, [allRoutes, defaultOpen, isVirtualRoute, route.id]);

  const toggleRouteOpen = () => {
    setIsOpen((previous) => {
      const next = !previous;
      if (typeof window !== 'undefined' && next && !isVirtualRoute) localStorage.setItem(routeUiKey, route.id);
      return next;
    });
  };

  const motoboyObj"""
if anchor not in s: raise SystemExit("ABORTADO accordion: status anchor mudou")
s=s.replace(anchor,inject,1)
s=s.replace('<button onClick={() => setIsOpen((prev) => !prev)} className="grid w-full', '<button onClick={toggleRouteOpen} className="grid w-full',1)
W(p,s)

# 4. Auto-organização local: visual/order grouping always honors urgent;
#    optimized hook becomes memo-safe and keeps same-stop behavior.
p="hooks/useOptimizedDeliveries.ts"; s=R(p)
s=s.replace("  const groups = groupDeliveriesByStop(deliveries);\n  const sortedDeliveries = groups.flatMap((group) => group.deliveries);",
"""  const groups = groupDeliveriesByStop(deliveries);
  // groupDeliveriesByStop já aplica a prioridade operacional. Não há leitura
  // remota nem geocoding aqui: montar/editar a rota permanece instantâneo.
  const sortedDeliveries = groups.flatMap((group) => group.deliveries);""")
W(p,s)

# 5. Add delivery: assign cheap local order index so urgent enters at top and
#    normal enters at tail; no reads and no rewrite of existing docs.
p="store/useAppStore.ts"; s=R(p)
old="""      addDelivery: async (delivery) => {
        const now = new Date().toISOString();
        const deliveryWithTimestamp = {
          ...delivery,
          createdAt: delivery.createdAt || delivery.created_at || now,
          created_at: delivery.created_at || delivery.createdAt || now,
          updated_at: now
        } as Delivery;"""
new="""      addDelivery: async (delivery) => {
        const now = new Date().toISOString();
        const siblings = get().deliveries.filter((item) => item.route_id === delivery.route_id && !item.completed);
        const siblingIndexes = siblings.map((item) => item.order_index).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        const minIndex = siblingIndexes.length ? Math.min(...siblingIndexes) : 0;
        const maxIndex = siblingIndexes.length ? Math.max(...siblingIndexes) : -1;
        const automaticIndex = delivery.is_urgent ? minIndex - 1 : maxIndex + 1;
        const deliveryWithTimestamp = {
          ...delivery,
          order_index: delivery.order_index ?? automaticIndex,
          order_source: delivery.order_source || 'smart',
          order_updated_at: delivery.order_updated_at || now,
          createdAt: delivery.createdAt || delivery.created_at || now,
          created_at: delivery.created_at || delivery.createdAt || now,
          updated_at: now
        } as Delivery;"""
if old not in s: raise SystemExit("ABORTADO store: addDelivery mudou")
s=s.replace(old,new,1)

old="""        const prepared = items.map((delivery) => ({
          ...delivery,
          createdAt: delivery.createdAt || delivery.created_at || now,
          created_at: delivery.created_at || delivery.createdAt || now,
          updated_at: now,
        } as Delivery));"""
new="""        const routeTail = new Map<string, number>();
        get().deliveries.filter((item)=>!item.completed).forEach((item)=>{
          const current=routeTail.get(item.route_id) ?? -1;
          routeTail.set(item.route_id, Math.max(current, item.order_index ?? current));
        });
        const prepared = items.map((delivery, position) => {
          const tail = routeTail.get(delivery.route_id) ?? -1;
          const nextIndex = delivery.is_urgent ? -1000000 + position : tail + 1;
          if (!delivery.is_urgent) routeTail.set(delivery.route_id, nextIndex);
          return {
            ...delivery,
            order_index: delivery.order_index ?? nextIndex,
            order_source: delivery.order_source || 'smart',
            order_updated_at: delivery.order_updated_at || now,
            createdAt: delivery.createdAt || delivery.created_at || now,
            created_at: delivery.created_at || delivery.createdAt || now,
            updated_at: now,
          } as Delivery;
        });"""
if old not in s: raise SystemExit("ABORTADO store: addDeliveries mudou")
s=s.replace(old,new,1)
W(p,s)

# 6. Extra: parser diagnostics utility, useful in UI/tests without reads.
W("lib/ifood-parser-quality.ts",r"""import type { ParsedIfoodOrder } from '@/lib/ifood-order-parser';

export type IfoodParseQuality = {
  complete: number;
  review: number;
  issues: Array<{ index: number; fields: string[] }>;
};

export function assessIfoodParseQuality(orders: ParsedIfoodOrder[]): IfoodParseQuality {
  const issues = orders.map((order,index)=>{
    const fields:string[]=[];
    if(!order.ifoodId) fields.push('ID iFood');
    if(!order.orderId) fields.push('pedido');
    if(!order.customerName) fields.push('cliente');
    if(!order.address && !order.mapsLink) fields.push('endereço');
    return {index,fields};
  }).filter(item=>item.fields.length>0);
  return {complete:orders.length-issues.length,review:issues.length,issues};
}
""")
PY

cat > scripts/verify-operation-ifood-routes-v1.cjs <<'NODE'
const fs=require('fs');
const checks=[
 ['lib/ifood-order-parser.ts',['IFOOD_HEADER_PATTERNS','editDistance','bestScore >= 0.84','explicitIfoodId(line),']],
 ['lib/route-stops.ts',['urgência é soberana','const urgent = result.filter']],
 ['components/home/RouteAccordion.tsx',['dfl-route-last-open-v2','toggleRouteOpen','localStorage.setItem']],
 ['store/useAppStore.ts',['automaticIndex','-1000000 + position',"order_source: delivery.order_source || 'smart'"]],
 ['lib/ifood-parser-quality.ts',['assessIfoodParseQuality','ID iFood']]
];
let bad=0;
for(const [f,needles] of checks){if(!fs.existsSync(f)){console.error('AUSENTE',f);bad++;continue}const s=fs.readFileSync(f,'utf8');for(const n of needles)if(!s.includes(n)){console.error('FALHOU',f,n);bad++}}
if(bad)process.exit(1);
console.log('OK: contratos Operação/iFood/Rotas presentes');
NODE

cat > scripts/audit-operation-ifood-routes-firestore.cjs <<'NODE'
const fs=require('fs');
for(const f of ['lib/ifood-order-parser.ts','lib/ifood-parser-quality.ts','lib/route-stops.ts','hooks/useOptimizedDeliveries.ts','components/home/RouteAccordion.tsx']){
 const s=fs.readFileSync(f,'utf8');
 if(/\b(getDocs|getDoc|onSnapshot)\s*\(/.test(s)){console.error('Consulta Firestore direta nova em',f);process.exit(1)}
}
console.log('OK: parser, agrupamento, expansão e ordenação visual não consultam Firestore');
NODE

echo "=== CONTRATOS ==="
node scripts/verify-operation-ifood-routes-v1.cjs
echo "=== FIRESTORE GUARD ==="
node scripts/audit-operation-ifood-routes-firestore.cjs
echo "=== TYPESCRIPT ==="
node node_modules/typescript/bin/tsc --noEmit
echo "=== DIFF CHECK ==="
git diff --check
echo "=== RESUMO ==="
git diff --stat
echo
echo "SUPER CIRURGIA OPERAÇÃO / IFOOD / ROTAS APLICADA"
echo "Backup: $BACKUP"
echo "Sem build, commit ou push."
