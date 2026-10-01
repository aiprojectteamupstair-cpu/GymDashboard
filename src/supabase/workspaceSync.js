export function isTransientFailure(error) {
  if (!error) return false;
  if ([401, 403].includes(error.status) || error.code === 'ACCESS_DENIED') return false;
  if (error.cause) return isTransientFailure(error.cause);
  return error.status >= 500 || /fetch|network|timeout|timed out|aborted/i.test(error.message || '');
}

// Memory only: never persist member data. One load per identity at a time.
export function createWorkspaceSync(load, publish, clock = Date.now) {
  let state = { owner: null, snapshot: null, busy: false, error: '', verifiedAt: 0 };
  let epoch = 0, pending = null, lastAttempt = -Infinity;
  const emit = patch => { state = { ...state, ...patch }; publish(state); };
  return {
    current: () => state,
    identity(owner) {
      if (owner === state.owner) return false;
      epoch++; pending = null; lastAttempt = -Infinity;
      emit({ owner, snapshot: null, busy: false, error: '', verifiedAt: 0 });
      return true;
    },
    invalidate() { epoch++; pending = null; lastAttempt = -Infinity; },
    refresh({ force = false } = {}) {
      if (!state.owner) return Promise.resolve();
      if (pending) return force ? pending.then(() => this.refresh({ force: true })) : pending;
      if (!force && clock() - lastAttempt < 30000) return Promise.resolve();
      lastAttempt = clock();
      const request = ++epoch, owner = state.owner;
      emit({ busy: true, error: '' });
      pending = Promise.resolve().then(() => load(owner)).then(snapshot => {
        if (request === epoch) emit({ snapshot, verifiedAt: clock(), error: '' });
      }).catch(error => {
        if (request !== epoch) return;
        const retain = isTransientFailure(error) && state.snapshot && clock() - state.verifiedAt < 300000;
        emit({ snapshot: retain ? state.snapshot : null, error: retain
          ? 'Connection interrupted. Showing the last verified data; use Refresh to try again.'
          : error.message || 'Unable to load workspace.' });
      }).finally(() => {
        if (request === epoch) { pending = null; emit({ busy: false }); }
      });
      return pending;
    },
  };
}
