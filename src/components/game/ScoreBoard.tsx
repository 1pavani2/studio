
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ScoreBoardProps {
  player1Score: number;
  player2Score: number;
  player1Name?: string;
  player2Name?: string;
}

export function ScoreBoard({ 
  player1Score, 
  player2Score, 
  player1Name = "Player 1", 
  player2Name = "Player 2" 
}: ScoreBoardProps) {
  return (
    <div className="flex space-x-4 md:space-x-8 mb-8">
      <Card className="w-40 md:w-48 text-center shadow-lg">
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-xl md:text-2xl font-headline">{player1Name}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <p className="text-4xl md:text-5xl font-bold text-primary">{player1Score}</p>
        </CardContent>
      </Card>
      <Card className="w-40 md:w-48 text-center shadow-lg">
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-xl md:text-2xl font-headline">{player2Name}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <p className="text-4xl md:text-5xl font-bold text-primary">{player2Score}</p>
        </CardContent>
      </Card>
    </div>
  );
}
