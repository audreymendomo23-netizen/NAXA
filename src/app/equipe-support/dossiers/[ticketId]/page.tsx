import { SupportAgentTicket } from "@/components/support/SupportAgentTicket";

export default async function SupportAgentTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ callId?: string }>;
}) {
  const { ticketId } = await params;
  const query = await searchParams;
  return <SupportAgentTicket ticketId={ticketId} callId={query.callId ?? null} />;
}
