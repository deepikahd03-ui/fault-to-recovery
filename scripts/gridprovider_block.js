function GridProvider({ children }) {
  const [grid, setGrid] = useState(null);
  const [bootError, setBootError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind, id: NOW() });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const refresh = useCallback(async () => {
    const s = await apiService.getGridState();
    if (mountedRef.current) setGrid(s);
    return s;
  }, []);

  // boot: fetch initial grid state from the backend
  useEffect(() => {
    mountedRef.current = true;
    apiService.getGridState()
      .then((s) => { if (mountedRef.current) setGrid(s); })
      .catch((e) => { if (mountedRef.current) setBootError(e.message || String(e)); });
    return () => { mountedRef.current = false; };
  }, []);

  // live telemetry poll — every 3s from the real backend (skipped while a mutation is in flight)
  useEffect(() => {
    if (!grid) return;
    const id = setInterval(() => {
      if (loadingRef.current) return;
      apiService.getGridState().then((s) => { if (mountedRef.current) setGrid(s); }).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [grid ? 'on' : 'off']);

  const actions = useMemo(() => ({
    login: async (creds) => apiService.login(creds),
    triggerScenario: async (sid) => {
      loadingRef.current = true; setLoading(true);
      try {
        const s = await apiService.triggerScenario(sid);
        if (mountedRef.current) setGrid(s);
        showToast(sid === 'S3' ? 'Grid reset to healthy state.' : 'Fault scenario injected — protective relays tripping.', sid === 'S3' ? 'success' : 'fault');
        return s;
      } catch (e) { showToast('Scenario failed: ' + (e.message || e), 'fault'); throw e; }
      finally { loadingRef.current = false; setLoading(false); }
    },
    executeRestoration: async () => {
      loadingRef.current = true; setLoading(true);
      try {
        const s = await apiService.executeRestoration();
        if (mountedRef.current) setGrid(s);
        const phase = s.statusPhase;
        showToast(phase === 'restored' ? 'Restoration successful — load re-energised.' : phase === 'no_route' ? 'No feasible route — manual dispatch required.' : 'Restoration executed.', phase === 'restored' ? 'success' : 'fault');
        return s;
      } catch (e) { showToast('Restoration failed: ' + (e.message || e), 'fault'); throw e; }
      finally { loadingRef.current = false; setLoading(false); }
    },
    resetGrid: async () => {
      loadingRef.current = true; setLoading(true);
      try {
        const s = await apiService.resetGrid();
        if (mountedRef.current) setGrid(s);
        showToast('Grid restored to nominal healthy state.', 'success');
        return s;
      } catch (e) { showToast('Reset failed: ' + (e.message || e), 'fault'); throw e; }
      finally { loadingRef.current = false; setLoading(false); }
    },
    refresh,
  }), [refresh, showToast]);

  if (bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-grid-card border border-faulted/40 mb-3">
            <Icon name="alertTriangle" className="w-8 h-8 text-faulted" />
          </div>
          <h1 className="text-xl font-bold text-slate-50">Backend unreachable</h1>
          <p className="text-sm text-slate-400 mt-2">Could not connect to the Flask API at <span className="font-mono text-restoration">http://localhost:5000</span>.</p>
          <p className="text-xs text-slate-500 mt-1">Error: {bootError}</p>
          <p className="text-xs text-slate-500 mt-3">Start it with: <span className="font-mono">cd download/backend &amp;&amp; pip install -r requirements.txt &amp;&amp; python app.py</span></p>
          <button onClick={() => { setBootError(null); apiService.getGridState().then((s) => mountedRef.current && setGrid(s)).catch((e) => mountedRef.current && setBootError(e.message || String(e))); }} className="mt-4 px-4 py-2 rounded-lg bg-restoration text-grid-bg font-semibold text-sm inline-flex items-center gap-2">
            <Icon name="refresh" className="w-4 h-4" />Retry connection
          </button>
        </div>
      </div>
    );
  }

  if (!grid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 flex-col gap-4">
        <div className="loader-ring"></div>
        <div className="text-slate-400 text-sm">Connecting to grid control backend…</div>
      </div>
    );
  }

  return (
    <GridCtx.Provider value={{ grid, loading, toast, actions }}>
      {children}
      {toast && <Toast toast={toast} />}
    </GridCtx.Provider>
  );
}
