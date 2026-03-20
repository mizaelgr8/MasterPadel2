"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegistroPartida from "./RegistroPartida";
import RegistroManual from "./RegistroManual";
import RegistroElevador from "./RegistroElevador";
import { PencilRuler, Bot, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";


const Registrar = () => {
    const { user } = useAuth();
    
    return (
        <Tabs defaultValue="automatica" className="w-full">
            <TabsList className={`grid w-full ${user?.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="automatica"><Bot className="mr-2"/> Partida Automática</TabsTrigger>
                {user?.role === 'admin' && (
                    <TabsTrigger value="manual"><PencilRuler className="mr-2"/> Registro Manual</TabsTrigger>
                )}
                <TabsTrigger value="elevador"><ArrowRightLeft className="mr-2"/> Elevador</TabsTrigger>
            </TabsList>
            <TabsContent value="automatica" className="mt-6">
                <RegistroPartida />
            </TabsContent>
            {user?.role === 'admin' && (
                <TabsContent value="manual" className="mt-6">
                    <RegistroManual />
                </TabsContent>
            )}
            <TabsContent value="elevador" className="mt-6">
                <RegistroElevador />
            </TabsContent>
        </Tabs>
    )
}

export default Registrar;