// Retries of an unchanged form reuse the same request ID, including lost responses.
export function createCommandSender(client) {
  let pending = null;
  return async (command, payload) => {
    const fingerprint = JSON.stringify({ command, payload });
    if (pending && pending.fingerprint !== fingerprint) throw new Error('A previous save is unconfirmed. Retry its unchanged values before starting another operation.');
    if (!pending) pending = { fingerprint, request_id: crypto.randomUUID() };
    const { data, error } = await client.functions.invoke('gym-commands', { body: { command, payload, request_id: pending.request_id } });
    if (error || data?.error) {
      let message = data?.error || 'Save could not be confirmed. Retry the same form; do not create another record.';
      try {
        message = (await error.context.json()).error || message;
        if ([400, 401, 403, 409, 413].includes(error.context.status)) pending = null;
      } catch { /* transport error: retain request id */ }
      throw new Error(message);
    }
    if (!data?.result) throw new Error('Save response incomplete. Retry the same form.');
    pending = null;
    return data.result;
  };
}
