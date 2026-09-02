import React from 'react';
import { Category } from '../../types';
import { Layers, Bookmark, BookOpen, PenTool, Palette, Briefcase, Scissors } from 'lucide-react';

interface CategoryBarProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  productCounts?: Record<string, number>;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  productCounts = {},
}) => {
  const getCategoryIcon = (slug: string) => {
    if (slug.includes('cuaderno') || slug.includes('libreta')) return <BookOpen className="w-3.5 h-3.5" />;
    if (slug.includes('escritura') || slug.includes('boligrafo')) return <PenTool className="w-3.5 h-3.5" />;
    if (slug.includes('arte') || slug.includes('dibujo')) return <Palette className="w-3.5 h-3.5" />;
    if (slug.includes('oficina') || slug.includes('archivo')) return <Briefcase className="w-3.5 h-3.5" />;
    if (slug.includes('escolar') || slug.includes('manualidad')) return <Scissors className="w-3.5 h-3.5" />;
    return <Bookmark className="w-3.5 h-3.5" />;
  };

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 font-mono">
          SECCIÓN / CATEGORÍAS
        </span>
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
          {categories.length + 1} COLECCIONES
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {/* All categories pill */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xs text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all cursor-pointer border ${
            selectedCategoryId === null
              ? 'bg-white text-black border-white shadow-lg'
              : 'bg-[#121212] text-white/60 hover:text-white border-white/10 hover:border-white/30'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>TODOS LOS PRODUCTOS</span>
        </button>

        {/* Dynamic Category list from Supabase */}
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          const count = productCounts[cat.id];

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[#dc2626] text-white border-[#dc2626] shadow-md accent-glow'
                  : 'bg-[#121212] text-white/60 hover:text-white border-white/10 hover:border-white/30'
              }`}
            >
              {getCategoryIcon(cat.slug)}
              <span>{cat.name}</span>
              {count !== undefined && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    isSelected ? 'bg-white text-[#dc2626]' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
