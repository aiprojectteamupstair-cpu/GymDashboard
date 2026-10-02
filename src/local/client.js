// The browser receives public profiles only. Password hashes and session tokens stay server-side.
export function createLocalClient() {
  const listeners=new Set();
  const notify=user => {
    const session=user ? {user:{id:user.id,email:user.email}} : null;
    for (const listener of listeners) listener(session ? 'SIGNED_IN':'SIGNED_OUT',session);
  };
  async function request(path, body) {
    const response=await fetch(`/api/local/${path}`,{
      method:body===undefined ? 'GET':'POST', credentials:'same-origin', cache:'no-store',
      ...(body===undefined ? {} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
      signal:AbortSignal.timeout(30000),
    });
    const result=await response.json();
    if (!response.ok) {
      if (response.status===401) notify(null);
      const error=new Error(result.error || 'Request failed.');
      error.status=response.status;
      error.context={status:response.status,json:async()=>result};
      throw error;
    }
    return result;
  }
  return {
    auth:{
      onAuthStateChange(callback) {
        listeners.add(callback);
        request('session').then(result=>{
          if (listeners.has(callback)) callback('INITIAL_SESSION',result.user ? {user:{id:result.user.id,email:result.user.email}} : null);
        }).catch(()=>{ if (listeners.has(callback)) callback('INITIAL_SESSION',null); });
        return {data:{subscription:{unsubscribe:()=>listeners.delete(callback)}}};
      },
      async signInWithPassword(values) {
        try { const result=await request('login',values); notify(result.user); return {error:null}; }
        catch (error) { return {error}; }
      },
      async signOut() {
        try { await request('logout',{}); notify(null); return {error:null}; }
        catch (error) { return {error}; }
      },
    },
    async loadWorkspace(expectedUserId) {
      const snapshot=await request('workspace');
      if (expectedUserId && snapshot.staff.id!==expectedUserId) { notify(null); throw new Error('Please sign in again.'); }
      return snapshot;
    },
    functions:{ async invoke(name,{body}) {
      try { return {data:await request(name,body),error:null}; }
      catch (error) { return {data:null,error}; }
    } },
  };
}
