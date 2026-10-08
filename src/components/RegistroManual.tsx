
"use client";

import { useMemo, useEffect, useState } from 'react';
import { collection, getDocs, doc, writeBatch, getDoc, query, where, addDoc } from 'firebase/firestore';
import type { Player, Modality, DailyResult, DailyPairResult, Pair } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Users, Trophy, Sparkles, Trash2, PlusCircle, User, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Checkbox } from './ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { useCategory } from '@/context/CategoryContext';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useFirebase } from '@/context/FirebaseContext';

const RegistroManual = () => {
  const { db } = useFirebase();
  const { toast } = useToast();
  const { user } = useAuth();
  const { category } = useCategory();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<Record<string, Partial<DailyResult & DailyPairResult>>>(
    {}
  );
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(false);
  const [modality, setModality] = useState<Modality>('6loco');
  
  const [fixedPairs, setFixedPairs] = useState<Pair[]>([]);
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);

  const availablePlayersForPairing = useMemo(() => {
    const pairedPlayerIds = new Set(fixedPairs.flatMap(p => [p.player1.id, p.player2.id]));
    return allPlayers.filter(p => !pairedPlayerIds.has(p.id));
  }, [allPlayers, fixedPairs]);


  useEffect(() => {
    const fetchPlayers = async () => {
      if (!db) return;
      const playersCollection = collection(db, "players");
      const snap = await getDocs(playersCollection);
      const allList = snap.docs.map(doc => ({id: doc.id, ...doc.data()} as Player));
      
      let playersList = [];
      if (category === '4ta') {
          playersList = allList.filter(p => !p.category || p.category?.toLowerCase() === '4ta' || p.category?.toLowerCase().includes('4ta'));
      } else {
          playersList = allList.filter(p => p.category === category);
      }
      setAllPlayers(playersList.sort((a,b) => a.name.localeCompare(b.name)));
    };
    fetchPlayers();
  }, [db, category]);
  
  const resetState = () => {
    setSelectedPlayers([]);
    setFixedPairs([]);
    setResults({});
    setPlayer1(null);
    setPlayer2(null);
    setEventName('');
  }

  const handlePlayerToggle = (player: Player) => {
    setSelectedPlayers(prev => {
      const isSelected = prev.some(p => p.id === player.id);
      if (isSelected) {
        const newResults = {...results};
        delete newResults[player.id];
        setResults(newResults);
        return prev.filter(p => p.id !== player.id);
      } else {
        setResults(prevResults => ({
          ...prevResults,
          [player.id]: { playerId: player.id, name: player.name, points: null, g: null, e: null, p: null }
        }));
        return [...prev, player];
      }
    });
  };

  const handleResultChange = (id: string, field: keyof (DailyResult & DailyPairResult), value: string) => {
    const numValue = parseInt(value, 10);
    setResults(prev => {
        const currentResult = prev[id];
        if (!currentResult) return prev;
        const newResult = { ...currentResult };
        if (value === '') { (newResult as any)[field] = null; }
        else if (!isNaN(numValue)) { (newResult as any)[field] = numValue; }
        return { ...prev, [id]: newResult };
    });
  };

  const handleAddPair = () => {
    if (player1 && player2 && player1.id !== player2.id) {
        const pairId = [player1.id, player2.id].sort().join('-');
        setFixedPairs([...fixedPairs, { player1, player2, id: pairId }]);
        setResults(prev => ({
            ...prev,
            [pairId]: { pairId: pairId, player1: {id: player1.id, name: player1.name}, player2: {id: player2.id, name: player2.name}, name: `${player1.name} & ${player2.name}`, points: null, g: null, e: null, p: null }
        }))
        setPlayer1(null);
        setPlayer2(null);
    }
  };

  const sortedResults = Object.values(results)
    .filter(r => r.playerId || r.pairId)
    .sort((a,b) => (b.points ?? 0) - (a.points ?? 0));

  const saveEvent = async () => {
    if (!db) return;
    setLoading(true);
    try {
        const batch = writeBatch(db);
        const coll = modality === '6loco' ? 'dailyEvents' : 'dailyPairEvents';
        const newDoc = doc(collection(db, coll));
        batch.set(newDoc, { id: newDoc.id, date, name: eventName || "Manual", results: sortedResults, modality, category });
        await batch.commit();
        toast({ title: "Guardado" });
        resetState();
    } catch (e) { toast({ title: "Error", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  if (user?.role === 'guest') return <Alert><Info className="h-4 w-4" /><AlertTitle>Solo Admin</AlertTitle></Alert>;

  return (
    <Card>
      <CardHeader><CardTitle><span className="text-yellow-400">Registro Manual</span></CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Modalidad</Label><Select value={modality} onValueChange={(v) => { setModality(v as any); resetState(); }}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="6loco">Individual</SelectItem><SelectItem value="parejaFija">Pareja Fija</SelectItem></SelectContent></Select></div>
        </div>

        {modality === '6loco' ? (
             <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full">Seleccionar Jugadores ({selectedPlayers.length})</Button></PopoverTrigger><PopoverContent className="w-[300px] p-0"><Command><CommandInput placeholder="Buscar..." /><CommandList><CommandGroup>{allPlayers.map(player => (<CommandItem key={player.id} onSelect={() => handlePlayerToggle(player)}><Checkbox checked={selectedPlayers.some(p => p.id === player.id)} className="mr-2" />{player.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover>
        ) : (
            <div className="flex gap-2"><Select value={player1?.id || ''} onValueChange={id => setPlayer1(allPlayers.find(p => p.id === id) || null)}><SelectTrigger><SelectValue placeholder="J1"/></SelectTrigger><SelectContent>{availablePlayersForPairing.filter(p => p.id !== player2?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select><Select value={player2?.id || ''} onValueChange={id => setPlayer2(allPlayers.find(p => p.id === id) || null)}><SelectTrigger><SelectValue placeholder="J2"/></SelectTrigger><SelectContent>{availablePlayersForPairing.filter(p => p.id !== player1?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select><Button onClick={handleAddPair} size="icon"><PlusCircle/></Button></div>
        )}

        {sortedResults.length > 0 && (
          <div className="mt-6 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nombre</TableHead><TableHead className="text-center w-20">Pts</TableHead><TableHead className="text-center w-20">G/E/P</TableHead></TableRow></TableHeader><TableBody>{sortedResults.map((r, i) => {
            const id = r.playerId! || r.pairId!;
            return (<TableRow key={id}><TableCell>{i + 1}</TableCell><TableCell className="uppercase text-xs font-bold">{r.name}</TableCell><TableCell><Input type="text" value={r.points ?? ''} onChange={e => handleResultChange(id, 'points', e.target.value)} className="h-8 text-center" /></TableCell><TableCell><div className="flex gap-1"><Input value={r.g ?? ''} onChange={e => handleResultChange(id, 'g', e.target.value)} className="h-8 w-8 p-0 text-center"/><Input value={r.e ?? ''} onChange={e => handleResultChange(id, 'e', e.target.value)} className="h-8 w-8 p-0 text-center"/><Input value={r.p ?? ''} onChange={e => handleResultChange(id, 'p', e.target.value)} className="h-8 w-8 p-0 text-center"/></div></TableCell></TableRow>)
          })}</TableBody></Table><div className="flex justify-end mt-6"><Button onClick={saveEvent} disabled={loading}><Sparkles className="mr-2"/>Guardar Evento</Button></div></div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistroManual;
