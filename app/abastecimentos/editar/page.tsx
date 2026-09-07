// app/abastecimentos/editar/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  FuelingForm,
  type FuelingFormValue,
} from '@/components/fuelings/FuelingForm';
import { useAppStore } from '@/store/useAppStore';

function Content() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  const fuelings = useAppStore((state) => state.fuelings);
  const motoboys = useAppStore((state) => state.motoboys);
  const updateFueling = useAppStore((state) => state.updateFueling);
  const fueling = fuelings.find((item) => item.id === id);
  const [busy, setBusy] = useState(false);

  if (!fueling) {
    return (
      <div>
        <PageHeader title="Abastecimento não encontrado" to="/abastecimentos" />
      </div>
    );
  }

  const save = async (value: FuelingFormValue) => {
    setBusy(true);
    try {
      await updateFueling(fueling.id, value);
      toast.success('Abastecimento atualizado.');
      router.replace('/abastecimentos');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar as alterações.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Editar abastecimento"
        subtitle={new Date(fueling.occurred_at).toLocaleString('pt-BR')}
        to="/abastecimentos"
      />
      <FuelingForm
        initial={fueling}
        motoboys={motoboys}
        submitLabel="Salvar alterações"
        busy={busy}
        onSubmit={save}
      />
    </div>
  );
}

export default function EditFuelingPage() {
  return (
    <Suspense
      fallback={<p className="py-20 text-center text-zinc-500">Carregando...</p>}
    >
      <Content />
    </Suspense>
  );
}
