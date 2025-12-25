import { useState, useEffect, useRef, useCallback } from 'react';

type SensorAction = 'correct' | 'pass' | 'neutral';

interface UseGameSensorProps {
  isActive: boolean;
  onCorrect: () => void;
  onPass: () => void;
}

export const useGameSensor = ({ isActive, onCorrect, onPass }: UseGameSensorProps) => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const lastAction = useRef<SensorAction>('neutral');
  const actionLock = useRef<boolean>(false); // Debounce lock

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!isActive) return;

    // Beta represents front-to-back tilt [-180, 180]
    // Gamma represents left-to-right tilt [-90, 90]
    // We assume the phone is held in Landscape mode on the forehead.
    // In Landscape (home button right):
    // - Upright (Neutral): Gamma is near -90 or 90 depending on rotation
    // - Tilt Down (Face floor): Gamma approaches 0 or 180 (flips)
    // 
    // However, depending on browser implementation, Beta might be the primary axis in landscape.
    // Let's use a simpler logic assuming the user holds the phone landscape.
    
    // We will look at Gamma mainly for landscape forehead placement.
    // If the phone is landscape:
    // Neutral: Screen facing forward.
    // Correct (Down): Screen faces floor.
    // Pass (Up): Screen faces ceiling.

    const { beta, gamma } = event;
    
    if (beta === null || gamma === null) return;

    setDebugInfo(`B: ${Math.round(beta)}, G: ${Math.round(gamma)}`);

    // LOGIC:
    // When held on forehead in landscape:
    // 'gamma' usually drives the tilt up/down relative to the user's face.
    
    let currentAction: SensorAction = 'neutral';

    // Thresholds (Adjusted for typical behavior)
    // Note: This can vary wildly by device/OS. 
    // Usually Gamma > 60 is neutral (verticalish)
    // Gamma < 30 is looking down (correct)
    // Gamma > 130 (or flipping) is looking up (pass)
    
    // Simplified Logic checking for drastic changes:
    // We assume the user holds it vertically to start.
    
    const isLandscape = window.innerWidth > window.innerHeight;

    if (isLandscape) {
       // Logic for Landscape
       // Check Gamma (Roll)
       if (Math.abs(gamma) < 35) {
         currentAction = 'correct'; // Tilted down towards floor
       } else if (Math.abs(gamma) > 135) {
         currentAction = 'pass'; // Tilted up towards ceiling
       } else if (Math.abs(gamma) > 60 && Math.abs(gamma) < 110) {
         currentAction = 'neutral';
       }
    } else {
        // Fallback or Portrait logic (though game should be landscape)
        // In portrait, Beta controls tilt.
        if (beta < 30) {
            currentAction = 'pass'; // Tilted up
        } else if (beta > 130) {
             currentAction = 'correct'; // Tilted down (inverted usually)
        } else if (beta > 60 && beta < 100) {
            currentAction = 'neutral';
        }
    }

    // State Machine to prevent spamming
    if (currentAction === 'neutral') {
      lastAction.current = 'neutral';
      actionLock.current = false;
    } else if (!actionLock.current && currentAction !== lastAction.current) {
      if (currentAction === 'correct') {
        onCorrect();
        actionLock.current = true;
        lastAction.current = 'correct';
        playFeedback(true);
      } else if (currentAction === 'pass') {
        onPass();
        actionLock.current = true;
        lastAction.current = 'pass';
        playFeedback(false);
      }
    }
  }, [isActive, onCorrect, onPass]);

  const requestAccess = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setHasPermission(true);
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          alert("Permiso denegado. No podrás usar los sensores.");
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Non-iOS 13+ devices
      setHasPermission(true);
      window.addEventListener('deviceorientation', handleOrientation);
    }
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

  return { hasPermission, requestAccess, debugInfo };
};

// Simple audio feedback
const playFeedback = (success: boolean) => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (success) {
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } else {
        osc.frequency.value = 200;
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    }
};
