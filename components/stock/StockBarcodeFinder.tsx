'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Barcode, Camera, CameraOff, Search, X, CheckCircle2 } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import type { StockProduct } from '@/types';

type DetectedBarcode = { rawValue?: string };
type BrowserDetector = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };
type DetectorConstructor = new (options?: { formats?: string[] }) => BrowserDetector;
const normalize = (value: string) => value.replace(/\s/g, '').toUpperCase();

/** Consulta SOMENTE o catálogo já carregado. Câmera é ligada por ação explícita. */
export function StockBarcodeFinder({ products, onSelect }: {
  products: readonly StockProduct[];
  onSelect: (product: StockProduct) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number | null>(null);
  const generation = useRef(0);
  const lastTick = useRef(0);
  const inFlight = useRef(false);
  const productByCode = new Map(products.filter(p => p.barcode).map(p => [normalize(p.barcode || ''), p]));
  const byCode = useRef(productByCode);
  byCode.current = productByCode;

  const stop = useCallback(() => {
    generation.current++;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    if (!open) stop();
    return () => stop();
  }, [open, stop]);
  useEffect(() => {
    if (!scanning) return;
    const hidden = () => { if (document.visibilityState === 'hidden') stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [scanning, stop]);

  const find = useCallback((raw: string) => {
    const code = normalize(raw);
    if (!code) return false;
    const product = byCode.current.get(code);
    if (product) {
      stop();
      setOpen(false);
      onSelect(product);
      return true;
    }
    setQuery(code);
    setMessage(`Código ${code} não cadastrado. Adicione-o em Editar produto.`);
    return false;
  }, [onSelect, stop]);

  const start = async () => {
    if (scanning || stream.current) return;
    setMessage('');
    const Detector = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setMessage('Leitura automática indisponível neste Android. Digite o código abaixo.');
      return;
    }
    const token = ++generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (token !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const element = video.current;
      if (!element) { stop(); return; }
      element.srcObject = media;
      await element.play();
      if (token !== generation.current) return;
      setScanning(true);
      const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
      const scanFrame = async (time: number) => {
        if (token !== generation.current || !video.current || !stream.current) return;
        if (!inFlight.current && time - lastTick.current > 420 && video.current.readyState >= 2) {
          inFlight.current = true;
          lastTick.current = time;
          try {
            const candidates = await detector.detect(video.current);
            if (token !== generation.current) return;
            if (candidates.length && find(candidates[0].rawValue || '')) return;
          } catch { /* Some WebViews implement partial BarcodeDetector; manual fallback stays available. */ }
          finally { inFlight.current = false; }
        }
        if (token === generation.current) frame.current = requestAnimationFrame(scanFrame);
      };
      frame.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      stop();
      setMessage(error instanceof Error ? `Não foi possível abrir a câmera: ${error.message}` : 'Permissão de câmera indisponível.');
    }
  };

  return <>
    <button type="button" onClick={() => { setOpen(true); setMessage(''); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[.07] px-3 text-[10px] font-black text-emerald-300 active:scale-[.98]">
      <Barcode size={17}/> Buscar código de barras
    </button>
    {open && typeof document !== 'undefined' && createPortal(<div role="dialog" aria-modal="true" aria-label="Localizar produto por código de barras" className="fixed inset-0 z-[340] flex items-end justify-center overflow-hidden bg-black/80 px-3 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] backdrop-blur-sm">
      <section className="max-h-[calc(100dvh-24px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[28px] border border-zinc-700 bg-zinc-950 p-4 shadow-2xl">
        <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-emerald-400">Busca rápida</p><h2 className="mt-1 font-heading text-lg font-black text-zinc-100">Código de barras</h2></div><button type="button" onClick={() => { stop(); setOpen(false); }} aria-label="Fechar leitor" className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-900"><X size={18}/></button></div>
        <p className="mt-2 text-[10px] text-zinc-500">Leitura local do código salvo no cadastro, sem consulta externa e sem gravar estoque.</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-800 bg-black"><video ref={video} playsInline muted className={`aspect-[4/3] w-full object-cover ${scanning ? '' : 'hidden'}`}/>{!scanning && <div className="grid h-28 place-items-center text-zinc-600"><CameraOff size={24}/></div>}</div>
        {message && <p role="status" className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">{message}</p>}
        <button type="button" onClick={() => { if (scanning) stop(); else void start(); }} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-black text-zinc-950">{scanning ? <CameraOff size={17}/> : <Camera size={17}/>} {scanning ? 'Desligar câmera' : 'Ler com câmera'}</button>
        <div className="mt-3 flex gap-2"><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') find(query); }} placeholder="EAN, UPC ou código interno" aria-label="Código de barras digitado" className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"/><button type="button" onClick={() => { if (!find(query)) toast.info('Confira o código no cadastro do produto.'); }} className="grid h-12 w-12 place-items-center rounded-xl border border-zinc-700 bg-zinc-900 text-emerald-300" aria-label="Buscar produto"><Search size={18}/></button></div>
        <p className="mt-2 flex items-center gap-2 text-[9px] text-zinc-600"><CheckCircle2 size={12}/> Câmera desligada ao sair ou colocar aplicativo em segundo plano.</p>
      </section>
    </div>, document.body)}
  </>;
}
