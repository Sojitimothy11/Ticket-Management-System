import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import boss from "./lib/queue";
import { startClassifyTicketWorker } from "./lib/classifyTicket";
import { startResolveTicketWorker } from "./lib/resolveTicket";
import usersRouter from "./routes/users";
import emailRouter from "./routes/email";
import ticketsRouter from "./routes/tickets";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true }));

// Must be mounted before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", usersRouter);
app.use("/api/email", emailRouter);
app.use("/api/tickets", ticketsRouter);


await boss.start();
await startClassifyTicketWorker();
await startResolveTicketWorker();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
