// Face recognition utilities
// NOTE: Install face-api.js and canvas packages for real face recognition:
// npm install face-api.js canvas
// Then download models from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights
// Place them in the /models folder

let faceapi: any = null;
let canvas: any = null;
let modelsLoaded = false;

try {
  faceapi = require('face-api.js');
  canvas = require('canvas');
  faceapi.env.monkeyPatch({ Canvas: canvas.Canvas, Image: canvas.Image });
} catch {
  console.log('Face recognition not available - install face-api.js and canvas for full functionality');
}

export const loadModels = async () => {
  if (!faceapi || modelsLoaded) return;
  try {
    const path = require('path');
    const MODELS_PATH = path.join(__dirname, '../../models');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);
    modelsLoaded = true;
    console.log('Face recognition models loaded');
  } catch {
    console.log('Face recognition models not found - face matching disabled');
  }
};

export const detectFaces = async (imagePath: string): Promise<any[]> => {
  if (!faceapi || !canvas || !modelsLoaded) return [];
  try {
    const img = await canvas.loadImage(imagePath);
    const c = canvas.createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const detections = await faceapi
      .detectAllFaces(c)
      .withFaceLandmarks()
      .withFaceDescriptors();
    return detections.map((d: any, index: number) => ({
      index,
      descriptor: Array.from(d.descriptor),
      box: d.detection.box
    }));
  } catch {
    return [];
  }
};

export const compareFaces = (descriptor1: number[], descriptor2: number[]): number => {
  if (!faceapi || !modelsLoaded) return 1;
  try {
    const desc1 = new Float32Array(descriptor1);
    const desc2 = new Float32Array(descriptor2);
    return faceapi.euclideanDistance(desc1, desc2);
  } catch {
    return 1;
  }
};

export const findBestMatch = (
  photoDescriptors: number[][],
  selfieDescriptor: number[],
  threshold: number = 0.6
): { matched: boolean; confidence: number; bestIndex: number } => {
  let bestDistance = Infinity;
  let bestIndex = -1;
  for (let i = 0; i < photoDescriptors.length; i++) {
    const distance = compareFaces(photoDescriptors[i], selfieDescriptor);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  const confidence = Math.max(0, 1 - bestDistance);
  const matched = bestDistance < threshold;
  return { matched, confidence, bestIndex };
};
