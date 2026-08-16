# Compounder

A daily game: four cards, ~45 minutes. One deliberate action per domain, per day — each small enough to win on a bad day.

| Domain | The move | Scored as |
| --- | --- | --- |
| **Money** | One 15-min deliberate action — fund the Roth, write one thesis paragraph, one advisory outreach, one position reconciled. Checking your P&L does not count. | Done / not |
| **Health** | One of: zone 2, lift, or 8K steps — plus lights-out by your target time | Done / not |
| **Family** | One defended block with a specific person, phone in another room | Block happened / didn't |
| **Self** | 30 minutes with zero ROI — a film, a book, a walk | Happened / didn't |

Four points a day, 28 possible per week. **Your target is 20. Not 28.** That number is the whole system.

## Running it

It's a single static `index.html` — no build step, no backend. Open the file directly, or serve the folder:

```bash
python3 -m http.server 8000
```

Progress is stored in the browser's `localStorage`, on-device only.
