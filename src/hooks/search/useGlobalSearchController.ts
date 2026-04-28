import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { User as SessionUser } from "@/core/entities/user";
import {
  resolveCommandRoutes,
  type ShellRouteDefinition,
} from "@/lib/shell/shell-navigation";
import type {
  GlobalSearchAction,
  GlobalSearchResult,
} from "@/lib/search/global-search";

export interface UseGlobalSearchControllerProps {
  user: SessionUser;
  searchAction: GlobalSearchAction;
}

export interface GlobalSearchController {
  activeIndex: number;
  commandExamples: string;
  commandResults: ShellRouteDefinition[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  handleChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isCommandMode: boolean;
  loading: boolean;
  mobileExpanded: boolean;
  open: boolean;
  query: string;
  results: GlobalSearchResult[];
  setMobileExpanded: (expanded: boolean) => void;
  setOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
}

function filterCommandRoutes(routes: ShellRouteDefinition[], rawFilter: string): ShellRouteDefinition[] {
  const filter = rawFilter.trim().toLowerCase();
  if (!filter) {
    return routes;
  }

  return routes.filter(
    (route) =>
      route.label.toLowerCase().includes(filter)
      || route.href.toLowerCase().includes(filter)
      || route.description?.toLowerCase().includes(filter),
  );
}

export function useGlobalSearchController({
  user,
  searchAction,
}: UseGlobalSearchControllerProps): GlobalSearchController {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestIdRef = useRef(0);
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const commandRoutes = resolveCommandRoutes(user);
  const isCommandMode = query.startsWith("/");
  const commandResults = filterCommandRoutes(commandRoutes, query.slice(1));
  const commandExamples = commandRoutes
    .slice(0, 3)
    .map((route) => route.href.replace(/^\//, ""))
    .join(" /");

  // Prevent memory leaks on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const runSearch = useCallback(
    async (nextQuery: string) => {
      if (nextQuery.startsWith("/")) {
        return;
      }
      if (nextQuery.trim().length < 2) {
        setResults([]);
        setOpen(false);
        setActiveIndex(-1);
        return;
      }

      setLoading(true);
      const currentRequestId = ++requestIdRef.current;

      try {
        const formData = new FormData();
        formData.set("query", nextQuery);
        const nextResults = await searchAction(formData);
        
        // Prevent race condition: only update if this is still the latest request
        if (requestIdRef.current === currentRequestId) {
          setResults(nextResults);
          setOpen(true);
          setActiveIndex(-1);
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoading(false);
        }
      }
    },
    [searchAction],
  );

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      setActiveIndex(-1);
      
      if (value.startsWith("/")) {
        setOpen(true);
        clearTimeout(debounceRef.current);
        return;
      }

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runSearch(value);
      }, 300);
    },
    [runSearch],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    
    const itemsCount = isCommandMode ? commandResults.length : results.length;
    if (itemsCount === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % itemsCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + itemsCount) % itemsCount);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      const targetHref = isCommandMode ? commandResults[activeIndex].href : results[activeIndex].href;
      router.push(targetHref);
    }
  };

  useEffect(() => {
    function onGlobalKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileExpanded(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpen(false);
        setMobileExpanded(false);
        inputRef.current?.blur();
      }
    }

    document.addEventListener("keydown", onGlobalKeyDown);
    return () => document.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setMobileExpanded(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return {
    activeIndex,
    commandExamples,
    commandResults,
    containerRef,
    handleChange,
    handleKeyDown,
    inputRef,
    isCommandMode,
    loading,
    mobileExpanded,
    open,
    query,
    results,
    setMobileExpanded,
    setOpen,
    setQuery,
  };
}
