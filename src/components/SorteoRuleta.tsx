

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Player, Category } from '@/types';
import { useCategory } from '@/context/CategoryContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import { Dices, RotateCcw, PartyPopper, UserX } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from './ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useFirebase } from '@/context/FirebaseContext';


type RouletteMode = 'single' | 'elimination';

const SorteoRuleta = () => {
    const { db } = useFirebase();
    const { category } = useCategory();
    const { toast } = useToast();
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [initialSelection, setInitialSelection] = useState<Player[]>([]);
    const [remainingPlayers, setRemainingPlayers] = useState<Player[]>([]);
    const [eliminatedPlayers, setEliminatedPlayers] = useState<Player[]>([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState<Player | null>(null);
    const [lastEliminated, setLastEliminated] = useState<Player | null>(null);
    const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false);
    const [isEliminationDialogOpen, setIsEliminationDialogOpen] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [rouletteMode, setRouletteMode] = useState<RouletteMode>('single');

    // Roulette animation state using refs to prevent re-renders
    const startAngleRef = useRef(0);
    const spinAngleStartRef = useRef(0);
    const spinTimeRef = useRef(0);
    const spinTimeTotalRef = useRef(0);
    const frameIdRef = useRef<number | null>(null);

    const colors = ["#1A2942", "#2E4A6E", "#157A8A", "#0E5C6B", "#FFC700", "#E6B300"];
    
    const drawRouletteWheel = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
    
        const outsideRadius = 200;
        const textRadius = 160;
        const insideRadius = 50;
        const currentArc = remainingPlayers.length > 0 ? (2 * Math.PI) / remainingPlayers.length : 0;
        const centerX = 250;
        const centerY = 250;

        ctx.clearRect(0, 0, 500, 500);

        if (remainingPlayers.length === 0) {
            ctx.fillStyle = "#1e293b";
            ctx.beginPath();
            ctx.arc(centerX, centerY, outsideRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.font = '20px "PT Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Selecciona jugadores', centerX, centerY);
            return;
        }

        ctx.font = 'bold 14px "PT Sans", sans-serif';

        for (let i = 0; i < remainingPlayers.length; i++) {
            const angle = startAngleRef.current + i * currentArc;
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath();
            ctx.arc(centerX, centerY, outsideRadius, angle, angle + currentArc, false);
            ctx.arc(centerX, centerY, insideRadius, angle + currentArc, angle, true);
            ctx.fill();
        }

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, outsideRadius + 2.5, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < remainingPlayers.length; i++) {
            const angle = startAngleRef.current + i * currentArc;
            
            ctx.strokeStyle = "rgba(255,255,255,0.1)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX + insideRadius * Math.cos(angle), centerY + insideRadius * Math.sin(angle));
            ctx.lineTo(centerX + outsideRadius * Math.cos(angle), centerY + outsideRadius * Math.sin(angle));
            ctx.stroke();

            ctx.save();
            ctx.fillStyle = "white";
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = 4;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const textAngle = angle + currentArc / 2;
            ctx.translate(centerX + Math.cos(textAngle) * textRadius,
                          centerY + Math.sin(textAngle) * textRadius);
            ctx.rotate(textAngle + Math.PI / 2);
            const text = remainingPlayers[i].name;
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }

        ctx.fillStyle = '#020817';
        ctx.beginPath();
        ctx.arc(centerX, centerY, insideRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, insideRadius - 5, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 30px "PT Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Mz', centerX, centerY);

        ctx.save();
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(centerX - 12, centerY - outsideRadius - 15);
        ctx.lineTo(centerX + 12, centerY - outsideRadius - 15);
        ctx.lineTo(centerX, centerY - outsideRadius + 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

    }, [remainingPlayers, colors]);


    useEffect(() => {
        if (!db) return;
        const playersCollection = collection(db, "players");
        const unsubscribe = onSnapshot(playersCollection, (snapshot) => {
            const allPlayersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            let categoryPlayers: Player[] = [];
    
            if (category === '4ta') {
                const modernPlayers = allPlayersList.filter(p => p.category === '4ta');
                const legacyPlayers = allPlayersList.filter(p => !p.category);
                const combined = new Map<string, Player>();
                [...legacyPlayers, ...modernPlayers].forEach(p => combined.set(p.id, p));
                categoryPlayers = Array.from(combined.values());
            } else {
                categoryPlayers = allPlayersList.filter(p => p.category === category);
            }
            
            setAllPlayers(categoryPlayers.sort((a, b) => a.name.localeCompare(b.name)));
        });
        return () => unsubscribe();
    }, [db, category]);
    
     useEffect(() => {
        drawRouletteWheel();
    }, [remainingPlayers, drawRouletteWheel]);
    
    const handlePlayerToggle = (player: Player) => {
        setInitialSelection(prev => {
            const isSelected = prev.some(p => p.id === player.id);
            const newSelection = isSelected 
                ? prev.filter(p => p.id !== player.id)
                : [...prev, player];
            setRemainingPlayers(newSelection);
            return newSelection;
        });
    };

    const easeOut = (t: number, b: number, c: number, d: number) => {
        const ts = (t /= d) * t;
        const tc = ts * t;
        return b + c * (tc + -3 * ts + 3 * t);
    };

    const stopRotateWheel = useCallback(() => {
        if (frameIdRef.current) {
            cancelAnimationFrame(frameIdRef.current);
            frameIdRef.current = null;
        }
        setIsSpinning(false);
        const arc = remainingPlayers.length > 0 ? (2 * Math.PI) / remainingPlayers.length : 0;
        const degrees = startAngleRef.current * 180 / Math.PI + 90;
        const arcd = arc * 180 / Math.PI;
        const index = Math.floor((360 - degrees % 360) / arcd);
        
        if (remainingPlayers[index]) {
            const resultPlayer = remainingPlayers[index];
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });

            if (rouletteMode === 'single') {
                setWinner(resultPlayer);
                setIsWinnerDialogOpen(true);
            } else { // Elimination mode
                if (remainingPlayers.length > 2) {
                    setLastEliminated(resultPlayer);
                    setEliminatedPlayers(prev => [...prev, resultPlayer]);
                    setRemainingPlayers(prev => prev.filter(p => p.id !== resultPlayer.id));
                    setIsEliminationDialogOpen(true);
                } else {
                    const winnerPlayer = remainingPlayers.find(p => p.id !== resultPlayer.id);
                    setWinner(winnerPlayer!);
                    setIsWinnerDialogOpen(true);
                }
            }
        }
    }, [remainingPlayers, rouletteMode]);
    
    const rotateWheel = useCallback(() => {
        spinTimeRef.current += 30; // Use a fixed time step for smoother animation
        if (spinTimeRef.current >= spinTimeTotalRef.current) {
            stopRotateWheel();
            return;
        }
        
        const spinAngle = spinAngleStartRef.current - easeOut(spinTimeRef.current, 0, spinAngleStartRef.current, spinTimeTotalRef.current);
        startAngleRef.current += (spinAngle * Math.PI / 180);
        drawRouletteWheel();
        frameIdRef.current = requestAnimationFrame(rotateWheel);
    }, [drawRouletteWheel, stopRotateWheel]);


    const handleSpin = () => {
        if (isSpinning) return;
        if (remainingPlayers.length < 2) {
            toast({ title: "Jugadores insuficientes", description: "Selecciona al menos 2 jugadores para el sorteo.", variant: "destructive" });
            return;
        }

        spinAngleStartRef.current = Math.random() * 30 + 20;
        spinTimeRef.current = 0;
        spinTimeTotalRef.current = Math.random() * 4000 + 8000;
        
        setIsSpinning(true);
        rotateWheel();
    };
    
    const resetSorteo = () => {
        setIsWinnerDialogOpen(false);
        setWinner(null);
        setInitialSelection([]);
        setRemainingPlayers([]);
        setEliminatedPlayers([]);
        setLastEliminated(null);
    }
    
    const resetElimination = () => {
        setRemainingPlayers(initialSelection);
        setEliminatedPlayers([]);
        setLastEliminated(null);
    }
    
    const handleModeChange = (mode: RouletteMode) => {
        setRouletteMode(mode);
        resetSorteo();
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-1 space-y-6">
                <div>
                    <h3 className="font-semibold text-lg mb-2">Modalidad de Sorteo</h3>
                    <RadioGroup defaultValue="single" onValueChange={(value) => handleModeChange(value as RouletteMode)} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="single" id="r1" />
                            <Label htmlFor="r1">Sorteo Único</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="elimination" id="r2" />
                            <Label htmlFor="r2">Eliminación</Label>
                        </div>
                    </RadioGroup>
                </div>
                <div>
                    <h3 className="font-semibold text-lg mb-2">Participantes</h3>
                    <p className="text-sm text-muted-foreground mb-4">Selecciona los jugadores para incluir en el sorteo.</p>
                    <div className="space-y-2 mb-4">
                        <Button onClick={() => { setInitialSelection(allPlayers); setRemainingPlayers(allPlayers); }} size="sm" variant="secondary">Seleccionar Todos</Button>
                        <Button onClick={() => { setInitialSelection([]); setRemainingPlayers([]); }} size="sm" variant="secondary">Deseleccionar Todos</Button>
                    </div>
                    <ScrollArea className="h-72 rounded-md border p-4">
                        <div className="space-y-3">
                            {allPlayers.map(player => (
                                <div key={player.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`player-${player.id}`}
                                        checked={initialSelection.some(p => p.id === player.id)}
                                        onCheckedChange={() => handlePlayerToggle(player)}
                                        disabled={isSpinning}
                                    />
                                    <Label htmlFor={`player-${player.id}`}>{player.name}</Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                {rouletteMode === 'elimination' && eliminatedPlayers.length > 0 && (
                     <div>
                        <h3 className="font-semibold text-lg mb-2">Jugadores Eliminados</h3>
                        <ScrollArea className="h-32 rounded-md border p-4">
                            <ul className="space-y-2">
                                {eliminatedPlayers.map((player, index) => (
                                    <li key={player.id} className="text-sm text-muted-foreground line-through">
                                        {index + 1}. {player.name}
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    </div>
                )}
            </div>
            <div className="md:col-span-2 flex flex-col items-center justify-center">
                <canvas ref={canvasRef} width="500" height="500" className="max-w-full h-auto"></canvas>
                <div className="flex gap-4 mt-4">
                    <Button onClick={handleSpin} disabled={isSpinning || remainingPlayers.length < 2} size="lg">
                        <Dices className="mr-2" />
                        {isSpinning ? 'Girando...' : rouletteMode === 'elimination' && remainingPlayers.length !== initialSelection.length ? 'Siguiente Ronda' : '¡Girar la Ruleta!'}
                    </Button>
                    {rouletteMode === 'elimination' && (
                        <Button onClick={resetElimination} variant="outline" size="lg">
                            <RotateCcw className="mr-2"/> Reiniciar
                        </Button>
                    )}
                </div>
            </div>

            <AlertDialog open={isWinnerDialogOpen} onOpenChange={setIsWinnerDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader className="items-center">
                         <PartyPopper className="h-16 w-16 text-yellow-400" />
                        <AlertDialogTitle className="text-2xl text-center">
                            {rouletteMode === 'elimination' ? '¡El Ganador Final es!' : '¡Tenemos un ganador!'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-4xl font-bold text-center py-4 text-primary">
                            {winner?.name}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-center">
                        <Button variant="outline" onClick={() => setIsWinnerDialogOpen(false)}>Cerrar</Button>
                        <Button onClick={resetSorteo}><RotateCcw className="mr-2"/> Nuevo Sorteo</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={isEliminationDialogOpen} onOpenChange={setIsEliminationDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader className="items-center">
                         <UserX className="h-16 w-16 text-destructive" />
                        <AlertDialogTitle className="text-2xl text-center">Jugador Eliminado</AlertDialogTitle>
                        <AlertDialogDescription className="text-4xl font-bold text-destructive text-center py-4">
                            {lastEliminated?.name}
                        </AlertDialogDescription>
                         <p className="text-sm text-muted-foreground pt-4">{remainingPlayers.length} jugadores restantes.</p>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-center">
                        <AlertDialogAction onClick={() => setIsEliminationDialogOpen(false)}>Continuar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default SorteoRuleta;
