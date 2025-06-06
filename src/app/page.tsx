
"use client";

import { useState, useEffect } from 'react';
import type { Move, Result } from '@/lib/gameLogic';
import { determineWinner } from '@/lib/gameLogic';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoveButton } from '@/components/game/MoveButton';
import { MoveDisplay } from '@/components/game/MoveDisplay';
import { ScoreBoard } from '@/components/game/ScoreBoard';
import { ResultDisplay } from '@/components/game/ResultDisplay';
import { Loader2, Users, LogOut } from 'lucide-react';

type GamePhase = 'lobby' | 'waitingForOpponent' | 'playing' | 'reveal' | 'result';
type PlayerRole = 'player1' | 'player2' | null;

export default function HomePage() {
  const [roomIdInput, setRoomIdInput] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<PlayerRole>(null);

  const [player1Move, setPlayer1Move] = useState<Move | null>(null);
  const [player2Move, setPlayer2Move] = useState<Move | null>(null);

  const [roundResult, setRoundResult] = useState<Result>(null); // Result from P1's perspective
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');

  const resetGameStates = () => {
    setPlayer1Move(null);
    setPlayer2Move(null);
    setRoundResult(null);
    setPlayer1Score(0);
    setPlayer2Score(0);
  };

  const handleCreateRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setCurrentRoomId(newRoomId);
    setPlayerRole('player1');
    resetGameStates();
    setGamePhase('waitingForOpponent');
  };

  const handleJoinRoom = () => {
    if (!roomIdInput.trim()) {
      alert("Please enter a Room ID.");
      return;
    }
    setCurrentRoomId(roomIdInput.trim().toUpperCase());
    setPlayerRole('player2');
    resetGameStates();
    // In a real app, you'd verify the room and if P1 is present.
    // For simulation, we assume P1 is waiting.
    setGamePhase('playing');
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
    setPlayerRole(null);
    resetGameStates();
    setGamePhase('lobby');
    setRoomIdInput('');
  };

  const handlePlayerSelectMove = (move: Move) => {
    if (!playerRole) return;

    if (playerRole === 'player1' && !player1Move) {
      setPlayer1Move(move);
    } else if (playerRole === 'player2' && !player2Move) {
      setPlayer2Move(move);
    }
    // In a real app, this move would be sent to a server.
    // The useEffect below simulates the game progression.
  };

  useEffect(() => {
    // This effect simulates game progression once both players have moved.
    if (player1Move && player2Move && gamePhase === 'playing') {
      setGamePhase('reveal');
      setIsLoading(true); // Simulate "revealing"

      const revealTimeout = setTimeout(() => {
        const resultP1 = determineWinner(player1Move, player2Move);
        setRoundResult(resultP1);

        if (resultP1 === 'Win') {
          setPlayer1Score((prev) => prev + 1);
        } else if (resultP1 === 'Lose') {
          setPlayer2Score((prev) => prev + 1);
        }
        setIsLoading(false);
        setGamePhase('result');
      }, 1500); // Simulate delay for suspense

      return () => clearTimeout(revealTimeout);
    }
  }, [player1Move, player2Move, gamePhase]);

  const handlePlayAgain = () => {
    setPlayer1Move(null);
    setPlayer2Move(null);
    setRoundResult(null);
    setGamePhase('playing');
    // Scores are preserved for the room session
  };

  const yourMove = playerRole === 'player1' ? player1Move : player2Move;
  const opponentMove = playerRole === 'player1' ? player2Move : player1Move;
  const yourScore = playerRole === 'player1' ? player1Score : player2Score;
  const opponentScore = playerRole === 'player1' ? player2Score : player1Score;
  const canMakeMove = 
    (playerRole === 'player1' && !player1Move) ||
    (playerRole === 'player2' && !player2Move);

  let displayResult: Result = null;
  if (roundResult) {
    if (playerRole === 'player1') {
      displayResult = roundResult;
    } else { // Player 2's perspective
      if (roundResult === 'Win') displayResult = 'Lose';
      else if (roundResult === 'Lose') displayResult = 'Win';
      else displayResult = 'Draw';
    }
  }

  const showMoveButtons = gamePhase === 'playing' && playerRole && canMakeMove;
  const showWaitingForYourMove = gamePhase === 'playing' && playerRole && canMakeMove;
  const showWaitingForOpponent = gamePhase === 'playing' && playerRole && !canMakeMove && !(player1Move && player2Move);
  
  const selfPlayerName = playerRole === 'player1' ? "Player 1 (You)" : "Player 2 (You)";
  const opponentPlayerName = playerRole === 'player1' ? "Player 2" : "Player 1";


  if (gamePhase === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-extrabold mb-10 text-center tracking-tight">RPS Dueler</h1>
        <Card className="w-full max-w-md p-6 md:p-8 shadow-xl rounded-xl">
          <CardHeader className="p-0 mb-6 text-center">
            <CardTitle className="text-2xl md:text-3xl font-semibold">Join or Create a Room</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            <Button onClick={handleCreateRoom} className="w-full py-6 text-lg rounded-lg shadow-md hover:shadow-lg" variant="default">
              <Users className="mr-2" /> Create New Room
            </Button>
            <div className="flex items-center space-x-2">
              <hr className="flex-grow border-border" />
              <span className="text-muted-foreground">OR</span>
              <hr className="flex-grow border-border" />
            </div>
            <div className="space-y-2">
              <Input 
                type="text" 
                placeholder="Enter Room ID" 
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                className="h-12 text-center text-lg"
              />
              <Button onClick={handleJoinRoom} className="w-full py-6 text-lg rounded-lg shadow-md hover:shadow-lg" variant="outline">
                Join Room
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="mt-8 text-sm text-muted-foreground text-center max-w-md">
          Note: Multiplayer is simulated locally in this browser session. For true online play, a backend server would be needed.
        </p>
      </div>
    );
  }

  if (gamePhase === 'waitingForOpponent' && currentRoomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <h1 className="text-3xl sm:text-4xl font-headline font-bold mb-6 text-center">Room: {currentRoomId}</h1>
        <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground mb-8">Waiting for Player 2 to join...</p>
        <p className="text-sm text-muted-foreground mb-6">Share this Room ID with your opponent: <strong className="text-foreground">{currentRoomId}</strong></p>
        <Button onClick={handleLeaveRoom} variant="outline" className="rounded-lg shadow-md">
          <LogOut className="mr-2" /> Leave Room
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 flex items-center space-x-4">
        <span className="text-sm font-medium text-muted-foreground">Room ID: <strong className="text-foreground">{currentRoomId}</strong></span>
        <Button onClick={handleLeaveRoom} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <LogOut className="mr-1 h-4 w-4" /> Leave
        </Button>
      </div>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-extrabold mb-6 md:mb-10 text-center tracking-tight"
          style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
        RPS Dueler
      </h1>
      
      <ScoreBoard 
        player1Score={player1Score} 
        player2Score={player2Score}
        player1Name={playerRole === 'player1' ? "You (P1)" : "Player 1"}
        player2Name={playerRole === 'player2' ? "You (P2)" : "Player 2"}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 my-6 md:my-8 w-full max-w-5xl items-start">
        {/* Current Player's Display */}
        <Card className="flex flex-col items-center p-4 md:p-6 shadow-xl rounded-xl">
          <h2 className="text-2xl md:text-3xl font-headline font-semibold mb-4">{selfPlayerName}</h2>
          <MoveDisplay 
            move={yourMove} 
            placeholderType={playerRole === 'player1' ? 'user' : 'user'} // 'user' for self
            highlightColor={displayResult === 'Win' ? 'hsl(var(--accent))' : undefined}
            isPlayerSide={true}
          />
        </Card>

        {/* Game Controls / Result Display */}
        <div className="flex flex-col items-center justify-start md:justify-center md:order-none order-last md:min-h-[300px] pt-4 md:pt-0">
          {showMoveButtons && (
            <div className="flex flex-col items-center space-y-3 w-full">
              <p className="text-lg md:text-xl mb-2 text-center">Choose your move:</p>
              <MoveButton move="Rock" onClick={() => handlePlayerSelectMove('Rock')} />
              <MoveButton move="Paper" onClick={() => handlePlayerSelectMove('Paper')} />
              <MoveButton move="Scissors" onClick={() => handlePlayerSelectMove('Scissors')} />
            </div>
          )}
          
          {showWaitingForYourMove && !isLoading && gamePhase === 'playing' && (
             <p className="text-muted-foreground text-lg text-center py-10">Your turn to move...</p>
          )}

          {showWaitingForOpponent && !isLoading && gamePhase === 'playing' && (
            <div className="flex flex-col items-center text-center py-10">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground text-lg">Waiting for opponent's move...</p>
            </div>
          )}
          
          {isLoading && (gamePhase === 'reveal' || (gamePhase === 'playing' && (player1Move || player2Move) && !(player1Move && player2Move) ) ) && (
              <div className="flex flex-col items-center text-center py-10">
                <Loader2 className="w-16 h-16 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground text-lg">
                  {gamePhase === 'reveal' ? "Revealing moves..." : "Processing..."}
                </p>
              </div>
          )}
          
          {gamePhase === 'reveal' && !isLoading && player1Move && player2Move && (
            <p className="text-muted-foreground text-lg text-center py-10">Both players have moved. Revealing...</p>
          )}

          {gamePhase === 'result' && !isLoading && displayResult && (
             <ResultDisplay result={displayResult} playerRole={playerRole} />
          )}

          {gamePhase === 'result' && !isLoading && (
            <Button onClick={handlePlayAgain} className="mt-6 md:mt-8 w-full md:w-auto px-8 py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-shadow" variant="default">
              Play Again
            </Button>
          )}
        </div>

        {/* Opponent's Display */}
        <Card className="flex flex-col items-center p-4 md:p-6 shadow-xl rounded-xl">
          <h2 className="text-2xl md:text-3xl font-headline font-semibold mb-4">{opponentPlayerName}</h2>
          <MoveDisplay 
            move={opponentMove} 
            placeholderType={playerRole === 'player1' ? 'ai' : 'ai'} // 'ai' icon for opponent visually
            isLoading={isLoading && gamePhase === 'reveal'} // Only show general loading during reveal
            isShaking={false} // Shaking might be confusing for PvP
            highlightColor={displayResult === 'Lose' ? 'hsl(var(--accent))' : undefined}
            isPlayerSide={false}
          />
        </Card>
      </div>
       <p className="mt-8 text-sm text-muted-foreground text-center max-w-md">
          Note: Multiplayer is simulated locally in this browser session.
        </p>
    </div>
  );
}
