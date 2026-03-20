"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { useFirebase } from '@/context/FirebaseContext';
import type { Reservation, CashMovement, PaymentMethod } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Wallet, CalendarDays, ArrowUpRight, ArrowDownLeft, ReceiptText } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const Caja = () => {
    const { db } = useFirebase();
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [movements, setMovements] = useState<CashMovement[]>([]);
    const [monthlyReservations, setMonthlyReservations] = useState<Reservation[]>([]);
    const [monthlyMovements, setMonthlyMovements] = useState<CashMovement[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const currentMonthStart = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
    const currentMonthEnd = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

    useEffect(() => {
        if (!db) return;
        setLoading(true);
        
        // Datos DIARIOS
        const resQuery = query(collection(db, "reservations"), where("date", "==", formattedDate));
        const movQuery = query(collection(db, "cashMovements"), where("date", "==", formattedDate));

        const unsubRes = onSnapshot(resQuery, (snapshot) => {
            setReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation)));
        });

        const unsubMov = onSnapshot(movQuery, (snapshot) => {
            setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashMovement)));
            setLoading(false);
        });

        // Datos MENSUALES
        const monthlyResQuery = query(
            collection(db, "reservations"), 
            where("date", ">=", currentMonthStart), 
            where("date", "<=", currentMonthEnd)
        );
        const monthlyMovQuery = query(
            collection(db, "cashMovements"), 
            where("date", ">=", currentMonthStart), 
            where("date", "<=", currentMonthEnd)
        );

        const unsubMonthlyRes = onSnapshot(monthlyResQuery, (snapshot) => {
            setMonthlyReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation)));
        });

        const unsubMonthlyMov = onSnapshot(monthlyMovQuery, (snapshot) => {
            setMonthlyMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashMovement)));
        });

        return () => { 
            unsubRes(); unsubMov(); 
            unsubMonthlyRes(); unsubMonthlyMov();
        };
    }, [db, formattedDate, currentMonthStart, currentMonthEnd]);

    const paidReservations = useMemo(() => reservations.filter(r => r.isPaid), [reservations]);

    const stats = useMemo(() => {
        const totalReservations = paidReservations.reduce((acc, r) => acc + (r.total || 0), 0);
        const totalOtherIngresos = movements.filter(m => m.type === 'ingreso').reduce((acc, m) => acc + m.amount, 0);
        const totalEgresos = movements.filter(m => m.type === 'egreso').reduce((acc, m) => acc + m.amount, 0);
        
        const byMethod = { efectivo: 0, transferencia: 0, tarjeta: 0 };

        paidReservations.forEach(r => {
            const method = r.paymentMethod || 'efectivo';
            byMethod[method] += (r.total || 0);
        });

        movements.forEach(m => {
            if (m.type === 'ingreso') byMethod[m.paymentMethod] += m.amount;
            else byMethod[m.paymentMethod] -= m.amount;
        });

        return {
            totalReservations,
            totalOtherIngresos,
            totalEgresos,
            totalFinal: totalReservations + totalOtherIngresos - totalEgresos,
            byMethod
        };
    }, [paidReservations, movements]);

    const monthlyStats = useMemo(() => {
        const paidRes = monthlyReservations.filter(r => r.isPaid);
        const totalRes = paidRes.reduce((acc, r) => acc + (r.total || 0), 0);
        const totalOtherIn = monthlyMovements.filter(m => m.type === 'ingreso').reduce((acc, m) => acc + m.amount, 0);
        const totalOut = monthlyMovements.filter(m => m.type === 'egreso').reduce((acc, m) => acc + m.amount, 0);

        return {
            incomes: totalRes + totalOtherIn,
            expenses: totalOut,
            balance: (totalRes + totalOtherIn) - totalOut
        };
    }, [monthlyReservations, monthlyMovements]);

    const handleAddMovement = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!db) return;
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        try {
            await addDoc(collection(db, "cashMovements"), {
                date: formattedDate,
                description: data.description as string,
                amount: Number(data.amount),
                type: data.type as 'ingreso' | 'egreso',
                paymentMethod: data.paymentMethod as PaymentMethod
            });
            toast({ title: "Éxito", description: "Movimiento registrado correctamente." });
            setIsDialogOpen(false);
        } catch (error) {
            toast({ title: "Error", description: "No se pudo registrar.", variant: "destructive" });
        }
    };

    const handleDeleteMovement = async (id: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, "cashMovements", id));
            toast({ title: "Éxito", description: "Movimiento eliminado." });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="xl:col-span-1 space-y-6">
                <Card>
                    <CardHeader><CardTitle>Calendario</CardTitle></CardHeader>
                    <CardContent className="flex justify-center">
                        <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} locale={es} className="rounded-md border" />
                    </CardContent>
                </Card>

                <Card className='bg-primary/5 border-primary/20'>
                    <CardHeader>
                        <CardTitle className='text-lg flex items-center gap-2'>
                            <Wallet className='h-5 w-5 text-primary'/> Resumen del Día
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Efectivo</span>
                            <span className="text-lg font-bold text-green-500">${stats.byMethod.efectivo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Transferencia</span>
                            <span className="text-lg font-bold text-blue-500">${stats.byMethod.transferencia}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Tarjeta</span>
                            <span className="text-lg font-bold text-purple-500">${stats.byMethod.tarjeta}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className='border-yellow-500/30 bg-yellow-500/5'>
                    <CardHeader>
                        <CardTitle className='text-lg flex items-center gap-2 text-yellow-500'>
                            <CalendarDays className='h-5 w-5'/> 
                            Resumen de {format(selectedDate, 'MMMM', { locale: es })}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className="flex justify-between items-center pb-2 border-b border-yellow-500/10">
                            <span className="text-sm">Total Ingresos</span>
                            <span className="font-bold text-green-500">${monthlyStats.incomes}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-yellow-500/10">
                            <span className="text-sm">Total Gastos</span>
                            <span className="font-bold text-red-500">${monthlyStats.expenses}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm font-bold uppercase">Balance Neto</span>
                            <span className={cn("text-2xl font-black", monthlyStats.balance >= 0 ? "text-primary" : "text-destructive")}>
                                ${monthlyStats.balance}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="xl:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className='bg-green-500/10 border-green-500/20'>
                        <CardContent className='pt-6'>
                            <div className='flex items-center gap-2 text-green-600 mb-1'>
                                <ArrowUpRight className='h-4 w-4'/> <span className='text-xs font-bold uppercase'>Ingresos Día</span>
                            </div>
                            <p className='text-2xl font-bold'>${stats.totalReservations + stats.totalOtherIngresos}</p>
                        </CardContent>
                    </Card>
                    <Card className='bg-red-500/10 border-red-500/20'>
                        <CardContent className='pt-6'>
                            <div className='flex items-center gap-2 text-red-600 mb-1'>
                                <ArrowDownLeft className='h-4 w-4'/> <span className='text-xs font-bold uppercase'>Gastos Día</span>
                            </div>
                            <p className='text-2xl font-bold'>${stats.totalEgresos}</p>
                        </CardContent>
                    </Card>
                    <Card className='bg-primary border-primary text-primary-foreground'>
                        <CardContent className='pt-6'>
                            <div className='flex items-center gap-2 mb-1'>
                                <ReceiptText className='h-4 w-4'/> <span className='text-xs font-bold uppercase'>Corte Final Día</span>
                            </div>
                            <p className='text-2xl font-black'>${stats.totalFinal}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className='flex flex-row items-center justify-between'>
                        <div>
                            <CardTitle>Movimientos de Caja</CardTitle>
                            <CardDescription>{format(selectedDate, "PPP", {locale: es})}</CardDescription>
                        </div>
                        <Button onClick={() => setIsDialogOpen(true)} size="sm">
                            <PlusCircle className='mr-2 h-4 w-4'/> Nuevo Movimiento
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Concepto</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead className='text-right'>Monto</TableHead>
                                    <TableHead className='w-10'></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paidReservations.map(res => (
                                    <TableRow key={res.id} className='bg-muted/30'>
                                        <TableCell className='font-medium'>Pista {res.courtId} - {res.playerName}</TableCell>
                                        <TableCell className='text-xs text-muted-foreground'>Reserva</TableCell>
                                        <TableCell className='capitalize text-xs'>{res.paymentMethod || 'efectivo'}</TableCell>
                                        <TableCell className='text-right font-bold text-green-500'>+${res.total}</TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                ))}
                                {movements.map(mov => (
                                    <TableRow key={mov.id}>
                                        <TableCell className='font-medium'>{mov.description}</TableCell>
                                        <TableCell className='capitalize text-xs'>{mov.type}</TableCell>
                                        <TableCell className='capitalize text-xs'>{mov.paymentMethod}</TableCell>
                                        <TableCell className={cn('text-right font-bold', mov.type === 'ingreso' ? 'text-green-500' : 'text-red-500')}>
                                            {mov.type === 'ingreso' ? '+' : '-'}${mov.amount}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className='h-8 w-8 text-destructive' onClick={() => handleDeleteMovement(mov.id)}>
                                                <Trash2 className='h-4 w-4'/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Movimiento Manual</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddMovement} id="movement-form" className="space-y-4 py-4">
                        <div className='grid grid-cols-2 gap-4'>
                            <div className='space-y-2'>
                                <Label htmlFor="type">Tipo</Label>
                                <Select name="type" defaultValue="ingreso">
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ingreso">Ingreso (+)</SelectItem>
                                        <SelectItem value="egreso">Gasto (-)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor="amount">Monto ($)</Label>
                                <Input id="amount" name="amount" type="number" required placeholder="0.00" />
                            </div>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor="description">Descripción</Label>
                            <Input id="description" name="description" required />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor="paymentMethod">Método de Pago</Label>
                            <Select name="paymentMethod" defaultValue="efectivo">
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="efectivo">Efectivo</SelectItem>
                                    <SelectItem value="transferencia">Transferencia</SelectItem>
                                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </form>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                        <Button type="submit" form="movement-form">Registrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Caja;