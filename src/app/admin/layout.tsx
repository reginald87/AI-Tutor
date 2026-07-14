import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { serializeUser } from "@/lib/serialize";
import { AuthProvider } from "@/components/AuthProvider";
import AdminShell from "@/components/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/dashboard");

  return (
    <AuthProvider initialUser={serializeUser(user)}>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
