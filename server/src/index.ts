import "dotenv/config";
import app from "./app.js";
import boss from "./lib/boss.js";
import { registerClassifyWorker } from "./workers/classify.js";

const PORT = Number(process.env.PORT) || 3000;

await boss.start();
await registerClassifyWorker();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
