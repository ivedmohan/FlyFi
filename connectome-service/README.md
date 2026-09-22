---
title: FlyFi Connectome
emoji: 🪰
colorFrom: green
colorTo: purple
sdk: docker
app_port: 7860
---

Runs the real MaleCNS v1.0 fruit fly connectome (166,700 neurons, via fly.ai's
`flybrain` package) and reports its descending-neuron response to a momentum stimulus.
Called by FlyFi's Next.js app (`lib/connectome.ts`) as a display/comparison-only signal
— `POST /decide` with a shared-secret `Authorization: Bearer` header, same pattern as
the Next.js app's own `CRON_SECRET`. Never drives a real trade; the Q-learner in the
main app does that.

See `app.py` for the encoder/decoder design and its honesty notes about signal
reliability (verified via multi-trial testing, not assumed).

## Local dev

```
pip install -r requirements.txt
CONNECTOME_SECRET=dev-secret uvicorn app:app --reload
curl -X POST localhost:8000/decide -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" -d '{"momentum_bucket": 1}'
```
