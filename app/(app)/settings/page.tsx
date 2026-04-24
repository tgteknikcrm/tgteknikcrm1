import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { RoleSelect } from "./role-select";

export const metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  let users: Profile[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    users = data ?? [];
  } catch {
    /* empty */
  }

  return (
    <>
      <PageHeader title="Ayarlar" description="Kullanıcılar ve sistem ayarları (sadece yönetici)" />

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcılar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kayıt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <RoleSelect userId={u.id} role={u.role} disabled={u.id === me.id} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.active ? "default" : "secondary"}>
                      {u.active ? "Aktif" : "Pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("tr-TR")}
                  </TableCell>
                </TableRow>
              ))}
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
            Admin e-posta: <span className="font-mono text-foreground">tgteknikcrm@outlook.com</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
