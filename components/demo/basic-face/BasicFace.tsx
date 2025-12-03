/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { RefObject, useEffect, useState, useRef } from 'react';

import { renderBasicFace } from './basic-face-render';

import useFace from '../../../hooks/demo/use-face';
// Removed useHover and useTilt as dynamic visual movement is disabled for performance
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';

// Minimum volume level that indicates audio output is occurring
const AUDIO_OUTPUT_DETECTION_THRESHOLD = 0.05;

// Amount of delay between end of audio output and setting talking state to false
const TALKING_STATE_COOLDOWN_MS = 500;

type BasicFaceProps = {
  /** The canvas element on which to render the face. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The radius of the face. */
  radius?: number;
  /** The color of the face. */
  color?: string;
};

export default function BasicFace({
  canvasRef,
  radius = 250,
  color,
}: BasicFaceProps) {
  const timeoutRef = useRef<number | null>(null);

  // Audio output volume
  const { volume, analyser } = useLiveAPIContext();

  // Talking state - kept for potential future logic, but not for visual transforms
  const [isTalking, setIsTalking] = useState(false);

  const [scale, setScale] = useState(0.1);

  // Face state
  const { eyeScale, mouthScale } = useFace();
  // Removed hoverPosition and tiltAngle as dynamic visual movement is disabled for performance
  // const hoverPosition = useHover({ frequency: isTalking ? 2 : 0.5, amplitude: isTalking ? 15 : 10 });
  // const tiltAngle = useTilt({
  //   maxAngle: isTalking ? 10 : 5,
  //   speed: isTalking ? 0.2 : 0.075,
  //   isActive: isTalking,
  // });

  useEffect(() => {
    function calculateScale() {
      setScale(Math.min(window.innerWidth, window.innerHeight) / 1000);
    }
    window.addEventListener('resize', calculateScale);
    calculateScale();
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  // Detect whether the agent is talking based on audio output volume
  // Set talking state when volume is detected
  useEffect(() => {
    if (volume > AUDIO_OUTPUT_DETECTION_THRESHOLD) {
      setIsTalking(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Enforce a slight delay between end of audio output and setting talking state to false
      timeoutRef.current = window.setTimeout(
        () => setIsTalking(false),
        TALKING_STATE_COOLDOWN_MS
      );
    }
  }, [volume]);

  // Render the face on the canvas
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')!;
    // Calculate "anger" or intensity based on volume
    const intensity = Math.min(volume * 2.5, 1); 
    
    renderBasicFace({ 
      ctx, 
      mouthScale, 
      eyeScale, 
      color, 
      intensity, // Pass intensity to renderer
      analyser // Pass analyser for oscilloscope
    });
  }, [canvasRef, volume, eyeScale, mouthScale, color, scale, analyser]);

  return (
    <canvas
      className="basic-face"
      ref={canvasRef}
      width={radius * 2 * scale}
      height={radius * 2 * scale}
      style={{
        display: 'block',
        borderRadius: '50%',
        // Removed dynamic transform styles for maximum performance and audio stability
        // transform: `translate(${isTalking && volume > 0.2 ? (Math.random() - 0.5) * 10 : 0}px, ${hoverPosition + (isTalking && volume > 0.2 ? (Math.random() - 0.5) * 10 : 0)}px) rotate(${tiltAngle}deg)`,
      }}
    />
  );
}