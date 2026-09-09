import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoViewerModalProps {
  photos: string[];
  initialIndex?: number;
  customerName?: string;
  onClose: () => void;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  photos,
  initialIndex = 0,
  customerName,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, photos]);

  if (!photos || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex] || photos[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-3 sm:p-4"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between py-2 text-white max-w-3xl">
        <div className="flex items-center gap-2">
          <ZoomIn className="w-5 h-5 text-amber-400" />
          <span className="font-black text-sm sm:text-base truncate max-w-[220px]">
            {customerName ? `FACA: ${customerName}` : 'FOTOS DA FACA'}
          </span>
          {photos.length > 1 && (
            <span className="px-2.5 py-1 bg-stone-800 text-amber-400 rounded-full font-mono text-xs font-bold">
              {currentIndex + 1} de {photos.length}
            </span>
          )}
        </div>
        <button
          id="btn-close-photo-modal"
          onClick={onClose}
          className="p-2.5 bg-stone-800 hover:bg-stone-700 active:scale-95 rounded-full text-white font-bold text-sm"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Image Area with Navigation Buttons */}
      <div
        className="relative flex-1 flex items-center justify-center w-full max-h-[78vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentPhoto}
          alt={`Foto ${currentIndex + 1} da faca ampliada`}
          className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-stone-800"
        />

        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 p-3 rounded-full bg-black/70 hover:bg-black/90 text-white active:scale-95 shadow-lg border border-white/20"
              title="Foto anterior"
            >
              <ChevronLeft className="w-7 h-7 stroke-[3]" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 sm:right-4 p-3 rounded-full bg-black/70 hover:bg-black/90 text-white active:scale-95 shadow-lg border border-white/20"
              title="Próxima foto"
            >
              <ChevronRight className="w-7 h-7 stroke-[3]" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Thumbnail Strip & Close */}
      <div
        className="w-full max-w-xl flex flex-col items-center gap-3 pt-2"
        onClick={(e) => e.stopPropagation()}
      >
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-1 max-w-full">
            {photos.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                  currentIndex === idx
                    ? 'border-amber-400 scale-105 ring-2 ring-amber-400/50'
                    : 'border-stone-700 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={p} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <button
          id="btn-close-photo-full"
          onClick={onClose}
          className="w-full py-3.5 bg-stone-800 hover:bg-stone-700 active:scale-98 rounded-xl text-white font-black text-base uppercase tracking-wider"
        >
          FECHAR FOTO
        </button>
      </div>
    </div>
  );
};
