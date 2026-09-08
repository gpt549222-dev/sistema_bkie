import React, { useState, useEffect, useMemo } from 'react';
import { Package } from 'lucide-react';
import { sanitizeImageUrl, getImageCandidates, detectImageService } from '../../utils/imageUrl';

export { sanitizeImageUrl, getImageCandidates, detectImageService };
export type { ImageServiceInfo } from '../../utils/imageUrl';

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
  const candidates = useMemo(() => getImageCandidates(src), [src]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reiniciar estado cada vez que cambien los candidatos
  useEffect(() => {
    setCandidateIndex(0);
    setHasError(candidates.length === 0);
    setIsLoading(candidates.length > 0);
  }, [candidates]);

  const currentUrl = candidates[candidateIndex] || null;

  const handleImageError = () => {
    // Si aún hay candidatos alternativos (ej: CDN alterno de Drive o proxy de hotlink), probar el siguiente
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((prev) => prev + 1);
      setIsLoading(true);
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  };

  const aspectClass =
    aspectRatio === 'square' ? 'aspect-square' : aspectRatio === 'video' ? 'aspect-video' : '';

  if (!currentUrl || hasError) {
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
        key={currentUrl}
        src={currentUrl}
        alt={alt}
        loading="lazy"
        referrerPolicy={referrerPolicy}
        onLoad={() => setIsLoading(false)}
        onError={handleImageError}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      />
    </div>
  );
};
