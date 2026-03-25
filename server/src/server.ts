import "dotenv/config";

import app from "./app.js";
import { ENV } from "./lib/env.js";

app.listen(ENV.PORT, () => {
  console.log(`Server running on port ${ENV.PORT}`);
});
