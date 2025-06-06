"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ScoreBoardProps {
  userScore: number;
  aiScore: number;
}

export function ScoreBoard({ userScore, aiScore }: ScoreBoardProps) {
  return (
    <div className="flex space-x-4 md:space-x-8 mb-8">
      <Card className="w-40 md:w-48 text-center shadow-lg">
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-xl md:text-2xl font-headline">Your Score</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <p className="text-4xl md:text-5xl font-bold text-primary">{userScore}</p>
        </CardContent>
      </Card>
      <Card className="w-40 md:w-48 text-center shadow-lg">
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-xl md:text-2xl font-headline">AI Score</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <p className="text-4xl md:text-5xl font-bold text-primary">{aiScore}</p>
        </CardContent>
      </Card>
    </div>
  );
}
