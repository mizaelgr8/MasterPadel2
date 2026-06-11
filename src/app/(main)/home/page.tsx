
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GestionJugadores from "@/components/GestionJugadores";
import Historial from "@/components/Historial";
import Ranking from "@/components/Ranking";
import { LogOut, Trophy, History, BookUser, BarChart, Sword, UserCircle, Calendar, LogIn, QrCode, CalendarClock, MonitorPlay, Landmark } from "lucide-react";
import Torneo from "@/components/Torneo";
import Registrar from "@/components/Registrar";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import EventCalendar from "@/components/EventCalendar";
import { useCategory } from "@/context/CategoryContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category } from "@/types";
import Caja from "@/components/Caja";
import GestionReservas from "@/components/GestionReservas";
import Image from "next/image";


export default function HomePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { category, setCategory } = useCategory();
  const [activeTab, setActiveTab] = useState("ranking");
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  useEffect(() => {
    const appUrl = 'https://studio--master-padel2-40000018-2cc7a.us-central1.hosted.app';
    const installUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(appUrl)}`;
    setQrCodeUrl(installUrl);
  }, []);

  useEffect(() => {
    // Redirection logic for restricted users
    if (user?.username === 'Administrador') {
        if (activeTab !== 'caja' && activeTab !== 'reservas') {
            setActiveTab('caja');
        }
    } else if (user?.role === 'guest' && (activeTab === 'jugadores' || activeTab === 'torneo' || activeTab === 'caja' || activeTab === 'reservas')) {
        setActiveTab('ranking');
    } else if (user?.username === 'Master padel' && (activeTab === 'torneo' || activeTab === 'caja')) {
        setActiveTab('ranking');
    }
  }, [user, activeTab]);

  const handleLogout = () => {
    logout();
    router.push('/home');
  }

  const handleLogin = () => {
    router.push('/login');
  }

  const adminTabs = [
    { value: "ranking", label: "Ranking", icon: BarChart },
    { value: "registrar", label: "Registrar", icon: Sword },
    { value: "torneo", label: "Torneo", icon: Trophy },
    { value: "historial", label: "Historial", icon: History },
    { value: "caja", label: "Caja", icon: Landmark },
    { value: "reservas", label: "Reservas", icon: CalendarClock },
    { value: "jugadores", label: "Jugadores", icon: BookUser },
  ];

  const finanzasTabs = [
    { value: "caja", label: "Caja", icon: Landmark },
    { value: "reservas", label: "Reservas", icon: CalendarClock },
  ];

  const guestTabs = [
    { value: "ranking", label: "Ranking", icon: BarChart },
    { value: "registrar", label: "Registrar", icon: Sword },
    { value: "historial", label: "Historial", icon: History },
    { value: "calendario", label: "Calendario", icon: Calendar },
  ];

  const getVisibleTabs = () => {
    if (user?.username === 'Administrador') return finanzasTabs;
    if (user?.role === 'admin') {
        if (user.username === 'Master padel') {
            // Master padel no ve Torneo ni Caja, pero sí Reservas
            return adminTabs.filter(t => t.value !== 'torneo' && t.value !== 'caja');
        }
        return adminTabs;
    }
    return guestTabs;
  };

  const visibleTabs = getVisibleTabs();

  const UserMenu = () => (
     <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Sesión iniciada como:</p>
                <p className="text-xs leading-none text-muted-foreground capitalize">
                    {user?.username}
                </p>
            </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {user?.role === 'admin' && user.username !== 'Administrador' && (
            <>
              {user.username !== 'Master padel' && (
                <DropdownMenuItem onSelect={() => router.push('/reservas')}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    <span>Gestionar Reservas</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => window.open('/proyector', '_blank')}>
                  <MonitorPlay className="mr-2 h-4 w-4" />
                  <span>Abrir Proyector</span>
              </DropdownMenuItem>
            </>
        )}

        <DropdownMenuItem onSelect={() => setIsQrDialogOpen(true)}>
            <QrCode className="mr-2 h-4 w-4" />
            <span>Instalar App (QR)</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {user?.role === 'admin' ? (
             <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
            </DropdownMenuItem>
        ) : (
            <DropdownMenuItem onClick={handleLogin}>
                <LogIn className="mr-2 h-4 w-4" />
                <span>Iniciar sesión</span>
            </DropdownMenuItem>
        )}
    </DropdownMenuContent>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      
      <main className="container mx-auto px-4 md:px-8 pb-24 flex-grow w-full">
        <header className="text-center mb-8 relative">
          <div className="flex items-center justify-between">
            <div className="w-1/3"></div>
            <div className="w-1/3 flex flex-col items-center">
              <Image src="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" alt="Master Padel Logo" width={200} height={200} className="mx-auto" />
              <h1 className="text-4xl md:text-5xl font-bold text-yellow-400 -mt-6 font-headline">
                  MÁSTER PÁDEL
              </h1>
            </div>
            <div className="w-1/3 flex justify-end items-start pt-2 pr-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="rounded-full h-10 w-10 md:h-12 md:w-12">
                            <Avatar>
                                <AvatarFallback className={user?.role === 'admin' ? "bg-primary/20" : "bg-secondary"}>
                                    <UserCircle className={user?.role === 'admin' ? "h-6 w-6 text-primary" : "h-6 w-6 text-secondary-foreground"}/>
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <UserMenu />
                </DropdownMenu>
            </div>
          </div>
          {user?.username !== 'Administrador' && (
            <div className="flex justify-center items-center gap-4 mt-4">
                <p className="text-muted-foreground">Categoría</p>
                <Select value={category} onValueChange={(val) => setCategory(val as Category)}>
                    <SelectTrigger className="w-[120px] font-bold text-primary">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1ra">1ra Cat.</SelectItem>
                        <SelectItem value="2da">2da Cat.</SelectItem>
                        <SelectItem value="3ra">3ra Cat.</SelectItem>
                        <SelectItem value="4ta">4ta Cat.</SelectItem>
                        <SelectItem value="5ta">5ta Cat.</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          )}
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="mt-6">
                <TabsContent value="ranking" forceMount={true} className={activeTab === 'ranking' ? '' : 'hidden'}>
                    <Ranking />
                </TabsContent>
                <TabsContent value="registrar" forceMount={true} className={activeTab === 'registrar' ? '' : 'hidden'}>
                    <Registrar />
                </TabsContent>
                {user?.role === 'admin' && user?.username !== 'Master padel' && user?.username !== 'Administrador' && (
                  <TabsContent value="torneo" forceMount={true} className={activeTab === 'torneo' ? '' : 'hidden'}>
                      <Torneo />
                  </TabsContent>
                )}
                <TabsContent value="historial" forceMount={true} className={activeTab === 'historial' ? '' : 'hidden'}>
                    <Historial />
                </TabsContent>
                 {user?.role === 'guest' && (
                    <TabsContent value="calendario" forceMount={true} className={activeTab === 'calendario' ? '' : 'hidden'}>
                        <EventCalendar />
                    </TabsContent>
                )}
                {user?.role === 'admin' && (
                    <>
                        {user.username !== 'Master padel' && (
                            <TabsContent value="caja" forceMount={true} className={activeTab === 'caja' ? '' : 'hidden'}>
                                <Caja />
                            </TabsContent>
                        )}
                        {(user.username === 'Administrador' || user.username === 'Master padel' || user.username === 'Admin') && (
                            <TabsContent value="reservas" forceMount={true} className={activeTab === 'reservas' ? '' : 'hidden'}>
                                <GestionReservas />
                            </TabsContent>
                        )}
                        {user.username !== 'Administrador' && (
                            <TabsContent value="jugadores" forceMount={true} className={activeTab === 'jugadores' ? '' : 'hidden'}>
                                <GestionJugadores />
                            </TabsContent>
                        )}
                    </>
                )}
            </div>

            <nav className="fixed bottom-0 left-0 right-0 h-20 flex justify-center z-50 p-2">
                 <TabsList className="bottom-nav-glass h-full rounded-full p-2 flex items-center justify-center gap-1 md:gap-2">
                    {visibleTabs.map((tab) => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="flex flex-col items-center justify-center h-14 w-14 rounded-full text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all duration-300"
                        >
                            <tab.icon className="h-5 w-5 mb-1" />
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </nav>
        </Tabs>
      </main>

       <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl">Instalar Aplicación</DialogTitle>
                    <DialogDescription className="text-center">
                        Escanea este código QR con tu teléfono para abrir la app y luego selecciona "Añadir a pantalla de inicio" en las opciones de tu navegador.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center p-4">
                    {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="QR Code para instalar la aplicación" className="rounded-lg" />
                    ) : (
                        <p>Generando código QR...</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}
