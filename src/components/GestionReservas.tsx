
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { Reservation, PaymentMethod } from '@/types';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, CalendarClock, Loader2, Pencil, Trash2, Banknote, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '@/lib/utils';
import { Checkbox } from './ui/checkbox';
import { useFirebase } from '@/context/FirebaseContext';
import { Switch } from './ui/switch';
import { useAuth } from '@/context/AuthContext';


const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
}

const courts = [1, 2, 3, 4];
const timeSlots = Array.from({ length: (23 - 7) * 2 + 1 }, (_, i) => {
    const hour = 7 + Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});


const GestionReservas = () => {
    const { db } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingReservation, setEditingReservation] = useState<Partial<Reservation> | null>(null);

    // Cost states
    const [courtPrice, setCourtPrice] = useState<number>(0);
    const [ballsPrice, setBallsPrice] = useState<number>(0);
    const [racketsPrice, setRacketsPrice] = useState<number>(0);
    const [isPaid, setIsPaid] = useState<boolean>(false);

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const canDelete = user?.username === 'Admin';

    useEffect(() => {
        if (!db) return;
        setLoading(true);
        const reservationsQuery = query(
            collection(db, "reservations"),
            where("date", "==", formattedDate)
        );

        const unsubscribe = onSnapshot(reservationsQuery, (snapshot) => {
            const newReservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
            // Sort by time to ensure consistent behavior in findReservationForSlot
            setReservations(newReservations.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching reservations: ", error);
            toast({ title: "Error", description: "No se pudieron cargar las reservas.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, formattedDate, toast]);

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!db) return;
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
    
        if (!data.time || !data.courtId || !data.playerName) {
            toast({ title: "Error", description: "Por favor, completa todos los campos obligatorios.", variant: "destructive" });
            return;
        }

        // Prevent overlapping if not editing an existing one
        if (!editingReservation?.id) {
            const isSlotTaken = reservations.some(r => r.time === data.time && r.courtId === Number(data.courtId));
            if (isSlotTaken) {
                toast({ title: "Pista ocupada", description: "Ya existe una reserva en ese horario y cancha.", variant: "destructive" });
                return;
            }
        }
        
        const shouldRepeat = formData.get('repeat') === 'on';
        const total = courtPrice + ballsPrice + racketsPrice;
    
        try {
            const reservationData: Omit<Reservation, 'id'> = {
                date: editingReservation?.date || formattedDate,
                time: data.time as string,
                duration: parseInt(data.duration as string, 10),
                courtId: parseInt(data.courtId as string, 10) as 1 | 2 | 3 | 4,
                playerName: data.playerName as string,
                type: data.type as Reservation['type'],
                status: data.status as Reservation['status'],
                notes: data.notes as string,
                courtPrice,
                ballsPrice,
                racketsPrice,
                total,
                isPaid,
                paymentMethod: (data.paymentMethod as PaymentMethod) || 'efectivo'
            };

            if (editingReservation && editingReservation.id) {
                const docRef = doc(db, "reservations", editingReservation.id);
                await updateDoc(docRef, reservationData);
                toast({ title: "Éxito", description: "Reserva actualizada correctamente." });
            } else if (shouldRepeat) {
                const referenceDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 12);
                const dayOfWeek = getDay(referenceDate);
                const monthInterval = { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
                const allDaysInMonth = eachDayOfInterval(monthInterval);
                const targetDates = allDaysInMonth.filter(d => getDay(d) === dayOfWeek);
                
                const batch = writeBatch(db);
                targetDates.forEach(dateToReserve => {
                    const newDocRef = doc(collection(db, "reservations"));
                    batch.set(newDocRef, { ...reservationData, date: format(dateToReserve, 'yyyy-MM-dd') });
                });
                await batch.commit();
                toast({ title: "Éxito", description: `Reservas creadas para cada ${format(referenceDate, 'EEEE', { locale: es })} del mes.` });
            } else {
                await addDoc(collection(db, "reservations"), reservationData);
                toast({ title: "Éxito", description: "Reserva creada correctamente." });
            }
    
            setIsDialogOpen(false);
            setEditingReservation(null);
        } catch (error) {
            console.error("Error saving reservation: ", error);
            toast({ title: "Error", description: "No se pudo guardar la reserva.", variant: "destructive" });
        }
    };
    
    const handleDeleteReservation = async (reservationId: string) => {
        if (!db || !canDelete) return;
        try {
            await deleteDoc(doc(db, "reservations", reservationId));
            toast({ title: "Éxito", description: "Reserva eliminada." });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo eliminar la reserva.", variant: "destructive" });
        }
    };
    
    const openEditDialog = (reservation: Reservation) => {
        setEditingReservation(reservation);
        setCourtPrice(reservation.courtPrice || 0);
        setBallsPrice(reservation.ballsPrice || 0);
        setRacketsPrice(reservation.racketsPrice || 0);
        setIsPaid(reservation.isPaid || false);
        setIsDialogOpen(true);
    }
    
    const openNewDialog = (time?: string, courtId?: number) => {
        setEditingReservation({
            date: formattedDate,
            time: time,
            courtId: courtId as 1 | 2 | 3 | 4,
            type: 'libre',
            status: 'Confirmada',
            duration: 90
        });
        setCourtPrice(0);
        setBallsPrice(0);
        setRacketsPrice(0);
        setIsPaid(false);
        setIsDialogOpen(true);
    };

    const findReservationForSlot = (time: string, courtId: number): Reservation | undefined => {
        const slotStartMinutes = timeToMinutes(time);
        for (const r of reservations) {
            if (r.courtId !== courtId) continue;
            const reservationStartMinutes = timeToMinutes(r.time);
            const duration = r.duration || 90;
            const reservationEndMinutes = reservationStartMinutes + duration;
            if (slotStartMinutes >= reservationStartMinutes && slotStartMinutes < reservationEndMinutes) {
                return r;
            }
        }
        return undefined;
    };

    const getReservationStyles = (res: Reservation) => {
        if (res.isPaid) return 'bg-emerald-600'; // Verde para pagadas
        if (res.status === 'Pendiente') return 'bg-orange-500'; // Naranja para pendientes de confirmar
        return 'bg-blue-600'; // Azul para confirmadas no pagadas
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Calendario</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            locale={es}
                            className="rounded-md border"
                        />
                    </CardContent>
                </Card>
            </div>
            <div className="xl:col-span-2">
                 <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center flex-wrap gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                     <CalendarClock className="text-primary"/>
                                     <span className="text-yellow-400">
                                        Reservas para el {format(selectedDate, "d 'de' MMMM", { locale: es })}
                                    </span>
                                </CardTitle>
                                <CardDescription>Gestiona las reservas de las 4 pistas del club.</CardDescription>
                            </div>
                            <Button onClick={() => openNewDialog()}>
                                <PlusCircle className="mr-2"/> Nueva Reserva
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                             <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table className="min-w-max border">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-24 sticky left-0 bg-background/95">Hora</TableHead>
                                            {courts.map(id => <TableHead key={id} className="text-center w-32">Pista {id}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {timeSlots.map(time => (
                                            <TableRow key={time} className="h-14">
                                                <TableCell className="font-semibold sticky left-0 bg-background/95 z-10">{time}</TableCell>
                                                {courts.map(courtId => {
                                                    const reservation = findReservationForSlot(time, courtId);
                                                    
                                                    if (reservation && reservation.time !== time) {
                                                        return null;
                                                    }
                                                    
                                                    const rowSpan = reservation ? (reservation.duration || 90) / 30 : 1;

                                                    return (
                                                        <TableCell key={courtId} rowSpan={rowSpan} className="p-1 align-top border">
                                                            {reservation ? (
                                                                <div className={cn(
                                                                    "relative p-2 rounded-md text-xs h-full flex flex-col justify-between text-white transition-colors duration-300",
                                                                    getReservationStyles(reservation)
                                                                )}>
                                                                    <div>
                                                                        <div className='flex items-center justify-between gap-1'>
                                                                            <p className="font-bold truncate max-w-[80px]">{reservation.playerName}</p>
                                                                            {reservation.isPaid ? <CheckCircle2 className='h-3 w-3 text-white' /> : (reservation.status === 'Confirmada' ? <CheckCircle2 className='h-3 w-3 text-white/70' /> : <Clock className='h-3 w-3 text-white/70' />)}
                                                                        </div>
                                                                        <p className="capitalize text-[10px] opacity-90">{reservation.type} - {reservation.status}</p>
                                                                        <p className="font-semibold mt-1 flex items-center gap-1">
                                                                            <Banknote className='h-3 w-3' /> ${reservation.total || 0}
                                                                        </p>
                                                                    </div>
                                                                     <div className="absolute bottom-1 right-1 flex gap-1">
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => openEditDialog(reservation)}>
                                                                            <Pencil className="h-3 w-3"/>
                                                                        </Button>
                                                                        {canDelete && (
                                                                            <AlertDialog>
                                                                                <AlertDialogTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20"><Trash2 className="h-3 w-3"/></Button>
                                                                                </AlertDialogTrigger>
                                                                                <AlertDialogContent>
                                                                                    <AlertDialogHeader>
                                                                                        <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
                                                                                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                                                                    </AlertDialogHeader>
                                                                                    <AlertDialogFooter>
                                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                                        <AlertDialogAction onClick={() => handleDeleteReservation(reservation.id)}>Confirmar</AlertDialogAction>
                                                                                    </AlertDialogFooter>
                                                                                </AlertDialogContent>
                                                                            </AlertDialog>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <Button variant="ghost" className="h-full w-full" onClick={() => openNewDialog(time, courtId)}>
                                                                    <PlusCircle className="h-4 w-4 text-muted-foreground"/>
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingReservation && editingReservation.id ? 'Editar Reserva' : 'Nueva Reserva'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleFormSubmit} id="reservation-form" className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <Label htmlFor="time">Hora</Label>
                                <Select name="time" defaultValue={editingReservation?.time}>
                                    <SelectTrigger id="time"><SelectValue/></SelectTrigger>
                                    <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="courtId">Pista</Label>
                                <Select name="courtId" defaultValue={editingReservation?.courtId?.toString()}>
                                    <SelectTrigger id="courtId"><SelectValue/></SelectTrigger>
                                    <SelectContent>{courts.map(c => <SelectItem key={c} value={c.toString()}>{`Pista ${c}`}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="duration">Duración</Label>
                                <Select name="duration" defaultValue={(editingReservation?.duration ?? 90).toString()}>
                                    <SelectTrigger id="duration"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="60">1 hora</SelectItem>
                                        <SelectItem value="90">1.5 horas</SelectItem>
                                        <SelectItem value="120">2 horas</SelectItem>
                                        <SelectItem value="180">3 horas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="type">Tipo</Label>
                                <Select name="type" defaultValue={editingReservation?.type ?? 'libre'}>
                                    <SelectTrigger id="type"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="6loco">6 Loco</SelectItem>
                                        <SelectItem value="torneo">Torneo</SelectItem>
                                        <SelectItem value="clase">Clase</SelectItem>
                                        <SelectItem value="libre">Alquiler Libre</SelectItem>
                                        <SelectItem value="otro">Otro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="playerName">Nombre de la Reserva</Label>
                            <Input id="playerName" name="playerName" defaultValue={editingReservation?.playerName ?? ""} required/>
                        </div>

                        <div className="border rounded-md p-4 space-y-4 bg-muted/20">
                            <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                                <Banknote className='h-4 w-4'/> Finanzas y Cobro
                            </h4>
                            <div className="grid grid-cols-3 gap-2">
                                <div className='space-y-1'>
                                    <Label className='text-[10px] uppercase font-bold opacity-70'>Precio Pista ($)</Label>
                                    <Input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={courtPrice === 0 ? '' : courtPrice} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) {
                                                setCourtPrice(val === '' ? 0 : Number(val));
                                            }
                                        }}
                                        className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        placeholder="0"
                                    />
                                </div>
                                <div className='space-y-1'>
                                    <Label className='text-[10px] uppercase font-bold opacity-70'>Pelotas ($)</Label>
                                    <Input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={ballsPrice === 0 ? '' : ballsPrice} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) {
                                                setBallsPrice(val === '' ? 0 : Number(val));
                                            }
                                        }}
                                        className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        placeholder="0"
                                    />
                                </div>
                                <div className='space-y-1'>
                                    <Label className='text-[10px] uppercase font-bold opacity-70'>Palas ($)</Label>
                                    <Input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={racketsPrice === 0 ? '' : racketsPrice} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d+$/.test(val)) {
                                                setRacketsPrice(val === '' ? 0 : Number(val));
                                            }
                                        }}
                                        className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between border-t pt-2 mt-2">
                                <div className='flex flex-col'>
                                    <span className='text-xs text-muted-foreground'>Total a pagar:</span>
                                    <span className='text-lg font-bold text-primary'>${courtPrice + ballsPrice + racketsPrice}</span>
                                </div>
                                <div className='space-y-2 text-right'>
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="paid-switch" className='text-xs'>¿Pagado?</Label>
                                        <Switch id="paid-switch" checked={isPaid} onCheckedChange={setIsPaid} />
                                    </div>
                                    <Select name="paymentMethod" defaultValue={editingReservation?.paymentMethod || 'efectivo'}>
                                        <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="efectivo">Efectivo</SelectItem>
                                            <SelectItem value="transferencia">Transferencia</SelectItem>
                                            <SelectItem value="tarjeta">Tarjeta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="status">Estado Reserva</Label>
                            <Select name="status" defaultValue={editingReservation?.status ?? 'Confirmada'}>
                                <SelectTrigger id="status"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Confirmada">Confirmada</SelectItem>
                                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="notes">Notas (opcional)</Label>
                            <Input id="notes" name="notes" defaultValue={editingReservation?.notes ?? ''}/>
                        </div>
                        {!(editingReservation && editingReservation.id) && (
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox id="repeat" name="repeat" />
                                <Label htmlFor="repeat" className="text-sm font-normal">
                                    Repetir para todo el mes (cada {format(selectedDate, "EEEE", { locale: es })})
                                </Label>
                            </div>
                        )}
                    </form>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Cancelar</Button>
                        </DialogClose>
                        <Button type="submit" form="reservation-form">Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GestionReservas;
