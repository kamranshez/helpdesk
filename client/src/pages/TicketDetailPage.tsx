import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { authClient } from "@/lib/auth-client";
import { fetchTicket, fetchAgents } from "@/lib/ticket-api";
import TicketHeader from "@/components/tickets/TicketHeader";
import TicketBody from "@/components/tickets/TicketBody";
import TicketProperties from "@/components/tickets/TicketProperties";
import ReplyThread from "@/components/tickets/ReplyThread";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ChevronLeft } from "lucide-react";


export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = authClient.useSession();

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    enabled: !!id,
  });

  const is404 = !!error && axios.isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to tickets
        </Link>

        {isLoading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full mt-4" />
            </CardContent>
          </Card>
        )}

        {!isLoading && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {is404 ? "Ticket not found." : "Failed to load ticket. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {ticket && (
          <div className="space-y-6">
            <Card>
              <TicketHeader ticket={ticket} />
              <CardContent>
                <div className="grid grid-cols-[1fr_260px] gap-0 text-sm">
                  <TicketBody ticket={ticket} ticketId={id!} />
                  <TicketProperties ticket={ticket} agents={agents} ticketId={id!} />
                </div>
              </CardContent>
            </Card>

            <ReplyThread ticketId={id!} />
          </div>
        )}
      </main>
    </div>
  );
}
