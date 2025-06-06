"use client";

import { useState, useEffect } from 'react';
import type { Move, Result } from '@/lib/gameLogic';
import { determineWinner } from '@/lib/gameLogic';
import { aiOpponentStrategy, type AiOpponentStrategyOutput } from '@/ai/flows/ai-opponent-strategy';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoveButton } from '@/components/game/MoveButton';
import { MoveDisplay } from '@/components/game/MoveDisplay';
import { ScoreBoard } from '@/components/game/ScoreBoard';
import { ResultDisplay } from '@/components/game/ResultDisplay';
import { Loader2, User, Cpu } from 'lucide-react';

type GamePhase = 'select' | 'reveal' | 'result';

export default function HomePage() {
  const [userMove, setUserMove] = useState<Move | null>(null);
  const [aiMove, setAiMove] = useState<Move | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<Result>(null);
  const [userScore, setUserScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [userMovesHistory, setUserMovesHistory] = useState<Move[]>([]);
  const [gamePhase, setGamePhase] = useState<GamePhase>('select');
  const [showConfetti, setShowConfetti] = useState(false);

  const handleUserSelectMove = async (move: Move) => {
    setUserMove(move);
    setGamePhase('reveal');
    setIsLoadingAI(true);
    setAiMove(null); // Clear previous AI move
    setRoundResult(null); // Clear previous result
    setAiReasoning(null);

    try {
      const aiResponse: AiOpponentStrategyOutput = await aiOpponentStrategy({ userMoves: userMovesHistory });
      setAiMove(aiResponse.aiMove);
      setAiReasoning(aiResponse.reasoning);

      const result = determineWinner(move, aiResponse.aiMove);
      setRoundResult(result);

      if (result === 'Win') {
        setUserScore((prev) => prev + 1);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000); // Confetti for 3 seconds
      } else if (result === 'Lose') {
        setAiScore((prev) => prev + 1);
      }

      setUserMovesHistory((prev) => [...prev, move]);
      setGamePhase('result');
    } catch (error) {
      console.error("Error getting AI move:", error);
      // Handle error, maybe set a default AI move or show an error message
      // For now, let's make AI pick randomly on error to keep game playable
      const moves: Move[] = ['Rock', 'Paper', 'Scissors'];
      const randomAiMove = moves[Math.floor(Math.random() * moves.length)];
      setAiMove(randomAiMove);
      setAiReasoning("AI strategy unavailable, made a random move.");
      const result = determineWinner(move, randomAiMove);
      setRoundResult(result);
      if (result === 'Win') setUserScore((prev) => prev + 1);
      else if (result === 'Lose') setAiScore((prev) => prev + 1);
      setUserMovesHistory((prev) => [...prev, move]);
      setGamePhase('result');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handlePlayAgain = () => {
    setUserMove(null);
    setAiMove(null);
    setRoundResult(null);
    setGamePhase('select');
    setAiReasoning(null);
    setShowConfetti(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 relative overflow-hidden">
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50">
          {[...Array(100)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-accent animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 8 + 4}px`,
                height: `${Math.random() * 8 + 4}px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${Math.random() * 3 + 2}s`,
                opacity: Math.random() * 0.5 + 0.5,
              }}
            />
          ))}
        </div>
      )}
      <style jsx global>{`
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-fall {
          animation-name: fall;
          animation-timing-function: linear;
        }
      `}</style>


      <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-extrabold mb-6 md:mb-10 text-center tracking-tight"
          style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
        RPS Dueler
      </h1>
      
      <ScoreBoard userScore={userScore} aiScore={aiScore} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 my-6 md:my-8 w-full max-w-5xl items-start">
        <Card className="flex flex-col items-center p-4 md:p-6 shadow-xl rounded-xl">
          <h2 className="text-2xl md:text-3xl font-headline font-semibold mb-4">You</h2>
          <MoveDisplay 
            move={userMove} 
            placeholderType="user"
            highlightColor={roundResult === 'Win' ? 'hsl(var(--accent))' : undefined}
          />
        </Card>

        <div className="flex flex-col items-center justify-start md:justify-center md:order-none order-last md:min-h-[300px] pt-4 md:pt-0">
          {gamePhase === 'select' && (
            <div className="flex flex-col items-center space-y-3 w-full">
              <p className="text-lg md:text-xl mb-2 text-center">Choose your move:</p>
              <MoveButton move="Rock" onClick={() => handleUserSelectMove('Rock')} disabled={isLoadingAI} />
              <MoveButton move="Paper" onClick={() => handleUserSelectMove('Paper')} disabled={isLoadingAI} />
              <MoveButton move="Scissors" onClick={() => handleUserSelectMove('Scissors')} disabled={isLoadingAI} />
            </div>
          )}
          
          {(gamePhase === 'reveal' || gamePhase === 'result') && !isLoadingAI && roundResult && (
             <ResultDisplay result={roundResult} />
          )}

           {isLoadingAI && gamePhase === 'reveal' && (
              <div className="flex flex-col items-center text-center py-10">
                <Loader2 className="w-16 h-16 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground text-lg">AI is strategizing...</p>
              </div>
          )}

          {gamePhase === 'result' && !isLoadingAI && (
            <Button onClick={handlePlayAgain} className="mt-6 md:mt-8 w-full md:w-auto px-8 py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-shadow" variant="default">
              Play Again
            </Button>
          )}
        </div>

        <Card className="flex flex-col items-center p-4 md:p-6 shadow-xl rounded-xl">
          <h2 className="text-2xl md:text-3xl font-headline font-semibold mb-4">AI</h2>
          <MoveDisplay 
            move={aiMove} 
            placeholderType="ai" 
            isLoading={isLoadingAI && gamePhase === 'reveal'}
            isShaking={isLoadingAI && gamePhase === 'reveal'}
            highlightColor={roundResult === 'Lose' ? 'hsl(var(--accent))' : undefined}
          />
        </Card>
      </div>

      {aiReasoning && gamePhase === 'result' && !isLoadingAI && (
        <Card className="mt-6 md:mt-8 p-4 md:p-6 w-full max-w-md shadow-lg rounded-xl">
          <CardHeader className="p-2 md:p-4 text-center">
            <CardTitle className="text-lg md:text-xl font-headline">AI's Tactical Insight</CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4 text-center">
            <p className="text-sm md:text-base text-muted-foreground italic">"{aiReasoning}"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
