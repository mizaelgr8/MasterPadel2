
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, writeBatch, query, where, onSnapshot, increment } from "firebase/firestore";
import type { Player, DailyEvent, DailyElevadorEvent, Category, MonthlyRanking, CompletedTournament, DailyPairEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, UserPlus, RefreshCw, Loader2, SearchX } from "lucide-react";
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
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PlayerFormData>({ defaultValues: { category: '4ta' }});
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
            // Incluimos explícitamente 4ta y los que no tienen categoría (legado)
            categoryPlayers = allPlayersList.filter(p => !p.category || p.category === '4ta');
        } else {
            categoryPlayers = allPlayersList.filter(p => p.category === category);
        }
        
        setPlayers(categoryPlayers.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching players:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [db, category]);

  const handleAddOrUpdatePlayer = async (data: PlayerFormData) => {
    if (!db) return;
    const { name, category: playerCategory } = data;
    if (!name.trim()) return;

    try {
        if (editingPlayer) {
          await updateDoc(doc(db, "players", editingPlayer.id), { name, category: playerCategory });
          toast({ title: "Éxito", description: "Jugador actualizado." });
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
          toast({ title: "Éxito", description: "Jugador añadido." });
        }
        reset();
        setEditingPlayer(null);
        setIsDialogOpen(false);
    } catch (e) {
        toast({ title: "Error", variant: "destructive" });
    }
  };
  
  const handleDeletePlayer = async (playerId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "players", playerId));
      toast({ title: "Éxito", description: "Jugador eliminado." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const handleRecalculateStats = async () => {
    if (!db) return;
    setIsRecalculating(true);
    try {
        const batch = writeBatch(db);
        const playersSnapshot = await getDocs(collection(db, 'players'));
        const playerStats: Record<string, any> = {};

        playersSnapshot.forEach(playerDoc => {
            playerStats[playerDoc.id] = {
                totalGames: 0, totalPoints: 0,
                medals: { gold: 0, silver: 0, bronze: 0 },
                achievements: { king: 0, shield: 0, sword: 0 },
                trophies: { first: 0, second: 0, third: 0 },
            };
        });

        // Eventos Individuales
        const dailyEventsSnapshot = await getDocs(collection(db, 'dailyEvents'));
        dailyEventsSnapshot.forEach(doc => {
            const data = doc.data() as DailyEvent;
            data.results.sort((a,b) => b.points - a.points).forEach((res, i) => {
                const s = playerStats[res.playerId];
                if (s) {
                    s.totalGames++; s.totalPoints += res.points;
                    if (i === 0) s.medals.gold++; else if (i === 1) s.medals.silver++; else if (i === 2) s.medals.bronze++;
                }
            });
        });

        // Elevador
        const elevadorSnapshot = await getDocs(collection(db, 'dailyElevadorEvents'));
        elevadorSnapshot.forEach(doc => {
            const data = doc.data() as DailyElevadorEvent;
            data.results.sort((a,b) => b.gamesWon - a.gamesWon || b.pointsDifference - a.pointsDifference).forEach((res, i) => {
                const s = playerStats[res.playerId];
                if (s) {
                    s.totalGames++; s.totalPoints += res.pointsScored;
                    if (i === 0) s.medals.gold++; else if (i === 1) s.medals.silver++; else if (i === 2) s.medals.bronze++;
                }
            });
        });

        for (const pid in playerStats) {
            const s = playerStats[pid];
            batch.update(doc(db, 'players', pid), {
                ...s,
                efficiency: s.totalGames > 0 ? (s.totalPoints / (s.totalGames * 36)) * 100 : 0
            });
        }
        await batch.commit();
        toast({ title: "Éxito", description: "Estadísticas actualizadas." });
    } catch (e) {
        toast({ title: "Error", variant: "destructive" });
    } finally {
        setIsRecalculating(false);
    }
  };

  return (
    <>
        <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-muted-foreground">Total jugadores en {category}: <span className="font-bold text-foreground">{players.length}</span></p>
            { user?.role === 'admin' &&
                <div className="flex gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isRecalculating}>
                                <RefreshCw className={isRecalculating ? 'animate-spin' : ''} />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Recalcular estadísticas?</AlertDialogTitle>
                                <AlertDialogDescription>Se reconstruirán los perfiles basados en el historial.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>No</AlertDialogCancel>
                                <AlertDialogAction onClick={handleRecalculateStats}>Sí, recalcular</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={() => { setEditingPlayer(null); reset({name: "", category: category}); setIsDialogOpen(true); }} size="sm">
                        <UserPlus className="mr-2 h-4 w-4" /> Añadir
                    </Button>
                </div>
            }
        </div>

        <div className="rounded-md border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="w-24">Cat.</TableHead>
                        { user?.role === 'admin' && <TableHead className="text-right w-24">Acción</TableHead> }
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                    ) : players.length > 0 ? (
                        players.map(player => (
                            <TableRow key={player.id}>
                                <TableCell className="font-medium uppercase">{player.name}</TableCell>
                                <TableCell className="text-muted-foreground">{player.category || '4ta'}</TableCell>
                                { user?.role === 'admin' &&
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingPlayer(player); setValue("name", player.name); setValue("category", player.category || '4ta'); setIsDialogOpen(true); }}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <AlertDialog>
                                               <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Eliminar a {player.name}?</AlertDialogTitle>
                                                        <AlertDialogDescription>Esta acción es permanente.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeletePlayer(player.id)}>Eliminar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                }
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                                <SearchX className="mx-auto h-12 w-12 mb-2 opacity-20"/>
                                <p>No se encontraron jugadores en la categoría {category}.</p>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlayer ? "Editar" : "Nuevo"} Jugador</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleAddOrUpdatePlayer)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input id="name" {...register("name", { required: true })} placeholder="Ej: Juan Pérez" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría Asignada</Label>
                <Select value={watch("category")} onValueChange={(v) => setValue("category", v as Category)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1ra">1ra Categoría</SelectItem>
                        <SelectItem value="2da">2da Categoría</SelectItem>
                        <SelectItem value="3ra">3ra Categoría</SelectItem>
                        <SelectItem value="4ta">4ta Categoría</SelectItem>
                        <SelectItem value="5ta">5ta Categoría</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button type="submit">Guardar Jugador</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
    </>
  );
};

export default ListaJugadores;
