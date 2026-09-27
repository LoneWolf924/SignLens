export interface Prediction {
  prediction: string;
  confidence: number;
  timestamp: string;
  id: string;
}

export interface AppSettings {
  confidenceThreshold: number;
  smoothingWindow: number;
  isDarkMode: boolean;
  showROI: boolean;
}

export interface Stats {
  totalPredictions: number;
  averageConfidence: number;
  mostFrequentSign: string;
  accuracyTrend: { time: string; value: number }[];
}
