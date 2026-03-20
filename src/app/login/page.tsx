
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { User, Lock, LogIn, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = login(username, password);
      if (user) {
        toast({ title: 'Éxito', description: `¡Bienvenido de nuevo, ${user.role}!` });
        router.push('/');
      } else {
        toast({ title: 'Error', description: 'Credenciales incorrectas.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 bg-radial-gradient">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
        <header className="text-center mb-8">
            <div className="inline-block relative p-4">
                 <Image src="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" alt="Master Padel Logo" width={200} height={200} className="mx-auto" />
                <h1 className="text-4xl md:text-5xl font-bold text-yellow-400 -mt-6 font-headline">
                    MÁSTER PÁDEL
                </h1>
            </div>
             <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                Bienvenido de nuevo. Inicia sesión para continuar.
            </p>
        </header>

        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle>Inicio de Sesión</CardTitle>
                <CardDescription>Ingresa tus credenciales para acceder al sistema.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="username">Usuario</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="pl-10"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                         <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="pl-10"
                            />
                        </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    </div>
  );
};

export default LoginPage;
