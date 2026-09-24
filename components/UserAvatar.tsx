'use client';
import { useEffect, useMemo, useState } from 'react';

interface Props {
  photoURL?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}

function initials(name?: string | null) {
  const parts = (name || 'DFL').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'DF';
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
  return `${first}${last}`.toLocaleUpperCase('pt-BR');
}

export function UserAvatar({ photoURL, name, className='h-full w-full', fallbackClassName='', alt='Foto do perfil' }: Props) {
  const [failedURL, setFailedURL] = useState<string | null>(null);
  useEffect(() => {
    if (failedURL && failedURL !== photoURL) setFailedURL(null);
  }, [photoURL, failedURL]);
  const fallback = useMemo(() => initials(name), [name]);

  if (photoURL && failedURL !== photoURL) {
    return <img src={photoURL} alt={alt} referrerPolicy="no-referrer" className={`${className} object-cover`} onError={() => setFailedURL(photoURL)} />;
  }

  return <div aria-label={alt} className={`flex ${className} items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700 font-heading font-black text-white ${fallbackClassName}`}>{fallback}</div>;
}
