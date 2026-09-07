import React, { useState, useEffect } from 'react';
import { Package, ImageOff } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallbackText?: string;
  categoryName?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Normaliza y limpia URLs de imágenes de productos.
 * Corrige enlaces comunes como Unsplash sin parámetros, enlaces de Google Images o espacios en blanco.
 */
export function sanitizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Si es un data URL base64, dejarlo intacto
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // Si alguien copió el enlace de redirección de Google Images (google.com/imgres?imgurl=...)
  if (trimmed.includes('google.') && trimmed.includes('imgurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const realImgUrl = urlObj.searchParams.get('imgurl');
      if (realImgUrl) {
        return decodeURIComponent(realImgUrl);
      }
    } catch {
      // Ignorar error de parsing
    }
  }

  // Si es de Unsplash y le faltan parámetros de optimización
  if (trimmed.includes('images.unsplash.com') && !trimmed.includes('auto=format')) {
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}auto=format&fit=crop&w=600&q=80`;
  }

  return trimmed;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  containerClassName = 'w-full h-full relative overflow-hidden bg-[#171717] flex items-center justify-center',
  fallbackText = 'BIKIE',
  categoryName,
  aspectRatio = 'square',
  referrerPolicy = 'no-referrer',
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const cleanUrl = sanitizeImageUrl(src);

  // Reiniciar estado si cambia el src
  useEffect(() => {
    setHasError(false);
    setIsLoading(Boolean(cleanUrl));
  }, [cleanUrl]);

  const aspectClass =
    aspectRatio === 'square' ? 'aspect-square' : aspectRatio === 'video' ? 'aspect-video' : '';

  if (!cleanUrl || hasError) {
    return (
      <div
        onClick={onClick}
        className={`${containerClassName} ${aspectClass} select-none group border border-white/5`}
        title={alt}
      >
        <div className="flex flex-col items-center justify-center p-3 text-center">
          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 mb-1.5 group-hover:border-[#dc2626]/40 transition-colors">
            <Package className="w-5 h-5 text-[#dc2626]/70" />
          </div>
          <span className="font-display font-black text-xs uppercase tracking-tight text-white/60 line-clamp-1 max-w-[120px]">
            {alt || fallbackText}
          </span>
          {categoryName && (
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider mt-0.5">
              {categoryName}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${containerClassName} ${aspectClass} relative select-none`}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-[#1e1e1e] animate-pulse flex items-center justify-center">
          <span className="text-[10px] font-mono text-white/20">Cargando...</span>
        </div>
      )}
      <img
        src={cleanUrl}
        alt={alt}
        loading="lazy"
        referrerPolicy={referrerPolicy}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      />
    </div>
  );
};
