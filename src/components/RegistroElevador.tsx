
"use client";
import { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, doc, updateDoc, deleteDoc, query, where, addDoc, onSnapshot, writeBatch, increment } from 'firebase/firestore';
import type { Player, ElevadorPlayer, ElevadorCourt, OngoingElevador, DailyElevadorResult, Category, Pair, ElevadorPlayerStats, DailyPairResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dices, Play, Trash2, Loader2, Sparkles, ArrowLeft, BarChart, PlusCircle, Gamepad2, Info, Users, User, X, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCategory } from '@/context/CategoryContext';
import { useFirebase } from '@/context/FirebaseContext';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';

const TOTAL_ROUNDS = 7;

const RegistroElevador = () => {
    const { db } = useFirebase();
    const { toast } = useToast();
    const { user } = useAuth();
    const { category } = useCategory();
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [ongoingMatches, setOngoingMatches] = useState<OngoingElevador[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<OngoingElevador | null>(null);
    const [view, setView] = useState<'loading' | 'list' | 'setup' | 'match'>('loading');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
    const [fixedPairs, setFixedPairs] = useState<Pair[]>([]);
    const [modality, setModality] = useState<'elevador' | 'elevadorParejas'>('elevador');
    const [numberOfPlayers, setNumberOfPlayers] = useState<string>('12');
    const [numberOfPairs, setNumberOfPairs] = useState<string>('6');
    const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [eventName, setEventName] = useState('');
    const [player1Id, setPlayer1Id] = useState<string | null>(null);
    const [player2Id, setPlayer2Id] = useState<string | null>(null);

    const [openAccordion, setOpenAccordion] = useState<string>("round-1");
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const filteredPlayersList = useMemo(() => {
        if (!searchQuery) return allPlayers;
        return allPlayers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [allPlayers, searchQuery]);

    const availablePlayersForPairing = useMemo(() => {
        const pairedPlayerIds = new Set(fixedPairs.flatMap(p => [p.player1.id, p.player2.id]));
        return allPlayers.filter(p => !pairedPlayerIds.has(p.id));
    }, [allPlayers, fixedPairs]);

    useEffect(() => {
        if (!db) return;
        const unsubPlayers = onSnapshot(collection(db, "players"), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            let filtered = list.filter(p => {
                const pCat = (p.category || '').toLowerCase().trim();
                const targetCat = category.toLowerCase().trim();
                if (targetCat === '4ta') {
                    return pCat.includes('4') || pCat === '' || !p.category || pCat === 'invitado';
                }
                return pCat === targetCat;
            });
            setAllPlayers(filtered.sort((a,b) => a.name.localeCompare(b.name)));
        });
        return () => unsubPlayers();
    }, [db, category]);

    useEffect(() => {
        if (!db) return;
        setLoading(true);
        const unsubOngoing = onSnapshot(collection(db, "ongoingElevador"), (snapshot) => {
            const matches = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as OngoingElevador));
            const filtered = matches.filter(m => {
                if (category === '4ta') return !m.category || m.category === '4ta';
                return m.category === category;
            });
            setOngoingMatches(filtered);
            setLoading(false);
        });
        return () => unsubOngoing();
    }, [db, category]);

    useEffect(() => {
        if (selectedMatch) {
            const updated = ongoingMatches.find(m => m.id === selectedMatch.id);
            setSelectedMatch(updated || null);
        }
    }, [ongoingMatches, selectedMatch]);

    useEffect(() => {
        if (view === 'loading' && !loading) setView(ongoingMatches.length > 0 ? 'list' : 'setup');
        else if (view === 'list' && ongoingMatches.length === 0 && !loading) setView('setup');
        else if (view === 'match' && !selectedMatch) setView('list');
    }, [view, ongoingMatches, selectedMatch, loading]);

    const handlePlayerToggle = (player: Player) => {
        const isSelected = selectedPlayers.some(p => p.id === player.id);
        const maxPlayers = parseInt(numberOfPlayers, 10);
        if (!isSelected && selectedPlayers.length >= maxPlayers) return;
        setSelectedPlayers(prev => isSelected ? prev.filter(p => p.id !== player.id) : [...prev, player]);
    };

    const handleAddPair = () => {
        const p1 = allPlayers.find(p => p.id === player1Id);
        const p2 = allPlayers.find(p => p.id === player2Id);
        if (p1 && p2 && p1.id !== p2.id) {
            const pairId = [p1.id, p2.id].sort().join('-');
            if (fixedPairs.some(p => p.id === pairId)) return;
            setFixedPairs([...fixedPairs, { id: pairId, player1: p1, player2: p2 }]);
            setPlayer1Id(null);
            setPlayer2Id(null);
        }
    };

    const startElevador = async () => {
        if (!db) return;
        const initialStats: Record<string, ElevadorPlayerStats> = {};
        const initialCourts: ElevadorCourt[] = [];
        let shuffledItems: any[] = [];
        const isPairs = modality === 'elevadorParejas';

        if (isPairs) shuffledItems = [...fixedPairs].sort(() => 0.5 - Math.random());
        else shuffledItems = [...selectedPlayers].sort(() => 0.5 - Math.random());

        const numCourts = shuffledItems.length / (isPairs ? 2 : 4);

        for (let i = 0; i < numCourts; i++) {
            let team1, team2;
            if (isPairs) {
                const pair1 = shuffledItems[i * 2];
                const pair2 = shuffledItems[i * 2 + 1];
                team1 = { player1: { ...pair1.player1, court: i + 1 }, player2: { ...pair1.player2, court: i + 1 } };
                team2 = { player1: { ...pair2.player1, court: i + 1 }, player2: { ...pair2.player2, court: i + 1 } };
                [pair1, pair2].forEach(p => {
                    initialStats[p.id] = { playerId: p.id, name: p.player1.name + ' & ' + p.player2.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0, courtHistory: [i + 1], finalCourt: i + 1 };
                });
            } else {
                const p = shuffledItems.slice(i * 4, (i * 4) + 4).map(player => ({ ...player, court: i + 1 }));
                team1 = { player1: p[0], player2: p[1] };
                team2 = { player1: p[2], player2: p[3] };
                p.forEach(player => {
                    initialStats[player.id] = { playerId: player.id, name: player.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0, courtHistory: [i + 1], finalCourt: i + 1 };
                });
            }
            initialCourts.push({ courtNumber: i + 1, players: [], match: { team1: team1 as any, team2: team2 as any, score1: null, score2: null } });
        }

        const newMatchData: Omit<OngoingElevador, 'id'> = { 
            eventName: eventName || (isPairs ? "Elevador Parejas" : "Elevador Individual"), modality, date, numberOfPlayers, 
            selectedPlayers: isPairs ? [] : selectedPlayers, fixedPairs: isPairs ? fixedPairs : [], 
            rounds: [{ roundNumber: 1, courts: initialCourts }], stage: 'playing', playerStats: initialStats, category 
        };

        try {
            const docRef = await addDoc(collection(db, "ongoingElevador"), newMatchData);
            setSelectedMatch({ ...newMatchData, id: docRef.id }); setView('match'); setOpenAccordion("round-1"); setSearchQuery('');
        } catch (e) { toast({title: "Error"}); }
    };

    const handleScoreChange = (ri: number, ci: number, team: 'team1' | 'team2', value: string) => {
        if (!selectedMatch || user?.role === 'guest' || !db) return;
        const score = parseInt(value, 10);
        const newRounds = JSON.parse(JSON.stringify(selectedMatch.rounds));
        const match = newRounds[ri].courts[ci].match;
        if (!match) return;
        
        if (value === '') { match.score1 = null; match.score2 = null; }
        else if (!isNaN(score) && score >= 0 && score <= 7) {
            if (team === 'team1') { match.score1 = score; match.score2 = 7 - score; }
            else { match.score2 = score; match.score1 = 7 - score; }
        }
        updateDoc(doc(db, "ongoingElevador", selectedMatch.id), { rounds: newRounds });
    };

    const startNextRound = () => {
        if (!selectedMatch || !db) return;
        const { rounds, playerStats, modality } = selectedMatch;
        const isPairs = modality === 'elevadorParejas';
        const last = rounds[rounds.length - 1];
        if (!last.courts.every(c => c.match && c.match.score1 !== null)) return;

        const newStats = JSON.parse(JSON.stringify(playerStats));
        const nCourts = last.courts.length;
        const nextMap: Record<number, any[]> = {};
        for(let i=1; i<=nCourts; i++) nextMap[i] = [];
        
        last.courts.forEach(c => {
            const m = c.match!; const t1W = m.score1! > m.score2!;
            let w, l;
            if (isPairs) {
                const p1Id = [m.team1.player1.id, m.team1.player2.id].sort().join('-');
                const p2Id = [m.team2.player1.id, m.team2.player2.id].sort().join('-');
                newStats[p1Id].pointsScored += m.score1!; newStats[p1Id].pointsReceived += m.score2!;
                newStats[p2Id].pointsScored += m.score2!; newStats[p2Id].pointsReceived += m.score1!;
                if (t1W) { newStats[p1Id].gamesWon++; newStats[p2Id].gamesLost++; w = {player1: m.team1.player1, player2: m.team1.player2, id: p1Id}; l = {player1: m.team2.player1, player2: m.team2.player2, id: p2Id}; }
                else { newStats[p2Id].gamesWon++; newStats[p1Id].gamesLost++; w = {player1: m.team2.player1, player2: m.team2.player2, id: p2Id}; l = {player1: m.team1.player1, player2: m.team1.player2, id: p1Id}; }
            } else {
                [m.team1.player1, m.team1.player2].forEach(p => { newStats[p.id].pointsScored += m.score1!; if(t1W) newStats[p.id].gamesWon++; else newStats[p.id].gamesLost++; });
                [m.team2.player1, m.team2.player2].forEach(p => { newStats[p.id].pointsScored += m.score2!; if(!t1W) newStats[p.id].gamesWon++; else newStats[p.id].gamesLost++; });
                w = t1W ? [m.team1.player1, m.team1.player2] : [m.team2.player1, m.team2.player2];
                l = t1W ? [m.team2.player1, m.team2.player2] : [m.team1.player1, m.team1.player2];
            }

            const current = c.courtNumber;
            const up = Math.max(1, current - 1);
            const down = Math.min(nCourts, current + 1);

            if (current === 1) { nextMap[1].push(w); nextMap[2].push(l); }
            else if (current === nCourts) { nextMap[nCourts - 1].push(w); nextMap[nCourts].push(l); }
            else { nextMap[up].push(w); nextMap[down].push(l); }
        });

        const newCourts: ElevadorCourt[] = [];
        for (let i = 1; i <= nCourts; i++) {
            const items = nextMap[i]; let t1, t2;
            if (isPairs) {
                const pair1 = items[0]; const pair2 = items[1];
                t1 = { player1: { ...pair1.player1, court: i }, player2: { ...pair1.player2, court: i } };
                t2 = { player1: { ...pair2.player1, court: i }, player2: { ...pair2.player2, court: i } };
                newStats[pair1.id].finalCourt = i; newStats[pair2.id].finalCourt = i;
            } else {
                const r = [...items.flat()].sort(() => 0.5 - Math.random());
                t1 = { player1: { ...r[0], court: i }, player2: { ...r[1], court: i } };
                t2 = { player1: { ...r[2], court: i }, player2: { ...r[3], court: i } };
                r.forEach(p => newStats[p.id].finalCourt = i);
            }
            newCourts.push({ courtNumber: i, players: [], match: { team1: t1 as any, team2: t2 as any, score1: null, score2: null } });
        }

        const nRound = { roundNumber: rounds.length + 1, courts: newCourts, isBonus: rounds.length + 1 === TOTAL_ROUNDS };
        setOpenAccordion(`round-${nRound.roundNumber}`);
        updateDoc(doc(db, "ongoingElevador", selectedMatch.id), { rounds: [...rounds, nRound], playerStats: newStats });
    };

    const sortedRanking = useMemo(() => {
        if (!selectedMatch) return [];
        const isPairs = selectedMatch.modality === 'elevadorParejas';
        const stats: Record<string, any> = {};
        const nCourts = selectedMatch.rounds[0]?.courts.length || 0;

        if (isPairs) selectedMatch.fixedPairs.forEach(p => stats[p.id] = { playerId: p.id, name: p.player1.name + ' & ' + p.player2.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, finalCourt: 0, initialCourt: 0 });
        else selectedMatch.selectedPlayers.forEach(p => stats[p.id] = { playerId: p.id, name: p.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, finalCourt: 0, initialCourt: 0 });

        selectedMatch.rounds[0]?.courts.forEach(c => {
             if(isPairs) {
                 const p1Id = [c.match!.team1.player1.id, c.match!.team1.player2.id].sort().join('-');
                 const p2Id = [c.match!.team2.player1.id, c.match!.team2.player2.id].sort().join('-');
                 if(stats[p1Id]) { stats[p1Id].initialCourt = c.courtNumber; stats[p1Id].finalCourt = c.courtNumber; }
                 if(stats[p2Id]) { stats[p2Id].initialCourt = c.courtNumber; stats[p2Id].finalCourt = c.courtNumber; }
             } else {
                 [c.match!.team1.player1.id, c.match!.team1.player2.id, c.match!.team2.player1.id, c.match!.team2.player2.id].forEach(id => {
                     if(stats[id]) { stats[id].initialCourt = c.courtNumber; stats[id].finalCourt = c.courtNumber; }
                 });
             }
        });

        selectedMatch.rounds.forEach((round) => {
            round.courts.forEach(court => {
                const m = court.match; if (!m || m.score1 === null || m.score2 === null) return;
                const t1W = m.score1! > m.score2!;
                const t1Res = t1W ? Math.max(1, court.courtNumber - 1) : Math.min(nCourts, court.courtNumber + 1);
                const t2Res = !t1W ? Math.max(1, court.courtNumber - 1) : Math.min(nCourts, court.courtNumber + 1);
                
                if (isPairs) {
                    const p1Id = [m.team1.player1.id, m.team1.player2.id].sort().join('-');
                    const p2Id = [m.team2.player1.id, m.team2.player2.id].sort().join('-');
                    if (stats[p1Id]) { stats[p1Id].pointsScored += m.score1!; stats[p1Id].finalCourt = t1Res; if (t1W) stats[p1Id].gamesWon++; else stats[p1Id].gamesLost++; }
                    if (stats[p2Id]) { stats[p2Id].pointsScored += m.score2!; stats[p2Id].finalCourt = t2Res; if (!t1W) stats[p2Id].gamesWon++; else stats[p2Id].gamesLost++; }
                } else {
                    [m.team1.player1.id, m.team1.player2.id].forEach(id => { if (stats[id]) { stats[id].pointsScored += m.score1!; stats[id].finalCourt = t1Res; if (t1W) stats[id].gamesWon++; else stats[id].gamesLost++; }});
                    [m.team2.player1.id, m.team2.player2.id].forEach(id => { if (stats[id]) { stats[id].pointsScored += m.score2!; stats[id].finalCourt = t2Res; if (!t1W) stats[id].gamesWon++; else stats[id].gamesLost++; }});
                }
            });
        });

        return Object.values(stats).sort((a: any, b: any) => {
            if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
            if (a.finalCourt !== b.finalCourt) return a.finalCourt - b.finalCourt;
            return b.pointsScored - a.pointsScored;
        });
    }, [selectedMatch]);

    const saveEvent = async () => {
        if (!db || !selectedMatch) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db); const isPairs = selectedMatch.modality === 'elevadorParejas';
            if (isPairs) {
                const results: DailyPairResult[] = sortedRanking.map(r => {
                    const pair = selectedMatch.fixedPairs.find(p => p.id === r.playerId);
                    return { pairId: r.playerId, name: r.name, player1: { id: pair!.player1.id, name: pair!.player1.name }, player2: { id: pair!.player2.id, name: pair!.player2.name }, points: r.pointsScored, g: r.gamesWon, e: 0, p: r.gamesLost };
                });
                const newDoc = doc(collection(db, "dailyPairEvents"));
                batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results, modality: 'elevadorParejas', category });
                for (let i = 0; i < Math.min(results.length, 3); i++) {
                    const field = i === 0 ? 'medals.gold' : i === 1 ? 'medals.silver' : 'medals.bronze';
                    batch.update(doc(db, 'players', results[i].player1.id), { [field]: increment(1) });
                    batch.update(doc(db, 'players', results[i].player2.id), { [field]: increment(1) });
                }
            } else {
                const results: DailyElevadorResult[] = sortedRanking.map(r => ({ playerId: r.playerId, name: r.name, gamesWon: r.gamesWon, gamesLost: r.gamesLost, pointsScored: r.pointsScored, pointsReceived: 0, pointsDifference: r.pointsScored, finalCourt: r.finalCourt }));
                const newDoc = doc(collection(db, "dailyElevadorEvents"));
                batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results, modality: 'elevador', category });
                for (let i = 0; i < Math.min(results.length, 3); i++) {
                    const field = i === 0 ? 'medals.gold' : i === 1 ? 'medals.silver' : 'medals.bronze';
                    batch.update(doc(db, 'players', results[i].playerId), { [field]: increment(1) });
                }
            }
            await batch.commit(); await deleteDoc(doc(db, "ongoingElevador", selectedMatch.id));
            setSelectedMatch(null); setView('list'); toast({ title: "Evento Guardado con Éxito" });
        } catch (e) { toast({title: "Error al guardar", variant: "destructive"}); } finally { setIsSaving(false); }
    };

    if (view === 'loading') return <Card><CardContent className="flex justify-center p-8"><Loader2 className="animate-spin text-primary"/></CardContent></Card>;

    if (view === 'list') return (
        <Card>
            <CardHeader>
                <div className='flex justify-between items-center'>
                    <CardTitle><span className="text-yellow-400">Elevador en Curso</span></CardTitle>
                    {user?.role === 'admin' && <Button onClick={() => setView('setup')} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo</Button>}
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {ongoingMatches.length > 0 ? ongoingMatches.map(m => (
                    <div key={m.id} onClick={() => { setSelectedMatch(m); setView('match'); }} className="p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors flex justify-between items-center">
                        <div><p className="font-bold">{m.eventName}</p><p className="text-xs text-muted-foreground">{m.date} - {m.modality === 'elevadorParejas' ? 'Parejas' : 'Individual'}</p></div>
                        <BarChart className="h-4 w-4 opacity-50" />
                    </div>
                )) : <div className="text-center py-8 text-muted-foreground"><Gamepad2 className="mx-auto h-12 w-12 mb-2" /><p>No hay eventos activos.</p></div>}
            </CardContent>
        </Card>
    );

    if (view === 'match' && selectedMatch) return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={() => setView('list')}><ArrowLeft className="mr-2 h-4 w-4"/> Volver</Button>
                {user?.role === 'admin' && <Button variant="destructive" size="sm" onClick={() => deleteDoc(doc(db!, "ongoingElevador", selectedMatch.id))}><Trash2 className="h-4 w-4"/></Button>}
            </div>
            <Accordion type="single" collapsible value={openAccordion} onValueChange={setOpenAccordion} className="w-full">
                {selectedMatch.rounds.map((round, ri) => (
                    <AccordionItem value={`round-${round.roundNumber}`} key={ri}>
                        <AccordionTrigger className={cn(round.isBonus && "gold-text")}>Ronda {round.roundNumber} {round.isBonus && '(Bonus)'}</AccordionTrigger>
                        <AccordionContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {round.courts.map((court, ci) => (
                                    <Card key={ci} className="bg-slate-900/40 border-slate-800 overflow-hidden">
                                        <div className="bg-primary/10 p-2 text-[10px] font-black text-primary uppercase text-center border-b border-primary/20">Cancha {court.courtNumber}</div>
                                        <CardContent className="p-4">
                                            <div className='flex items-center gap-2'>
                                                <div className='flex-1 flex flex-col items-end gap-1 min-h-[80px] justify-center overflow-hidden'>
                                                    <span className='text-[11px] font-black uppercase text-right leading-tight text-slate-100'>{court.match?.team1.player1.name}</span>
                                                    <span className='text-[11px] font-black uppercase text-right leading-tight text-slate-100'>{court.match?.team1.player2.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Input type="text" pattern="[0-7]*" inputMode="numeric" value={court.match?.score1 ?? ''} onChange={e => handleScoreChange(ri, ci, 'team1', e.target.value)} className="w-10 h-10 text-center text-xl font-black p-0 bg-slate-800 border-primary/30" disabled={user?.role === 'guest'} />
                                                    <span className='font-black text-primary'>-</span>
                                                    <Input type="text" pattern="[0-7]*" inputMode="numeric" value={court.match?.score2 ?? ''} onChange={e => handleScoreChange(ri, ci, 'team2', e.target.value)} className="w-10 h-10 text-center text-xl font-black p-0 bg-slate-800 border-primary/30" disabled={user?.role === 'guest'} />
                                                </div>
                                                <div className='flex-1 flex flex-col items-start gap-1 min-h-[80px] justify-center overflow-hidden'>
                                                    <span className='text-[11px] font-black uppercase leading-tight text-slate-100'>{court.match?.team2.player1.name}</span>
                                                    <span className='text-[11px] font-black uppercase leading-tight text-slate-100'>{court.match?.team2.player2.name}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            {ri === selectedMatch.rounds.length - 1 && selectedMatch.rounds.length < TOTAL_ROUNDS && (
                                <div className="flex justify-end mt-4"><Button onClick={startNextRound} size="sm"><Play className="h-3 w-3 mr-1"/> Siguiente Ronda</Button></div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            <Card>
                <CardHeader><CardTitle className='text-lg'>Clasificación en Vivo</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead className='w-8'>#</TableHead><TableHead>Nombre</TableHead><TableHead className="text-center">G/P</TableHead><TableHead className="text-center">Quedó en</TableHead><TableHead className="text-center">Pts</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {sortedRanking.map((p, i) => (
                                <TableRow key={i} className={cn("h-10", i<3 && 'bg-primary/5 font-bold')}>
                                    <TableCell>{i+1}</TableCell>
                                    <TableCell className='text-[10px] uppercase font-bold'>{p.name}</TableCell>
                                    <TableCell className="text-center text-xs">{p.gamesWon}/{p.gamesLost}</TableCell>
                                    <TableCell className="text-center text-xs">Pista {p.finalCourt || p.initialCourt}</TableCell>
                                    <TableCell className="text-center text-primary text-xs font-bold">{p.pointsScored}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {user?.role === 'admin' && (<div className="flex justify-end mt-6"><Button disabled={isSaving} onClick={saveEvent}><Sparkles className="mr-2 h-4 w-4" /> Finalizar y Guardar</Button></div>)}
                </CardContent>
            </Card>
        </div>
    );

    return (
        <Card>
            <CardHeader><CardTitle><span className="text-yellow-400">Configurar Elevador</span></CardTitle><CardDescription>{category} Cat. (Suma a 7 puntos)</CardDescription></CardHeader>
            <CardContent className="space-y-6">
                {user?.role === 'guest' ? (<Alert><Info className="h-4 w-4" /><AlertTitle>Solo lectura</AlertTitle><AlertDescription>Inicia sesión como Admin.</AlertDescription></Alert>) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                            <div className="space-y-2">
                                <Label>Modalidad</Label>
                                <Select value={modality} onValueChange={(v) => { setModality(v as any); setSelectedPlayers([]); setFixedPairs([]); }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="elevador">Individual</SelectItem><SelectItem value="elevadorParejas">Pareja Fija</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        {modality === 'elevador' ? (
                            <div className="space-y-2">
                                <Label>Jugadores ({selectedPlayers.length}/{numberOfPlayers})</Label>
                                <div className='flex gap-2 mb-2'>
                                    <Select value={numberOfPlayers} onValueChange={setNumberOfPlayers}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="8">8 Jugadores</SelectItem><SelectItem value="12">12 Jugadores</SelectItem><SelectItem value="16">16 Jugadores</SelectItem></SelectContent></Select>
                                    <Popover><PopoverTrigger asChild><Button variant="outline" className="flex-1 justify-start border-primary/20"><Search className="mr-2 h-4 w-4" /> Seleccionar</Button></PopoverTrigger>
                                        <PopoverContent className="w-[320px] p-4 bg-slate-900 border-slate-700">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 border-b border-slate-700 pb-2"><Search className="h-4 w-4" /><Input placeholder="Buscar..." className="h-8 border-none bg-transparent p-0" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
                                                <ScrollArea className="h-[300px]"><div className="space-y-2">{filteredPlayersList.map(p => (<div key={p.id} className="flex items-center space-x-3 p-1 hover:bg-slate-800 rounded cursor-pointer" onClick={() => handlePlayerToggle(p)}><Checkbox id={`p-${p.id}`} checked={selectedPlayers.some(sp => sp.id === p.id)} onCheckedChange={() => handlePlayerToggle(p)}/><Label htmlFor={`p-${p.id}`} className="text-sm font-normal truncate flex-1 uppercase">{p.name}</Label></div>))}</div></ScrollArea>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Label>Parejas ({fixedPairs.length}/{numberOfPairs})</Label>
                                <div className='flex gap-2'>
                                    <Select value={numberOfPairs} onValueChange={setNumberOfPairs}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="4">4</SelectItem><SelectItem value="6">6</SelectItem><SelectItem value="8">8</SelectItem></SelectContent></Select>
                                    <Select value={player1Id || ''} onValueChange={setPlayer1Id}><SelectTrigger><SelectValue placeholder="J1" /></SelectTrigger><SelectContent>{availablePlayersForPairing.filter(p => p.id !== player2Id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                                    <Select value={player2Id || ''} onValueChange={setPlayer2Id}><SelectTrigger><SelectValue placeholder="J2" /></SelectTrigger><SelectContent>{availablePlayersForPairing.filter(p => p.id !== player1Id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                                    <Button onClick={handleAddPair} size="icon"><PlusCircle/></Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{fixedPairs.map(p => (<div key={p.id} className="flex justify-between items-center bg-muted p-2 rounded text-xs uppercase font-bold">{p.player1.name} & {p.player2.name}<Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setFixedPairs(fixedPairs.filter(fp => fp.id !== p.id))}><X className="h-4 w-4"/></Button></div>))}</div>
                            </div>
                        )}
                        <div className="flex justify-end pt-4 border-t"><Button onClick={startElevador} disabled={modality === 'elevador' ? selectedPlayers.length !== parseInt(numberOfPlayers, 10) : fixedPairs.length !== parseInt(numberOfPairs, 10)}><Dices className="mr-2 h-4 w-4" /> Iniciar Elevador</Button></div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default RegistroElevador;
