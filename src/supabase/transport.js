export const CONNECTION_ERROR = 'Network connection failed. Cannot reach the dashboard server. Please try again.';

export function createSupabaseFetch(fetcher = globalThis.fetch, timeoutMs = 12000) {
  return async (input, options = {}) => {
    const deadline = new AbortController();
    const callerSignal = options.signal || (input instanceof Request ? input.signal : null);
    const timer = setTimeout(() => deadline.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
    try {
      return await fetcher(input, {
        ...options,
        signal: callerSignal ? AbortSignal.any([deadline.signal, callerSignal]) : deadline.signal,
      });
    } catch (error) {
      if (callerSignal?.aborted) throw error;
      if (deadline.signal.aborted || error instanceof TypeError || error.name === 'TimeoutError') {
        throw new TypeError(CONNECTION_ERROR, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}
