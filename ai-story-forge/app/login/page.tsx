
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-3xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in to AI Story Forge</CardTitle>
          <CardDescription>
            Continue with Google to access the app.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <Button type="submit" className="w-full rounded-2xl">
              Continue with Google
            </Button>
          </form>

          <p className="text-sm text-slate-500">
            Access is controlled by app roles: admin, editor, and viewer.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
