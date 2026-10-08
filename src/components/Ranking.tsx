
"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import type { Player, DailyEvent, DailyElevadorEvent, Category } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from './ui/skeleton';
import { Trophy, BarChart } from 'lucide-react';
import Podium from './Podium';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useCategory } from '@/context/CategoryContext';
import { useFirebase } from '@/context/FirebaseContext';

const RankingGeneralContent = () => {
    const { db } = useFirebase();
    const { category } = useCategory();
    const [individualPlayers, setIndividualPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    const calculateRankings = useCallback(async () => {
        if (!db) return;
        setLoading(true);
        try {
            const playersColl = collection(db, "players");
            const dailyEventsColl = collection(db, "dailyEvents");
            const dailyElevadorColl = collection(db, "dailyElevadorEvents");

            const [playersSnap, dailySnap, elevadorSnap] = await Promise.all([
                getDocs(playersColl), getDocs(dailyEventsColl), getDocs(dailyElevadorColl)
            ]);

            const allPlayers = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            
            const filterByCat = <T extends { category?: Category | null }>(list: T[]) => {
                const target = category.toLowerCase().trim();
                return list.filter(p => {
                    const pCat = (p.category || '').toLowerCase().trim();
                    if (target === '4ta') {
                        return pCat === '4ta' || pCat === '' || !p.category || pCat.includes('4ta');
                    }
                    return pCat === target;
                });
            };

            const catPlayers = filterByCat(allPlayers);
            const playerStats: Record<string, any> = {};
            catPlayers.forEach(p => playerStats[p.id] = { ...p, totalGames: 0, totalPoints: 0, medals: p.medals || {gold:0, silver:0, bronze:0}, achievements: p.achievements || {king:0, shield:0, sword:0} });

            const dailyDocs = dailySnap.docs.map(d => d.data() as DailyEvent);
            filterByCat(dailyDocs).forEach(event => {
                event.results.forEach((res) => {
                    if (playerStats[res.playerId]) {
                        playerStats[res.playerId].totalGames++;
                        playerStats[res.playerId].totalPoints += res.points;
                    }
                });
            });

            const elevadorDocs = elevadorSnap.docs.map(d => d.data() as DailyElevadorEvent);
            filterByCat(elevadorDocs).forEach(event => {
                event.results.forEach(res => {
                    if (playerStats[res.playerId]) {
                        playerStats[res.playerId].totalGames++;
                        playerStats[res.playerId].totalPoints += res.pointsScored;
                    }
                });
            });

            const enriched = Object.values(playerStats).sort((a:any, b:any) => {
                if ((b.achievements?.king || 0) !== (a.achievements?.king || 0)) return (b.achievements?.king || 0) - (a.achievements?.king || 0);
                if ((b.medals?.gold || 0) !== (a.medals?.gold || 0)) return (b.medals?.gold || 0) - (a.medals?.gold || 0);
                const avgA = a.totalGames > 0 ? a.totalPoints / a.totalGames : 0;
                const avgB = b.totalGames > 0 ? b.totalPoints / b.totalGames : 0;
                return avgB - avgA;
            });
            
            setIndividualPlayers(enriched as Player[]);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [db, category]);

    useEffect(() => {
        calculateRankings();
        if (!db) return;
        const unsub = onSnapshot(collection(db, "players"), calculateRankings);
        return () => unsub();
    }, [db, calculateRankings]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="text-yellow-400 h-8 w-8" /><span className="text-yellow-400">Ranking General</span></CardTitle>
        <CardDescription>Clasificación histórica - Categoría {category}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-48 w-full" /> : individualPlayers.length > 0 && <Podium topPlayers={individualPlayers.slice(0, 3)} />}
        <div className="overflow-x-auto mt-4">
          <Table>
            <TableHeader><TableRow><TableHead className="w-[50px]">#</TableHead><TableHead>Nombre</TableHead><TableHead className="text-center">PJ</TableHead><TableHead className="text-center">Prom.</TableHead><TableHead className="text-center">Logros</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full"/></TableCell></TableRow>)) : 
                individualPlayers.length > 0 ? individualPlayers.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold">{i + 1}</TableCell>
                    <TableCell className="uppercase font-medium">{p.name}</TableCell>
                    <TableCell className="text-center">{p.totalGames}</TableCell>
                    <TableCell className="text-center text-primary font-bold">{p.totalGames > 0 ? (p.totalPoints / p.totalGames).toFixed(2) : '0'}</TableCell>
                    <TableCell className="text-center"><div className="flex justify-center gap-2">
                        {(p.achievements?.king || 0) > 0 && <span className="gold-text">👑{p.achievements.king}</span>}
                        {(p.medals?.gold || 0) > 0 && <span className="gold-text">🥇{p.medals.gold}</span>}
                    </div></TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay jugadores registrados en esta categoría.</TableCell></TableRow>
              }
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

const Ranking = () => {
    return (
        <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="general"><BarChart className="mr-2"/> General</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-6"><RankingGeneralContent /></TabsContent>
        </Tabs>
    )
}

export default Ranking;
