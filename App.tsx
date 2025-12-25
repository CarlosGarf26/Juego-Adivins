import React, { useState, useEffect, useRef } from 'react';
import { fetchSlangWords } from './services/geminiService';
import { useGameSensor } from './hooks/useGameSensor';
import { GameState, WordCard, GameResult, Difficulty } from './types';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [deck, setDeck] = useState<WordCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<GameResult[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('barrio');
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState<'correct' | 'pass' | null>(null);
  
  // Ref for timer to clear it properly
  const timerRef = useRef<number | null>(null);

  // Sensor Logic
  const handleCorrect = () => {
    setFeedback('correct');
    setResults(prev => [...prev, { word: deck[currentIndex].word, status: 'correct' }]);
    setTimeout(() => {
      nextCard();
    }, 500);
  };

  const handlePass = () => {
    setFeedback('pass');
    setResults(prev => [...prev, { word: deck[currentIndex].word, status: 'pass' }]);
    setTimeout(() => {
        nextCard();
    }, 500);
  };

  const nextCard = () => {
    setFeedback(null);
    if (currentIndex < deck.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      endGame();
    }
  };

  const { hasPermission, requestAccess, debugInfo } = useGameSensor({
    isActive: gameState === GameState.PLAYING,
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
            1. Pon el cel en tu frente (horizontal).<br/>
            2. Tus amigos te describen la palabra.<br/>
            3. <span className="text-green-300 font-bold">Inclina abajo</span> si adivinas.<br/>
            4. <span className="text-red-300 font-bold">Inclina arriba</span> para pasar.
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
        
        <p className="mt-8 text-xs text-white/40">Powered by Gemini AI</p>
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
    if (feedback === 'correct') bgClass = "bg-green-500";
    if (feedback === 'pass') bgClass = "bg-orange-500";

    return (
      <div className={`flex flex-col items-center justify-center min-h-screen w-full ${bgClass} transition-colors duration-300 relative overflow-hidden`}>
        {/* Timer */}
        <div className="absolute top-4 right-6 w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-black/20">
            <span className={`text-2xl font-black ${timeLeft < 10 ? 'text-red-400' : 'text-white'}`}>{timeLeft}</span>
        </div>
        
        {/* Sensor Debug (Optional, hidden mostly) */}
        {/* <div className="absolute top-2 left-2 text-xs text-white/50">{debugInfo}</div> */}

        {feedback ? (
            <div className="text-6xl font-black text-white uppercase tracking-widest animate-bounce">
                {feedback === 'correct' ? '¡ESO!' : 'PASO'}
            </div>
        ) : (
            <div className="flex flex-col items-center text-center max-w-4xl px-4 animate-in fade-in zoom-in duration-300">
                <h1 className="text-7xl md:text-9xl font-black text-white mb-6 drop-shadow-xl uppercase leading-tight transform -rotate-1">
                {currentCard?.word}
                </h1>
                
                <div className="bg-black/20 backdrop-blur-sm p-6 rounded-2xl border border-white/10 max-w-2xl">
                    <p className="text-2xl text-yellow-200 font-bold mb-2">"{currentCard?.definition}"</p>
                    <p className="text-lg text-white/80 italic">Ej: {currentCard?.example}</p>
                </div>

                <div className="absolute bottom-8 flex space-x-20 opacity-50">
                    <div className="text-center">
                        <div className="text-4xl">👇</div>
                        <div className="font-bold text-sm">Correcto</div>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl">👆</div>
                        <div className="font-bold text-sm">Pasar</div>
                    </div>
                </div>
            </div>
        )}

        {/* Manual controls fallback if sensor is tricky for user */}
        <div className="absolute inset-y-0 left-0 w-32 z-10" onClick={handleCorrect} />
        <div className="absolute inset-y-0 right-0 w-32 z-10" onClick={handlePass} />
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
                <div key={idx} className={`flex justify-between items-center p-4 rounded-lg ${r.status === 'correct' ? 'bg-green-900/50 border border-green-500/30' : 'bg-red-900/50 border border-red-500/30'}`}>
                    <span className="text-xl font-bold">{r.word}</span>
                    <span className={`text-sm font-bold uppercase ${r.status === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
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