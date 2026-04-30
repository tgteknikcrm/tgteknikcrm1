import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";

interface JobItem {
  id: string;
  job_no: string | null;
  customer: string;
  part_name: string;
  quantity: number;
  status: JobStatus;
  due_date: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  beklemede: "secondary",
  ayar: "secondary",
  uretimde: "default",
  tamamlandi: "outline",
  iptal: "destructive",
};

export function LinkedJobs({ items }: { items: JobItem[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-12 text-center">
            Bu üründen henüz iş açılmamış.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İş No</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead className="text-right">Adet</TableHead>
                <TableHead>Teslim</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Açılış</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((j) => (
                <TableRow key={j.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">
                    <Link href={`/jobs`} className="hover:underline">
                      {j.job_no || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{j.customer}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {j.quantity}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {j.due_date || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[j.status]}>
                      {JOB_STATUS_LABEL[j.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(j.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
