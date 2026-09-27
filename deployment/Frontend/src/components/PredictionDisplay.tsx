import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Prediction } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface PredictionDisplayProps {
  current: Prediction | null;
}

export const PredictionDisplay: React.FC<PredictionDisplayProps> = ({ current }) => {
  return (
    <Card className="glass-card overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className="p-8 flex flex-col items-center justify-center min-h-[240px] relative z-10">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={current.prediction}
              initial={{ scale: 0.5, opacity: 0, filter: 'blur(10px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              exit={{ scale: 1.5, opacity: 0, filter: 'blur(20px)' }}
              transition={{ type: 'spring', damping: 15, stiffness: 100 }}
              className="flex flex-col items-center w-full"
            >
              <div className="prediction-char">
                {current.prediction}
              </div>
              <div className="mt-8 w-full space-y-3">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Confidence Level</span>
                  <span className="text-primary">{(current.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${current.confidence * 100}%` }}
                    className="h-full bg-primary shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-2"
            >
              <div className="text-4xl font-mono text-muted-foreground/20">--</div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">Waiting for input</p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
