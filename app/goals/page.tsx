import { redirect } from "next/navigation";

// Goals merged into Plan — a race goal is the target the weekly plan aims at.
// Kept as a redirect so existing links and bookmarks land on the Race goal tab.
export default function GoalsPage() {
  redirect("/plan?tab=goal");
}
