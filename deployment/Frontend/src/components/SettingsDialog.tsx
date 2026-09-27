import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AppSettings } from '../types';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  onSave
}) => {
  const [localSettings, setLocalSettings] = React.useState<AppSettings>(settings);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-widest">System Configuration</DialogTitle>
          <DialogDescription className="text-xs font-mono opacity-50">
            Adjust recognition parameters and interface options.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-mono uppercase tracking-wider">Confidence Threshold</Label>
              <span className="text-xs font-mono text-primary">{(localSettings.confidenceThreshold * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[localSettings.confidenceThreshold * 100]}
              max={100}
              step={1}
              onValueChange={(val) => setLocalSettings(prev => ({ ...prev, confidenceThreshold: val[0] / 100 }))}
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-mono uppercase tracking-wider">Smoothing Window</Label>
              <span className="text-xs font-mono text-primary">{localSettings.smoothingWindow} frames</span>
            </div>
            <Slider
              value={[localSettings.smoothingWindow]}
              min={1}
              max={20}
              step={1}
              onValueChange={(val) => setLocalSettings(prev => ({ ...prev, smoothingWindow: val[0] }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs font-mono uppercase tracking-wider">Show ROI Overlay</Label>
            <Switch
              checked={localSettings.showROI}
              onCheckedChange={(val) => setLocalSettings(prev => ({ ...prev, showROI: val }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs font-mono uppercase tracking-wider">Dark Mode</Label>
            <Switch
              checked={localSettings.isDarkMode}
              onCheckedChange={(val) => setLocalSettings(prev => ({ ...prev, isDarkMode: val }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-mono uppercase text-[10px]">Cancel</Button>
          <Button onClick={() => {
            onSave(localSettings);
            onOpenChange(false);
          }} className="font-mono uppercase text-[10px]">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
