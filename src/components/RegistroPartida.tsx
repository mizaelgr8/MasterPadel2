
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
import { Dices, Users, Trophy, Sparkles, Trash2, PlusCircle, User, Loader2, BarChart, CheckCircle, Info, ArrowLeft, ArrowRight, Gamepad2, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { useCategory } from '@/context/CategoryContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useFirebase } from '@/context/FirebaseContext';
import { ScrollArea } from './ui/scroll-area';

const sortPlayersByRank = (players: Player[]): Player[] => {
    return [...players].sort((a, b) => {
        const val = (v: number | undefined) => v || 0;
        const aAchievements = a.achievements || { king: 0, shield: 0, sword: 0 };
        const bAchievements = b.achievements || { king: 0, shield: 0, sword: 0 };
        if (val(bAchievements.king) !== val(aAchievements.king)) return bAchievements.king - aAchievements.king;
        if (val(bAchievements.shield) !== val(aAchievements.shield)) return bAchievements.shield - aAchievements.shield;
        if (val(bAchievements.sword) !== val(aAchievements.sword)) return bAchievements.sword - aAchievements.sword;
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
  const [searchQuery, setSearchQuery] = useState('');

  // Setup State
  const [eventName, setEventName] = useState('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [modality, setModality] = useState<Modality>('6loco');
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [fixedPairs, setFixedPairs] = useState<Pair[]>([]);
  const [player1Id, setPlayer1Id] = useState<string | null>(null);
  const [player2Id, setPlayer2Id] = useState<string | null>(null);

  const filteredPlayersList = useMemo(() => {
    if (!searchQuery) return allPlayers;
    return allPlayers.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allPlayers, searchQuery]);

  const availablePlayersForPairing = useMemo(() => {
    const pairedPlayerIds = new Set(fixedPairs.flatMap(p => [p.player1.id, p.player2.id]));
    return allPlayers.filter(p => !pairedPlayerIds.has(p.id));
  }, [allPlayers, fixedPairs]);

  const resetSetupState = useCallback(() => {
    setSelectedPlayers([]);
    setFixedPairs([]);
    setPlayer1Id(null);
    setPlayer2Id(null);
    setEventName('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setOpenAccordion("item-0");
    setSearchQuery('');
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsubPlayers = onSnapshot(collection(db, "players"), (snapshot) => {
      let playersList: Player[] = [];
      const allPlayersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      if (category === '4ta') {
          const modern = allPlayersList.filter(p => p.category === '4ta');
          const legacy = allPlayersList.filter(p => !p.category || p.category === '' || p.category === 'invitado');
          const combined = new Map<string, Player>();
          [...legacy, ...modern].forEach(p => combined.set(p.id, p));
          playersList = Array.from(combined.values());
      } else {
          playersList = allPlayersList.filter(p => p.category === category);
      }
      setAllPlayers(sortPlayersByRank(playersList));
    });
    return () => unsubPlayers();
  }, [db, category]);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const q = query(collection(db, "ongoingMatches"));
    const unsubOngoing = onSnapshot(q, (querySnapshot) => {
      const matches = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as OngoingMatch));
      const filtered = matches.filter(m => !m.category || m.category === category);
      setOngoingMatches(filtered);
      setLoading(false);
    }, (error) => {
        console.error("Error listening to ongoing matches:", error);
        setLoading(false);
    });
    return () => unsubOngoing();
  }, [db, category]);

  useEffect(() => {
    if (selectedMatch) {
        const updatedMatch = ongoingMatches.find(m => m.id === selectedMatch.id);
        setSelectedMatch(updatedMatch || null);
    }
  }, [ongoingMatches, selectedMatch]);
  
  useEffect(() => {
    if (view === 'loading' && !loading) {
      setView(ongoingMatches.length > 0 ? 'list' : 'setup');
    } else if (view === 'list' && ongoingMatches.length === 0 && !loading) {
      setView('setup');
    } else if (view === 'match' && !selectedMatch) {
      setView('list');
    }
  }, [view, ongoingMatches, selectedMatch, loading]);

  const handlePlayerToggle = (player: Player) => {
    setSelectedPlayers(prev => {
        const isSelected = prev.some(p => p.id === player.id);
        if (isSelected) return prev.filter(p => p.id !== player.id);
        return [...prev, player];
    });
  };
  
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };
  
  const generate6locoRounds = (): Round[] => {
    const numRounds = 7;
    const newRounds: Round[] = [];
    let historicPairs = new Set<string>();
    for (let i = 0; i < numRounds; i++) {
        let roundMatches: Match[] = [];
        let playersForRound = shuffleArray([...selectedPlayers]);
        let usedPlayersInRound = new Set<string>();
        let roundPossible = false;
        let attempts = 0;
        while(!roundPossible && attempts < 50) {
            roundMatches = [];
            usedPlayersInRound.clear();
            playersForRound = shuffleArray(playersForRound);
            let tempPairs = new Set(historicPairs);
            while (usedPlayersInRound.size < selectedPlayers.length) {
                const available = playersForRound.filter(p => !usedPlayersInRound.has(p.id));
                if (available.length < 4) break;
                let found = false;
                for (let p1 = 0; p1 < available.length; p1++) {
                    for (let p2 = p1 + 1; p2 < available.length; p2++) {
                        const pair1Id = [available[p1].id, available[p2].id].sort().join('--');
                        if (tempPairs.has(pair1Id)) continue;
                        const remaining = available.filter((_, idx) => idx !== p1 && idx !== p2);
                        if (remaining.length < 2) continue;
                        for (let p3 = 0; p3 < remaining.length; p3++) {
                            for (let p4 = p3 + 1; p4 < remaining.length; p4++) {
                                const pair2Id = [remaining[p3].id, remaining[p4].id].sort().join('--');
                                if (tempPairs.has(pair2Id)) continue;
                                roundMatches.push({
                                    team1: { id: pair1Id, player1: available[p1], player2: available[p2] },
                                    team2: { id: pair2Id, player1: remaining[p3], player2: remaining[p4] },
                                    score1: null, score2: null,
                                    courtNumber: roundMatches.length + 1
                                });
                                [available[p1].id, available[p2].id, remaining[p3].id, remaining[p4].id].forEach(id => usedPlayersInRound.add(id));
                                tempPairs.add(pair1Id); tempPairs.add(pair2Id);
                                found = true; break;
                            }
                            if(found) break;
                        }
                        if(found) break;
                    }
                    if(found) break;
                }
                if (!found) break;
            }
            if (usedPlayersInRound.size === selectedPlayers.length) {
                roundPossible = true; historicPairs = tempPairs;
            } else attempts++;
        }
        if (roundPossible) newRounds.push({ matches: roundMatches, isBonus: i === numRounds - 1 });
        else return [];
    }
    return newRounds;
  };

  const generate6locoParejasRounds = (): Round[] => {
    const numRounds = 7;
    const rounds: Round[] = [];
    const n = fixedPairs.length;
    if (n < 2) return [];
    const ps = [...fixedPairs];
    if (n % 2 !== 0) {
        const dummy: Player = { id: 'dummy', name: 'Descansa', category: category, totalGames: 0, totalPoints: 0, efficiency: 0, medals: { gold: 0, silver: 0, bronze: 0 }, achievements: { king: 0, shield: 0, sword: 0 }, trophies: {first:0, second:0, third:0} };
        ps.push({ id: 'dummy-pair', player1: dummy, player2: dummy });
    }
    const numTeams = ps.length;
    for (let r = 0; r < numRounds; r++) {
        const matches: Match[] = [];
        for (let i = 0; i < numTeams / 2; i++) {
            const t1 = ps[i];
            const t2 = ps[numTeams - 1 - i];
            if (t1.id !== 'dummy-pair' && t2.id !== 'dummy-pair') {
                matches.push({
                    team1: t1,
                    team2: t2,
                    score1: null,
                    score2: null,
                    courtNumber: matches.length + 1
                });
            }
        }
        rounds.push({ matches, isBonus: r === numRounds - 1 });
        const last = ps.pop()!;
        ps.splice(1, 0, last);
    }
    return rounds;
  };

  const generateAmericanoRounds = (): AmericanoRound[] => {
    let pairs = [...fixedPairs];
    if (pairs.length % 2 !== 0) {
        const dummy: Player = { id: 'dummy', name: 'Descansa', category: category, totalGames: 0, totalPoints: 0, efficiency: 0, medals: { gold: 0, silver: 0, bronze: 0 }, achievements: { king: 0, shield: 0, sword: 0 }, trophies: {first:0, second:0, third:0} };
        pairs.push({ id: 'dummy-pair', player1: dummy, player2: dummy });
    }
    const rounds: AmericanoRound[] = [];
    const numRounds = pairs.length - 1;
    for (let i = 0; i < numRounds; i++) {
        const roundMatches: AmericanoMatch[] = [];
        for (let j = 0; j < pairs.length / 2; j++) {
            const t1 = pairs[j]; const t2 = pairs[pairs.length - 1 - j];
            if (t1.id !== 'dummy-pair' && t2.id !== 'dummy-pair') {
                 roundMatches.push({ 
                    team1: t1, team2: t2, 
                    set1_t1: null, set1_t2: null, 
                    set2_t1: null, set2_t2: null, 
                    set3_t1: null, set3_t2: null,
                    courtNumber: roundMatches.length + 1
                });
            }
        }
        rounds.push({ roundNumber: i + 1, matches: roundMatches });
        const last = pairs.pop(); if(last) pairs.splice(1, 0, last);
    }
    return rounds;
  };

  const generateRounds = async () => {
    let newDocData: Omit<OngoingMatch, 'id'>;
    const finalName = eventName || (modality === '6loco' ? '6 Loco Individual' : modality === '6locoParejas' ? '6 Loco Parejas' : 'Liga');
    if (modality === '6loco') {
        if (selectedPlayers.length < 8 || selectedPlayers.length % 4 !== 0) {
            toast({ title: "Error", description: "Se necesitan 8, 12 o 16 jugadores.", variant: "destructive" });
            return;
        }
        const rounds = generate6locoRounds();
        if (rounds.length === 0) { toast({title: "Error", description: "No se pudo generar la rotación."}); return; }
        newDocData = { eventName: finalName, date, modality, selectedPlayers, rounds, fixedPairs: [], americanoRounds: [], category };
    } else if (modality === '6locoParejas') {
        if (fixedPairs.length < 2) {
            toast({ title: "Error", description: "Se necesitan al menos 2 parejas.", variant: "destructive" });
            return;
        }
        const rounds = generate6locoParejasRounds();
        newDocData = { eventName: finalName, date, modality, fixedPairs, rounds, selectedPlayers: [], americanoRounds: [], category };
    } else {
        if (fixedPairs.length < 3) {
            toast({ title: "Error", description: "Se necesitan al menos 3 parejas.", variant: "destructive" });
            return;
        }
        const rounds = generateAmericanoRounds();
        newDocData = { eventName: finalName, date, modality, fixedPairs, americanoRounds: rounds, selectedPlayers: [], rounds: [], category };
    }
    try {
        const newDocRef = await addDoc(collection(db!, "ongoingMatches"), newDocData);
        setSelectedMatch({ ...newDocData, id: newDocRef.id });
        setView('match');
        resetSetupState();
    } catch (e) { toast({title: "Error", description: "No se pudo crear la partida.", variant: "destructive"}) }
  };

  const calculatedResults = useMemo(() => {
    if (!selectedMatch || !selectedMatch.rounds || (selectedMatch.modality !== '6loco' && selectedMatch.modality !== '6locoParejas')) return [];
    const isIndividual = selectedMatch.modality === '6loco';
    const compRounds = selectedMatch.rounds.filter(r => !r.isBonus);
    const stats: Record<string, any> = {};
    if (isIndividual) {
        selectedMatch.selectedPlayers.forEach(p => {
            stats[p.id] = { playerId: p.id, name: p.name, points: 0, g:0, e:0, p:0, wins: 0, draws: 0, losses: 0 };
        });
    } else {
        selectedMatch.fixedPairs.forEach(pair => {
            stats[pair.id] = { pairId: pair.id, name: `${pair.player1.name} & ${pair.player2.name}`, player1: pair.player1, player2: pair.player2, points: 0, g:0, e:0, p:0, wins: 0, draws: 0, losses: 0 };
        });
    }
    compRounds.forEach(round => {
        round.matches.forEach(match => {
            const { team1, team2, score1, score2 } = match;
            if (score1 === null || score2 === null) return;
            const t1Won = score1 > score2;
            const isDraw = score1 === score2;
            if (isIndividual) {
                [team1.player1.id, team1.player2.id].forEach(id => {
                    if (stats[id]) {
                        stats[id].points += score1;
                        if (t1Won) stats[id].wins++; else if (isDraw) stats[id].draws++; else stats[id].losses++;
                    }
                });
                [team2.player1.id, team2.player2.id].forEach(id => {
                    if (stats[id]) {
                        stats[id].points += score2;
                        if (!t1Won && !isDraw) stats[id].wins++; else if (isDraw) stats[id].draws++; else stats[id].losses++;
                    }
                });
            } else {
                if (stats[team1.id]) {
                    stats[team1.id].points += score1;
                    if (t1Won) stats[team1.id].wins++; else if (isDraw) stats[team1.id].draws++; else stats[team1.id].losses++;
                }
                if (stats[team2.id]) {
                    stats[team2.id].points += score2;
                    if (!t1Won && !isDraw) stats[team2.id].wins++; else if (isDraw) stats[team2.id].draws++; else stats[team2.id].losses++;
                }
            }
        });
    });
    Object.values(stats).forEach(p => { p.g = p.wins; p.e = p.draws; p.p = p.losses; });
    return Object.values(stats).sort((a,b) => b.points - a.points || b.wins - a.wins || b.draws - a.draws);
  }, [selectedMatch]);

  const americanoRanking = useMemo(() => {
    if (!selectedMatch || selectedMatch.modality !== 'parejaFija') return [];
    const stats: Record<string, AmericanoRankingEntry> = {};
    selectedMatch.fixedPairs.forEach(pair => {
      stats[pair.id] = { pairId: pair.id, name: pair.player1.name + ' & ' + pair.player2.name, team: pair, points: 0, matchesPlayed: 0, matchesWon: 0, matchesLost: 0, stonesPlayed: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0 };
    });
    selectedMatch.americanoRounds.forEach(round => {
      round.matches.forEach(match => {
        const { team1, team2, set1_t1, set1_t2, set2_t1, set2_t2, set3_t1, set3_t2 } = match;
        if (set1_t1 === null || set1_t2 === null || set2_t1 === null || set2_t2 === null) return;
        const t1 = stats[team1.id]; const t2 = stats[team2.id]; if(!t1 || !t2) return;
        t1.matchesPlayed++; t2.matchesPlayed++;
        let s1 = 0; let s2 = 0;
        if(set1_t1 > set1_t2) s1++; else s2++;
        if(set2_t1 > set2_t2) s1++; else s2++;
        if(s1 !== 2 && s2 !== 2 && set3_t1 !== null) { if(set3_t1 > set3_t2!) s1++; else s2++; }
        t1.setsWon += s1; t1.setsLost += s2; t2.setsWon += s2; t2.setsLost += s1;
        t1.gamesWon += (set1_t1 || 0) + (set2_t1 || 0) + (set3_t1 || 0);
        t1.gamesLost += (set1_t2 || 0) + (set2_t2 || 0) + (set3_t2 || 0);
        t2.gamesWon += (set1_t2 || 0) + (set2_t2 || 0) + (set3_t2 || 0);
        t2.gamesLost += (set1_t1 || 0) + (set2_t1 || 0) + (set3_t1 || 0);
        if(s1 > s2) { t1.matchesWon++; t2.matchesLost++; t1.points += (s1===2 && s2===0) ? 3 : 2; t2.points += (s1===2 && s2===1) ? 1 : 0; }
        else { t2.matchesWon++; t1.matchesLost++; t2.points += (s2===2 && s1===0) ? 3 : 2; t1.points += (s2===2 && s1===1) ? 1 : 0; }
      });
    });
    return Object.values(stats).sort((a,b) => b.points - a.points || b.matchesWon - a.matchesWon || (b.setsWon-b.setsLost) - (a.setsWon-a.setsLost));
  }, [selectedMatch]);

  const handleScoreChange = (ri: number, mi: number, team: 'team1' | 'team2', val: string) => {
    if(!selectedMatch || user?.role === 'guest') return;
    const score = parseInt(val, 10);
    const newRounds = JSON.parse(JSON.stringify(selectedMatch.rounds));
    if(val === '') { newRounds[ri].matches[mi].score1 = null; newRounds[ri].matches[mi].score2 = null; }
    else if(!isNaN(score) && score >= 0 && score <= 6) {
        if(team === 'team1') { newRounds[ri].matches[mi].score1 = score; newRounds[ri].matches[mi].score2 = 6 - score; }
        else { newRounds[ri].matches[mi].score2 = score; newRounds[ri].matches[mi].score1 = 6 - score; }
    } else return;
    updateDoc(doc(db!, "ongoingMatches", selectedMatch.id), { rounds: newRounds });
  };

  const handleAmScoreChange = (ri: number, mi: number, field: string, val: string) => {
    if(!selectedMatch || user?.role === 'guest') return;
    const score = parseInt(val, 10);
    const newRounds = JSON.parse(JSON.stringify(selectedMatch.americanoRounds));
    newRounds[ri].matches[mi][field] = isNaN(score) ? null : score;
    if(field === 'set3_t1' && !isNaN(score)) newRounds[ri].matches[mi].set3_t2 = 1 - score;
    if(field === 'set3_t2' && !isNaN(score)) newRounds[ri].matches[mi].set3_t1 = 1 - score;
    updateDoc(doc(db!, "ongoingMatches", selectedMatch.id), { americanoRounds: newRounds });
  };

  const saveFinalEvent = async () => {
    if(!db || !selectedMatch) return;
    setIsSaving(true);
    try {
        const isPairModality = selectedMatch.modality === 'parejaFija' || selectedMatch.modality === '6locoParejas';
        const collName = isPairModality ? 'dailyPairEvents' : 'dailyEvents';
        const collRef = collection(db, collName);
        const batch = writeBatch(db);
        const newDoc = doc(collRef);
        const medalFields = ['medals.gold', 'medals.silver', 'medals.bronze'] as const;

        if(selectedMatch.modality === '6loco') {
            const results: DailyResult[] = calculatedResults.map(r => ({ playerId: r.playerId, name: r.name, points: r.points, g: r.g, e: r.e, p: r.p }));
            batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results, modality: '6loco', category });
            for(let i=0; i<Math.min(results.length, 3); i++) {
                const pRef = doc(db, 'players', results[i].playerId);
                const field = i === 0 ? 'medals.gold' : i === 1 ? 'medals.silver' : 'medals.bronze';
                batch.update(pRef, { [field]: increment(1) });
            }
        } else if (selectedMatch.modality === '6locoParejas') {
            const results: DailyPairResult[] = calculatedResults.map(r => ({ pairId: r.pairId, player1: r.player1, player2: r.player2, points: r.points, g: r.g, p: r.p, e: r.e }));
            batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results, modality: '6locoParejas', category });
            for(let i=0; i<Math.min(results.length, 3); i++) {
                const res = results[i];
                const field = medalFields[i];
                [res.player1.id, res.player2.id].forEach(pid => batch.update(doc(db, 'players', pid), { [field]: increment(1) }));
            }
        } else {
            const results: DailyPairResult[] = americanoRanking.map(r => ({ pairId: r.pairId, player1: r.team.player1, player2: r.team.player2, points: r.points, g: r.matchesWon, p: r.matchesLost, e: 0 }));
            batch.set(newDoc, { id: newDoc.id, date: selectedMatch.date, name: selectedMatch.eventName, results, modality: 'parejaFija', category });
        }
        await batch.commit();
        await deleteDoc(doc(db, "ongoingMatches", selectedMatch.id));
        setSelectedMatch(null); setView('list');
        toast({ title: "Guardado" });
    } catch(e) { toast({title: "Error", variant: "destructive"}); }
    finally { setIsSaving(false); }
  };

  if (view === 'loading') return <Card><CardContent className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent></Card>;

  if (view === 'list') return (
    <Card>
      <CardHeader><div className='flex justify-between items-center'><CardTitle><span className="text-yellow-400">Partidas en Curso</span></CardTitle>{user?.role === 'admin' && <Button onClick={() => setView('setup')} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Nueva</Button>}</div></CardHeader>
      <CardContent className="space-y-2">
        {ongoingMatches.map(m => (
          <div key={m.id} onClick={() => { setSelectedMatch(m); setView('match'); }} className="p-4 border rounded-lg hover:bg-muted cursor-pointer flex justify-between items-center transition-colors">
            <div><p className="font-bold">{m.eventName || 'Partida'}</p><p className="text-xs text-muted-foreground">{m.date} - {m.modality}</p></div>
            <ArrowRight className="h-4 w-4 text-muted-foreground"/>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (view === 'match' && selectedMatch) return (
    <div className="space-y-6">
      <div className='flex justify-between items-center'>
        <Button variant="outline" size="sm" onClick={() => setView('list')}><ArrowLeft className="mr-2 h-4 w-4"/>Atrás</Button>
        {user?.role === 'admin' && <Button variant="destructive" size="sm" onClick={() => deleteDoc(doc(db!, "ongoingMatches", selectedMatch.id))}><Trash2 className="h-4 w-4"/></Button>}
      </div>
      <Card><CardHeader><CardTitle>{selectedMatch.eventName}</CardTitle></CardHeader>
      <CardContent>
        {selectedMatch.modality === '6loco' || selectedMatch.modality === '6locoParejas' ? (
          <Accordion type="single" collapsible className="w-full" value={openAccordion} onValueChange={setOpenAccordion}>
            {selectedMatch.rounds.map((r, ri) => (
              <AccordionItem value={`item-${ri}`} key={ri}><AccordionTrigger className={cn(r.isBonus && "gold-text")}>Ronda {ri+1} {r.isBonus && '(Bonus)'}</AccordionTrigger><AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {r.matches.map((m, mi) => (
                    <div key={mi} className="space-y-1">
                      <div className="text-[10px] font-black text-blue-500 uppercase px-1">Cancha {m.courtNumber || mi + 1}</div>
                      <div className='flex items-center gap-2 p-2 bg-muted rounded-md'>
                        <div className='flex-1 flex flex-col items-end gap-1 overflow-hidden min-h-[60px] justify-center'>
                            <span className='text-[10px] font-black uppercase text-right w-full leading-tight'>{m.team1.player1.name}</span>
                            <span className='text-[10px] font-black uppercase text-right w-full leading-tight'>{m.team1.player2.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Input type="text" pattern="[0-6]*" inputMode="numeric" value={m.score1 ?? ''} onChange={e => handleScoreChange(ri, mi, 'team1', e.target.value)} className="w-9 h-8 text-center p-0 text-sm font-black" disabled={user?.role === 'guest'} />
                          <span className="font-bold text-primary">-</span>
                          <Input type="text" pattern="[0-6]*" inputMode="numeric" value={m.score2 ?? ''} onChange={e => handleScoreChange(ri, mi, 'team2', e.target.value)} className="w-9 h-8 text-center p-0 text-sm font-black" disabled={user?.role === 'guest'} />
                        </div>
                        <div className='flex-1 flex flex-col items-start gap-1 overflow-hidden min-h-[60px] justify-center'>
                            <span className='text-[10px] font-black uppercase w-full leading-tight'>{m.team2.player1.name}</span>
                            <span className='text-[10px] font-black uppercase w-full leading-tight'>{m.team2.player2.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent></AccordionItem>
            ))}
          </Accordion>
        ) : (
          <Accordion type="single" collapsible className="w-full" value={openAccordion} onValueChange={setOpenAccordion}>
            {selectedMatch.americanoRounds.map((r, ri) => (
              <AccordionItem value={`item-${ri}`} key={ri}><AccordionTrigger>Ronda {r.roundNumber}</AccordionTrigger><AccordionContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {r.matches.map((m, mi) => (
                    <div key={mi} className="p-3 border rounded-lg bg-background/50 space-y-2">
                      <div className="text-[10px] font-black text-blue-500 uppercase border-b pb-1 mb-1">Cancha {m.courtNumber || mi + 1}</div>
                      <div className="flex justify-between text-[10px] font-black uppercase"><span className="flex-1 text-right truncate">{m.team1.player1.name}/{m.team1.player2.name}</span><span className="px-2 text-primary">VS</span><span className="flex-1 truncate">{m.team2.player1.name}/{m.team2.player2.name}</span></div>
                      <div className="flex justify-center gap-4">{[1,2,3].map(s => (
                        <div key={s} className="text-center space-y-1"><p className="text-[9px] opacity-50 uppercase">Set {s}</p><div className="flex gap-1">
                          <Input type="text" pattern="[0-7]*" inputMode="numeric" className="w-8 h-8 text-center p-0 text-xs" value={m[`set${s}_t1` as keyof AmericanoMatch] ?? ''} onChange={e => handleAmScoreChange(ri, mi, `set${s}_t1`, e.target.value)} disabled={user?.role === 'guest'} />
                          <Input type="text" pattern="[0-7]*" inputMode="numeric" className="w-8 h-8 text-center p-0 text-xs" value={m[`set${s}_t2` as keyof AmericanoMatch] ?? ''} onChange={e => handleAmScoreChange(ri, mi, `set${s}_t2`, e.target.value)} disabled={user?.role === 'guest'} />
                        </div></div>
                      ))}</div>
                    </div>
                  ))}
                </div>
              </AccordionContent></AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className='text-lg'>Clasificación</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Nombre</TableHead><TableHead className="text-center">Pts</TableHead></TableRow></TableHeader><TableBody>
          {(selectedMatch.modality === '6loco' || selectedMatch.modality === '6locoParejas' ? calculatedResults : americanoRanking).map((p, i) => (
            <TableRow key={i} className={cn("h-10", i<3 && 'bg-primary/5 font-bold')}>
              <TableCell className="text-xs">{i+1}</TableCell><TableCell className="truncate max-w-[150px] text-xs uppercase">{p.name}</TableCell><TableCell className="text-center text-primary font-bold text-xs">{p.points}</TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
        {user?.role === 'admin' && <div className="flex justify-end mt-6"><Button onClick={saveFinalEvent} disabled={isSaving}><Sparkles className="mr-2 h-4 w-4"/>{isSaving ? '...':'Guardar'}</Button></div>}
      </CardContent></Card>
    </div>
  );

  return (
    <Card className="w-full 3xl:max-w-4xl 3xl:mx-auto">
      <CardHeader><div><CardTitle><span className="text-yellow-400">Configurar Partida</span></CardTitle><CardDescription>{category} Cat.</CardDescription></div></CardHeader>
      <CardContent>{user?.role === 'guest' ? <Alert><Info className="h-4 w-4" /><AlertTitle>Solo vista</AlertTitle><AlertDescription>Solo administradores pueden crear partidas.</AlertDescription></Alert> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Fecha</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><Label>Nombre</Label><Input placeholder="Mañana, Mizael, etc." value={eventName} onChange={e => setEventName(e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Modalidad</Label><Select value={modality} onValueChange={v => { resetSetupState(); setModality(v as Modality); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="6loco">6 Loco (Individual)</SelectItem><SelectItem value="6locoParejas">6 Loco (Parejas)</SelectItem><SelectItem value="parejaFija">Liga</SelectItem></SelectContent></Select></div>
          </div>
          {modality === '6loco' ? (
            <div>
                <Label>Jugadores ({selectedPlayers.length})</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start mt-2 border-primary/20">
                            <Users className="mr-2 h-4 w-4" /> Seleccionar Jugadores
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-4 bg-slate-900 border-slate-700">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar..." 
                                    className="h-8 border-none bg-transparent focus-visible:ring-0 p-0 text-sm" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="h-[300px] pr-4">
                                <div className="space-y-2">
                                    {filteredPlayersList.map(p => (
                                        <div key={p.id} className="flex items-center space-x-3 p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer" onClick={() => handlePlayerToggle(p)}>
                                            <Checkbox 
                                                id={`p-${p.id}`} 
                                                checked={selectedPlayers.some(sp => sp.id === p.id)}
                                                onCheckedChange={() => handlePlayerToggle(p)}
                                            />
                                            <Label htmlFor={`p-${p.id}`} className="text-sm font-normal cursor-pointer uppercase truncate flex-1">
                                                {p.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </PopoverContent>
                </Popover>
                {selectedPlayers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-4">
                        {selectedPlayers.map(p => (
                            <div key={p.id} className="bg-primary/20 text-primary-foreground text-[10px] px-2 py-1 rounded uppercase font-bold border border-primary/30 flex items-center gap-1">
                                {p.name}
                                <button onClick={() => handlePlayerToggle(p)} className="hover:text-red-400">×</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          ) : (
            <div className="space-y-4">
              <div><Label>Crear Pareja ({fixedPairs.length})</Label><div className="flex gap-2 mt-2">
                <Select value={player1Id || ''} onValueChange={setPlayer1Id}><SelectTrigger><SelectValue placeholder="J1" /></SelectTrigger><SelectContent>{availablePlayersForPairing.filter(p => p.id !== player2Id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                <Select value={player2Id || ''} onValueChange={setPlayer2Id}><SelectTrigger><SelectValue placeholder="J2" /></SelectTrigger><SelectContent>{availablePlayersForPairing.filter(p => p.id !== player1Id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                <Button onClick={() => { const p1 = allPlayers.find(p => p.id === player1Id); const p2 = allPlayers.find(p => p.id === player2Id); if(p1 && p2) { setFixedPairs([...fixedPairs, { id: [p1.id, p2.id].sort().join('-'), player1: p1, player2: p2 }]); setPlayer1Id(null); setPlayer2Id(null); } }} size="icon"><PlusCircle/></Button>
              </div></div>
              <div className="border rounded-md p-2 space-y-2">{fixedPairs.map(p => (<div key={p.id} className="flex justify-between bg-muted p-2 rounded text-[10px] font-black uppercase">{p.player1.name} & {p.player2.name}<Button variant="ghost" size="icon" onClick={() => setFixedPairs(fixedPairs.filter(fp => fp.id !== p.id))}><Trash2 className="h-4 w-4"/></Button></div>))}</div>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t"><Button onClick={generateRounds} disabled={modality==='6loco'?selectedPlayers.length<8:fixedPairs.length<2} className="w-full md:w-auto"><Dices className="mr-2"/> Iniciar Partida Automática</Button></div>
        </div>
      )}</CardContent>
    </Card>
  );
};

export default RegistroPartida;
