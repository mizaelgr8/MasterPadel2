
"use client";

import GestionReservas from "@/components/GestionReservas";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReservasPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="container mx-auto px-4 md:px-8 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Volver</span>
                    </Button>
                    <div className="flex-grow">
                         <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600" style={{ filter: "drop-shadow(0 0 10px rgba(255, 215, 0, 0.4))" }}>
                            Gestión de Reservas
                        </h1>
                        <p className="text-muted-foreground">
                           Vista centralizada de todas las pistas del club.
                        </p>
                    </div>
                </div>

                <GestionReservas />
            </div>
        </div>
    );
}
