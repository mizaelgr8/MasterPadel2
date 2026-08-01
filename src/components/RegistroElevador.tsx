
"use client";
import { useState, useMemo, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, getDoc, writeBatch, deleteDoc, query, where, addDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import type { Player, ElevadorPlayer, ElevadorCourt, ElevadorRound, ElevadorPlayerStats, ElevadorMatch, OngoingElevador, DailyElevadorResult, DailyElevadorEvent, Category, Pair, DailyPairResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Users, Dices, Play, Save, Trash2, Loader2, Sparkles, ArrowLeft, Info, BarChart, PlusCircle, Gamepad2, User } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Checkbox } from './ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCategory } from '@/context/CategoryContext';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useFirebase } from '@/context/FirebaseContext';
import { Skeleton } from './ui/skeleton';
import { es } from 'date-fns/locale';

const TOTAL_ROUNDS = 7;

const sortPlayersByRank = (players: Player[]): Player[] => {
    return [...players].sort((a, b) => {
        const aAchievements = a.achievements || { king: 0, shield: 0, sword: 0 };
        const bAchievements = b.achievements || { king: 0, shield: 0, sword: 0 };
        if (bAchievements.king !== aAchievements.king) return bAchievements.king - aAchievements.king;
        if (bAchievements.shield !== aAchievements.shield) return bAchievements.shield - aAchievements.shield;
        if (bAchievements.sword !== aAchievements.sword) return bAchievements.sword - aAchievements.sword;
        const aMedals = a.medals || { gold: 0, silver: 0, bronze: 0 };
        const bMedals = b.medals || { gold: 0, silver: 0, bronze: 0 };
        if (bMedals.gold !== aMedals.gold) return bMedals.gold - aMedals.gold;
        if (bMedals.silver !== aMedals.silver) return bMedals.silver - aMedals.silver;
        if (bMedals.bronze !== aMedals.bronze) return bMedals.bronze - aMedals.bronze;
        const avgA = a.totalGames > 0 ? (a.totalPoints / a.totalGames) : 0;
        const avgB = b.totalGames > 0 ? (b.totalPoints / b.totalGames) : 0;
        if (avgB !== avgA) return avgB - avgA;
        return b.totalGames - a.totalGames;
    });
};


const RegistroElevador = () => {
    const { db } = useFirebase();
    const { toast } = useToast();
    const { user } = useAuth();
    const { category } = useCategory();
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    
    const [ongoingMatches, setOngoingMatches] = useState<OngoingElevador[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<OngoingElevador | null>(null);
    const [view, setView] = useState<'loading' | 'list' | 'setup' | 'match'>('loading');

    // Setup state
    const [modality, setModality] = useState<'elevador' | 'elevadorParejas'>('elevador');
    const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
    const [fixedPairs, setFixedPairs] = useState<Pair[]>([]);
    const [player1, setPlayer1] = useState<Player | null>(null);
    const [player2, setPlayer2] = useState<Player | null>(null);
    const [numberOfPlayers, setNumberOfPlayers] = useState<string>('12');
    const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [eventName, setEventName] = useState('');

    // Match state
    const [openAccordion, setOpenAccordion] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    
    const resetSetupState = useCallback(() => {
        setSelectedPlayers([]);
        setFixedPairs([]);
        setNumberOfPlayers('12');
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setEventName('');
        setPlayer1(null);
        setPlayer2(null);
    }, []);

    useEffect(() => {
        if (!db) return;
        const playersCollection = collection(db, "players");
        const unsubPlayers = onSnapshot(playersCollection, (snapshot) => {
            let playersList: Player[] = [];
            const allPlayersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));

            if (category === '4ta') {
                const modernPlayers = allPlayersList.filter(p => p.category === '4ta');
                const legacyPlayers = allPlayersList.filter(p => !p.category);
                const combined = new Map<string, Player>();
                [...legacyPlayers, ...modernPlayers].forEach(p => combined.set(p.id, p));
                playersList = Array.from(combined.values());
            } else {
                playersList = allPlayersList.filter(p => p.category === category);
            }
            setAllPlayers(playersList.sort((a,b) => a.name.localeCompare(b.name)));
        });
        return () => unsubPlayers();
    }, [db, category]);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, "ongoingElevador"), where("category", "==", category));
        const unsubOngoing = onSnapshot(q, (querySnapshot) => {
            const matches = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as OngoingElevador));
            setOngoingMatches(matches);
        });
        return () => unsubOngoing();
    }, [db, category]);

    useEffect(() => {
        if (selectedMatch) {
            const updatedMatch = ongoingMatches.find(m => m.id === selectedMatch.id);
            if (updatedMatch) {
                const isNewRound = updatedMatch.rounds.length > selectedMatch.rounds.length;
                setSelectedMatch(updatedMatch);
                if (isNewRound) {
                     setOpenAccordion(`round-${updatedMatch.rounds.length}`);
                }
            } else {
                setSelectedMatch(null);
            }
        }
    }, [ongoingMatches]);

    useEffect(() => {
        if (view === 'loading') {
            setView(ongoingMatches.length > 0 ? 'list' : 'setup');
        } else if (view === 'list' && ongoingMatches.length === 0) {
            setView('setup');
        } else if (view === 'match' && !selectedMatch) {
            setView('list');
        }
    }, [view, ongoingMatches, selectedMatch]);

    const handlePlayerToggle = (player: Player) => {
        const isSelected = selectedPlayers.some(p => p.id === player.id);
        const maxPlayers = parseInt(numberOfPlayers, 10);
        if (!isSelected && selectedPlayers.length >= maxPlayers) {
            toast({ title: "Límite alcanzado", description: `Solo puedes seleccionar ${maxPlayers} jugadores.`});
            return;
        }
        setSelectedPlayers(prev => isSelected ? prev.filter(p => p.id !== player.id) : [...prev, player]);
    };

    const availablePlayersForPairing = useMemo(() => {
        const pairedPlayerIds = new Set(fixedPairs.flatMap(p => [p.player1.id, p.player2.id]));
        return allPlayers.filter(p => !pairedPlayerIds.has(p.id));
    }, [allPlayers, fixedPairs]);

    const handleAddPair = () => {
        if (player1 && player2 && player1.id !== player2.id) {
            const newPair: Pair = {
                id: [player1.id, player2.id].sort().join('-'),
                player1,
                player2
            };
            setFixedPairs(prev => [...prev, newPair]);
            setPlayer1(null);
            setPlayer2(null);
        } else {
            toast({ title: "Error", description: "Selecciona dos jugadores diferentes.", variant: "destructive" });
        }
    };

    const handleRemovePair = (id: string) => {
        setFixedPairs(prev => prev.filter(p => p.id !== id));
    };

    const getPairId = (p1Id: string, p2Id: string) => [p1Id, p2Id].sort().join('-');

    const createMatchForCourt = (players: ElevadorPlayer[], previousPairs: Set<string>): ElevadorMatch | null => {
        if (players.length !== 4) return null;
    
        const shuffled = [...players].sort(() => 0.5 - Math.random());
    
        const combinations = [
            { t1: [shuffled[0], shuffled[1]], t2: [shuffled[2], shuffled[3]] },
            { t1: [shuffled[0], shuffled[2]], t2: [shuffled[1], shuffled[3]] },
            { t1: [shuffled[0], shuffled[3]], t2: [shuffled[1], shuffled[2]] },
        ];
    
        for (const combo of combinations) {
            const pair1Id = getPairId(combo.t1[0].id, combo.t1[1].id);
            const pair2Id = getPairId(combo.t2[0].id, combo.t2[1].id);
            if (!previousPairs.has(pair1Id) && !previousPairs.has(pair2Id)) {
                return {
                    team1: { player1: combo.t1[0], player2: combo.t1[1] },
                    team2: { player1: combo.t2[0], player2: combo.t2[1] },
                    score1: null, score2: null,
                };
            }
        }
        
        const firstCombo = combinations[0];
        return {
            team1: { player1: firstCombo.t1[0], player2: firstCombo.t1[1] },
            team2: { player1: firstCombo.t2[0], player2: firstCombo.t2[1] },
            score1: null, score2: null,
        };
    };
    

    const startElevador = async () => {
        if (!db) return;
        
        if (modality === 'elevador') {
            if (selectedPlayers.length !== parseInt(numberOfPlayers, 10)) {
                toast({ title: "Error", description: `Debes seleccionar exactamente ${numberOfPlayers} jugadores.` });
                return;
            }
        } else {
             if (fixedPairs.length < 2 || fixedPairs.length % 2 !== 0) {
                toast({ title: "Error", description: `Debes configurar un número par de parejas (mínimo 2).` });
                return;
            }
        }

        const initialStats: Record<string, ElevadorPlayerStats> = {};
        const initialCourts: ElevadorCourt[] = [];

        if (modality === 'elevador') {
            const sortedSelectedPlayers = sortPlayersByRank(selectedPlayers);
            const numCourts = sortedSelectedPlayers.length / 4;
        
            for (let i = 0; i < numCourts; i++) {
                const courtPlayers = sortedSelectedPlayers.slice(i * 4, (i * 4) + 4).map(p => ({ ...p, court: i + 1 }));
                const match = createMatchForCourt(courtPlayers, new Set());
                initialCourts.push({ courtNumber: i + 1, players: courtPlayers, match });
            }
        
            selectedPlayers.forEach(p => {
                 const playerCourt = initialCourts.find(c => c.players.some(cp => cp.id === p.id));
                 initialStats[p.id] = {
                    playerId: p.id, name: p.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0,
                    courtHistory: [playerCourt?.courtNumber || 0], finalCourt: playerCourt?.courtNumber || 0
                };
            });
        } else {
            // Elevador Parejas
            const numCourts = fixedPairs.length / 2;
            for (let i = 0; i < numCourts; i++) {
                const p1 = fixedPairs[i * 2];
                const p2 = fixedPairs[i * 2 + 1];
                const courtPlayers = [
                    { ...p1.player1, court: i + 1 }, { ...p1.player2, court: i + 1 },
                    { ...p2.player1, court: i + 1 }, { ...p2.player2, court: i + 1 }
                ];
                initialCourts.push({
                    courtNumber: i + 1,
                    players: courtPlayers,
                    match: { team1: { player1: courtPlayers[0], player2: courtPlayers[1] }, team2: { player1: courtPlayers[2], player2: courtPlayers[3] }, score1: null, score2: null }
                });
            }

            fixedPairs.forEach(pair => {
                [pair.player1, pair.player2].forEach(p => {
                    const playerCourt = initialCourts.find(c => c.players.some(cp => cp.id === p.id));
                    initialStats[p.id] = {
                        playerId: p.id, name: p.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0,
                        courtHistory: [playerCourt?.courtNumber || 0], finalCourt: playerCourt?.courtNumber || 0
                    };
                });
            });
        }
    
        const firstRound: ElevadorRound = { roundNumber: 1, courts: initialCourts, isBonus: 1 === TOTAL_ROUNDS };
        
        const newMatchData: Omit<OngoingElevador, 'id'> = {
            eventName: eventName || "Elevador",
            modality,
            date,
            numberOfPlayers: modality === 'elevador' ? numberOfPlayers : (fixedPairs.length * 2).toString(),
            selectedPlayers: modality === 'elevador' ? selectedPlayers : [],
            fixedPairs: modality === 'elevadorParejas' ? fixedPairs : [],
            rounds: [firstRound],
            stage: 'playing',
            playerStats: initialStats,
            category,
        };
        
        try {
            const newDocRef = await addDoc(collection(db, "ongoingElevador"), newMatchData);
            setSelectedMatch({ ...newMatchData, id: newDocRef.id });
            setView('match');
            setOpenAccordion(`round-1`);
            resetSetupState();
            toast({ title: "¡Elevador iniciado!", description: "Se han distribuido los participantes en las canchas." });
        } catch (e) {
            toast({title: "Error", description: "No se pudo iniciar el elevador.", variant: "destructive"});
        }
    };
    

    const handleScoreChange = (roundIndex: number, courtIndex: number, team: 'team1' | 'team2', value: string) => {
        if (!selectedMatch || user?.role === 'guest') return;
        const score = parseInt(value, 10);
        if (value !== '' && (isNaN(score) || score < 0 || score > 6)) return;

        const newRounds = JSON.parse(JSON.stringify(selectedMatch.rounds));
        const match = newRounds[roundIndex].courts[courtIndex].match;
        if (!match) return;
        
        const finalScore = isNaN(score) ? null : score;

        if (team === 'team1') {
            match.score1 = finalScore;
            if(finalScore !== null) match.score2 = 6 - finalScore; else match.score2 = null;
        } else {
            match.score2 = finalScore;
            if(finalScore !== null) match.score1 = 6 - finalScore; else match.score1 = null;
        }
        
        const docRef = doc(db, "ongoingElevador", selectedMatch.id);
        updateDoc(docRef, { rounds: newRounds });
    };
    
    const isRoundComplete = (round: ElevadorRound): boolean => {
        return round.courts.every(c => c.match && c.match.score1 !== null && c.match.score2 !== null);
    }
    
    const startNextRound = () => {
        if (!selectedMatch) return;
        const { rounds, playerStats, modality, numberOfPlayers: numPlayersStr } = selectedMatch;
        const lastRound = rounds[rounds.length - 1];

        if (!isRoundComplete(lastRound)) {
            toast({ title: "Ronda incompleta", description: "Debes registrar todos los marcadores de la ronda actual." });
            return;
        }
        if (rounds.length >= TOTAL_ROUNDS) {
            toast({ title: "Evento finalizado", description: "Has completado todas las rondas. Ahora puedes guardar el evento." });
            return;
        }

        const newStats = JSON.parse(JSON.stringify(playerStats));
        
        if (!lastRound.isBonus) {
            lastRound.courts.forEach(court => {
                const { match } = court;
                if (!match || match.score1 === null || match.score2 === null) return;

                const { team1, team2, score1, score2 } = match;
                const t1Won = score1 > score2;
                
                [team1.player1, team1.player2].forEach(p => {
                    newStats[p.id].gamesWon += t1Won ? 1 : 0;
                    newStats[p.id].gamesLost += !t1Won ? 1 : 0;
                    newStats[p.id].pointsScored += score1;
                    newStats[p.id].pointsReceived += score2;
                });
                [team2.player1, team2.player2].forEach(p => {
                    newStats[p.id].gamesWon += !t1Won ? 1 : 0;
                    newStats[p.id].gamesLost += t1Won ? 1 : 0;
                    newStats[p.id].pointsScored += score2;
                    newStats[p.id].pointsReceived += score1;
                });
            });
        }

        const numCourts = parseInt(numPlayersStr, 10) / 4;
        const nextCourtPlayers: Record<number, ElevadorPlayer[]> = {};
        for(let i=1; i<=numCourts; i++) nextCourtPlayers[i] = [];

        const roundPreviousPairs = new Set<string>();

        lastRound.courts.forEach(court => {
            const { match, courtNumber } = court;
            if (!match) return;
            const { team1, team2, score1, score2 } = match;
            const t1Won = score1! > score2!;
            const winners = t1Won ? [team1.player1, team1.player2] : [team2.player1, team2.player2];
            const losers = !t1Won ? [team1.player1, team1.player2] : [team2.player1, team2.player2];

            if (modality === 'elevador') {
                roundPreviousPairs.add(getPairId(team1.player1.id, team1.player2.id));
                roundPreviousPairs.add(getPairId(team2.player1.id, team2.player2.id));
            }

            if (courtNumber === 1) { 
                nextCourtPlayers[1].push(...winners);
                nextCourtPlayers[2].push(...losers);
            } else if (courtNumber === numCourts) { 
                winners.forEach(p => nextCourtPlayers[courtNumber - 1].push(p));
                nextCourtPlayers[courtNumber].push(...losers);
            } else { 
                winners.forEach(p => nextCourtPlayers[courtNumber - 1].push(p));
                losers.forEach(p => nextCourtPlayers[courtNumber + 1].push(p));
            }
        });

        const newCourts: ElevadorCourt[] = [];
        for (let i = 1; i <= numCourts; i++) {
             const playersForCourt = nextCourtPlayers[i].map(p => ({...p, court: i}));
             
             playersForCourt.forEach(p => {
                if(newStats[p.id]){
                    newStats[p.id].courtHistory.push(i);
                    newStats[p.id].finalCourt = i;
                }
             })

            let match: ElevadorMatch | null = null;
            if (modality === 'elevador') {
                match = createMatchForCourt(playersForCourt, roundPreviousPairs);
            } else {
                // Fixed pairs move together
                match = {
                    team1: { player1: playersForCourt[0], player2: playersForCourt[1] },
                    team2: { player1: playersForCourt[2], player2: playersForCourt[3] },
                    score1: null, score2: null
                };
            }

            newCourts.push({ courtNumber: i, players: playersForCourt, match });
        }
        
        Object.values(newStats).forEach((s: any) => {
            s.pointsDifference = s.pointsScored - s.pointsReceived;
        });

        const newRoundNumber = lastRound.roundNumber + 1;
        const newRound: ElevadorRound = { 
            roundNumber: newRoundNumber,
            courts: newCourts,
            isBonus: newRoundNumber === TOTAL_ROUNDS,
        };
        const newRounds = [...rounds, newRound];
        setOpenAccordion(`round-${newRound.roundNumber}`);
        
        const docRef = doc(db, "ongoingElevador", selectedMatch.id);
        updateDoc(docRef, { rounds: newRounds, playerStats: newStats });
    };

    const handleGoBackToPreviousRound = () => {
        if (!selectedMatch) return;
        const { rounds, modality, selectedPlayers, fixedPairs } = selectedMatch;

        if (rounds.length <= 1) {
            toast({ title: "Acción no permitida", description: "No puedes volver atrás desde la primera ronda."});
            return;
        }

        const newRounds = rounds.slice(0, -1);
        const previousRound = newRounds[newRounds.length - 1];
        
        const newStats: Record<string, ElevadorPlayerStats> = {};
        const activePlayers = modality === 'elevador' ? selectedPlayers : fixedPairs.flatMap(p => [p.player1, p.player2]);

        activePlayers.forEach(p => {
            const initialCourt = rounds[0].courts.find(c => c.players.some(cp => cp.id === p.id))?.courtNumber || 0;
            newStats[p.id] = {
               playerId: p.id, name: p.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0,
               courtHistory: [initialCourt], finalCourt: initialCourt
           };
        });

        newRounds.forEach(round => {
            if (isRoundComplete(round) && !round.isBonus) {
                round.courts.forEach(court => {
                    const { match } = court;
                    if (!match) return;
                    const { team1, team2, score1, score2 } = match;
                    const t1Won = score1! > score2!;
                    
                    [team1.player1, team1.player2].forEach(p => {
                        newStats[p.id].gamesWon += t1Won ? 1 : 0;
                        newStats[p.id].gamesLost += !t1Won ? 1 : 0;
                        newStats[p.id].pointsScored += score1!;
                        newStats[p.id].pointsReceived += score2!;
                    });
                    [team2.player1, team2.player2].forEach(p => {
                        newStats[p.id].gamesWon += !t1Won ? 1 : 0;
                        newStats[p.id].gamesLost += t1Won ? 1 : 0;
                        newStats[p.id].pointsScored += score2!;
                        newStats[p.id].pointsReceived += score1!;
                    });
                });
            }

            round.courts.forEach(c => c.players.forEach(p => {
                if(newStats[p.id]) {
                    newStats[p.id].finalCourt = p.court;
                    if (!newStats[p.id].courtHistory.includes(p.court)) {
                        newStats[p.id].courtHistory.push(p.court);
                    }
                }
            }));
        });
        
        Object.values(newStats).forEach((s: any) => {
            s.pointsDifference = s.pointsScored - s.pointsReceived;
        });

        setOpenAccordion(`round-${previousRound.roundNumber}`);
        const docRef = doc(db, "ongoingElevador", selectedMatch.id);
        updateDoc(docRef, { rounds: newRounds, playerStats: newStats });
        toast({ title: "Ronda anterior restaurada", description: "Has vuelto a la ronda anterior."});
    };
    
    const sortedRanking = useMemo(() => {
        if (!selectedMatch) return [];
        const { rounds, modality, selectedPlayers, fixedPairs, playerStats } = selectedMatch;
        const activePlayers = modality === 'elevador' ? selectedPlayers : fixedPairs.flatMap(p => [p.player1, p.player2]);

        const tempStats: Record<string, ElevadorPlayerStats> = JSON.parse(JSON.stringify(
            Object.fromEntries(activePlayers.map(p => [p.id, {
                playerId: p.id, name: p.name, gamesWon: 0, gamesLost: 0, pointsScored: 0, pointsReceived: 0, pointsDifference: 0,
                finalCourt: playerStats[p.id]?.finalCourt || 0
            }]))
        ));

        const competitionRounds = rounds.filter(r => !r.isBonus);

        competitionRounds.forEach(round => {
            if (isRoundComplete(round)) {
                round.courts.forEach(court => {
                    const { match } = court;
                    if (!match) return;
                    const { team1, team2, score1, score2 } = match;
                    const t1Won = score1! > score2!;

                    [team1.player1, team1.player2].forEach(p => {
                        if (!tempStats[p.id]) return;
                        tempStats[p.id].gamesWon += t1Won ? 1 : 0;
                        tempStats[p.id].gamesLost += !t1Won ? 1 : 0;
                        tempStats[p.id].pointsScored += score1!;
                        tempStats[p.id].pointsReceived += score2!;
                    });
                    [team2.player1, team2.player2].forEach(p => {
                        if (!tempStats[p.id]) return;
                        tempStats[p.id].gamesWon += !t1Won ? 1 : 0;
                        tempStats[p.id].gamesLost += t1Won ? 1 : 0;
                        tempStats[p.id].pointsScored += score2!;
                        tempStats[p.id].pointsReceived += score1!;
                    });
                });
            }
        });
        
        Object.values(tempStats).forEach(s => {
            s.pointsDifference = s.pointsScored - s.pointsReceived;
        });
        
        if (modality === 'elevador') {
            return Object.values(tempStats).sort((a, b) => {
                if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
                if (b.pointsDifference !== a.pointsDifference) return b.pointsDifference - a.pointsDifference;
                if (b.pointsScored !== a.pointsScored) return b.pointsScored - a.pointsScored;
                return a.finalCourt - b.finalCourt;
            });
        } else {
            // Pair ranking logic: aggregate stats by pair
            const pairResults: any[] = [];
            fixedPairs.forEach(pair => {
                const s = tempStats[pair.player1.id];
                pairResults.push({
                    pairId: pair.id, name: pair.player1.name + ' & ' + pair.player2.name,
                    player1: pair.player1, player2: pair.player2,
                    gamesWon: s.gamesWon, gamesLost: s.gamesLost, pointsScored: s.pointsScored, pointsReceived: s.pointsReceived,
                    pointsDifference: s.pointsDifference, finalCourt: s.finalCourt
                });
            });
            return pairResults.sort((a, b) => {
                if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
                if (b.pointsDifference !== a.pointsDifference) return b.pointsDifference - a.pointsDifference;
                if (b.pointsScored !== a.pointsScored) return b.pointsScored - a.pointsScored;
                return a.finalCourt - b.finalCourt;
            });
        }
    }, [selectedMatch]);

    const handleDiscard = async () => {
        if (user?.role !== 'admin' || !db || !selectedMatch) return;
        await deleteDoc(doc(db, "ongoingElevador", selectedMatch.id));
        toast({ title: "Partida descartada", description: "La partida en curso ha sido eliminada." });
        setSelectedMatch(null);
        setView('list');
    }

    const saveEvent = async () => {
        if (!db || !selectedMatch) return;
        setIsSaving(true);
        const { rounds, date, eventName: finalEventName, modality } = selectedMatch;
        const competitionRounds = rounds.filter(r => !r.isBonus);
        const allCompetitionScoresEntered = competitionRounds.every(isRoundComplete);

        if (sortedRanking.length === 0 || !allCompetitionScoresEntered) {
          toast({ title: "Error", description: "Debes completar todas las rondas de competición para guardar.", variant: "destructive" });
          setIsSaving(false);
          return;
        }
    
        try {
            const batch = writeBatch(db);
            
            if (modality === 'elevador') {
                const results: DailyElevadorResult[] = sortedRanking.map(p => ({
                    playerId: p.playerId, name: p.name, gamesWon: p.gamesWon, gamesLost: p.gamesLost,
                    pointsScored: p.pointsScored, pointsReceived: p.pointsReceived, pointsDifference: p.pointsDifference, finalCourt: p.finalCourt
                }));
                
                const newEventDoc = doc(collection(db, "dailyElevadorEvents"));
                batch.set(newEventDoc, { id: newEventDoc.id, date, name: finalEventName, results, modality: 'elevador', category });

                for (let i = 0; i < Math.min(results.length, 3); i++) {
                    const pRef = doc(db, 'players', results[i].playerId);
                    const field = i === 0 ? 'medals.gold' : i === 1 ? 'medals.silver' : 'medals.bronze';
                    batch.update(pRef, { [field]: increment(1) });
                }
            } else {
                const results: DailyPairResult[] = sortedRanking.map(p => ({
                    pairId: p.pairId, player1: p.player1, player2: p.player2, points: p.pointsScored, g: p.gamesWon, p: p.gamesLost, e: 0
                }));
                
                const newEventDoc = doc(collection(db, "dailyPairEvents"));
                batch.set(newEventDoc, { id: newEventDoc.id, date, name: finalEventName, results, modality: 'elevadorParejas', category });

                for (let i = 0; i < Math.min(results.length, 3); i++) {
                    const res = results[i];
                    const field = i === 0 ? 'medals.gold' : i === 1 ? 'medals.silver' : 'medals.bronze';
                    [res.player1.id, res.player2.id].forEach(pid => {
                        batch.update(doc(db, 'players', pid), { [field]: increment(1) });
                    });
                }
            }

            await batch.commit();
            await deleteDoc(doc(db, "ongoingElevador", selectedMatch.id));
            toast({ title: "Éxito", description: "El evento se ha guardado correctamente." });
            setSelectedMatch(null); setView('list');
        } catch (error) {
            console.error("Error saving event:", error);
            toast({ title: "Error", description: "No se pudo guardar el evento.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
      };

    const getMedal = (index: number) => {
        if (index === 0) return <span className="gold-text">🥇</span>;
        if (index === 1) return <span className="silver-text">🥈</span>;
        if (index === 2) return <span className="bronze-text">🥉</span>;
        return null;
    };


    if (view === 'loading') {
        return (
          <Card>
            <CardHeader><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-3/4" /></CardHeader>
            <CardContent className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent>
          </Card>
        )
    }

    if (view === 'list') {
        return (
             <Card className="w-full">
                <CardHeader>
                    <div className='flex justify-between items-center'>
                        <div>
                            <CardTitle><span className="text-yellow-400">Elevador en Curso</span></CardTitle>
                            <CardDescription>Partidas activas de la categoría <span className="font-bold text-primary">{category}</span>.</CardDescription>
                        </div>
                         {user?.role === 'admin' && (
                             <Button onClick={() => setView('setup')} size="sm">
                                <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo
                            </Button>
                         )}
                    </div>
                </CardHeader>
                <CardContent>
                    {ongoingMatches.length > 0 ? (
                        <div className="space-y-2">
                            {ongoingMatches.map(match => (
                                <div key={match.id} onClick={() => { setSelectedMatch(match); setView('match'); }} className="p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{match.eventName || 'Elevador'}</p>
                                        <p className="text-xs text-muted-foreground">{match.date} - {match.modality === 'elevador' ? 'Individual' : 'Parejas'}</p>
                                    </div>
                                    <BarChart className="h-4 w-4 text-muted-foreground opacity-50" />
                                </div>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-8 text-muted-foreground">
                            <Gamepad2 className="mx-auto h-12 w-12 mb-2" />
                            <p>No hay eventos de elevador en curso.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    if (view === 'match' && selectedMatch) {
        const lastRound = selectedMatch.rounds[selectedMatch.rounds.length - 1];
        const allScoresEntered = isRoundComplete(lastRound);
        const isGameFinished = selectedMatch.rounds.length === TOTAL_ROUNDS && allScoresEntered;
        const allCompetitionScoresEntered = selectedMatch.rounds.filter(r => !r.isBonus).every(isRoundComplete);

        return (
            <div className="space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-4">
                     <div>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedMatch(null); setView('list'); }}>
                           <ArrowLeft className="mr-2 h-4 w-4"/> Volver
                       </Button>
                        <h2 className="text-2xl font-bold text-primary mt-2">{selectedMatch.eventName} ({category})</h2>
                   </div>
                    <div className="flex gap-2">
                         {user?.role === 'admin' && selectedMatch.rounds.length > 1 && (
                            <Button variant="outline" size="sm" onClick={handleGoBackToPreviousRound}>
                                <ArrowLeft className="mr-2 h-4 w-4"/> Ronda Anterior
                            </Button>
                        )}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={user?.role !== 'admin'}>
                                    <Trash2 className="mr-2 h-4 w-4"/> Descartar
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Descartar partida?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción es permanente y eliminará el progreso actual.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDiscard}>Confirmar y Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                <Accordion type="single" collapsible className="w-full" value={openAccordion} onValueChange={setOpenAccordion}>
                    {selectedMatch.rounds.map((round, roundIndex) => (
                        <AccordionItem value={`round-${round.roundNumber}`} key={round.roundNumber}>
                            <AccordionTrigger className={cn("text-lg font-medium", round.isBonus && "gold-text")}>
                                Ronda {round.roundNumber} {round.isBonus && '(Bonus)'}
                            </AccordionTrigger>
                            <AccordionContent className={cn(round.isBonus && 'bg-yellow-400/10 p-4 rounded-md')}>
                                <div className="grid grid-cols-1 md:grid-cols-2 3xl:grid-cols-3 gap-4">
                                {round.courts.map((court, courtIndex) => (
                                    <Card key={court.courtNumber}>
                                        <CardHeader className='pb-2'>
                                            <CardTitle className="text-2xl font-black text-blue-500 uppercase">Cancha {court.courtNumber}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {court.match ? (
                                                 <div className='flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/50'>
                                                    {/* Team 1 */}
                                                    <div className='flex-1 flex flex-col items-end gap-1'>
                                                        <span className='text-xs font-bold text-white uppercase whitespace-nowrap'>{court.match.team1.player1.name}</span>
                                                        <span className='text-xs font-bold text-white uppercase whitespace-nowrap'>{court.match.team1.player2.name}</span>
                                                    </div>
                                                    
                                                    {/* Score Area */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Input 
                                                            type="text" 
                                                            inputMode="numeric"
                                                            value={court.match.score1 ?? ''} 
                                                            onChange={e => handleScoreChange(roundIndex, courtIndex, 'team1', e.target.value)} 
                                                            className="w-12 h-12 text-center text-xl font-black bg-background border-2 border-primary/20" 
                                                            disabled={user?.role === 'guest'}
                                                        />
                                                        <span className='font-black text-primary text-xl'>:</span>
                                                        <Input 
                                                            type="text" 
                                                            inputMode="numeric"
                                                            value={court.match.score2 ?? ''} 
                                                            onChange={e => handleScoreChange(roundIndex, courtIndex, 'team2', e.target.value)} 
                                                            className="w-12 h-12 text-center text-xl font-black bg-background border-2 border-primary/20" 
                                                            disabled={user?.role === 'guest'}
                                                        />
                                                    </div>
                                                    
                                                    {/* Team 2 */}
                                                    <div className='flex-1 flex flex-col items-start gap-1'>
                                                        <span className='text-xs font-bold text-white uppercase whitespace-nowrap'>{court.match.team2.player1.name}</span>
                                                        <span className='text-xs font-bold text-white uppercase whitespace-nowrap'>{court.match.team2.player2.name}</span>
                                                    </div>
                                                </div>
                                            ) : <p>Error al generar partido</p>}
                                        </CardContent>
                                    </Card>
                                ))}
                                </div>
                                {roundIndex === selectedMatch.rounds.length - 1 && !isGameFinished && (
                                    <div className="flex justify-end mt-4">
                                        <Button onClick={startNextRound} disabled={!allScoresEntered || user?.role === 'guest'} size="sm">
                                            <Play className="mr-2 h-4 w-4" /> Iniciar Siguiente Ronda
                                        </Button>
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5"/> Clasificación</CardTitle>
                        <CardDescription>Puesto determinado por G, Diferencia de Puntos y Cancha Final.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>{selectedMatch.modality === 'elevador' ? 'Jugador' : 'Pareja'}</TableHead>
                                    <TableHead className="text-center">G</TableHead>
                                    <TableHead className="text-center">Pts.</TableHead>
                                    <TableHead className="text-center">Cancha Final</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedRanking.map((p, index) => (
                                    <TableRow key={index} className={cn(index < 3 && "bg-primary/5 font-bold")}>
                                        <TableCell className="flex items-center gap-1">{index + 1} {getMedal(index)}</TableCell>
                                        <TableCell className="truncate max-w-[150px]">{p.name}</TableCell>
                                        <TableCell className="text-center">{p.gamesWon}</TableCell>
                                        <TableCell className="text-center font-semibold text-primary">{p.pointsScored}</TableCell>
                                        <TableCell className="text-center">{p.finalCourt}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <div className="flex justify-end mt-6">
                            <Button disabled={isSaving || !allCompetitionScoresEntered || user?.role !== 'admin'} onClick={saveEvent}>
                                <Sparkles className="mr-2 h-4 w-4" /> {isSaving ? 'Guardando...' : 'Finalizar y Guardar'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <div className='flex justify-between items-center'>
                    <div>
                        <CardTitle><span className="text-yellow-400">Configurar Elevador</span></CardTitle>
                        <CardDescription>{category} Cat.</CardDescription>
                    </div>
                     {view === 'setup' && ongoingMatches.length > 0 && (
                         <Button variant="outline" size="sm" onClick={() => setView('list')}>
                            <ArrowLeft className="mr-2 h-4 w-4"/> Volver
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                 {user?.role === 'guest' ? (
                     <Alert><Info className="h-4 w-4" /><AlertTitle>Solo vista</AlertTitle><AlertDescription>Solo administradores pueden iniciar eventos.</AlertDescription></Alert>
                 ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Modalidad</Label>
                                <Select value={modality} onValueChange={(v) => setModality(v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="elevador"><User className="inline h-3 w-3 mr-2"/> Individual</SelectItem>
                                        <SelectItem value="elevadorParejas"><Users className="inline h-3 w-3 mr-2"/> Parejas Fijas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Nombre del Evento</Label>
                                <Input placeholder="Ej: Mañana, Tarde..." value={eventName} onChange={(e) => setEventName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Fecha</Label>
                                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                            </div>
                            {modality === 'elevador' && (
                                <div className="space-y-2">
                                    <Label>Cantidad de Jugadores</Label>
                                    <Select value={numberOfPlayers} onValueChange={setNumberOfPlayers}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="8">8 Jugadores (2 canchas)</SelectItem>
                                            <SelectItem value="12">12 Jugadores (3 canchas)</SelectItem>
                                            <SelectItem value="16">16 Jugadores (4 canchas)</SelectItem>
                                            <SelectItem value="20">20 Jugadores (5 canchas)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {modality === 'elevador' ? (
                            <div className="space-y-2">
                                <Label>Jugadores ({selectedPlayers.length} / {numberOfPlayers})</Label>
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><Users className="mr-2 h-4 w-4" /> Seleccionar Jugadores</Button></PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command><CommandInput placeholder="Buscar..." /><CommandList><CommandEmpty>Sin resultados.</CommandEmpty><CommandGroup>
                                                {allPlayers.map(player => (
                                                    <CommandItem key={player.id} onSelect={() => handlePlayerToggle(player)}>
                                                        <Checkbox checked={selectedPlayers.some(p => p.id === player.id)} className="mr-2" /> {player.name}
                                                    </CommandItem>
                                                ))}
                                        </CommandGroup></CommandList></Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Label>Configurar Parejas ({fixedPairs.length})</Label>
                                <div className="flex gap-2">
                                    <Select value={player1?.id || ''} onValueChange={id => setPlayer1(allPlayers.find(p => p.id === id) || null)}>
                                        <SelectTrigger><SelectValue placeholder="Jugador 1" /></SelectTrigger>
                                        <SelectContent>{availablePlayersForPairing.filter(p => p.id !== player2?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Select value={player2?.id || ''} onValueChange={id => setPlayer2(allPlayers.find(p => p.id === id) || null)}>
                                        <SelectTrigger><SelectValue placeholder="Jugador 2" /></SelectTrigger>
                                        <SelectContent>{availablePlayersForPairing.filter(p => p.id !== player1?.id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button onClick={handleAddPair} size="icon"><PlusCircle className="h-4 w-4"/></Button>
                                </div>
                                <div className="border rounded-md p-2 space-y-2">
                                    {fixedPairs.map(p => (
                                        <div key={p.id} className="flex justify-between items-center bg-muted p-2 rounded text-xs">
                                            {p.player1.name} & {p.player2.name}
                                            <Button variant="ghost" size="icon" onClick={() => handleRemovePair(p.id)} className="h-6 w-6 text-destructive"><Trash2 className="h-3 w-3"/></Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button onClick={startElevador} disabled={modality === 'elevador' ? selectedPlayers.length !== parseInt(numberOfPlayers, 10) : (fixedPairs.length < 2 || fixedPairs.length % 2 !== 0)}>
                                <Dices className="mr-2 h-4 w-4" /> Iniciar Elevador
                            </Button>
                        </div>
                    </>
                 )}
            </CardContent>
        </Card>
    );
};

export default RegistroElevador;

