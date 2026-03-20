
"use client";

import { useMemo, useEffect, useState } from 'react';
import { collection, getDocs, doc, writeBatch, getDoc, query, where, addDoc } from 'firebase/firestore';
import type { Player, Modality, DailyResult, DailyPairResult, Pair, Category } from '@/types';
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
      let playersList: Player[] = [];
        
      if (category === '4ta') {
          const modernQuery = query(playersCollection, where("category", "==", '4ta'));
          const legacyQuery = query(playersCollection, where("category", "==", null));
          const [modernSnapshot, legacySnapshot] = await Promise.all([getDocs(modernQuery), getDocs(legacyQuery)]);
          const modernPlayers = modernSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Player));
          const legacyPlayers = legacySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Player));
          
          const combined = new Map<string, Player>();
          [...modernPlayers, ...legacyPlayers].forEach(p => combined.set(p.id, p));
          playersList = Array.from(combined.values());
      } else {
          const q = query(playersCollection, where("category", "==", category));
          const snapshot = await getDocs(q);
          playersList = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Player));
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
        if (value === '') {
            (newResult as any)[field] = null;
        } else if (!isNaN(numValue)) {
            (newResult as any)[field] = numValue;
        }

        return {
            ...prev,
            [id]: newResult
        };
    });
  };

  const handleAddPair = () => {
    if (player1 && player2 && player1.id !== player2.id) {
        const newPair = { player1, player2 };
        const pairId = [player1.id, player2.id].sort().join('-');
        setFixedPairs([...fixedPairs, newPair]);
        setResults(prev => ({
            ...prev,
            [pairId]: { 
                pairId: pairId,
                player1: {id: player1.id, name: player1.name},
                player2: {id: player2.id, name: player2.name},
                name: `${player1.name} & ${player2.name}`,
                points: null, g: null, e: null, p: null
            }
        }))
        setPlayer1(null);
        setPlayer2(null);
    } else {
        toast({ title: "Error", description: "Selecciona dos jugadores diferentes para formar una pareja.", variant: "destructive" });
    }
  };

  const handleRemovePair = (index: number) => {
    const pairToRemove = fixedPairs[index];
    const pairId = [pairToRemove.player1.id, pairToRemove.player2.id].sort().join('-');
    
    setFixedPairs(fixedPairs.filter((_, i) => i !== index));
    const newResults = {...results};
    delete newResults[pairId];
    setResults(newResults);
  };
  
  const getPodiumIcon = (index: number) => {
    if (modality === 'parejaFija') {
        if (index < 1) return <Trophy className="text-yellow-400" />;
        if (index < 2) return <Trophy className="text-gray-400" />;
        if (index < 3) return <Trophy className="text-orange-400" />;
    } else {
        if (index === 0) return <Trophy className="text-yellow-400" />;
        if (index === 1) return <Trophy className="text-gray-400" />;
        if (index === 2) return <Trophy className="text-orange-400" />;
    }
    return null;
  }

  const sortedResults = Object.values(results)
    .filter(r => r.playerId || r.pairId)
    .sort((a,b) => (b.points ?? 0) - (a.points ?? 0));

  const saveEvent = async () => {
    if (!db) return;
    setLoading(true);
    
    const isDataComplete = sortedResults.every(r => r.points !== null && r.points !== undefined && r.g !== null && r.g !== undefined && r.e !== null && r.e !== undefined && r.p !== null && r.p !== undefined);
    
    if (sortedResults.length === 0 || !isDataComplete) {
      toast({ title: "Error", description: "Completa todos los campos para todos los jugadores/parejas antes de guardar.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const finalEventName = eventName || "Evento Manual";

    try {
        const collectionName = modality === '6loco' ? 'dailyEvents' : 'dailyPairEvents';
        const collRef = collection(db, collectionName);
        
        const q = query(collRef, 
            where("date", "==", date), 
            where("category", "==", category),
            where("name", "==", finalEventName)
        );
        const existingEventSnapshot = await getDocs(q);
        if (!existingEventSnapshot.empty) {
            toast({ title: "Error", description: `Ya existe un evento con ese nombre para la fecha y categoría seleccionada.`, variant: "destructive" });
            setLoading(false);
            return;
        }

        const batch = writeBatch(db);
        
        if (modality === '6loco') {
            const finalResults: DailyResult[] = sortedResults.map(r => ({
                playerId: r.playerId!, name: r.name!, points: r.points!, g: r.g!, e: r.e!, p: r.p!
            }));
            
            const newEventDoc = doc(collRef);
            batch.set(newEventDoc, { id: newEventDoc.id, date: date, name: finalEventName, results: finalResults, modality: '6loco', category });
            
            for (let i = 0; i < finalResults.length; i++) {
                const result = finalResults[i];
                const playerRef = doc(db, 'players', result.playerId);
                const playerDoc = await getDoc(playerRef);
                if (playerDoc.exists()) {
                    const playerData = playerDoc.data() as Player;
                    const newTotalGames = (playerData.totalGames || 0) + 1;
                    const newTotalPoints = (playerData.totalPoints || 0) + result.points;
                    const newMedals = playerData.medals || { gold: 0, silver: 0, bronze: 0 };
                    if (i === 0) newMedals.gold += 1;
                    if (i === 1) newMedals.silver += 1;
                    if (i === 2) newMedals.bronze += 1;

                    batch.update(playerRef, {
                        totalGames: newTotalGames,
                        totalPoints: newTotalPoints,
                        efficiency: (newTotalPoints / (newTotalGames * 36)) * 100,
                        medals: newMedals
                    });
                }
            }

        } else { // Pareja Fija
            const finalResults: DailyPairResult[] = sortedResults.map(r => ({
                pairId: r.pairId!,
                player1: r.player1!,
                player2: r.player2!,
                points: r.points!,
                g: r.g!,
                e: r.e!,
                p: r.p!
            }));
            const newEventDoc = doc(collRef);
            batch.set(newEventDoc, { id: newEventDoc.id, date: date, name: finalEventName, results: finalResults, modality: 'parejaFija', category });
        }

        await batch.commit();
        toast({ title: "Éxito", description: "El evento se ha guardado correctamente." });
        resetState();
    } catch (error) {
        console.error("Error saving event:", error);
        toast({ title: "Error", description: "No se pudo guardar el evento.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  if (user?.role === 'guest') {
    return (
        <Card>
            <CardHeader>
                <CardTitle><span className="text-yellow-400">Registro Manual</span></CardTitle>
                <CardDescription>Introduce los resultados finales de un evento para la categoría <span className="font-bold text-primary">{category}</span>.</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Acceso Restringido</AlertTitle>
                    <AlertDescription>
                        Solo los administradores pueden registrar eventos manualmente.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="text-yellow-400">Registro Manual de Partida</span></CardTitle>
        <CardDescription>Selecciona la fecha, modalidad, jugadores e introduce sus resultados del día para la categoría <span className="font-bold text-primary">{category}</span>.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-2">
              <Label htmlFor="event-date">Fecha del Evento</Label>
              <Input
                  id="event-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-2"
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="manual-eventName">Nombre del Evento (opcional)</Label>
                <Input id="manual-eventName" placeholder="Ej: Mañana, Nocturno..." value={eventName} onChange={(e) => setEventName(e.target.value)} className="mt-2" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="modality">Modalidad</Label>
                <Select value={modality} onValueChange={(v) => { setModality(v as Modality); resetState(); }}>
                  <SelectTrigger id="modality" className="mt-2">
                    <SelectValue placeholder="Seleccionar modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6loco"><User className="mr-2 h-4 w-4"/> Individual</SelectItem>
                    <SelectItem value="parejaFija"><Users className="mr-2 h-4 w-4"/> Pareja Fija</SelectItem>
                  </SelectContent>
                </Select>
            </div>
        </div>

        {modality === '6loco' && (
             <div className="space-y-2">
              <Label>Jugadores ({selectedPlayers.length})</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start mt-2">
                    <Users className="mr-2 h-4 w-4" />
                    Seleccionar Jugadores
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                      <CommandInput placeholder="Buscar jugador..." />
                      <CommandList>
                          <CommandEmpty>No se encontró ningún jugador.</CommandEmpty>
                          <CommandGroup>
                              {allPlayers.map(player => (
                                  <CommandItem key={player.id} onSelect={() => handlePlayerToggle(player)}>
                                      <Checkbox checked={selectedPlayers.some(p => p.id === player.id)} className="mr-2" />
                                      {player.name}
                                  </CommandItem>
                              ))}
                          </CommandGroup>
                      </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
          </div>
        )}

        {modality === 'parejaFija' && (
            <div className="space-y-4">
                 <div>
                    <Label>Creador de Parejas ({fixedPairs.length})</Label>
                    <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2 mt-2">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor='p1' className="text-xs">Jugador 1</Label>
                            <Select value={player1?.id || ''} onValueChange={id => setPlayer1(allPlayers.find(p => p.id === id) || null)}>
                                <SelectTrigger id="p1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {availablePlayersForPairing.filter(p => p.id !== player2?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label htmlFor='p2' className="text-xs">Jugador 2</Label>
                            <Select value={player2?.id || ''} onValueChange={id => setPlayer2(allPlayers.find(p => p.id === id) || null)}>
                                <SelectTrigger id="p2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {availablePlayersForPairing.filter(p => p.id !== player1?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleAddPair} size="icon" className="w-full md:w-auto mt-4 md:mt-0"><PlusCircle/></Button>
                    </div>
                </div>
            </div>
        )}


        {sortedResults.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{modality === '6loco' ? 'Jugador' : 'Pareja'}</TableHead>
                  <TableHead className="text-center w-24">Puntos</TableHead>
                  <TableHead className="text-center w-16">G</TableHead>
                  <TableHead className="text-center w-16">E</TableHead>
                  <TableHead className="text-center w-16">P</TableHead>
                  <TableHead className="text-center w-16">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.map((result, index) => {
                  const id = result.playerId! || result.pairId!;
                  const isPair = modality === 'parejaFija';
                  const onRemove = () => {
                      if(isPair) {
                          const pairIndex = fixedPairs.findIndex(p => [p.player1.id, p.player2.id].sort().join('-') === id);
                          if(pairIndex > -1) handleRemovePair(pairIndex);
                      } else {
                          const player = allPlayers.find(p => p.id === id);
                          if(player) handlePlayerToggle(player);
                      }
                  }

                  return (
                    <TableRow key={id}>
                      <TableCell className="font-bold flex items-center gap-2">{index + 1} {getPodiumIcon(index)}</TableCell>
                      <TableCell className="whitespace-nowrap">{result.name}</TableCell>
                      <TableCell><Input type="text" className="text-center" value={result.points ?? ''} onChange={(e) => handleResultChange(id, 'points', e.target.value)} /></TableCell>
                      <TableCell><Input type="text" className="text-center" value={result.g ?? ''} onChange={(e) => handleResultChange(id, 'g', e.target.value)} /></TableCell>
                      <TableCell><Input type="text" className="text-center" value={result.e ?? ''} onChange={(e) => handleResultChange(id, 'e', e.target.value)} /></TableCell>
                      <TableCell><Input type="text" className="text-center" value={result.p ?? ''} onChange={(e) => handleResultChange(id, 'p', e.target.value)} /></TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={onRemove}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-6">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button disabled={loading || sortedResults.length === 0 || user?.role !== 'admin'}>
                            <Sparkles className="mr-2 h-4 w-4" /> {loading ? 'Guardando...' : 'Finalizar y Guardar Evento'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Confirmar y guardar evento?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción registrará el evento en el historial, actualizará las estadísticas y medallas de los jugadores. La acción no se puede deshacer.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={saveEvent}>Confirmar y Guardar</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistroManual;
