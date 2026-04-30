import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient, getProfile } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import { formatPhoneForDisplay } from "@/lib/phone";
import { formatDate } from "@/lib/utils";
import { RoleSelect } from "./role-select";
import { CreateUserDialog } from "./create-user-dialog";
import { ActiveToggle, DeleteUserButton } from "./user-row-actions";

export const metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  let users: Profile[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    users = data ?? [];
  } catch {
    /* empty */
  }

  return (
    <>
      <PageHeader
        title="Ayarlar"
        description="Kullanıcı yönetimi ve sistem bilgileri (sadece yönetici)"
      />

      {/* Sub-settings cards (admin tools) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Link
          href="/settings/work-hours"
          className="rounded-xl border bg-card hover:bg-muted/40 transition p-4 flex items-center gap-3"
        >
          <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Clock className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Çalışma Saatleri</div>
            <div className="text-xs text-muted-foreground">
              Haftalık çizelge · iş ETA hesabını besler
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            Aç
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Kullanıcılar</CardTitle>
            <CardDescription>Toplam {users.length} kullanıcı</CardDescription>
          </div>
          <CreateUserDialog />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kayıt</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Kullanıcı yok.
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => {
                const isSelf = u.id === me.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">(sen)</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatPhoneForDisplay(u.phone)}
                    </TableCell>
                    <TableCell>
                      <RoleSelect userId={u.id} role={u.role} disabled={isSelf} />
                    </TableCell>
                    <TableCell>
                      <ActiveToggle userId={u.id} active={u.active} disabled={isSelf} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.created_at)}
                    </TableCell>
                    <TableCell>
                      <DeleteUserButton userId={u.id} disabled={isSelf} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sistem Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <div>
            Veritabanı:{" "}
            <span className="font-mono text-foreground">
              {process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, "") ?? "—"}
            </span>
          </div>
          <div>
            Giriş: <span className="font-mono text-foreground">telefon + parola</span>
          </div>
          <div>
            Yönetici telefon:{" "}
            <span className="font-mono text-foreground">+90 542 646 90 70</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
