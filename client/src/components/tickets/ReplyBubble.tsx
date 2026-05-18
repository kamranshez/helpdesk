import DOMPurify from "dompurify";
import type { Reply, ReplySenderType } from "@helpdesk/core";
import { formatDate, getInitials } from "@/lib/ticket-utils";

export default function ReplyBubble({ reply }: { reply: Reply }) {
  const isAgent = reply.senderType === ("agent" satisfies ReplySenderType);
  return (
    <div className={`flex gap-3 ${isAgent ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold ${
          isAgent
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-muted border-border text-muted-foreground"
        }`}
      >
        {getInitials(reply.author.name)}
      </div>
      <div
        className={`flex-1 min-w-0 max-w-[80%] ${isAgent ? "items-end" : "items-start"} flex flex-col`}
      >
        <div
          className={`flex items-baseline gap-2 mb-1 ${isAgent ? "flex-row-reverse" : "flex-row"}`}
        >
          <span className="text-sm font-medium text-foreground">{reply.author.name}</span>
          <span className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              isAgent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {isAgent ? "Agent" : "Customer"}
          </span>
        </div>
        {reply.bodyHtml ? (
          <div
            className={`text-sm text-foreground rounded-lg px-3 py-2 leading-relaxed prose prose-sm max-w-none ${
              isAgent ? "bg-primary/10" : "bg-muted"
            }`}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(reply.bodyHtml, { USE_PROFILES: { html: true } }),
            }}
          />
        ) : (
          <pre
            className={`text-sm text-foreground whitespace-pre-wrap break-words font-sans rounded-lg px-3 py-2 leading-relaxed ${
              isAgent ? "bg-primary/10" : "bg-muted"
            }`}
          >
            {reply.body}
          </pre>
        )}
      </div>
    </div>
  );
}
