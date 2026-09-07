// app/abastecimentos/novo/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  FuelingForm,
  type FuelingFormValue,
} from '@/components/fuelings/FuelingForm';
import { useAppStore } from '@/store/useAppStore';
import type { Fueling } from '@/types';

export default function NewFuelingPage() {
  const router = useRouter();
  const motoboys = useAppStore((state) => state.motoboys);
  const addFueling = useAppStore((state) => state.addFueling);
  const [busy, setBusy] = useState(false);

  const save = async (value: FuelingFormValue) => {
    if (value.total_amount <= 0) {
      toast.error('Informe o valor do abastecimento.');
      return;
    }

    setBusy(true);
    try {
      const now = new Date().toISOString();
      const fueling: Fueling = {
        id: `fueling-${Date.now()}`,
        ...value,
        created_at: now,
        updated_at: now,
      };

      await addFueling(fueling);

      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }

      toast.success('Abastecimento registrado.');
      router.replace('/abastecimentos');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível registrar o abastecimento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Novo abastecimento"
        subtitle="Custo operacional"
        to="/abastecimentos"
      />
      <FuelingForm
        motoboys={motoboys}
        submitLabel="Registrar abastecimento"
        busy={busy}
        onSubmit={save}
      />
    </div>
  );
}
