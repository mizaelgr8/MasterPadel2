"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import type { Player, Category, OngoingMatch, Round, AmericanoRound, AmericanoMatch, DailyEvent, DailyElevadorEvent, MonthlyRanking, OngoingElevador } from '@/types';
import { useFirebase } from '@/context/FirebaseContext';
import { useCategory } from '@/context/CategoryContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Sword, Trophy, Star, Crown, Shield, Swords, Medal } from 'lucide-react';
import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ProyectorGeneralRankingColumn = ({ category, players }: { category: string, players: any[] }) => {
    return (
        <Card className="h-full bg-slate-900/50 border-slate-700 overflow-hidden flex flex-col shadow-2xl">
            <CardHeader className="bg-slate-800/50 pb-3 shrink-0 border-b border-slate-700">
                <CardTitle className="text-3xl text-yellow-400 flex items-center justify-between font-headline">
                    <span>{category} CAT.</span>
                    <Trophy className="h-8 w-8 text-yellow-500" />
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-grow overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-900/80 sticky top-0 z-10">
                        <TableRow className="border-slate-700 h-12">
                            <TableHead className="w-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">#</TableHead>
                            <TableHead className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jugador</TableHead>
                            <TableHead className="w-16 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Prom</TableHead>
                            <TableHead className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Logros</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {players.slice(0, 15).map((player, index) => {
                            const ach = player.achievements || { king: 0, shield: 0, sword: 0 };
                            const med = player.medals || { gold: 0, silver: 0, bronze: 0 };
                            
                            return (
                                <TableRow key={player.id} className={cn(
                                    "border-slate-800/50 h-20 hover:bg-slate-800/30 transition-colors",
                                    index < 3 && "bg-yellow-500/5"
                                )}>
                                    <TableCell className="text-center font-black text-xl">
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                                    </TableCell>
                                    <TableCell className="font-bold text-base text-white truncate max-w-[140px]">
                                        {player.name.toUpperCase()}
                                    </TableCell>
                                    <TableCell className="text-center font-black text-primary text-xl">
                                        {player.totalGames > 0 ? (player.totalPoints / player.totalGames).toFixed(1) : '0.0'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col gap-1 items-center justify-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {ach.king > 0 && <span className="gold-text flex items-center text-lg font-black"><Crown className="h-6 w-6 mr-1"/>{ach.king}</span>}
                                                {ach.shield > 0 && <span className="silver-text flex items-center text-lg font-black"><Shield className="h-6 w-6 mr-1"/>{ach.shield}</span>}
                                                {ach.sword > 0 && <span className="bronze-text flex items-center text-lg font-black"><Swords className="h-6 w-6 mr-1"/>{ach.sword}</span>}
                                            </div>
                                            <div className="flex items-center justify-center gap-2">
                                                {med.gold > 0 && <span className="gold-text text-sm font-bold opacity-90">🥇{med.gold}</span>}
                                                {med.silver > 0 && <span className="silver-text text-sm font-bold opacity-90">🥈{med.silver}</span>}
                                                {med.bronze > 0 && <span className="bronze-text text-sm font-bold opacity-90">🥉{med.bronze}</span>}
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const ProyectorLiveStandings = () => {
    const { db } = useFirebase();
    const { category } = useCategory();
    const [ongoingMatch, setOngoingMatch] = useState<OngoingMatch | null>(null);
    const [ongoingElevador, setOngoingElevador] = useState<OngoingElevador | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) return;
        setLoading(true);
        const qMatch = query(collection(db, "ongoingMatches"), where("category", "==", category));
        const qElevador = query(collection(db, "ongoingElevador"), where("category", "==", category));

        const unsubMatch = onSnapshot(qMatch, (snapshot) => {
            if (!snapshot.empty) {
                const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OngoingMatch));
                setOngoingMatch(matches[0]);
            } else setOngoingMatch(null);
        });

        const unsubElevador = onSnapshot(qElevador, (snapshot) => {
            if (!snapshot.empty) {
                const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OngoingElevador));
                setOngoingElevador(matches[0]);
            } else setOngoingElevador(null);
            setLoading(false);
        });

        return () => { unsubMatch(); unsubElevador(); };
    }, [db, category]);

    const results = useMemo(() => {
        if (ongoingMatch) {
            if (ongoingMatch.modality === '6loco' || ongoingMatch.modality === '6locoParejas') {
                const isIndividual = ongoingMatch.modality === '6loco';
                const competitionRounds = ongoingMatch.rounds.filter(r => !r.isBonus);
                const stats: Record<string, any> = {};

                if (isIndividual) {
                    ongoingMatch.selectedPlayers.forEach(p => {
                        stats[p.id] = { id: p.id, name: p.name, points: 0, g: 0, e: 0, p: 0 };
                    });
                } else {
                    ongoingMatch.fixedPairs.forEach(pair => {
                        stats[pair.id] = { id: pair.id, name: pair.player1.name + ' & ' + pair.player2.name, points: 0, g: 0, e: 0, p: 0 };
                    });
                }

                competitionRounds.forEach(round => {
                    round.matches.forEach(match => {
                        const { team1, team2, score1, score2 } = match;
                        if (score1 === null || score2 === null) return;
                        
                        if (isIndividual) {
                            [team1.player1.id, team1.player2.id].forEach(id => {
                                if (stats[id]) {
                                    stats[id].points += score1;
                                    if (score1 > score2) stats[id].g++; else if (score1 < score2) stats[id].p++; else stats[id].e++;
                                }
                            });
                            [team2.player1.id, team2.player2.id].forEach(id => {
                                if (stats[id]) {
                                    stats[id].points += score2;
                                    if (score2 > score1) stats[id].g++; else if (score2 < score1) stats[id].p++; else stats[id].e++;
                                }
                            });
                        } else {
                            if (stats[team1.id]) {
                                stats[team1.id].points += score1;
                                if (score1 > score2) stats[team1.id].g++; else if (score1 < score2) stats[team1.id].p++; else stats[team1.id].e++;
                            }
                            if (stats[team2.id]) {
                                stats[team2.id].points += score2;
                                if (score2 > score1) stats[team2.id].g++; else if (score2 < score1) stats[team2.id].p++; else stats[team2.id].e++;
                            }
                        }
                    });
                });

                return Object.values(stats).sort((a, b) => b.points - a.points || b.g - a.g);
            } else if (ongoingMatch.modality === 'parejaFija') {
                const stats: Record<string, any> = {};
                ongoingMatch.fixedPairs.forEach(pair => {
                    stats[pair.id] = { id: pair.id, name: pair.player1.name + ' & ' + pair.player2.name, points: 0, g: 0, e: 0, p: 0 };
                });

                ongoingMatch.americanoRounds.forEach(round => {
                    round.matches.forEach(match => {
                        const { team1, team2, set1_t1, set1_t2, set2_t1, set2_t2, set3_t1, set3_t2 } = match;
                        if (set1_t1 === null || set1_t2 === null || set2_t1 === null || set2_t2 === null) return;
                        const t1 = stats[team1.id]; const t2 = stats[team2.id];
                        if (!t1 || !t2) return;
                        
                        let s1 = 0; let s2 = 0;
                        if (set1_t1 > set1_t2) s1++; else s2++;
                        if (set2_t1 > set2_t2) s1++; else s2++;
                        if (s1 !== 2 && s2 !== 2 && set3_t1 !== null) { if (set3_t1 > set3_t2!) s1++; else s2++; }
                        
                        if (s1 > s2) { 
                            t1.g++; t2.p++; 
                            t1.points += (s1 === 2 && s2 === 0) ? 3 : 2; 
                            t2.points += (s1 === 2 && s2 === 1) ? 1 : 0; 
                        } else { 
                            t2.g++; t1.p++; 
                            t2.points += (s2 === 2 && s1 === 0) ? 3 : 2; 
                            t1.points += (s2 === 2 && s1 === 1) ? 1 : 0; 
                        }
                    });
                });
                return Object.values(stats).sort((a, b) => b.points - a.points || b.g - a.g);
            }
        } else if (ongoingElevador) {
            const isIndividual = ongoingElevador.modality === 'elevador';
            const competitionRounds = ongoingElevador.rounds.filter(r => !r.isBonus);
            const stats: Record<string, any> = {};

            if (isIndividual) {
                ongoingElevador.selectedPlayers.forEach(p => {
                    stats[p.id] = { id: p.id, name: p.name, points: 0, g: 0, e: 0, p: 0, finalCourt: ongoingElevador.playerStats[p.id]?.finalCourt || 0 };
                });
            } else {
                ongoingElevador.fixedPairs.forEach(pair => {
                    const ps = ongoingElevador.playerStats[pair.player1.id];
                    stats[pair.id] = { id: pair.id, name: pair.player1.name + ' & ' + pair.player2.name, points: 0, g: 0, e: 0, p: 0, finalCourt: ps?.finalCourt || 0 };
                });
            }

            competitionRounds.forEach(round => {
                round.courts.forEach(court => {
                    const { match } = court;
                    if (!match || match.score1 === null || match.score2 === null) return;
                    const t1Won = match.score1 > match.score2;

                    if (isIndividual) {
                        [match.team1.player1.id, match.team1.player2.id].forEach(id => {
                            if (stats[id]) { stats[id].points += match.score1!; if (t1Won) stats[id].g++; else stats[id].p++; }
                        });
                        [match.team2.player1.id, match.team2.player2.id].forEach(id => {
                            if (stats[id]) { stats[id].points += match.score2!; if (!t1Won) stats[id].g++; else stats[id].p++; }
                        });
                    } else {
                        const pair1Id = [match.team1.player1.id, match.team1.player2.id].sort().join('-');
                        const pair2Id = [match.team2.player1.id, match.team2.player2.id].sort().join('-');
                        if (stats[pair1Id]) { stats[pair1Id].points += match.score1!; if (t1Won) stats[pair1Id].g++; else stats[pair1Id].p++; }
                        if (stats[pair2Id]) { stats[pair2Id].points += match.score2!; if (!t1Won) stats[pair2Id].g++; else stats[pair2Id].p++; }
                    }
                });
            });

            return Object.values(stats).sort((a, b) => b.g - a.g || b.points - a.points || a.finalCourt - b.finalCourt);
        }
        return [];
    }, [ongoingMatch, ongoingElevador]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;
    
    if (!ongoingMatch && !ongoingElevador) return (
        <Card className="h-full bg-slate-900/50 border-slate-700 flex flex-col items-center justify-center p-8 text-center shadow-xl">
            <Star className="h-20 w-20 text-slate-700 mb-4 animate-pulse" />
            <CardTitle className="text-2xl text-white">Sin Partida Activa</CardTitle>
            <CardDescription className="text-lg">Inicia un evento para ver los resultados aquí.</CardDescription>
        </Card>
    );

    const title = ongoingMatch ? (ongoingMatch.eventName) : (ongoingElevador?.eventName || 'Elevador');

    return (
        <Card className="h-full bg-slate-900/50 border-slate-700 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-3xl text-white flex items-center gap-3 font-headline">
                    <Trophy className="text-yellow-400 h-8 w-8"/> Clasificación en Vivo
                </CardTitle>
                <CardDescription className="text-slate-300 text-lg">
                    {title}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-900/80">
                        <TableRow className="border-slate-700 h-14">
                            <TableHead className="w-16 text-xl text-slate-400 text-center">#</TableHead>
                            <TableHead className="text-xl text-slate-400">Nombre</TableHead>
                            <TableHead className="text-center text-xl text-slate-400">Pts</TableHead>
                            <TableHead className="text-center text-xl text-slate-400">G</TableHead>
                            <TableHead className="text-center text-xl text-slate-400">P</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {results.map((row, index) => (
                            <TableRow key={index} className="border-slate-800 h-16 text-white hover:bg-slate-800/50 transition-colors">
                                <TableCell className="font-bold text-2xl text-center">{index + 1}</TableCell>
                                <TableCell className="font-bold text-xl truncate max-w-[200px]">{row.name.toUpperCase()}</TableCell>
                                <TableCell className="text-center font-black text-primary text-3xl">{row.points}</TableCell>
                                <TableCell className="text-center text-xl font-semibold">{row.g}</TableCell>
                                <TableCell className="text-center text-xl opacity-70">{row.p || 0}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const ProyectorOngoingMatch = () => {
    const { db } = useFirebase();
    const { category } = useCategory();
    const [ongoingMatch, setOngoingMatch] = useState<OngoingMatch | null>(null);
    const [ongoingElevador, setOngoingElevador] = useState<OngoingElevador | null>(null);
    const [loading, setLoading] = useState(true);
    const [openAccordionItem, setOpenAccordionItem] = useState<string>('item-0');

    useEffect(() => {
        if (!db) return;
        setLoading(true);
        const qMatch = query(collection(db, "ongoingMatches"), where("category", "==", category));
        const qElevador = query(collection(db, "ongoingElevador"), where("category", "==", category));

        const unsubMatch = onSnapshot(qMatch, (snapshot) => {
            if (!snapshot.empty) {
                const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OngoingMatch));
                setOngoingMatch(matches[0]);
            } else setOngoingMatch(null);
        });

        const unsubElevador = onSnapshot(qElevador, (snapshot) => {
            if (!snapshot.empty) {
                const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OngoingElevador));
                setOngoingElevador(matches[0]);
            } else setOngoingElevador(null);
            setLoading(false);
        });

        return () => { unsubMatch(); unsubElevador(); };
    }, [db, category]);

    const activeGame = ongoingMatch || ongoingElevador;

    useEffect(() => {
        if (!activeGame) return;
        const rounds = ongoingMatch ? (ongoingMatch.modality === 'parejaFija' ? ongoingMatch.americanoRounds : ongoingMatch.rounds) : ongoingElevador?.rounds;
        if (!rounds || rounds.length === 0) return;
        
        const firstUnfinishedRoundIndex = rounds.findIndex(round => {
            if (ongoingMatch) {
                if (ongoingMatch.modality === '6loco' || ongoingMatch.modality === '6locoParejas') {
                    return (round as Round).matches.some(match => match.score1 === null || match.score2 === null);
                } else {
                    return (round as AmericanoRound).matches.some(match => match.set1_t1 === null || match.set1_t2 === null);
                }
            } else {
                return (round as any).courts.some((c: any) => c.match?.score1 === null);
            }
        });

        setOpenAccordionItem(`item-${firstUnfinishedRoundIndex !== -1 ? firstUnfinishedRoundIndex : rounds.length - 1}`);
    }, [ongoingMatch, ongoingElevador]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;

    if (!activeGame) return (
        <Card className="h-full bg-slate-900/50 border-slate-700 flex flex-col items-center justify-center p-8 text-center shadow-xl">
            <Sword className="h-20 w-20 text-slate-700 mb-4" />
            <CardTitle className="text-2xl text-white">Esperando Partida...</CardTitle>
        </Card>
    );

    return (
        <Card className="h-full bg-slate-900/50 border-slate-700 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-3xl text-white flex items-center gap-3 font-headline">
                    <Sword className="text-yellow-400 h-8 w-8"/> Marcadores en Directo
                </CardTitle>
            </CardHeader>
            <CardContent className="py-4 overflow-y-auto max-h-[calc(100vh-250px)]">
                <Accordion type="single" collapsible className="w-full" value={openAccordionItem} onValueChange={setOpenAccordionItem}>
                    {ongoingMatch ? (
                        ongoingMatch.modality === '6loco' || ongoingMatch.modality === '6locoParejas' ? (
                            ongoingMatch.rounds.map((round, ri) => (
                                <AccordionItem value={`item-${ri}`} key={ri} className="border-slate-700">
                                    <AccordionTrigger className={cn("text-2xl text-white font-bold", round.isBonus && "text-yellow-400")}>
                                        Ronda {ri + 1} {round.isBonus && '(Bonus)'}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                            {round.matches.map((match, mi) => (
                                                <div key={mi} className='flex flex-col gap-1 p-3 bg-slate-800 rounded-lg border border-slate-600 shadow-inner'>
                                                    <div className="text-lg font-black text-blue-400 uppercase tracking-widest text-center border-b border-slate-700/50 pb-1 mb-1">Cancha {match.courtNumber || mi + 1}</div>
                                                    <div className='flex items-center gap-2'>
                                                        <div className='flex-1 text-right flex flex-col gap-0.5 overflow-hidden'>
                                                            <span className='text-lg font-bold text-slate-200 uppercase truncate'>{match.team1.player1.name}</span>
                                                            <span className='text-lg font-bold text-slate-200 uppercase truncate'>{match.team1.player2.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 px-2">
                                                            <div className="w-14 h-14 flex items-center justify-center text-3xl font-black bg-slate-700 rounded text-white border border-slate-500">{match.score1 ?? '-'}</div>
                                                            <span className="text-primary font-black">VS</span>
                                                            <div className="w-14 h-14 flex items-center justify-center text-3xl font-black bg-slate-700 rounded text-white border border-slate-500">{match.score2 ?? '-'}</div>
                                                        </div>
                                                        <div className='flex-1 text-left flex flex-col gap-0.5 overflow-hidden'>
                                                            <span className='text-lg font-bold text-slate-200 uppercase truncate'>{match.team2.player1.name}</span>
                                                            <span className='text-lg font-bold text-slate-200 uppercase truncate'>{match.team2.player2.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))
                        ) : (
                            ongoingMatch.americanoRounds.map((round, ri) => (
                                <AccordionItem value={`item-${ri}`} key={ri} className="border-slate-700">
                                    <AccordionTrigger className="text-2xl text-white font-bold">Ronda {round.roundNumber}</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                            {round.matches.map((match, mi) => (
                                                <div key={mi} className="p-4 border rounded-lg bg-slate-800 border-slate-600 shadow-inner">
                                                    <div className="text-lg font-black text-blue-400 uppercase tracking-widest text-center border-b border-slate-700/50 pb-1 mb-2">Cancha {match.courtNumber || mi + 1}</div>
                                                    <div className="flex justify-between text-xl font-black mb-4 uppercase">
                                                        <div className="flex-1 text-right flex flex-col gap-0.5 overflow-hidden">
                                                            <span className='text-slate-200 truncate'>{match.team1.player1.name}</span>
                                                            <span className='text-slate-200 truncate'>{match.team1.player2.name}</span>
                                                        </div>
                                                        <span className="px-4 text-primary">VS</span>
                                                        <div className="flex-1 text-left flex flex-col gap-0.5 overflow-hidden">
                                                            <span className='text-slate-200 truncate'>{match.team2.player1.name}</span>
                                                            <span className='text-slate-200 truncate'>{match.team2.player2.name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-center gap-8">
                                                        {[1, 2, 3].map(s => {
                                                            const s1 = (match as any)[`set${s}_t1`];
                                                            const s2 = (match as any)[`set${s}_t2`];
                                                            if (s === 3 && s1 === null) return null;
                                                            return (
                                                                <div key={s} className="text-center">
                                                                    <p className="text-[10px] uppercase font-black opacity-50 mb-1 tracking-widest">SET {s}</p>
                                                                    <div className="flex gap-2 text-3xl font-black">
                                                                        <span className={cn(s1 > s2 ? "text-yellow-400" : "text-white")}>{s1 ?? '-'}</span>
                                                                        <span className="opacity-20">|</span>
                                                                        <span className={cn(s2 > s1 ? "text-yellow-400" : "text-white")}>{s2 ?? '-'}</span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))
                        )
                    ) : (
                        ongoingElevador?.rounds.map((round, ri) => (
                            <AccordionItem value={`item-${ri}`} key={ri} className="border-slate-700">
                                <AccordionTrigger className={cn("text-2xl text-white font-bold", round.isBonus && "text-yellow-400")}>
                                    Ronda {round.roundNumber} {round.isBonus && '(Bonus)'}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        {round.courts.map((court, ci) => (
                                            <div key={ci} className='flex flex-col gap-2 p-4 bg-slate-800 rounded-xl border border-slate-600 shadow-2xl overflow-hidden'>
                                                <div className="text-xl font-black text-blue-400 uppercase tracking-widest text-center border-b border-slate-700/50 pb-2 mb-2">Cancha {court.courtNumber}</div>
                                                <div className='flex items-center gap-4 justify-between'>
                                                    <div className='flex-1 flex flex-col items-end gap-1 overflow-hidden shrink-0'>
                                                        <span className='text-xl font-black text-slate-200 uppercase w-full text-right truncate'>{court.match?.team1.player1.name}</span>
                                                        <span className='text-xl font-black text-slate-200 uppercase w-full text-right truncate'>{court.match?.team1.player2.name}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 shrink-0 px-4">
                                                        <div className="w-16 h-16 flex items-center justify-center text-4xl font-black bg-slate-900 border-2 border-primary/40 rounded-lg text-white shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                                                            {court.match?.score1 ?? '-'}
                                                        </div>
                                                        <span className="text-primary font-black text-2xl">VS</span>
                                                        <div className="w-16 h-16 flex items-center justify-center text-4xl font-black bg-slate-900 border-2 border-primary/40 rounded-lg text-white shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                                                            {court.match?.score2 ?? '-'}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className='flex-1 flex flex-col items-start gap-1 overflow-hidden shrink-0'>
                                                        <span className='text-xl font-black text-slate-200 uppercase w-full truncate'>{court.match?.team2.player1.name}</span>
                                                        <span className='text-xl font-black text-slate-200 uppercase w-full truncate'>{court.match?.team2.player2.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))
                    )}
                </Accordion>
            </CardContent>
        </Card>
    );
};

export default function ProyectorPage() {
    const { db } = useFirebase();
    const { setCategory } = useCategory();
    const [displayMode, setDisplayMode] = useState<Category | 'ranking' | 'publicidad'>('ranking');
    const [globalRankings, setGlobalRankings] = useState<{ category: Category, players: any[] }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (displayMode !== 'ranking' && displayMode !== 'publicidad') setCategory(displayMode as Category);
    }, [displayMode, setCategory]);

    const calculateAllRankings = useCallback(async () => {
        if (!db) return;
        setLoading(true);
        try {
            const [playersSnap, dailySnap, elevadorSnap, monthlySnap] = await Promise.all([
                getDocs(collection(db, "players")),
                getDocs(collection(db, "dailyEvents")),
                getDocs(collection(db, "dailyElevadorEvents")),
                getDocs(collection(db, "monthlyRankings"))
            ]);

            const allPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
            const allDaily = dailySnap.docs.map(d => d.data() as DailyEvent);
            const allElevador = elevadorSnap.docs.map(d => d.data() as DailyElevadorEvent);
            const allMonthly = monthlySnap.docs.map(d => d.data() as MonthlyRanking);

            const cats: Category[] = ['5ta', '4ta', '3ra', '2da', '1ra'];
            const finalRankings = cats.map(cat => {
                const categoryPlayers = allPlayers.filter(p => cat === '4ta' ? (p.category === '4ta' || !p.category) : p.category === cat);
                
                const stats: Record<string, any> = {};
                categoryPlayers.forEach(p => {
                    stats[p.id] = { 
                        ...p, totalGames: 0, totalPoints: 0, 
                        medals: { gold: 0, silver: 0, bronze: 0 },
                        achievements: { king: 0, shield: 0, sword: 0 }
                    };
                });

                allDaily.filter(e => cat === '4ta' ? (e.category === '4ta' || !e.category) : e.category === cat).forEach(event => {
                    const sortedResults = [...event.results].sort((a,b) => b.points - a.points);
                    sortedResults.forEach((res, idx) => {
                        if (stats[res.playerId]) {
                            stats[res.playerId].totalGames++;
                            stats[res.playerId].totalPoints += res.points;
                            if (idx === 0) stats[res.playerId].medals.gold++;
                            else if (idx === 1) stats[res.playerId].medals.silver++;
                            else if (idx === 2) stats[res.playerId].medals.bronze++;
                        }
                    });
                });

                allElevador.filter(e => cat === '4ta' ? (e.category === '4ta' || !e.category) : e.category === cat).forEach(event => {
                    const sortedResults = [...event.results].sort((a,b) => b.pointsScored - a.pointsScored);
                    sortedResults.forEach((res, idx) => {
                        if (stats[res.playerId]) {
                            stats[res.playerId].totalGames++;
                            stats[res.playerId].totalPoints += res.pointsScored;
                            if (idx === 0) stats[res.playerId].medals.gold++;
                            else if (idx === 1) stats[res.playerId].medals.silver++;
                            else if (idx === 2) stats[res.playerId].medals.bronze++;
                        }
                    });
                });

                allMonthly.filter(m => cat === '4ta' ? (m.category === '4ta' || !m.category) : m.category === cat).forEach(month => {
                    const top3 = month.players.slice(0, 3);
                    const achievements = ['king', 'shield', 'sword'] as const;
                    top3.forEach((player, index) => {
                        if (stats[player.playerId]) {
                            stats[player.playerId].achievements[achievements[index]]++;
                        }
                    });
                });

                const sorted = Object.values(stats).sort((a, b) => {
                    if (b.achievements.king !== a.achievements.king) return b.achievements.king - a.achievements.king;
                    if (b.achievements.shield !== a.achievements.shield) return b.achievements.shield - a.achievements.shield;
                    if (b.achievements.sword !== a.achievements.sword) return b.achievements.sword - a.achievements.sword;
                    if (b.medals.gold !== a.medals.gold) return b.medals.gold - a.medals.gold;
                    if (b.medals.silver !== a.medals.silver) return b.medals.silver - a.medals.silver;
                    if (b.medals.bronze !== a.medals.bronze) return b.medals.bronze - a.medals.bronze;
                    const avgA = a.totalGames > 0 ? a.totalPoints / a.totalGames : 0;
                    const avgB = b.totalGames > 0 ? b.totalPoints / b.totalGames : 0;
                    return avgB - avgA;
                });

                return { category: cat, players: sorted };
            });

            setGlobalRankings(finalRankings);
        } catch (e) {
            console.error("Error calculating proyector rankings:", e);
        } finally {
            setLoading(false);
        }
    }, [db]);

    useEffect(() => {
        if (!db) return;
        const unsubPlayers = onSnapshot(collection(db, "players"), calculateAllRankings);
        const unsubDaily = onSnapshot(collection(db, "dailyEvents"), calculateAllRankings);
        const unsubMonthly = onSnapshot(collection(db, "monthlyRankings"), calculateAllRankings);
        
        return () => {
            unsubPlayers();
            unsubDaily();
            unsubMonthly();
        };
    }, [db, calculateAllRankings]);
    
    return (
        <div className="bg-slate-900 min-h-screen text-white flex flex-col relative overflow-hidden">
             <header className={cn(
                 "text-center p-8 shrink-0 flex flex-col items-center transition-all duration-500 z-50",
                 displayMode === 'publicidad' ? "absolute top-0 left-0 right-0 opacity-0 hover:opacity-100 bg-slate-900/90 py-4" : "relative"
             )}>
                {displayMode !== 'publicidad' && (
                    <>
                        <Image src="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" alt="Logo" width={150} height={150} className="mx-auto" />
                        <h1 className="text-6xl font-black text-yellow-400 -mt-6 font-headline tracking-tighter drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">MÁSTER PÁDEL TV</h1>
                    </>
                )}
                <div className={cn("flex justify-center items-center gap-4", displayMode !== 'publicidad' ? "mt-6" : "")}>
                    <Select value={displayMode} onValueChange={(v) => setDisplayMode(v as any)}>
                        <SelectTrigger className="w-[350px] bg-slate-800 border-slate-600 text-white text-xl font-bold h-12 shadow-lg">
                            <SelectValue placeholder="Seleccionar Vista" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            <SelectItem value="ranking" className="focus:bg-primary/20 text-lg">Ranking General (Multi-Categoría)</SelectItem>
                            <SelectItem value="1ra" className="focus:bg-primary/20 text-lg">1ra Cat. (Marcadores en Vivo)</SelectItem>
                            <SelectItem value="2da" className="focus:bg-primary/20 text-lg">2da Cat. (Marcadores en Vivo)</SelectItem>
                            <SelectItem value="3ra" className="focus:bg-primary/20 text-lg">3ra Cat. (Marcadores en Vivo)</SelectItem>
                            <SelectItem value="4ta" className="focus:bg-primary/20 text-lg">4ta Cat. (Marcadores en Vivo)</SelectItem>
                            <SelectItem value="5ta" className="focus:bg-primary/20 text-lg">5ta Cat. (Marcadores en Vivo)</SelectItem>
                            <SelectItem value="publicidad" className="focus:bg-primary/20 text-lg">Pantalla Publicitaria (Logo)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </header>

            <main className={cn("flex-grow overflow-hidden px-2", displayMode === 'publicidad' ? "flex items-center justify-center h-screen w-screen" : "p-8")}>
                 {displayMode === 'ranking' ? (
                    loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="text-xl font-bold animate-pulse">CALCULANDO RANKINGS HISTÓRICOS...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full items-stretch">
                            {globalRankings.map(ranking => (
                                <ProyectorGeneralRankingColumn 
                                    key={ranking.category} 
                                    category={ranking.category} 
                                    players={ranking.players} 
                                />
                            ))}
                        </div>
                    )
                ) : displayMode === 'publicidad' ? (
                    <div className="flex flex-col items-center justify-center h-full w-full animate-in fade-in zoom-in duration-1000 space-y-0">
                        <div className="relative">
                            <Image 
                                src="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" 
                                alt="Logo Master Padel" 
                                width={800} 
                                height={800} 
                                className="drop-shadow-[0_0_60px_rgba(255,215,0,0.4)]"
                                priority
                            />
                        </div>
                        <h1 className="text-[12rem] font-black text-yellow-400 font-headline tracking-widest drop-shadow-[0_0_30px_rgba(255,215,0,0.6)] -mt-24 leading-none">
                            MÁSTER PÁDEL
                        </h1>
                    </div>
                ) : (
                     <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-8 h-full">
                        <ProyectorLiveStandings />
                        <ProyectorOngoingMatch />
                    </div>
                )}
            </main>
        </div>
    );
}