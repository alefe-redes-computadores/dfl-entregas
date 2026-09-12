#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$HOME/storage/shared/Documents/dfl-entregas"
cd "$ROOT"

echo "============================================================"
echo " DFL ENTREGAS — CIRURGIA 1"
echo " ESTOQUE + COMPRAS + PERFORMANCE V1"
echo "============================================================"

echo
echo "== 1/8 PRE-FLIGHT =="

[[ "$(pwd)" == "$ROOT" ]] || {
  echo "ABORTADO: diretório incorreto: $(pwd)"
  exit 1
}

for f in \
  package.json \
  store/useAppStore.ts \
  components/layout/Header.tsx \
  components/stock-supplies/StockSupplyForm.tsx \
  components/stock-supplies/StockSupplierPicker.tsx \
  app/abastecimentos/novo/page.tsx \
  app/abastecimentos/editar/page.tsx
do
  [[ -f "$f" ]] || {
    echo "ABORTADO: arquivo obrigatório ausente: $f"
    exit 1
  }
done

if ! grep -q '"next": "14.2.5"' package.json; then
  echo "ABORTADO: package.json não corresponde ao projeto auditado."
  exit 1
fi

if ! grep -q "feat: overhaul stock quantities categories and movements" <(git log -1 --pretty=%s); then
  echo "AVISO: HEAD mudou desde a tomografia:"
  git log -1 --oneline
  echo
  echo "As guardas textuais abaixo decidirão se a cirurgia continua."
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ABORTADO: existem alterações rastreadas antes da cirurgia."
  git status --short
  echo
  echo "Faça commit/stash antes de operar."
  exit 1
fi

echo "Pre-flight OK."
git log -1 --oneline

echo
echo "== 2/8 BACKUP =="

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".dfl-backups/cirurgia1-estoque-performance-$STAMP"
mkdir -p "$BACKUP"

cp --parents \
  store/useAppStore.ts \
  components/layout/Header.tsx \
  components/stock-supplies/StockSupplyForm.tsx \
  components/stock-supplies/StockSupplierPicker.tsx \
  app/abastecimentos/novo/page.tsx \
  app/abastecimentos/editar/page.tsx \
  "$BACKUP"

echo "Backup: $BACKUP"

echo
echo "== 3/8 APLICANDO CIRURGIA =="

node <<'NODE'
const fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, value) {
  fs.writeFileSync(file, value, 'utf8');
  console.log('ALTERADO:', file);
}

function once(source, before, after, label) {
  const hits = source.split(before).length - 1;

  if (hits !== 1) {
    throw new Error(
      `${label}: esperado 1 trecho, encontrado ${hits}. Cirurgia abortada.`,
    );
  }

  return source.replace(before, after);
}

/* ==========================================================
 * 1. STORE
 * - impede initData concorrente
 * - rastreia persistência pendente de compras
 * - integração/estorno aguardam save pendente
 * - rollback de compra fica localizado no registro
 * ========================================================== */

{
  const file = 'store/useAppStore.ts';
  let src = read(file);

  src = once(
    src,
`const defaultSchedule = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map(day => [
    day,
    { active: day !== 1, shifts: [{ start: '18:00', end: '23:59' }] }
  ])
);`,
`const defaultSchedule = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map(day => [
    day,
    { active: day !== 1, shifts: [{ start: '18:00', end: '23:59' }] }
  ])
);

/**
 * Compras usam atualização otimista no Zustand.
 *
 * Guardamos a Promise de persistência por compra para impedir uma corrida:
 * o usuário pode sair da tela imediatamente após salvar, mas uma eventual
 * integração/estorno sempre espera a gravação anterior chegar ao Firestore.
 */
const pendingStockSupplyWrites = new Map<string, Promise<void>>();

const trackStockSupplyWrite = (
  id: string,
  operation: Promise<void>,
): Promise<void> => {
  const tracked = operation.finally(() => {
    if (pendingStockSupplyWrites.get(id) === tracked) {
      pendingStockSupplyWrites.delete(id);
    }
  });

  pendingStockSupplyWrites.set(id, tracked);
  return tracked;
};

const waitForStockSupplyWrite = async (id: string) => {
  const pending = pendingStockSupplyWrites.get(id);

  if (pending) {
    await pending;
  }
};`,
    'infra de persistência das compras',
  );

  src = once(
    src,
`      initData: async () => {
        if (!get().hasHydrated) return;
        set({ isSyncing: true, syncError: false });`,
`      initData: async () => {
        if (!get().hasHydrated) return;

        // Header/AuthGuard ou duas montagens React não podem iniciar
        // duas tomografias completas do Firestore ao mesmo tempo.
        if (get().isSyncing) return;

        set({ isSyncing: true, syncError: false });`,
    'proteção de initData concorrente',
  );

  src = once(
    src,
`      addStockSupply: async (supply) => {
        const now = new Date().toISOString();
        const next: StockSupply = { ...supply, created_at: supply.created_at || now, updated_at: now };
        set((state) => ({ stockSupplies: [next, ...state.stockSupplies] }));
        try {
          await setDoc(doc(db, 'stock_supplies', next.id), sanitizeForFirebase(next));
        } catch (error) {
          set((state) => ({ stockSupplies: state.stockSupplies.filter((item) => item.id !== next.id) }));
          throw error;
        }
      },`,
`      addStockSupply: async (supply) => {
        const now = new Date().toISOString();
        const next: StockSupply = {
          ...supply,
          created_at: supply.created_at || now,
          updated_at: now,
        };

        set((state) => ({
          stockSupplies: [next, ...state.stockSupplies],
        }));

        const operation = setDoc(
          doc(db, 'stock_supplies', next.id),
          sanitizeForFirebase(next),
        ).catch((error) => {
          set((state) => ({
            stockSupplies: state.stockSupplies.filter(
              (item) => item.id !== next.id,
            ),
          }));
          throw error;
        });

        await trackStockSupplyWrite(next.id, operation);
      },`,
    'addStockSupply',
  );

  src = once(
    src,
`      updateStockSupply: async (id, updatedData) => {
        const previous = get().stockSupplies;
        const current = previous.find((item) => item.id === id);
        if (current?.stock_integrated_at) throw new Error('Compra já integrada ao estoque e não pode ser editada.');
        const next: Partial<StockSupply> = { ...updatedData, updated_at: new Date().toISOString() };
        set((state) => ({ stockSupplies: state.stockSupplies.map((item) => item.id === id ? { ...item, ...next } : item) }));
        try {
          await updateDoc(doc(db, 'stock_supplies', id), sanitizeForFirebase(next));
          if (updatedData.status === 'recebido' && current?.status !== 'recebido') {
            void scheduleStockSupplyCheckReminder(
              id,
              current?.supplier,
              current?.items?.length,
              get().storeSettings.notificationPreferences,
            );
          } else if (updatedData.status === 'conferido') {
            void cancelStockSupplyCheckReminder(id);
          }
        } catch (error) {
          set({ stockSupplies: previous });
          throw error;
        }
      },`,
`      updateStockSupply: async (id, updatedData) => {
        const current = get().stockSupplies.find((item) => item.id === id);

        if (!current) {
          throw new Error('Compra não encontrada.');
        }

        if (current.stock_integrated_at) {
          throw new Error(
            'Compra já integrada ao estoque. Estorne a integração antes de alterar itens ou valores.',
          );
        }

        const next: Partial<StockSupply> = {
          ...updatedData,
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          stockSupplies: state.stockSupplies.map((item) =>
            item.id === id ? { ...item, ...next } : item,
          ),
        }));

        const operation = updateDoc(
          doc(db, 'stock_supplies', id),
          sanitizeForFirebase(next),
        )
          .then(() => {
            if (
              updatedData.status === 'recebido' &&
              current.status !== 'recebido'
            ) {
              void scheduleStockSupplyCheckReminder(
                id,
                updatedData.supplier || current.supplier,
                updatedData.items?.length || current.items?.length,
                get().storeSettings.notificationPreferences,
              );
            } else if (updatedData.status === 'conferido') {
              void cancelStockSupplyCheckReminder(id);
            }
          })
          .catch((error) => {
            // Rollback localizado: não desfaz outra compra que tenha sido
            // modificada enquanto esta gravação estava em andamento.
            set((state) => ({
              stockSupplies: state.stockSupplies.map((item) =>
                item.id === id ? current : item,
              ),
            }));
            throw error;
          });

        await trackStockSupplyWrite(id, operation);
      },`,
    'updateStockSupply',
  );

  src = once(
    src,
`      integrateStockSupply: async (id) => {
        const previousProducts = get().stockProducts;`,
`      integrateStockSupply: async (id) => {
        // Se o usuário acabou de editar/criar a compra e já tocou em
        // "Conferir", a transação deve enxergar a versão mais recente.
        await waitForStockSupplyWrite(id);

        const previousProducts = get().stockProducts;`,
    'serialização antes da integração',
  );

  src = once(
    src,
`      reverseStockSupply: async (id) => {
        const previousProducts = get().stockProducts; const previousMovements = get().stockMovements; const previousSupplies = get().stockSupplies;`,
`      reverseStockSupply: async (id) => {
        await waitForStockSupplyWrite(id);

        const previousProducts = get().stockProducts; const previousMovements = get().stockMovements; const previousSupplies = get().stockSupplies;`,
    'serialização antes do estorno',
  );

  write(file, src);
}

/* ==========================================================
 * 2. HEADER
 * AuthGuard já é responsável pelo carregamento inicial.
 * Header não deve disparar outra tomografia Firestore.
 * ========================================================== */

{
  const file = 'components/layout/Header.tsx';
  let src = read(file);

  src = once(
    src,
`  const syncError = useAppStore((state) => state.syncError); // <-- IMPORTAMOS O ESTADO DE ERRO
  const initData = useAppStore((state) => state.initData);
  const user = useAppStore((state) => state.user);`,
`  const syncError = useAppStore((state) => state.syncError);
  const user = useAppStore((state) => state.user);`,
    'remoção do initData no Header',
  );

  src = once(
    src,
`  useEffect(() => {
    setGreeting(getGreeting());
    initData();
  }, [initData]);`,
`  useEffect(() => {
    setGreeting(getGreeting());
  }, []);`,
    'efeito do Header',
  );

  write(file, src);
}

/* ==========================================================
 * 3. FORMULÁRIO DE COMPRA
 * Evita seletor Zustand criando novo array a cada update global.
 * ========================================================== */

{
  const file = 'components/stock-supplies/StockSupplyForm.tsx';
  let src = read(file);

  src = once(
    src,
`  const products = useAppStore((state) =>
    state.stockProducts
      .filter((product) => product.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  );
  const movements = useAppStore((state) => state.stockMovements);`,
`  const stockProducts = useAppStore((state) => state.stockProducts);

  const products = useMemo(
    () =>
      stockProducts
        .filter((product) => product.active)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [stockProducts],
  );

  const movements = useAppStore((state) => state.stockMovements);`,
    'memoização dos produtos no StockSupplyForm',
  );

  write(file, src);
}

/* ==========================================================
 * 4. PICKER DE FORNECEDOR
 * - selector estável
 * - fecha imediatamente após cadastrar
 * - persistência continua sendo aguardada/rollbackada
 * ========================================================== */

{
  const file = 'components/stock-supplies/StockSupplierPicker.tsx';
  let src = read(file);

  src = once(
    src,
`const suppliers=useAppStore(s=>s.stockSuppliers.filter(x=>x.active));`,
`const stockSuppliers=useAppStore(s=>s.stockSuppliers);const suppliers=useMemo(()=>stockSuppliers.filter(x=>x.active),[stockSuppliers]);`,
    'selector de fornecedores',
  );

  src = once(
    src,
`const create=async()=>{if(name.trim().length<2)return toast.error('Informe o nome do fornecedor.');const now=new Date().toISOString(),item={id:\`supplier-\${Date.now()}-\${Math.random().toString(36).slice(2,7)}\`,name:name.trim(),type,active:true,created_at:now,updated_at:now};await add(item);onChange(item.id,item.name);setOpen(false);setCreating(false);setName('');toast.success('Fornecedor cadastrado.')};`,
`const create=async()=>{if(name.trim().length<2)return toast.error('Informe o nome do fornecedor.');const now=new Date().toISOString(),item={id:\`supplier-\${Date.now()}-\${Math.random().toString(36).slice(2,7)}\`,name:name.trim(),type,active:true,created_at:now,updated_at:now};const operation=add(item);onChange(item.id,item.name);setOpen(false);setCreating(false);setName('');toast.loading('Salvando fornecedor...',{id:'supplier-create'});try{await operation;toast.success('Fornecedor cadastrado.',{id:'supplier-create'})}catch(error){onChange('','');console.error('Erro ao cadastrar fornecedor:',error);toast.error('Não foi possível salvar o fornecedor.',{id:'supplier-create'})}};`,
    'cadastro responsivo de fornecedor',
  );

  write(file, src);
}

/* ==========================================================
 * 5. NOVA COMPRA
 * Navega com o Zustand já atualizado enquanto a persistência
 * termina. A Promise continua viva e mostra falha globalmente.
 * ========================================================== */

{
  const file = 'app/abastecimentos/novo/page.tsx';

  const next = `// app/abastecimentos/novo/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StockSupplyForm,
  type StockSupplyFormValue,
} from '@/components/stock-supplies/StockSupplyForm';
import { feedbackError, feedbackSuccess } from '@/lib/ui-feedback';
import { useAppStore } from '@/store/useAppStore';
import type { StockSupply } from '@/types';

export default function NewStockSupplyPage() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const addStockSupply = useAppStore(
    (state) => state.addStockSupply,
  );
  const [busy, setBusy] = useState(false);

  const save = async (value: StockSupplyFormValue) => {
    if (busy) return;

    setBusy(true);

    const now = new Date().toISOString();
    const supply: StockSupply = {
      id: \`supply-\${Date.now()}-\${Math.random()
        .toString(36)
        .slice(2, 7)}\`,
      ...value,
      created_at: now,
      updated_at: now,
    };

    try {
      /*
       * addStockSupply altera o Zustand antes do Firestore.
       * Podemos abrir os detalhes imediatamente sem fingir
       * que a persistência já terminou.
       */
      const operation = addStockSupply(supply);

      void feedbackSuccess();

      toast.loading('Compra registrada. Sincronizando...', {
        id: 'purchase-save',
      });

      router.replace(
        \`/abastecimentos/detalhes?id=\${supply.id}\`,
      );

      await operation;

      toast.success('Compra sincronizada.', {
        id: 'purchase-save',
      });
    } catch (error) {
      console.error(
        'Erro ao registrar compra de estoque:',
        error,
      );

      void feedbackError();

      toast.error(
        'A compra não pôde ser sincronizada e foi desfeita.',
        { id: 'purchase-save' },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Nova compra"
        subtitle="Reposição de produtos da loja"
        to="/abastecimentos"
      />

      <StockSupplyForm
        defaultBuyerName={user?.displayName || 'Álefe'}
        busy={busy}
        submitLabel="Registrar compra"
        onSubmit={save}
      />
    </div>
  );
}
`;

  write(file, next);
}

/* ==========================================================
 * 6. EDITAR COMPRA
 * - compra integrada ganha explicação correta
 * - navegação otimista
 * - persistência/rollback continuam valendo
 * ========================================================== */

{
  const file = 'app/abastecimentos/editar/page.tsx';

  const next = `// app/abastecimentos/editar/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StockSupplyForm,
  type StockSupplyFormValue,
} from '@/components/stock-supplies/StockSupplyForm';
import { feedbackError, feedbackSuccess } from '@/lib/ui-feedback';
import { useAppStore } from '@/store/useAppStore';

function Content() {
  const router = useRouter();
  const id = useSearchParams().get('id');

  const supplies = useAppStore((state) => state.stockSupplies);
  const user = useAppStore((state) => state.user);

  const updateStockSupply = useAppStore(
    (state) => state.updateStockSupply,
  );

  const supply = supplies.find((item) => item.id === id);
  const [busy, setBusy] = useState(false);

  if (!supply) {
    return (
      <PageHeader
        title="Compra não encontrada"
        to="/abastecimentos"
      />
    );
  }

  if (supply.stock_integrated_at) {
    return (
      <div className="pb-28">
        <PageHeader
          title="Editar compra"
          subtitle="Compra já integrada"
          to={\`/abastecimentos/detalhes?id=\${supply.id}\`}
        />

        <section className="rounded-[26px] border border-amber-500/25 bg-amber-500/[.06] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-400">
              <AlertTriangle size={20} />
            </span>

            <div>
              <p className="font-heading text-base font-black text-zinc-100">
                Esta compra já alterou o estoque
              </p>

              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Itens, quantidades e valores não podem ser alterados
                enquanto a integração estiver ativa. Isso protege o saldo,
                o custo médio e o histórico das movimentações.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              router.replace(
                \`/abastecimentos/detalhes?id=\${supply.id}\`,
              )
            }
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 text-sm font-black text-amber-400"
          >
            <Undo2 size={17} />
            Voltar e estornar integração
          </button>
        </section>
      </div>
    );
  }

  const save = async (value: StockSupplyFormValue) => {
    if (busy) return;

    setBusy(true);
    void feedbackSuccess();

    try {
      const operation = updateStockSupply(
        supply.id,
        value,
      );

      toast.loading(
        'Alterações aplicadas. Sincronizando...',
        { id: 'purchase-save' },
      );

      router.replace(
        \`/abastecimentos/detalhes?id=\${supply.id}\`,
      );

      await operation;

      toast.success('Compra sincronizada.', {
        id: 'purchase-save',
      });
    } catch (error) {
      console.error(
        'Erro ao atualizar compra:',
        error,
      );

      void feedbackError();

      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a compra.',
        { id: 'purchase-save' },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Editar compra"
        subtitle={\`\${supply.items.length} item\${
          supply.items.length === 1 ? '' : 's'
        }\`}
        to={\`/abastecimentos/detalhes?id=\${supply.id}\`}
      />

      <StockSupplyForm
        initial={supply}
        defaultBuyerName={user?.displayName || 'Álefe'}
        busy={busy}
        submitLabel="Salvar alterações"
        onSubmit={save}
      />
    </div>
  );
}

export default function EditStockSupplyPage() {
  return (
    <Suspense
      fallback={
        <p className="py-20 text-center text-zinc-500">
          Carregando...
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
`;

  write(file, next);
}

console.log('');
console.log('PATCH PRINCIPAL APLICADO.');
NODE

echo
echo "== 4/8 GUARDAS PÓS-CIRURGIA =="

grep -q "pendingStockSupplyWrites" store/useAppStore.ts
grep -q "if (get().isSyncing) return" store/useAppStore.ts
grep -q "await waitForStockSupplyWrite(id)" store/useAppStore.ts

if grep -q "const initData = useAppStore" components/layout/Header.tsx; then
  echo "ERRO: Header ainda possui initData."
  exit 1
fi

grep -q "stockProducts = useAppStore" components/stock-supplies/StockSupplyForm.tsx
grep -q "Compra registrada. Sincronizando" app/abastecimentos/novo/page.tsx
grep -q "Esta compra já alterou o estoque" app/abastecimentos/editar/page.tsx

echo "Guardas OK."

echo
echo "== 5/8 FORMAT CHECK =="

git diff --check

echo
echo "== 6/8 TYPESCRIPT =="

node node_modules/typescript/bin/tsc --noEmit

echo
echo "== 7/8 RESUMO DO DIFF =="

git diff --stat

echo
echo "Arquivos alterados:"
git status --short

echo
echo "== 8/8 RESULTADO =="

echo "============================================================"
echo " CIRURGIA 1 — ESTOQUE + COMPRAS + PERFORMANCE V1 APLICADA"
echo "============================================================"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "Mudanças principais:"
echo "  OK Header não dispara segunda sincronização global"
echo "  OK initData bloqueia execução concorrente"
echo "  OK compra continua otimista + rollback"
echo "  OK gravação pendente é serializada por compra"
echo "  OK integrar/estornar aguardam save anterior"
echo "  OK nova compra abre detalhes sem esperar a rede"
echo "  OK edição volta aos detalhes sem esperar a rede"
echo "  OK falha de Firestore desfaz estado otimista"
echo "  OK compra integrada não abre formulário enganoso"
echo "  OK StockSupplyForm evita selector com array novo"
echo "  OK StockSupplierPicker reduz rerender"
echo "  OK cadastro de fornecedor fecha imediatamente"
echo "  OK decimal / kg / L / Quanto sobrou preservados"
echo
echo "Validações:"
echo "  git diff --check: OK"
echo "  TypeScript: OK"
echo
echo "NÃO faça commit ainda."
echo "Me envie TODO este retorno para eu conferir antes do push."
