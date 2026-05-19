import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { summarizeTicket } from "@/lib/ticket-api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";

type Props = { ticketId: string };

export default function TicketSummary({ ticketId }: Props) {
  const [summary, setSummary] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => summarizeTicket(ticketId),
    onSuccess: (text) => setSummary(text),
  });

  return (
    <div className="border-t border-border pt-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">Summary</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {mutation.isPending ? "Summarizing…" : summary ? "Regenerate" : "Summarize"}
        </Button>
      </div>
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to summarize. Please try again.</AlertDescription>
        </Alert>
      )}
      {summary && !mutation.isPending && (
        <p className="text-sm text-foreground bg-muted rounded-md p-4 leading-relaxed">
          {summary}
        </p>
      )}
    </div>
  );
}
