# Fault to Recovery — Backend (BESCOM Theme 9)

Python Flask REST API + SQLite + networkx graph engine for the Smart Electricity
Distribution Network Monitoring & Self-Healing Simulation.

## Stack
- Python 3.10+
- Flask (REST API)
- Flask-CORS (cross-origin requests from the frontend)
- SQLite (durable topology, faults, anomalies, event history, telemetry logs)
- networkx (graph topology + pathfinding for restoration routes)

## Project layout
```
download/
  fault-to-recovery.html      # compiled frontend (calls this API)
  backend/
    app.py                     # Flask REST endpoints + serves frontend at /
    engine.py                  # networkx graph intelligence
    db.py                      # SQLite schema, auto-seed, query helpers
    grid.db                    # auto-created on first run
    requirements.txt
    README.md
scripts/
  fault-to-recovery.src.html   # editable JSX source
  build_final.cjs              # rebuilds the compiled frontend
```

## Quick start

```bash
cd download/backend
pip install -r requirements.txt
python app.py
```

The API starts on **http://localhost:5000**.

- The grid database `grid.db` is created and seeded automatically on first run
  (2 substations, 3 feeders, 4 transformers, 4 consumer areas, 12 line segments
  + tie-switch TS-1).
- The Flask app also serves the compiled frontend at **http://localhost:5000/**
  (same origin — no CORS issues). You can also open the HTML file directly from
  `download/fault-to-recovery.html`; CORS is enabled so `file://` works too.

Then open **http://localhost:5000/** in your browser and log in with
`admin@bescom.sim` / `demo123`.

## REST API

| Method | Endpoint                 | Body / Query                                  | Purpose |
|--------|--------------------------|-----------------------------------------------|---------|
| POST   | `/api/login`             | `{email, password}`                           | Operator login (any email + 3+ char password) |
| GET    | `/api/network/state`     | —                                             | Full grid snapshot (nodes, edges, telemetry, KPIs, anomalies, plan) — also advances live telemetry |
| POST   | `/api/simulate/fault`    | `{scenario:"S1"\|"S2"}` or `{edge_id:"..."}`  | Inject fault → localise (networkx BFS) → compute restoration route → log to SQLite |
| POST   | `/api/simulate/restore`  | —                                             | Apply recommended switching actions, update load flow, log restoration |
| POST   | `/api/simulate/reset`    | —                                             | Restore default healthy topology |
| GET    | `/api/events`            | `?type=fault&q=...`                            | Filterable event-history audit log |

### Scenarios
- **S1** — Line fault on `E-SUBA-F2` (supplies Areas B & C). Restorable via
  Tie-Switch TS-1 backfeed from Feeder F3 (capacity check passes).
- **S2** — Same fault during peak load (Area D spiked to 6.7 MW, F3 at thermal
  limit). Restoration infeasible — returns `feasible:false` with constraint
  violation reason ("Backup Feeder F3 would exceed 100% thermal capacity").
- **S3 / `/api/simulate/reset`** — Reset grid to healthy nominal state.

## Graph intelligence (`engine.py`)
- `detect_and_localise_fault(edge_id)` — marks the edge `FAULTED`, runs BFS from
  active substations through closed/non-faulted edges to find disconnected
  nodes/areas, computes affected load, builds the protective relay trip
  sequence.
- `find_restoration_route(affected_nodes)` — builds a networkx graph (treating
  normally-open tie-switches as available edges), runs `all_simple_paths` from
  healthy substations to isolated areas, checks the operating constraint
  `feeder_current_load + affected_load <= feeder_max_capacity`, and returns
  exact switching steps (`OPEN` fault-adjacent switch, `CLOSE` tie-switch) or
  `feasible:false` with the violation reason.

## Rebuilding the frontend after edits
The frontend ships precompiled (no in-browser Babel). To edit the React layer:

```bash
cd /home/z/my-project
# edit scripts/fault-to-recovery.src.html, then:
node scripts/build_final.cjs
```
