import { redirect } from "next/navigation";

// Old ordering page: the agent now lives at /ask and the catalogue at /catalogue.
export default function OldTreunPage() {
  redirect("/ask");
}
