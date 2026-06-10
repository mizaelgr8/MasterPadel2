
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, writeBatch, query, where, getDoc as getDocFirebase, onSnapshot } from "firebase/firestore";
import type { Player, DailyEvent, DailyElevadorEvent, Category, MonthlyRanking, PlayerStats, CompletedTournament, DailyPairEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, UserPlus, RefreshCw, DatabaseZap, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useCategory } from "@/context/CategoryContext";
import { useFirebase } from "@/context/FirebaseContext";


type PlayerFormData = { name: string; category: Category };

const ListaJugadores = () => {
  const { db } = useFirebase();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PlayerFormData>({ defaultValues: { category: '5ta' }});
  const { toast } = useToast();
  const { user } = useAuth();
  const { category } = useCategory();

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const playersCollection = collection(db, "players");
    
    const unsubscribe = onSnapshot(playersCollection, (snapshot) => {
        const allPlayersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        let categoryPlayers: Player[] = [];

        if (category === '4ta') {
            categoryPlayers = allPlayersList.filter(p => p.category === '4ta' || !p.category);
        } else {
            categoryPlayers = allPlayersList.filter(p => p.category === category);
        }
        
        setPlayers(categoryPlayers.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching players in real-time: ", error);
        toast({ title: "Error de Conexión", description: "No se pudo obtener la lista de jugadores en tiempo real.", variant: "destructive"});
        setLoading(false);
    });

    return () => unsubscribe();
  }, [db, category, toast]);

  const handleAddOrUpdatePlayer = async (data: PlayerFormData) => {
    if (!db) return;
    const { name, category: playerCategory } = data;
    if (!name.trim()) {
      toast({ title: "Error", description: "El nombre no puede estar vacío.", variant: "destructive" });
      return;
    }

    const allPlayersSnapshot = await getDocs(collection(db, "players"));
    const isDuplicate = allPlayersSnapshot.docs.some(doc => {
      const p = doc.data() as Player;
      return p.name.toLowerCase() === name.toLowerCase() && doc.id !== editingPlayer?.id;
    });

    if (isDuplicate) {
      toast({ title: "Error", description: "Ya existe un jugador con ese nombre.", variant: "destructive" });
      return;
    }

    if (editingPlayer) {
      const playerDoc = doc(db, "players", editingPlayer.id);
      await updateDoc(playerDoc, { name, category: playerCategory });
      toast({ title: "Éxito", description: "Jugador actualizado correctamente." });
    } else {
      await addDoc(collection(db, "players"), {
        name,
        category: playerCategory,
        totalGames: 0,
        totalPoints: 0,
        efficiency: 0,
        medals: { gold: 0, silver: 0, bronze: 0 },
        achievements: { king: 0, shield: 0, sword: 0 },
        trophies: { first: 0, second: 0, third: 0 },
      });
      toast({ title: "Éxito", description: "Jugador añadido correctamente." });
    }
    
    reset();
    setEditingPlayer(null);
    setIsDialogOpen(false);
  };
  
  const handleDeletePlayer = async (playerId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "players", playerId));
      toast({ title: "Éxito", description: "Jugador eliminado correctamente." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el jugador.", variant: "destructive" });
    }
  };

  const handleRecalculateStats = async () => {
    if (!db) return;
    setIsRecalculating(true);
    try {
        const batch = writeBatch(db);
        const playersSnapshot = await getDocs(collection(db, 'players'));
        
        const playerRefs: { [id: string]: any } = {};
        const playerStats: { [id: string]: any } = {};

        playersSnapshot.forEach(playerDoc => {
            const playerId = playerDoc.id;
            playerRefs[playerId] = doc(db, 'players', playerId);
            playerStats[playerId] = {
                totalGames: 0,
                totalPoints: 0,
                medals: { gold: 0, silver: 0, bronze: 0 },
                achievements: { king: 0, shield: 0, sword: 0 },
                trophies: { first: 0, second: 0, third: 0 },
            };
        });

        // Daily Events (6 Loco & Elevador)
        const dailyEventsSnapshot = await getDocs(collection(db, 'dailyEvents'));
        dailyEventsSnapshot.forEach(eventDoc => {
            const eventData = eventDoc.data() as DailyEvent;
            eventData.results.sort((a,b) => b.points - a.points);
            eventData.results.forEach((result, index) => {
                const stats = playerStats[result.playerId];
                if (stats) {
                    stats.totalGames += 1;
                    stats.totalPoints += result.points;
                    if (index === 0) stats.medals.gold += 1;
                    if (index === 1) stats.medals.silver += 1;
                    if (index === 2) stats.medals.bronze += 1;
                }
            });
        });
        
        const elevadorEventsSnapshot = await getDocs(collection(db, 'dailyElevadorEvents'));
        elevadorEventsSnapshot.forEach(eventDoc => {
            const eventData = eventDoc.data() as DailyElevadorEvent;
            eventData.results.forEach((result, index) => {
                 const stats = playerStats[result.playerId];
                 if(stats) {
                    stats.totalGames += 1;
                    stats.totalPoints += result.pointsScored; // Using pointsScored for elevador
                    if (index === 0) stats.medals.gold += 1;
                    if (index === 1) stats.medals.silver += 1;
                    if (index === 2) stats.medals.bronze += 1;
                 }
            });
        });
        
        // Medals from 6 Loco Parejas
        const dailyPairEventsSnapshot = await getDocs(collection(db, 'dailyPairEvents'));
        dailyPairEventsSnapshot.forEach(doc => {
            const eventData = doc.data() as DailyPairEvent;
            if (eventData.modality === '6locoParejas') {
                eventData.results.sort((a,b) => b.points - a.points);
                eventData.results.forEach((result, index) => {
                    if (index > 2) return;
                    [result.player1.id, result.player2.id].forEach(pid => {
                        const stats = playerStats[pid];
                        if (stats) {
                            if (index === 0) stats.medals.gold += 1;
                            if (index === 1) stats.medals.silver += 1;
                            if (index === 2) stats.medals.bronze += 1;
                        }
                    });
                });
            }
        });
        
        // Monthly Achievements
        const monthlyRankingsSnapshot = await getDocs(collection(db, 'monthlyRankings'));
        monthlyRankingsSnapshot.forEach(doc => {
            const ranking = doc.data() as MonthlyRanking;
            const top3 = ranking.players.slice(0, 3);
            const achievements = ['king', 'shield', 'sword'] as const;
            top3.forEach((player, index) => {
                if (playerStats[player.playerId]) {
                    const stats = playerStats[player.playerId];
                    stats.achievements[achievements[index]] += 1;
                }
            });
        });

        // Tournament Trophies
        const tournamentsSnapshot = await getDocs(collection(db, 'tournaments'));
        tournamentsSnapshot.forEach(doc => {
            const tourney = doc.data() as CompletedTournament;
            tourney.standings.slice(0, 3).forEach((pair, index) => {
                const playersInPair = [pair.player1, pair.player2];
                playersInPair.forEach(player => {
                    if (playerStats[player.id]) {
                        const stats = playerStats[player.id];
                        if (index === 0) stats.trophies.first++;
                        if (index === 1) stats.trophies.second++;
                        if (index === 2) stats.trophies.third++;
                    }
                });
            });
        });

        for (const playerId in playerStats) {
            const stats = playerStats[playerId];
            const efficiency = stats.totalGames > 0 ? (stats.totalPoints / (stats.totalGames * 36)) * 100 : 0;
            batch.update(playerRefs[playerId], {
                ...stats,
                efficiency,
            });
        }

        await batch.commit();

        toast({ title: "Éxito", description: `Estadísticas de todos los jugadores recalculadas.` });
    } catch (error) {
        console.error("Error recalculating stats:", error);
        toast({ title: "Error", description: "Ocurrió un error al recalcular las estadísticas.", variant: "destructive" });
    } finally {
        setIsRecalculating(false);
    }
  };

  const openEditDialog = (player: Player) => {
    setEditingPlayer(player);
    setValue("name", player.name);
    setValue("category", player.category || '4ta');
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingPlayer(null);
    reset({ name: "", category: category });
    setIsDialogOpen(true);
  };

  return (
    <>
        <p className="text-sm text-muted-foreground mb-4">Total de jugadores en la categoría: {players.length}</p>

        { user?.role === 'admin' &&
            <div className="flex flex-wrap justify-end gap-2 mb-4">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" disabled={isRecalculating}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
                            {isRecalculating ? 'Recalculando...' : 'Recalcular Todas las Estadísticas'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Confirmar recálculo de estadísticas?</AlertDialogTitle>
                            <AlertDialogDescription>
                               Esta acción es irreversible. Se resetearán las estadísticas (puntos, partidas, medallas, logros) de <span className="font-bold">todos los jugadores</span> y se reconstruirán basándose en todo el historial de eventos.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRecalculateStats}>Confirmar y Recalcular</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              <Button onClick={openAddDialog}><UserPlus className="mr-2 h-4 w-4" /> Añadir Jugador</Button>
            </div>
        }
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlayer ? "Editar Jugador" : "Añadir Nuevo Jugador"}</DialogTitle>
              <DialogDescription>
                {editingPlayer ? "Modifica los datos del jugador." : "Ingresa los datos del nuevo jugador."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleAddOrUpdatePlayer)} id="player-form" className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Nombre del jugador</Label>
                <Input id="name" {...register("name", { required: true })} />
                {errors.name && <p className="text-red-500 text-xs mt-1">El nombre es obligatorio.</p>}
              </div>
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Select value={watch("category")} onValueChange={(value) => setValue("category", value as Category)}>
                    <SelectTrigger id="category">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="3ra">3ra</SelectItem>
                        <SelectItem value="4ta">4ta</SelectItem>
                        <SelectItem value="5ta">5ta</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </form>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancelar</Button>
                </DialogClose>
                <Button type="submit" form="player-form">Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    { user?.role === 'admin' && <TableHead className="text-right">Acciones</TableHead> }
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                    <TableRow><TableCell colSpan={user?.role === 'admin' ? 3 : 2} className="text-center">Cargando jugadores...</TableCell></TableRow>
                    ) : players.length > 0 ? (
                    players.map(player => (
                        <TableRow key={player.id}>
                        <TableCell className="font-medium">{player.name}</TableCell>
                        <TableCell>{player.category || 'N/A'}</TableCell>
                        { user?.role === 'admin' &&
                            <TableCell className="text-right space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(player)}>
                                <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                   <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Eliminar a {player.name}?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción es permanente y no se puede deshacer. Todos los datos históricos asociados a este jugador permanecerán, pero no se podrán asociar a un nuevo jugador. Para corregir estadísticas, considera usar la función "Recalcular Estadísticas".
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeletePlayer(player.id)}>Confirmar</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        }
                        </TableRow>
                    ))
                    ) : (
                    <TableRow><TableCell colSpan={user?.role === 'admin' ? 3 : 2} className="text-center">No hay jugadores registrados en esta categoría.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    </>
  );
};

export default ListaJugadores;
