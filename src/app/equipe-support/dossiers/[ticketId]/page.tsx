import { SupportAgentTicket } from "@/components/support/SupportAgentTicket";

export default async function SupportAgentTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  return <SupportAgentTicket ticketId={ticketId} />;
}
