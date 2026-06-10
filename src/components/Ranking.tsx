
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, doc, writeBatch, getDoc, onSnapshot, DocumentData } from 'firebase/firestore';
import type { Player, DailyEvent, MonthlyRankingPlayer, MonthlyRanking, MonthlyPairRanking, MonthlyPairRankingPlayer, DailyPairEvent, GeneralPairRankingPlayer, DailyElevadorEvent, Category, CompletedTournament } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import { format, subMonths, startOfMonth, endOfMonth, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Archive, User, Users, CheckCircle, BarChart, Calendar, Trophy, CalendarCheck } from 'lucide-react';
import Podium from './Podium';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useCategory } from '@/context/CategoryContext';
import { useFirebase } from '@/context/FirebaseContext';
import { cn } from '@/lib/utils';

const RankingGeneralContent = () => {
    const { db } = useFirebase();
    const { category } = useCategory();
    const { user } = useAuth();
    const [individualPlayers, setIndividualPlayers] = useState<Player[]>([]);
    const [pairPlayers, setPairPlayers] = useState<GeneralPairRankingPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('individual');
    const { toast } = useToast();

    const isAdmin = user?.username === 'Admin';

    const calculateRankings = useCallback(async () => {
        if (!db) return;
        setLoading(true);
        try {
            const playersColl = collection(db, "players");
            const dailyEventsColl = collection(db, "dailyEvents");
            const dailyElevadorEventsColl = collection(db, "dailyElevadorEvents");
            const monthlyRankingsColl = collection(db, "monthlyRankings");
            const dailyPairEventsColl = collection(db, "dailyPairEvents");
            const monthlyPairRankingsColl = collection(db, "monthlyPairRankings");

            const [
                playersSnapshot,
                dailyEventsSnapshot,
                dailyElevadorEventsSnapshot,
                monthlyRankingsSnapshot,
                dailyPairEventsSnapshot,
                monthlyPairRankingsSnapshot,
            ] = await Promise.all([
                getDocs(playersColl),
                getDocs(dailyEventsColl),
                getDocs(dailyElevadorEventsColl),
                getDocs(monthlyRankingsColl),
                getDocs(dailyPairEventsColl),
                getDocs(monthlyPairRankingsColl),
            ]);

            const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));

            const filterByCategory = <T extends { category?: Category | null }>(data: T[], cat: Category): T[] => {
                if (cat === '4ta') {
                    return data.filter(item => item.category === '4ta' || !item.category);
                }
                return data.filter(item => item.category === cat);
            };

            const categoryPlayers = filterByCategory(allPlayers, category);
            
            const dailyEvents = filterByCategory(dailyEventsSnapshot.docs.map(d => d.data() as DailyEvent), category);
            const dailyElevadorEvents = filterByCategory(dailyElevadorEventsSnapshot.docs.map(d => d.data() as DailyElevadorEvent), category);
            const monthlyRankings = filterByCategory(monthlyRankingsSnapshot.docs.map(d => d.data() as MonthlyRanking), category);
            const dailyPairEvents = filterByCategory(dailyPairEventsSnapshot.docs.map(d => d.data() as DailyPairEvent), category);
            const monthlyPairRankings = filterByCategory(monthlyPairRankingsSnapshot.docs.map(d => d.data() as MonthlyPairRanking), category);

            const playerStats: { [id: string]: { totalGames: number; totalPoints: number; medals: { gold: number; silver: number; bronze: number; }; achievements: { king: number; shield: number; sword: number; }; } } = {};

            categoryPlayers.forEach(p => {
                playerStats[p.id] = {
                    totalGames: 0,
                    totalPoints: 0,
                    medals: { gold: 0, silver: 0, bronze: 0 },
                    achievements: { king: 0, shield: 0, sword: 0 },
                };
            });

            dailyEvents.forEach(event => {
                event.results.sort((a,b) => b.points - a.points);
                event.results.forEach((result, index) => {
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

            dailyElevadorEvents.forEach(event => {
                event.results.sort((a, b) => {
                    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
                    if (b.pointsDifference !== a.pointsDifference) return b.pointsDifference - a.pointsDifference;
                    return b.pointsScored - a.pointsScored;
                });
                event.results.forEach((result, index) => {
                    const stats = playerStats[result.playerId];
                    if (stats) {
                        stats.totalGames += 1;
                        stats.totalPoints += result.pointsScored;
                        if (index === 0) stats.medals.gold += 1;
                        if (index === 1) stats.medals.silver += 1;
                        if (index === 2) stats.medals.bronze += 1;
                    }
                });
            });
            
            // Add medals from 6 Loco Parejas to individual rankings
            dailyPairEvents.filter(e => e.modality === '6locoParejas').forEach(event => {
                const sortedResults = [...event.results].sort((a, b) => b.points - a.points);
                sortedResults.forEach((result, index) => {
                    if (index > 2) return;
                    [result.player1.id, result.player2.id].forEach(pid => {
                        const stats = playerStats[pid];
                        if (stats) {
                            if (index === 0) stats.medals.gold += 1;
                            else if (index === 1) stats.medals.silver += 1;
                            else if (index === 2) stats.medals.bronze += 1;
                        }
                    });
                });
            });

            monthlyRankings.forEach(ranking => {
                const top3 = ranking.players.slice(0, 3);
                const achievements = ['king', 'shield', 'sword'] as const;
                top3.forEach((player, index) => {
                    if (playerStats[player.playerId]) {
                        playerStats[player.playerId].achievements[achievements[index]] += 1;
                    }
                });
            });
            
            const enrichedPlayers = categoryPlayers.map(p => ({
                ...p,
                totalGames: playerStats[p.id]?.totalGames || 0,
                totalPoints: playerStats[p.id]?.totalPoints || 0,
                medals: playerStats[p.id]?.medals || { gold: 0, silver: 0, bronze: 0 },
                achievements: playerStats[p.id]?.achievements || { king: 0, shield: 0, sword: 0 },
            }));

            enrichedPlayers.sort((a, b) => {
                if (b.achievements.king !== a.achievements.king) return b.achievements.king - a.achievements.king;
                if (b.achievements.shield !== a.achievements.shield) return b.achievements.shield - a.achievements.shield;
                if (b.achievements.sword !== a.achievements.sword) return b.achievements.sword - a.achievements.sword;
                if (b.medals.gold !== a.medals.gold) return b.medals.gold - a.medals.gold;
                if (b.medals.silver !== a.medals.silver) return b.medals.silver - a.medals.silver;
                if (b.medals.bronze !== a.medals.bronze) return b.medals.bronze - a.medals.bronze;
                const avgA = a.totalGames > 0 ? a.totalPoints / a.totalGames : 0;
                const avgB = b.totalGames > 0 ? b.totalPoints / b.totalGames : 0;
                if (avgB !== avgA) return avgB - avgA;
                return b.totalGames - a.totalGames;
            });
            
            setIndividualPlayers(enrichedPlayers);

            // Pair Ranking Logic
            const pairStats: { [key: string]: GeneralPairRankingPlayer } = {};
            
            const ensurePairStats = (pairId: string, player1: {id:string, name:string}, player2: {id:string, name:string}) => {
                if (!pairStats[pairId]) {
                    pairStats[pairId] = {
                        pairId, player1, player2,
                        totalGames: 0, totalPoints: 0,
                        achievements: { king: 0, shield: 0, sword: 0 },
                        medals: { gold: 0, silver: 0, bronze: 0 },
                        trophies: { first: 0, second: 0, third: 0 }
                    };
                }
            };

            dailyPairEvents.forEach(event => {
                event.results.sort((a, b) => b.points - a.points);
                event.results.forEach((result, index) => {
                    ensurePairStats(result.pairId, result.player1, result.player2);
                    const pair = pairStats[result.pairId];
                    pair.totalGames++;
                    pair.totalPoints += result.points;
                    if (index === 0) pair.trophies.first++;
                    if (index === 1) pair.trophies.second++;
                    if (index === 2) pair.trophies.third++;
                });
            });

            monthlyPairRankings.forEach(monthlyRanking => {
                const achievements = ['king', 'shield', 'sword'] as const;
                monthlyRanking.pairs.slice(0, 3).forEach((pair, index) => {
                    ensurePairStats(pair.pairId, pair.player1, pair.player2);
                    if (index < 3) {
                        pairStats[pair.pairId].achievements[achievements[index]]++;
                    }
                });
            });

            const sortedPairPlayers = Object.values(pairStats).sort((a, b) => {
                if (b.trophies.first !== a.trophies.first) return b.trophies.first - a.trophies.first;
                if (b.trophies.second !== a.trophies.second) return b.trophies.second - a.trophies.second;
                if (b.trophies.third !== a.trophies.third) return b.trophies.third - a.trophies.third;
                if (b.achievements.king !== a.achievements.king) return b.achievements.king - a.achievements.king;
                if (b.achievements.shield !== a.achievements.shield) return b.achievements.shield - a.achievements.shield;
                if (b.achievements.sword !== a.achievements.sword) return b.achievements.sword - a.achievements.sword;
                if (b.medals.gold !== a.medals.gold) return b.medals.gold - a.medals.gold;
                if (b.medals.silver !== a.medals.silver) return b.medals.silver - a.medals.silver;
                if (b.medals.bronze !== a.medals.bronze) return b.medals.bronze - a.medals.bronze;
                const avgA = a.totalGames > 0 ? a.totalPoints / a.totalGames : 0;
                const avgB = b.totalGames > 0 ? b.totalPoints / b.totalGames : 0;
                if (avgB !== avgA) return avgB - avgA;
                return b.totalGames - a.totalGames;
            });
            setPairPlayers(sortedPairPlayers);

        } catch (e) {
            console.error("Error calculating rankings", e);
        } finally {
            setLoading(false);
        }
    }, [db, category]);

    useEffect(() => {
        const collectionsToWatch = ['players', 'dailyEvents', 'dailyElevadorEvents', 'monthlyRankings', 'dailyPairEvents', 'monthlyPairRankings', 'tournaments'];
        const unsubscribers = collectionsToWatch.map(collName => {
            if (!db) return () => {};
            const collRef = collection(db, collName);
            return onSnapshot(collRef, () => {
                calculateRankings();
            }, (error) => {
                console.error(`Error listening to ${collName}:`, error);
            });
        });
        
        // Initial call
        calculateRankings();
        
        return () => unsubscribers.forEach(unsub => unsub());
    }, [db, calculateRankings]);


    const individualPodiumPlayers = individualPlayers.slice(0, 3);
    const pairPodiumPlayers: Player[] = useMemo(() => {
        return pairPlayers.slice(0, 3).map(p => ({
            id: p.pairId,
            name: `${p.player1.name} & ${p.player2.name}`,
            achievements: p.achievements,
            medals: p.medals,
            totalGames: p.totalGames,
            totalPoints: p.totalPoints,
            efficiency: 0, // Not used in podium pair display
            category: category,
            trophies: p.trophies,
        }));
      }, [pairPlayers, category]);


  return (
    <Card className="w-full 3xl:max-w-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Trophy className="text-yellow-400 h-8 w-8" />
             <span className="text-yellow-400">
                Ranking General
            </span>
        </CardTitle>
        <CardDescription>Clasificación histórica de todos los jugadores de la <span className="font-bold text-primary">{category}</span> categoría.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={cn("grid w-full", isAdmin ? "grid-cols-2" : "grid-cols-1")}>
                <TabsTrigger value="individual"><User className="mr-2"/> Individual</TabsTrigger>
                {isAdmin && <TabsTrigger value="pairs"><Users className="mr-2"/> Parejas</TabsTrigger>}
            </TabsList>
            <TabsContent value="individual">
                {loading ? <Skeleton className="h-48 w-full" /> : individualPlayers.length > 0 && <Podium topPlayers={individualPodiumPlayers} />}
                <div className="overflow-x-auto mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-center w-[60px]">PJ</TableHead>
                        <TableHead className="text-center w-[60px]">Pts</TableHead>
                        <TableHead className="text-center w-[70px]">Prom.</TableHead>
                        <TableHead className="text-center w-[150px]">Logros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                           <TableRow key={i}>
                            <TableCell colSpan={6}><Skeleton className="h-12 w-full"/></TableCell>
                          </TableRow>
                        ))
                      ) : individualPlayers.length > 0 ? (
                        individualPlayers.map((player, index) => (
                          <TableRow key={player.id}>
                            <TableCell className="font-bold">{index + 1}</TableCell>
                            <TableCell className="font-medium">{player.name}</TableCell>
                            <TableCell className="text-center">{player.totalGames || 0}</TableCell>
                            <TableCell className="text-center">{player.totalPoints || 0}</TableCell>
                            <TableCell className="text-center text-primary">
                                {player.totalGames > 0 ? (player.totalPoints / player.totalGames).toFixed(2) : '0'}
                            </TableCell>
                            <TableCell className="text-center">
                                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                                    {(player.achievements?.king || 0) > 0 && <span className="gold-text">👑 {player.achievements.king}</span>}
                                    {(player.achievements?.shield || 0) > 0 && <span className="silver-text">🛡️ {player.achievements.shield}</span>}
                                    {(player.achievements?.sword || 0) > 0 && <span className="bronze-text">⚔️ {player.achievements.sword}</span>}
                                    {(player.medals?.gold || 0) > 0 && <span className="gold-text">🥇 {player.medals.gold}</span>}
                                    {(player.medals?.silver || 0) > 0 && <span className="silver-text">🥈 {player.medals.silver}</span>}
                                    {(player.medals?.bronze || 0) > 0 && <span className="bronze-text">🥉 {player.medals.bronze}</span>}
                                </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center">No hay jugadores en el ranking.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
            </TabsContent>
            {isAdmin && (
                <TabsContent value="pairs">
                    {loading ? <Skeleton className="h-48 w-full" /> : pairPlayers.length > 0 && <Podium topPlayers={pairPodiumPlayers} />}
                    <div className="overflow-x-auto mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">#</TableHead>
                                    <TableHead>Pareja</TableHead>
                                    <TableHead className="text-center">Eventos</TableHead>
                                    <TableHead className="text-center">Promedio</TableHead>
                                    <TableHead className="text-center">Logros</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                              {loading ? (
                                  Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-12 w-full"/></TableCell></TableRow>
                                  ))
                                ) : pairPlayers.length > 0 ? (
                                  pairPlayers.map((pair, index) => (
                                    <TableRow key={pair.pairId}>
                                      <TableCell className="font-bold">{index + 1}</TableCell>
                                      <TableCell>{pair.player1.name} & {pair.player2.name}</TableCell>
                                      <TableCell className="text-center">
                                        {pair.totalGames}
                                      </TableCell>
                                      <TableCell className="text-center text-primary">
                                        {pair.totalGames > 0 ? (pair.totalPoints / pair.totalGames).toFixed(2) : '0'}
                                        </TableCell>
                                      <TableCell className="text-center">
                                        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                                            {(pair.trophies?.first || 0) > 0 && <span className="gold-text"><Trophy className="inline h-4 w-4" /> {pair.trophies.first}</span>}
                                            {(pair.trophies?.second || 0) > 0 && <span className="silver-text mx-1"><Trophy className="inline h-4 w-4" /> {pair.trophies.second}</span>}
                                            {(pair.trophies?.third || 0) > 0 && <span className="bronze-text"><Trophy className="inline h-4 w-4" /> {pair.trophies.third}</span>}
                                            {(pair.achievements?.king || 0) > 0 && <span className="gold-text ml-2">👑 {pair.achievements.king}</span>}
                                            {(pair.achievements?.shield || 0) > 0 && <span className="silver-text mx-1">🛡️ {pair.achievements.shield}</span>}
                                            {(pair.achievements?.sword || 0) > 0 && <span className="bronze-text">⚔️ {pair.achievements.sword}</span>}
                                            {(pair.medals?.gold || 0) > 0 && <span className="gold-text ml-2">🥇 {pair.medals.gold}</span>}
                                            {(pair.medals?.silver || 0) > 0 && <span className="silver-text mx-1">🥈 {pair.medals.silver}</span>}
                                            {(pair.medals?.bronze || 0) > 0 && <span className="bronze-text">🥉 {pair.medals.bronze}</span>}
                                        </div>
                                    </TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">No hay datos de parejas para mostrar.</TableCell>
                                  </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            )}
        </Tabs>
      </CardContent>
    </Card>
  );
};

const RankingMensualContent = () => {
  const { db } = useFirebase();
  const { category } = useCategory();
  const [individualRanking, setIndividualRanking] = useState<MonthlyRankingPlayer[]>([]);
  const [pairRanking, setPairRanking] = useState<MonthlyPairRankingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMonthClosed, setIsMonthClosed] = useState<{individual: boolean, pairs: boolean}>({ individual: false, pairs: false });
  const [activeTab, setActiveTab] = useState<'6loco' | 'parejaFija'>('6loco');
  const { toast } = useToast();
  const { user } = useAuth();

  const isAdmin = user?.username === 'Admin';

  const [availableMonths, setAvailableMonths] = useState<{ id: string, name: string }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  const selectedMonthName = useMemo(() => {
    if (!selectedMonth) return '';
    const date = parse(selectedMonth, 'yyyy-MM', new Date());
    return format(date, 'MMMM yyyy', { locale: es });
  }, [selectedMonth]);


  useEffect(() => {
    const months = Array.from({ length: 12 }).map((_, i) => {
        const date = subMonths(new Date(), i);
        return {
            id: format(date, 'yyyy-MM'),
            name: format(date, 'MMMM yyyy', { locale: es }),
        };
    });
    setAvailableMonths(months);
  }, []);

  const calculateRankings = useCallback(async () => {
      if (!selectedMonth || !category || !db) return;
      setLoading(true);
      
      const referenceDate = new Date(`${selectedMonth}-15T12:00:00Z`);
      const firstDayOfMonth = format(startOfMonth(referenceDate), 'yyyy-MM-dd');
      const lastDayOfMonth = format(endOfMonth(referenceDate), 'yyyy-MM-dd');
      
      const getEventsForCategory = async <T extends { category?: Category | null }>(collectionName: string, cat: Category): Promise<T[]> => {
          const coll = collection(db, collectionName);
          const q = query(coll, where('date', '>=', firstDayOfMonth), where('date', '<=', lastDayOfMonth));
          const snapshot = await getDocs(q);
          const allEventsForMonth = snapshot.docs.map(doc => doc.data() as T);
          
          if (cat === '4ta') {
              return allEventsForMonth.filter(event => event.category === '4ta' || !event.category);
          } else {
              return allEventsForMonth.filter(event => event.category === cat);
          }
      };

      const getPlayersForCategory = async (cat: Category): Promise<Player[]> => {
        const playersColl = collection(db, "players");
        let players: Player[] = [];
        if (cat === '4ta') {
            const q1 = query(playersColl, where("category", "==", "4ta"));
            const q2 = query(playersColl, where("category", "==", null));
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const playerMap = new Map<string, Player>();
            snap1.docs.forEach(doc => playerMap.set(doc.id, { id: doc.id, ...doc.data() } as Player));
            snap2.docs.forEach(doc => playerMap.set(doc.id, { id: doc.id, ...doc.data() } as Player));
            players = Array.from(playerMap.values());
        } else {
            const q = query(playersColl, where("category", "==", cat));
            const snapshot = await getDocs(q);
            players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        }
        return players;
      };
      
      const processRankings = async () => {
        try {
            const [
                monthlyIndividualEvents,
                monthlyElevadorEvents,
                monthlyPairEvents,
                categoryPlayers
            ] = await Promise.all([
                getEventsForCategory<DailyEvent>('dailyEvents', category),
                getEventsForCategory<DailyElevadorEvent>('dailyElevadorEvents', category),
                getEventsForCategory<DailyPairEvent>('dailyPairEvents', category),
                getPlayersForCategory(category)
            ]);
            
            const playerStats: { [key: string]: { name: string; category?: Category; totalPoints: number; totalGames: number; medals: { gold: number; silver: number; bronze: number; }; g: number; e: number; p: number;} } = {};
            
            monthlyIndividualEvents.forEach(event => {
                event.results.sort((a,b) => b.points - a.points);
                event.results.forEach((result, index) => {
                  const player = categoryPlayers.find(p => p.id === result.playerId);
                  if (!player) return;
                  if (!playerStats[result.playerId]) {
                    playerStats[result.playerId] = { name: result.name, category: player.category, totalPoints: 0, totalGames: 0, medals: { gold: 0, silver: 0, bronze: 0 }, g: 0, e: 0, p: 0 };
                  }
                  const stats = playerStats[result.playerId];
                  stats.totalPoints += result.points;
                  stats.totalGames += 1;
                  stats.g += result.g;
                  stats.e += result.e;
                  stats.p += result.p;

                  if (index === 0) stats.medals.gold += 1;
                  if (index === 1) stats.medals.silver += 1;
                  if (index === 2) stats.medals.bronze += 1;
                });
            });

            monthlyElevadorEvents.forEach(event => {
                event.results.sort((a, b) => {
                    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
                    if (b.pointsDifference !== a.pointsDifference) return b.pointsDifference - a.pointsDifference;
                    return b.pointsScored - a.pointsScored;
                });
                event.results.forEach((result, index) => {
                    const player = categoryPlayers.find(p => p.id === result.playerId);
                    if (!player) return;
                    if (!playerStats[result.playerId]) {
                        playerStats[result.playerId] = { name: player.name, category: player.category, totalPoints: 0, totalGames: 0, medals: { gold: 0, silver: 0, bronze: 0 }, g: 0, e: 0, p: 0 };
                    }
                    const stats = playerStats[result.playerId];
                    stats.totalPoints += result.pointsScored;
                    stats.g += result.gamesWon;
                    stats.p += result.gamesLost;
                    stats.totalGames += 1;
                    
                    if (index === 0) stats.medals.gold += 1;
                    if (index === 1) stats.medals.silver += 1;
                    if (index === 2) stats.medals.bronze += 1;
                });
            });
            
            // Medals from 6 Loco Parejas for Monthly Ranking
            monthlyPairEvents.filter(e => e.modality === '6locoParejas').forEach(event => {
                const sortedResults = [...event.results].sort((a, b) => b.points - a.points);
                sortedResults.forEach((result, index) => {
                    if (index > 2) return;
                    [result.player1.id, result.player2.id].forEach(pid => {
                        const stats = playerStats[pid];
                        if (stats) {
                            if (index === 0) stats.medals.gold += 1;
                            else if (index === 1) stats.medals.silver += 1;
                            else if (index === 2) stats.medals.bronze += 1;
                        }
                    });
                });
            });
            
            const rankedPlayers: MonthlyRankingPlayer[] = Object.entries(playerStats)
              .filter(([, stats]) => stats.totalGames >= 2)
              .map(([playerId, stats]) => {
                const avgPoints = stats.totalGames > 0 ? (stats.totalPoints / stats.totalGames) : 0;
                const rankScore = (avgPoints * 0.85) + (stats.totalGames * 1);
                return { playerId, name: stats.name, category: stats.category!, rankScore, totalGames: stats.totalGames, totalPoints: stats.totalPoints, avgPoints, medals: stats.medals, g: stats.g, e: stats.e, p: stats.p };
              })
              .sort((a, b) => {
                if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
                if (b.g !== a.g) return b.g - a.g; // Ganados
                if (b.e !== a.e) return b.e - a.e; // Empatados
                return a.p - b.p; // Menos perdidos
              });
            setIndividualRanking(rankedPlayers);

            const pairStats: { [key: string]: { player1: {id: string, name: string}, player2: {id: string, name: string}, category: Category, totalPoints: number; totalGames: number; medals: { gold: number; silver: number; bronze: number; }; g: number; e: number; p: number;} } = {};
            
            monthlyPairEvents.forEach(event => {
                event.results.sort((a,b) => b.points - a.points);
                event.results.forEach((result, index) => {
                    if(!pairStats[result.pairId]) {
                        pairStats[result.pairId] = {
                            player1: result.player1,
                            player2: result.player2,
                            category: event.category,
                            totalPoints: 0,
                            totalGames: 0,
                            medals: { gold: 0, silver: 0, bronze: 0 },
                            g: 0, e: 0, p: 0
                        }
                    }
                    const stats = pairStats[result.pairId];
                    stats.totalPoints += result.points;
                    stats.totalGames += 1;
                    stats.g += result.g;
                    stats.e += result.e;
                    stats.p += result.p;

                    if (index === 0) stats.medals.gold += 1;
                    if (index === 1) stats.medals.silver += 1;
                    if (index === 2) stats.medals.bronze += 1;
                });
            });

            const rankedPairs: MonthlyPairRankingPlayer[] = Object.entries(pairStats)
                .filter(([, stats]) => stats.totalGames >= 2)
                .map(([pairId, stats]) => {
                    const avgPoints = stats.totalGames > 0 ? (stats.totalPoints / stats.totalGames) : 0;
                    const rankScore = (avgPoints * 0.85) + (stats.totalGames * 1);
                    return { pairId, player1: stats.player1, player2: stats.player2, category: stats.category, rankScore, totalGames: stats.totalGames, totalPoints: stats.totalPoints, avgPoints, medals: stats.medals, g: stats.g, e: stats.e, p: stats.p };
                })
                .sort((a, b) => {
                    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
                    if (b.g !== a.g) return b.g - a.g;
                    if (b.e !== a.e) return b.e - a.e;
                    return a.p - b.p;
                });
            setPairRanking(rankedPairs);
            
        } catch (error) {
            console.error("Error calculating monthly ranking: ", error);
            toast({ title: "Error", description: "No se pudo calcular el ranking mensual.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
      }
      
      processRankings();
  }, [db, selectedMonth, category, toast]);

  useEffect(() => {
    calculateRankings();
  }, [calculateRankings]);


  const checkMonthStatus = useCallback(async () => {
    if (!selectedMonth || !category || !db) return;

    const checkStatus = async (collectionName: string, idSuffix: string) => {
        let docId = `${selectedMonth}-${idSuffix}`;
        let docRef = doc(db, collectionName, docId);
        let docSnap = await getDoc(docRef);

        if (!docSnap.exists() && idSuffix === '4ta') {
            docId = selectedMonth;
            docRef = doc(db, collectionName, docId);
            docSnap = await getDoc(docRef);
        }
        return docSnap.exists();
    }

    const isIndividualClosed = await checkStatus('monthlyRankings', category);
    const isPairsClosed = await checkStatus('monthlyPairRankings', category);
    
    setIsMonthClosed({ individual: isIndividualClosed, pairs: isPairsClosed });
}, [db, selectedMonth, category]);


  useEffect(() => {
    checkMonthStatus();
  }, [selectedMonth, category, checkMonthStatus]);
  
  const handleCloseMonth = async () => {
    if (!db) return;
    if (activeTab === '6loco' && individualRanking.length < 3) {
      toast({ title: "Error", description: "Se necesitan al menos 3 jugadores en el ranking individual para cerrar el mes.", variant: "destructive" });
      return;
    }
    if (activeTab === 'parejaFija' && pairRanking.length < 2) {
      toast({ title: "Error", description: "Se necesitan al menos 2 parejas en el ranking para cerrar el mes.", variant: "destructive" });
      return;
    }

    try {
      const batch = writeBatch(db);
      const monthId = `${selectedMonth}-${category}`;
      const achievements = ['king', 'shield', 'sword'] as const;
      
      if(activeTab === '6loco') {
        const monthRankingDocRef = doc(db, 'monthlyRankings', monthId);
        const rankingToSave: MonthlyRanking = { id: monthId, category, players: individualRanking };
        batch.set(monthRankingDocRef, rankingToSave);

        for (let i = 0; i < Math.min(individualRanking.length, 3); i++) {
          const player = individualRanking[i];
          const playerRef = doc(db, 'players', player.playerId);
          const playerDoc = await getDoc(playerRef);
          if(playerDoc.exists()) {
              const playerData = playerDoc.data() as Player;
              const newAchievements = playerData.achievements || { king: 0, shield: 0, sword: 0 };
              newAchievements[achievements[i]] = (newAchievements[achievements[i]] || 0) + 1;
              batch.update(playerRef, { achievements: newAchievements });
          }
        }
      } else { // parejaFija
        const monthRankingDocRef = doc(db, 'monthlyPairRankings', monthId);
        const rankingToSave: MonthlyPairRanking = { id: monthId, category, pairs: pairRanking };
        batch.set(monthRankingDocRef, rankingToSave);
      }

      await batch.commit();
      
      await checkMonthStatus();
      toast({ title: "Mes cerrado con éxito", description: `Se guardó el ranking de ${selectedMonthName} y se asignaron los logros.` });

    } catch (error) {
      console.error("Error closing month: ", error);
      toast({ title: "Error", description: "No se pudo cerrar el mes.", variant: "destructive" });
    }
  };

  const isCurrentModalityClosed = activeTab === '6loco' ? isMonthClosed.individual : isMonthClosed.pairs;
  
  const canCloseMonth = useMemo(() => {
    if (user?.role !== 'admin' || isCurrentModalityClosed || loading) {
        return false;
    }
    if (activeTab === '6loco') {
        return individualRanking.length >= 3;
    }
    return pairRanking.length >= 2;
  }, [user, isCurrentModalityClosed, loading, activeTab, individualRanking.length, pairRanking.length]);

  const individualPodiumPlayers: Player[] = useMemo(() => {
    return individualRanking.slice(0, 3).map(p => ({
        id: p.playerId,
        name: p.name,
        category: category,
        totalGames: p.totalGames,
        totalPoints: p.totalPoints,
        efficiency: 0,
        medals: p.medals,
        achievements: {king: 0, shield: 0, sword: 0},
        trophies: {first: 0, second: 0, third: 0}
    }));
  }, [individualRanking, category]);
  
  const pairPodiumPlayers: Player[] = useMemo(() => {
    return pairRanking.slice(0, 3).map(p => ({
        id: p.pairId,
        name: `${p.player1.name} & ${p.player2.name}`,
        category: category,
        totalGames: p.totalGames,
        totalPoints: p.totalPoints,
        efficiency: 0,
        medals: p.medals,
        achievements: {king: 0, shield: 0, sword: 0},
        trophies: {first: 0, second: 0, third: 0}
    }));
  }, [pairRanking, category]);

  return (
    <Card className="w-full 3xl:max-w-none">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
            <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="text-primary" />
                 <span className="text-yellow-400">
                    Ranking Mensual
                </span>
            </CardTitle>
          <CardDescription>Clasificación de la <span className="font-bold text-primary">{category}</span> categoría. Mínimo 2 eventos para aparecer.</CardDescription>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Selecciona un mes" />
                </SelectTrigger>
                <SelectContent>
                    {availableMonths.map(month => (
                        <SelectItem key={month.id} value={month.id}>{month.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            { user?.role === 'admin' && 
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!canCloseMonth}>
                      {isCurrentModalityClosed ? <CheckCircle className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                      {isCurrentModalityClosed ? 'Mes Cerrado' : 'Cerrar Mes'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro de cerrar el mes?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción es irreversible. Se guardará el ranking de <strong>{selectedMonthName} ({activeTab === '6loco' ? 'Individual' : 'Parejas'})</strong> para la categoría <span className="font-bold">{category}</span> y se asignarán los logros 👑, 🛡️, ⚔️ en el Ranking General.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCloseMonth}>Confirmar Cierre</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            }
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as '6loco' | 'parejaFija')} className="w-full">
            <TabsList className={cn("grid w-full", isAdmin ? "grid-cols-2" : "grid-cols-1")}>
                <TabsTrigger value="6loco"><User className="mr-2"/> Individual</TabsTrigger>
                {isAdmin && <TabsTrigger value="parejaFija"><Users className="mr-2"/> Parejas</TabsTrigger>}
            </TabsList>
            <TabsContent value="6loco">
                {loading ? (
                    <Skeleton className="h-48 w-full mt-4" />
                ) : individualRanking.length > 0 ? (
                    <Podium topPlayers={individualPodiumPlayers} />
                ) : null}
                <p className="font-bold text-lg my-4 capitalize">{selectedMonthName}</p>
                {isMonthClosed.individual && <p className="text-sm text-green-400 flex items-center gap-2 mb-4"><CheckCircle className="h-4 w-4"/>Este ranking mensual (individual) ya está cerrado y los logros han sido asignados.</p>}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-center">Puntaje</TableHead>
                      <TableHead className="text-center">Eventos</TableHead>
                      <TableHead className="text-center">G/E/P</TableHead>
                      <TableHead className="text-center">Medallas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                      ))
                    ) : individualRanking.length > 0 ? (
                      individualRanking.map((player, index) => (
                        <TableRow key={player.playerId}>
                          <TableCell className="font-bold">{index + 1}</TableCell>
                          <TableCell>{player.name}</TableCell>
                          <TableCell className="text-center font-semibold text-primary">{player.rankScore.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{player.totalGames}</TableCell>
                          <TableCell className="text-center">{`${player.g}/${player.e}/${player.p}`}</TableCell>
                           <TableCell className="text-center text-sm">
                            {(player.medals?.gold || 0) > 0 && <span className="gold-text">🥇 {player.medals.gold}</span>}
                            {(player.medals?.silver || 0) > 0 && <span className="mx-1 silver-text">🥈 {player.medals.silver}</span>}
                            {(player.medals?.bronze || 0) > 0 && <span className="bronze-text">🥉 {player.medals.bronze}</span>}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">No hay suficientes datos para generar el ranking individual de este mes.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
            </TabsContent>
            {isAdmin && (
                <TabsContent value="parejaFija">
                     {loading ? (
                        <Skeleton className="h-48 w-full mt-4" />
                    ) : pairRanking.length > 0 ? (
                        <Podium topPlayers={pairPodiumPlayers} />
                    ) : null}
                     <p className="font-bold text-lg my-4 capitalize">{selectedMonthName}</p>
                     {isMonthClosed.pairs && <p className="text-sm text-green-400 flex items-center gap-2 mb-4"><CheckCircle className="h-4 w-4"/>Este ranking mensual (parejas) ya está cerrado.</p>}
                     <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Pareja</TableHead>
                          <TableHead className="text-center">Puntaje</TableHead>
                          <TableHead className="text-center">Eventos</TableHead>
                          <TableHead className="text-center">G/E/P</TableHead>
                          <TableHead className="text-center">Medallas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                          ))
                        ) : pairRanking.length > 0 ? (
                          pairRanking.map((pair, index) => (
                            <TableRow key={pair.pairId}>
                              <TableCell className="font-bold">{index + 1}</TableCell>
                              <TableCell>{pair.player1.name} & {pair.player2.name}</TableCell>
                              <TableCell className="text-center font-semibold text-primary">{pair.rankScore.toFixed(2)}</TableCell>
                              <TableCell className="text-center">{pair.totalGames}</TableCell>
                              <TableCell className="text-center">{`${pair.g}/${pair.e}/${pair.p}`}</TableCell>
                               <TableCell className="text-center text-sm">
                                {(pair.medals?.gold || 0) > 0 && <span className="gold-text">🥇 {pair.medals.gold}</span>}
                                {(pair.medals?.silver || 0) > 0 && <span className="mx-1 silver-text">🥈 {pair.medals.silver}</span>}
                                {(pair.medals?.bronze || 0) > 0 && <span className="bronze-text">🥉 {pair.medals.bronze}</span>}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">No hay suficientes datos para generar el ranking de parejas de este mes.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                </TabsContent>
            )}
        </Tabs>
      </CardContent>
    </Card>
  );
};


const Ranking = () => {
    const { category } = useCategory();
    const { user } = useAuth();
    const isAdmin = user?.username === 'Admin';

    return (
        <Tabs defaultValue="general" className="w-full" key={category}>
            <TabsList className={cn("grid w-full", isAdmin ? "grid-cols-2" : "grid-cols-1")}>
                <TabsTrigger value="general"><BarChart className="mr-2"/> General</TabsTrigger>
                {isAdmin && <TabsTrigger value="mensual"><Calendar className="mr-2"/> Mensual</TabsTrigger>}
            </TabsList>
            <TabsContent value="general" className="mt-6">
                <RankingGeneralContent />
            </TabsContent>
            {isAdmin && (
                <TabsContent value="mensual" className="mt-6">
                    <RankingMensualContent />
                </TabsContent>
            )}
        </Tabs>
    )
}

export default Ranking;
