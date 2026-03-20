
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/context/AuthContext';
import { CategoryProvider } from '@/context/CategoryContext';
import { FirebaseProvider } from '@/context/FirebaseContext';

export const metadata: Metadata = {
  title: 'MÁSTER PÁDEL',
  description: 'Aplicación de ranking de pádel.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" type="image/png" sizes="any" />
        <link rel="apple-touch-icon" href="https://i.postimg.cc/jd36nffT/Master-padel-(1).png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#020817" />
      </head>
      <body className="font-body antialiased">
        <FirebaseProvider>
          <AuthProvider>
            <CategoryProvider>
              {children}
              <Toaster />
            </CategoryProvider>
          </AuthProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}
