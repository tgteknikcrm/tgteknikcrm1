"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Mode = "light" | "dark" | "system";
const STORAGE_KEY = "tg.theme";

function applyTheme(mode: Mode) {
  const root = document.documentElement;
  const wantDark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", wantDark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Mode | null) ?? "system";
    setMode(stored);
    setMounted(true);

    if (stored === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme("system");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, []);

  function setAndApply(next: Mode) {
    setMode(next);
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // First render before mount: avoid hydration mismatch by showing the same icon
  // both server and client. We render the Sun icon (light = default).
  const Icon = !mounted
    ? Sun
    : mode === "dark"
      ? Moon
      : mode === "light"
        ? Sun
        : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Tema"
          title="Tema"
        >
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onSelect={() => setAndApply("light")}
          className={mode === "light" ? "bg-accent" : undefined}
        >
          <Sun className="size-4" /> Aydınlık
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setAndApply("dark")}
          className={mode === "dark" ? "bg-accent" : undefined}
        >
          <Moon className="size-4" /> Karanlık
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setAndApply("system")}
          className={mode === "system" ? "bg-accent" : undefined}
        >
          <Monitor className="size-4" /> Sistem
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
