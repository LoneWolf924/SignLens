import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HandLandmarker, FilesetResolver, NormalizedLandmark } from '@mediapipe/tasks-vision';

const CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];
const TIPS = new Set([4, 8, 12, 16, 20]);

/** White 224×224 skeleton canvas — matches training data format exactly */
function drawSkeletonCanvas(lms: NormalizedLandmark[], canvas: HTMLCanvasElement) {
  const S = 224;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);

  // Scale hand to fill ~60% of canvas centered — matches training data
  const xs = lms.map(l => l.x), ys = lms.map(l => l.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
  const span = Math.max(xMax - xMin, yMax - yMin) || 0.01;
  const scale = (S * 0.60) / span;
  const px = (x: number) => (x - cx) * scale + S / 2;
  const py = (y: number) => (y - cy) * scale + S / 2;

  ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(px(lms[a].x), py(lms[a].y));
    ctx.lineTo(px(lms[b].x), py(lms[b].y));
    ctx.stroke();
  }
  for (let i = 0; i < 21; i++) {
    ctx.beginPath();
    ctx.arc(px(lms[i].x), py(lms[i].y), TIPS.has(i) ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff00';
    ctx.fill();
  }
}

interface WebcamFeedProps {
  isActive: boolean;
  onFrame: (cropCanvas: HTMLCanvasElement, landmarks: NormalizedLandmark[]) => void;
  showROI: boolean;
}

export const WebcamFeed: React.FC<WebcamFeedProps> = ({ isActive, onFrame, showROI }) => {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const overlayRef    = useRef<HTMLCanvasElement>(null);  // visible skeleton overlay
  const skeletonRef   = useRef<HTMLCanvasElement>(null);  // 224×224 sent to backend + preview
  const streamRef     = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef        = useRef<number>(0);
  const lastSendRef   = useRef<number>(0);

  const [hasStream, setHasStream] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [mpReady, setMpReady]     = useState(false);
  const [detected, setDetected]   = useState(false);

  // ── Init MediaPipe ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const hl = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (!cancelled) { landmarkerRef.current = hl; setMpReady(true); }
      } catch (e) { console.error('MediaPipe init failed', e); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = ms;
      if (videoRef.current) { videoRef.current.srcObject = ms; await videoRef.current.play(); }
      setHasStream(true); setError(null);
    } catch { setError('Camera access denied. Check browser permissions.'); }
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setHasStream(false); setDetected(false);
  }, []);

  useEffect(() => {
    if (isActive) startCamera(); else stopCamera();
    return () => stopCamera();
  }, [isActive]);

  // ── rAF loop ──────────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    const video   = videoRef.current;
    const overlay = overlayRef.current;
    const skelCvs = skeletonRef.current;
    if (!video || !overlay || !skelCvs || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop); return;
    }

    const W = overlay.width, H = overlay.height;
    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    if (landmarkerRef.current && mpReady) {
      try {
        const result = landmarkerRef.current.detectForVideo(video, performance.now());
        if (result.landmarks?.length > 0) {
          const lms = result.landmarks[0];
          setDetected(true);

          // Mirror x for display (video is CSS-mirrored, landmarks are not)
          const mx = (x: number) => (1 - x) * W;
          const my = (y: number) => y * H;

          // Draw mirrored skeleton on overlay
          ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,220,255,0.9)'; ctx.lineCap = 'round';
          for (const [a, b] of CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo(mx(lms[a].x), my(lms[a].y));
            ctx.lineTo(mx(lms[b].x), my(lms[b].y));
            ctx.stroke();
          }
          for (let i = 0; i < 21; i++) {
            ctx.beginPath();
            ctx.arc(mx(lms[i].x), my(lms[i].y), TIPS.has(i) ? 7 : 4, 0, Math.PI * 2);
            ctx.fillStyle   = TIPS.has(i) ? '#00ffcc' : '#ffffff';
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
            ctx.fill(); ctx.stroke();
          }

          // Mirrored bounding box
          const xs = lms.map(l => l.x), ys = lms.map(l => l.y);
          const pad = 0.08;
          const bx1 = Math.max(0, Math.min(...xs) - pad);
          const bx2 = Math.min(1, Math.max(...xs) + pad);
          const by1 = Math.max(0, Math.min(...ys) - pad) * H;
          const by2 = Math.min(1, Math.max(...ys) + pad) * H;
          ctx.strokeStyle = 'rgba(0,220,255,0.45)'; ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          // mirror: left edge becomes right edge
          ctx.strokeRect((1 - bx2) * W, by1, (bx2 - bx1) * W, by2 - by1);
          ctx.setLineDash([]);

          // Every 500ms: draw skeleton on white canvas → send to model
          const now = Date.now();
          if (now - lastSendRef.current >= 500) {
            lastSendRef.current = now;
            drawSkeletonCanvas(lms, skelCvs);
            onFrame(skelCvs, lms);
          }
        } else {
          setDetected(false);
        }
      } catch { /* ignore single-frame errors */ }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [mpReady, onFrame]);

  useEffect(() => {
    if (isActive && hasStream) rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, hasStream, loop]);

  return (
    <div className="relative w-full bg-black rounded-2xl overflow-hidden border-2 border-border"
         style={{ aspectRatio: '4/3' }}>

      {/* Idle */}
      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <CameraOff size={48} className="opacity-20" />
          <p className="text-sm font-mono uppercase tracking-widest opacity-40">Camera Offline</p>
          <p className="text-xs opacity-25">Click "Start Engine" below</p>
        </div>
      )}

      {/* Error */}
      {isActive && error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-destructive p-4 text-center">
          <CameraOff size={36} />
          <p className="text-sm font-mono">{error}</p>
          <Button variant="outline" size="sm" onClick={startCamera}>
            <RefreshCw size={14} className="mr-2" /> Retry
          </Button>
        </div>
      )}

      {/* Loading MediaPipe */}
      {isActive && hasStream && !mpReady && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 z-10">
          Loading hand tracker…
        </div>
      )}

      {/* Mirrored live video */}
      <video ref={videoRef} autoPlay playsInline muted
        className="w-full h-full object-cover"
        style={{
          display: isActive && !error ? 'block' : 'none',
          transform: 'scaleX(-1)',   // mirror like a real camera
        }}
      />

      {/* Skeleton overlay — also mirrored to match video */}
      <canvas ref={overlayRef} width={640} height={480}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ display: isActive && hasStream ? 'block' : 'none' }}
      />

      {/* What the model sees — white skeleton preview (bottom-left) */}
      {isActive && hasStream && detected && (
        <div className="absolute bottom-10 left-3 z-10">
          <div className="text-[9px] font-mono uppercase text-white/40 mb-1">Model input</div>
          <canvas ref={skeletonRef} width={224} height={224}
            className="rounded border border-white/20"
            style={{ width: 72, height: 72 }}
          />
        </div>
      )}

      {/* Hidden skeleton canvas (same ref, used for sending to backend) */}
      {!(isActive && hasStream && detected) && (
        <canvas ref={skeletonRef} width={224} height={224} className="hidden" />
      )}

      {/* Hand status badge */}
      {isActive && hasStream && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest z-10"
          style={{
            background: detected ? 'rgba(0,200,80,0.15)' : 'rgba(255,60,60,0.15)',
            border: `1px solid ${detected ? 'rgba(0,200,80,0.4)' : 'rgba(255,60,60,0.3)'}`,
          }}>
          <div className={`w-1.5 h-1.5 rounded-full ${detected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {detected ? 'Hand Detected' : 'No Hand'}
        </div>
      )}

      {/* Live indicator */}
      {isActive && hasStream && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">Live Feed</span>
        </div>
      )}
    </div>
  );
};
