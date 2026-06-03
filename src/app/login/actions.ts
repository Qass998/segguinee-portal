"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function pinLogin(formData: FormData): Promise<void> {
  const pin = formData.get("pin") as string;
  const redirectTo = (formData.get("redirect") as string) || "/dashboard";

  // Validate redirect (prevent open redirect attacks)
  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  if (pin === "2580") {
    const cookieStore = await cookies();
    cookieStore.set("segguinee_auth", "pin_2580", {
      path: "/",
      maxAge: 86400,
      sameSite: "lax",
    });
    redirect(safeRedirect);
  }

  // PIN wrong — redirect back to login with error
  redirect(`/login?error=invalid_pin&mode=pin`);
}
