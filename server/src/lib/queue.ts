import { PgBoss } from "pg-boss";

const boss = new PgBoss(process.env.DATABASE_URL!);

boss.on("error", (err) => console.error("pg-boss error:", err));

export default boss;
