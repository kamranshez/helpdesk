import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import type { CreateReplyInput } from "@helpdesk/core";
import { createReplySchema } from "@helpdesk/core";
import { fetchReplies, postReply } from "@/lib/ticket-api";
import ReplyBubble from "./ReplyBubble";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, MessageSquare, Sparkles } from "lucide-react";

type Props = { ticketId: string };

export default function ReplyThread({ ticketId }: Props) {
  const queryClient = useQueryClient();
  const threadEndRef = useRef<HTMLDivElement>(null);

  const { data: replies = [], isLoading } = useQuery({
    queryKey: ["replies", ticketId],
    queryFn: () => fetchReplies(ticketId),
  });

  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
    setError,
  } = useForm<CreateReplyInput>({ resolver: zodResolver(createReplySchema) });

  const bodyValue = watch("body");

  async function handlePolish() {
    const draft = getValues("body");
    if (!draft?.trim()) return;
    setIsPolishing(true);
    setPolishError(null);
    try {
      const res = await axios.post<{ polished: string }>(
        `/api/tickets/${ticketId}/polish`,
        { body: draft },
        { withCredentials: true }
      );
      setValue("body", res.data.polished, { shouldValidate: true });
    } catch {
      setPolishError("Failed to polish reply. Please try again.");
    } finally {
      setIsPolishing(false);
    }
  }

  const replyMutation = useMutation({
    mutationFn: (data: CreateReplyInput) => postReply(ticketId, data),
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ["replies", ticketId] });
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (err) => {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? (err.response.data.error as string)
          : "Failed to send reply.";
      setError("root", { message });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Replies
          {replies.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({replies.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!isLoading && replies.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No replies yet.</p>
        )}

        {!isLoading && replies.length > 0 && (
          <div className="space-y-4">
            {replies.map((reply) => (
              <ReplyBubble key={reply.id} reply={reply} />
            ))}
            <div ref={threadEndRef} />
          </div>
        )}

        <div className="border-t border-border pt-4 mt-4">
          <form onSubmit={handleSubmit((data) => replyMutation.mutate(data))} className="space-y-3">
            <Textarea
              {...register("body")}
              placeholder="Write a reply…"
              rows={4}
              aria-invalid={!!errors.body}
              className="resize-none"
            />
            {errors.body && (
              <p className="text-xs text-destructive">{errors.body.message}</p>
            )}
            {errors.root && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}
            {polishError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{polishError}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                onClick={handlePolish}
                disabled={isPolishing || replyMutation.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isPolishing ? "Polishing…" : "Polish"}
              </Button>
              <Button type="submit" disabled={replyMutation.isPending || isPolishing || !bodyValue?.trim()}>
                {replyMutation.isPending ? "Sending…" : "Send Reply"}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
