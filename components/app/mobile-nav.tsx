"use client";

import { useState } from "react";
import { Menu, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

interface Props {
  isAdmin: boolean;
  profile: {
    full_name: string | null;
    phone: string | null;
    role: "admin" | "operator";
  };
}

export function MobileNav({ isAdmin, profile }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="md:hidden sticky top-0 z-30 h-12 flex items-center gap-2 px-3 border-b bg-background/95 backdrop-blur">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="size-9">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menü</SheetTitle>
          </SheetHeader>
          <Sidebar
            isAdmin={isAdmin}
            profile={profile}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2">
        <Factory className="size-4 text-primary" />
        <span className="text-sm font-semibold">TG Teknik</span>
      </div>
    </header>
  );
}
