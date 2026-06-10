<template>
  <div class="nav">
    <a class="nav-logo" @click="goHome"><span>blue</span>printer</a>
    <a :class="{ active: state.view === 'home' }" @click="goHome">Home</a>
    <a :class="{ active: state.view === 'modules' }" @click="goModules">Modules</a>
    <a :class="{ active: state.view === 'adapters' }" @click="goAdapters">Adapters</a>
    <a :class="{ active: state.view === 'sagas' }" @click="goSagas">Sagas</a>
    <a :class="{ active: state.view === 'quickstart' }" @click="goQuickstart">Quick Start</a>
    <a v-if="state.currentModule" :class="{ active: state.view === 'contract' }" @click="state.view = 'contract'">Contract</a>
    <a class="nav-right" href="https://github.com/Friehub/blueprint" target="_blank">GitHub</a>
  </div>

  <template v-if="!state.loaded">
    <div class="main" style="text-align:center;padding:120px 0;color:var(--fog)">Loading catalog...</div>
  </template>

  <template v-if="state.loaded">

    <!-- HOME -->
    <template v-if="state.view === 'home'">
      <div class="hero">
        <div class="hero-badge">v0.2.0 &middot; Open Source</div>
        <h1 class="hero-title">Backend contracts<br/>for <span class="mint">AI agents</span> and engineers</h1>
        <p class="hero-sub">155 domain modules &middot; 83 adapters &middot; 5 code generators &middot; 12 MCP tools</p>
        <div class="hero-cta">
          <code class="install-cmd">npm install -g @friehub/blueprint</code>
        </div>
        <div class="hero-demo">
          <div class="demo-line"><span class="prompt">$</span> blueprint list</div>
          <div class="demo-line"><span class="prompt">$</span> blueprint inspect payments</div>
          <div class="demo-line"><span class="prompt">$</span> blueprint generate --lang go --namespace acme</div>
        </div>
      </div>

      <div class="home-section">
        <h2>What is Blueprint?</h2>
        <p>Every backend system is made of the same puzzles: payments, notifications, auth, caching, queues. The implementations differ. The interface does not. Stripe and Paystack both process payments. Twilio and Vonage both send texts. Redis and Memcached both cache things.</p>
        <p>Blueprint captures that shape. It defines what <strong>initiatePayment</strong> must guarantee, what errors it can throw, and how it behaves under load — once, in one place, so an AI agent or a new team member never has to guess.</p>
      </div>

      <div class="home-section">
        <h2>How it works</h2>
        <div class="pipeline">
          <div class="pipe-step"><strong>1. Contracts</strong><span>155 markdown files define every function, type, and invariant</span></div>
          <div class="pipe-arrow">&rarr;</div>
          <div class="pipe-step"><strong>2. Parser</strong><span>Validates and compiles into a typed catalog</span></div>
          <div class="pipe-arrow">&rarr;</div>
          <div class="pipe-step"><strong>3. Catalog</strong><span>Resolved dependency graph with adapter compatibility</span></div>
          <div class="pipe-arrow">&rarr;</div>
          <div class="pipe-step"><strong>4. Generators</strong><span>TypeScript, Python, Go, Rust, Java — interfaces, stubs, tests</span></div>
        </div>
      </div>

      <div class="home-section">
        <h2>Stats</h2>
        <div class="stats">
          <div class="stat"><div class="stat-num">{{ catalog.modules.length }}</div><div class="stat-label">Module contracts</div></div>
          <div class="stat"><div class="stat-num">{{ adapterModules }}</div><div class="stat-label">Modules with adapters</div></div>
          <div class="stat"><div class="stat-num">{{ totalFunctions }}</div><div class="stat-label">Function signatures</div></div>
          <div class="stat"><div class="stat-num">83</div><div class="stat-label">Provider adapters</div></div>
          <div class="stat"><div class="stat-num">204</div><div class="stat-label">Tests passing</div></div>
        </div>
      </div>
    </template>

    <!-- QUICK START -->
    <template v-if="state.view === 'quickstart'">
      <div class="main">
        <h2 class="section-title">Quick Start</h2>
        <div class="qs-step">
          <div class="qs-num">1</div>
          <div>
            <h3>Install</h3>
            <code class="qs-code">npm install -g @friehub/blueprint</code>
          </div>
        </div>
        <div class="qs-step">
          <div class="qs-num">2</div>
          <div>
            <h3>Browse the catalog</h3>
            <code class="qs-code">blueprint list</code>
            <code class="qs-code">blueprint inspect payments</code>
            <code class="qs-code">blueprint graph billing</code>
          </div>
        </div>
        <div class="qs-step">
          <div class="qs-num">3</div>
          <div>
            <h3>Select adapters</h3>
            <code class="qs-code">blueprint adapters add stripe payments</code>
            <code class="qs-code">blueprint adapters add redis caching</code>
          </div>
        </div>
        <div class="qs-step">
          <div class="qs-num">4</div>
          <div>
            <h3>Generate code</h3>
            <code class="qs-code">blueprint generate --lang python --module payments</code>
            <code class="qs-code">blueprint generate --lang go --namespace acme</code>
          </div>
        </div>
        <div class="qs-step">
          <div class="qs-num">5</div>
          <div>
            <h3>Verify implementations</h3>
            <code class="qs-code">blueprint verify ./src/payments/stripe.ts --module payments</code>
          </div>
        </div>
      </div>
    </template>

    <!-- MODULES -->
    <template v-if="state.view === 'modules'">
      <div class="main">
        <h2 class="section-title">Modules</h2>
        <p class="section-sub">Browse all {{ catalog.modules.length }} contracts. Click any module to see its functions, types, invariants, and dependencies.</p>

        <div class="search-wrap">
          <span class="search-icon">&#128269;</span>
          <input type="text" v-model="state.query" placeholder="Search modules by name, summary, or function..." />
        </div>

        <div class="grid">
          <div v-for="m in filteredModules" :key="m.name" class="card" @click="openModule(m)">
            <h3>{{ m.name }}</h3>
            <p>{{ m.summary || '' }}</p>
            <div class="card-meta">{{ m.functions?.length || 0 }} functions &middot; {{ m.hardDeps?.length || 0 }} deps</div>
          </div>
        </div>
        <p v-if="filteredModules.length === 0" class="empty">No modules match "{{ state.query }}"</p>
      </div>
    </template>

    <!-- ADAPTERS -->
    <template v-if="state.view === 'adapters'">
      <div class="main">
        <h2 class="section-title">Adapters</h2>
        <p class="section-sub">Available provider implementations per module</p>
        <table class="adapter-table">
          <thead><tr><th>Module</th><th>Providers</th><th>Languages</th></tr></thead>
          <tbody>
            <tr v-for="g in adapterGroups" :key="g.module">
              <td class="mod-name">{{ g.module }}</td>
              <td class="provider-list">{{ g.adapters.map(a => a.name).join(", ") }}</td>
              <td>
                <template v-if="g.hasLangs">
                  <span v-for="(langs, aName) in g.langMap" :key="aName" class="lang-badge">{{ aName }}: {{ langs.join(", ") }}</span>
                </template>
                <span v-else style="color:var(--fog);font-size:12px">all languages</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- SAGAS -->
    <template v-if="state.view === 'sagas'">
      <div class="main">
        <h2 class="section-title">Sagas</h2>
        <p class="section-sub">Cross-module business flows with compensation logic and failure modes</p>
        <div class="saga-list">
          <div v-for="s in sagas" :key="s.name" class="saga-card" @click="state.currentSaga = s; state.view = 'saga'">
            <h3>{{ s.name }}</h3>
            <p>{{ s.modules.join(" → ") }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- SAGA DETAIL -->
    <template v-if="state.view === 'saga' && state.currentSaga">
      <div class="main">
        <a class="back" @click="goSagas">&larr; Back to sagas</a>
        <h2 class="section-title">{{ state.currentSaga.name }}</h2>
        <div class="saga-flow">
          <div v-for="(step, i) in state.currentSaga.steps" :key="i" class="saga-step">
            <div class="saga-step-num">{{ i + 1 }}</div>
            <div>
              <strong>{{ step.action }}</strong>
              <span v-if="step.compensation" class="saga-comp">Comp: {{ step.compensation }}</span>
            </div>
          </div>
        </div>
        <section v-if="state.currentSaga.invariants" style="margin-top:28px">
          <h3>Invariants</h3>
          <ul class="invariant-list">
            <li v-for="inv in state.currentSaga.invariants" :key="inv">{{ inv }}</li>
          </ul>
        </section>
      </div>
    </template>

    <!-- CONTRACT VIEWER -->
    <template v-if="state.view === 'contract' && state.currentModule">
      <div class="main">
        <a class="back" @click="goModules">&larr; Back to modules</a>
        <h2 class="section-title">{{ state.currentModule.name }}</h2>
        <p class="section-sub">{{ state.currentModule.summary || 'No description' }}</p>

        <section>
          <h3>Functions</h3>
          <div v-for="fn in state.currentModule.functions" :key="fn.name" class="fn-block">
            <span class="fn-name">{{ fn.name }}</span>(
            <span v-for="(p, i) in fn.params" :key="p.name">
              {{ p.name }}<span v-if="p.type">: {{ p.type }}</span><span v-if="i < fn.params.length - 1">, </span>
            </span>
            ) <span class="fn-ret">&rarr; {{ fn.returns }}</span>
          </div>
        </section>

        <section v-if="state.currentModule.types?.length">
          <h3>Types</h3>
          <div v-for="t in state.currentModule.types" :key="t.name" class="type-block">
            <span class="fn-name">{{ t.name }}</span> {{ t.raw }}
          </div>
        </section>

        <section v-if="state.currentModule.hardDeps?.length || state.currentModule.softDeps?.length">
          <h3>Dependencies</h3>
          <div class="dep-graph">
            <div class="dep-node dep-root">{{ state.currentModule.name }}</div>
            <div v-for="dep in state.currentModule.hardDeps" :key="dep" class="dep-node dep-hard" @click="jumpTo(dep)">{{ dep }} (hard)</div>
            <div v-for="dep in state.currentModule.softDeps" :key="dep" class="dep-node dep-soft" @click="jumpTo(dep)">{{ dep }} (soft)</div>
          </div>
        </section>
      </div>
    </template>

  </template>
</template>

<script>
const SAGAS = [
  {
    name: "checkout",
    modules: ["cart", "orders", "payments", "inventory", "notifications", "fulfillment"],
    steps: [
      { action: "validate_cart(cart_id) — verify items available" },
      { action: "create_order(cart_id, user_id, address) → Order", compensation: "cancel_order" },
      { action: "reserve_inventory(order_id, items[]) → ReservationId", compensation: "release_stock" },
      { action: "initiate_payment(order_id, amount, method) → Payment", compensation: "initiate_refund" },
      { action: "confirm_order(order_id) → Order", compensation: "none (idempotent)" },
      { action: "[async] emit OrderConfirmed → triggers fulfillment, notification" },
    ],
    invariants: [
      "Payment must never be captured without a corresponding order record",
      "Inventory must never be deducted for a failed or uncaptured payment",
      "Saga orchestrator holds the idempotency key",
    ],
  },
  {
    name: "refund",
    modules: ["orders", "payments", "inventory", "notifications", "ledger"],
    steps: [
      { action: "validate_refund(order_id, amount, reason)" },
      { action: "create_refund_record(order_id, amount, reason) → RefundRecord" },
      { action: "initiate_refund(payment_id, amount, idempotency_key) → Refund", compensation: "mark failed" },
      { action: "restore_inventory(order_id, items[])" },
      { action: "update_order_status(order_id, status: returned)" },
      { action: "[async] notify_user(order_id, refund_amount)" },
    ],
  },
  {
    name: "subscription_lifecycle",
    modules: ["billing", "payments", "subscriptions", "notifications"],
    steps: [
      { action: "validate_payment_method(user_id, method)" },
      { action: "create_subscription(user_id, plan_id) → Subscription", compensation: "cancel_subscription" },
      { action: "create_invoice(subscription_id, plan, period) → Invoice" },
      { action: "charge_invoice(invoice_id, method) → Payment", compensation: "mark past_due" },
      { action: "[async] grant_entitlements(user_id, plan)" },
    ],
  },
  {
    name: "user_offboarding",
    modules: ["users", "billing", "subscriptions", "storage", "right_to_erasure"],
    steps: [
      { action: "initiate_offboarding(user_id, reason) — lock account", compensation: "reactivate_user" },
      { action: "cancel_active_subscriptions(user_id)" },
      { action: "export_user_data(user_id, destinations) → ExportResult" },
      { action: "revoke_api_keys(user_id)" },
      { action: "schedule_data_deletion(user_id, retention_delay)" },
    ],
  },
  {
    name: "dispute_resolution",
    modules: ["payments", "disputes", "notifications", "chargebacks", "fraud_detection"],
    steps: [
      { action: "receive_dispute(payment_id, dispute_data) → Dispute" },
      { action: "freeze_funds(payment_id)" },
      { action: "gather_evidence(dispute_id)" },
      { action: "submit_evidence(dispute_id, evidence, deadline)" },
      { action: "await_outcome(dispute_id) → DisputeOutcome" },
    ],
  },
];

export default {
  props: ["state"],
  data() { return { adaptersData: [] }; },
  computed: {
    catalog() { return this.state.catalog; },
    filteredModules() {
      const q = (this.state.query || "").toLowerCase();
      return this.catalog.modules.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.summary || "").toLowerCase().includes(q) ||
        (m.functions || []).some(f => f.name.toLowerCase().includes(q))
      );
    },
    totalFunctions() {
      return this.catalog.modules.reduce((s, m) => s + (m.functions?.length || 0), 0);
    },
    adapterModules() {
      return new Set(this.adaptersData.map(a => a.module)).size;
    },
    adapterGroups() {
      const groups = {};
      for (const a of this.state.adapters) {
        if (!groups[a.module]) groups[a.module] = { module: a.module, adapters: [], langMap: {}, hasLangs: false };
        groups[a.module].adapters.push(a);
        if (a.languages) { groups[a.module].hasLangs = true; groups[a.module].langMap[a.name] = a.languages; }
      }
      return Object.values(groups).sort((a, b) => a.module.localeCompare(b.module));
    },
    sagas() { return SAGAS; },
  },
  methods: {
    goHome() { window.scrollTo(0,0); this.state.view = "home"; this.state.currentModule = null; },
    goModules() { window.scrollTo(0,0); this.state.view = "modules"; this.state.currentModule = null; this.state.query = ""; },
    goAdapters() { window.scrollTo(0,0); this.state.view = "adapters"; this.state.currentModule = null; },
    goSagas() { window.scrollTo(0,0); this.state.view = "sagas"; this.state.currentModule = null; },
    goQuickstart() { window.scrollTo(0,0); this.state.view = "quickstart"; this.state.currentModule = null; },
    openModule(m) { window.scrollTo(0,0); this.state.currentModule = m; this.state.view = "contract"; },
    jumpTo(name) {
      const m = this.catalog.modules.find(mm => mm.name === name);
      if (m) this.openModule(m);
    },
  },
  mounted() {
    this.adaptersData = this.state.adapters;
  },
};
</script>
