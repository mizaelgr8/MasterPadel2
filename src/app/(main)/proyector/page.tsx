
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import type { Player, Category, OngoingMatch, OngoingElevador } from '@/types';
import { useFirebase } from '@/context/FirebaseContext';
import { useCategory } from '@/context/CategoryContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Sword, Trophy, Star, Crown, Shield, Swords } from 'lucide-react';
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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {players.slice(0, 15).map((player, index) => (
                            <TableRow key={player.id} className={cn(
                                "border-slate-800/50 h-20 hover:bg-slate-800/30 transition-colors",
                                index < 3 && "bg-yellow-500/5"
                            )}>
                                <TableCell className="text-center font-black text-xl">
                                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                                </TableCell>
                                <TableCell className="font-bold text-base text-white">
                                    {player.name.toUpperCase()}
                                </TableCell>
                                <TableCell className="text-center font-black text-primary text-xl">
                                    {player.totalGames > 0 ? (player.totalPoints / player.totalGames).toFixed(1) : '0.0'}
                                </TableCell>
                            </TableRow>
                        ))}
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
            if (!snapshot.empty) setOngoingMatch({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as OngoingMatch);
            else setOngoingMatch(null);
        });
        const unsubElevador = onSnapshot(qElevador, (snapshot) => {
            if (!snapshot.empty) setOngoingElevador({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as OngoingElevador);
            else setOngoingElevador(null);
            setLoading(false);
        });
        return () => { unsubMatch(); unsubElevador(); };
    }, [db, category]);

    const results = useMemo(() => {
        if (ongoingMatch) {
            const isInd = ongoingMatch.modality === '6loco';
            const stats: Record<string, any> = {};
            if (isInd) ongoingMatch.selectedPlayers.forEach(p => stats[p.id] = { id: p.id, name: p.name, points: 0, g: 0, p: 0, court: 1 });
            else ongoingMatch.fixedPairs.forEach(pair => stats[pair.id] = { id: pair.id, name: pair.player1.name + ' & ' + pair.player2.name, points: 0, g: 0, p: 0, court: 1 });
            
            ongoingMatch.rounds?.forEach(round => round.matches.forEach(match => {
                if (match.score1 === null || match.score2 === null) return;
                const t1W = match.score1! > match.score2!;
                if (isInd) {
                    [match.team1.player1.id, match.team1.player2.id].forEach(id => { if(stats[id]){ stats[id].points += match.score1!; if(t1W) stats[id].g++; else stats[id].p++; }});
                    [match.team2.player1.id, match.team2.player2.id].forEach(id => { if(stats[id]){ stats[id].points += match.score2!; if(!t1W) stats[id].g++; else stats[id].p++; }});
                } else {
                    if (stats[match.team1.id]) { stats[match.team1.id].points += match.score1!; if(t1W) stats[match.team1.id].g++; else stats[match.team1.id].p++; }
                    if (stats[match.team2.id]) { stats[match.team2.id].points += match.score2!; if(!t1W) stats[match.team2.id].g++; else stats[match.team2.id].p++; }
                }
            }));
            return Object.values(stats).sort((a, b) => b.points - a.points || b.g - a.g);
        } else if (ongoingElevador) {
            const isPairs = ongoingElevador.modality === 'elevadorParejas';
            const nCourts = ongoingElevador.rounds[0]?.courts.length || 0;
            const stats: Record<string, any> = {};

            if (isPairs) ongoingElevador.fixedPairs.forEach(p => stats[p.id] = { id: p.id, name: p.player1.name + ' & ' + p.player2.name, g: 0, p: 0, points: 0, court: 0 });
            else ongoingElevador.selectedPlayers.forEach(p => stats[p.id] = { id: p.id, name: p.name, g: 0, p: 0, points: 0, court: 0 });

            ongoingElevador.rounds[0]?.courts.forEach(c => {
                 if(isPairs) {
                     const p1Id = [c.match!.team1.player1.id, c.match!.team1.player2.id].sort().join('-');
                     const p2Id = [c.match!.team2.player1.id, c.match!.team2.player2.id].sort().join('-');
                     if(stats[p1Id]) stats[p1Id].court = c.courtNumber; if(stats[p2Id]) stats[p2Id].court = c.courtNumber;
                 } else {
                     [c.match!.team1.player1.id, c.match!.team1.player2.id, c.match!.team2.player1.id, c.match!.team2.player2.id].forEach(id => { if(stats[id]) stats[id].court = c.courtNumber; });
                 }
            });

            ongoingElevador.rounds.forEach(round => {
                round.courts.forEach(court => {
                    const m = court.match; if (!m || m.score1 === null || m.score2 === null) return;
                    const t1W = m.score1! > m.score2!;
                    const t1Res = t1W ? Math.max(1, court.courtNumber - 1) : Math.min(nCourts, court.courtNumber + 1);
                    const t2Res = !t1W ? Math.max(1, court.courtNumber - 1) : Math.min(nCourts, court.courtNumber + 1);
                    
                    if (isPairs) {
                        const p1Id = [m.team1.player1.id, m.team1.player2.id].sort().join('-');
                        const p2Id = [m.team2.player1.id, m.team2.player2.id].sort().join('-');
                        if (stats[p1Id]) { stats[p1Id].points += m.score1!; stats[p1Id].court = t1Res; if (t1W) stats[p1Id].g++; else stats[p1Id].p++; }
                        if (stats[p2Id]) { stats[p2Id].points += m.score2!; stats[p2Id].court = t2Res; if (!t1W) stats[p2Id].g++; else stats[p2Id].p++; }
                    } else {
                        [m.team1.player1.id, m.team1.player2.id].forEach(id => { if (stats[id]) { stats[id].points += m.score1!; stats[id].court = t1Res; if (t1W) stats[id].g++; else stats[id].p++; }});
                        [m.team2.player1.id, m.team2.player2.id].forEach(id => { if (stats[id]) { stats[id].points += m.score2!; stats[id].court = t2Res; if (!t1W) stats[id].g++; else stats[id].p++; }});
                    }
                });
            });
            
            return Object.values(stats).sort((a, b) => {
                if (b.g !== a.g) return b.g - a.g;
                if (a.court !== b.court) return a.court - b.court; // Cancha 1 es mejor que Cancha 2
                return b.points - a.points;
            });
        }
        return [];
    }, [ongoingMatch, ongoingElevador]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;
    if (!ongoingMatch && !ongoingElevador) return <Card className="h-full bg-slate-900/50 border-slate-700 flex flex-col items-center justify-center p-8 shadow-xl"><Star className="h-20 w-20 text-slate-700 mb-4 animate-pulse" /><CardTitle className="text-2xl text-white">Sin Partida Activa</CardTitle></Card>;

    return (
        <Card className="h-full bg-slate-900/50 border-slate-700 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-slate-700"><CardTitle className="text-3xl text-white flex items-center gap-3 font-headline"><Trophy className="text-yellow-400 h-8 w-8"/> Clasificación en Vivo</CardTitle></CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-900/80"><TableRow className="border-slate-700 h-14"><TableHead className="w-16 text-xl text-slate-400 text-center">#</TableHead><TableHead className="text-xl text-slate-400">Nombre</TableHead><TableHead className="text-center text-xl text-slate-400">G</TableHead><TableHead className="text-center text-xl text-slate-400">P</TableHead><TableHead className="text-center text-xl text-slate-400">Cancha</TableHead><TableHead className="text-center text-xl text-slate-400">Pts</TableHead></TableRow></TableHeader>
                    <TableBody>{results.map((row, index) => (
                        <TableRow key={index} className="border-slate-800 h-16 text-white hover:bg-slate-800/50 transition-colors">
                            <TableCell className="font-bold text-2xl text-center">{index + 1}</TableCell>
                            <TableCell className="font-bold text-xl uppercase truncate max-w-[400px]">{row.name}</TableCell>
                            <TableCell className="text-center font-bold text-green-400 text-2xl">{row.g}</TableCell>
                            <TableCell className="text-center font-bold text-red-400 text-2xl">{row.p}</TableCell>
                            <TableCell className="text-center font-bold text-blue-300 text-xl">Pista {row.court}</TableCell>
                            <TableCell className="text-center font-black text-primary text-3xl">{row.points}</TableCell>
                        </TableRow>
                    ))}</TableBody>
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
            if (!snapshot.empty) setOngoingMatch({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as OngoingMatch);
            else setOngoingMatch(null);
        });
        const unsubElevador = onSnapshot(qElevador, (snapshot) => {
            if (!snapshot.empty) setOngoingElevador({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as OngoingElevador);
            else setOngoingElevador(null);
            setLoading(false);
        });
        return () => { unsubMatch(); unsubElevador(); };
    }, [db, category]);

    useEffect(() => {
        const game = ongoingMatch || ongoingElevador;
        if (!game) return;
        const rounds = ongoingMatch ? (ongoingMatch.modality === 'parejaFija' ? ongoingMatch.americanoRounds : ongoingMatch.rounds) : ongoingElevador?.rounds;
        if (rounds && rounds.length > 0) setOpenAccordionItem(`item-${rounds.length - 1}`);
    }, [ongoingMatch, ongoingElevador]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;
    if (!ongoingMatch && !ongoingElevador) return <Card className="h-full bg-slate-900/50 border-slate-700 flex flex-col items-center justify-center p-8 shadow-xl"><Sword className="h-20 w-20 text-slate-700 mb-4" /><CardTitle className="text-2xl text-white">Esperando Partida...</CardTitle></Card>;

    return (
        <Card className="h-full bg-slate-900/50 border-slate-700 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-slate-700"><CardTitle className="text-3xl text-white flex items-center gap-3 font-headline"><Sword className="text-yellow-400 h-8 w-8"/> Marcadores en Directo</CardTitle></CardHeader>
            <CardContent className="py-4 overflow-y-auto max-h-[calc(100vh-250px)]">
                <Accordion type="single" collapsible className="w-full" value={openAccordionItem} onValueChange={setOpenAccordionItem}>
                    {ongoingMatch ? (
                        ongoingMatch.rounds?.map((round, ri) => (
                            <AccordionItem value={`item-${ri}`} key={ri} className="border-slate-700">
                                <AccordionTrigger className={cn("text-2xl text-white font-bold", round.isBonus && "text-yellow-400")}>Ronda {ri + 1} {round.isBonus && '(Bonus)'}</AccordionTrigger>
                                <AccordionContent><div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {round.matches.map((match, mi) => (
                                        <div key={mi} className='flex flex-col gap-2 p-4 bg-slate-800 rounded-lg border border-slate-600 shadow-inner'>
                                            <div className="text-lg font-black text-blue-400 uppercase tracking-widest text-center border-b border-slate-700/50 pb-1 mb-1">Cancha {match.courtNumber || mi + 1}</div>
                                            <div className='flex items-center gap-3'>
                                                <div className='flex-1 flex flex-col items-end gap-1 justify-center shrink-0 min-h-[100px]'>
                                                    <span className='text-2xl font-black text-slate-200 uppercase text-right leading-tight'>{match.team1.player1.name}</span>
                                                    <span className='text-2xl font-black text-slate-200 uppercase text-right leading-tight'>{match.team1.player2.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 px-4">
                                                    <div className="w-16 h-16 flex items-center justify-center text-5xl font-black bg-slate-700 rounded text-white border-2 border-primary/40">{match.score1 ?? '-'}</div>
                                                    <span className="text-primary font-black text-2xl">VS</span>
                                                    <div className="w-16 h-16 flex items-center justify-center text-5xl font-black bg-slate-700 rounded text-white border-2 border-primary/40">{match.score2 ?? '-'}</div>
                                                </div>
                                                <div className='flex-1 flex flex-col items-start gap-1 justify-center shrink-0 min-h-[100px]'>
                                                    <span className='text-2xl font-black text-slate-200 uppercase leading-tight'>{match.team2.player1.name}</span>
                                                    <span className='text-2xl font-black text-slate-200 uppercase leading-tight'>{match.team2.player2.name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div></AccordionContent>
                            </AccordionItem>
                        ))
                    ) : (
                        ongoingElevador?.rounds?.map((round, ri) => (
                            <AccordionItem value={`item-${ri}`} key={ri} className="border-slate-700">
                                <AccordionTrigger className={cn("text-2xl text-white font-bold", round.isBonus && "text-yellow-400")}>Ronda {round.roundNumber} {round.isBonus && '(Bonus)'}</AccordionTrigger>
                                <AccordionContent><div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {round.courts.map((court, ci) => (
                                        <div key={ci} className='flex flex-col gap-2 p-4 bg-slate-800 rounded-xl border border-slate-600 shadow-2xl'>
                                            <div className="text-xl font-black text-blue-400 uppercase tracking-widest text-center border-b border-slate-700/50 pb-2 mb-2">Cancha {court.courtNumber}</div>
                                            <div className='flex items-center gap-4'>
                                                <div className='flex-1 flex flex-col items-end gap-1 justify-center shrink-0 min-h-[100px]'>
                                                    <span className='text-3xl font-black text-slate-200 uppercase text-right leading-tight'>{court.match?.team1.player1.name}</span>
                                                    <span className='text-3xl font-black text-slate-200 uppercase text-right leading-tight'>{court.match?.team1.player2.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 px-4">
                                                    <div className="w-20 h-20 flex items-center justify-center text-6xl font-black bg-slate-900 border-2 border-primary/40 rounded-lg text-white">{court.match?.score1 ?? '-'}</div>
                                                    <span className="text-primary font-black text-2xl">VS</span>
                                                    <div className="w-20 h-20 flex items-center justify-center text-6xl font-black bg-slate-900 border-2 border-primary/40 rounded-lg text-white">{court.match?.score2 ?? '-'}</div>
                                                </div>
                                                <div className='flex-1 flex flex-col items-start gap-1 justify-center shrink-0 min-h-[100px]'>
                                                    <span className='text-3xl font-black text-slate-200 uppercase leading-tight'>{court.match?.team2.player1.name}</span>
                                                    <span className='text-3xl font-black text-slate-200 uppercase leading-tight'>{court.match?.team2.player2.name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div></AccordionContent>
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
            const playersSnap = await getDocs(collection(db, "players"));
            const allPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
            const cats: Category[] = ['1ra', '2da', '3ra', '4ta', '5ta'];
            
            const finalRankings = cats.map(cat => {
                const categoryPlayers = allPlayers.filter(p => {
                    const pCat = (p.category || '').toLowerCase() || '';
                    if (cat === '4ta') return !p.category || pCat.includes('4') || pCat === 'invitado';
                    return p.category === cat;
                });
                const sorted = categoryPlayers.sort((a,b) => (b.totalPoints || 0) - (a.totalPoints || 0));
                return { category: cat, players: sorted };
            });
            setGlobalRankings(finalRankings);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [db]);

    useEffect(() => {
        if (!db) return;
        const unsub = onSnapshot(collection(db, "players"), calculateAllRankings);
        return () => unsub();
    }, [db, calculateAllRankings]);
    
    return (
        <div className="bg-slate-900 min-h-screen text-white flex flex-col relative overflow-hidden">
             <header className={cn("text-center p-8 shrink-0 flex flex-col items-center transition-all duration-500 z-50", displayMode === 'publicidad' ? "absolute top-0 left-0 right-0 opacity-0 hover:opacity-100 bg-slate-900/90 py-4" : "relative")}>
                {displayMode !== 'publicidad' && (<><Image src="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" alt="Logo" width={150} height={150} className="mx-auto" /><h1 className="text-6xl font-black text-yellow-400 -mt-6 font-headline tracking-tighter drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">MÁSTER PÁDEL TV</h1></>)}
                <div className={cn("flex justify-center items-center gap-4", displayMode !== 'publicidad' ? "mt-6" : "")}>
                    <Select value={displayMode} onValueChange={(v) => setDisplayMode(v as any)}>
                        <SelectTrigger className="w-[350px] bg-slate-800 border-slate-600 text-white text-xl font-bold h-12 shadow-lg"><SelectValue placeholder="Seleccionar Vista" /></SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            <SelectItem value="ranking" className="focus:bg-primary/20 text-lg">Ranking General</SelectItem>
                            <SelectItem value="1ra" className="focus:bg-primary/20 text-lg">1ra Cat. (Directo)</SelectItem>
                            <SelectItem value="2da" className="focus:bg-primary/20 text-lg">2da Cat. (Directo)</SelectItem>
                            <SelectItem value="3ra" className="focus:bg-primary/20 text-lg">3ra Cat. (Directo)</SelectItem>
                            <SelectItem value="4ta" className="focus:bg-primary/20 text-lg">4ta Cat. (Directo)</SelectItem>
                            <SelectItem value="5ta" className="focus:bg-primary/20 text-lg">5ta Cat. (Directo)</SelectItem>
                            <SelectItem value="publicidad" className="focus:bg-primary/20 text-lg">Publicidad</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </header>
            <main className={cn("flex-grow overflow-hidden px-2", displayMode === 'publicidad' ? "flex items-center justify-center h-screen w-screen" : "p-8")}>
                 {displayMode === 'ranking' ? (
                    loading ? <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-xl font-bold animate-pulse">CARGANDO...</p></div> : <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full items-stretch">{globalRankings.map(ranking => <ProyectorGeneralRankingColumn key={ranking.category} category={ranking.category} players={ranking.players} />)}</div>
                ) : displayMode === 'publicidad' ? (
                    <div className="flex flex-col items-center justify-center h-full w-full space-y-0"><div className="relative"><Image src="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" alt="Logo" width={800} height={800} className="drop-shadow-[0_0_60px_rgba(255,215,0,0.4)]" priority /></div><h1 className="text-[12rem] font-black text-yellow-400 font-headline tracking-widest drop-shadow-[0_0_30px_rgba(255,215,0,0.6)] -mt-24 leading-none">MÁSTER PÁDEL</h1></div>
                ) : (
                     <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-8 h-full"><ProyectorLiveStandings /><ProyectorOngoingMatch /></div>
                )}
            </main>
        </div>
    );
}
