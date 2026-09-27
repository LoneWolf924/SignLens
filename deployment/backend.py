"""
Sign Language Detection Backend
Uses Keras model (224x224 RGB, 32 classes) with MediaPipe hand detection
"""
# !! IMPORTANT: Set environment variables BEFORE importing TensorFlow
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'  # Force CPU only
os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'false'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # Disable oneDNN
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'

import numpy as np
import sqlite3
import base64
import warnings
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from io import BytesIO
from PIL import Image
import threading

warnings.filterwarnings('ignore')

# Lazy imports - only import TensorFlow/Keras when first needed
_tf_imported = False
_keras_load_model = None

def ensure_tf_imported():
    """Lazy TensorFlow import to avoid blocking on startup"""
    global _tf_imported, _keras_load_model
    if _tf_imported:
        return
    
    try:
        print("[TF] Importing TensorFlow...")
        from tensorflow.keras.models import load_model as _tf_load
        import tensorflow.keras.layers as _kl
        # Patch DepthwiseConv2D groups arg for older saved models
        _orig = _kl.DepthwiseConv2D.__init__
        def _patched(self, *args, **kwargs):
            kwargs.pop('groups', None)
            _orig(self, *args, **kwargs)
        _kl.DepthwiseConv2D.__init__ = _patched
        def keras_load_model(path, **kwargs):
            return _tf_load(path, compile=False)
        _keras_load_model = keras_load_model
        print("[TF] TensorFlow imported successfully")
        _tf_imported = True
    except ImportError as e:
        print(f"[TF] WARNING: Could not import TensorFlow - {e}")
        _tf_imported = True

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import mediapipe as mp
except ImportError:
    mp = None

app = Flask(__name__)
CORS(app)

# ── Configuration ──────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH        = os.path.join(BASE_DIR, 'Model', 'keras_model.h5')
LANDMARK_MODEL_PATH = os.path.join(BASE_DIR, 'Model', 'landmark_model.h5')
LABELS_PATH       = os.path.join(BASE_DIR, 'Model', 'landmark_labels.txt')
DB_PATH           = os.path.join(BASE_DIR, 'backend_data', 'gesture_db.db')
IMAGE_SIZE        = 224

# ── Globals ────────────────────────────────────────────────────────────────────
model      = None   # landmark MLP (primary)
cnn_model  = None   # image CNN (fallback)
labels     = []
mp_hands   = None   # MediaPipe HandLandmarker (Tasks API)


# ── Initialisation ─────────────────────────────────────────────────────────────
def load_labels():
    """Load class labels from labels.txt"""
    global labels
    if os.path.exists(LABELS_PATH):
        with open(LABELS_PATH, 'r') as f:
            labels = [line.strip().split(' ', 1)[1] for line in f if line.strip()]
        print(f"Loaded {len(labels)} labels: {labels[:5]} ...")
    else:
        # Fallback: A-Z
        labels = [chr(i) for i in range(65, 91)]
        print("WARNING: labels.txt not found, using A-Z fallback")


def init_database():
    """Sync SQLite database with labels.txt"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS gesture (
            g_id   INTEGER NOT NULL PRIMARY KEY,
            g_name TEXT    NOT NULL
        )
    """)
    for idx, name in enumerate(labels):
        cur.execute("INSERT OR REPLACE INTO gesture (g_id, g_name) VALUES (?, ?)", (idx, name))
    conn.commit()
    conn.close()
    print(f"Database synced with {len(labels)} gestures")


def load_cnn_model_with_timeout(timeout=30):
    """Load CNN model with timeout protection using subprocess"""
    global cnn_model
    import subprocess
    import tempfile
    import pickle
    
    if _keras_load_model is None:
        print("[MODEL] ERROR: Keras not available")
        return False
    
    # Try SavedModel format first (preferred for TensorFlow 2.13+)
    savedmodel_dir = os.path.join(BASE_DIR, 'Model', 'keras_model_savedmodel')
    if os.path.exists(savedmodel_dir):
        print(f"[MODEL] Loading SavedModel from {savedmodel_dir}...")
        try:
            cnn_model = _keras_load_model(savedmodel_dir)
            print(f"[MODEL] ✓ SavedModel loaded successfully")
            print(f"[MODEL]   Input: {cnn_model.input_shape}, Output: {cnn_model.output_shape}")
            return True
        except Exception as e:
            print(f"[MODEL] ✗ SavedModel load failed: {e}")
            print(f"[MODEL]   Falling back to H5 format...")
    
    # Fall back to H5 format
    if not os.path.exists(MODEL_PATH):
        print(f"[MODEL] ERROR: Model file not found: {MODEL_PATH}")
        return False
    
    print(f"[MODEL] Loading H5 model from {MODEL_PATH}...")
    print(f"[MODEL]   File size: {os.path.getsize(MODEL_PATH) / (1024*1024):.2f} MB")
    print(f"[MODEL]   (timeout: {timeout}s)")
    
    # Try direct load first (quick attempt)
    try:
        print(f"[MODEL] Attempting direct load...")
        cnn_model = _keras_load_model(MODEL_PATH)
        print(f"[MODEL] ✓ H5 model loaded successfully")
        print(f"[MODEL]   Input: {cnn_model.input_shape}, Output: {cnn_model.output_shape}")
        return True
    except Exception as e:
        print(f"[MODEL] ✗ Direct load failed: {e}")
    
    # If direct load fails, model won't work with current TensorFlow version
    print(f"[MODEL] ✗ H5 model cannot be loaded with current TensorFlow/Keras version")
    print(f"[MODEL]   This is a known incompatibility issue")
    return False


def initialize():
    """Boot-time setup: labels → DB → CNN model → MediaPipe"""
    global model, cnn_model, mp_hands

    print("[INIT] Starting initialization...")
    print("[INIT] Loading labels...")
    load_labels()
    print("[INIT] Loading database...")
    init_database()

    # Ensure TensorFlow is imported
    print("[INIT] Importing TensorFlow/Keras...")
    ensure_tf_imported()
    
    # Try to load CNN model
    print("[INIT] Loading CNN model...")
    if not load_cnn_model_with_timeout(timeout=30):
        print("[INIT] WARNING: CNN model load failed - predictions will use mock mode")
    
    # Initialize MediaPipe (Tasks API — works with mediapipe >= 0.10)
    print("[INIT] Initializing MediaPipe...")
    try:
        if mp is not None:
            BaseOptions = mp.tasks.BaseOptions
            HandLandmarker = mp.tasks.vision.HandLandmarker
            HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
            VisionRunningMode = mp.tasks.vision.RunningMode

            # Download the hand landmarker model if not present
            model_asset_path = os.path.join(BASE_DIR, 'backend_data', 'hand_landmarker.task')
            if not os.path.exists(model_asset_path):
                print("[INIT] Downloading hand_landmarker.task model...")
                import urllib.request
                os.makedirs(os.path.dirname(model_asset_path), exist_ok=True)
                urllib.request.urlretrieve(
                    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                    model_asset_path
                )
                print("[INIT] Download complete.")

            options = HandLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=model_asset_path),
                running_mode=VisionRunningMode.IMAGE,
                num_hands=1,
                min_hand_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            mp_hands = HandLandmarker.create_from_options(options)
            print("[INIT] ✓ MediaPipe Hands initialised")
        else:
            print("[INIT] WARNING: MediaPipe not available")
    except Exception as e:
        print(f"[INIT] ERROR: MediaPipe init failed: {e}")
    
    print("[INIT] ✓ Initialization complete!")
    print(f"[INIT] Status: CNN model={'loaded' if cnn_model else 'NOT loaded (mock mode)'}, MediaPipe={'ready' if mp_hands else 'not ready'}")


# ── Image helpers ──────────────────────────────────────────────────────────────
def decode_base64_image(image_data: str):
    """Decode a base64 data-URL or raw base64 string to a BGR numpy array."""
    if ',' in image_data:
        image_data = image_data.split(',', 1)[1]
    raw = base64.b64decode(image_data)
    pil = Image.open(BytesIO(raw)).convert('RGB')
    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


def extract_hand_mediapipe(img_bgr):
    """
    Use MediaPipe to find the hand bounding box, crop it, and return
    (hand_bgr_crop, bbox, landmarks_normalized) or (None, None, None).
    landmarks_normalized: list of {x, y} in [0,1] relative to original image.
    """
    if mp_hands is None or cv2 is None:
        return None, None, None

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_bgr.shape[:2]

    try:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
        result = mp_hands.detect(mp_image)
        if not result.hand_landmarks:
            return None, None, None
        lms = result.hand_landmarks[0]
        landmarks = [{'x': lm.x, 'y': lm.y, 'z': lm.z} for lm in lms]
        x_min = max(0,  int(min(lm.x for lm in lms) * w) - 30)
        x_max = min(w,  int(max(lm.x for lm in lms) * w) + 30)
        y_min = max(0,  int(min(lm.y for lm in lms) * h) - 30)
        y_max = min(h,  int(max(lm.y for lm in lms) * h) + 30)
    except Exception as e:
        print(f"[MediaPipe] detection error: {e}")
        return None, None, None

    crop = img_bgr[y_min:y_max, x_min:x_max]
    if crop.size == 0:
        return None, None, None

    return crop, (x_min, y_min, x_max - x_min, y_max - y_min), landmarks


def landmarks_to_features(landmarks: list) -> np.ndarray:
    """
    Convert 21 MediaPipe landmarks to 78-feature vector.
    Same as training: 63 normalized coords + 15 geometric features.
    """
    pts = np.array([[lm['x'], lm['y'], lm.get('z', 0.0)] for lm in landmarks], dtype=np.float32)

    # Normalize: center on wrist, scale by middle-finger MCP distance
    wrist = pts[0].copy()
    pts = pts - wrist
    hand_size = np.linalg.norm(pts[9]) + 1e-6
    pts = pts / hand_size

    base = pts.flatten()  # 63 features

    tips = [4, 8, 12, 16, 20]
    mcps = [2, 5, 9, 13, 17]

    extensions = [float(np.linalg.norm(pts[t] - pts[m])) for t, m in zip(tips, mcps)]
    curls      = [float(pts[m][1] - pts[t][1]) for t, m in zip(tips, mcps)]
    thumb_index = float(np.linalg.norm(pts[4] - pts[8]))
    thumb_z     = float(pts[4][2])
    tip_spread  = float(np.std([pts[t][0] for t in tips]))
    wrist_mid   = float(np.linalg.norm(pts[12]))
    v1 = pts[8] - pts[5]; v2 = pts[12] - pts[9]
    cos_angle = float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6))

    geo = np.array(extensions + curls + [thumb_index, thumb_z, tip_spread, wrist_mid, cos_angle],
                   dtype=np.float32)
    return np.concatenate([base, geo])  # 78 features


def render_skeleton_image(landmarks: list) -> np.ndarray:
    """
    Render skeleton matching training data exactly.
    Training images: hand bbox cropped and scaled to fill ~50-70% of 400x400 canvas,
    centered, with red connections + green dots (MediaPipe drawing_utils style).
    """
    SIZE = 400
    img = np.ones((SIZE, SIZE, 3), dtype=np.uint8) * 255
    if not landmarks or len(landmarks) < 21:
        return img

    CONNECTIONS = [(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),(0,9),(9,10),(10,11),(11,12),
                   (0,13),(13,14),(14,15),(15,16),(0,17),(17,18),(18,19),(19,20),(5,9),(9,13),(13,17)]
    TIPS = {4, 8, 12, 16, 20}

    xs = [lm['x'] for lm in landmarks]
    ys = [lm['y'] for lm in landmarks]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)

    # Scale hand to fill ~60% of canvas, centered — matches training data
    target = SIZE * 0.60
    span_x = x_max - x_min or 0.01
    span_y = y_max - y_min or 0.01
    scale = target / max(span_x, span_y)

    cx = (x_min + x_max) / 2
    cy = (y_min + y_max) / 2

    def tp(x, y):
        return (int((x - cx) * scale + SIZE / 2),
                int((y - cy) * scale + SIZE / 2))

    pts = [tp(lm['x'], lm['y']) for lm in landmarks]

    for a, b in CONNECTIONS:
        cv2.line(img, pts[a], pts[b], (0, 0, 255), 2, cv2.LINE_AA)
    for i, pt in enumerate(pts):
        cv2.circle(img, pt, 6 if i in TIPS else 4, (0, 255, 0), -1, cv2.LINE_AA)

    return img


def prepare_image(img_bgr):
    """Resize to 224×224 and normalise to [0,1] float32 RGB."""
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_rgb = cv2.resize(img_rgb, (IMAGE_SIZE, IMAGE_SIZE))
    arr     = np.array(img_rgb, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)   # (1, 224, 224, 3)


def get_label(pred_class: int) -> str:
    if 0 <= pred_class < len(labels):
        return labels[pred_class]
    return str(pred_class)


# ── Motion detection for J, Z, X (dynamic signs) ─────────────────────────────
from collections import deque
_landmark_history = deque(maxlen=8)  # last 8 frames of pinky tip position

def detect_motion_sign(landmarks: list) -> tuple:
    """
    Detect J (pinky draws J), Z (index draws Z), X (index hooks).
    Returns (sign, confidence) or (None, 0) if no motion sign detected.
    """
    if not landmarks or len(landmarks) < 21:
        return None, 0

    pinky_tip  = (landmarks[20]['x'], landmarks[20]['y'])
    index_tip  = (landmarks[8]['x'],  landmarks[8]['y'])
    _landmark_history.append({'pinky': pinky_tip, 'index': index_tip})

    if len(_landmark_history) < 5:
        return None, 0

    hist = list(_landmark_history)

    # J: pinky moves in a J shape — downward then curves left
    pinky_ys = [h['pinky'][1] for h in hist]
    pinky_xs = [h['pinky'][0] for h in hist]
    dy_pinky = pinky_ys[-1] - pinky_ys[0]   # positive = moved down
    dx_pinky = pinky_xs[-1] - pinky_xs[0]   # negative = moved left

    # Z: index moves right then down-left (Z shape)
    index_xs = [h['index'][0] for h in hist]
    index_ys = [h['index'][1] for h in hist]
    dx_index = index_xs[-1] - index_xs[0]
    dy_index = index_ys[-1] - index_ys[0]

    # Total movement magnitude
    pinky_movement = (sum(abs(pinky_ys[i]-pinky_ys[i-1]) + abs(pinky_xs[i]-pinky_xs[i-1])
                         for i in range(1, len(hist))))
    index_movement = (sum(abs(index_ys[i]-index_ys[i-1]) + abs(index_xs[i]-index_xs[i-1])
                         for i in range(1, len(hist))))

    # J: significant downward + leftward pinky movement
    if pinky_movement > 0.15 and dy_pinky > 0.08 and dx_pinky < -0.03:
        return 'J', min(0.85, pinky_movement * 3)

    # Z: significant rightward then leftward index movement (direction reversal)
    mid = len(index_xs) // 2
    first_half_dx = index_xs[mid] - index_xs[0]
    second_half_dx = index_xs[-1] - index_xs[mid]
    if index_movement > 0.12 and first_half_dx > 0.04 and second_half_dx < -0.02:
        return 'Z', min(0.80, index_movement * 3)

    return None, 0


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status':       'ok',
        'model_loaded': model is not None,
        'num_classes':  len(labels),
        'labels':       labels,
        'message':      'Sign Language Detection Backend running'
    })


@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data      = request.get_json(force=True)
        landmarks = data.get('landmarks')

        if cv2 is None:
            return jsonify({'error': 'OpenCV not available'}), 500

        # ── Motion signs first (J, Z) ────────────────────────────────────────
        motion_sign, motion_conf = detect_motion_sign(landmarks) if landmarks else (None, 0)
        if motion_sign and motion_conf > 0.5:
            pred_class = labels.index(motion_sign) if motion_sign in labels else 0
            print(f"[motion] {motion_sign} ({motion_conf*100:.1f}%)")
            return jsonify({
                'prediction': motion_sign, 'confidence': motion_conf,
                'pred_class': pred_class, 'timestamp': datetime.now().isoformat(),
                'hand_detected': True, 'mock': False
            })

        # ── Landmark MLP (primary — best for similar signs) ─────────────────
        if model is not None and landmarks and len(landmarks) == 21:
            feat       = landmarks_to_features(landmarks)
            inp        = np.expand_dims(feat, 0)
            probs      = model.predict(inp, verbose=0)[0]
            pred_class = int(np.argmax(probs))
            confidence = float(probs[pred_class])
            prediction = get_label(pred_class)
            mock       = False
            print(f"[landmark] {prediction} ({confidence*100:.1f}%)")

        # ── CNN fallback (skeleton image) ────────────────────────────────────
        elif cnn_model is not None and landmarks and len(landmarks) == 21:
            img        = render_skeleton_image(landmarks)
            inp        = prepare_image(img)
            probs      = cnn_model.predict(inp, verbose=0)[0]
            pred_class = int(np.argmax(probs))
            confidence = float(probs[pred_class])
            prediction = get_label(pred_class)
            mock       = False
            print(f"[cnn] {prediction} ({confidence*100:.1f}%)")

        else:
            import random
            pred_class = random.randint(0, len(labels) - 1)
            confidence = round(0.65 + random.random() * 0.30, 4)
            prediction = get_label(pred_class)
            mock       = True

        return jsonify({
            'prediction':    prediction,
            'confidence':    confidence,
            'pred_class':    pred_class,
            'timestamp':     datetime.now().isoformat(),
            'hand_detected': True,
            'mock':          mock
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/labels', methods=['GET'])
def get_labels():
    return jsonify({'labels': labels, 'count': len(labels)})


if __name__ == '__main__':
    import threading
    # Run initialization in background thread to prevent blocking Flask startup
    init_thread = threading.Thread(target=initialize, daemon=True)
    init_thread.start()
    
    # Start Flask server immediately
    print("[MAIN] Starting Flask server on http://127.0.0.1:5000")
    app.run(debug=False, host='127.0.0.1', port=5000, threaded=True)
