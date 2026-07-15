import { redirect } from "next/navigation";

// The Polymarket France–Spain external-reference market is not part of the V4 submission scope
// (one fixture: France–Morocco). Retired here to keep a single coherent product story.
export default function ReferencePage() {
  redirect("/");
}
