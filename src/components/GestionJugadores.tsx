
"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ListaJugadores from './ListaJugadores';
import SorteoRuleta from './SorteoRuleta';
import { List, Dices, BookUser } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { useCategory } from '@/context/CategoryContext';

const GestionJugadores = () => {
    const { category } = useCategory();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BookUser />
                     <span className="text-yellow-400">Panel de Jugadores</span>
                </CardTitle>
                <CardDescription>
                    Administra los jugadores y realiza sorteos aleatorios para la categoría <span className="font-bold text-primary">{category}</span>.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="lista" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="lista"><List className="mr-2"/>Lista de Jugadores</TabsTrigger>
                        <TabsTrigger value="sorteo"><Dices className="mr-2"/>Sorteo</TabsTrigger>
                    </TabsList>
                    <TabsContent value="lista" className="mt-6">
                        <ListaJugadores />
                    </TabsContent>
                    <TabsContent value="sorteo" className="mt-6">
                        <SorteoRuleta />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}

export default GestionJugadores;
