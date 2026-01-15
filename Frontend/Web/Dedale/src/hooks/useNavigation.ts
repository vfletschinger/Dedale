import { useState, useCallback, useMemo } from "react";

export type PageKey = "event" | "map" | "team-person" | "data" | "planning";

interface NavigationState {
  currentPage: PageKey;
  history: PageKey[];
  visitedPages: Set<PageKey>;
}

export function useNavigation(initialPage: PageKey = "event") {
  const [state, setState] = useState<NavigationState>({
    currentPage: initialPage,
    history: [initialPage],
    visitedPages: new Set([initialPage]),
  });

  // Naviguer vers une page (ajoute à l'historique)
  const navigate = useCallback((page: PageKey) => {
    setState((prev) => {
      // Si on navigue vers la même page, ne rien faire
      if (prev.currentPage === page) return prev;

      const newVisited = new Set(prev.visitedPages);
      newVisited.add(page);

      return {
        currentPage: page,
        history: [...prev.history, page],
        visitedPages: newVisited,
      };
    });
  }, []);

  // Retour en arrière dans l'historique
  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.history.length <= 1) return prev;

      const newHistory = prev.history.slice(0, -1);
      const previousPage = newHistory[newHistory.length - 1];

      return {
        ...prev,
        currentPage: previousPage,
        history: newHistory,
      };
    });
  }, []);

  // Vérifier si on peut revenir en arrière
  const canGoBack = useMemo(() => state.history.length > 1, [state.history]);

  // Vérifier si une page a été visitée (pour la garder montée)
  const hasVisited = useCallback(
    (page: PageKey) => state.visitedPages.has(page),
    [state.visitedPages]
  );

  // Réinitialiser la navigation
  const reset = useCallback((page: PageKey = "event") => {
    setState({
      currentPage: page,
      history: [page],
      visitedPages: new Set([page]),
    });
  }, []);

  return {
    currentPage: state.currentPage,
    history: state.history,
    visitedPages: state.visitedPages,
    navigate,
    goBack,
    canGoBack,
    hasVisited,
    reset,
  };
}
