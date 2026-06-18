import { readFileSync } from "fs";
import path from "path";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import prisma from "./prisma";
import boss from "./queue";

export const RESOLVE_TICKET_QUEUE = "resolve-ticket";

type ResolveTicketJob = { ticketId: string; subject: string; body: string; customerName: string };

const KNOWLEDGE_BASE_PATH = path.join(import.meta.dir, "../../knowledge_base.md");

function loadKnowledgeBase(): string {
  return readFileSync(KNOWLEDGE_BASE_PATH, "utf-8");
}

const ResolutionSchema = z.object({
  resolved: z.boolean(),
  answer: z.string(),
});

export async function enqueueResolveTicket(
  ticketId: string,
  subject: string,
  body: string,
  customerName: string
): Promise<void> {
  const job: ResolveTicketJob = { ticketId, subject, body, customerName };
  await boss.send(RESOLVE_TICKET_QUEUE, job);
}

export async function startResolveTicketWorker(): Promise<void> {
  await boss.createQueue(RESOLVE_TICKET_QUEUE);
  await boss.work<ResolveTicketJob>(RESOLVE_TICKET_QUEUE, async ([job]) => {
    const { ticketId, subject, body, customerName } = job.data;
    const knowledgeBase = loadKnowledgeBase();

    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: ResolutionSchema,
      system:
        "You are a customer support assistant deciding whether a new ticket can be fully resolved " +
        "right now using only the knowledge base below, with no human agent involved. " +
        "Only set resolved to true if the knowledge base directly and confidently answers the customer's " +
        "question and none of the escalation rules described in the knowledge base apply. " +
        "When resolved is true, write the reply to send the customer in the answer field: sound professional " +
        "and empathetic, open with a greeting addressed to the customer by name, and do not use dashes or " +
        "hyphens as punctuation. When resolved is false, leave answer as an empty string.\n\n" +
        `Knowledge base:\n${knowledgeBase}`,
      prompt: `Customer name: ${customerName}\n\nSubject: ${subject}\n\n${body}`,
    });

    if (object.resolved && object.answer.trim()) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: "RESOLVED",
          messages: { create: { body: object.answer.trim(), isFromCustomer: false } },
        },
      });
    } else {
      await prisma.ticket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
    }
  });
}
