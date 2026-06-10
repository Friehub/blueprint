<template>
  <div class="nav">
    <a class="nav-logo" @click="state.view = 'modules'; state.query = ''"><span>blue</span>printer</a>
    <a :class="{ active: state.view === 'modules' }" @click="goModules">Modules</a>
    <a :class="{ active: state.view === 'adapters' }" @click="goAdapters">Adapters</a>
    <a :class="{ active: state.view === 'sagas' }" @click="goSagas">Sagas</a>
    <a v-if="state.currentModule" :class="{ active: state.view === 'contract' }" @click="state.view = 'contract'">Contract</a>
    <a class="nav-right" href="https://github.com/Friehub/blueprint" target="_blank">GitHub</a>
  </div>

  <div class="main">
    <div v-if="!state.loaded" style="text-align:center;padding:80px 0;color:var(--fog);font-size:14px">Loading catalog...</div>
    <template v-if="state.loaded">

    <!-- MODULE BROWSER -->
    <template v-if="state.view === 'modules'">
      <div class="stats">
        <div class="stat"><div class="stat-num">{{ catalog.modules.length }}</div><div class="stat-label">Modules</div></div>
        <div class="stat"><div class="stat-num">{{ adapterModules }}</div><div class="stat-label">Modules with adapters</div></div>
        <div class="stat"><div class="stat-num">{{ totalFunctions }}</div><div class="stat-label">Functions</div></div>
        <div class="stat"><div class="stat-num">{{ catalog.core.length }}</div><div class="stat-label">Core contracts</div></div>
      </div>

      <div class="search-wrap">
        <span class="search-icon">&#128269;</span>
        <input type="text" v-model="state.query" placeholder="Search modules by name, summary, or function..." />
      </div>

      <div class="grid">
        <div v-for="m in filteredModules" :key="m.name" class="card" @click="openModule(m)">
          <h3>{{ m.name }}</h3>
          <p>{{ m.summary || '' }}</p>
          <div class="card-meta">{{ m.functions?.length || 0 }} functions</div>
        </div>
      </div>
      <p v-if="filteredModules.length === 0" style="color:var(--fog);margin-top:20px">No modules match "{{ state.query }}"</p>
    </template>

    <!-- ADAPTERS -->
    <template v-if="state.view === 'adapters'">
      <div class="section-title">Adapters</div>
      <div class="section-sub">Available provider implementations per module</div>
      <table class="adapter-table">
        <thead><tr><th>Module</th><th>Providers</th><th>Languages</th></tr></thead>
        <tbody>
          <tr v-for="g in adapterGroups" :key="g.module">
            <td class="mod-name">{{ g.module }}</td>
            <td class="provider-list">{{ g.adapters.map(a => a.name).join(", ") }}</td>
            <td>
              <template v-if="g.hasLangs">
                <span v-for="(langs, aName) in g.langMap" :key="aName">
                  <span class="lang-badge">{{ aName }}: {{ langs.join(", ") }}</span>
                </span>
              </template>
              <span v-else style="color:var(--fog);font-size:12px">all languages</span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- SAGAS LIST -->
    <template v-if="state.view === 'sagas'">
      <div class="section-title">Sagas</div>
      <div class="section-sub">Cross-module business flows with compensation logic</div>
      <div class="saga-list">
        <div v-for="s in sagas" :key="s.name" class="saga-card" @click="state.currentSaga = s; state.view = 'saga'">
          <h3>{{ s.name }}</h3>
          <p>{{ s.modules.join(" → ") }}</p>
        </div>
      </div>
    </template>

    <!-- SAGA DETAIL -->
    <template v-if="state.view === 'saga' && state.currentSaga">
      <a class="back" @click="state.view = 'sagas'">&larr; Back to sagas</a>
      <div class="contract">
        <h2>{{ state.currentSaga.name }}</h2>
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
      <a class="back" @click="state.view = 'modules'; state.currentModule = null">&larr; Back to modules</a>
      <div class="contract">
        <h2>{{ state.currentModule.name }}</h2>
        <div class="contract-summary">{{ state.currentModule.summary || 'No description' }}</div>

        <section v-if="state.currentModule.functions?.length">
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
  </div>
</template>

<script>
const SAGAS = [
  {
    name: "checkout",
    modules: ["cart", "orders", "payments", "inventory", "notifications", "fulfillment"],
    steps: [
      { action: "validate_cart(cart_id) — verify items available at quoted prices" },
      { action: "create_order(cart_id, user_id, address) → Order", compensation: "cancel_order" },
      { action: "reserve_inventory(order_id, items[]) → ReservationId", compensation: "release_stock" },
      { action: "initiate_payment(order_id, amount, method) → Payment", compensation: "initiate_refund" },
      { action: "confirm_order(order_id) → Order", compensation: "none (idempotent)" },
      { action: "[async] emit OrderConfirmed → triggers fulfillment, notification, audit_log" },
    ],
    invariants: [
      "Payment must never be captured without a corresponding order record",
      "Inventory must never be deducted for a failed or uncaptured payment",
      "Saga orchestrator holds the idempotency key, not individual steps",
    ],
  },
  {
    name: "refund",
    modules: ["orders", "payments", "inventory", "notifications", "ledger"],
    steps: [
      { action: "validate_refund(order_id, amount, reason)" },
      { action: "create_refund_record(order_id, amount, reason) → RefundRecord" },
      { action: "initiate_refund(payment_id, amount, idempotency_key) → Refund", compensation: "mark as failed" },
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
      { action: "charge_invoice(invoice_id, method) → Payment", compensation: "mark as past_due" },
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
      return new Set(this.state.adapters.map(a => a.module)).size;
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
    goModules() { this.state.view = "modules"; this.state.currentModule = null; this.state.query = ""; },
    goAdapters() { this.state.view = "adapters"; this.state.currentModule = null; },
    goSagas() { this.state.view = "sagas"; this.state.currentModule = null; },
    openModule(m) { this.state.currentModule = m; this.state.view = "contract"; },
    jumpTo(name) {
      const m = this.catalog.modules.find(mm => mm.name === name);
      if (m) this.openModule(m);
    },
  },
};
</script>
