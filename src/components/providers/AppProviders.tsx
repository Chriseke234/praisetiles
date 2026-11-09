'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { SocialProvider } from '@/lib/social/SocialContext';
import { TournamentProvider } from '@/lib/tournament/TournamentContext';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocialProvider>
          <TournamentProvider>
            {children}
          </TournamentProvider>
        </SocialProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};
