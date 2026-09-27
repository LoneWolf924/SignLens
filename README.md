# SIGNLENS — Real-Time Sign Language Detection

## Abstract

Sign language is the primary mode of communication for millions of deaf and hard-of-hearing people worldwide. Bridging the communication gap between sign language users and the general population requires technology that can accurately interpret hand gestures in real time.

SIGNLENS is a web application that uses a Convolutional Neural Network (CNN) to detect and classify American Sign Language (ASL) hand gestures live from a webcam feed. The system combines a MobileNetV2-based deep learning model trained on ASL hand gesture images with MediaPipe's hand landmark detection to deliver real-time, browser-based sign language recognition.

The application renders 21 detected hand keypoints into a skeleton image and feeds it into the CNN, returning a predicted letter with a confidence score. The result is displayed in an interactive React dashboard with prediction history, performance analytics, and an ASL reference guide.

**Keywords:** sign language, ASL, hand gesture recognition, convolutional neural network, MobileNetV2, MediaPipe, real-time classification, deep learning, computer vision, Flask, React.

---

## Problem Identification

Building a reliable real-time sign language recognition system involves several key challenges:

1. **Hand Detection Robustness**
   - Varying lighting conditions, skin tones, and backgrounds make consistent hand detection difficult.
   - Partial occlusion of fingers or wrist can reduce landmark accuracy, directly impacting classification.

2. **Model Complexity and Generalisation**
   - A model that is too complex risks overfitting to training data and performing poorly on unseen users.
   - A model that is too simple will underfit and fail to distinguish visually similar signs (e.g. A, E, S or M, N).
   - The model must generalise across different hand sizes, orientations, and distances from the camera.

3. **Dynamic vs. Static Signs**
   - Most ASL letters are static poses, but J and Z require motion.
   - A purely image-based CNN cannot capture motion, requiring a separate temporal detection layer for these letters.

4. **Latency and Real-Time Performance**
   - The pipeline must complete landmark extraction, skeleton rendering, model inference, and UI update within a frame window acceptable for real-time use.
   - Running TensorFlow on CPU without GPU acceleration adds inference latency that must be managed.

5. **Prediction Stability**
   - Single-frame predictions are noisy. Without smoothing, the displayed letter flickers rapidly even when the hand is held still.
   - A smoothing window over recent frames is needed to produce stable, readable output.

---

## Proposed System Design

SIGNLENS is designed as a three-layer pipeline: browser-side landmark extraction, a Python backend for inference, and a React frontend for display.

- **Hand Landmark Extraction (Browser):** MediaPipe's `@mediapipe/tasks-vision` WASM module runs directly in the browser, detecting 21 3D hand keypoints from each webcam frame without sending raw video to the server.

- **Skeleton Rendering:** The 21 landmarks are sent to the Python backend, which renders them as a standardised 400×400 skeleton image. This representation strips away background, skin tone, and lighting variation, leaving only the geometric shape of the hand.

- **CNN Classification (Backend):** The skeleton image is resized to 224×224 and passed through a MobileNetV2-based CNN. The model outputs a probability distribution over 26 ASL letter classes (A–Z). The class with the highest probability is returned along with its confidence score.

- **Motion Sign Detection:** Before CNN inference, the backend checks a rolling 8-frame history of pinky and index fingertip positions to detect the motion trajectories of J and Z. If a motion sign is detected with sufficient confidence, it is returned directly without CNN inference.

- **Prediction Smoothing (Frontend):** The React app maintains a sliding window of recent predictions. The most frequent prediction in the window is displayed, preventing flickering from single-frame noise.

- **User Interface:** A dark-mode React dashboard built with Tailwind CSS and shadcn/ui components shows the live webcam feed, current predicted sign, confidence bar, prediction history, performance analytics chart, and a built-in ASL alphabet reference guide. History can be exported as CSV.

### System Pipeline

```text
Webcam (Browser)
        │
        ▼
MediaPipe WASM — 21 hand landmarks
        │
        ▼
Express Proxy (Node.js, Port 3000)
        │
        ▼
Flask Backend (Python, Port 5000)
        │
        ├── Motion detector (J, Z) — landmark history
        │
        └── MobileNetV2 CNN — skeleton image → 26-class softmax
        │
        ▼
Prediction + Confidence
        │
        ▼
Frontend → Smoothed display
```

---

## Technologies and Tools

| Layer | Technology |
|---|---|
| Frontend UI | React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Hand Detection | MediaPipe Tasks Vision (WASM, browser-side) |
| Frontend Server | Node.js, Express, Vite |
| Backend | Python 3.11, Flask, Flask-CORS |
| Deep Learning | TensorFlow 2.13.1, Keras 2.13.1 |
| Model Architecture | MobileNetV2 + GlobalAveragePooling + Dense(128) + Dense(26) |
| Image Processing | OpenCV, Pillow |
| Data Storage | SQLite |

---

---

## Features

- Real-time ASL hand gesture recognition via webcam
- Browser-side hand landmark detection
- Motion-aware detection for dynamic signs J and Z
- Prediction smoothing to reduce single-frame noise
- Configurable confidence threshold and smoothing window
- Prediction history with CSV export
- Performance analytics chart
- Built-in ASL alphabet reference guide
- Dark mode UI
- Image upload mode for static image classification

---

## Full System Flow

```text
1. User opens http://localhost:3000 and starts the application
   ↓
2. Browser requests camera permission and starts webcam stream
   ↓
3. MediaPipe WASM detects 21 hand landmarks
   ↓
4. Landmarks are sent as JSON to /api/predict
   ↓
5. Flask backend:
      a. Checks 8-frame landmark history for J or Z motion trajectory
      b. If a motion sign is detected, returns the prediction
      c. Otherwise, renders a 400×400 skeleton image
      d. Resizes it to 224×224 and normalises it
      e. Runs the MobileNetV2 CNN
      f. Returns the prediction and confidence
   ↓
6. Frontend applies prediction smoothing
   ↓
7. Predicted letter and confidence are displayed
   ↓
8. Prediction is logged to history and analytics
```

---

## Results

The MobileNetV2 CNN was trained on ASL hand gesture skeleton images covering all 26 letters of the alphabet.

### Model Configuration

- **Classes:** 26 (A–Z)
- **Input:** 224×224 RGB skeleton image
- **Architecture:** MobileNetV2 (pretrained base) → GlobalAveragePooling2D → Dense(128, ReLU) → Dropout → Dense(26, Softmax)
- **Inference mode:** CPU only
- **Observed inference latency:** 100–200ms per frame on CPU

Detailed evaluation outputs are available in the `results/` directory.

---

## Conclusion

SIGNLENS demonstrates a real-time ASL recognition pipeline that combines browser-side landmark extraction with CNN-based classification of hand skeleton images.

By separating hand detection from classification, the system avoids sending raw webcam video to the Python backend. The motion detection layer additionally handles the dynamic letters J and Z, while frontend smoothing improves the stability of displayed predictions.

Future improvements could include expanding to full ASL words and phrases, adding support for Indian Sign Language (ISL), and deploying the model as a quantised TFLite model for lower latency.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Author

**Anubhav Singh Chauhan**
