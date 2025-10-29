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
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      imageUrl: user.imageUrl,
      subscriptionPlan,
    };
  }, [user]);

  const isAuthenticated = useMemo(() => isLoaded && !!user, [isLoaded, user]);

  return useMemo(
    () => ({
      currentUser,
      isAuthenticated,
      isLoading: !isLoaded,
    }),
    [currentUser, isAuthenticated, isLoaded]
  );
}
