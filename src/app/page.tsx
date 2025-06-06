
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
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

// IMPORTANT: You need to create a 'rooms' table in your Supabase project
// with the following columns (or similar structure):
// - id: TEXT (Primary Key, Room ID)
// - created_at: TIMESTAMPTZ (default now())
// - player1_id: TEXT
// - player2_id: TEXT (nullable)
// - player1_move: TEXT (nullable, 'Rock', 'Paper', 'Scissors')
// - player2_move: TEXT (nullable, 'Rock', 'Paper', 'Scissors')
// - player1_score: INTEGER (default 0)
// - player2_score: INTEGER (default 0)
// - status: TEXT ('waitingForOpponent', 'playing', 'result')
// - round: INTEGER (default 1)
// - last_activity: TIMESTAMPTZ (default now())
// - player1_online: BOOLEAN (default false)
// - player2_online: BOOLEAN (default false)
//
// Also, ensure you have appropriate Row Level Security (RLS) policies enabled
// for the 'rooms' table to allow reads and writes as needed by your application.
// For example, allow public read, and allow authenticated users (or users matching player_id) to write.
// Start with broad RLS policies for testing and refine them for production.

type GamePhase = 'lobby' | 'waitingForOpponent' | 'playing' | 'reveal' | 'result' | 'opponentLeft';
type PlayerRole = 'player1' | 'player2' | null;

interface RoomData {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_move: Move | null;
  player2_move: Move | null;
  player1_score: number;
  player2_score: number;
  status: GamePhase;
  round: number;
  last_activity?: string; // ISO string date
  player1_online?: boolean;
  player2_online?: boolean;
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
  const [supabaseChannel, setSupabaseChannel] = useState<RealtimeChannel | null>(null);

  const { toast } = useToast();

  const resetLocalGameStates = useCallback(() => {
    setPlayerRole(null);
    // gamePhase will be reset by roomData listener or explicitly
  }, []);

  // Subscribe to room data with Supabase Realtime
  useEffect(() => {
    if (!currentRoomId) {
      if (supabaseChannel) {
        supabaseChannel.unsubscribe();
        setSupabaseChannel(null);
      }
      if (roomData) setRoomData(null); // Clear room data if no current room
      return;
    }

    setIsLoading(true);
    const channel = supabase
      .channel(`room-${currentRoomId}`)
      .on<RoomData>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${currentRoomId}` },
        (payload) => {
          setIsLoading(false);
          if (payload.eventType === 'DELETE') {
            toast({ title: "Room Closed", description: "The room has been closed.", variant: "destructive" });
            setCurrentRoomId(null);
            setRoomData(null);
            setPlayerRole(null);
            setGamePhase('lobby');
            return;
          }
          
          const newRoomData = payload.new as RoomData;
          if (newRoomData) {
            setRoomData(newRoomData);
            setGamePhase(newRoomData.status);
            if (newRoomData.player1_id === userId) {
              setPlayerRole('player1');
            } else if (newRoomData.player2_id === userId) {
              setPlayerRole('player2');
            }

            // Check for opponent leaving (based on online status)
            if (newRoomData.status !== 'lobby' && newRoomData.status !== 'waitingForOpponent') {
              const currentRole = newRoomData.player1_id === userId ? 'player1' : (newRoomData.player2_id === userId ? 'player2' : null);
              if (currentRole === 'player1' && newRoomData.player2_id && !newRoomData.player2_online) {
                setGamePhase('opponentLeft');
              } else if (currentRole === 'player2' && newRoomData.player1_id && !newRoomData.player1_online) {
                 setGamePhase('opponentLeft');
              }
            }

          } else if (payload.eventType !== 'DELETE') { // If not DELETE and no newRoomData, means room might not exist or filter issue
            toast({ title: "Room not found", description: "The room may have been deleted or the ID is incorrect.", variant: "destructive" });
            setCurrentRoomId(null);
            setRoomData(null);
            setPlayerRole(null);
            setGamePhase('lobby');
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // console.log('Subscribed to room channel:', currentRoomId);
          // Fetch initial room data once subscribed
          const { data, error } = await supabase.from('rooms').select('*').eq('id', currentRoomId).single();
          setIsLoading(false);
          if (error || !data) {
            console.error("Error fetching initial room data or room not found:", error);
            toast({ title: "Room not found", description: "Could not load room details.", variant: "destructive" });
            setCurrentRoomId(null); 
            setGamePhase('lobby');
          } else {
            setRoomData(data as RoomData);
            setGamePhase((data as RoomData).status);
             if ((data as RoomData).player1_id === userId) {
              setPlayerRole('player1');
            } else if ((data as RoomData).player2_id === userId) {
              setPlayerRole('player2');
            }
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsLoading(false);
          console.error("Supabase channel error or timed out: ", status);
          toast({ title: "Connection Error", description: "Could not connect to real-time service for the room.", variant: "destructive" });
        }
      });

    setSupabaseChannel(channel);

    return () => {
      if (channel) {
        supabase.removeChannel(channel).then(() => {
            // console.log('Unsubscribed from room channel:', currentRoomId);
        });
      }
      // Mark player as offline on component unmount or room change
      if (currentRoomId && playerRole) {
        const updatePayload: Partial<RoomData> = {};
        if (playerRole === 'player1') updatePayload.player1_online = false;
        if (playerRole === 'player2') updatePayload.player2_online = false;
        supabase.from('rooms').update(updatePayload).eq('id', currentRoomId).then();
      }
    };
  }, [currentRoomId, userId, toast]);


  // Handle online status (simplified: set on join/create, clear on leave)
  useEffect(() => {
    if (!currentRoomId || !playerRole || !roomData) return;
    
    const onlineUpdate: Partial<RoomData> = {};
    if (playerRole === 'player1') onlineUpdate.player1_online = true;
    if (playerRole === 'player2') onlineUpdate.player2_online = true;

    if (Object.keys(onlineUpdate).length > 0) {
      supabase.from('rooms').update(onlineUpdate).eq('id', currentRoomId).then(({error}) => {
        if(error) console.error("Error updating online status:", error);
      });
    }
  }, [currentRoomId, playerRole, roomData?.status]); // Re-assert online status if roomData status changes (e.g., rejoining)


  const handleCreateRoom = async () => {
    setIsLoading(true);
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const initialRoomData: Omit<RoomData, 'id' | 'created_at' | 'last_activity'> & { id: string } = {
      id: newRoomId,
      player1_id: userId,
      player2_id: null,
      player1_move: null,
      player2_move: null,
      player1_score: 0,
      player2_score: 0,
      status: 'waitingForOpponent',
      round: 1,
      player1_online: true,
      player2_online: false,
    };
    try {
      const { error } = await supabase.from('rooms').insert(initialRoomData);
      if (error) throw error;
      setCurrentRoomId(newRoomId);
      setPlayerRole('player1');
      setGamePhase('waitingForOpponent'); // Will be confirmed by subscription
    } catch (error: any) {
      toast({ title: "Failed to create room", description: error.message, variant: "destructive" });
      console.error("Create room error:", error);
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

    try {
      const { data: roomToJoin, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', prospectiveRoomId)
        .single();

      if (fetchError || !roomToJoin) {
        toast({ title: "Room not found", description: `Room ${prospectiveRoomId} does not exist.`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (roomToJoin.player1_id === userId) { // Already in room as P1
        setCurrentRoomId(prospectiveRoomId); // Re-join
        setPlayerRole('player1');
        // Game phase will be set by subscription
        setIsLoading(false);
        return;
      }

      if (roomToJoin.player2_id && roomToJoin.player2_id !== userId) {
        toast({ title: "Room is full", description: `Room ${prospectiveRoomId} is already full.`, variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ 
            player2_id: userId, 
            status: 'playing', 
            player2_online: true,
            last_activity: new Date().toISOString() 
        })
        .eq('id', prospectiveRoomId)
        .is('player2_id', null); // Attempt to claim P2 spot atomically

      if (updateError) {
        // This could be due to RLS or a concurrent join attempt. A more specific error check might be needed.
        // For now, assume the spot was taken or another error occurred.
        const { data: refetchedRoom } = await supabase.from('rooms').select('player2_id').eq('id', prospectiveRoomId).single();
        if (refetchedRoom && refetchedRoom.player2_id !== null && refetchedRoom.player2_id !== userId) {
             toast({ title: "Room is full", description: "Another player joined just before you.", variant: "destructive" });
        } else {
            throw updateError;
        }
        setIsLoading(false);
        return;
      }
      
      setCurrentRoomId(prospectiveRoomId);
      setPlayerRole('player2');
      // Game phase will be set by subscription reflecting the update
    } catch (error: any) {
      console.error("Join room failed:", error);
      toast({ title: "Failed to join room", description: error.message, variant: "destructive" });
    } finally {
      // setIsLoading(false); // isLoading is managed by subscription updates mostly
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoomId || !playerRole) return;
    setIsLoading(true);

    // Unsubscribe first to prevent race conditions with local state updates
    if (supabaseChannel) {
      await supabase.removeChannel(supabaseChannel);
      setSupabaseChannel(null);
    }
    
    const previousRoomId = currentRoomId; // Store before resetting
    const previousPlayerRole = playerRole;

    // Reset local state immediately for snappier UI
    setCurrentRoomId(null);
    setPlayerRole(null);
    setRoomData(null);
    resetLocalGameStates();
    setGamePhase('lobby');
    setRoomIdInput('');

    try {
      if (previousPlayerRole === 'player1') {
        const { error } = await supabase.from('rooms').delete().eq('id', previousRoomId);
        if (error) throw error;
        toast({ title: "Room Closed", description: "You have left and closed the room."});
      } else { // Player 2 leaves
        const { error } = await supabase
          .from('rooms')
          .update({
            player2_id: null,
            player2_move: null,
            status: 'waitingForOpponent',
            player2_online: false,
            last_activity: new Date().toISOString()
          })
          .eq('id', previousRoomId);
        if (error) throw error;
        toast({ title: "Left Room", description: "You have left the room."});
      }
    } catch (error: any) {
      toast({ title: "Error leaving room", description: error.message, variant: "destructive" });
      console.error("Leave room error:", error);
      // If error, try to re-establish state based on potential DB reality or force lobby
      // This part is complex; for now, rely on manual re-join or create
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayerSelectMove = async (move: Move) => {
    if (!currentRoomId || !playerRole || !roomData || roomData.status !== 'playing') return;
    
    const playerMoveField = playerRole === 'player1' ? 'player1_move' : 'player2_move';
    if (roomData[playerMoveField] !== null) {
      toast({title: "Move already made", description: "You've already selected your move for this round.", variant: "default"});
      return;
    }

    setIsLoading(true);
    try {
      const updatePayload: Partial<RoomData> = { last_activity: new Date().toISOString() };
      updatePayload[playerMoveField] = move;

      const { error } = await supabase
        .from('rooms')
        .update(updatePayload)
        .eq('id', currentRoomId);
      if (error) throw error;
      // UI will update via Supabase realtime subscription
    } catch (error: any) {
      toast({ title: "Failed to make move", description: error.message, variant: "destructive" });
      console.error("Select move error:", error);
    } finally {
      // setIsLoading(false); // isLoading reset by subscription usually
    }
  };

  // Effect to determine winner when both players have moved (P1 responsibility)
  useEffect(() => {
    if (!roomData || !currentRoomId || playerRole !== 'player1' || roomData.status !== 'playing') return;

    const { player1_move, player2_move, round } = roomData;

    if (player1_move && player2_move) {
      // Ensure this effect only runs once per move set for a round.
      // The status change to 'result' will prevent re-triggering.
      setIsLoading(true); // Indicate processing
      
      const resultP1 = determineWinner(player1_move, player2_move);
      let newP1Score = roomData.player1_score;
      let newP2Score = roomData.player2_score;

      if (resultP1 === 'Win') newP1Score++;
      else if (resultP1 === 'Lose') newP2Score++;
      
      const updatePayload: Partial<RoomData> = {
        player1_score: newP1Score,
        player2_score: newP2Score,
        status: 'result',
        last_activity: new Date().toISOString()
      };

      supabase
        .from('rooms')
        .update(updatePayload)
        .eq('id', currentRoomId)
        .eq('round', round) // Optimistic concurrency for round
        .then(({ error }) => {
          // setIsLoading(false); // Managed by subscription
          if (error) {
            toast({ title: "Error processing round", description: error.message, variant: "destructive" });
            console.error("Failed to update result:", error);
          }
          // Successful update will trigger the realtime listener
        });
    }
  }, [roomData, currentRoomId, playerRole, toast]);


  const handlePlayAgain = async () => {
    if (!currentRoomId || !roomData || playerRole !== 'player1') { 
        if(playerRole === 'player2'){
            toast({title: "Waiting for Host", description: "Player 1 (Host) can start the next round."});
        }
        return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          player1_move: null,
          player2_move: null,
          status: 'playing',
          round: roomData.round + 1,
          last_activity: new Date().toISOString()
        })
        .eq('id', currentRoomId);
      if (error) throw error;
      // UI updates via subscription
    } catch (error: any) {
      toast({ title: "Failed to start new round", description: error.message, variant: "destructive" });
      console.error("Play again error:", error);
    } finally {
      // setIsLoading(false); // Managed by subscription
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
  const yourMove = playerRole && roomData ? (playerRole === 'player1' ? roomData.player1_move : roomData.player2_move) : null;
  const opponentMove = playerRole && roomData ? (playerRole === 'player1' ? roomData.player2_move : roomData.player1_move) : null;
  
  const yourScore = playerRole && roomData ? (playerRole === 'player1' ? roomData.player1_score : roomData.player2_score) : 0;
  const opponentScore = playerRole && roomData ? (playerRole === 'player1' ? roomData.player2_score : roomData.player1_score) : 0;
  
  let displayResult: Result = null;
  if (roomData && roomData.player1_move && roomData.player2_move && roomData.status === 'result') {
    const p1Result = determineWinner(roomData.player1_move, roomData.player2_move);
    if (playerRole === 'player1') {
      displayResult = p1Result;
    } else if (playerRole === 'player2') {
      if (p1Result === 'Win') displayResult = 'Lose';
      else if (p1Result === 'Lose') displayResult = 'Win';
      else displayResult = 'Draw';
    }
  }
  
  const canMakeMove = playerRole && roomData && roomData.status === 'playing' && 
    (playerRole === 'player1' ? !roomData.player1_move : !roomData.player2_move);

  const selfPlayerName = playerRole === 'player1' ? "Player 1 (You)" : (playerRole === 'player2' ? "Player 2 (You)" : "You");
  const opponentPlayerName = playerRole === 'player1' ? (roomData?.player2_id ? "Player 2" : "Opponent") : "Player 1";

  if (isLoading && !roomData && gamePhase === 'lobby') { // Initial load check
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Connecting...</p>
      </div>
    );
  }

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
        <Button onClick={handleLeaveRoom} variant="outline" className="rounded-lg shadow-md" disabled={isLoading && gamePhase === 'waitingForOpponent'}>
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
         <Button onClick={handleLeaveRoom} variant="default" className="rounded-lg shadow-md mb-4">
          Leave Room & Return to Lobby
        </Button>
        {playerRole === 'player1' && (
            <Button 
                onClick={() => {
                    // Transition to waiting for a new opponent
                    if(currentRoomId) {
                        supabase.from('rooms').update({ 
                            player2_id: null, 
                            player2_move: null, 
                            status: 'waitingForOpponent', 
                            player2_online: false,
                            last_activity: new Date().toISOString()
                        }).eq('id', currentRoomId).then(() => {
                            setGamePhase('waitingForOpponent'); // Manually set to show UI update
                        });
                    }
                }} 
                variant="outline" 
                className="rounded-lg shadow-md"
            >
                Wait for New Opponent
            </Button>
        )}
      </div>
    );
  }

  if (!roomData && currentRoomId) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading room data for {currentRoomId}...</p>
      </div>
    );
  }
  if (!roomData && !currentRoomId && gamePhase !== 'lobby') { // Fallback if something went wrong
    setGamePhase('lobby'); // Force back to lobby
    return <p>Error: No room data and not in lobby. Resetting...</p>
  }
  if (!roomData) return null; // Should not happen if logic above is correct
  
  const showWaitingForOpponentMove = roomData.status === 'playing' && playerRole && 
    (playerRole === 'player1' ? roomData.player1_move && !roomData.player2_move : roomData.player2_move && !roomData.player1_move);

  const showWaitingForYourMove = roomData.status === 'playing' && playerRole &&
    (playerRole === 'player1' ? !roomData.player1_move : !roomData.player2_move);
  
  const showMoveButtons = roomData.status === 'playing' && canMakeMove;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 flex items-center space-x-2 md:space-x-4">
        <span className="text-xs md:text-sm font-medium text-muted-foreground">Room: <strong className="text-foreground">{currentRoomId}</strong></span>
        <Button onClick={copyRoomId} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
            <Copy className="h-4 w-4"/> <span className="sr-only">Copy Room ID</span>
        </Button>
        <Button onClick={handleLeaveRoom} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={isLoading && gamePhase !== 'lobby' && gamePhase !== 'waitingForOpponent'}>
          {(isLoading && gamePhase !== 'lobby' && gamePhase !== 'waitingForOpponent') ? <Loader2 className="animate-spin h-4 w-4" /> : <LogOut className="mr-1 h-4 w-4" />} Leave
        </Button>
      </div>
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-headline font-extrabold mb-6 md:mb-10 text-center tracking-tight"
          style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
        RPS Realtime Duel
      </h1>
      
      <ScoreBoard 
        player1Score={roomData.player1_score} 
        player2Score={roomData.player2_score}
        player1Name={playerRole === 'player1' ? "You (P1)" : "Player 1"}
        player2Name={playerRole === 'player2' ? "You (P2)" : (roomData.player2_id ? "Player 2" : "Waiting...")}
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
              <MoveButton move="Rock" onClick={() => handlePlayerSelectMove('Rock')} disabled={isLoading && roomData.status === 'playing'}/>
              <MoveButton move="Paper" onClick={() => handlePlayerSelectMove('Paper')} disabled={isLoading && roomData.status === 'playing'}/>
              <MoveButton move="Scissors" onClick={() => handlePlayerSelectMove('Scissors')} disabled={isLoading && roomData.status === 'playing'}/>
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
              disabled={(isLoading && roomData.status === 'result') || (playerRole === 'player2' && roomData.status === 'result')}
            >
              {(isLoading && roomData.status === 'result') ? <Loader2 className="mr-2 animate-spin" /> : (playerRole === 'player1' ? "Play Again" : "Waiting for Host...")}
            </Button>
          )}
        </div>

        <Card className="flex flex-col items-center p-4 md:p-6 shadow-xl rounded-xl">
          <h2 className="text-2xl md:text-3xl font-headline font-semibold mb-4">{opponentPlayerName}</h2>
          <MoveDisplay 
            move={opponentMove} 
            placeholderType={'ai'} 
            isLoading={gamePhase === 'playing' && ((playerRole === 'player1' && !roomData.player2_move) || (playerRole === 'player2' && !roomData.player1_move))}
            highlightColor={displayResult === 'Lose' ? 'hsl(var(--accent))' : (displayResult === 'Win' ? 'hsl(var(--destructive))' : undefined)}
            isPlayerSide={false}
          />
           {!roomData.player2_id && (roomData.status === 'waitingForOpponent' || (roomData.status === 'playing' && playerRole === 'player1' && !roomData.player2_id)) && 
             <p className="text-xs text-muted-foreground mt-2">Waiting for opponent to join...</p>}
        </Card>
      </div>
    </div>
  );
}

