import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY || "dummy_api_key", {
  clientId: process.env.WORKOS_CLIENT_ID || "client_dummy_id",
});

export { workos };
