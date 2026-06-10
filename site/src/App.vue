<template>
  <div class="nav">
    <h1><span>blue</span>printer</h1>
    <a :class="{ active: state.view === 'modules' }" @click="state.view = 'modules'; state.query = ''">Modules</a>
    <a :class="{ active: state.view === 'adapters' }" @click="state.view = 'adapters'">Adapters</a>
    <a :class="{ active: state.view === 'sagas' }" @click="state.view = 'sagas'">Sagas</a>
    <a :class="{ active: state.view === 'contract' }" @click="state.view = 'contract'" v-if="state.currentModule">Contract</a>
    <a href="https://github.com/Friehub/blueprint" target="_blank" style="margin-left:auto">GitHub</a>
  </div>

  <div class="main">
    <!-- Module Browser -->
    <template v-if="state.view === 'modules'">
      <div class="stats-row">
        <div class="stat"><div class="num">{{ catalog.modules.length }}</div><div class="label">Modules</div></div>
        <div class="stat"><div class="num">{{ adapterModules }}</div><div class="label">Modules with adapters</div></div>
        <div class="stat"><div class="num">{{ catalog.core.length }}</div><div class="label">Core contracts</div></div>
        <div class="stat"><div class="num">{{ totalFunctions }}</div><div class="label">Total functions</div></div>
      </div>

      <input type="text" v-model="state.query" placeholder="Search modules..." @input="state.query = $event.target.value" />

      <div class="module-grid">
        <div v-for="m in filteredModules" :key="m.name" class="card" @click="openModule(m)">
          <h3>{{ m.name }}</h3>
          <p>{{ m.summary || 'No description' }}</p>
          <div class="count">{{ m.functions?.length || 0 }} functions</div>
        </div>
      </div>
      <p v-if="filteredModules.length === 0" style="color:var(--fog);margin-top:16px">No modules match "{{ state.query }}"</p>
    </template>

    <!-- Adapters -->
    <template v-if="state.view === 'adapters'">
      <h2>Adapters</h2>
      <p style="color:var(--fog);margin-bottom:16px">Available providers per module</p>
      <table class="adapter-table">
        <thead><tr><th>Module</th><th>Adapters</th><th>Languages</th></tr></thead>
        <tbody>
          <tr v-for="g in adapterGroups" :key="g.module">
            <td><strong>{{ g.module }}</strong></td>
            <td>{{ g.adapters.map(a => a.name).join(", ") }}</td>
            <td>
              <span v-for="(langs, aName) in g.langMap" :key="aName">
                <span v-if="langs" class="badge">{{ aName }}: {{ langs.join(", ") }}</span>
              </span>
              <span v-if="!g.hasLangs" style="color:var(--fog);font-size:12px">all</span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Sagas -->
    <template v-if="state.view === 'sagas'">
      <h2>Sagas</h2>
      <p style="color:var(--fog);margin-bottom:16px">Cross-module business flows</p>
      <div class="module-grid">
        <div v-for="s in sagas" :key="s.name" class="card" @click="state.currentSaga = s; state.view = 'saga'">
          <h3>{{ s.name }}</h3>
          <p>{{ s.modules.join(" → ") }}</p>
        </div>
      </div>
    </template>

    <!-- Single Saga -->
    <template v-if="state.view === 'saga' && state.currentSaga">
      <a class="back" @click="state.view = 'sagas'">&larr; Back to sagas</a>
      <div class="contract-view">
        <h2>{{ state.currentSaga.name }}</h2>
        <div class="saga-flow">
          <div v-for="(step, i) in state.currentSaga.steps" :key="i" class="step">
            <div class="idx">{{ i + 1 }}</div>
            <div>
              <strong>{{ step.action }}</strong>
              <span v-if="step.compensation" style="color:var(--fog);margin-left:8px">Comp: {{ step.compensation }}</span>
            </div>
          </div>
        </div>
        <section v-if="state.currentSaga.invariants" style="margin-top:32px">
          <h3>Invariants</h3>
          <ul style="padding-left:20px">
            <li v-for="inv in state.currentSaga.invariants" :key="inv" style="font-size:13px;margin-bottom:6px">{{ inv }}</li>
          </ul>
        </section>
      </div>
    </template>

    <!-- Contract Viewer -->
    <template v-if="state.view === 'contract' && state.currentModule">
      <a class="back" @click="state.view = 'modules'">&larr; Back to modules</a>
      <div class="contract-view">
        <h2>{{ state.currentModule.name }}</h2>
        <div class="summary">{{ state.currentModule.summary }}</div>

        <section v-if="state.currentModule.functions?.length">
          <h3>Functions</h3>
          <div v-for="fn in state.currentModule.functions" :key="fn.name" class="fn">
            <span class="name">{{ fn.name }}</span>(
            <span v-for="(p, i) in fn.params" :key="p.name">
              {{ p.name }}<span v-if="p.type">: {{ p.type }}</span><span v-if="i < fn.params.length - 1">, </span>
            </span>
            ) <span class="ret">&rarr; {{ fn.returns }}</span>
          </div>
        </section>

        <section v-if="state.currentModule.types?.length">
          <h3>Types</h3>
          <div v-for="t in state.currentModule.types" :key="t.name" class="fn">
            <span class="name">{{ t.name }}</span> {{ t.raw }}
          </div>
        </section>

        <section v-if="state.currentModule.invariants?.length">
          <h3>Invariants</h3>
          <ul style="padding-left:20px">
            <li v-for="inv in state.currentModule.invariants" :key="inv" style="font-size:13px;margin-bottom:6px">{{ inv }}</li>
          </ul>
        </section>

        <section v-if="state.currentModule.hardDeps?.length || state.currentModule.softDeps?.length">
          <h3>Dependencies</h3>
          <div class="dep-graph">
            <div class="node root">{{ state.currentModule.name }} (selected)</div>
            <div v-for="dep in state.currentModule.hardDeps" :key="dep" class="node hard" @click="jumpTo(dep)">{{ dep }} (hard)</div>
            <div v-for="dep in state.currentModule.softDeps" :key="dep" class="node soft" @click="jumpTo(dep)">{{ dep }} (soft)</div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script>
const SAGAS = [
  {
    name: "checkout",
    modules: ["cart", "orders", "payments", "inventory", "notifications", "fulfillment"],
    steps: [
      { action: "validate_cart(cart_id) — Verify items available" },
      { action: "create_order(cart_id, user_id, address) → Order" },
      { action: "reserve_inventory(order_id, items[]) → ReservationId", compensation: "releaseStock" },
      { action: "initiate_payment(order_id, amount, method) → Payment", compensation: "initiateRefund" },
      { action: "confirm_order(order_id) → Order", compensation: "none (idempotent)" },
      { action: "[async] emit OrderConfirmed → triggers fulfillment, notification" },
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
      { action: "validate_refund(order_id, amount, reason) — Check policy" },
      { action: "create_refund_record(order_id, amount, reason) → RefundRecord" },
      { action: "initiate_refund(payment_id, amount, idempotency_key) → Refund", compensation: "mark failed" },
      { action: "restore_inventory(order_id, items[]) — Return stock" },
      { action: "update_order_status(order_id, status: returned)" },
      { action: "[async] notify_user(order_id, refund_amount)" },
    ],
  },
  {
    name: "subscription_lifecycle",
    modules: ["billing", "payments", "subscriptions", "notifications"],
    steps: [
      { action: "validate_payment_method(user_id, method) — Check chargeable" },
      { action: "create_subscription(user_id, plan_id) → Subscription", compensation: "cancelSubscription" },
      { action: "create_invoice(subscription_id, plan, period) → Invoice" },
      { action: "charge_invoice(invoice_id, method) → Payment", compensation: "mark past_due" },
      { action: "[async] grant_entitlements(user_id, plan)" },
    ],
  },
  {
    name: "user_offboarding",
    modules: ["users", "billing", "subscriptions", "storage", "right_to_erasure"],
    steps: [
      { action: "initiate_offboarding(user_id, reason) — Lock account", compensation: "reactivateUser" },
      { action: "cancel_active_subscriptions(user_id) → Subscriptions" },
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
      { action: "freeze_funds(payment_id) — Lock disputed amount" },
      { action: "gather_evidence(dispute_id) — Collect transaction logs" },
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
      return new Set((typeof __ADAPTERS__ !== "undefined" ? __ADAPTERS__ : []).map(a => a.module)).size;
    },
    adapterGroups() {
      const adapters = typeof __ADAPTERS__ !== "undefined" ? __ADAPTERS__ : [];
      const groups = {};
      for (const a of adapters) {
        if (!groups[a.module]) groups[a.module] = { module: a.module, adapters: [], langMap: {}, hasLangs: false };
        groups[a.module].adapters.push(a);
        if (a.languages) { groups[a.module].hasLangs = true; groups[a.module].langMap[a.name] = a.languages; }
      }
      return Object.values(groups).sort((a, b) => a.module.localeCompare(b.module));
    },
    sagas() { return SAGAS; },
  },
  methods: {
    openModule(m) { this.state.currentModule = m; this.state.view = "contract"; },
    jumpTo(name) {
      const m = this.catalog.modules.find(mm => mm.name === name);
      if (m) this.openModule(m);
    },
  },

};
</script>
