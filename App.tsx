import React, { useState, useEffect, useRef } from 'react';
import { fetchSlangWords } from './services/geminiService.ts';
import { useGameSensor } from './hooks/useGameSensor.ts';
import { GameState, WordCard, GameResult, Difficulty } from './types.ts';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [deck, setDeck] = useState<WordCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<GameResult[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('barrio');
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState<'correct' | 'pass' | null>(null);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  
  // Ref for timer to clear it properly
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkOrientation = () => {
        setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Sensor Logic
  const handleCorrect = () => {
    if (feedback) return; // Prevent double trigger
    setFeedback('correct');
    setResults(prev => [...prev, { word: deck[currentIndex].word, status: 'correct' }]);
    playFeedback(true);
    setTimeout(() => {
      nextCard();
    }, 800);
  };

  const handlePass = () => {
    if (feedback) return; // Prevent double trigger
    setFeedback('pass');
    setResults(prev => [...prev, { word: deck[currentIndex].word, status: 'pass' }]);
    playFeedback(false);
    setTimeout(() => {
        nextCard();
    }, 800);
  };

  const nextCard = () => {
    setFeedback(null);
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      endGame();
    }
  };

  const { hasPermission, requestAccess } = useGameSensor({
    isActive: gameState === GameState.PLAYING && !feedback,
    onCorrect: handleCorrect,
    onPass: handlePass
  });

  const startGame = async () => {
    setGameState(GameState.LOADING);
    const words = await fetchSlangWords(difficulty);
    setDeck(words);
    setResults([]);
    setCurrentIndex(0);
    setTimeLeft(60);
    setGameState(GameState.PLAYING);
  };

  const endGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState(GameState.FINISHED);
  };

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // Audio Context Helper
  const playFeedback = (success: boolean) => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (success) {
            osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
            osc.type = 'sine';
        } else {
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
            osc.type = 'sawtooth';
        }

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch(e) {
        console.error("Audio play failed", e);
    }
  };

  if (isPortrait && gameState === GameState.PLAYING) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center">
              <div className="text-6xl mb-4 animate-bounce">🔄</div>
              <h2 className="text-2xl font-bold uppercase text-yellow-400">¡Gira tu cel!</h2>
              <p>Este juego se disfruta mejor en horizontal.</p>
          </div>
      );
  }

  // Main Menu
  if (gameState === GameState.IDLE) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-600 to-purple-800 p-6 text-center">
        <h1 className="text-6xl font-black text-yellow-300 mb-2 drop-shadow-md font-sans tracking-tighter transform -rotate-2">
          ¡Adivina!
        </h1>
        <h2 className="text-2xl text-white font-bold mb-8 uppercase tracking-widest">Edición Chilango</h2>

        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl w-full max-w-md border border-white/20 shadow-xl mb-8">
          <p className="text-lg text-white mb-4">
            <span className="font-bold text-yellow-300">Instrucciones:</span><br/>
            1. Pon el cel en tu frente.<br/>
            2. Que te describan la palabra.<br/>
            3. <span className="text-green-300 font-bold">Inclina abajo</span> si adivinas.<br/>
            4. <span className="text-red-300 font-bold">Inclina arriba</span> para pasar.<br/>
            <span className="text-xs text-gray-300 mt-2 block">(O toca la pantalla a los lados)</span>
          </p>
          
          <div className="mb-4">
            <label className="text-gray-200 text-sm font-bold uppercase mb-2 block">Dificultad</label>
            <div className="flex justify-center space-x-2">
                {(['facil', 'barrio', 'experto'] as Difficulty[]).map((d) => (
                    <button 
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`px-4 py-2 rounded-full capitalize font-bold transition-all ${difficulty === d ? 'bg-yellow-400 text-purple-900 scale-105' : 'bg-purple-900/50 text-gray-300'}`}
                    >
                        {d}
                    </button>
                ))}
            </div>
          </div>
        </div>

        {!hasPermission ? (
          <button
            onClick={requestAccess}
            className="w-full max-w-xs py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-xl shadow-lg transition-transform active:scale-95 mb-4"
          >
            Activar Sensores
          </button>
        ) : (
            <button
            onClick={startGame}
            className="w-full max-w-xs py-4 bg-yellow-400 hover:bg-yellow-300 text-purple-900 font-black rounded-xl text-2xl shadow-lg transition-transform active:scale-95 animate-pulse"
          >
            ¡JUGAR!
          </button>
        )}
        
        <p className="mt-8 text-xs text-white/40">Powered by Gemini AI, creado por Juan Garfias</p>
      </div>
    );
  }

  // Loading Screen
  if (gameState === GameState.LOADING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-purple-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-400 mb-4"></div>
        <p className="text-xl text-white font-bold animate-pulse">Preparando el barrio...</p>
      </div>
    );
  }

  // Playing Screen
  if (gameState === GameState.PLAYING) {
    const currentCard = deck[currentIndex];
    
    // Background based on feedback state
    let bgClass = "bg-blue-600";
    if (feedback === 'correct') bgClass = "bg-green-600";
    if (feedback === 'pass') bgClass = "bg-orange-600";

    return (
      <div className={`flex flex-col items-center justify-center min-h-screen w-full ${bgClass} transition-colors duration-300 relative overflow-hidden`}>
        {/* Timer */}
        <div className="absolute top-4 right-6 w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-black/20 z-20">
            <span className={`text-2xl font-black ${timeLeft < 10 ? 'text-red-400' : 'text-white'}`}>{timeLeft}</span>
        </div>
        
        {/* Controls Overlay (Tap Zones) */}
        <div className="absolute inset-0 flex z-0">
             <div 
                className="w-1/2 h-full active:bg-green-500/20 flex items-center justify-start pl-8 transition-colors"
                onClick={handleCorrect}
             >
                 <span className="text-white/20 text-4xl font-black transform -rotate-90">CORRECTO</span>
             </div>
             <div 
                className="w-1/2 h-full active:bg-orange-500/20 flex items-center justify-end pr-8 transition-colors"
                onClick={handlePass}
             >
                 <span className="text-white/20 text-4xl font-black transform -rotate-90">PASO</span>
             </div>
        </div>

        <div className="z-10 relative w-full max-w-4xl px-4 flex flex-col items-center">
            {feedback ? (
                <div className="text-7xl md:text-9xl font-black text-white uppercase tracking-widest animate-bounce drop-shadow-lg">
                    {feedback === 'correct' ? '¡ESO!' : 'PASO'}
                </div>
            ) : (
                <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                    <h1 className="text-7xl md:text-9xl font-black text-white mb-8 drop-shadow-xl uppercase leading-tight transform -rotate-1 break-words max-w-full">
                    {currentCard?.word}
                    </h1>
                    
                    <div className="bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/10 max-w-2xl">
                        <p className="text-2xl text-yellow-200 font-bold mb-2">"{currentCard?.definition}"</p>
                        <p className="text-lg text-white/80 italic">Ej: {currentCard?.example}</p>
                    </div>
                </div>
            )}
        </div>
        
        {/* Visual guide */}
        {!feedback && (
            <div className="absolute bottom-4 flex justify-between w-full px-12 opacity-50 pointer-events-none">
                <div className="text-center">
                    <div className="text-4xl">👇</div>
                    <div className="font-bold text-sm">Correcto (Inclina/Toca Izq)</div>
                </div>
                <div className="text-center">
                    <div className="text-4xl">👆</div>
                    <div className="font-bold text-sm">Pasar (Inclina/Toca Der)</div>
                </div>
            </div>
        )}
      </div>
    );
  }

  // Summary Screen
  if (gameState === GameState.FINISHED) {
    const score = results.filter(r => r.status === 'correct').length;
    
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-6 overflow-y-auto">
        <h2 className="text-4xl font-black text-yellow-400 mb-2 mt-8">¡Se acabó!</h2>
        <div className="text-6xl font-black mb-8">{score} <span className="text-2xl font-normal text-gray-400">puntos</span></div>

        <div className="w-full max-w-md space-y-3 mb-8">
            {results.map((r, idx) => (
                <div key={idx} className={`flex justify-between items-center p-4 rounded-lg ${r.status === 'correct' ? 'bg-green-900/50 border border-green-500/30' : 'bg-orange-900/50 border border-orange-500/30'}`}>
                    <span className="text-xl font-bold">{r.word}</span>
                    <span className={`text-sm font-bold uppercase ${r.status === 'correct' ? 'text-green-400' : 'text-orange-400'}`}>
                        {r.status === 'correct' ? 'Adivinada' : 'Pasada'}
                    </span>
                </div>
            ))}
        </div>

        <button 
            onClick={() => setGameState(GameState.IDLE)}
            className="px-8 py-4 bg-white text-purple-900 font-bold rounded-full text-xl shadow-xl hover:bg-gray-100 transition-colors mb-8"
        >
            Jugar otra vez
        </button>
      </div>
    );
  }

  return null;
};

export default App;