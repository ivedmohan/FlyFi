"""FlyFi connectome service — runs the real MaleCNS connectome (166,700 neurons,
fly.ai's `flybrain` package) on the same momentum input the Q-learner sees, and reports
what the real biological network's descending-neuron output looks like. Display/
comparison only — this never touches real funds; `lib/rl.ts` in the Next.js app is the
actual trade-decision-maker.

Decoder design follows stonkfly's approach (github.com/nftechie/stonkfly,
stonkfly/neural/controller.py, MIT), not fly.ai's own market.py: a specific identified
descending-neuron pair (DNp20, left/right) read as a rate difference, gated by a
confidence neuron (DNpe017) that must show activity at all before the L/R signal counts.
Averaged over several independent trials per decision — a single pass is high-variance
with only 1-2 real neurons as the entire readout (verified directly: single-trial runs
looked clean but didn't hold up under multi-trial testing, consistent with fly.ai's own
published finding that this general approach doesn't reliably beat a non-learning
baseline). We report the honest confidence numbers (mean_diff_hz, gate_rate), not just
a label, because of that.

Encoder: our own, inspired by (not copied from) flybook/worker/market.py's real-neuron
sensory mapping — a price pump stimulates LC10a (motion-target detector cells), a price
drop stimulates LC4/LPLC2 (looming/escape detector cells).
"""

import os
import time

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from flybrain import FlyBrain

STEPS = 50  # 1 simulated brain-second per decision, matches fly.ai's market.py
TRIALS = 8
THRESHOLD_HZ = 0.3
SECRET = os.environ.get("CONNECTOME_SECRET")

app = FastAPI(title="flyfi-connectome")
brain: FlyBrain | None = None
left_idx = right_idx = gate_idx = None


@app.on_event("startup")
def load_brain():
    global brain, left_idx, right_idx, gate_idx
    brain = FlyBrain(device="cpu")
    brain.step()  # pay the one-time numba JIT-compile cost at startup, not on request 1
    left_idx = brain.cells(["DNp20"], side="L")
    right_idx = brain.cells(["DNp20"], side="R")
    gate_idx = brain.cells(["DNpe017"])


class DecideRequest(BaseModel):
    momentum_bucket: int  # -2..2, same bucketing as lib/rl.ts's bucketMomentum()


def one_trial(momentum_bucket: int, seed: int) -> tuple[float, float, int]:
    brain.reset(seed=seed)
    if momentum_bucket > 0:
        idx = brain.cells(["LC10a"])
        brain.stimulate(idx, 1.5 + 0.5 * abs(momentum_bucket))
    elif momentum_bucket < 0:
        idx = brain.cells(["LC4", "LPLC2"])
        brain.stimulate(idx, 1.5 + 0.5 * abs(momentum_bucket))

    counts = np.zeros(brain.n, dtype=np.int32)
    for _ in range(STEPS):
        fired = brain.step()
        counts[fired] += 1

    seconds = STEPS * brain.dt
    left_hz = float(counts[left_idx].mean()) / seconds
    right_hz = float(counts[right_idx].mean()) / seconds
    gate = int(counts[gate_idx].sum())
    return left_hz, right_hz, gate


@app.post("/decide")
def decide(req: DecideRequest, authorization: str | None = Header(default=None)):
    if SECRET and authorization != f"Bearer {SECRET}":
        raise HTTPException(status_code=401, detail="unauthorized")

    t0 = time.time()
    base_seed = int(time.time() * 1000) % 1_000_000
    diffs, gate_hits = [], 0
    for i in range(TRIALS):
        left_hz, right_hz, gate = one_trial(req.momentum_bucket, seed=base_seed + i)
        diffs.append(right_hz - left_hz)
        if gate > 0:
            gate_hits += 1

    mean_diff = float(np.mean(diffs))
    gate_rate = gate_hits / TRIALS

    if gate_rate < 0.5 or abs(mean_diff) < THRESHOLD_HZ:
        action = "HOLD"
    else:
        action = "SWAP_TO_AVAX" if mean_diff > 0 else "SWAP_TO_USDC"

    return {
        "action": action,
        "mean_diff_hz": round(mean_diff, 3),
        "gate_rate": gate_rate,
        "trials": TRIALS,
        "elapsed_s": round(time.time() - t0, 2),
        "neuron_count": int(brain.n),
    }


@app.get("/health")
def health():
    return {"status": "ok", "neurons": int(brain.n) if brain is not None else None}
