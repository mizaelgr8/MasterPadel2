

"use client";

import type { Player } from "@/types";
import { Crown, Shield, Swords } from "lucide-react";

interface PodiumProps {
  topPlayers: Player[];
}

const Podium = ({ topPlayers }: PodiumProps) => {
  const getPodiumStep = (player: Player, rank: number) => {
    const rankStyles = {
      1: {
        height: "h-48",
        color: "gold",
        textColor: "gold-text",
        icon: <Crown className="w-12 h-12 text-yellow-400" />,
        shadow: "shadow-[0_0_30px_5px_rgba(255,215,0,0.5)]",
      },
      2: {
        height: "h-40",
        color: "silver",
        textColor: "silver-text",
        icon: <Shield className="w-10 h-10 text-gray-300" />,
        shadow: "shadow-[0_0_20px_5px_rgba(192,192,192,0.4)]",
      },
      3: {
        height: "h-32",
        color: "bronze",
        textColor: "bronze-text",
        icon: <Swords className="w-10 h-10 text-orange-400" />,
        shadow: "shadow-[0_0_20px_5px_rgba(205,127,50,0.4)]",
      },
    };

    const style = rankStyles[rank as keyof typeof rankStyles];
    const orderClass = rank === 1 ? 'order-2' : (rank === 2 ? 'order-1' : 'order-3');

    return (
      <div className={`w-1/3 flex flex-col items-center justify-end ${orderClass}`}>
        <div className="text-center mb-2">
            <div className="flex justify-center items-center" style={{ filter: `drop-shadow(0 0 10px ${style.color})` }}>
              {style.icon}
            </div>
            <p className={`font-bold text-lg md:text-xl truncate`}>{player?.name || 'N/A'}</p>
             <div className="text-xs text-muted-foreground flex flex-col">
                <div>
                    {(player.achievements?.king || 0) > 0 && <span className="gold-text">👑 {player.achievements.king}</span>}
                    {(player.achievements?.shield || 0) > 0 && <span className="silver-text mx-1">🛡️ {player.achievements.shield}</span>}
                    {(player.achievements?.sword || 0) > 0 && <span className="bronze-text">⚔️ {player.achievements.sword}</span>}
                </div>
                <div>
                    {(player.medals?.gold || 0) > 0 && <span className="gold-text">🥇 {player.medals.gold}</span>}
                    {(player.medals?.silver || 0) > 0 && <span className="silver-text mx-1">🥈 {player.medals.silver}</span>}
                    {(player.medals?.bronze || 0) > 0 && <span className="bronze-text">🥉 {player.medals.bronze}</span>}
                </div>
            </div>
        </div>
        <div 
            className={`w-full ${style.height} rounded-t-lg flex items-center justify-center text-5xl font-extrabold transition-all duration-300 ${style.shadow} ${style.textColor}`}
            style={{
                background: `linear-gradient(to top, rgba(0,0,0,0.1), transparent), radial-gradient(ellipse at top, ${style.color} -50%, transparent 60%)`,
                borderTop: `2px solid ${style.color}`,
                transform: 'perspective(1000px) rotateX(5deg)',
            }}
            >
          {rank}
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-end justify-center space-x-1 md:space-x-2 my-8 w-full max-w-2xl mx-auto">
      {topPlayers[1] ? getPodiumStep(topPlayers[1], 2) : <div className="w-1/3 order-1 h-40"></div>}
      {topPlayers[0] ? getPodiumStep(topPlayers[0], 1) : <div className="w-1/3 order-2 h-48"></div>}
      {topPlayers[2] ? getPodiumStep(topPlayers[2], 3) : <div className="w-1/3 order-3 h-32"></div>}
    </div>
  );
};

export default Podium;
