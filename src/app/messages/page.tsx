import { redirect } from "next/navigation";

/** Normal chat lives in the Chatter panel only; this route is not linked in the app. */
export default function MessagesPage() {
  redirect("/");
}
