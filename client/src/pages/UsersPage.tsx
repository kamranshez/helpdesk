import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  createdAt: string;
};

async function fetchUsers(): Promise<User[]> {
  const { data } = await axios.get<{ users: User[] }>("/api/users", { withCredentials: true });
  return data.users;
}

export default function UsersPage() {
  const { data: session } = authClient.useSession();
  const { data: users = [], isLoading: loading, error } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Users</h1>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Name</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Email</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Role</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : !error && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium text-muted-foreground">
                {users.length} {users.length === 1 ? "user" : "users"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Name</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Email</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Role</th>
                    <th className="text-left px-6 py-3 text-muted-foreground font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{user.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                      <td className="px-6 py-4">
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
