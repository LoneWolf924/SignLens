import React from 'react';
import { Stats } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { Activity, Target, Zap } from 'lucide-react';

interface StatsPanelProps {
  stats: Stats;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="glass-card border-white/5">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Scans</CardTitle>
          <Activity size={14} className="text-primary/50" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-3xl font-black tracking-tighter">{stats.totalPredictions}</div>
        </CardContent>
      </Card>

      <Card className="glass-card border-white/5">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Avg Confidence</CardTitle>
          <Target size={14} className="text-primary/50" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-3xl font-black tracking-tighter">{(stats.averageConfidence * 100).toFixed(1)}%</div>
        </CardContent>
      </Card>

      <Card className="glass-card border-white/5">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Top Sign</CardTitle>
          <Zap size={14} className="text-primary/50" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-3xl font-black tracking-tighter text-primary">{stats.mostFrequentSign || '--'}</div>
        </CardContent>
      </Card>

      <Card className="md:col-span-3 glass-card border-white/5 h-[140px] overflow-hidden group">
        <CardContent className="p-0 h-full relative">
          <div className="absolute top-3 left-4 z-10">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">Accuracy Trend</span>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.accuracyTrend} margin={{ top: 40, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, 1]} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-background/90 backdrop-blur-md border border-white/10 p-2 rounded-lg shadow-xl text-[10px] font-bold uppercase tracking-wider">
                        {`Match: ${(payload[0].value as number * 100).toFixed(1)}%`}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="stepAfter" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3} 
                dot={false}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
