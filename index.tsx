
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES ---
enum GameState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED'
}

interface WordCard {
  word: string;
  definition: string;
  example: string;
}

interface GameResult {
  word: string;
  status: 'correct' | 'pass';
}

type Difficulty = 'facil' | 'barrio' | 'experto';

// --- SERVICE ---
const SYSTEM_INSTRUCTION = `
Eres un experto en cultura popular mexicana y jerga de la Ciudad de México (chilango). 
Generas palabras o frases para un juego de adivinanzas (Heads Up). 
Las definiciones deben ser graciosas pero claras. 
Los ejemplos deben sonar 100% auténticos de la CDMX.
`;

const fetchSlangWords = async (difficulty: Difficulty): Promise<WordCard[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let promptContext = "";
  switch (difficulty) {
    case 'facil': promptContext = "palabras muy comunes (ej. Tacos, Metro, Guajolota)."; break;
    case 'barrio': promptContext = "jerga callejera nivel medio (ej. Chale, Cámara, Poca m...)."; break;
    case 'experto': promptContext = "frases complejas, albures ligeros o modismos antiguos (ej. Sepa la bola, A darle que es mole de olla)."; break;
  }

  const prompt = `Genera una lista de 15 palabras o frases de la CDMX. Nivel: ${difficulty}. Contexto: ${promptContext}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              definition: { type: Type.STRING },
              example: { type: Type.STRING }
            },
            required: ["word", "definition", "example"]
          }
        }
      }
    });

    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.error("Gemini Error:", error);
    return [
      { word: "Chale", definition: "Expresión de decepción", example: "¡Chale, ya se acabó el gas!" },
      { word: "Cámara", definition: "Acuerdo o despedida", example: "Cámara, ahí nos vemos." },
      { word: "Chamba", definition: "El trabajo", example: "Tengo un buen de chamba." },
      { word: "Chela", definition: "Una cerveza fría", example: "Vamos por unas chelas." },
      { word: "Neta", definition: "La pura verdad", example: "¿Es neta lo que me dices?" }
    ];
  }
};

// --- HOOKS ---
const useGameSensor = (isActive: boolean, onCorrect: () => void, onPass: () => void) => {
  const [hasPermission, setHasPermission] = useState(false);
  const lastAction = useRef<'neutral' | 'action'>('neutral');

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!isActive) return;
    const { gamma } = event; // Roll in landscape
    if (gamma === null) return;

    const absGamma = Math.abs(gamma);

    if (absGamma < 25 && lastAction.current === 'neutral') {
      onCorrect();
      lastAction.current = 'action';
    } else if (absGamma > 155 && lastAction.current === 'neutral') {
      onPass();
      lastAction.current = 'action';
    } else if (absGamma > 60 && absGamma < 120) {
      lastAction.current = 'neutral';
    }
  }, [isActive, onCorrect, onPass]);

  const requestAccess = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      const res = await (DeviceOrientationEvent as any).requestPermission();
      if (res === 'granted') {
        setHasPermission(true);
        window.addEventListener('deviceorientation', handleOrientation);
      }
    } else {
      setHasPermission(true);
      window.addEventListener('deviceorientation', handleOrientation);
    }
  };

  useEffect(() => {
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [handleOrientation]);

  return { hasPermission, requestAccess };
};

// --- MAIN COMPONENT ---
const App = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [deck, setDeck] = useState<WordCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<GameResult[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('barrio');
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState<'correct' | 'pass' | null>(null);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkSize = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const playSound = (freq: number) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
  };

  const handleCorrect = useCallback(() => {
    if (feedback) return;
    setFeedback('correct');
    playSound(800);
    setResults(prev => [...prev, { word: deck[currentIndex].word, status: 'correct' }]);
    setTimeout(nextCard, 600);
  }, [currentIndex, deck, feedback]);

  const handlePass = useCallback(() => {
    if (feedback) return;
    setFeedback('pass');
    playSound(300);
    setResults(prev => [...prev, { word: deck[currentIndex].word, status: 'pass' }]);
    setTimeout(nextCard, 600);
  }, [currentIndex, deck, feedback]);

  const nextCard = () => {
    setFeedback(null);
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishGame();
    }
  };

  const finishGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState(GameState.FINISHED);
  };

  const { hasPermission, requestAccess } = useGameSensor(
    gameState === GameState.PLAYING && !feedback,
    handleCorrect,
    handlePass
  );

  const startGame = async () => {
    setGameState(GameState.LOADING);
    const words = await fetchSlangWords(difficulty);
    setDeck(words);
    setCurrentIndex(0);
    setResults([]);
    setTimeLeft(60);
    setGameState(GameState.PLAYING);
    
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          finishGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (isPortrait && gameState === GameState.PLAYING) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white text-center p-8">
        <div className="text-8xl animate-bounce mb-4">🔄</div>
        <h2 className="text-3xl font-black text-pink-500 uppercase">¡Gira el fon!</h2>
        <p className="mt-4 text-gray-400">El barrio se ve mejor en horizontal.</p>
      </div>
    );
  }

  if (gameState === GameState.IDLE) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-tr from-indigo-900 via-purple-900 to-pink-800 p-6 text-center">
        {/* Estilo para la animación del título */}
        <style>{`
          @keyframes title-pulse {
            0%, 100% { transform: rotate(-2deg) scale(1); text-shadow: 0 4px 0 rgba(0,0,0,0.3); }
            50% { transform: rotate(-2deg) scale(1.05); text-shadow: 0 10px 20px rgba(253, 224, 71, 0.6); }
          }
        `}</style>
        
        <h1 
          className="text-7xl font-black text-yellow-300 mb-2 italic tracking-tighter"
          style={{ animation: 'title-pulse 2s infinite ease-in-out' }}
        >
          ¡ADIVINA!
        </h1>
        <h2 className="text-3xl font-bold text-white mb-10 tracking-widest uppercase text-pink-300">Edición Chilanga</h2>
        
        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 w-full max-w-md shadow-2xl mb-10">
          <p className="text-white text-lg mb-6 leading-relaxed">
            Pon el cel en tu frente y que tus valedores te expliquen la palabra.
          </p>
          <div className="space-y-4">
            <span className="text-xs font-bold text-pink-300 uppercase tracking-widest block">Selecciona Dificultad</span>
            <div className="flex gap-2">
              {(['facil', 'barrio', 'experto'] as Difficulty[]).map(d => (
                <button 
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-3 rounded-xl font-black uppercase transition-all ${difficulty === d ? 'bg-yellow-400 text-purple-900 scale-105 shadow-lg' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!hasPermission ? (
          <button onClick={requestAccess} className="bg-pink-600 hover:bg-pink-500 text-white font-black py-5 px-12 rounded-2xl text-2xl shadow-xl active:scale-95 transition-all">
            ACTIVAR SENSORES
          </button>
        ) : (
          <button onClick={startGame} className="bg-yellow-400 hover:bg-yellow-300 text-indigo-900 font-black py-5 px-16 rounded-2xl text-3xl shadow-xl animate-pulse active:scale-95 transition-all">
            ¡DALE!
          </button>
        )}
      </div>
    );
  }

  if (gameState === GameState.LOADING) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-indigo-950">
        <div className="w-20 h-20 border-8 border-pink-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-white text-2xl font-black animate-pulse tracking-widest uppercase">Afilando el colmillo...</p>
      </div>
    );
  }

  if (gameState === GameState.PLAYING) {
    const card = deck[currentIndex];
    let bg = "bg-indigo-600";
    if (feedback === 'correct') bg = "bg-green-500";
    if (feedback === 'pass') bg = "bg-orange-500";

    return (
      <div className={`h-screen w-screen flex flex-col items-center justify-center transition-colors duration-300 ${bg} relative overflow-hidden`}>
        <div className="absolute top-4 right-8 bg-black/40 px-4 py-2 rounded-full border border-white/20">
          <span className={`text-3xl font-black ${timeLeft < 10 ? 'text-red-400 animate-ping' : 'text-white'}`}>{timeLeft}s</span>
        </div>

        <div className="flex w-full h-full">
            <div className="w-1/2 h-full flex items-center justify-start pl-12 active:bg-white/10" onClick={handleCorrect}>
                <span className="text-white/20 font-black text-6xl transform -rotate-90 pointer-events-none">CORRECTO</span>
            </div>
            <div className="w-1/2 h-full flex items-center justify-end pr-12 active:bg-white/10" onClick={handlePass}>
                <span className="text-white/20 font-black text-6xl transform -rotate-90 pointer-events-none">PASAR</span>
            </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
          {feedback ? (
            <div className="text-9xl font-black text-white uppercase drop-shadow-2xl animate-bounce">
              {feedback === 'correct' ? '¡ESO!' : 'PASO'}
            </div>
          ) : (
            <div className="text-center animate-in zoom-in fade-in duration-500 w-full max-w-4xl">
              <h1 className="text-8xl md:text-9xl font-black text-white drop-shadow-2xl mb-6 leading-none break-words uppercase">
                {card?.word}
              </h1>
              <div className="bg-black/20 backdrop-blur-sm p-6 rounded-3xl border border-white/10 mx-auto max-w-2xl">
                <p className="text-3xl text-yellow-300 font-bold mb-2">"{card?.definition}"</p>
                <p className="text-xl text-white/70 italic italic tracking-tight">Ej: {card?.example}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === GameState.FINISHED) {
    const score = results.filter(r => r.status === 'correct').length;
    return (
      <div className="min-h-screen bg-indigo-950 text-white p-8 flex flex-col items-center overflow-y-auto">
        <h2 className="text-5xl font-black text-yellow-400 mt-10 mb-2 uppercase italic">¡Rifa total!</h2>
        <div className="text-8xl font-black mb-10">{score} <span className="text-2xl text-indigo-300 font-normal">puntos</span></div>
        
        <div className="w-full max-w-md space-y-3 mb-10">
          {results.map((res, i) => (
            <div key={i} className={`flex justify-between items-center p-4 rounded-2xl border ${res.status === 'correct' ? 'bg-green-900/30 border-green-500/50' : 'bg-red-900/30 border-red-500/50'}`}>
              <span className="text-2xl font-bold">{res.word}</span>
              <span className={`font-black uppercase text-sm ${res.status === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                {res.status === 'correct' ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>

        <button onClick={() => setGameState(GameState.IDLE)} className="bg-white text-indigo-900 font-black py-5 px-16 rounded-2xl text-2xl shadow-xl hover:scale-105 transition-all mb-20">
          OTRA VEZ
        </button>
      </div>
    );
  }

  return null;
};

// Render
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
