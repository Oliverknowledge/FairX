import { redirect } from "next/navigation";

// The browser-side receipt verifier belongs to the earlier LineGuard product; the V4 submission
// does not surface those receipts. Point verification at the V4 evidence page.
export default function VerifyReceiptPage() {
  redirect("/proof");
}
