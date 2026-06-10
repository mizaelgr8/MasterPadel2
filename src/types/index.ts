
export type Category = '3ra' | '4ta' | '5ta';

export interface Player {
  id: string;
  name: string;
  category: Category;
  totalGames: number;
  totalPoints: number;
  efficiency: number;
  medals: {
    gold: number;
    silver: number;
    bronze: number;
  };
  achievements: {
    king: number;
    shield: number;
    sword: number;
  };
  trophies: {
    first: number;
    second: number;
    third: number;
  };
}


export interface DailyResult {
  playerId: string;
  name: string;
  points: number;
  g: number;
  e: number;
  p: number;
}

export interface DailyEvent {
  id: string;
  date: string; // YYYY-MM-DD
  name?: string;
  results: DailyResult[];
  modality: '6loco';
  category: Category;
}

export interface DailyPairResult {
    pairId: string;
    player1: { id: string; name: string };
    player2: { id: string; name: string };
    points: number;
    g: number;
    e: number;
    p: number;
}

export interface DailyPairEvent {
    id: string;
    date: string; // YYYY-MM-DD
    name?: string;
    results: DailyPairResult[];
    modality: 'parejaFija' | '6locoParejas';
    category: Category;
}


export interface MonthlyRankingPlayer {
  playerId: string;
  name: string;
  category: Category;
  rankScore: number;
  totalGames: number;
  totalPoints: number;
  avgPoints: number;
  medals: {
    gold: number;
    silver: number;
    bronze: number;
  };
  g: number;
  e: number;
  p: number;
}

export interface MonthlyRanking {
  id: string; // YYYY-MM-category
  category: Category;
  players: MonthlyRankingPlayer[];
}

export interface MonthlyPairRankingPlayer {
    pairId: string; // e.g., "playerId1-playerId2"
    player1: { id: string; name: string };
    player2: { id: string; name: string };
    category: Category;
    rankScore: number;
    totalGames: number;
    totalPoints: number;
    avgPoints: number;
    medals: {
        gold: number;
        silver: number;
        bronze: number;
    };
    g: number;
    e: number;
    p: number;
}

export interface MonthlyPairRanking {
    id: string; // YYYY-MM-category
    category: Category;
    pairs: MonthlyPairRankingPlayer[];
}

export interface GeneralPairRankingPlayer {
  pairId: string;
  player1: { id: string, name: string };
  player2: { id: string, name: string };
  totalGames: number;
  totalPoints: number;
  achievements: {
    king: number;
    shield: number;
    sword: number;
  };
  medals: { // For potential future use
    gold: number;
    silver: number;
    bronze: number;
  };
  trophies: {
    first: number;
    second: number;
    third: number;
  };
}


// Types for new automated match registration
export type Modality = '6loco' | 'parejaFija' | 'elevador' | '6locoParejas';

export interface Pair {
    id: string;
    player1: Player;
    player2: Player;
}

// 6 Loco Types
export interface Match {
  team1: Pair;
  team2: Pair;
  score1: number | null;
  score2: number | null;
  courtNumber?: number;
}

export interface Round {
  matches: Match[];
  isBonus?: boolean;
}

// Torneo Americano (Pareja Fija) Types
export interface AmericanoMatch {
    team1: Pair;
    team2: Pair;
    set1_t1: number | null;
    set1_t2: number | null;
    set2_t1: number | null;
    set2_t2: number | null;
    set3_t1: number | null;
    set3_t2: number | null;
    courtNumber?: number;
}

export interface AmericanoRound {
    roundNumber: number;
    matches: AmericanoMatch[];
}

export interface AmericanoRankingEntry {
    pairId: string;
    name: string;
    team: Pair;
    points: number; // 3-2-1-0 points
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
}

export interface OngoingMatch {
    id: string;
    eventName: string;
    date: string;
    modality: Modality;
    category: Category;
    selectedPlayers: Player[];
    fixedPairs: Pair[];
    rounds: Round[];
    americanoRounds: AmericanoRound[];
}

// Types for Tournament
export interface TournamentPair {
    id: string;
    name: string;
    player1: Player;
    player2: Player;
    stats: {
        played: number;
        won: number;
        lost: number;
        points: number;
    };
}

export interface TournamentMatch {
    team1: TournamentPair;
    team2: TournamentPair;
    score1: number | null;
    score2: number | null;
}

export interface TournamentMatchGroup {
    name: string;
    pairs: TournamentPair[];
    matches: TournamentMatch[];
}

export interface FinalStandingPair {
    id: string;
    name: string;
    player1: { id: string; name: string; };
    player2: { id: string; name: string; };
    position: number;
}

export interface CompletedTournament {
    id: string;
    date: string;
    category: Category;
    standings: FinalStandingPair[];
    groups: { A: TournamentMatchGroup, B: TournamentMatchGroup };
    semifinals: TournamentMatch[];
    silverSemifinals: TournamentMatch[];
    finals: TournamentMatch[];
}

export interface OngoingTournament {
    id: string;
    stage: 'setup' | 'group' | 'eliminatorias';
    category: Category;
    selectedPairs: TournamentPair[];
    groups: { A: TournamentMatchGroup, B: TournamentMatchGroup } | null;
    semifinals: TournamentMatch[];
    silverSemifinals: TournamentMatch[];
    finals: TournamentMatch[];
    finalStandings: TournamentPair[];
}

// Types for Elevador
export type ElevadorPlayer = Player & { court: number };

export interface ElevadorMatch {
    team1: { player1: ElevadorPlayer; player2: ElevadorPlayer };
    team2: { player1: ElevadorPlayer; player2: ElevadorPlayer };
    score1: number | null;
    score2: number | null;
}

export interface ElevadorCourt {
    courtNumber: number;
    players: ElevadorPlayer[];
    match: ElevadorMatch | null;
}

export interface ElevadorRound {
    roundNumber: number;
    courts: ElevadorCourt[];
    isBonus?: boolean;
}

export interface ElevadorPlayerStats {
    playerId: string;
    name: string;
    gamesWon: number;
    gamesLost: number;
    pointsScored: number;
    pointsReceived: number;
    pointsDifference: number;
    courtHistory: number[];
    finalCourt: number;
}

export interface OngoingElevador {
    id: string;
    eventName?: string;
    numberOfPlayers: string;
    selectedPlayers: Player[];
    category: Category;
    rounds: ElevadorRound[];
    stage: 'setup' | 'playing';
    playerStats: Record<string, ElevadorPlayerStats>;
    date: string;
}

export interface DailyElevadorResult {
    playerId: string;
    name: string;
    gamesWon: number;
    gamesLost: number;
    pointsScored: number;
    pointsReceived: number;
    pointsDifference: number;
    finalCourt: number;
}

export interface DailyElevadorEvent {
    id: string; // YYYY-MM-DD
    date: string; // YYYY-MM-DD
    name?: string;
    results: DailyElevadorResult[];
    modality: 'elevador';
    category: Category;
}


// Auth Types
export interface User {
    username: string;
    role: 'admin' | 'guest';
}

// Financial Types
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta';

// Reservation Types
export interface Reservation {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // "HH:mm"
  duration: number; // in minutes
  courtId: 1 | 2 | 3 | 4;
  playerName: string;
  type: '6loco' | 'torneo' | 'clase' | 'libre' | 'otro';
  status: 'Confirmada' | 'Pendiente';
  notes?: string;
  // Cost fields
  courtPrice: number;
  ballsPrice: number;
  racketsPrice: number;
  total: number;
  isPaid: boolean;
  paymentMethod: PaymentMethod;
}

export interface CashMovement {
    id: string;
    date: string; // YYYY-MM-DD
    description: string;
    amount: number;
    type: 'ingreso' | 'egreso';
    paymentMethod: PaymentMethod;
}
