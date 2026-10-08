
"use client";
import { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, doc, updateDoc, deleteDoc, query, where, addDoc, onSnapshot, writeBatch, increment } from 'firebase/firestore';
import type { Player, ElevadorPlayer, ElevadorCourt, OngoingElevador, DailyElevadorResult, Category, Pair, ElevadorPlayerStats } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dices, Play, Trash2, Loader2, Sparkles, ArrowLeft, BarChart, PlusCircle, Gamepad2, Info, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Checkbox } from './ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCategory } from '@/context/CategoryContext';
import { useFirebase } from '@/context/FirebaseContext';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

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
    const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
    const [numberOfPlayers, setNumberOfPlayers] = useState<string>('12');
    const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [eventName, setEventName] = useState('');
    const [openAccordion, setOpenAccordion] = useState<string>("round-1");
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

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

    const startElevador = async () => {
        if (!db) return;
        const initialStats: Record<string, ElevadorPlayerStats> = {};
        const initialCourts: ElevadorCourt[] = [];
        
        const shuffled = [...selectedPlayers].sort(() => 0.5 - Math.random());
        for (let i = 0; i < shuffled.length / 4; i++) {
            const courtPlayers = shuffled.slice(i * 4, (i * 4) + 4).map(p => ({ ...p, court: i + 1 }));
            initialCourts.push({ 
                courtNumber: i + 1, 
                players: courtPlayers as any, 
                match: { 
                    team1: { player1: courtPlayers[0] as any, player2: courtPlayers[1] as any }, 
                    team2: { player1: courtPlayers[2] as any, player2: courtPlayers[3] as any }, 
                    score1: null, score2: null 
                }
            });
            courtPlayers.forEach(p => {
                initialStats[p.id] = { playerId: p.id, name: p.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0, courtHistory: [i + 1], finalCourt: i + 1 };
            });
        }

        const newMatchData: Omit<OngoingElevador, 'id'> = { 
            eventName: eventName || "Elevador Individual", modality: 'elevador', date, numberOfPlayers, 
            selectedPlayers, fixedPairs: [], 
            rounds: [{ roundNumber: 1, courts: initialCourts }], stage: 'playing', playerStats: initialStats, category 
        };
        try {
            const docRef = await addDoc(collection(db, "ongoingElevador"), newMatchData);
            setSelectedMatch({ ...newMatchData, id: docRef.id }); setView('match'); setOpenAccordion("round-1");
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
        const { rounds, playerStats, numberOfPlayers: numStr } = selectedMatch;
        const last = rounds[rounds.length - 1];
        if (!last.courts.every(c => c.match && c.match.score1 !== null)) return;

        const newStats = JSON.parse(JSON.stringify(playerStats));
        last.courts.forEach(c => {
            const m = c.match!;
            [m.team1.player1, m.team1.player2].forEach(p => { newStats[p.id].pointsScored += m.score1!; newStats[p.id].pointsReceived += m.score2!; });
            [m.team2.player1, m.team2.player2].forEach(p => { newStats[p.id].pointsScored += m.score2!; newStats[p.id].pointsReceived += m.score1!; });
        });

        const nCourts = parseInt(numStr, 10) / 4;
        const nextMap: Record<number, any[]> = {};
        for(let i=1; i<=nCourts; i++) nextMap[i] = [];
        
        last.courts.forEach(c => {
            const m = c.match!; const t1W = m.score1! > m.score2!;
            const winners = t1W ? [m.team1.player1, m.team1.player2] : [m.team2.player1, m.team2.player2];
            const losers = t1W ? [m.team2.player1, m.team2.player2] : [m.team1.player1, m.team1.player2];
            if (c.courtNumber === 1) { nextMap[1].push(...winners); nextMap[2].push(...losers); }
            else if (c.courtNumber === nCourts) { nextMap[c.courtNumber-1].push(...winners); nextMap[c.courtNumber].push(...losers); }
            else { nextMap[c.courtNumber-1].push(...winners); nextMap[c.courtNumber+1].push(...losers); }
        });

        const newCourts: ElevadorCourt[] = [];
        for (let i = 1; i <= nCourts; i++) {
            const courtPlayers = nextMap[i].map(p => ({...p, court: i}));
            courtPlayers.forEach(p => newStats[p.id].finalCourt = i);
            const r = [...courtPlayers].sort(() => 0.5 - Math.random());
            newCourts.push({ courtNumber: i, players: courtPlayers as any, match: { team1:{player1:r[0], player2:r[1]}, team2:{player1:r[2], player2:r[3]}, score1:null, score2:null } });
        }
        const nRound = { roundNumber: rounds.length + 1, courts: newCourts, isBonus: rounds.length + 1 === TOTAL_ROUNDS };
        setOpenAccordion(`round-${nRound.roundNumber}`);
        updateDoc(doc(db, "ongoingElevador", selectedMatch.id), { rounds: [...rounds, nRound], playerStats: newStats });
    };

    const sortedRanking = useMemo(() => {
        if (!selectedMatch) return [];
        return Object.values(selectedMatch.playerStats).sort((a,b) => (a.finalCourt - b.finalCourt) || (b.pointsScored - a.pointsScored));
    }, [selectedMatch]);

    const saveEvent = async () => {
        if (!db || !selectedMatch) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            const results: DailyElevadorResult[] = sortedRanking.map(r => ({ 
                playerId: r.playerId, name: r.name, gamesWon: r.gamesWon, gamesLost: r.gamesLost, pointsScored: r.pointsScored, pointsReceived: r.pointsReceived, pointsDifference: r.pointsScored - r.pointsReceived, finalCourt: r.finalCourt 
            }));
            const newDoc = doc(collection(db, "dailyElevadorEvents"));
            batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results, modality: 'elevador', category });
            for (let i = 0; i < Math.min(results.length, 3); i++) {
                const pRef = doc(db, 'players', results[i].playerId);
                const field = i === 0 ? 'medals.gold' : i === 1 ? 'medals.silver' : 'medals.bronze';
                batch.update(pRef, { [field]: increment(1) });
            }
            await batch.commit(); 
            await deleteDoc(doc(db, "ongoingElevador", selectedMatch.id));
            setSelectedMatch(null); setView('list');
            toast({ title: "Evento Guardado con Éxito" });
        } catch (e) { toast({title: "Error al guardar", variant: "destructive"}); } finally { setIsSaving(false); }
    };

    if (view === 'loading') return <Card><CardContent className="flex justify-center p-8"><Loader2 className="animate-spin"/></CardContent></Card>;

    if (view === 'list') return (
        <Card><CardHeader><div className='flex justify-between items-center'><CardTitle><span className="text-yellow-400">Elevador en Curso</span></CardTitle>{user?.role === 'admin' && <Button onClick={() => setView('setup')} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Nuevo</Button>}</div></CardHeader><CardContent className="space-y-2">{ongoingMatches.length > 0 ? ongoingMatches.map(m => (<div key={m.id} onClick={() => { setSelectedMatch(m); setView('match'); }} className="p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors flex justify-between items-center"><div><p className="font-bold">{m.eventName}</p><p className="text-xs text-muted-foreground">{m.date}</p></div><BarChart className="h-4 w-4 opacity-50" /></div>)) : <div className="text-center py-8 text-muted-foreground"><Gamepad2 className="mx-auto h-12 w-12 mb-2" /><p>No hay eventos activos para esta categoría.</p></div>}</CardContent></Card>
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
                                    <CardContent className="p-4">
                                        <div className='flex items-center gap-2'>
                                            <div className='flex-1 flex flex-col items-end gap-1 min-h-[80px] justify-center overflow-hidden'>
                                                <span className='text-[12px] font-black uppercase text-right leading-none text-slate-100'>{court.match?.team1.player1.name}</span>
                                                <span className='text-[12px] font-black uppercase text-right leading-none text-slate-100'>{court.match?.team1.player2.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 px-1">
                                                <Input type="text" pattern="[0-7]*" inputMode="numeric" value={court.match?.score1 ?? ''} onChange={e => handleScoreChange(ri, ci, 'team1', e.target.value)} className="w-10 h-10 text-center text-xl font-black p-0 bg-slate-800 border-primary/30" disabled={user?.role === 'guest'} />
                                                <span className='font-black text-primary'>-</span>
                                                <Input type="text" pattern="[0-7]*" inputMode="numeric" value={court.match?.score2 ?? ''} onChange={e => handleScoreChange(ri, ci, 'team2', e.target.value)} className="w-10 h-10 text-center text-xl font-black p-0 bg-slate-800 border-primary/30" disabled={user?.role === 'guest'} />
                                            </div>
                                            <div className='flex-1 flex flex-col items-start gap-1 min-h-[80px] justify-center overflow-hidden'>
                                                <span className='text-[12px] font-black uppercase leading-none text-slate-100'>{court.match?.team2.player1.name}</span>
                                                <span className='text-[12px] font-black uppercase leading-none text-slate-100'>{court.match?.team2.player2.name}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>{ri === selectedMatch.rounds.length - 1 && selectedMatch.rounds.length < TOTAL_ROUNDS && <div className="flex justify-end mt-4"><Button onClick={startNextRound} size="sm"><Play className="h-3 w-3 mr-1"/> Siguiente Ronda</Button></div>}</AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            <Card><CardHeader><CardTitle className='text-lg'>Clasificación en Vivo</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead className='w-8'>#</TableHead><TableHead>Nombre</TableHead><TableHead className="text-center">Cancha</TableHead><TableHead className="text-center">Pts</TableHead></TableRow></TableHeader><TableBody>{sortedRanking.map((p, i) => (<TableRow key={i} className={cn("h-10", i<3 && 'bg-primary/5 font-bold')}><TableCell>{i+1}</TableCell><TableCell className='text-[11px] uppercase font-bold'>{p.name}</TableCell><TableCell className="text-center text-xs">{p.finalCourt}</TableCell><TableCell className="text-center text-primary text-xs font-bold">{p.pointsScored}</TableCell></TableRow>))}</TableBody></Table>{user?.role === 'admin' && <div className="flex justify-end mt-6"><Button disabled={isSaving} onClick={saveEvent}><Sparkles className="mr-2 h-4 w-4" /> Finalizar y Guardar</Button></div>}</CardContent></Card>
        </div>
    );

    return (
        <Card><CardHeader><CardTitle><span className="text-yellow-400">Configurar Elevador</span></CardTitle><CardDescription>{category} Cat.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            {user?.role === 'guest' ? <Alert><Info className="h-4 w-4" /><AlertTitle>Solo lectura</AlertTitle><AlertDescription>Inicia sesión como Admin para crear eventos.</AlertDescription></Alert> : (
                <><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Jugadores</Label><Select value={numberOfPlayers} onValueChange={setNumberOfPlayers}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="8">8 Jugadores</SelectItem><SelectItem value="12">12 Jugadores</SelectItem><SelectItem value="16">16 Jugadores</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-2"><Label>Seleccionar ({selectedPlayers.length}/{numberOfPlayers})</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><Users className="mr-2 h-4 w-4" /> Jugadores</Button></PopoverTrigger><PopoverContent className="w-[300px] p-0"><Command><CommandInput placeholder="Buscar..." /><CommandList><CommandEmpty>No se encontró ningún jugador.</CommandEmpty><CommandGroup>{allPlayers.map(p => (<CommandItem key={p.id} onSelect={() => handlePlayerToggle(p)}><Checkbox checked={selectedPlayers.some(sp => sp.id === p.id)} className="mr-2" /> {p.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
                <div className="flex justify-end"><Button onClick={startElevador} disabled={selectedPlayers.length !== parseInt(numberOfPlayers, 10)}><Dices className="mr-2 h-4 w-4" /> Empezar</Button></div></>
            )}</CardContent>
        </Card>
    );
};

export default RegistroElevador;
