"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, where, doc, onSnapshot } from "firebase/firestore";
import type { DailyEvent, MonthlyRanking, DailyPairEvent, DailyElevadorEvent, Category } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parse } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Info, Loader2, CalendarSearch, User, Users, ArrowRightLeft } from "lucide-react";
import { es } from 'date-fns/locale';
import { useCategory } from "@/context/CategoryContext";
import { useFirebase } from "@/context/FirebaseContext";

const Historial = () => {
  const { db } = useFirebase();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dailyIndividualEvents, setDailyIndividualEvents] = useState<DailyEvent[]>([]);
  const [dailyPairEvents, setDailyPairEvents] = useState<DailyPairEvent[]>([]);
  const [dailyElevadorEvents, setDailyElevadorEvents] = useState<DailyElevadorEvent[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  
  const [availableMonths, setAvailableMonths] = useState<{id: string, name: string}[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [monthlyData, setMonthlyData] = useState<MonthlyRanking | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const { category } = useCategory();

  useEffect(() => {
    if (!db) return;
    setMonthlyLoading(true);
    const monthlyRankingsCollection = collection(db, 'monthlyRankings');
    const q = query(monthlyRankingsCollection, where("category", "==", category));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const months = snapshot.docs.map(doc => {
            const dateStr = doc.id.split('-').slice(0, 2).join('-');
            const date = parse(dateStr, 'yyyy-MM', new Date());
            return { id: doc.id, name: format(date, 'MMMM yyyy', { locale: es }) };
        }).sort((a,b) => b.id.localeCompare(a.id));
        
        setAvailableMonths(months);
        if (months.length > 0) {
            if (!months.some(m => m.id === selectedMonth)) {
                setSelectedMonth(months[0].id);
            }
        } else {
            setMonthlyData(null);
            setSelectedMonth("");
        }
        setMonthlyLoading(false);
    }, (error) => {
        console.error("Error fetching available months:", error);
        setMonthlyLoading(false);
    });

    return () => unsubscribe();
  }, [db, category, selectedMonth]);

  const fetchDailyData = useCallback(async () => {
    if (!selectedDate || !category || !db) return;
    
    setDailyLoading(true);
    setDailyIndividualEvents([]);
    setDailyPairEvents([]);
    setDailyElevadorEvents([]);

    try {
        const fetchByDateAndCategory = async <T extends { date: string, category?: Category | null, id?: string }>(collName: string): Promise<T[]> => {
            const collRef = collection(db, collName);
            const q = query(collRef, where("date", "==", selectedDate));
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as T));
            
            if (category === '4ta') {
                return docs.filter(d => d.category === '4ta' || !d.category);
            }
            return docs.filter(d => d.category === category);
        };

        const [individualDocs, pairDocs, elevadorDocs] = await Promise.all([
            fetchByDateAndCategory<DailyEvent>("dailyEvents"),
            fetchByDateAndCategory<DailyPairEvent>("dailyPairEvents"),
            fetchByDateAndCategory<DailyElevadorEvent>("dailyElevadorEvents")
        ]);

        setDailyIndividualEvents(individualDocs.map(e => ({
            ...e,
            results: [...e.results].sort((a, b) => b.points - a.points)
        })));

        setDailyPairEvents(pairDocs.map(e => ({
            ...e,
            results: [...e.results].sort((a, b) => b.points - a.points)
        })));

        setDailyElevadorEvents(elevadorDocs.map(e => ({
            ...e,
            results: [...e.results].sort((a, b) => {
                if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
                if (b.pointsDifference !== a.pointsDifference) return b.pointsDifference - a.pointsDifference;
                if (b.pointsScored !== a.pointsScored) return b.pointsScored - a.pointsScored;
                return a.finalCourt - b.finalCourt;
            })
        })));
        
    } catch (error) {
        console.error("Error fetching daily history:", error);
    } finally {
        setDailyLoading(false);
    }
  }, [db, selectedDate, category]);

  useEffect(() => {
    fetchDailyData();
  }, [fetchDailyData]);

  useEffect(() => {
    if(!selectedMonth || !db) {
        setMonthlyData(null);
        return;
    };
    setMonthlyLoading(true);
    
    let docId = selectedMonth;

    if (category === '4ta' && !selectedMonth.endsWith('-4ta')) {
       const oldDocRef = doc(db, 'monthlyRankings', selectedMonth);
       const newDocRef = doc(db, 'monthlyRankings', `${selectedMonth}-4ta`);
       
       const unsub = onSnapshot(newDocRef, (newSnap) => {
            if (newSnap.exists()) {
                setMonthlyData(newSnap.data() as MonthlyRanking);
                setMonthlyLoading(false);
            } else {
                onSnapshot(oldDocRef, (oldSnap) => {
                    if (oldSnap.exists()) {
                         setMonthlyData(oldSnap.data() as MonthlyRanking);
                    } else {
                        setMonthlyData(null);
                    }
                    setMonthlyLoading(false);
                });
            }
       });
       return () => unsub();

    } else {
        const unsub = onSnapshot(doc(db, 'monthlyRankings', docId), (snapshot) => {
            if (snapshot.exists()) {
                setMonthlyData(snapshot.data() as MonthlyRanking);
            } else {
                setMonthlyData(null);
            }
            setMonthlyLoading(false);
        }, (error) => {
            console.error("Error fetching monthly history:", error);
            setMonthlyData(null);
            setMonthlyLoading(false);
        });
        return () => unsub();
    }
  }, [db, selectedMonth, category]);


  const getMedal = (index: number) => {
    if (index === 0) return <span className="gold-text">🥇</span>;
    if (index === 1) return <span className="silver-text">🥈</span>;
    if (index === 2) return <span className="bronze-text">🥉</span>;
    return null;
  };

  const hasEvents = dailyIndividualEvents.length > 0 || dailyPairEvents.length > 0 || dailyElevadorEvents.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle><span className="text-yellow-400">Historial de Eventos</span></CardTitle>
        <CardDescription>Revisa los resultados de eventos pasados para la categoría <span className="font-bold text-primary">{category}</span>.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="diario" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="diario">Diario</TabsTrigger>
            <TabsTrigger value="mensual">Mensual</TabsTrigger>
          </TabsList>
          
          <TabsContent value="diario">
            <div className="my-4 flex items-center gap-4">
              <div className="relative w-full md:w-1/4">
                <CalendarSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-10"
                />
              </div>
            </div>
            {dailyLoading ? (
              <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : !hasEvents ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <CalendarSearch className="mx-auto h-12 w-12 mb-4 opacity-20" />
                    <p>No se encontraron eventos para el {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'PP', {locale: es})}.</p>
                </div>
            ) : (
              <div className="space-y-12 mt-6">
                {dailyIndividualEvents.map((event) => (
                    <Card key={event.id} className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <User className="h-5 w-5 text-primary"/> {event.name || "Evento Individual"}
                            </CardTitle>
                            <CardDescription>Modalidad: 6 Loco</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="text-center">G/E/P</TableHead>
                                    <TableHead className="text-center">Puntos</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {event.results.map((player, index) => (
                                    <TableRow key={player.playerId}>
                                    <TableCell className="font-bold flex items-center gap-2">{index + 1} {getMedal(index)}</TableCell>
                                    <TableCell>{player.name}</TableCell>
                                    <TableCell className="text-center">{`${player.g}/${player.e}/${player.p}`}</TableCell>
                                    <TableCell className="text-center font-bold text-primary">{player.points}</TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                ))}

                {dailyPairEvents.map((event) => (
                     <Card key={event.id} className="border-blue-500/20 bg-blue-500/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Users className="h-5 w-5 text-blue-400"/> {event.name || "Evento de Parejas"}
                            </CardTitle>
                            <CardDescription>Modalidad: Pareja Fija / Americano</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Pareja</TableHead>
                                    <TableHead className="text-center">G/E/P</TableHead>
                                    <TableHead className="text-center">Puntos</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {event.results.map((pair, index) => (
                                    <TableRow key={pair.pairId}>
                                    <TableCell className="font-bold flex items-center gap-2">{index + 1} {getMedal(index)}</TableCell>
                                    <TableCell>{pair.player1.name} & {pair.player2.name}</TableCell>
                                    <TableCell className="text-center">{`${pair.g}/${pair.e}/${pair.p}`}</TableCell>
                                    <TableCell className="text-center font-bold text-blue-400">{pair.points}</TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                ))}

                {dailyElevadorEvents.map((event) => (
                    <Card key={event.id} className="border-orange-500/20 bg-orange-500/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <ArrowRightLeft className="h-5 w-5 text-orange-400"/> {event.name || "Elevador"}
                            </CardTitle>
                            <CardDescription>Modalidad: Elevador Individual</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Jugador</TableHead>
                                        <TableHead className="text-center">G</TableHead>
                                        <TableHead className="text-center">P</TableHead>
                                        <TableHead className="text-center">Pts.</TableHead>
                                        <TableHead className="text-center">Cancha Final</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {event.results.map((p, index) => (
                                        <TableRow key={p.playerId}>
                                            <TableCell className="font-bold flex items-center gap-2">{index + 1} {getMedal(index)}</TableCell>
                                            <TableCell>{p.name}</TableCell>
                                            <TableCell className="text-center">{p.gamesWon}</TableCell>
                                            <TableCell className="text-center">{p.gamesLost}</TableCell>
                                            <TableCell className="text-center font-bold text-orange-400">{p.pointsScored}</TableCell>
                                            <TableCell className="text-center">{p.finalCourt}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="mensual">
             <Alert className="mb-4 bg-blue-900/20 border-blue-500/30">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertTitle className="text-blue-300">Historial de Rankings Mensuales</AlertTitle>
                <AlertDescription className="text-blue-400/80">
                    Esta vista muestra el historial de rankings mensuales para la modalidad individual. El historial de parejas no está disponible aquí, se consulta desde el Ranking General.
                </AlertDescription>
            </Alert>
            <div className="my-4">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full md:w-1/4">
                        <SelectValue placeholder="Selecciona un mes" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableMonths.map(month => (
                            <SelectItem key={month.id} value={month.id}>{month.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {monthlyLoading ? (
               <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : monthlyData ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-center">Puntaje</TableHead>
                        <TableHead className="text-center">Eventos</TableHead>
                        <TableHead className="text-center">Puntos Totales</TableHead>
                        <TableHead className="text-center">Promedio</TableHead>
                        <TableHead className="text-center">Logros</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {monthlyData.players.map((player, index) => (
                            <TableRow key={player.playerId}>
                                <TableCell className="font-bold">{index + 1}</TableCell>
                                <TableCell>{player.name}</TableCell>
                                <TableCell className="text-center font-semibold text-primary">{player.rankScore.toFixed(2)}</TableCell>
                                <TableCell className="text-center">{player.totalGames}</TableCell>
                                <TableCell className="text-center">{player.totalPoints}</TableCell>
                                <TableCell className="text-center">{player.avgPoints.toFixed(2)}</TableCell>
                                <TableCell className="text-center text-xl">
                                    {index === 0 ? <span className="gold-text">👑</span> : index === 1 ? <span className="silver-text">🛡️</span> : index === 2 ? <span className="bronze-text">⚔️</span> : ''}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <p className="text-center text-muted-foreground mt-8">No se encontró ranking para el mes y categoría seleccionados.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default Historial;
