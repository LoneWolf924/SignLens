import React, { useState, useCallback, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { Settings, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

import { WebcamFeed } from './components/WebcamFeed';
import { PredictionDisplay } from './components/PredictionDisplay';
import { HistoryPanel } from './components/HistoryPanel';
import { ControlPanel } from './components/ControlPanel';
import { StatsPanel } from './components/StatsPanel';
import { SettingsDialog } from './components/SettingsDialog';
import { ASLGuide } from './components/ASLGuide';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Prediction, AppSettings, Stats } from './types';

export default function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<Prediction[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    confidenceThreshold: 0.3,
    smoothingWindow: 3,
    isDarkMode: true,
    showROI: true
  });

  const predictionBuffer = useRef<string[]>([]);

  const [stats, setStats] = useState<Stats>({
    totalPredictions: 0,
    averageConfidence: 0,
    mostFrequentSign: '',
    accuracyTrend: []
  });

  // Smoothing logic
  const getSmoothedPrediction = (newPrediction: string) => {
    predictionBuffer.current.push(newPrediction);
    if (predictionBuffer.current.length > settings.smoothingWindow) {
      predictionBuffer.current.shift();
    }

    const counts: Record<string, number> = {};
    predictionBuffer.current.forEach(p => counts[p] = (counts[p] || 0) + 1);
    
    return Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  };

  const handleFrame = useCallback(async (canvas: HTMLCanvasElement, landmarks: NormalizedLandmark[]) => {
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z ?? 0 }))
        })
      });
      if (!response.ok) throw new Error('Prediction failed');
      const data = await response.json();

      console.log('[predict]', data.prediction, (data.confidence * 100).toFixed(1) + '%', 'threshold:', settings.confidenceThreshold);

      if (!data.hand_detected || data.prediction === null) return;
      if (data.confidence >= settings.confidenceThreshold) {
        const smoothed = getSmoothedPrediction(data.prediction);
        const newPrediction: Prediction = {
          ...data, prediction: smoothed,
          id: Math.random().toString(36).substr(2, 9)
        };
        setCurrentPrediction(newPrediction);
        setHistory(prev => [newPrediction, ...prev].slice(0, 50));
        setStats(prev => {
          const newTotal = prev.totalPredictions + 1;
          const newAvgConf = (prev.averageConfidence * prev.totalPredictions + data.confidence) / newTotal;
          const newTrend = [...prev.accuracyTrend, { time: new Date().toLocaleTimeString(), value: data.confidence }].slice(-20);
          return { ...prev, totalPredictions: newTotal, averageConfidence: newAvgConf, accuracyTrend: newTrend };
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [settings.confidenceThreshold, settings.smoothingWindow]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      toast.promise(
        fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        }).then(res => res.json()),
        {
          loading: 'Analyzing image...',
          success: (data) => {
            const newPrediction = { ...data, id: Date.now().toString() };
            setCurrentPrediction(newPrediction);
            setHistory(prev => [newPrediction, ...prev]);
            return `Detected: ${data.prediction} (${(data.confidence * 100).toFixed(0)}%)`;
          },
          error: 'Analysis failed'
        }
      );
    };
    reader.readAsDataURL(file);
  };

  const clearHistory = () => {
    setHistory([]);
    setStats(prev => ({ ...prev, totalPredictions: 0, averageConfidence: 0, accuracyTrend: [] }));
    toast.success('History cleared');
  };

  const exportHistory = () => {
    if (history.length === 0) {
      toast.error('No history to export');
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Timestamp,Prediction,Confidence\n"
      + history.map(p => `${p.timestamp},${p.prediction},${p.confidence}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `asl_predictions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exporting history...');
  };

  return (
    <TooltipProvider>
      <div className={`min-h-screen flex flex-col ${settings.isDarkMode ? 'dark' : ''}`}>
        <Toaster position="top-right" theme={settings.isDarkMode ? 'dark' : 'light'} />
        
        {/* Header */}
        <header className="h-[72px] border-b border-border bg-card flex items-center sticky top-0 z-50">
          <div className="w-full px-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-extrabold text-background">
                S
              </div>
              <h1 className="text-xl font-bold tracking-tighter uppercase">SignLens AI</h1>
            </div>
            
            <div className="status-badge">
              <div className="status-dot animate-pulse" />
              REAL-TIME STREAMING ACTIVE
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 w-full px-10 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 overflow-auto">
          
          {/* Left Column: Feed & Controls */}
          <div className="flex flex-col gap-5">
            <WebcamFeed 
              isActive={isCameraActive} 
              onFrame={handleFrame} 
              showROI={settings.showROI}
            />

            <ControlPanel 
              isCameraActive={isCameraActive}
              onToggleCamera={() => setIsCameraActive(!isCameraActive)}
              onUploadImage={handleUploadImage}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onClearHistory={clearHistory}
            />

            <div className="space-y-2">
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground">Performance Analytics</div>
              <StatsPanel stats={stats} />
            </div>
          </div>

          {/* Right Column: Prediction & History */}
          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground">Current Sign</div>
              <PredictionDisplay current={currentPrediction} />
            </div>

            <div className="flex flex-col space-y-2">
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground">Prediction History</div>
              <HistoryPanel 
                history={history} 
                onClear={clearHistory}
                onExport={exportHistory}
              />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="h-[88px] border-t border-border bg-card flex items-center">
          <div className="w-full px-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-[13px] text-muted-foreground">
                Press <kbd>Space</kbd> to toggle capture • <kbd>Esc</kbd> to exit
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={exportHistory} className="h-10 px-6 font-semibold">
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsGuideOpen(true)} className="h-10 px-4 font-semibold gap-2">
                <BookOpen size={15} /> ASL Guide
              </Button>
              <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)} className="h-10 w-10">
                <Settings size={18} />
              </Button>
            </div>
          </div>
        </footer>

        <SettingsDialog 
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          settings={settings}
          onSave={setSettings}
        />

        <ASLGuide open={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      </div>
    </TooltipProvider>
  );
}
