# Performance & Scalability 🚀

**Architecture:** The Express API is decoupled from CPU-heavy `pdflatex` compilations using a **Redis-backed BullMQ worker**. This asynchronous queue isolates the main thread, preventing request bottlenecks and socket timeouts under load.

## Load Test Results (Artillery)
*Scenario: 1.5-minute targeted spike (Ramping to 10 RPS) on Local Environment.*

* **Total Requests (VUs):** 540
* **Peak Throughput:** 10 Req/sec
* **Success Rate:** 100% (0 dropped sessions)
* **Queue State:** Stable (Zero backlog pileup)

### Latency
* **Median Response Time:** 284.3 ms
* **p95 Latency:** 301.9 ms
* **Max Latency:** 958 ms

**Conclusion:** The asynchronous worker queue successfully absorbed the targeted load spike. The API maintained ~300ms response times with a 100% success rate, proving the architecture is highly fault-tolerant and safely decoupled.