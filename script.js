const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const errorElement = document.getElementById('error');

// Set canvas size
canvas.width = 640;
canvas.height = 480;

let handLandmarker;
let lastGestureTime = 0;
let lastSpokenGesture = null;

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
  } catch (error) {
    errorElement.textContent = 'Camera access denied. Please enable camera permissions.';
    throw error;
  }
}

async function setupModel() {
  handLandmarker = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  handLandmarker.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  handLandmarker.onResults(processResults);
}

function processResults(results) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
      drawLandmarks(ctx, landmarks, {color: '#FF0000', lineWidth: 2});

      const gesture = detectGesture(landmarks);
      if (gesture) {
        onGestureDetected(gesture);
      }
    }
  } else {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.font = '20px Arial';
    ctx.fillText('No hand detected', 20, 40);
  }
}

function detectGesture(landmarks) {
  if (isVictory(landmarks)) return 'Peace ✌';
  if (isThumbsUp(landmarks)) return 'Good 👍';
  if (isPointing(landmarks)) return 'Select 👆';
  if (isFlatPalm(landmarks)) return 'Hello ✋';
  if (isFist(landmarks)) return 'Grab ✊';
  if (isOK(landmarks)) return 'OK 👌';
  if (isCallMe(landmarks)) return 'Call Me 🤙';
  if (isRockOn(landmarks)) return 'Rock On 🤘';

  const rotation = getWristRotation(landmarks);
  if (Math.abs(rotation) > 30) return 'No 🤚';

  return null;
}

// === Gesture Detection Functions ===
function isFlatPalm(landmarks) {
  const fingerTips = [8, 12, 16, 20];
  return fingerTips.every(tip => landmarks[tip].y < landmarks[tip - 2].y);
}

function isFist(landmarks) {
  const fingerTips = [8, 12, 16, 20];
  return fingerTips.every(tip => landmarks[tip].y > landmarks[tip - 2].y);
}

function isVictory(landmarks) {
  return (
    landmarks[8].y < landmarks[6].y &&
    landmarks[12].y < landmarks[10].y &&
    landmarks[16].y > landmarks[14].y &&
    landmarks[20].y > landmarks[18].y
  );
}

function isThumbsUp(landmarks) {
  return (
    landmarks[4].y < landmarks[3].y &&
    landmarks[8].y > landmarks[6].y &&
    landmarks[12].y > landmarks[10].y &&
    landmarks[16].y > landmarks[14].y &&
    landmarks[20].y > landmarks[18].y
  );
}

function isPointing(landmarks) {
  return (
    landmarks[8].y < landmarks[6].y &&
    landmarks[12].y > landmarks[10].y &&
    landmarks[16].y > landmarks[14].y &&
    landmarks[20].y > landmarks[18].y
  );
}

function isOK(landmarks) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const dist = Math.hypot(
    thumbTip.x - indexTip.x,
    thumbTip.y - indexTip.y
  );

  const middleUp = landmarks[12].y < landmarks[10].y;
  const ringUp = landmarks[16].y < landmarks[14].y;
  const pinkyUp = landmarks[20].y < landmarks[18].y;

  return dist < 0.05 && middleUp && ringUp && pinkyUp;
}

function isCallMe(landmarks) {
  const thumbUp = landmarks[4].y < landmarks[3].y;
  const pinkyUp = landmarks[20].y < landmarks[19].y;
  const middleDown = landmarks[12].y > landmarks[10].y;
  const ringDown = landmarks[16].y > landmarks[14].y;
  const indexDown = landmarks[8].y > landmarks[6].y;

  return thumbUp && pinkyUp && middleDown && ringDown && indexDown;
}

function isRockOn(landmarks) {
  const indexUp = landmarks[8].y < landmarks[6].y;
  const pinkyUp = landmarks[20].y < landmarks[18].y;
  const middleDown = landmarks[12].y > landmarks[10].y;
  const ringDown = landmarks[16].y > landmarks[14].y;
  const thumbDown = landmarks[4].y > landmarks[3].y;

  return indexUp && pinkyUp && middleDown && ringDown && thumbDown;
}

function getWristRotation(landmarks) {
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  return Math.atan2(middleBase.y - wrist.y, middleBase.x - wrist.x) * 180 / Math.PI;
}

function onGestureDetected(label) {
  if (Date.now() - lastGestureTime > 1000 || label !== lastSpokenGesture) {
    lastGestureTime = Date.now();
    lastSpokenGesture = label;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#00FF00');
    gradient.addColorStop(1, '#00FFFF');

    ctx.fillStyle = gradient;
    ctx.font = 'bold 32px Segoe UI';
    ctx.fillText(label, canvas.width - 250, 60);

    ctx.restore();

    console.log(`Gesture detected: ${label}`);
    speakGesture(label);
  }
}

// === Speech Function ===
function speakGesture(text) {
  const synth = window.speechSynthesis;
  if (!synth) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.pitch = 1;
  utterance.rate = 1;
  synth.cancel(); // cancel any current speech
  synth.speak(utterance);
}

async function main() {
  try {
    await setupCamera();
    await setupModel();

    const camera = new Camera(video, {
      onFrame: async () => {
        await handLandmarker.send({image: video});
      },
      width: 640,
      height: 480
    });

    camera.start();
  } catch (error) {
    errorElement.textContent = `Error: ${error.message}`;
    console.error(error);
  }
}

async function setupCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      video.srcObject = stream;
      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          console.log('Camera initialized successfully');
          resolve();
        };
      });
    } catch (error) {
      console.error('Error initializing camera:', error);
      errorElement.textContent = 'Camera access denied. Please enable camera permissions.';
      throw error;
    }
  }

  function processResults(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      console.log('Hand landmarks detected:', results.multiHandLandmarks);
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });
  
        const gesture = detectGesture(landmarks);
        if (gesture) {
          onGestureDetected(gesture);
        }
      }
    } else {
      console.log('No hand detected');
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.font = '20px Arial';
      ctx.fillText('No hand detected', 20, 40);
    }
  }

  function speakGesture(text) {
    const synth = window.speechSynthesis;
    if (!synth) {
      console.error('Speech synthesis not supported in this browser');
      return;
    }
  
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.pitch = 1;
    utterance.rate = 1;
    synth.cancel(); // cancel any current speech
    synth.speak(utterance);
    console.log('Speaking gesture:', text);
  }
  async function main() {
    try {
      await setupCamera();
      await setupModel();
  
      const camera = new Camera(video, {
        onFrame: async () => {
          await handLandmarker.send({ image: video });
        },
        width: 640,
        height: 480
      });
  
      camera.start();
      console.log('Camera started successfully');
    } catch (error) {
      errorElement.textContent = `Error: ${error.message}`;
      console.error('Error in main function:', error);
    }
  }
  function onGestureDetected(label) {
    if (label !== lastSpokenGesture) {
      lastSpokenGesture = label;
  
      // Clear the canvas area where the text is displayed
      ctx.clearRect(0, 0, canvas.width, 80); // Clear the area where the text is displayed
  
      // Draw the gesture text on the canvas
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
  
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#00FF00');
      gradient.addColorStop(1, '#00FFFF');
  
      ctx.fillStyle = gradient;
      ctx.font = 'bold 32px Segoe UI';
      ctx.fillText(label, canvas.width - 250, 60);
  
      ctx.restore();
  
      console.log(`Gesture detected: ${label}`);
      speakGesture(label);
    }
  }
  
  function processResults(results) {
    // Clear only the area below the text
    ctx.clearRect(0, 80, canvas.width, canvas.height - 80);
  
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2 });
  
        const gesture = detectGesture(landmarks);
        if (gesture) {
          onGestureDetected(gesture);
        }
      }
    } else {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.font = '20px Arial';
      ctx.fillText('No hand detected', 20, 40);
    }
  }
main();