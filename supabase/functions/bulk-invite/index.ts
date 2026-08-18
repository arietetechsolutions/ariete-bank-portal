Deno.serve(async () => {
  return new Response(JSON.stringify({ success: false, error: "Not implemented yet" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
});
