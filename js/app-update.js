export async function refreshApp() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) throw new Error('No app registration.');
  await registration.update();

  const pending = registration.installing || registration.waiting;
  if (pending) await activate(pending);

  const active = registration.active || navigator.serviceWorker.controller;
  if (!active) throw new Error('No active app worker.');
  // A new worker already fetched a fresh shell in its install event.
  if (!pending) await refreshShell(active);
}

function activate(worker) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Update timed out.')), 55000);
    function finish(error) {
      clearTimeout(timer);
      worker.removeEventListener('statechange', check);
      if (error) reject(error);
      else resolve();
    }
    function check() {
      if (worker.state === 'installed') worker.postMessage({type:'SKIP_WAITING'});
      if (worker.state === 'activated') finish();
      if (worker.state === 'redundant') finish(new Error('Installation did not complete.'));
    }
    worker.addEventListener('statechange',check);
    check();
  });
}

function refreshShell(worker) {
  return new Promise((resolve, reject) => {
    const {port1,port2} = new MessageChannel();
    const timer = setTimeout(() => finish(new Error('Refresh timed out.')), 55000);
    function finish(error) {
      clearTimeout(timer);
      port1.close();
      if (error) reject(error);
      else resolve();
    }
    port1.onmessage = event => finish(event.data?.ok ? undefined : new Error('Could not cache the app files.'));
    try { worker.postMessage({type:'REFRESH_APP_SHELL'},[port2]); }
    catch (error) { finish(error); }
  });
}
