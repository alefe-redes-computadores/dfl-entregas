/** Next route transition fallback: no claim of remote confirmation. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex min-h-[55dvh] max-w-sm flex-col items-center justify-center gap-4 px-6 text-center text-zinc-200">
      <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-[20px] border border-emerald-500/25 bg-emerald-500/10 text-xl font-black text-emerald-300">DFL</span>
      <div>
        <p className="text-sm font-black">Preparando a tela</p>
        <p className="mt-1 text-xs text-zinc-500">Os dados já confirmados permanecem preservados.</p>
      </div>
      <div aria-hidden="true" className="h-1 w-28 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full w-1/2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
