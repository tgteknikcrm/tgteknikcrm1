"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { signIn, signUp } from "./actions";
import { Factory, Loader2 } from "lucide-react";

export function LoginForm({ next }: { next: string }) {
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  function handleSignIn(formData: FormData) {
    formData.set("next", next);
    startTransition(async () => {
      const result = await signIn(formData);
      if (result?.error) toast.error(result.error);
    });
  }

  function handleSignUp(formData: FormData) {
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) toast.error(result.error);
      else if (result?.success) {
        toast.success(result.success);
        setTab("signin");
      }
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-3">
        <div className="mx-auto size-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <Factory className="size-7 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl">TG Teknik</CardTitle>
          <CardDescription>Üretim Takip Sistemi</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Giriş Yap</TabsTrigger>
            <TabsTrigger value="signup">Kayıt Ol</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form action={handleSignIn} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="ornek@firma.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parola</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Giriş Yap
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form action={handleSignUp} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="su-name">Ad Soyad</Label>
                <Input id="su-name" name="full_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">E-posta</Label>
                <Input id="su-email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-password">Parola (min 8)</Label>
                <Input
                  id="su-password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Kayıt Ol
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Yeni kayıtlar varsayılan olarak <b>operatör</b> rolünde açılır. Admin (
                <code>tgteknikcrm@outlook.com</code>) otomatik admin olur.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
