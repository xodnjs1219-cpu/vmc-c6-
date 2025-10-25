'use client';

import { useReducer, useCallback } from 'react';

interface DashboardState {
  currentPage: number;
  limit: number;
}

type DashboardAction =
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_LIMIT'; payload: number }
  | { type: 'RESET' };

const initialState: DashboardState = {
  currentPage: 1,
  limit: 10,
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    case 'SET_LIMIT':
      return { ...state, limit: action.payload, currentPage: 1 };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useDashboard() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  const setPage = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const setLimit = useCallback((limit: number) => {
    dispatch({ type: 'SET_LIMIT', payload: limit });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    ...state,
    setPage,
    setLimit,
    reset,
  };
}
