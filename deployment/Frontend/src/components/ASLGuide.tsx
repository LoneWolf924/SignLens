import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ASL finger-spelling descriptions + SVG hand shapes
const LETTERS: { label: string; desc: string; fingers: string }[] = [
  { label: 'A', desc: 'Fist, thumb rests on side', fingers: '✊' },
  { label: 'B', desc: 'Fingers straight up, thumb folded', fingers: '🖐' },
  { label: 'C', desc: 'Curved hand like letter C', fingers: '🤏' },
  { label: 'D', desc: 'Index up, others curl to thumb', fingers: '☝️' },
  { label: 'E', desc: 'Fingers bent, thumb tucked under', fingers: '✊' },
  { label: 'F', desc: 'Index & thumb touch, others up', fingers: '👌' },
  { label: 'G', desc: 'Index & thumb point sideways', fingers: '👉' },
  { label: 'H', desc: 'Index & middle point sideways', fingers: '✌️' },
  { label: 'I', desc: 'Pinky up, fist closed', fingers: '🤙' },
  { label: 'J', desc: 'Pinky up, draw J in air', fingers: '🤙' },
  { label: 'K', desc: 'Index up, middle angled, thumb between', fingers: '✌️' },
  { label: 'L', desc: 'Index up, thumb out (L shape)', fingers: '👆' },
  { label: 'M', desc: 'Three fingers over thumb', fingers: '✊' },
  { label: 'N', desc: 'Two fingers over thumb', fingers: '✊' },
  { label: 'O', desc: 'All fingers curve to thumb (O shape)', fingers: '👌' },
  { label: 'P', desc: 'Like K but pointing down', fingers: '✌️' },
  { label: 'Q', desc: 'Like G but pointing down', fingers: '👇' },
  { label: 'R', desc: 'Index & middle crossed', fingers: '🤞' },
  { label: 'S', desc: 'Fist, thumb over fingers', fingers: '✊' },
  { label: 'T', desc: 'Thumb between index & middle', fingers: '✊' },
  { label: 'U', desc: 'Index & middle up together', fingers: '✌️' },
  { label: 'V', desc: 'Index & middle spread (V/peace)', fingers: '✌️' },
  { label: 'W', desc: 'Index, middle & ring spread', fingers: '🖖' },
  { label: 'X', desc: 'Index finger hooked', fingers: '☝️' },
  { label: 'Y', desc: 'Thumb & pinky out', fingers: '🤙' },
  { label: 'Z', desc: 'Index draws Z in air', fingers: '☝️' },
  { label: 'Calm Down', desc: 'Both palms face down, move downward', fingers: '👐' },
  { label: 'Hello',     desc: 'Open hand salute from forehead', fingers: '🖐' },
  { label: 'Love',      desc: 'Cross arms over chest', fingers: '🤞' },
  { label: 'Stand',     desc: 'Two fingers stand on flat palm', fingers: '✌️' },
  { label: 'Thumbs Up', desc: 'Fist with thumb pointing up', fingers: '👍' },
  { label: 'Where',     desc: 'Index finger wags side to side', fingers: '☝️' },
];

const CATEGORY_COLORS: Record<string, string> = {
  letter: 'rgba(0,180,255,0.12)',
  phrase: 'rgba(120,80,255,0.12)',
};

interface ASLGuideProps {
  open: boolean;
  onClose: () => void;
}

export const ASLGuide: React.FC<ASLGuideProps> = ({ open, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'letters' | 'phrases'>('all');

  const items = LETTERS.filter(item => {
    if (filter === 'letters') return item.label.length === 1;
    if (filter === 'phrases') return item.label.length > 1;
    return true;
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <BookOpen size={18} className="text-primary" />
                <span className="font-bold uppercase tracking-widest text-sm">ASL Sign Reference</span>
                <span className="text-[11px] text-muted-foreground font-mono">32 signs supported</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Filter tabs */}
                {(['all', 'letters', 'phrases'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-[11px] uppercase tracking-widest px-3 py-1 rounded-full font-bold transition-all ${
                      filter === f
                        ? 'bg-primary text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}>
                    {f}
                  </button>
                ))}
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X size={16} />
                </Button>
              </div>
            </div>

            {/* Grid */}
            <div className="overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {items.map(item => {
                const isPhrase = item.label.length > 1;
                return (
                  <motion.div
                    key={item.label}
                    whileHover={{ scale: 1.04 }}
                    className={`rounded-xl border border-border p-3 flex flex-col items-center gap-2 cursor-default ${isPhrase ? 'col-span-2' : ''}`}
                    style={{ background: isPhrase ? CATEGORY_COLORS.phrase : CATEGORY_COLORS.letter }}
                  >
                    <div className="text-3xl leading-none">{item.fingers}</div>
                    <div className={`font-black tracking-tight ${isPhrase ? 'text-sm' : 'text-xl'} text-foreground`}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground text-center leading-tight">
                      {item.desc}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer tip */}
            <div className="px-6 py-3 border-t border-border shrink-0 text-[11px] text-muted-foreground">
              💡 Hold your hand clearly in front of the camera · Good lighting improves accuracy · Keep hand within the frame
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
