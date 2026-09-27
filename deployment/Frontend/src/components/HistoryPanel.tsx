import React from 'react';
import { Prediction } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HistoryPanelProps {
  history: Prediction[];
  onClear: () => void;
  onExport: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onClear, onExport }) => {
  return (
    <div className="flex flex-col h-full glass-card rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Temporal Log</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={onExport}>
            <Download size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/20 text-muted-foreground hover:text-destructive" onClick={onClear}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                className="history-item group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl font-black text-primary group-hover:scale-110 transition-transform">
                    {item.prediction}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </span>
                    <span className="text-[11px] font-mono text-primary/70">
                      {(item.confidence * 100).toFixed(0)}% Match
                    </span>
                  </div>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 group-hover:bg-primary transition-colors" />
              </motion.div>
            ))}
          </AnimatePresence>
          {history.length === 0 && (
            <div className="py-12 text-center text-muted-foreground/30 font-mono text-xs uppercase tracking-widest">
              No data recorded
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
