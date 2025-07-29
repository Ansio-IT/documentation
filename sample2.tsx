import express, { Request, Response } from "express";

const app = express();
const port = 5000;

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "OK", timestamp: new Date() });
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
