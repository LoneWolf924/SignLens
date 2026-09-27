import React from 'react';
import { Button } from '@/components/ui/button';
import { Camera, StopCircle, Upload, Settings, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ControlPanelProps {
  isCameraActive: boolean;
  onToggleCamera: () => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenSettings: () => void;
  onClearHistory: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isCameraActive,
  onToggleCamera,
  onUploadImage,
  onOpenSettings,
  onClearHistory
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-between p-6 glass-card rounded-2xl">
      <div className="flex items-center gap-4">
        <Button
          size="lg"
          variant={isCameraActive ? "destructive" : "default"}
          onClick={onToggleCamera}
          className={`h-12 px-8 font-black uppercase tracking-[0.15em] shadow-lg transition-all duration-300 ${
            isCameraActive 
              ? "bg-destructive hover:bg-destructive/80 shadow-destructive/20" 
              : "bg-primary hover:bg-primary/80 text-background shadow-primary/20"
          }`}
        >
          {isCameraActive ? "Stop Engine" : "Start Engine"}
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={() => fileInputRef.current?.click()}
          className="h-12 px-8 font-bold uppercase tracking-wider border-white/10 hover:bg-white/5"
        >
          Upload Sample
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={onUploadImage}
          />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearHistory}
        className="text-muted-foreground hover:text-destructive font-bold uppercase tracking-widest text-[10px] opacity-50 hover:opacity-100 transition-all"
      >
        Reset Log
      </Button>
    </div>
  );
};
