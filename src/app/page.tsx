
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
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

type GamePhase = 'lobby' | 'waitingForOpponent' | 'playing' | 'reveal' | 'result' | 'opponentLeft' | 'gameOver';
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

const WIN_SCORE = 3;

const generateUserId = () => {
  // This function is intended to run client-side.
  // Its direct call in useState was moved to useEffect.
  let userId = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    userId = localStorage.getItem('rpsUserId');
    if (!userId) {
      userId = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('rpsUserId', userId);
    }
  }
  return userId;
};

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [roomIdInput, setRoomIdInput] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [playerRole, setPlayerRole] = useState<PlayerRole>(null);
  
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');
  const [supabaseChannel, setSupabaseChannel] = useState<RealtimeChannel | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const id = generateUserId();
    if (id) {
      setUserId(id);
    }
    setInitialLoading(false); 
  }, []);

  const resetLocalGameStates = useCallback(() => {
    setPlayerRole(null);
  }, []);

  useEffect(() => {
    if (!currentRoomId || !userId) { 
      if (supabaseChannel) {
        supabaseChannel.unsubscribe();
        setSupabaseChannel(null);
      }
      if (roomData) setRoomData(null); 
      return;
    }

    setIsLoading(true);
    const channel = supabase
      .channel(`room-${currentRoomId}`)
      .on<RoomData>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${currentRoomId}` },
        (payload) => {
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

            if (newRoomData.status !== 'lobby' && newRoomData.status !== 'waitingForOpponent' && newRoomData.status !== 'gameOver') {
              const currentRole = newRoomData.player1_id === userId ? 'player1' : (newRoomData.player2_id === userId ? 'player2' : null);
              if (currentRole === 'player1' && newRoomData.player2_id && !newRoomData.player2_online) {
                setGamePhase('opponentLeft');
              } else if (currentRole === 'player2' && newRoomData.player1_id && !newRoomData.player1_online) {
                 setGamePhase('opponentLeft');
              }
            }
          } else if (payload.eventType !== 'DELETE') { 
            console.warn("Received a non-DELETE Realtime event with no new data for room:", currentRoomId, payload);
          }
        }
      )
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          const { data, error } = await supabase.from('rooms').select('*').eq('id', currentRoomId).single();
          setIsLoading(false);
          if (error || !data) {
            console.error("Error fetching initial room data or room not found:", error);
            toast({ 
              title: "Room not found or Connection Issue", 
              description: "Could not load room. Check ID, RLS policies, or if Realtime is enabled for 'rooms' table on Supabase.", 
              variant: "destructive", 
              duration: 10000 
            });
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
        } else if (status === 'CHANNEL_ERROR') {
          setIsLoading(false);
          console.error("Supabase channel error: ", status, err);
          toast({ 
            title: "Realtime Connection Error", 
            description: "Could not connect. Ensure Realtime is enabled for 'rooms' table in Supabase DB Replication settings & RLS policies allow access.", 
            variant: "destructive",
            duration: 10000 
          });
        } else if (status === 'TIMED_OUT') {
          setIsLoading(false);
          console.error("Supabase channel subscription timed out: ", status);
          toast({ title: "Connection Timeout", description: "Real-time connection timed out. Please try again.", variant: "destructive" });
        }
      });

    setSupabaseChannel(channel);

    return () => {
      if (channel) {
        supabase.removeChannel(channel).then((status) => {
            // console.log('Unsubscribed from room channel:', currentRoomId, status);
        });
      }
      if (currentRoomId && playerRole && userId) {
        const updatePayload: Partial<RoomData> = {};
        if (playerRole === 'player1') updatePayload.player1_online = false;
        if (playerRole === 'player2') updatePayload.player2_online = false;
        
        if (Object.keys(updatePayload).length > 0) {
            supabase.from('rooms').update(updatePayload).eq('id', currentRoomId).then();
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId, userId, toast]); 


  useEffect(() => {
    if (!currentRoomId || !playerRole || !roomData || !userId) return; 
    
    const onlineUpdate: Partial<RoomData> = {};
    if (playerRole === 'player1' && roomData.player1_online !== true) onlineUpdate.player1_online = true;
    if (playerRole === 'player2' && roomData.player2_online !== true) onlineUpdate.player2_online = true;

    if (Object.keys(onlineUpdate).length > 0) {
      supabase.from('rooms').update({...onlineUpdate, last_activity: new Date().toISOString()}).eq('id', currentRoomId).then(({error}) => {
        if(error) console.error("Error updating online status:", error);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId, playerRole, roomData?.status, roomData?.player1_online, roomData?.player2_online, userId]);


  const handleCreateRoom = async () => {
    if (!userId) { 
      toast({ title: "User ID not available", description: "Please wait or refresh the page.", variant: "destructive" });
      return;
    }
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
    } catch (error: any) {
      toast({ title: "Failed to create room", description: error.message, variant: "destructive" });
      console.error("Create room error:", error);
    } finally {
      setIsLoading(false); 
    }
  };

  const handleJoinRoom = async () => {
    if (!userId) {
       toast({ title: "User ID not available", description: "Please wait or refresh the page.", variant: "destructive" });
      return;
    }
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
        toast({ title: "Room not found", description: `Room ${prospectiveRoomId} does not exist. Check ID or RLS policies.`, variant: "destructive" });
        return;
      }

      if (roomToJoin.player1_id === userId) { 
        setCurrentRoomId(prospectiveRoomId); 
        return;
      }

      if (roomToJoin.player2_id && roomToJoin.player2_id !== userId) {
        toast({ title: "Room is full", description: `Room ${prospectiveRoomId} is already full.`, variant: "destructive" });
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
        .is('player2_id', null); 

      if (updateError) {
        const { data: refetchedRoom } = await supabase.from('rooms').select('player2_id').eq('id', prospectiveRoomId).single();
        if (refetchedRoom && refetchedRoom.player2_id !== null && refetchedRoom.player2_id !== userId) {
             toast({ title: "Room is full", description: "Another player joined just before you.", variant: "destructive" });
        } else {
            throw updateError;
        }
        return;
      }
      setCurrentRoomId(prospectiveRoomId);
    } catch (error: any) {
      console.error("Join room failed:", error);
      toast({ title: "Failed to join room", description: error.message, variant: "destructive" });
    } finally {
        setIsLoading(false); 
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoomId || !playerRole || !userId) return; 
    setIsLoading(true);

    const previousRoomId = currentRoomId; 
    const previousPlayerRole = playerRole;
    
    if (supabaseChannel) {
      await supabase.removeChannel(supabaseChannel);
      setSupabaseChannel(null);
    }
    
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
      } else { 
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
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayerSelectMove = async (move: Move) => {
    if (!currentRoomId || !playerRole || !roomData || roomData.status !== 'playing' || !userId) return; 
    
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
      if (error) {
        toast({ title: "Failed to make move", description: error.message, variant: "destructive" });
        console.error("Select move error:", error);
      }
    } catch (error: any) { 
      toast({ title: "Error during move submission", description: error.message, variant: "destructive" });
      console.error("Select move submission error:", error);
    } finally {
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    if (!roomData || !currentRoomId || playerRole !== 'player1' || roomData.status !== 'playing' || !userId) return;

    const { player1_move, player2_move, round } = roomData;

    if (player1_move && player2_move) {
      const resultP1 = determineWinner(player1_move, player2_move);
      let newP1Score = roomData.player1_score;
      let newP2Score = roomData.player2_score;

      if (resultP1 === 'Win') newP1Score++;
      else if (resultP1 === 'Lose') newP2Score++;
      
      const updatePayload: Partial<RoomData> = {
        player1_score: newP1Score,
        player2_score: newP2Score,
        last_activity: new Date().toISOString()
      };

      if (newP1Score >= WIN_SCORE || newP2Score >= WIN_SCORE) {
        updatePayload.status = 'gameOver';
      } else {
        updatePayload.status = 'result';
      }

      supabase
        .from('rooms')
        .update(updatePayload)
        .eq('id', currentRoomId)
        .eq('round', round) 
        .then(({ error }) => {
          if (error) {
            toast({ title: "Error processing round", description: error.message, variant: "destructive" });
            console.error("Failed to update result/game over status:", error);
          }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomData, currentRoomId, playerRole, toast, userId]);


  const handlePlayAgain = async () => {
    if (!currentRoomId || !roomData || playerRole !== 'player1' || !userId) { 
        if(playerRole === 'player2'){
            toast({title: "Waiting for Host", description: "Host can start the next round/game."});
        }
        return;
    }
    setIsLoading(true);
    try {
      let updatePayload: Partial<RoomData>;
      if (roomData.status === 'gameOver') { 
        updatePayload = {
          player1_move: null,
          player2_move: null,
          player1_score: 0,
          player2_score: 0,
          status: 'playing', 
          round: 1,
          last_activity: new Date().toISOString()
        };
      } else { 
        updatePayload = {
          player1_move: null,
          player2_move: null,
          status: 'playing', 
          round: roomData.round + 1,
          last_activity: new Date().toISOString()
        };
      }

      const { error } = await supabase
        .from('rooms')
        .update(updatePayload)
        .eq('id', currentRoomId);

      if (error) {
        toast({ title: "Failed to start new round/game", description: error.message, variant: "destructive" });
        console.error("Play again/new game error:", error);
      }
    } catch (error: any) {
      toast({ title: "Error during play again/new game", description: error.message, variant: "destructive" });
      console.error("Play again/new game error:", error);
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

  const yourActualMove = playerRole && roomData ? (playerRole === 'player1' ? roomData.player1_move : roomData.player2_move) : null;
  const opponentActualMove = playerRole && roomData ? (playerRole === 'player1' ? roomData.player2_move : roomData.player1_move) : null;
  
  let displayedOpponentMove: Move | null = null;
  if (roomData && playerRole) {
    if (gamePhase === 'result' || gamePhase === 'gameOver') {
      displayedOpponentMove = opponentActualMove;
    } else if (gamePhase === 'playing') {
      displayedOpponentMove = null; 
    }
  }
  
  const yourScore = playerRole && roomData ? (playerRole === 'player1' ? roomData.player1_score : roomData.player2_score) : 0;
  const opponentScore = playerRole && roomData ? (playerRole === 'player1' ? roomData.player2_score : roomData.player1_score) : 0;
  
  let displayResult: Result = null;
  if (roomData && roomData.player1_move && roomData.player2_move && (roomData.status === 'result' || roomData.status === 'gameOver')) {
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

  const isLoadingButtonAction = isLoading && (gamePhase !== 'lobby' && gamePhase !== 'waitingForOpponent' && gamePhase !== 'opponentLeft');


  if (initialLoading || (isLoading && !currentRoomId && gamePhase === 'lobby')) {
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
            <div className="space-y-3">
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
         {userId && <p className="mt-4 text-xs text-center text-muted-foreground">Your User ID: {userId}</p>}
        </Card>
      </div>
    );
  }

  if (gamePhase === 'waitingForOpponent' && currentRoomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Card className="w-full max-w-md p-6 md:p-8 shadow-xl rounded-xl text-center">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-2xl md:text-3xl font-semibold">Room: {currentRoomId}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            <Button onClick={copyRoomId} variant="outline" className="w-full py-3 text-md">
              <Copy className="mr-2 h-4 w-4" /> Copy Room ID 
            </Button>
            <div className="flex items-center justify-center space-x-2 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xl text-muted-foreground">Waiting for Player 2 to join...</p>
            </div>
            <Button onClick={handleLeaveRoom} variant="destructive" className="w-full py-3 text-md" disabled={isLoadingButtonAction}>
              {isLoadingButtonAction ? <Loader2 className="mr-2 animate-spin" /> : <LogOut className="mr-2"/>} Close Room
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (gamePhase === 'opponentLeft') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Card className="w-full max-w-md p-6 md:p-8 shadow-xl rounded-xl text-center">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-2xl md:text-3xl font-semibold text-destructive">Opponent Left</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            <p className="text-lg text-muted-foreground">Your opponent has disconnected from the room.</p>
           <Button onClick={handleLeaveRoom} variant="outline" className="w-full py-3 text-md" disabled={isLoadingButtonAction}>
            {isLoadingButtonAction ? <Loader2 className="mr-2 animate-spin" /> : <LogOut className="mr-2"/>} Leave Room & Return to Lobby
           </Button>
            {playerRole === 'player1' && roomData && ( 
              <Button 
                onClick={() => { 
                  supabase.from('rooms').update({ status: 'waitingForOpponent', player2_id: null, player2_move: null, player2_online: false }).eq('id', currentRoomId).then(() => {
                    toast({ title: "Room Open Again", description: "Waiting for a new Player 2."});
                  });
                }} 
                variant="secondary" 
                className="w-full py-3 text-md" 
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 animate-spin" /> : "Re-open Room for New Player"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((isLoading && !roomData && currentRoomId) || (!roomData && currentRoomId && gamePhase !== 'lobby')) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
          <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
          <p className="text-xl text-muted-foreground">Loading room data for {currentRoomId}...</p>
      </div>
    );
  }

  if (!roomData && !currentRoomId && gamePhase !== 'lobby') { 
    console.warn("State inconsistency: No roomData or currentRoomId, but not in lobby. Resetting to lobby.");
    setGamePhase('lobby'); 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
          <Loader2 className="w-16 h-16 animate-spin text-primary mb-4" />
          <p className="text-xl text-muted-foreground">Resetting to lobby...</p>
      </div>
    );
  }
  if (!roomData || !userId) { 
    return null; 
  }
  
  const showWaitingForOpponentMove = roomData.status === 'playing' && playerRole && 
    (playerRole === 'player1' ? roomData.player1_move && !roomData.player2_move : roomData.player2_move && !roomData.player1_move);

  const showWaitingForYourMove = roomData.status === 'playing' && playerRole &&
    (playerRole === 'player1' ? !roomData.player1_move : !roomData.player2_move);
  
  const showMoveButtons = roomData.status === 'playing' && canMakeMove;

  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="w-full max-w-4xl mx-auto px-4">
        <header className="relative flex flex-col items-center py-4 mb-6 md:mb-8">
          <div className="absolute top-4 right-0 sm:right-4">
            <Button 
              onClick={handleLeaveRoom} 
              variant="destructive" 
              size="sm" 
              disabled={isLoadingButtonAction}
            >
              {isLoadingButtonAction ? 
                <Loader2 className="h-4 w-4 animate-spin" /> : 
                <LogOut className="h-4 w-4" />
              }
              <span className="hidden sm:inline ml-1">Leave</span>
            </Button>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-bold text-center tracking-tight w-full">
            RPS Realtime Duel
          </h1>

          <div className="mt-2 md:mt-3">
            <Button onClick={copyRoomId} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">Room: {currentRoomId}</span>
            </Button>
          </div>
        </header>
      </div>
      
      <ScoreBoard 
        player1Score={yourScore} 
        player2Score={opponentScore}
        player1Name={selfPlayerName}
        player2Name={opponentPlayerName}
      />

      <main className="flex flex-col md:flex-row items-center md:items-start justify-around w-full max-w-3xl space-y-8 md:space-y-0 md:space-x-12">
        {/* Your Side */}
        <div className="flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-semibold">{selfPlayerName}</h2>
          <MoveDisplay 
            move={yourActualMove} 
            isLoading={isLoading && !yourActualMove && gamePhase === 'playing'}
            isPlayerSide={true}
            highlightColor={yourActualMove && (gamePhase === 'result' || gamePhase === 'gameOver') ? (displayResult === 'Win' ? 'hsl(var(--accent))' : (displayResult === 'Lose' ? 'hsl(var(--destructive))' : undefined)) : undefined}
          />
           {showMoveButtons && (
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              {(['Rock', 'Paper', 'Scissors'] as Move[]).map((move) => (
                <MoveButton
                  key={move}
                  move={move}
                  onClick={handlePlayerSelectMove}
                  disabled={isLoading || !canMakeMove}
                />
              ))}
            </div>
          )}
          {gamePhase === 'playing' && !canMakeMove && yourActualMove && <p className="text-muted-foreground mt-2">Waiting for opponent...</p>}
           {showWaitingForYourMove && (
            <div className="text-center p-4 border-2 border-dashed border-primary rounded-lg mt-2">
                <p className="text-lg font-semibold text-primary animate-pulse"> Your turn to move...</p>
            </div>
          )}
        </div>

        {/* Result or Waiting Message Area */}
        <div className="flex flex-col items-center justify-center pt-0 md:pt-24 order-first md:order-none">
           {gamePhase === 'result' && displayResult && (
            <ResultDisplay result={displayResult} playerRole={playerRole} />
          )}

          {gamePhase === 'gameOver' && roomData && (
            <div className="text-center my-6">
              <h2 className="text-4xl md:text-5xl font-bold font-headline text-primary mb-2 animate-bounce">
                Game Over!
              </h2>
              <p className="text-2xl md:text-3xl font-semibold mb-4">
                {roomData.player1_score >= WIN_SCORE && playerRole === 'player1' && "You are the Champion!"}
                {roomData.player1_score >= WIN_SCORE && playerRole === 'player2' && `${opponentPlayerName} is the Champion!`}
                {roomData.player2_score >= WIN_SCORE && playerRole === 'player2' && "You are the Champion!"}
                {roomData.player2_score >= WIN_SCORE && playerRole === 'player1' && `${opponentPlayerName} is the Champion!`}
              </p>
              {displayResult && <p className="text-lg text-muted-foreground mb-4">(Last round: {displayResult})</p>}
              
              {playerRole === 'player1' && (
                <Button onClick={handlePlayAgain} className="mt-2 py-3 px-6 text-lg" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 animate-spin" /> : "Start New Game"}
                </Button>
              )}
              {playerRole === 'player2' && (
                <p className="mt-2 text-muted-foreground">Waiting for Host to start a new game...</p>
              )}
            </div>
          )}

          {showWaitingForOpponentMove && gamePhase !== 'gameOver' && (
            <div className="text-center p-4 bg-card rounded-lg shadow-md mt-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary mb-2 mx-auto" />
              <p className="text-md font-semibold text-muted-foreground">Waiting for {opponentPlayerName}'s move...</p>
            </div>
          )}

          {gamePhase === 'result' && roomData && playerRole === 'player1' && (
            <Button onClick={handlePlayAgain} className="mt-4 py-3 px-6 text-lg" disabled={isLoading}>
              {(isLoading && roomData.status === 'result') ? <Loader2 className="mr-2 animate-spin" /> : "Play Next Round"}
            </Button>
          )}
           {gamePhase === 'result' && roomData && playerRole === 'player2' && (
             <p className="mt-4 text-muted-foreground">Waiting for Host to start next round...</p>
           )}
        </div>

        {/* Opponent's Side */}
        <div className="flex flex-col items-center space-y-4">
          <h2 className="text-2xl font-semibold">{opponentPlayerName}</h2>
          <MoveDisplay 
            move={displayedOpponentMove} 
            isLoading={gamePhase === 'playing' && roomData && (playerRole === 'player1' ? !roomData.player2_move : !roomData.player1_move) && !!(playerRole === 'player1' ? roomData.player2_id : roomData.player1_id)}
            isPlayerSide={false}
            highlightColor={displayedOpponentMove && (gamePhase === 'result' || gamePhase === 'gameOver') ? (displayResult === 'Lose' ? 'hsl(var(--accent))' : (displayResult === 'Win' ? 'hsl(var(--destructive))' : undefined)) : undefined}
          />
           {!roomData.player2_id && (roomData.status === 'waitingForOpponent' || (roomData.status === 'playing' && playerRole === 'player1' && !roomData.player2_id)) && 
              <p className="text-muted-foreground mt-2">Waiting for opponent to join...</p>}
        </div>
      </main>
    </div>
  );
}


    