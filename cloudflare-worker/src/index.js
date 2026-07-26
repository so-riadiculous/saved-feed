import PostalMime from "postal-mime";

export default {
  async email(message, env, ctx) {
    const rawEmail = new Response(message.raw);
    const buffer = await rawEmail.arrayBuffer();
    const parsed = await PostalMime.parse(buffer);

    const res = await fetch(`${env.APP_URL}/api/inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-inbound-secret": env.INBOUND_SHARED_SECRET,
      },
      body: JSON.stringify({
        from: message.from,
        subject: parsed.subject ?? "",
        text: parsed.text ?? "",
      }),
    });

    if (!res.ok) {
      console.error("Failed to forward email to app:", res.status, await res.text());
    }
  },
};
