import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { TicketCategory } from "@prisma/client";
import prisma from "./prisma";
import boss from "./queue";

export const CLASSIFY_TICKET_QUEUE = "classify-ticket";

type ClassifyTicketJob = { ticketId: string; subject: string; body: string };

const categories = Object.values(TicketCategory) as TicketCategory[];

export async function enqueueClassifyTicket(ticketId: string, subject: string, body: string): Promise<void> {
  const job: ClassifyTicketJob = { ticketId, subject, body };
  await boss.send(CLASSIFY_TICKET_QUEUE, job);
}

export async function startClassifyTicketWorker(): Promise<void> {
  await boss.createQueue(CLASSIFY_TICKET_QUEUE);
  await boss.work<ClassifyTicketJob>(CLASSIFY_TICKET_QUEUE, async ([job]) => {
    const { ticketId, subject, body } = job.data;
    const { object: category } = await generateObject({
      model: openai("gpt-5-nano"),
      output: "enum",
      enum: categories,
      system: "Classify the customer support ticket into exactly one category based on its subject and body.",
      prompt: `Subject: ${subject}\n\n${body}`,
    });
    await prisma.ticket.update({ where: { id: ticketId }, data: { category } });
  });
}
