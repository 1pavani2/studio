
"use client";

import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, set, update, remove, serverTimestamp, runTransaction } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { Move, Result } from '@/lib/gameLogic';
import { determineWinner } from '@/lib/gameLogic';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoveButton } from '@/components/game/MoveButton';
import { MoveDisplay } from '@/components/game/MoveDisplay';
import { ScoreBoard } from '@/components/game/ScoreBoard';
import { ResultDisplay } from '@/components/game/ResultDisplay';
import { Loader2, Users, LogOut, Copy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

type GamePhase = 'lobby' | 'waitingForOpponent' | 'playing' | 'reveal' | 'result' | 'opponentLeft';
type PlayerRole = 'player1' | 'player2' | null;

interface RoomData {
  player1Id: string | null;
  player2Id: string | null;
  player1Move: Move | null;
  player2Move: Move | null;
  player1Score: number;
  player2Score: number;
  status: GamePhase;
  round: number;
  lastActivity?: any;
  player1Online?: boolean;
  player2Online?: boolean;
}

const generateUserId = () => {
  let userId = localStorage.getItem('rpsUserId');
  if (!userId) {
    userId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('rpsUserId', userId);
  }
  return userId;
};

export default function HomePage() {
  const [userId] = useState<string>(generateUserId());
  const [roomIdInput, setRoomIdInput] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<PlayerRole>(null);
  
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');

  const { toast } = useToast();

  const resetLocalGameStates = useCallback(() => {
    // Most state is now derived from roomData, but some local UI state might need reset
    setPlayerRole(null);
  }, []);

  // Subscribe to room data
  useEffect(() => {
    if (!currentRoomId) {
      if (roomData) setRoomData(null); // Clear room data if no current room
      return;
    }

    setIsLoading(true);
    const roomRef = ref(db, `rooms/${currentRoomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setIsLoading(false);
      const data = snapshot.val() as RoomData | null;
      if (data) {
        setRoomData(data);
        setGamePhase(data.status);
        if (data.player1Id === userId) {
          setPlayerRole('player1');
        } else if (data.player2Id === userId) {
          setPlayerRole('player2');
        }

        // Check for opponent leaving
        if (data.status !== 'lobby' && data.status !== 'waitingForOpponent') {
          if (playerRole === 'player1' && data.player2Id && !data.player2Online) {
            setGamePhase('opponentLeft');
          } else if (playerRole === 'player2' && data.player1Id && !data.player1Online) {
             setGamePhase('opponentLeft');
          }
        }

      } else {
        // Room deleted or doesn't exist
        toast({ title: "Room not found", description: "The room may have been deleted or the ID is incorrect.", variant: "destructive" });
        setCurrentRoomId(null);
        setRoomData(null);
        setPlayerRole(null);
        setGamePhase('lobby');
      }
    }, (error) => {
      console.error("Firebase read failed: ", error);
      setIsLoading(false);
      toast({ title: "Error connecting to room", description: error.message, variant: "destructive" });
    });

    return () => {
      unsubscribe();
      // Mark player as offline if they were in a room
      if (currentRoomId && playerRole) {
        const playerOnlineRef = ref(db, `rooms/${currentRoomId}/${playerRole === 'player1' ? 'player1Online' : 'player2Online'}`);
        set(playerOnlineRef, false);
      }
    };
  }, [currentRoomId, userId, toast, playerRole]);


  // Handle online status
  useEffect(() => {
    if (!currentRoomId || !playerRole || !roomData) return;
    
    const playerOnlinePath = playerRole === 'player1' ? 'player1Online' : 'player2Online';
    const playerOnlineRef = ref(db, `rooms/${currentRoomId}/${playerOnlinePath}`);
    
    set(playerOnlineRef, true); // Mark as online when joining/creating
    
    // Could use onDisconnect here for more robust offline detection, but it's more complex.
    // For simplicity, relying on explicit leave or browser close for now (handled by unsubscribe).

  }, [currentRoomId, playerRole, roomData?.status]);


  const handleCreateRoom = async () => {
    setIsLoading(true);
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = ref(db, `rooms/${newRoomId}`);
    const initialRoomData: RoomData = {
      player1Id: userId,
      player2Id: null,
      player1Move: null,
      player2Move: null,
      player1Score: 0,
      player2Score: 0,
      status: 'waitingForOpponent',
      round: 1,
      lastActivity: serverTimestamp(),
      player1Online: true,
      player2Online: false,
    };
    try {
      await set(roomRef, initialRoomData);
      setCurrentRoomId(newRoomId);
      setPlayerRole('player1');
      setGamePhase('waitingForOpponent');
    } catch (error: any) {
      toast({ title: "Failed to create room", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomIdInput.trim()) {
      toast({ title: "Invalid Room ID", description: "Please enter a Room ID.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const prospectiveRoomId = roomIdInput.trim().toUpperCase();
    const roomRef = ref(db, `rooms/${prospectiveRoomId}`);

    try {
      const snapshot = await runTransaction(roomRef, (currentData: RoomData | null) => {
        if (currentData === null) {
          toast({ title: "Room not found", description: `Room ${prospectiveRoomId} does not exist.`, variant: "destructive" });
          return; // Abort transaction
        }
        if (currentData.player2Id && currentData.player2Id !== userId) {
          toast({ title: "Room is full", description: `Room ${prospectiveRoomId} is already full.`, variant: "destructive" });
          return; // Abort transaction
        }
        if (currentData.player1Id === userId) { // Already in room as P1
           return currentData; // No change needed
        }

        currentData.player2Id = userId;
        currentData.status = 'playing';
        currentData.lastActivity = serverTimestamp();
        currentData.player2Online = true;
        return currentData;
      });

      if (snapshot.committed && snapshot.snapshot.exists()) {
        setCurrentRoomId(prospectiveRoomId);
        setPlayerRole('player2');
        setGamePhase('playing');
      } else if (!snapshot.committed) {
        // Transaction aborted, toast should have been shown by the transaction function
      }
    } catch (error: any) {
      console.error("Join room failed:", error);
      toast({ title: "Failed to join room", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoomId || !playerRole) return;
    setIsLoading(true);
    const roomRef = ref(db, `rooms/${currentRoomId}`);
    try {
      if (playerRole === 'player1') {
        // If P1 leaves, consider deleting the room or marking it as abandoned
        await remove(roomRef);
        toast({ title: "Room Closed", description: "You have left and closed the room."});
      } else { // Player 2 leaves
        await update(roomRef, {
          player2Id: null,
          player2Move: null, // Clear P2's last move
          status: 'waitingForOpponent',
          player2Online: false,
          lastActivity: serverTimestamp()
        });
        toast({ title: "Left Room", description: "You have left the room."});
      }
    } catch (error: any) {
      toast({ title: "Error leaving room", description: error.message, variant: "destructive" });
    } finally {
      setCurrentRoomId(null);
      setPlayerRole(null);
      setRoomData(null);
      resetLocalGameStates();
      setGamePhase('lobby');
      setRoomIdInput('');
      setIsLoading(false);
    }
  };

  const handlePlayerSelectMove = async (move: Move) => {
    if (!currentRoomId || !playerRole || !roomData || roomData.status !== 'playing') return;
    
    const playerMovePath = playerRole === 'player1' ? 'player1Move' : 'player2Move';
    if (roomData[playerMovePath] !== null) {
      toast({title: "Move already made", description: "You've already selected your move for this round.", variant: "default"});
      return;
    }

    setIsLoading(true);
    try {
      await update(ref(db, `rooms/${currentRoomId}`), {
        [playerMovePath]: move,
        lastActivity: serverTimestamp()
      });
      // UI will update via onValue listener
    } catch (error: any) {
      toast({ title: "Failed to make move", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to determine winner when both players have moved
  useEffect(() => {
    if (!roomData || !currentRoomId || playerRole !== 'player1') return; // P1 handles result calculation

    const { player1Move, player2Move, status, round } = roomData;

    if (status === 'playing' && player1Move && player2Move) {
      setIsLoading(true);
      const roomRef = ref(db, `rooms/${currentRoomId}`);
      runTransaction(roomRef, (currentRoomState: RoomData | null) => {
        if (!currentRoomState || currentRoomState.round !== round || currentRoomState.status !== 'playing') {
            // State changed, abort, or already processed
            return currentRoomState; 
        }
        if (currentRoomState.player1Move && currentRoomState.player2Move) {
            const resultP1 = determineWinner(currentRoomState.player1Move, currentRoomState.player2Move);
            let newP1Score = currentRoomState.player1Score;
            let newP2Score = currentRoomState.player2Score;

            if (resultP1 === 'Win') newP1Score++;
            else if (resultP1 === 'Lose') newP2Score++;
            
            return {
                ...currentRoomState,
                player1Score: newP1Score,
                player2Score: newP2Score,
                status: 'result',
                lastActivity: serverTimestamp()
            };
        }
        return currentRoomState; // No change if moves aren't ready
      }).then(() => {
         setIsLoading(false); // Handled by onValue listener updating gamePhase
      }).catch((error: any) => {
        console.error("Failed to update result:", error);
        toast({ title: "Error processing round", description: error.message, variant: "destructive" });
        setIsLoading(false);
      });
    }
  }, [roomData, currentRoomId, playerRole, toast]);


  const handlePlayAgain = async () => {
    if (!currentRoomId || !roomData || playerRole !== 'player1') { // Only P1 can initiate play again for simplicity
        if(playerRole === 'player2'){
            toast({title: "Waiting for Host", description: "Player 1 (Host) can start the next round."});
        }
        return;
    }
    setIsLoading(true);
    try {
      await update(ref(db, `rooms/${currentRoomId}`), {
        player1Move: null,
        player2Move: null,
        status: 'playing',
        round: roomData.round + 1,
        lastActivity: serverTimestamp()
      });
      // UI updates via onValue
    } catch (error: any) {
      toast({ title: "Failed to start new round", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyRoomId = () => {
    if (currentRoomId) {
      navigator.clipboard.writeText(currentRoomId)
        .then(() => toast({ title: "Room ID Copied!", description: currentRoomId }))
        .catch(err => toast({ title: "Failed to copy", description: err.message, variant: "destructive" }));
    }
  };

  // Derived states for UI rendering
  const yourMove = playerRole && roomData ? (playerRole === 'player1' ? roomData.player1Move : roomData.player2Move) : null;
  const opponentMove = playerRole && roomData ? (playerRole === 'player1' ? roomData.player2Move : roomData.player1Move) : null;
  
  const yourScore = playerRole && roomData ? (playerRole === 'player1' ? roomData.player1Score : roomData.player2Score) : 0;
  const opponentScore = playerRole && roomData ? (playerRole === 'player1' ? roomData.player2Score : roomData.player1Score) : 0;
  
  let displayResult: Result = null;
  if (roomData && roomData.player1Move && roomData.player2Move && roomData.status === 'result') {
    const p1Result = determineWinner(roomData.player1Move, roomData.player2Move);
    if (playerRole === 'player1') {
      displayResult = p1Result;
    } else if (playerRole === 'player2') {
      if (p1Result === 'Win') displayResult = 'Lose';
      else if (p1Result === 'Lose') displayResult = 'Win';
      else displayResult = 'Draw';
    }
  }
  
  const canMakeMove = playerRole && roomData && roomData.status === 'playing' && 
    (playerRole === 'player1' ? !roomData.player1Move : !roomData.player2Move);

  const selfPlayerName = playerRole === 'player1' ? "Player 1 (You)" : (playerRole === 'player2' ? "Player 2 (You)" : "You");
  const opponentPlayerName = playerRole === 'player1' ? "Player 2" : "Player 1";


  if (gamePhase === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-extrabold mb-10 text-center tracking-tight">RPS Realtime Duel</h1>
        <Card className="w-full max-w-md p-6 md:p-8 shadow-xl rounded-xl">
          <CardHeader className="p-0 mb-6 text-center">
            <CardTitle className="text-2xl md:text-3xl font-semibold">Join or Create a Room</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            <Button onClick={handleCreateRoom} className="w-full py-6 text-lg rounded-lg shadow-md hover:shadow-lg" variant="default" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 animate-spin" /> : <Users className="mr-2" />} Create New Room
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
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                className="h-12 text-center text-lg"
                disabled={isLoading}
              />
              <Button onClick={handleJoinRoom} className="w-full py-6 text-lg rounded-lg shadow-md hover:shadow-lg" variant="outline" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 animate-spin" /> : null} Join Room
              </Button>
            </div>
          </CardContent>
        </Card>
         <p className="mt-4 text-xs text-muted-foreground">Your User ID: {userId}</p>
      </div>
    );
  }

  if (gamePhase === 'waitingForOpponent' && currentRoomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <h1 className="text-3xl sm:text-4xl font-headline font-bold mb-2 text-center">Room: {currentRoomId}</h1>
        <Button onClick={copyRoomId} variant="ghost" size="sm" className="mb-4 text-primary">
            Copy Room ID <Copy className="ml-2 h-4 w-4"/>
        </Button>
        <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground mb-8">Waiting for Player 2 to join...</p>
        <Button onClick={handleLeaveRoom} variant="outline" className="rounded-lg shadow-md" disabled={isLoading}>
          {isLoading && gamePhase === 'waitingForOpponent' ? <Loader2 className="mr-2 animate-spin" /> : <LogOut className="mr-2" />} Close Room
        </Button>
      </div>
    );
  }
  
  if (gamePhase === 'opponentLeft') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <h1 className="text-3xl sm:text-4xl font-headline font-bold mb-6 text-center">Opponent Left</h1>
        <p className="text-xl text-muted-foreground mb-8">Your opponent has disconnected from the room.</p>
        <Button onClick={handleLeaveRoom} variant="default" className="rounded-lg shadow-md">
          Return to Lobby
        </Button>
      </div>
    );
  }

  if (!roomData) { // Should be covered by isLoading or other phases, but as a fallback
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading room data...</p>
      </div>
    );
  }
  
  const showWaitingForOpponentMove = roomData.status === 'playing' && playerRole && 
    (playerRole === 'player1' ? roomData.player1Move && !roomData.player2Move : roomData.player2Move && !roomData.player1Move);

  const showWaitingForYourMove = roomData.status === 'playing' && playerRole &&
    (playerRole === 'player1' ? !roomData.player1Move : !roomData.player2Move);
  
  const showMoveButtons = roomData.status === 'playing' && canMakeMove;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 flex items-center space-x-2 md:space-x-4">
        <span className="text-xs md:text-sm font-medium text-muted-foreground">Room: <strong className="text-foreground">{currentRoomId}</strong></span>
        <Button onClick={copyRoomId} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
            <Copy className="h-4 w-4"/> <span className="sr-only">Copy Room ID</span>
        </Button>
        <Button onClick={handleLeaveRoom} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={isLoading && gamePhase !== 'lobby'}>
          {isLoading && gamePhase !== 'lobby' ? <Loader2 className="animate-spin h-4 w-4" /> : <LogOut className="mr-1 h-4 w-4" />} Leave
        </Button>
      </div>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-extrabold mb-6 md:mb-10 text-center tracking-tight"
          style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
        RPS Realtime Duel
      </h1>
      
      <ScoreBoard 
        player1Score={roomData.player1Score} 
        player2Score={roomData.player2Score}
        player1Name={playerRole === 'player1' ? "You (P1)" : "Player 1"}
        player2Name={playerRole === 'player2' ? "You (P2)" : "Player 2"}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 my-6 md:my-8 w-full max-w-5xl items-start">
        <Card className="flex flex-col items-center p-4 md:p-6 shadow-xl rounded-xl">
          <h2 className="text-2xl md:text-3xl font-headline font-semibold mb-4">{selfPlayerName}</h2>
          <MoveDisplay 
            move={yourMove} 
            placeholderType={'user'}
            highlightColor={displayResult === 'Win' ? 'hsl(var(--accent))' : (displayResult === 'Lose' ? 'hsl(var(--destructive))' : undefined)}
            isPlayerSide={true}
          />
        </Card>

        <div className="flex flex-col items-center justify-start md:justify-center md:order-none order-last md:min-h-[300px] pt-4 md:pt-0">
          {showMoveButtons && (
            <div className="flex flex-col items-center space-y-3 w-full">
              <p className="text-lg md:text-xl mb-2 text-center">Choose your move:</p>
              <MoveButton move="Rock" onClick={() => handlePlayerSelectMove('Rock')} disabled={isLoading}/>
              <MoveButton move="Paper" onClick={() => handlePlayerSelectMove('Paper')} disabled={isLoading}/>
              <MoveButton move="Scissors" onClick={() => handlePlayerSelectMove('Scissors')} disabled={isLoading}/>
            </div>
          )}
          
          {showWaitingForYourMove && !isLoading && (
             <p className="text-muted-foreground text-lg text-center py-10">Your turn to move...</p>
          )}

          {showWaitingForOpponentMove && !isLoading && (
            <div className="flex flex-col items-center text-center py-10">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground text-lg">Waiting for {opponentPlayerName}'s move...</p>
            </div>
          )}
          
          {isLoading && (gamePhase === 'playing' || gamePhase === 'reveal') && !(gamePhase === 'result' || gamePhase === 'lobby' || gamePhase === 'waitingForOpponent') && (
              <div className="flex flex-col items-center text-center py-10">
                <Loader2 className="w-16 h-16 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground text-lg">Processing...</p>
              </div>
          )}
          
          {gamePhase === 'result' && displayResult && (
             <ResultDisplay result={displayResult} playerRole={playerRole} />
          )}

          {gamePhase === 'result' && (
            <Button 
              onClick={handlePlayAgain} 
              className="mt-6 md:mt-8 w-full md:w-auto px-8 py-6 text-lg rounded-lg shadow-md hover:shadow-lg transition-shadow" 
              variant="default"
              disabled={isLoading || (playerRole === 'player2' && roomData.status === 'result')} // P2 waits for P1 to start new game
            >
              {isLoading ? <Loader2 className="mr-2 animate-spin" /> : (playerRole === 'player1' ? "Play Again" : "Waiting for Host...")}
            </Button>
          )}
        </div>

        <Card className="flex flex-col items-center p-4 md:p-6 shadow-xl rounded-xl">
          <h2 className="text-2xl md:text-3xl font-headline font-semibold mb-4">{opponentPlayerName}</h2>
          <MoveDisplay 
            move={opponentMove} 
            placeholderType={'ai'} 
            isLoading={gamePhase === 'playing' && ((playerRole === 'player1' && !roomData.player2Move) || (playerRole === 'player2' && !roomData.player1Move))}
            highlightColor={displayResult === 'Lose' ? 'hsl(var(--accent))' : (displayResult === 'Win' ? 'hsl(var(--destructive))' : undefined)}
            isPlayerSide={false}
          />
           {!roomData.player2Id && roomData.status === 'waitingForOpponent' && <p className="text-xs text-muted-foreground mt-2">Waiting to join...</p>}
        </Card>
      </div>
    </div>
  );
}
