
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        // Always redirect to home page, as users are automatically guests.
        router.replace('/home');
    }, [router]);

    // Show a loading skeleton while redirecting
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="space-y-4 w-full max-w-2xl p-8">
                <Skeleton className="h-24 w-1/3 mx-auto" />
                <Skeleton className="h-8 w-2/3 mx-auto" />
                <Skeleton className="h-12 w-full mt-8" />
                <div className="pt-8">
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        </div>
    );
}
