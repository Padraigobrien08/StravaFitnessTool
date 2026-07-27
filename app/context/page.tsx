import { redirect } from "next/navigation";

// Activity context merged into Activities as the "Activity mix" view.
// Kept as a redirect so existing links and bookmarks still resolve.
export default function ContextPage() {
  redirect("/runs");
}
