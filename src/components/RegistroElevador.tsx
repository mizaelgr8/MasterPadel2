
"use client";
import { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, doc, updateDoc, deleteDoc, query, where, addDoc, onSnapshot, writeBatch, increment, getDocs } from 'firebase/firestore';
import type { Player, ElevadorPlayer, ElevadorCourt, ElevadorRound, ElevadorPlayerStats, ElevadorMatch, OngoingElevador, DailyElevadorResult, Category, Pair, DailyPairResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Users, Dices, Play, Trash2, Loader2, Sparkles, ArrowLeft, BarChart, PlusCircle, Gamepad2, User, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Checkbox } from './ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCategory } from '@/context/CategoryContext';
import { useFirebase } from '@/context/FirebaseContext';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const TOTAL_ROUNDS = 7;

const sortPlayersByRank = (players: Player[]): Player[] => {
    return [...players].sort((a, b) => {
        const val = (v: number | undefined) => v || 0;
        const aAch = a.achievements || { king: 0, shield: 0, sword: 0 };
        const bAch = b.achievements || { king: 0, shield: 0, sword: 0 };
        if (val(bAch.king) !== val(aAch.king)) return bAch.king - aAch.king;
        if (val(bAch.shield) !== val(aAch.shield)) return bAch.shield - aAch.shield;
        if (val(bAch.sword) !== val(aAch.sword)) return bAch.sword - aAch.sword;
        const aMed = a.medals || { gold: 0, silver: 0, bronze: 0 };
        const bMed = b.medals || { gold: 0, silver: 0, bronze: 0 };
        if (val(bMed.gold) !== val(aMed.gold)) return bMed.gold - aMed.gold;
        if (val(bMed.silver) !== val(aMed.silver)) return bMed.silver - aMed.silver;
        if (val(bMed.bronze) !== val(aMed.bronze)) return bMed.bronze - aMed.bronze;
        const avgA = val(a.totalGames) > 0 ? (val(a.totalPoints) / val(a.totalGames)) : 0;
        const avgB = val(b.totalGames) > 0 ? (val(b.totalPoints) / val(b.totalGames)) : 0;
        return avgB - avgA;
    });
};

const RegistroElevador = () => {
    const { db } = useFirebase();
    const { toast } = useToast();
    const { user } = useAuth();
    const { category } = useCategory();
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    
    const [ongoingMatches, setOngoingMatches] = useState<OngoingElevador[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<OngoingElevador | null>(null);
    const [view, setView] = useState<'loading' | 'list' | 'setup' | 'match'>('loading');

    const [modality, setModality] = useState<'elevador' | 'elevadorParejas'>('elevador');
    const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
    const [fixedPairs, setFixedPairs] = useState<Pair[]>([]);
    const [player1, setPlayer1] = useState<Player | null>(null);
    const [player2, setPlayer2] = useState<Player | null>(null);
    const [numberOfPlayers, setNumberOfPlayers] = useState<string>('12');
    const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [eventName, setEventName] = useState('');

    const [openAccordion, setOpenAccordion] = useState<string>("round-1");
    const [isSaving, setIsSaving] = useState(false);
    
    const resetSetupState = useCallback(() => {
        setSelectedPlayers([]);
        setFixedPairs([]);
        setNumberOfPlayers('12');
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setEventName('');
        setPlayer1(null);
        setPlayer2(null);
    }, []);

    useEffect(() => {
        if (!db) return;
        const unsubPlayers = onSnapshot(collection(db, "players"), (snapshot) => {
            let playersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            if (category === '4ta') {
                playersList = playersList.filter(p => p.category === '4ta' || !p.category);
            } else {
                playersList = playersList.filter(p => p.category === category);
            }
            setAllPlayers(playersList.sort((a,b) => a.name.localeCompare(b.name)));
        });
        return () => unsubPlayers();
    }, [db, category]);

    useEffect(() => {
        if (!db) return;
        setLoading(true);
        const q = query(collection(db, "ongoingElevador"));
        const unsubOngoing = onSnapshot(q, (querySnapshot) => {
            const matches = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as OngoingElevador));
            const filtered = matches.filter(m => {
                if (category === '4ta') return m.category === '4ta' || !m.category;
                return m.category === category;
            });
            setOngoingMatches(filtered);
            setLoading(false);
        }, (err) => {
            console.error(err);
            setLoading(false);
        });
        return () => unsubOngoing();
    }, [db, category]);

    useEffect(() => {
        if (selectedMatch) {
            const updatedMatch = ongoingMatches.find(m => m.id === selectedMatch.id);
            if (updatedMatch) {
                setSelectedMatch(updatedMatch);
            } else {
                setSelectedMatch(null);
            }
        }
    }, [ongoingMatches]);

    useEffect(() => {
        if (view === 'loading') setView(ongoingMatches.length > 0 ? 'list' : 'setup');
        else if (view === 'list' && ongoingMatches.length === 0) setView('setup');
        else if (view === 'match' && !selectedMatch) setView('list');
    }, [view, ongoingMatches, selectedMatch]);

    const handlePlayerToggle = (player: Player) => {
        const isSelected = selectedPlayers.some(p => p.id === player.id);
        const maxPlayers = parseInt(numberOfPlayers, 10);
        if (!isSelected && selectedPlayers.length >= maxPlayers) {
            toast({ title: "Límite alcanzado", description: `Solo puedes seleccionar ${maxPlayers} jugadores.`});
            return;
        }
        setSelectedPlayers(prev => isSelected ? prev.filter(p => p.id !== player.id) : [...prev, player]);
    };

    const availablePlayersForPairing = useMemo(() => {
        const pairedPlayerIds = new Set(fixedPairs.flatMap(p => [p.player1.id, p.player2.id]));
        return allPlayers.filter(p => !pairedPlayerIds.has(p.id));
    }, [allPlayers, fixedPairs]);

    const handleAddPair = () => {
        if (player1 && player2 && player1.id !== player2.id) {
            const newPair: Pair = { id: [player1.id, player2.id].sort().join('-'), player1, player2 };
            setFixedPairs(prev => [...prev, newPair]);
            setPlayer1(null); setPlayer2(null);
        } else toast({ title: "Error", description: "Selecciona dos jugadores diferentes.", variant: "destructive" });
    };

    const createMatchForCourt = (players: ElevadorPlayer[]): ElevadorMatch | null => {
        if (players.length !== 4) return null;
        const shuffled = [...players].sort(() => 0.5 - Math.random());
        const combo = { 
          team1: { player1: shuffled[0], player2: shuffled[1] }, 
          team2: { player1: shuffled[2], player2: shuffled[3] } 
        };
        return { ...combo, score1: null, score2: null };
    };

    const startElevador = async () => {
        if (!db) return;
        if (modality === 'elevador' && selectedPlayers.length !== parseInt(numberOfPlayers, 10)) {
            toast({ title: "Error", description: `Selecciona ${numberOfPlayers} jugadores.` });
            return;
        }
        if (modality === 'elevadorParejas' && (fixedPairs.length < 2 || fixedPairs.length % 2 !== 0)) {
            toast({ title: "Error", description: `Se necesita un número par de parejas.` });
            return;
        }
        const initialStats: Record<string, ElevadorPlayerStats> = {};
        const initialCourts: ElevadorCourt[] = [];
        if (modality === 'elevador') {
            const sorted = sortPlayersByRank(selectedPlayers);
            const numCourts = sorted.length / 4;
            for (let i = 0; i < numCourts; i++) {
                const cp = sorted.slice(i * 4, (i * 4) + 4).map(p => ({ ...p, court: i + 1 }));
                initialCourts.push({ courtNumber: i + 1, players: cp, match: createMatchForCourt(cp) });
            }
            selectedPlayers.forEach(p => {
                const c = initialCourts.find(ct => ct.players.some(cp => cp.id === p.id));
                initialStats[p.id] = { playerId: p.id, name: p.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0, courtHistory: [c?.courtNumber || 0], finalCourt: c?.courtNumber || 0 };
            });
        } else {
            const numCourts = fixedPairs.length / 2;
            for (let i = 0; i < numCourts; i++) {
                const p1 = fixedPairs[i * 2]; const p2 = fixedPairs[i * 2 + 1];
                const cp = [{ ...p1.player1, court: i + 1 }, { ...p1.player2, court: i + 1 }, { ...p2.player1, court: i + 1 }, { ...p2.player2, court: i + 1 }];
                initialCourts.push({ courtNumber: i + 1, players: cp, match: { team1: { player1: cp[0] as any, player2: cp[1] as any }, team2: { player1: cp[2] as any, player2: cp[3] as any }, score1: null, score2: null } });
            }
            fixedPairs.forEach(pair => [pair.player1, pair.player2].forEach(p => {
                const c = initialCourts.find(ct => ct.players.some(cp => cp.id === p.id));
                initialStats[p.id] = { playerId: p.id, name: p.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0, courtHistory: [c?.courtNumber || 0], finalCourt: c?.courtNumber || 0 };
            }));
        }
        const newMatchData: Omit<OngoingElevador, 'id'> = { 
            eventName: eventName || "Elevador", 
            modality, 
            date, 
            numberOfPlayers: modality === 'elevador' ? numberOfPlayers : (fixedPairs.length * 2).toString(), 
            selectedPlayers: modality === 'elevador' ? selectedPlayers : [], 
            fixedPairs: modality === 'elevadorParejas' ? fixedPairs : [], 
            rounds: [{ roundNumber: 1, courts: initialCourts }], 
            stage: 'playing', 
            playerStats: initialStats, 
            category 
        };
        try {
            const docRef = await addDoc(collection(db, "ongoingElevador"), newMatchData);
            setSelectedMatch({ ...newMatchData, id: docRef.id }); setView('match'); setOpenAccordion("round-1"); resetSetupState();
        } catch (e) { toast({title: "Error", variant: "destructive"}); }
    };
    
    const handleScoreChange = (ri: number, ci: number, team: 'team1' | 'team2', value: string) => {
        if (!selectedMatch || user?.role === 'guest') return;
        const score = parseInt(value, 10);
        const newRounds = JSON.parse(JSON.stringify(selectedMatch.rounds));
        const match = newRounds[ri].courts[ci].match;
        if (!match) return;
        const finalScore = isNaN(score) ? null : score;
        if (team === 'team1') { 
            match.score1 = finalScore; 
            if(finalScore !== null) match.score2 = 6 - finalScore; else match.score2 = null; 
        } else { 
            match.score2 = finalScore; 
            if(finalScore !== null) match.score1 = 6 - finalScore; else match.score1 = null; 
        }
        updateDoc(doc(db!, "ongoingElevador", selectedMatch.id), { rounds: newRounds });
    };
    
    const startNextRound = () => {
        if (!selectedMatch) return;
        const { rounds, playerStats, modality, numberOfPlayers: numPlayersStr } = selectedMatch;
        const lastRound = rounds[rounds.length - 1];
        if (!lastRound.courts.every(c => c.match && c.match.score1 !== null)) { toast({ title: "Incompleto", description: "Anota todos los marcadores." }); return; }
        const newStats = JSON.parse(JSON.stringify(playerStats));
        lastRound.courts.forEach(court => {
            const m = court.match!; const t1Won = m.score1! > m.score2!;
            [m.team1.player1, m.team1.player2].forEach(p => { 
                newStats[p.id].gamesWon += t1Won ? 1 : 0; 
                newStats[p.id].gamesLost += t1Won ? 0 : 1; 
                newStats[p.id].pointsScored += m.score1!; 
                newStats[p.id].pointsReceived += m.score2!; 
            });
            [m.team2.player1, m.team2.player2].forEach(p => { 
                newStats[p.id].gamesWon += t1Won ? 0 : 1; 
                newStats[p.id].gamesLost += t1Won ? 1 : 0; 
                newStats[p.id].pointsScored += m.score2!; 
                newStats[p.id].pointsReceived += m.score1!; 
            });
        });
        const numCourts = parseInt(numPlayersStr, 10) / 4;
        const nextCourtPlayers: Record<number, ElevadorPlayer[]> = {};
        for(let i=1; i<=numCourts; i++) nextCourtPlayers[i] = [];
        lastRound.courts.forEach(c => {
            const m = c.match!; const t1W = m.score1! > m.score2!;
            const winners = t1W ? [m.team1.player1, m.team1.player2] : [m.team2.player1, m.team2.player2];
            const losers = t1W ? [m.team2.player1, m.team2.player2] : [m.team1.player1, m.team1.player2];
            if (c.courtNumber === 1) { nextCourtPlayers[1].push(...winners); nextCourtPlayers[2].push(...losers); }
            else if (c.courtNumber === numCourts) { winners.forEach(p => nextCourtPlayers[c.courtNumber - 1].push(p)); nextCourtPlayers[c.courtNumber].push(...losers); }
            else { winners.forEach(p => nextCourtPlayers[c.courtNumber - 1].push(p)); losers.forEach(p => nextCourtPlayers[c.courtNumber + 1].push(p)); }
        });
        const newCourts: ElevadorCourt[] = [];
        for (let i = 1; i <= numCourts; i++) {
            const cp = nextCourtPlayers[i].map(p => ({...p, court: i}));
            cp.forEach(p => { if(newStats[p.id]) newStats[p.id].finalCourt = i; });
            const match = modality === 'elevador' ? createMatchForCourt(cp as any) : { team1: { player1: cp[0], player2: cp[1] }, team2: { player1: cp[2], player2: cp[3] }, score1: null, score2: null };
            newCourts.push({ courtNumber: i, players: cp as any, match: match as any });
        }
        const nextRoundNum = lastRound.roundNumber + 1;
        const newRound = { roundNumber: nextRoundNum, courts: newCourts, isBonus: nextRoundNum === TOTAL_ROUNDS };
        setOpenAccordion(`round-${nextRoundNum}`);
        updateDoc(doc(db!, "ongoingElevador", selectedMatch.id), { rounds: [...rounds, newRound], playerStats: newStats });
    };

    const sortedRanking = useMemo(() => {
        if (!selectedMatch) return [];
        const stats: Record<string, any> = {};
        const active = selectedMatch.modality === 'elevador' ? selectedMatch.selectedPlayers : selectedMatch.fixedPairs.flatMap(p => [p.player1, p.player2]);
        active.forEach(p => { 
            const ps = selectedMatch.playerStats[p.id] || { gamesWon:0, pointsScored:0, pointsReceived:0, finalCourt:0 }; 
            stats[p.id] = { ...ps, playerId: p.id, name: p.name, player1: p, player2: p }; 
        });
        if (selectedMatch.modality === 'elevador') return Object.values(stats).sort((a,b) => b.gamesWon - a.gamesWon || (b.pointsScored-b.pointsReceived) - (a.pointsScored-a.pointsReceived) || a.finalCourt - b.finalCourt);
        const res: any[] = []; selectedMatch.fixedPairs.forEach(p => res.push({ ...stats[p.player1.id], pairId: p.id, name: p.player1.name + ' & ' + p.player2.name, player1: p.player1, player2: p.player2 }));
        return res.sort((a,b) => b.gamesWon - a.gamesWon || (b.pointsScored-b.pointsReceived) - (a.pointsScored-a.pointsReceived) || a.finalCourt - b.finalCourt);
    }, [selectedMatch]);

    const saveEvent = async () => {
        if (!db || !selectedMatch) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db); 
            if (selectedMatch.modality === 'elevador') {
                const results: DailyElevadorResult[] = sortedRanking.map(p => ({ playerId: p.playerId, name: p.name, gamesWon: p.gamesWon, gamesLost: p.gamesLost, pointsScored: p.pointsScored, pointsReceived: p.pointsReceived, pointsDifference: p.pointsScored - p.pointsReceived, finalCourt: p.finalCourt }));
                const newDoc = doc(collection(db, "dailyElevadorEvents"));
                batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results, modality: 'elevador', category });
                for (let i = 0; i < Math.min(results.length, 3); i++) {
                  const pRef = doc(db, 'players', results[i].playerId);
                  const field = i === 0 ? 'medals.gold' : i === 1 ? 'medals.silver' : 'medals.bronze';
                  batch.update(pRef, { [field]: increment(1) });
                }
            } else {
                const results: DailyPairResult[] = sortedRanking.map(p => ({ pairId: p.pairId, player1: p.player1, player2: p.player2, points: p.pointsScored, g: p.gamesWon, p: p.gamesLost, e: 0 }));
                const newDoc = doc(collection(db, "dailyPairEvents"));
                batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results, modality: 'elevadorParejas', category });
                for (let i = 0; i < Math.min(results.length, 3); i++) {
                  const res = results[i];
                  const field = i === 0 ? 'medals.gold' : i === 1 ? 'medals.silver' : 'medals.bronze';
                  [res.player1.id, res.player2.id].forEach(pid => batch.update(doc(db, 'players', pid), { [field]: increment(1) }));
                }
            }
            await batch.commit(); await deleteDoc(doc(db, "ongoingElevador", selectedMatch.id));
            setSelectedMatch(null); setView('list'); toast({ title: "Evento Guardado" });
        } catch (e) { toast({ title: "Error", variant: "destructive" }); } finally { setIsSaving(false); }
    };

    if (view === 'loading') return <Card><CardContent className="flex items-center justify-center p-8"><Loader2 className="animate-spin" /></CardContent></Card>;

    if (view === 'list') return (
        <Card>
            <CardHeader><div className='flex justify-between items-center'><CardTitle><span className="text-yellow-400">Elevador en Curso</span></CardTitle>{user?.role === 'admin' && <Button onClick={() => setView('setup')} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo</Button>}</div></CardHeader>
            <CardContent className="space-y-2">
                {ongoingMatches.length > 0 ? ongoingMatches.map(m => (
                    <div key={m.id} onClick={() => { setSelectedMatch(m); setView('match'); }} className="p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors flex justify-between items-center">
                        <div><p className="font-semibold">{m.eventName || 'Elevador'}</p><p className="text-xs text-muted-foreground">{m.date} - {m.modality}</p></div>
                        <BarChart className="h-4 w-4 opacity-50" />
                    </div>
                )) : <div className="text-center py-8 text-muted-foreground"><Gamepad2 className="mx-auto h-12 w-12 mb-2" /><p>No hay eventos activos.</p></div>}
            </CardContent>
        </Card>
    );

    if (view === 'match' && selectedMatch) return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><Button variant="outline" size="sm" onClick={() => setView('list')}><ArrowLeft className="mr-2 h-4 w-4"/> Volver</Button>{user?.role === 'admin' && <Button variant="destructive" size="sm" onClick={() => deleteDoc(doc(db!, "ongoingElevador", selectedMatch.id))}><Trash2 className="h-4 w-4"/></Button>}</div>
            <Accordion type="single" collapsible value={openAccordion} onValueChange={setOpenAccordion} className="w-full">
                {selectedMatch.rounds.map((round, ri) => (
                    <AccordionItem value={`round-${round.roundNumber}`} key={ri}>
                        <AccordionTrigger className={cn(round.isBonus && "gold-text")}>Ronda {round.roundNumber} {round.isBonus && '(Bonus)'}</AccordionTrigger>
                        <AccordionContent><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {round.courts.map((court, ci) => (
                                <Card key={ci} className="bg-slate-900/40 border-slate-800 overflow-hidden">
                                    <div className="bg-primary/10 p-2 text-[10px] font-black text-primary uppercase text-center border-b border-primary/20">Cancha {court.courtNumber}</div>
                                    <CardContent className="p-3">
                                        {court.match ? (
                                             <div className='flex items-center gap-2'>
                                                <div className='flex-1 flex flex-col items-end gap-1 overflow-hidden shrink-0'>
                                                    <span className='text-[10px] font-black uppercase text-right leading-tight w-full'>{court.match.team1.player1.name}</span>
                                                    <span className='text-[10px] font-black uppercase text-right leading-tight w-full'>{court.match.team1.player2.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 px-1">
                                                    <Input type="text" pattern="[0-6]*" inputMode="numeric" value={court.match.score1 ?? ''} onChange={e => handleScoreChange(ri, ci, 'team1', e.target.value)} className="w-9 h-9 text-center text-lg font-black p-0 bg-slate-800" disabled={user?.role === 'guest'} />
                                                    <span className='font-black text-primary'>:</span>
                                                    <Input type="text" pattern="[0-6]*" inputMode="numeric" value={court.match.score2 ?? ''} onChange={e => handleScoreChange(ri, ci, 'team2', e.target.value)} className="w-9 h-9 text-center text-lg font-black p-0 bg-slate-800" disabled={user?.role === 'guest'} />
                                                </div>
                                                <div className='flex-1 flex flex-col items-start gap-1 overflow-hidden shrink-0'>
                                                    <span className='text-[10px] font-black uppercase leading-tight w-full'>{court.match.team2.player1.name}</span>
                                                    <span className='text-[10px] font-black uppercase leading-tight w-full'>{court.match.team2.player2.name}</span>
                                                </div>
                                            </div>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>{ri === selectedMatch.rounds.length - 1 && selectedMatch.rounds.length < TOTAL_ROUNDS && <div className="flex justify-end mt-4"><Button onClick={startNextRound} size="sm"><Play className="h-3 w-3 mr-1"/> Siguiente</Button></div>}</AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            <Card><CardHeader><CardTitle className='text-lg'>Clasificación</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead className='w-8'>#</TableHead><TableHead>Nombre</TableHead><TableHead className="text-center">G</TableHead><TableHead className="text-center">Pts.</TableHead></TableRow></TableHeader><TableBody>{sortedRanking.map((p, i) => (<TableRow key={i} className={cn("h-10", i<3 && 'bg-primary/5 font-bold')}><TableCell>{i+1}</TableCell><TableCell className='max-w-[150px] truncate text-xs uppercase'>{p.name}</TableCell><TableCell className="text-center text-xs">{p.gamesWon}</TableCell><TableCell className="text-center text-primary text-xs font-bold">{p.pointsScored}</TableCell></TableRow>))}</TableBody></Table>{user?.role === 'admin' && <div className="flex justify-end mt-6"><Button disabled={isSaving} onClick={saveEvent}><Sparkles className="mr-2 h-4 w-4" /> {isSaving ? 'Guardando...' : 'Finalizar'}</Button></div>}</CardContent></Card>
        </div>
    );

    return (
        <Card><CardHeader><CardTitle><span className="text-yellow-400">Configurar Elevador</span></CardTitle><CardDescription>{category} Cat.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            {user?.role === 'guest' ? <Alert><Info className="h-4 w-4" /><AlertTitle>Solo lectura</AlertTitle><AlertDescription>Inicia sesión como Admin para crear eventos.</AlertDescription></Alert> : (
                <><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Modalidad</Label><Select value={modality} onValueChange={(v) => { setModality(v as any); resetSetupState(); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="elevador">Individual</SelectItem><SelectItem value="elevadorParejas">Parejas Fijas</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                    {modality === 'elevador' && <div className="space-y-2"><Label>Jugadores</Label><Select value={numberOfPlayers} onValueChange={setNumberOfPlayers}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="8">8 Jugadores</SelectItem><SelectItem value="12">12 Jugadores</SelectItem><SelectItem value="16">16 Jugadores</SelectItem></SelectContent></Select></div>}
                </div>{modality === 'elevador' ? (
                    <div className="space-y-2"><Label>Seleccionar ({selectedPlayers.length}/{numberOfPlayers})</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><Users className="mr-2 h-4 w-4" /> Jugadores</Button></PopoverTrigger><PopoverContent className="w-[300px] p-0"><Command><CommandInput placeholder="Buscar..." /><CommandList><CommandGroup>{allPlayers.map(p => (<CommandItem key={p.id} onSelect={() => handlePlayerToggle(p)}><Checkbox checked={selectedPlayers.some(sp => sp.id === p.id)} className="mr-2" /> {p.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
                ) : (
                    <div className="space-y-4"><Label>Parejas ({fixedPairs.length})</Label><div className="flex gap-2"><Select value={player1?.id || ''} onValueChange={id => setPlayer1(allPlayers.find(p => p.id === id) || null)}><SelectTrigger><SelectValue placeholder="J1" /></SelectTrigger><SelectContent>{availablePlayersForPairing.filter(p => p.id !== player2?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select><Select value={player2?.id || ''} onValueChange={id => setPlayer2(allPlayers.find(p => p.id === id) || null)}><SelectTrigger><SelectValue placeholder="J2" /></SelectTrigger><SelectContent>{availablePlayersForPairing.filter(p => p.id !== player1?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select><Button onClick={handleAddPair} size="icon"><PlusCircle className="h-4 w-4"/></Button></div><div className="border rounded-md p-2 space-y-1">{fixedPairs.map(p => (<div key={p.id} className="flex justify-between bg-muted p-2 rounded text-[10px] uppercase font-bold">{p.player1.name} & {p.player2.name}<Button variant="ghost" size="icon" onClick={() => setFixedPairs(fixedPairs.filter(f => f.id !== p.id))}><Trash2 className="h-3 w-3"/></Button></div>))}</div></div>
                )}<div className="flex justify-end"><Button onClick={startElevador} disabled={modality === 'elevador' ? selectedPlayers.length !== parseInt(numberOfPlayers, 10) : fixedPairs.length < 2}><Dices className="mr-2 h-4 w-4" /> Empezar</Button></div></>
            )}</CardContent>
        </Card>
    );
};

export default RegistroElevador;
