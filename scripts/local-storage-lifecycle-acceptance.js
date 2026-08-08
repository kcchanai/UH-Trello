(() => {
  const keys = ['flowboard-workspace', 'flowboard-data'];
  const baselineKey = 'flowboard-lifecycle-local-storage-baseline-v1';
  const mode = globalThis.FlowboardApp?.getMode?.();

  if (mode?.kind !== 'local') {
    console.error('LOCAL STORAGE CHECK BLOCKED: return to local mode first.');
    return {status:'blocked'};
  }

  const current = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  const bytes = value => value === null ? null : new TextEncoder().encode(value).byteLength;
  const baselineText = sessionStorage.getItem(baselineKey);

  if (baselineText === null) {
    sessionStorage.setItem(baselineKey, JSON.stringify(current));
    console.table(keys.map(key => ({key, present:current[key] !== null, bytes:bytes(current[key])})));
    console.log('LOCAL STORAGE BASELINE CAPTURED');
    return {status:'captured'};
  }

  let baseline;
  try {
    baseline = JSON.parse(baselineText);
  } catch {
    console.error('LOCAL STORAGE CHECK BLOCKED: stored baseline is invalid.');
    return {status:'blocked'};
  }

  const checks = keys.map(key => ({
    key,
    present: current[key] !== null,
    bytes: bytes(current[key]),
    unchanged: baseline[key] === current[key]
  }));
  const passed = checks.every(check => check.unchanged);
  console.table(checks);
  console.log(passed ? 'LOCAL STORAGE BYTE EQUALITY PASS' : 'LOCAL STORAGE BYTE EQUALITY FAIL');
  if (passed) sessionStorage.removeItem(baselineKey);
  return {status:passed?'passed':'failed',checks};
})();
