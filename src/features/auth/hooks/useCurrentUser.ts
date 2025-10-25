'use client';

import { useUser } from '@clerk/nextjs';
import { useMemo } from 'react';

export interface CurrentUser {
  userId: string;
  email: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  imageUrl: string | undefined;
  subscriptionPlan?: 'Free' | 'Pro';
}

export function useCurrentUser() {
  const { user, isLoaded } = useUser();

  const currentUser = useMemo<CurrentUser | null>(() => {
    if (!user) {
      return null;
    }

    const subscriptionPlan =
      (user.publicMetadata?.subscription as 'Free' | 'Pro' | undefined) ||
      'Free';

    return {
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      subscriptionPlan,
    };
  }, [user]);

  const isAuthenticated = isLoaded && !!user;

  return {
    currentUser,
    isAuthenticated,
    isLoading: !isLoaded,
  };
}
