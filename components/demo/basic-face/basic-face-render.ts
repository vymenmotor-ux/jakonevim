/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
type BasicFaceProps = {
  ctx: CanvasRenderingContext2D;
  mouthScale: number;
  eyeScale: number;
  color?: string;
  intensity?: number; // 0 to 1
  analyser?: AnalyserNode;
};

// Removed noise helper function as jitter is removed for performance.

let dataArray: Uint8Array;

export function renderBasicFace(props: BasicFaceProps) {
  const {
    ctx,
    mouthScale,
    color,
    intensity = 0,
    analyser
  } = props;

  const { width, height } = ctx.canvas;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  const fillColor = color || '#00ff00';

  // Draw a simple pulsing circle at the center
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  const radius = (width / 4) * (0.5 + mouthScale * 0.5); // Base size + scale with mouth
  ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  ctx.fill();
}