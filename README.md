# FlyFi

An autonomous fly with a wallet. Every tick, the real 166,700-neuron *Drosophila*
connectome proposes a trade; a small tabular Q-learner can veto it once it's learned,
from real portfolio outcomes, that some other action clearly works better in that exact
situation. Whichever wins executes gaslessly through SmoothSend on Avalanche mainnet.

## What's real vs. narrative

- **Real**: the wallet, the DEX swaps (LFJ V2.2 on Avalanche mainnet), the gasless
  execution (SmoothSend), the Q-learning veto/learning loop, the AVAX/USD price data,
  and the connectome service (an actual instance of the real MaleCNS connectome, not a
  simulation of one) — including its role in actually proposing trades, not just
  displaying an opinion.
- **Decorative/narrative**: the 3D desk scene and brain-map visualization are original
  artwork illustrating the real data, not literal renderings of anything.
- The connectome's output is shown honestly as a noisy signal (real numbers: firing
  rate difference, gate confidence), and it *is* what drives most trades by default —
  see `decideAction()` in `lib/rl.ts` for the exact veto rule. This is a deliberate
  choice for a project more interested in running a genuine biological simulation live
  than in a validated trading edge: fly.ai's own published research (and our own
  multi-trial testing) found this general approach doesn't reliably beat a non-learning
  baseline. Nothing here is investment advice.

## Tech stack

- **App**: Next.js 15 (App Router), TypeScript, Tailwind
- **Chain**: Avalanche C-Chain mainnet, `@smoothsend/sdk/avax` for gasless ERC-4337
  execution, [LFJ (Trader Joe) V2.2](https://developers.lfj.gg) for swaps
- **Decision loop**: the connectome service proposes; hand-rolled tabular Q-learning
  (`lib/rl.ts`, `decideAction()`) can veto it — deliberately not a black-box model, so
  the whole veto rule fits in one small, readable file
- **Data**: Supabase (Postgres) for tick history and the learned Q-table; CoinGecko's
  public OHLC endpoint for chart candles
- **3D**: `@react-three/fiber` + drei, an original procedural low-poly scene
- **Connectome service**: Python/FastAPI (`connectome-service/`), running fly.ai's
  `flybrain` package (the real MaleCNS v1.0 connectome, 166,700 neurons), hosted
  separately (Render) since it needs a persistent process, not serverless

## Sources & credit

This project builds on real open-source and scientific work rather than reinventing
it. Credited here, not just in code comments:

- **[fly.ai](https://github.com/alextitonis/fly.ai)** (alextitonis, MIT) — the
  `flybrain` package (the actual connectome simulation engine we run in
  `connectome-service/`) is used as a real dependency, not adapted code. The sensory
  encoder in `connectome-service/app.py` (price momentum → specific real neuron types)
  is our own implementation, inspired by the mapping idea in fly.ai's own
  `flybook/worker/market.py` (read for design reference, not copied).
- **[stonkfly](https://github.com/nftechie/stonkfly)** (nftechie, MIT) — the connectome
  decoder design (`connectome-service/app.py`: a specific identified neuron pair
  `DNp20` left/right read as a rate difference, gated by a confidence neuron `DNpe017`)
  follows `stonkfly/neural/controller.py`'s approach, independently reimplemented for
  our own action space — this produced a real, verified signal where a naive
  broad-category spike-count approach did not. The engineering rule that a
  risk-rejected trade must be recorded as `HOLD`, never the action that was rejected
  (`app/api/tick/route.ts`), follows a principle from stonkfly's own `AGENTS.md`.
- **MaleCNS v1.0 connectome data** — Berg, S. et al. (2026). "Sexual dimorphism in the
  complete connectome of the *Drosophila* male central nervous system." *Cell*. Data:
  [male-cns.janelia.org](https://male-cns.janelia.org), from the FlyEM team at HHMI
  Janelia, the University of Cambridge, the MRC Laboratory of Molecular Biology, and
  Google Research. Used under [CC BY 4.0](https://male-cns.janelia.org/download/).
- **[SmoothSend](https://smoothsend.xyz)** — gasless transaction infrastructure;
  `lib/wallet.ts` is built directly on `@smoothsend/sdk/avax`.
- **[LFJ / Trader Joe](https://developers.lfj.gg)** — the DEX FlyFi trades on;
  router/quoter addresses and ABIs in `lib/dex.ts` were verified against
  [Trader Joe's own contract source](https://github.com/traderjoe-xyz/joe-v2) and
  Snowtrace before being wired to a real wallet.
- **[CoinGecko](https://www.coingecko.com)** — public OHLC price data for the chart.

## Local development

```
npm install
cp .env.example .env.local   # fill in real values — see comments in the file
npm run dev
```

`connectome-service/` is a separate Python service (`pip install -r requirements.txt`,
`uvicorn app:app`) — see its own `README.md`.
