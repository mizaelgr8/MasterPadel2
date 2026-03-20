
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, query, orderBy, getDoc, deleteDoc, where, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import type { Player, TournamentPair, TournamentMatch, TournamentGroup, CompletedTournament, OngoingTournament, Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Dices, Users, Trash2, PlusCircle, ArrowRight, Trophy, Save, History, Star, Loader2, ArrowLeft, Info, Gamepad2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from './ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { useCategory } from '@/context/CategoryContext';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { useFirebase } from '@/context/FirebaseContext';


type Stage = 'setup' | 'group' | 'eliminatorias';

type HallOfFameEntry = {
    playerId: string;
    name: string;
    trophies: { first: number; second: number; third: number };
    tournamentsPlayed: number;
    totalPoints: number;
    averagePoints: number;
    score: number;
};

const calculateTotalTournamentStats = (tourney: CompletedTournament) => {
    const totalStats = new Map<string, { won: number; lost: number; points: number }>();

    const allPairsFromGroups = [...tourney.groups.A.pairs, ...tourney.groups.B.pairs];
    allPairsFromGroups.forEach(pair => {
        const groupData = tourney.groups.A.pairs.some(p => p.id === pair.id) ? tourney.groups.A : tourney.groups.B;
        const groupStandings = calculateGroupStandings(groupData);
        const groupStats = groupStandings.find(p => p.id === pair.id)?.stats;

        if (groupStats) {
            totalStats.set(pair.id, { won: groupStats.won, lost: groupStats.lost, points: groupStats.points });
        } else {
             totalStats.set(pair.id, { won: 0, lost: 0, points: 0 });
        }
    });

    const knockoutMatches = [
        ...(tourney.semifinals || []),
        ...(tourney.silverSemifinals || []),
        ...(tourney.finals || [])
    ];

    knockoutMatches.forEach(match => {
        if (match.score1 === null || match.score2 === null) return;

        const team1Stats = totalStats.get(match.team1.id);
        const team2Stats = totalStats.get(match.team2.id);

        if (!team1Stats || !team2Stats) return;
        
        team1Stats.points += match.score1;
        team2Stats.points += match.score2;

        if (match.score1 > match.score2) {
            team1Stats.won++;
            team2Stats.lost++;
        } else if (match.score2 > match.score1) {
            team2Stats.won++;
            team1Stats.lost++;
        }
    });

    return totalStats;
};


const calculateGroupStandings = (group: TournamentGroup) => {
    const pairsWithStats: TournamentPair[] = JSON.parse(JSON.stringify(group.pairs));
    pairsWithStats.forEach(p => {
        p.stats = { played: 0, won: 0, lost: 0, points: 0 };
    });

    const pairMap = new Map(pairsWithStats.map(p => [p.id, p]));

    group.matches.forEach(match => {
        if(match.score1 === null || match.score2 === null) return;
        
        const team1 = pairMap.get(match.team1.id);
        const team2 = pairMap.get(match.team2.id);

        if (!team1 || !team2) return;

        team1.stats.played++;
        team2.stats.played++;
        team1.stats.points += match.score1;
        team2.stats.points += match.score2;

        if (match.score1 > match.score2) {
            team1.stats.won++;
            team2.stats.lost++;
        } else if (match.score1 < match.score2) {
            team2.stats.won++;
            team1.stats.lost++;
        }
    });
    
    return [...pairMap.values()].sort((a, b) => {
        if (b.stats.won !== a.stats.won) return b.stats.won - a.stats.won;
        if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;

        const directMatch = group.matches.find(
            m => (m.team1.id === a.id && m.team2.id === b.id) || (m.team1.id === b.id && m.team2.id === a.id)
        );

        if (directMatch && directMatch.score1 !== null && directMatch.score2 !== null) {
            if (directMatch.team1.id === a.id) {
                if (directMatch.score1 > directMatch.score2) return -1;
                if (directMatch.score2 > directMatch.score1) return 1;
            } else { // team1 is b
                if (directMatch.score2 > directMatch.score1) return -1;
                if (directMatch.score1 > directMatch.score2) return 1;
            }
        }

        return 0;
    });
};


const Torneo = () => {
    const { db } = useFirebase();
    const { toast } = useToast();
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const { user } = useAuth();
    const { category } = useCategory();

    const [ongoingTournaments, setOngoingTournaments] = useState<OngoingTournament[]>([]);
    const [selectedTournament, setSelectedTournament] = useState<OngoingTournament | null>(null);
    const [view, setView] = useState<'loading' | 'list' | 'setup' | 'match'>('loading');

    // Setup state
    const [selectedPairs, setSelectedPairs] = useState<TournamentPair[]>([]);
    const [player1, setPlayer1] = useState<Player | null>(null);
    const [player2, setPlayer2] = useState<Player | null>(null);
    
    // History and Ranking State
    const [tournamentHistory, setTournamentHistory] = useState<CompletedTournament[]>([]);
    const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const resetSetupState = useCallback(() => {
        setSelectedPairs([]);
        setPlayer1(null);
        setPlayer2(null);
    }, []);

    const fetchPlayers = useCallback(async () => {
        if (!db) return;
        const playersCollection = collection(db, "players");
        let playersList: Player[] = [];
        if (category === '4ta') {
            const modernQuery = query(playersCollection, where("category", "==", '4ta'));
            const legacyQuery = query(playersCollection, where("category", "==", null));
            const [modernSnapshot, legacySnapshot] = await Promise.all([ getDocs(modernQuery), getDocs(legacyQuery) ]);
            const modernPlayers = modernSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            const legacyPlayers = legacySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
            const combined = new Map<string, Player>();
            [...legacyPlayers, ...modernPlayers].forEach(p => combined.set(p.id, p));
            playersList = Array.from(combined.values());
        } else {
            const q = query(playersCollection, where("category", "==", category));
            const snapshot = await getDocs(q);
            playersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        }
        setAllPlayers(playersList.sort((a,b) => a.name.localeCompare(b.name)));
    }, [category, db]);

    const fetchHistoryAndFame = useCallback(async () => {
        if (!db) return;
        setLoadingHistory(true);
        const historyQuery = query(collection(db, "tournaments"), where("category", "==", category));
        const historySnapshot = await getDocs(historyQuery);
        const historyList = historySnapshot.docs.map(doc => doc.data() as CompletedTournament);
        
        historyList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setTournamentHistory(historyList);

        const fame: Record<string, Omit<HallOfFameEntry, 'averagePoints' | 'score'>> = {};

        historyList.forEach(tourney => {
            const playerIdsInTournament = new Set<string>();
            const tourneyTotalStats = calculateTotalTournamentStats(tourney);

            tourney.standings.forEach((pair, index) => {
                const pairStats = tourneyTotalStats.get(pair.id);
                const playersInPair = [pair.player1, pair.player2];
                
                playersInPair.forEach(player => {
                    playerIdsInTournament.add(player.id);
                    if (!fame[player.id]) {
                        fame[player.id] = { 
                            playerId: player.id, name: player.name, 
                            trophies: { first: 0, second: 0, third: 0 },
                            tournamentsPlayed: 0,
                            totalPoints: 0,
                        };
                    }
                    if (index === 0) fame[player.id].trophies.first++;
                    if (index === 1) fame[player.id].trophies.second++;
                    if (index === 2) fame[player.id].trophies.third++;
                    if (pairStats) {
                        fame[player.id].totalPoints += pairStats.points;
                    }
                });
            });
            
            playerIdsInTournament.forEach(playerId => {
                if (fame[playerId]) {
                  fame[playerId].tournamentsPlayed++;
                }
            })

        });
        
        const fameWithCalcs: HallOfFameEntry[] = Object.values(fame).map(player => {
            const averagePoints = player.tournamentsPlayed > 0 ? player.totalPoints / player.tournamentsPlayed : 0;
            const score = (averagePoints * 0.75) + player.tournamentsPlayed;
            return { ...player, averagePoints, score };
        });

        const sortedFame = fameWithCalcs.sort((a, b) => {
            if (b.trophies.first !== a.trophies.first) return b.trophies.first - a.trophies.first;
            if (b.trophies.second !== a.trophies.second) return b.trophies.second - a.trophies.second;
            if (b.trophies.third !== a.trophies.third) return b.trophies.third - a.trophies.third;
            if (b.score !== a.score) return b.score - a.score;
            return b.averagePoints - a.averagePoints;
        });

        setHallOfFame(sortedFame);
        setLoadingHistory(false);
    }, [category, db]);
    
    useEffect(() => {
        fetchPlayers();
        fetchHistoryAndFame();
    }, [fetchPlayers, fetchHistoryAndFame, category]);
    
    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, "currentTournament"), where("category", "==", category));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tournaments = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as OngoingTournament));
            setOngoingTournaments(tournaments);
        }, (error) => {
            console.error("Error listening to current tournament:", error);
            toast({ title: "Error de Sincronización", description: "No se pudo conectar para ver el torneo en curso.", variant: "destructive" });
        });
        return () => unsubscribe();
    }, [category, db]);

    useEffect(() => {
        if (selectedTournament) {
            const updatedTournament = ongoingTournaments.find(t => t.id === selectedTournament.id);
            setSelectedTournament(updatedTournament || null);
        }
    }, [ongoingTournaments]);

    useEffect(() => {
        if (view === 'loading') {
            setView(ongoingTournaments.length > 0 ? 'list' : 'setup');
        } else if (view === 'list' && ongoingTournaments.length === 0) {
            setView('setup');
        } else if (view === 'match' && !selectedTournament) {
            setView('list');
        }
    }, [view, ongoingTournaments, selectedTournament]);


    const availablePlayers = useMemo(() => {
        const pairedPlayerIds = new Set(selectedPairs.flatMap(p => [p.player1.id, p.player2.id]));
        return allPlayers.filter(p => !pairedPlayerIds.has(p.id));
    }, [allPlayers, selectedPairs]);

    const handleAddPair = () => {
        if (player1 && player2 && player1.id !== player2.id) {
            if (selectedPairs.length >= 8) {
                toast({ title: "Límite alcanzado", description: "Ya has seleccionado 8 parejas para el torneo.", variant: "destructive" });
                return;
            }
            const newPair: TournamentPair = {
                id: [player1.id, player2.id].sort().join('-'),
                player1,
                player2,
                name: `${player1.name} & ${player2.name}`,
                stats: { played: 0, won: 0, lost: 0, points: 0 }
            };
            setSelectedPairs(prev => [...prev, newPair]);
            setPlayer1(null);
            setPlayer2(null);
        } else {
            toast({ title: "Error", description: "Selecciona dos jugadores diferentes para formar una pareja.", variant: "destructive" });
        }
    };

    const handleRemovePair = (pairId: string) => {
        setSelectedPairs(prev => prev.filter(p => p.id !== pairId));
    };

    const startTournament = async () => {
        if (!db) return;
        if (selectedPairs.length !== 8) {
            toast({ title: "Error", description: "Se necesitan exactamente 8 parejas para iniciar el torneo.", variant: "destructive" });
            return;
        }

        let shuffledPairs = [...selectedPairs].sort(() => 0.5 - Math.random());
        const groupA_pairs = shuffledPairs.slice(0, 4);
        const groupB_pairs = shuffledPairs.slice(4, 8);

        const createRoundRobinMatches = (pairs: TournamentPair[]): TournamentMatch[] => {
            const matches: TournamentMatch[] = [];
            if (pairs.length !== 4) return matches;
        
            const p = pairs;
            matches.push({ team1: p[0], team2: p[1], score1: null, score2: null });
            matches.push({ team1: p[2], team2: p[3], score1: null, score2: null });
            matches.push({ team1: p[0], team2: p[2], score1: null, score2: null });
            matches.push({ team1: p[1], team2: p[3], score1: null, score2: null });
            matches.push({ team1: p[0], team2: p[3], score1: null, score2: null });
            matches.push({ team1: p[1], team2: p[2], score1: null, score2: null });
            return matches;
        };

        const newGroups = {
            A: { name: 'A', pairs: groupA_pairs, matches: createRoundRobinMatches(groupA_pairs) },
            B: { name: 'B', pairs: groupB_pairs, matches: createRoundRobinMatches(groupB_pairs) }
        };

        const newTournamentData: Omit<OngoingTournament, 'id'> = {
            stage: 'group',
            selectedPairs,
            groups: newGroups,
            semifinals: [],
            silverSemifinals: [],
            finals: [],
            finalStandings: [],
            category,
        };

        try {
            const newDocRef = await addDoc(collection(db, "currentTournament"), newTournamentData);
            setSelectedTournament({ ...newTournamentData, id: newDocRef.id });
            setView('match');
            resetSetupState();
        } catch (e) {
            toast({ title: "Error", description: "No se pudo iniciar el torneo.", variant: "destructive"});
        }
    };

    const handleGroupScoreChange = (groupName: 'A' | 'B', matchIndex: number, team: 'team1' | 'team2', value: string) => {
        if (!selectedTournament || !selectedTournament.groups) return;
        const score = parseInt(value, 10);
        if (value !== '' && (isNaN(score) || score < 0 || score > 7)) return;

        const newGroups = JSON.parse(JSON.stringify(selectedTournament.groups));
        const match = newGroups[groupName].matches[matchIndex];
        const finalScore = isNaN(score) ? null : score;

        if (team === 'team1') {
            match.score1 = finalScore;
            if (finalScore !== null) match.score2 = 7 - finalScore; else match.score2 = null;
        } else {
            match.score2 = finalScore;
             if (finalScore !== null) match.score1 = 7 - finalScore; else match.score1 = null;
        }
        
        const docRef = doc(db, "currentTournament", selectedTournament.id);
        updateDoc(docRef, { groups: newGroups });
    };
    
    const areAllGroupMatchesPlayed = useMemo(() => {
        if (!selectedTournament || !selectedTournament.groups) return false;
        const allMatches = [...selectedTournament.groups.A.matches, ...selectedTournament.groups.B.matches];
        if(allMatches.length === 0) return false;
        return allMatches.every(m => m.score1 !== null && m.score2 !== null);
    }, [selectedTournament]);

    const startKnockoutStage = () => {
        if (!selectedTournament || !selectedTournament.groups) return;
        const standingsA = calculateGroupStandings(selectedTournament.groups.A);
        const standingsB = calculateGroupStandings(selectedTournament.groups.B);

        const newSemifinals = [
            { team1: standingsA[0], team2: standingsB[1], score1: null, score2: null }, // A1 vs B2
            { team1: standingsB[0], team2: standingsA[1], score1: null, score2: null }, // B1 vs A2
        ];
        const newSilverSemifinals = [
            { team1: standingsA[2], team2: standingsB[3], score1: null, score2: null }, // A3 vs B4
            { team1: standingsB[2], team2: standingsA[3], score1: null, score2: null }, // B3 vs A4
        ];
        
        const docRef = doc(db, "currentTournament", selectedTournament.id);
        updateDoc(docRef, {
            stage: 'eliminatorias',
            semifinals: newSemifinals,
            silverSemifinals: newSilverSemifinals,
            finals: [],
            finalStandings: [],
        });
    };

    const handleKnockoutScoreChange = (
        matchStateName: 'semifinals' | 'silverSemifinals' | 'finals',
        matchIndex: number, 
        team: 'team1' | 'team2', 
        value: string
    ) => {
        if (!selectedTournament) return;
        const score = parseInt(value, 10);
        if (value !== '' && (isNaN(score) || score < 0 || score > 7)) return;

        const currentMatches = selectedTournament[matchStateName] || [];
        const newMatches = JSON.parse(JSON.stringify(currentMatches));
        const match = newMatches[matchIndex];
        const finalScore = isNaN(score) ? null : score;

        if (team === 'team1') {
            match.score1 = finalScore;
            if(finalScore !== null) match.score2 = 7 - finalScore; else match.score2 = null;

        } else {
            match.score2 = finalScore;
            if(finalScore !== null) match.score1 = 7 - finalScore; else match.score1 = null;
        }
        
        const docRef = doc(db, "currentTournament", selectedTournament.id);
        updateDoc(docRef, { [matchStateName]: newMatches });
    };
    
    const areAllSemifinalsPlayed = useMemo(() => {
        if (!selectedTournament || !selectedTournament.semifinals?.length || !selectedTournament.silverSemifinals?.length) return false;
        const allSemis = [...selectedTournament.semifinals, ...selectedTournament.silverSemifinals];
        return allSemis.length > 0 && allSemis.every(m => m.score1 !== null && m.score2 !== null);
    }, [selectedTournament]);
    
    useEffect(() => {
        if (selectedTournament?.stage === 'eliminatorias' && areAllSemifinalsPlayed) {
            const getWinner = (match: TournamentMatch) => (match.score1! > match.score2! ? match.team1 : match.team2);
            const getLoser = (match: TournamentMatch) => (match.score1! < match.score2! ? match.team1 : match.team2);

            const semiWinner1 = getWinner(selectedTournament.semifinals[0]);
            const semiWinner2 = getWinner(selectedTournament.semifinals[1]);
            const semiLoser1 = getLoser(selectedTournament.semifinals[0]);
            const semiLoser2 = getLoser(selectedTournament.semifinals[1]);

            const silverWinner1 = getWinner(selectedTournament.silverSemifinals[0]);
            const silverWinner2 = getWinner(selectedTournament.silverSemifinals[1]);
            const silverLoser1 = getLoser(selectedTournament.silverSemifinals[0]);
            const silverLoser2 = getLoser(selectedTournament.silverSemifinals[1]);

            const newFinals = [
                { team1: semiWinner1, team2: semiWinner2, score1: selectedTournament.finals[0]?.score1 ?? null, score2: selectedTournament.finals[0]?.score2 ?? null }, // Main Final
                { team1: semiLoser1, team2: semiLoser2, score1: selectedTournament.finals[1]?.score1 ?? null, score2: selectedTournament.finals[1]?.score2 ?? null }, // 3rd Place
                { team1: silverWinner1, team2: silverWinner2, score1: selectedTournament.finals[2]?.score1 ?? null, score2: selectedTournament.finals[2]?.score2 ?? null }, // Silver Final
                { team1: silverLoser1, team2: silverLoser2, score1: selectedTournament.finals[3]?.score1 ?? null, score2: selectedTournament.finals[3]?.score2 ?? null }, // 7th Place
            ];
            
            if (JSON.stringify(newFinals) !== JSON.stringify(selectedTournament.finals)) {
                 const docRef = doc(db, "currentTournament", selectedTournament.id);
                 updateDoc(docRef, { finals: newFinals });
            }
        }
    }, [selectedTournament, areAllSemifinalsPlayed, db]);


    const areAllFinalsPlayed = useMemo(() => {
        if (!selectedTournament || !selectedTournament.finals) return false;
        return selectedTournament.finals.length > 0 && selectedTournament.finals.every(m => m.score1 !== null && m.score2 !== null);
    }, [selectedTournament]);
    
    useEffect(() => {
        if (selectedTournament && areAllFinalsPlayed) {
            const getWinner = (match: TournamentMatch) => (match.score1! > match.score2! ? match.team1 : match.team2);
            const getLoser = (match: TournamentMatch) => (match.score1! < match.score2! ? match.team1 : match.team2);

            const standings: TournamentPair[] = new Array(8);
            standings[0] = getWinner(selectedTournament.finals[0]);
            standings[1] = getLoser(selectedTournament.finals[0]);
            standings[2] = getWinner(selectedTournament.finals[1]);
            standings[3] = getLoser(selectedTournament.finals[1]);
            standings[4] = getWinner(selectedTournament.finals[2]);
            standings[5] = getLoser(selectedTournament.finals[2]);
            standings[6] = getWinner(selectedTournament.finals[3]);
            standings[7] = getLoser(selectedTournament.finals[3]);

            if(JSON.stringify(standings) !== JSON.stringify(selectedTournament.finalStandings)) {
                const docRef = doc(db, "currentTournament", selectedTournament.id);
                updateDoc(docRef, { finalStandings: standings });
            }
        } else if (selectedTournament && selectedTournament.finalStandings && selectedTournament.finalStandings.length > 0) {
             const docRef = doc(db, "currentTournament", selectedTournament.id);
             updateDoc(docRef, { finalStandings: [] });
        }
    }, [selectedTournament, areAllFinalsPlayed, db]);

    const saveAndArchiveTournament = async () => {
        if (!selectedTournament || !selectedTournament.finalStandings || selectedTournament.finalStandings.length !== 8) {
            toast({ title: "Error", description: "Completa todos los partidos para guardar el torneo.", variant: "destructive" });
            return;
        }
        
        const completedTournament: CompletedTournament = {
            id: selectedTournament.id,
            date: new Date().toISOString(),
            category: category,
            standings: selectedTournament.finalStandings.map((pair, index) => ({
                id: pair.id,
                name: pair.name,
                player1: { id: pair.player1.id, name: pair.player1.name },
                player2: { id: pair.player2.id, name: pair.player2.name },
                position: index + 1
            })),
            groups: selectedTournament.groups!,
            semifinals: selectedTournament.semifinals,
            silverSemifinals: selectedTournament.silverSemifinals,
            finals: selectedTournament.finals
        };
        try {
            if (!db) return;
            await setDoc(doc(db, "tournaments", completedTournament.id), completedTournament);
            toast({ title: "Éxito", description: "El torneo ha sido guardado y archivado." });
            await deleteDoc(doc(db, "currentTournament", selectedTournament.id));
            fetchHistoryAndFame();
            setSelectedTournament(null);
            setView('list');
        } catch (error) {
            console.error("Error saving tournament:", error);
            toast({ title: "Error", description: "No se pudo guardar el torneo.", variant: "destructive" });
        }
    };
    
    const handleDeleteCurrentTournament = async () => {
        if (user?.role !== 'admin' || !db || !selectedTournament) return;
        try {
            await deleteDoc(doc(db, "currentTournament", selectedTournament.id));
            toast({ title: "Torneo eliminado", description: "El torneo en curso ha sido eliminado."});
            setSelectedTournament(null);
            setView('list');
        } catch (error) {
            toast({ title: "Error", description: "No se pudo eliminar el torneo.", variant: "destructive"});
        }
    }

    const handleReturnToGroups = () => {
        if (user?.role !== 'admin' || !selectedTournament) return;
        
        const docRef = doc(db, "currentTournament", selectedTournament.id);
        updateDoc(docRef, {
            stage: 'group',
            semifinals: [],
            silverSemifinals: [],
            finals: [],
            finalStandings: [],
        });
        toast({ title: "Acción completada", description: "Has regresado a la Fase de Grupos." });
    }


    const renderSetup = () => (
        <Card className="w-full 3xl:max-w-3xl 3xl:mx-auto">
            <CardHeader>
                 <div className='flex justify-between items-center'>
                    <div>
                        <CardTitle><span className="text-yellow-400">1. Configuración del Torneo</span></CardTitle>
                        <CardDescription>
                            {user?.role === 'guest'
                             ? `Actualmente no hay ningún torneo en curso. Solo un administrador puede crear uno nuevo.`
                             : `Selecciona 8 parejas para competir en la ${category} categoría.`}
                        </CardDescription>
                    </div>
                    {view === 'setup' && ongoingTournaments.length > 0 && (
                         <Button variant="outline" onClick={() => setView('list')}>
                            <ArrowLeft className="mr-2 h-4 w-4"/> Volver a la lista
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {user?.role === 'guest' ? (
                     <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Acceso Restringido</AlertTitle>
                        <AlertDescription>
                            La creación de torneos está reservada para los administradores.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        <div>
                            <Label>Creador de Parejas ({selectedPairs.length} / 8)</Label>
                            <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2 mt-2">
                                <div className="flex-1 space-y-1">
                                    <Label htmlFor='p1' className="text-xs">Jugador 1</Label>
                                    <Select value={player1?.id || ''} onValueChange={id => setPlayer1(allPlayers.find(p => p.id === id) || null)}>
                                        <SelectTrigger id="p1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                        <SelectContent>
                                            {availablePlayers.filter(p => p.id !== player2?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Label htmlFor='p2' className="text-xs">Jugador 2</Label>
                                    <Select value={player2?.id || ''} onValueChange={id => setPlayer2(allPlayers.find(p => p.id === id) || null)}>
                                        <SelectTrigger id="p2"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                        <SelectContent>
                                            {availablePlayers.filter(p => p.id !== player1?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleAddPair} size="icon" className="w-full md:w-auto mt-4 md:mt-0"><PlusCircle/></Button>
                            </div>
                        </div>

                        {selectedPairs.length > 0 && (
                            <div className="rounded-md border p-2 space-y-2">
                                <Label>Parejas Creadas</Label>
                                {selectedPairs.map((pair, index) => (
                                    <div key={pair.id} className="flex items-center justify-between bg-muted p-2 rounded-md">
                                        <span className="truncate pr-2">{index + 1}. {pair.name}</span>
                                        <Button variant="ghost" size="icon" className="text-destructive flex-shrink-0" onClick={() => handleRemovePair(pair.id)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end pt-4">
                            <Button onClick={startTournament} disabled={selectedPairs.length !== 8}>
                                <Dices className="mr-2 h-4 w-4"/> Iniciar Torneo y Sortear Grupos
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );

    const renderGroupStage = () => {
        if (!selectedTournament || !selectedTournament.groups) return null;
        return (
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8'>
                {Object.values(selectedTournament.groups).map(group => {
                     const standings = calculateGroupStandings(group);
                     return(
                        <Card key={group.name}>
                            <CardHeader>
                                <CardTitle className="text-primary">Grupo {group.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                {Array.from({ length: 3 }).map((_, roundIndex) => (
                                    <div key={roundIndex}>
                                        <h4 className="font-semibold mb-2 text-secondary-foreground/80">Ronda {roundIndex + 1}</h4>
                                        <div className="space-y-2">
                                            {group.matches.slice(roundIndex * 2, roundIndex * 2 + 2).map((match, matchIndexInRound) => {
                                                const matchIndex = roundIndex * 2 + matchIndexInRound;
                                                return (
                                                    <div key={matchIndex} className='flex items-center gap-2 text-sm p-2 bg-muted rounded-md'>
                                                        <div className='flex-1 text-right truncate' title={match.team1.name}>{match.team1.name}</div>
                                                        <div className="flex items-center gap-2">
                                                            <Input type="text" pattern="[0-7]*" className='w-14 text-center' value={match.score1 ?? ''} onChange={e => handleGroupScoreChange(group.name as 'A' | 'B', matchIndex, 'team1', e.target.value)} disabled={user?.role === 'guest'} />
                                                            <span>-</span>
                                                            <Input type="text" pattern="[0-7]*" className='w-14 text-center' value={match.score2 ?? ''} onChange={e => handleGroupScoreChange(group.name as 'A' | 'B', matchIndex, 'team2', e.target.value)} disabled={user?.role === 'guest'} />
                                                        </div>
                                                        <div className='flex-1 truncate' title={match.team2.name}>{match.team2.name}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                                </div>

                                <h3 className='font-bold mb-2 mt-6 text-primary'>Clasificación del Grupo</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-8">#</TableHead>
                                            <TableHead>Pareja</TableHead>
                                            <TableHead className="text-center">G</TableHead>
                                            <TableHead className="text-center">P</TableHead>
                                            <TableHead className="text-center">Pts</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {standings.map((pair, index) => (
                                            <TableRow key={pair.id} className={index < 2 ? 'bg-primary/10' : 'bg-secondary/10'}>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell className="truncate max-w-[150px] md:max-w-none" title={pair.name}>{pair.name}</TableCell>
                                                <TableCell className="text-center">{pair.stats.won}</TableCell>
                                                <TableCell className="text-center">{pair.stats.lost}</TableCell>
                                                <TableCell className="text-center font-bold">{pair.stats.points}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                     );
                })}

                 <div className="lg:col-span-2 flex justify-end">
                    <Button onClick={startKnockoutStage} disabled={!areAllGroupMatchesPlayed || user?.role === 'guest'}>
                       Finalizar Grupos y Crear Eliminatorias <ArrowRight className="ml-2 h-4 w-4"/>
                    </Button>
                </div>
            </div>
        );
    };

    const renderKnockoutMatch = (
        match: TournamentMatch | null, 
        index: number, 
        stateName: 'semifinals' | 'silverSemifinals' | 'finals',
        placeholder1?: string,
        placeholder2?: string,
        ) => (
         <div key={index} className='flex items-center gap-2 text-sm p-2 bg-muted rounded-md'>
            <div className='flex-1 text-right truncate' title={match?.team1?.name ?? placeholder1}>
                {match?.team1?.name ?? <span className='text-muted-foreground italic'>{placeholder1}</span>}
            </div>
             <div className="flex items-center gap-2">
                <Input 
                    type="text"
                    pattern="[0-7]*"
                    className='w-14 text-center' 
                    value={match?.score1 ?? ''} 
                    onChange={e => handleKnockoutScoreChange(stateName, index, 'team1', e.target.value)}
                    disabled={!match?.team1 || !match?.team2 || user?.role === 'guest'}
                />
                <span>-</span>
                <Input 
                    type="text"
                    pattern="[0-7]*"
                    className='w-14 text-center' 
                    value={match?.score2 ?? ''} 
                    onChange={e => handleKnockoutScoreChange(stateName, index, 'team2', e.target.value)}
                    disabled={!match?.team1 || !match?.team2 || user?.role === 'guest'}
                />
            </div>
            <div className='flex-1 truncate' title={match?.team2?.name ?? placeholder2}>
                {match?.team2?.name ?? <span className='text-muted-foreground italic'>{placeholder2}</span>}
            </div>
        </div>
    );
    
    const renderEliminatorias = () => {
        if (!selectedTournament) return null;
        const { semifinals, silverSemifinals, finals, finalStandings } = selectedTournament;

        const finalMatches = [
            { title: "Final Principal (1º y 2º)", match: finals[0], index: 0, placeholder1: "Ganador Semi 1", placeholder2: "Ganador Semi 2", isPrimary: true, style: "gold-text"},
            { title: "Final 3º Puesto", match: finals[1], index: 1, placeholder1: "Perdedor Semi 1", placeholder2: "Perdedor Semi 2", isPrimary: true, style: "bronze-text"},
            { title: "Final de Plata (5º y 6º)", match: finals[2], index: 2, placeholder1: "Ganador Semi Plata 1", placeholder2: "Ganador Semi Plata 2", isPrimary: false},
            { title: "Final 7º Puesto", match: finals[3], index: 3, placeholder1: "Perdedor Semi Plata 1", placeholder2: "Perdedor Semi Plata 2", isPrimary: false},
        ];
        
        return (
            <div className='space-y-8'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8'>
                    <Card>
                        <CardHeader>
                            <CardTitle>Semifinales</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="font-semibold mb-2 text-primary">Principales</h4>
                                <div className="space-y-2">
                                    {semifinals.map((match, index) => renderKnockoutMatch(match, index, 'semifinals'))}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2 text-secondary-foreground/80">De Plata</h4>
                                <div className="space-y-2">
                                    {silverSemifinals.map((match, index) => renderKnockoutMatch(match, index, 'silverSemifinals'))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Finales</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {finalMatches.map(fm => (
                                <div key={fm.title}>
                                    <h4 className={`font-semibold mb-2 ${fm.isPrimary ? fm.style : 'text-primary'}`}>{fm.title}</h4>
                                    {renderKnockoutMatch(
                                        fm.match, 
                                        fm.index, 
                                        'finals',
                                        fm.placeholder1, 
                                        fm.placeholder2
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
                 {finalStandings && finalStandings.length > 0 && <FinalPodium standings={finalStandings}/>}
                <div className="flex justify-end mt-4 gap-2">
                    {user?.role === 'admin' && (
                        <>
                           <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/> Volver a Fase de Grupos</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Volver a la Fase de Grupos?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción te devolverá a la fase de grupos y borrará el progreso de las eliminatorias. Es útil si necesitas corregir un resultado de los grupos.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleReturnToGroups}>Confirmar y Volver</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4"/> Descartar Torneo</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Descartar y eliminar torneo?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción es permanente y eliminará todo el progreso del torneo actual. No podrás recuperarlo.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteCurrentTournament}>Confirmar y Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button onClick={saveAndArchiveTournament} disabled={!finalStandings || finalStandings.length !== 8}>
                                <Save className="mr-2 h-4 w-4"/> Guardar y Archivar
                            </Button>
                        </>
                    )}
                </div>
            </div>
        )
    };

    const FinalPodium = ({standings}: {standings: TournamentPair[]}) => {
        if (!standings || standings.length < 3) return null;
        const firstPlace = standings[0];
        const secondPlace = standings[1];
        const thirdPlace = standings[2];

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-center text-2xl gold-text">🏆 Podio del Torneo 🏆</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-around items-end text-center p-4 md:p-6">
                    <div className="flex flex-col items-center">
                        <Trophy className="w-8 h-8 md:w-10 md:h-10 text-gray-400" />
                        <p className="font-bold text-sm md:text-lg silver-text mt-2 max-w-24 md:max-w-xs truncate">{secondPlace.name}</p>
                        <p className="text-muted-foreground text-xs md:text-sm">2° Lugar</p>
                    </div>
                     <div className="flex flex-col items-center mx-2 md:mx-4">
                        <Trophy className="w-12 h-12 md:w-16 md:h-16 text-yellow-400" />
                        <p className="font-bold text-base md:text-xl gold-text mt-2 max-w-28 md:max-w-xs truncate">{firstPlace.name}</p>
                        <p className="text-muted-foreground text-xs md:text-sm">¡Campeones!</p>
                    </div>
                     <div className="flex flex-col items-center">
                        <Trophy className="w-8 h-8 md:w-10 md:h-10 text-orange-400" />
                        <p className="font-bold text-sm md:text-lg bronze-text mt-2 max-w-24 md:max-w-xs truncate">{thirdPlace.name}</p>
                        <p className="text-muted-foreground text-xs md:text-sm">3er Lugar</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const renderCurrentTournament = () => {
        if (view === 'loading') {
            return (
                 <Card className="w-full 3xl:max-w-3xl 3xl:mx-auto">
                    <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <div className="flex justify-end"><Skeleton className="h-10 w-32" /></div>
                    </CardContent>
                </Card>
            )
        }

        if (view === 'list') {
            return (
                <Card className="w-full">
                    <CardHeader>
                        <div className='flex justify-between items-center'>
                            <div>
                                <CardTitle><span className="text-yellow-400">Torneos en Curso</span></CardTitle>
                                <CardDescription>Torneos para la categoría <span className="font-bold text-primary">{category}</span>.</CardDescription>
                            </div>
                            {user?.role === 'admin' && (
                                <Button onClick={() => setView('setup')}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Torneo
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {ongoingTournaments.length > 0 ? (
                            <div className="space-y-2">
                                {ongoingTournaments.map(tourney => (
                                    <div key={tourney.id} onClick={() => { setSelectedTournament(tourney); setView('match'); }} className="p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors">
                                        <p className="font-semibold">Torneo en {tourney.stage === 'group' ? 'Fase de Grupos' : 'Eliminatorias'}</p>
                                        <p className="text-sm text-muted-foreground">{tourney.selectedPairs.length} parejas</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <Gamepad2 className="mx-auto h-12 w-12 mb-2" />
                                <p>No hay torneos en curso para esta categoría.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )
        }

        if (view === 'match' && selectedTournament) {
             return (
                <div>
                     <Button variant="outline" size="sm" onClick={() => { setSelectedTournament(null); setView('list'); }} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4"/> Volver a la lista de torneos
                    </Button>
                    {selectedTournament.stage === 'group' && renderGroupStage()}
                    {selectedTournament.stage === 'eliminatorias' && renderEliminatorias()}
                </div>
            )
        }

        return renderSetup();
    };
    
    const getHistoryTrophy = (position: number) => {
        if (position === 1) return <Trophy className="h-5 w-5 text-yellow-400 inline-block ml-2" />;
        if (position === 2) return <Trophy className="h-5 w-5 text-gray-400 inline-block ml-2" />;
        if (position === 3) return <Trophy className="h-5 w-5 text-orange-400 inline-block ml-2" />;
        return null;
    }

    const renderHistory = () => {
        const finalMatchesLabels = [
            "Final Principal (1º y 2º)",
            "Final 3º Puesto",
            "Final de Plata (5º y 6º)",
            "Final 7º Puesto",
        ];

        return (
         <Card className="w-full 3xl:max-w-none">
            <CardHeader>
                <CardTitle><span className="text-yellow-400">Historial de Torneos</span></CardTitle>
                <CardDescription>Resultados de torneos anteriores de la <span className="font-bold text-primary">{category}</span> categoría.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingHistory ? (
                     <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : tournamentHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No hay torneos guardados en el historial.</p>
                ) : (
                    <Accordion type="single" collapsible className="w-full">
                        {tournamentHistory.map(tourney => {
                             const totalStats = calculateTotalTournamentStats(tourney);
                             return (
                                <AccordionItem value={tourney.id} key={tourney.id}>
                                    <AccordionTrigger className="text-lg">
                                        Torneo del {format(new Date(tourney.date), "d 'de' MMMM, yyyy", { locale: es })}
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-6">
                                        <h3 className="text-lg font-semibold text-center gold-text">🏆 Clasificación Final 🏆</h3>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Puesto</TableHead>
                                                    <TableHead>Pareja</TableHead>
                                                    <TableHead className="text-center">G</TableHead>
                                                    <TableHead className="text-center">P</TableHead>
                                                    <TableHead className="text-center">Pts</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {tourney.standings.map(pair => {
                                                    const finalStats = totalStats.get(pair.id);
                                                    return (
                                                    <TableRow key={pair.id}>
                                                        <TableCell className="font-bold flex items-center">
                                                            <span>{pair.position}°</span>
                                                            {getHistoryTrophy(pair.position)}
                                                        </TableCell>
                                                        <TableCell>{pair.name}</TableCell>
                                                        <TableCell className="text-center">{finalStats?.won ?? 'N/A'}</TableCell>
                                                        <TableCell className="text-center">{finalStats?.lost ?? 'N/A'}</TableCell>
                                                        <TableCell className="text-center font-bold">{finalStats?.points ?? 'N/A'}</TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                        
                                        {tourney.groups && (
                                            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8'>
                                                {Object.values(tourney.groups).map(group => {
                                                    const standings = calculateGroupStandings(group);
                                                    return(
                                                        <Card key={group.name} className="bg-background/50">
                                                            <CardHeader>
                                                                <CardTitle className="text-primary">Grupo {group.name}</CardTitle>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <h4 className="font-semibold mb-2 text-primary">Partidos</h4>
                                                                <div className="space-y-2">
                                                                    {group.matches.map((match, matchIndex) => (
                                                                        <div key={matchIndex} className='flex items-center gap-2 text-xs p-2 bg-muted rounded-md'>
                                                                            <div className='flex-1 text-right truncate' title={match.team1.name}>{match.team1.name}</div>
                                                                            <div className="flex items-center gap-1 font-bold">
                                                                                <span>{match.score1}</span>
                                                                                <span>-</span>
                                                                                <span>{match.score2}</span>
                                                                            </div>
                                                                            <div className='flex-1 truncate' title={match.team2.name}>{match.team2.name}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                
                                                                <h4 className="font-semibold mb-2 mt-4 text-primary">Clasificación del Grupo</h4>
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead className="w-8">#</TableHead>
                                                                            <TableHead>Pareja</TableHead>
                                                                            <TableHead className="text-center">G</TableHead>
                                                                            <TableHead className="text-center">P</TableHead>
                                                                            <TableHead className="text-center">Pts</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {standings.map((pair, index) => (
                                                                            <TableRow key={pair.id}>
                                                                                <TableCell>{index + 1}</TableCell>
                                                                                <TableCell className="truncate max-w-[120px] md:max-w-none" title={pair.name}>{pair.name}</TableCell>
                                                                                <TableCell className="text-center">{pair.stats.won}</TableCell>
                                                                                <TableCell className="text-center">{pair.stats.lost}</TableCell>
                                                                                <TableCell className="text-center font-bold">{pair.stats.points}</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </CardContent>
                                                        </Card>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        <div className='space-y-4 mt-6'>
                                            <h3 className="text-lg font-semibold text-center text-primary">Resultados de Eliminatorias</h3>
                                            {tourney.semifinals && (
                                                <div className="space-y-1">
                                                    <h4 className="font-semibold text-center">Semifinales</h4>
                                                     {tourney.semifinals.map((match, index) => (
                                                        <div key={index} className="flex justify-center items-center text-xs gap-2"><span className="text-right flex-1 truncate">{match.team1.name}</span> <span className="font-bold">{match.score1} - {match.score2}</span> <span className="text-left flex-1 truncate">{match.team2.name}</span></div>
                                                     ))}
                                                </div>
                                            )}
                                             {tourney.silverSemifinals && (
                                                <div className="space-y-1">
                                                    <h4 className="font-semibold text-center text-muted-foreground">Semifinales de Plata</h4>
                                                     {tourney.silverSemifinals.map((match, index) => (
                                                        <div key={index} className="flex justify-center items-center text-xs gap-2"><span className="text-right flex-1 truncate">{match.team1.name}</span> <span className="font-bold">{match.score1} - {match.score2}</span> <span className="text-left flex-1 truncate">{match.team2.name}</span></div>
                                                     ))}
                                                </div>
                                            )}
                                            {tourney.finals && (
                                                 <div className="space-y-2 mt-4">
                                                    <h4 className="font-semibold text-center">Finales</h4>
                                                     {tourney.finals.map((match, index) => (
                                                        <div key={index}>
                                                            <p className="text-center text-xs font-semibold text-primary">{finalMatchesLabels[index]}</p>
                                                            <div className="flex justify-center items-center text-xs gap-2">
                                                                <span className="text-right flex-1 truncate">{match.team1.name}</span> 
                                                                <span className="font-bold">{match.score1} - {match.score2}</span> 
                                                                <span className="text-left flex-1 truncate">{match.team2.name}</span>
                                                            </div>
                                                        </div>
                                                     ))}
                                                </div>
                                            )}
                                        </div>
                                        
                                    </AccordionContent>
                                </AccordionItem>
                            )
                        })}
                    </Accordion>
                )}
            </CardContent>
        </Card>
    )};

    const renderHallOfFame = () => (
        <Card className="w-full 3xl:max-w-none">
            <CardHeader>
                <CardTitle><span className="text-yellow-400">Salón de la Fama</span></CardTitle>
                <CardDescription>Ranking de jugadores de la <span className="font-bold text-primary">{category}</span> categoría, basado en trofeos de torneos ganados.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingHistory ? (
                     <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : hallOfFame.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Aún no hay ganadores de torneos.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Jugador</TableHead>
                                    <TableHead className="text-center">TJ</TableHead>
                                    <TableHead className="text-center">Pts</TableHead>
                                    <TableHead className="text-center">Score</TableHead>
                                    <TableHead className="text-center">Trofeos</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {hallOfFame.map((entry, index) => (
                                    <TableRow key={entry.playerId}>
                                        <TableCell className="font-bold">{index + 1}</TableCell>
                                        <TableCell className="font-medium">{entry.name}</TableCell>
                                        <TableCell className="text-center">{entry.tournamentsPlayed}</TableCell>
                                        <TableCell className="text-center">{entry.totalPoints}</TableCell>
                                        <TableCell className="text-center font-bold text-primary">{entry.score.toFixed(2)}</TableCell>
                                        <TableCell className="text-center text-lg space-x-2 md:space-x-4">
                                            {entry.trophies.first > 0 && <span className="inline-flex items-center gap-1 gold-text"><Trophy className="h-5 w-5"/> {entry.trophies.first}</span>}
                                            {entry.trophies.second > 0 && <span className="inline-flex items-center gap-1 silver-text"><Trophy className="h-5 w-5"/> {entry.trophies.second}</span>}
                                            {entry.trophies.third > 0 && <span className="inline-flex items-center gap-1 bronze-text"><Trophy className="h-5 w-5"/> {entry.trophies.third}</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const tabs = [
        { value: "torneo", label: "Torneo Actual", icon: Trophy },
        { value: "historial", label: "Historial", icon: History },
        { value: "fama", label: "Salón de la Fama", icon: Star },
    ];
    
    return (
        <Tabs defaultValue="torneo" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                 {tabs.map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                        <tab.icon className="mr-2 h-4 w-4"/>{tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            <TabsContent value="torneo" className="mt-6">
                {renderCurrentTournament()}
            </TabsContent>
            <TabsContent value="historial" className="mt-6">
                {renderHistory()}
            </TabsContent>
            <TabsContent value="fama" className="mt-6">
                {renderHallOfFame()}
            </TabsContent>
        </Tabs>
    );
};

export default Torneo;

    