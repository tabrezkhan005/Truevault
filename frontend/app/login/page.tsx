import { redirect } from "next/navigation";

/** Auth is a landing popup now — keep /login as a friendly redirect. */
export default function LoginPage() {
  redirect("/");
}
