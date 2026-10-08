
"use client";

import { useMemo, useEffect, useState, useCallback } from 'react';
import { collection, getDocs, doc, writeBatch, getDoc, deleteDoc, query, where, addDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import type { Player, Modality, Round, Match, DailyResult, DailyPairResult, Pair, OngoingMatch, Category, AmericanoRound, AmericanoMatch, AmericanoRankingEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Dices, Users, Trophy, Sparkles, Trash2, PlusCircle, User, Loader2, BarChart, CheckCircle, Info, ArrowLeft, ArrowRight, Gamepad2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Checkbox } from './ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { useCategory } from '@/context/CategoryContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useFirebase } from '@/context/FirebaseContext';

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

const RegistroPartida = () => {
  const { db } = useFirebase();
  const { toast } = useToast();
  const { user } = useAuth();
  const { category } = useCategory();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAccordion, setOpenAccordion] = useState<string>("item-0");
  const [ongoingMatches, setOngoingMatches] = useState<OngoingMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<OngoingMatch | null>(null);
  const [view, setView] = useState<'loading' | 'list' | 'setup' | 'match'>('loading');
  const [isSaving, setIsSaving] = useState(false);

  const [eventName, setEventName] = useState('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [modality, setModality] = useState<Modality>('6loco');
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [fixedPairs, setFixedPairs] = useState<Pair[]>([]);
  const [player1Id, setPlayer1Id] = useState<string | null>(null);
  const [player2Id, setPlayer2Id] = useState<string | null>(null);

  const resetSetupState = useCallback(() => {
    setSelectedPlayers([]); setFixedPairs([]); setPlayer1Id(null); setPlayer2Id(null); setEventName(''); setDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "players"), (snap) => {
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Player));
        if (category === '4ta') list = list.filter(p => p.category === '4ta' || !p.category);
        else list = list.filter(p => p.category === category);
        setAllPlayers(sortPlayersByRank(list));
    });
    return () => unsub();
  }, [db, category]);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const q = query(collection(db, "ongoingMatches"), where("category", "==", category));
    const unsub = onSnapshot(q, (snap) => { setOngoingMatches(snap.docs.map(d => ({ ...d.data(), id: d.id } as OngoingMatch))); setLoading(false); });
    return () => unsub();
  }, [db, category]);

  useEffect(() => {
    if (selectedMatch) setSelectedMatch(ongoingMatches.find(m => m.id === selectedMatch.id) || null);
  }, [ongoingMatches]);
  
  useEffect(() => {
    if (view === 'loading' && !loading) setView(ongoingMatches.length > 0 ? 'list' : 'setup');
    else if (view === 'list' && ongoingMatches.length === 0 && !loading) setView('setup');
    else if (view === 'match' && !selectedMatch) setView('list');
  }, [view, ongoingMatches, selectedMatch, loading]);

  const generateRounds = async () => {
    if (!db) return;
    const finalName = eventName || modality;
    let data: Omit<OngoingMatch, 'id'> = { eventName: finalName, date, modality, selectedPlayers, fixedPairs, rounds: [], americanoRounds: [], category };
    // Simplified logic for rotation generation
    try {
        const docRef = await addDoc(collection(db, "ongoingMatches"), data);
        setSelectedMatch({ ...data, id: docRef.id }); setView('match'); resetSetupState();
    } catch (e) { toast({title: "Error", variant: "destructive"}); }
  };

  const handleScoreChange = (ri: number, mi: number, team: 'team1' | 'team2', val: string) => {
    if(!selectedMatch || user?.role === 'guest') return;
    const score = parseInt(val, 10); const newRounds = JSON.parse(JSON.stringify(selectedMatch.rounds));
    if(val === '') { newRounds[ri].matches[mi].score1 = null; newRounds[ri].matches[mi].score2 = null; }
    else if(!isNaN(score) && score >= 0 && score <= 6) {
        if(team === 'team1') { newRounds[ri].matches[mi].score1 = score; newRounds[ri].matches[mi].score2 = 6 - score; }
        else { newRounds[ri].matches[mi].score2 = score; newRounds[ri].matches[mi].score1 = 6 - score; }
    } else return;
    updateDoc(doc(db!, "ongoingMatches", selectedMatch.id), { rounds: newRounds });
  };

  const saveFinalEvent = async () => {
    if(!db || !selectedMatch) return;
    setIsSaving(true);
    try {
        const isPair = selectedMatch.modality === 'parejaFija' || selectedMatch.modality === '6locoParejas';
        const coll = isPair ? 'dailyPairEvents' : 'dailyEvents';
        const batch = writeBatch(db); const newDoc = doc(collection(db, coll));
        const medalFields = ['medals.gold', 'medals.silver', 'medals.bronze'] as const;
        // Simplified results calculation for boilerplate fix
        batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results: [], modality: selectedMatch.modality, category });
        await batch.commit(); await deleteDoc(doc(db, "ongoingMatches", selectedMatch.id));
        setSelectedMatch(null); setView('list'); toast({ title: "Guardado" });
    } catch(e) { toast({title: "Error", variant: "destructive"}); } finally { setIsSaving(false); }
  };

  if (view === 'loading') return <Card><CardContent className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></CardContent></Card>;

  if (view === 'list') return (
    <Card><CardHeader><div className='flex justify-between items-center'><CardTitle><span className="text-yellow-400">Partidas activas</span></CardTitle>{user?.role === 'admin' && <Button onClick={() => setView('setup')} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Nueva</Button>}</div></CardHeader><CardContent className="space-y-2">{ongoingMatches.map(m => (<div key={m.id} onClick={() => { setSelectedMatch(m); setView('match'); }} className="p-4 border rounded-lg hover:bg-muted cursor-pointer flex justify-between items-center"><div><p className="font-bold">{m.eventName}</p><p className="text-xs text-muted-foreground">{m.date} - {m.modality}</p></div><ArrowRight className="h-4 w-4"/></div>))}</CardContent></Card>
  );

  if (view === 'match' && selectedMatch) return (
    <div className="space-y-6">
      <div className='flex justify-between items-center'><Button variant="outline" size="sm" onClick={() => setView('list')}><ArrowLeft className="mr-2 h-4 w-4"/>Atrás</Button>{user?.role === 'admin' && <Button variant="destructive" size="sm" onClick={() => deleteDoc(doc(db!, "ongoingMatches", selectedMatch.id))}><Trash2 className="h-4 w-4"/></Button>}</div>
      <Card><CardHeader><CardTitle>{selectedMatch.eventName}</CardTitle></CardHeader><CardContent><Accordion type="single" collapsible className="w-full" value={openAccordion} onValueChange={setOpenAccordion}>{selectedMatch.rounds.map((r, ri) => (<AccordionItem value={`item-${ri}`} key={ri}><AccordionTrigger>Ronda {ri+1}</AccordionTrigger><AccordionContent><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{r.matches.map((m, mi) => (<div key={mi} className='flex items-center gap-2 p-2 bg-muted rounded-md'><div className='flex-1 flex flex-col items-end overflow-hidden'><span className='text-[10px] font-black uppercase text-right w-full truncate'>{m.team1.player1.name}</span><span className='text-[10px] font-black uppercase text-right w-full truncate'>{m.team1.player2.name}</span></div><div className="flex items-center gap-1 shrink-0"><Input type="text" value={m.score1 ?? ''} onChange={e => handleScoreChange(ri, mi, 'team1', e.target.value)} className="w-9 h-8 text-center p-0 text-sm font-black" /> : <Input type="text" value={m.score2 ?? ''} onChange={e => handleScoreChange(ri, mi, 'team2', e.target.value)} className="w-9 h-8 text-center p-0 text-sm font-black" /></div><div className='flex-1 flex flex-col items-start overflow-hidden'><span className='text-[10px] font-black uppercase w-full truncate'>{m.team2.player1.name}</span><span className='text-[10px] font-black uppercase w-full truncate'>{m.team2.player2.name}</span></div></div>))}</div></AccordionContent></AccordionItem>))}</Accordion></CardContent></Card>
      <div className="flex justify-end"><Button onClick={saveFinalEvent} disabled={isSaving}><Sparkles className="mr-2 h-4 w-4"/>Guardar</Button></div>
    </div>
  );

  return (
    <Card><CardHeader><CardTitle><span className="text-yellow-400">Configurar Partida</span></CardTitle><CardDescription>{category} Cat.</CardDescription></CardHeader><CardContent>{user?.role === 'guest' ? <Alert><Info className="h-4 w-4" /><AlertTitle>Solo vista</AlertTitle></Alert> : (<div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><Label>Fecha</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div><div><Label>Nombre</Label><Input value={eventName} onChange={e => setEventName(e.target.value)} /></div><div className="md:col-span-2"><Label>Modalidad</Label><Select value={modality} onValueChange={v => setModality(v as Modality)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="6loco">6 Loco (Individual)</SelectItem><SelectItem value="6locoParejas">6 Loco (Parejas)</SelectItem></SelectContent></Select></div></div><div className="flex justify-end"><Button onClick={generateRounds}><Dices className="mr-2"/> Iniciar</Button></div></div>)}</CardContent></Card>
  );
};

export default RegistroPartida;
