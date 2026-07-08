import { createServer } from "./app";

const port = Number(process.env.PORT ?? 3001);
const app = createServer();

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
