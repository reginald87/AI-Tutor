import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { serializeUser } from "@/lib/serialize";
import { AuthProvider } from "@/components/AuthProvider";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider initialUser={serializeUser(user)}>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
