import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';

/**
 * Image with graceful fallback. If the URL is missing or fails to load,
 * renders a placeholder icon on a tinted background.
 */
export default function Thumbnail({ src, alt = '', className = '', iconSize = 'w-4 h-4', placeholder }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={clsx('flex items-center justify-center bg-slate-100', className)}>
        {placeholder || <ImageIcon className={clsx(iconSize, 'text-slate-300')} />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
