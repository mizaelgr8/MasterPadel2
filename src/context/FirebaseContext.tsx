"use client";

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig } from '@/lib/firebase';

interface FirebaseContextType {
  app: FirebaseApp;
  db: Firestore;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const firebaseApp = useMemo(() => {
    return !getApps().length ? initializeApp(firebaseConfig) : getApp();
  }, []);

  const firestoreDb = useMemo(() => getFirestore(firebaseApp), [firebaseApp]);

  const value = { app: firebaseApp, db: firestoreDb };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextType => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
