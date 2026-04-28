import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { QC_RESULT_LABEL, QC_RESULT_TONE, type QcResult } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export function ResultBadge({
  result,
  className,
}: {
  result: QcResult;
  className?: string;
}) {
  const Icon =
    result === "ok"
      ? CheckCircle2
      : result === "sinirda"
      ? AlertTriangle
      : XCircle;
  return (
    <Badge
      variant="outline"
      className={cn(
        "border gap-1 font-semibold tabular-nums",
        QC_RESULT_TONE[result],
        className,
      )}
    >
      <Icon className="size-3" />
      {QC_RESULT_LABEL[result]}
    </Badge>
  );
}
