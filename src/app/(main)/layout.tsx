
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';


export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // This effect is kept for the edge case where an admin might log out
    // and localStorage is cleared, though the context now defaults to guest.
    // This also handles the initial loading state.
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
     return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="space-y-4 w-full max-w-4xl p-8">
                <Skeleton className="h-24 w-1/3 mx-auto" />
                <Skeleton className="h-8 w-2/3 mx-auto" />
                <Skeleton className="h-12 w-full mt-8" />
                <div className="pt-8">
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        </div>
    );
  }

  return <>{children}</>;
}

    