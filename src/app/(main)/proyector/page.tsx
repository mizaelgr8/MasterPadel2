
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
            return Object.values(stats).sort((a: any, b: any) => b.points - a.points || b.g - a.g);
        } else if (ongoingElevador) {
            const isPairs = ongoingElevador.modality === 'elevadorParejas';
            const nCourts = ongoingElevador.rounds[0]?.courts.length || 0;
            const stats: Record<string, any> = {};

            if (isPairs) {
                ongoingElevador.fixedPairs.forEach(p => stats[p.id] = { id: p.id, name: p.player1.name + ' & ' + p.player2.name, g: 0, p: 0, points: 0, court: 1 });
                ongoingElevador.rounds[0]?.courts.forEach(c => {
                    if (c.match) {
                        const p1Id = [c.match.team1.player1.id, c.match.team1.player2.id].sort().join('-');
                        const p2Id = [c.match.team2.player1.id, c.match.team2.player2.id].sort().join('-');
                        if(stats[p1Id]) stats[p1Id].court = c.courtNumber; if(stats[p2Id]) stats[p2Id].court = c.courtNumber;
                    }
                });
            } else {
                ongoingElevador.selectedPlayers.forEach(p => stats[p.id] = { id: p.id, name: p.name, g: 0, p: 0, points: 0, court: 1 });
                ongoingElevador.rounds[0]?.courts.forEach(c => {
                    if (c.match) {
                        [c.match.team1.player1.id, c.match.team1.player2.id, c.match.team2.player1.id, c.match.team2.player2.id].forEach(id => { if(stats[id]) stats[id].court = c.courtNumber; });
                    }
                });
            }

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
            
            return Object.values(stats).sort((a: any, b: any) => {
                if (b.g !== a.g) return b.g - a.g;
                const cA = a.court || 99;
                const cB = b.court || 99;
                if (cA !== cB) return cA - cB;
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
                    <TableHeader className="bg-slate-900/80"><TableRow className="border-slate-700 h-14"><TableHead className="w-16 text-xl text-slate-400 text-center">#</TableHead><TableHead className="text-xl text-slate-400">Nombre</TableHead><TableHead className="text-center text-xl text-slate-400">G</TableHead><TableHead className="text-center text-xl text-slate-400">P</TableHead><TableHead className="text-center text-xl text-slate-400">Pista</TableHead><TableHead className="text-center text-xl text-slate-400">Pts</TableHead></TableRow></TableHeader>
                    <TableBody>{results.map((row: any, index: number) => (
                        <TableRow key={index} className="border-slate-800 h-16 text-white hover:bg-slate-800/50 transition-colors">
                            <TableCell className="font-bold text-2xl text-center">{index + 1}</TableCell>
                            <TableCell className="font-bold text-xl uppercase truncate max-w-[400px]">{row.name}</TableCell>
                            <TableCell className="text-center font-bold text-green-400 text-2xl">{row.g}</TableCell>
                            <TableCell className="text-center font-bold text-red-400 text-2xl">{row.p}</TableCell>
                            <TableCell className="text-center font-bold text-blue-300 text-xl">Pista {row.court || '-'}</TableCell>
                            <TableCell className="text-center font-black text-primary text-3xl">{row.points}</TableCell>
                        </TableRow>
                    ))}</TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

export default function ProyectorPage() {
    const { db } = useFirebase();
    const [playersByCat, setPlayersByCat] = useState<Record<string, any[]>>({});
    const [view, setView] = useState<'standings' | 'ranking' | 'publicidad'>('standings');
    const cats: Category[] = ['1ra', '2da', '3ra', '4ta', '5ta'];

    useEffect(() => {
        if (!db) return;
        const unsub = onSnapshot(collection(db, "players"), (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const grouped: any = {};
            cats.forEach(c => {
                grouped[c] = list.filter((p: any) => {
                    const pCat = (p.category || '').toLowerCase();
                    if (c === '4ta') return pCat.includes('4') || pCat === '' || !p.category;
                    return pCat === c.toLowerCase();
                }).sort((a: any, b: any) => {
                    const avgA = a.totalGames > 0 ? a.totalPoints / a.totalGames : 0;
                    const avgB = b.totalGames > 0 ? b.totalPoints / b.totalGames : 0;
                    return avgB - avgA;
                });
            });
            setPlayersByCat(grouped);
        });
        return () => unsub();
    }, [db]);

    useEffect(() => {
        const interval = setInterval(() => {
            setView(v => v === 'standings' ? 'ranking' : v === 'ranking' ? 'publicidad' : 'standings');
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 p-6 flex flex-col gap-6">
            <header className="flex justify-between items-center bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-2xl">
                <div className="flex items-center gap-6">
                    <Image src="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" alt="Logo" width={100} height={100} className="drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]" />
                    <div>
                        <h1 className="text-6xl font-black text-yellow-400 font-headline tracking-tighter">MÁSTER PÁDEL</h1>
                        <p className="text-slate-400 text-xl font-bold tracking-[0.2em] uppercase mt-1">Live Scoreboard System</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    {['standings', 'ranking', 'publicidad'].map(v => (
                        <button key={v} onClick={() => setView(v as any)} className={cn("px-6 py-3 rounded-full text-sm font-black uppercase tracking-widest transition-all", view === v ? "bg-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]" : "bg-slate-800 text-slate-500")}>
                            {v === 'standings' ? 'Marcadores' : v === 'ranking' ? 'Rankings' : 'Publicidad'}
                        </button>
                    ))}
                </div>
            </header>

            <main className="flex-grow overflow-hidden">
                {view === 'standings' && <ProyectorLiveStandings />}
                {view === 'ranking' && (
                    <div className="grid grid-cols-5 gap-4 h-full">
                        {cats.map(c => <ProyectorGeneralRankingColumn key={c} category={c} players={playersByCat[c] || []} />)}
                    </div>
                )}
                {view === 'publicidad' && (
                    <div className="h-full flex flex-col items-center justify-center bg-slate-900/30 rounded-3xl border border-slate-800 relative overflow-hidden">
                        <div className="absolute inset-0 bg-radial-gradient opacity-20"></div>
                        <Image src="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" alt="Big Logo" width={600} height={600} className="relative z-10 animate-pulse drop-shadow-[0_0_50px_rgba(255,215,0,0.3)]" />
                        <h2 className="text-8xl font-black text-white mt-12 font-headline relative z-10 tracking-widest">BIENVENIDOS</h2>
                    </div>
                )}
            </main>
        </div>
    );
}
