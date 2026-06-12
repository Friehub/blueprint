<template>
  <div class="nav">
    <a class="nav-logo" @click="goHome"><span>blue</span>print</a>
    <a :class="{ active: state.view === 'home' }" @click="goHome">Home</a>
    <a :class="{ active: state.view === 'quickstart' }" @click="goQuickstart">Quick Start</a>
    <a :class="{ active: state.view === 'mcp' }" @click="goMcp">MCP</a>
    <a :class="{ active: state.view === 'architecture' }" @click="goArchitecture">Architecture</a>
    <a :class="{ active: state.view === 'modules' }" @click="goModules">Modules</a>
    <a :class="{ active: state.view === 'adapters' }" @click="goAdapters">Adapters</a>
    <a :class="{ active: state.view === 'sagas' }" @click="goSagas">Sagas</a>
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
        <h2>The Problem</h2>
        <p>Every backend system needs payments, notifications, auth, caching, and queues. These problems recur across every project, yet each team solves them from scratch. An AI agent asked to build a payments feature has no reference for what <strong>initiatePayment</strong> must guarantee, what errors it can throw, or what happens when the provider times out. It guesses. Sometimes it guesses well. Sometimes it reaches for Stripe-specific patterns that break on Paystack. Sometimes it quietly drops error handling because nobody told it the provider can go down.</p>
        <p>A senior engineer knows these things. They have the mental model built from years of building. But they cannot be in every pull request, every code review, every pair programming session. Their knowledge stays in their head.</p>
        <p>Blueprint exists to capture that knowledge in structured files that machines can read reliably and humans can extend predictably.</p>
      </div>

      <div class="home-section">
        <h2>The Solution</h2>
        <p>Blueprint defines the interface for each domain module once: what functions it exposes, what types it uses, what invariants it enforces, what system constraints it operates under, and what other modules it depends on. The same contract works whether you use Stripe, Paystack, or Adyen. The same interface generates code in TypeScript, Python, Go, Rust, and Java.</p>
        <p>The catalog covers 162 modules across the full backend surface: billing, orders, inventory, search, queuing, fraud detection, AI/ML gateways, data pipelines, compliance, real-time collaboration, infrastructure primitives, and more. Each module is a self-contained contract specifying function signatures, data types, behavioural invariants, system-level constraints (consistency, delivery, multi-region), and dependencies on other modules.</p>
        <p>Because every contract follows the same strict structure, the entire catalog can be parsed, validated, and reasoned about programmatically. This enables capabilities that a static collection of markdown files cannot provide:</p>
        <ul class="feature-list">
          <li><strong>Dependency resolution</strong> Selecting <em>billing</em> automatically pulls in <em>payments</em>, <em>users</em>, <em>notifications</em>, <em>audit_log</em>, and <em>usage_metering</em>. The resolver walks the full transitive graph so you know the true cost of every module before you start implementing.</li>
          <li><strong>Multi-language code generation</strong> From a single contract, generators produce typed interfaces, adapter skeletons, and conformance tests in TypeScript, Python, Go, Rust, and Java. The same contract works across your entire stack.</li>
          <li><strong>Provider abstraction</strong> The payments contract is identical whether backed by Stripe, Paystack, or Adyen. Switching providers means changing one line in your adapter selection, not rewriting business logic.</li>
          <li><strong>AI agent integration</strong> The MCP server exposes all 162 modules, their dependencies, database schemas, sagas, and distributed patterns as 12 tools that AI agents can query directly over stdio.</li>
        </ul>
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
          <div class="pipe-step"><strong>4. Generators</strong><span>TypeScript, Python, Go, Rust, Java: interfaces, stubs, conformance tests</span></div>
        </div>
      </div>

      <div class="home-section">
        <h2>Stats</h2>
        <div class="stats">
          <div class="stat"><div class="stat-num">{{ catalog?.modules?.length || 0 }}</div><div class="stat-label">Module contracts</div></div>
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
        <p class="section-sub">From zero to generated code in five steps.</p>

        <div class="qs-step">
          <div class="qs-num">1</div>
          <div>
            <h3>Install the CLI</h3>
            <code class="qs-code">npm install -g @friehub/blueprint</code>
            <p class="qs-text">This installs the <strong>blueprint</strong> command, all 5 code generators, the MCP server, and the adapter registry. The contract catalog is compiled into the package so no separate download is needed.</p>
          </div>
        </div>

        <div class="qs-step">
          <div class="qs-num">2</div>
          <div>
            <h3>Understand modules and their overlap</h3>
            <p class="qs-text">Modules are not isolated islands. Most modules depend on others. When you select <strong>billing</strong>, you also get <strong>payments</strong>, <strong>users</strong>, <strong>notifications</strong>, <strong>audit_log</strong>, and <strong>usage_metering</strong> the resolver walks the full transitive graph automatically. This is not a limitation; it is the point. A billing system that does not notify users or log changes is incomplete.</p>
            <p class="qs-text">The dependency graph reveals overlaps before you write code. If two modules share a dependency, that component needs to exist once and be shared. If a module's dependency chain is too expensive for what it provides, you know before committing to implementation. The resolver makes these trade-offs visible, not hidden.</p>
            <p class="qs-text">To see the full cost of a module:</p>
            <code class="qs-code">blueprint resolve --modules billing</code>
            <code class="qs-code">blueprint graph billing</code>
            <p class="qs-text">The first command lists every module that billing requires. The second draws a visual tree showing hard dependencies (required) and soft dependencies (recommended).</p>
          </div>
        </div>

        <div class="qs-step">
          <div class="qs-num">3</div>
          <div>
            <h3>Select adapters</h3>
            <p class="qs-text">Each module can be backed by different providers. The payments contract is the same whether you use Stripe, Paystack, or Adyen. Select the providers for your project:</p>
            <code class="qs-code">blueprint adapters add stripe payments</code>
            <code class="qs-code">blueprint adapters add redis caching</code>
            <code class="qs-code">blueprint adapters add bullmq queues</code>
            <p class="qs-text">The adapter selection is stored in <strong>blueprint.json</strong>. Every adapter declares which contract functions it implements and which it does not. CI validates that no function is left uncovered accidentally.</p>
          </div>
        </div>

        <div class="qs-step">
          <div class="qs-num">4</div>
          <div>
            <h3>Generate code</h3>
            <p class="qs-text">Each generator produces three artefacts per module: a typed interface (what you code against), an adapter skeleton (wired to the real SDK with TODO stubs), and a conformance test (proves the adapter satisfies the contract).</p>
            <code class="qs-code">blueprint generate --lang typescript</code>
            <code class="qs-code">blueprint generate --lang python --module payments</code>
            <code class="qs-code">blueprint generate --lang go --namespace acme</code>
            <h4 style="margin-top:12px;font-size:14px;font-weight:600">Name protection flags</h4>
            <p class="qs-text"><strong>--namespace &lt;name&gt;</strong> prefixes all generated class, interface, and file names with your project name. Without it, generated code uses generic names like <em>PaymentsContract</em> and <em>StripeAdapter</em>. With <strong>--namespace acme</strong>, the same code uses <em>Acme_PaymentsContract</em> and <em>Acme_StripeAdapter</em>, and all files are placed under an <em>Acme/</em> directory. This prevents generic name scanning and avoids collisions when multiple Blueprint projects coexist.</p>
            <p class="qs-text"><strong>--aliases &lt;file.json5&gt;</strong> replaces contract names entirely with project-specific names from a JSON5 alias file. Unlike <strong>--namespace</strong> which only prefixes, aliases can rename functions, modules, classes, and config fields to anything you choose. For example, <em>initiatePayment</em> can become <em>chargeCustomer</em>, <em>payments</em> can become <em>billing</em>, and <em>StripeAdapter</em> can become <em>CardProcessor</em> all from one alias file. The alias file supports comments and is never committed to version control.</p>
            <p class="qs-text"><strong>--obfuscate &lt;seed&gt;</strong> replaces every name with a deterministic short hash derived from a secret seed. The same seed always produces the same names, so builds are reproducible. Different seeds produce completely different names. The original contract name cannot be recovered without the seed. This is the strongest protection it makes generated code impossible to fingerprint, at the cost of debuggability since function names become opaque strings like <em>fn_a1b2c3d4</em>. The seed must be stored in your secrets manager and injected at CI time, never committed.</p>
            <p class="qs-text">All three flags work together. The order of application is: aliases are resolved first, then namespace is prepended. Obfuscation bypasses aliases entirely when set.</p>
          </div>
        </div>

        <div class="qs-step">
          <div class="qs-num">5</div>
          <div>
            <h3>Verify and iterate</h3>
            <p class="qs-text">Check that your implementation satisfies the contract:</p>
            <code class="qs-code">blueprint verify ./src/payments/stripe.ts --module payments</code>
            <p class="qs-text">Verification checks that every contract function is implemented, return types match, and nothing required is missing. If you use aliases or obfuscation, pass the same flags to verify for accurate reverse-mapping.</p>
          </div>
        </div>
      </div>
    </template>

    <!-- MCP SERVER -->
    <template v-if="state.view === 'mcp'">
      <div class="main">
        <h2 class="section-title">MCP Server</h2>
        <p class="section-sub">The Blueprint MCP server gives AI agents direct access to the full contract catalog over stdio. Compatible with Claude Desktop, Cursor, Copilot, and any MCP-compatible tool.</p>

        <div class="mcp-section">
          <h3>Setup</h3>
          <p>Add this to your Claude Desktop, Cursor, or Copilot configuration:</p>
          <code class="qs-code">{
  "mcpServers": {
    "blueprint": {
      "command": "npx",
      "args": ["engineering-blueprint", "mcp"]
    }
  }
}</code>
          <p>Or start it manually:</p>
          <code class="qs-code">blueprint mcp</code>
          <p style="color:var(--fog);font-size:13px;margin-top:4px">The server binds to localhost via stdio by default. If exposed beyond localhost, token-based authentication must be configured.</p>
        </div>

        <div class="mcp-section">
          <h3>12 Tools</h3>
          <p>Once connected, your AI agent has access to these tools:</p>
          <table class="mcp-table">
            <thead><tr><th>Tool</th><th>What it gives the agent</th></tr></thead>
            <tbody>
              <tr><td class="mcp-tool">list_modules</td><td>All 162 modules with function counts and dependency lists</td></tr>
              <tr><td class="mcp-tool">get_module</td><td>Full contract for one module: functions, types, invariants, constraints</td></tr>
              <tr><td class="mcp-tool">search_modules</td><td>Find modules by name, summary, or function name</td></tr>
              <tr><td class="mcp-tool">resolve_deps</td><td>Transitive dependency resolution: every module required by a set</td></tr>
              <tr><td class="mcp-tool">list_adapters</td><td>Available providers for a module, optionally filtered by language</td></tr>
              <tr><td class="mcp-tool">get_adapter</td><td>Adapter details including required config fields and secret keys</td></tr>
              <tr><td class="mcp-tool">get_dependency_graph</td><td>Hard deps, soft deps, reverse deps for a module</td></tr>
              <tr><td class="mcp-tool">get_database_schema</td><td>Canonical DDL for a module (PostgreSQL, MySQL, MongoDB, SQLite)</td></tr>
              <tr><td class="mcp-tool">get_saga</td><td>Full saga specification: steps, compensation, failure modes</td></tr>
              <tr><td class="mcp-tool">get_distributed_patterns</td><td>Recommended patterns: saga, outbox, idempotency table, optimistic locking</td></tr>
              <tr><td class="mcp-tool">validate_implementation</td><td>Check a code description against contract invariants; returns violations</td></tr>
              <tr><td class="mcp-tool">suggest_modules</td><td>Given a plain-English description, suggest modules + implementation order</td></tr>
            </tbody>
          </table>
        </div>

        <div class="mcp-section">
          <h3>What the agent can do</h3>
          <p>An AI agent with access to the Blueprint MCP server can:</p>
          <ul class="feature-list">
            <li><strong>Design a system</strong> "I need a checkout flow with fraud detection" calls <em>suggest_modules</em> to get the module list, <em>resolve_deps</em> to understand the dependency graph, <em>get_saga</em> to see the checkout flow, and <em>list_adapters</em> to find available providers.</li>
            <li><strong>Implement a module</strong> "Implement payments with Stripe" calls <em>get_module</em> to read the full contract, <em>get_adapter</em> to get Stripe-specific config, and <em>get_database_schema</em> for the DDL.</li>
            <li><strong>Validate an implementation</strong> "Check my payments code" calls <em>validate_implementation</em> with a code summary and receives a list of invariant violations to fix.</li>
            <li><strong>Understand a flow</strong> "What happens during checkout?" calls <em>get_saga</em> to walk through every step, compensation, and failure mode.</li>
          </ul>
        </div>
      </div>
    </template>

    <!-- ARCHITECTURE -->
    <template v-if="state.view === 'architecture'">
      <div class="main arch-page">
        <h2 class="section-title">Architecture</h2>
        <p class="section-sub">Reference architecture for Blueprint-generated backends</p>

        <section>
          <h3>Three-Layer Security Boundary</h3>
          <p>Every Blueprint-generated backend should implement security at three distinct layers. Each layer has a specific responsibility and must not be bypassed by the layers above it.</p>
          <div class="arch-layers">
            <div class="arch-layer">
              <div class="arch-layer-num">1</div>
              <div class="arch-layer-body">
                <strong>Perimeter</strong> — <em>ip_blocklist, rate_limiting, bot_protection</em>
                <p>Rejects requests from known-bad IPs, enforces per-IP and per-origin rate limits, applies bot scoring before any authentication runs. Must be stateless, reading from a fast cache (Redis), making binary allow/deny decisions in under 2ms.</p>
              </div>
            </div>
            <div class="arch-layer">
              <div class="arch-layer-num">2</div>
              <div class="arch-layer-body">
                <strong>Identity</strong> — <em>auth, sessions, api_keys</em>
                <p>Validates credentials, checks session revocation and anomaly state, attaches caller identity to request context. All failures return identical errors with identical timing. No information leakage about which check failed.</p>
              </div>
            </div>
            <div class="arch-layer">
              <div class="arch-layer-num">3</div>
              <div class="arch-layer-body">
                <strong>Authorization</strong> — <em>permissions</em>
                <p>Checks <code>can()</code> before any business logic executes. Explicit deny returns immediately. Missing grant returns denied. Only explicit allow proceeds. Enforced at the function level, not the route level.</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3>Event Flow</h3>
          <p>Modules emit events to a central event bus. Each module publishes to its own topic namespace (<code>auth.*</code>, <code>payments.*</code>, etc.). Consumers subscribe to specific topics. The event envelope from <code>global_standards.md</code> is the contract between producers and consumers.</p>
          <p><strong>Rule:</strong> No consumer may call the producing module's functions in response to an event. This prevents circular dependencies at runtime.</p>
          <p><strong>Deduplication:</strong> Events use at-least-once delivery. The event <code>id</code> field is the deduplication key. Consumers track processed IDs in a <code>processed_event_ids</code> set in Redis with a TTL equal to the maximum delivery delay.</p>
        </section>

        <section>
          <h3>Saga Orchestration</h3>
          <p>Each saga type runs as a dedicated orchestrator process. The orchestrator maintains saga state in a durable store. Each step is an idempotent function call protected by an idempotency key derived from the saga ID and step number.</p>
          <p><strong>Compensation:</strong> Every step with side effects must have a corresponding compensation function defined. If a step fails, the orchestrator retries with the same idempotency key until it succeeds or the retry limit is exhausted. When retries are exhausted, the orchestrator runs compensation functions in reverse order.</p>
        </section>

        <section>
          <h3>Multi-Tenant Isolation</h3>
          <p>Two acceptable models with documented tradeoffs.</p>
          <div class="arch-compare">
            <div class="arch-card">
              <h4>Schema-per-Tenant</h4>
              <p>Each tenant gets their own database schema. Cross-tenant data leakage is prevented at the database level. Schema migrations must be applied to all tenant schemas simultaneously. Appropriate for high-compliance deployments where isolation guarantees must be auditable.</p>
            </div>
            <div class="arch-card">
              <h4>Row-Level Security</h4>
              <p>Single shared schema with a <code>tenant_id</code> column on every tenant-scoped table. PostgreSQL RLS policies automatically scope every query to the current tenant. Application code must set the tenant context before each query. Operationally simpler but requires correct application-layer enforcement.</p>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- DESIGN TOOL -->
    <template v-if="state.view === 'design'">
      <div class="design-root">
        <div class="design-sidebar">
          <h4>Add Modules</h4>
          <input type="text" v-model="designQuery" class="ds-search" placeholder="Search modules..." />
          <div class="ds-list">
            <div v-for="m in designAvailable" :key="m.name" class="ds-item" @click="addToDesign(m)" :class="{ added: isOnCanvas(m.name) }">
              <span class="ds-item-name">{{ m.name }}</span>
              <span class="ds-item-summary">{{ m.summary || '' }}</span>
              <span class="ds-fncount">{{ m.transitiveCount }} transitive</span>
            </div>
            <div v-if="designAvailable.length === 0" class="ds-empty-list">No modules match</div>
          </div>
        </div>
        <div class="design-canvas-wrap" ref="canvasWrap" @mousedown="onCanvasMouseDown" @mousemove="onCanvasMouseMove" @mouseup="onCanvasMouseUp" @mouseleave="onCanvasMouseUp">
          <div class="design-canvas" :style="{ transform: 'translate(' + canvasPan.x + 'px, ' + canvasPan.y + 'px)' }">
            <svg class="design-lines" v-if="designConnections.length">
              <line v-for="(c, i) in designConnections" :key="i" :x1="c.x1" :y1="c.y1" :x2="c.x2" :y2="c.y2" class="ds-line" :class="{ hard: c.type==='hard', soft: c.type==='soft' }" />
            </svg>
            <div v-for="dm in designModules" :key="dm.name" class="ds-card" :class="{ selected: designSelected === dm.name, auto: dm.auto }" :style="{ left: dm.x + 'px', top: dm.y + 'px' }" @mousedown.stop="onCardMouseDown($event, dm)" @click.stop="designSelected = dm.name">
              <button class="ds-remove" @click.stop="removeFromDesign(dm.name)">x</button>
              <span class="ds-card-name">{{ dm.name }}</span>
              <span v-if="dm.auto" class="ds-card-auto">auto-resolved</span>
              <span class="ds-card-fn">{{ dm.fnCount }} functions</span>
            </div>
            <div v-if="!designModules.length" class="ds-empty">Click modules from the sidebar to add them here</div>
          </div>
        </div>
        <div class="design-info">
          <template v-if="designSelected && designSelectedModule">
            <h4>{{ designSelected }}</h4>
            <p class="ds-summary">{{ designSelectedModule.summary || 'No description' }}</p>
            <p class="ds-label">Hard deps: <span v-if="designSelectedModule.hardDeps?.length">{{ designSelectedModule.hardDeps.join(', ') }}</span><span v-else>none</span></p>
            <p class="ds-label">Soft deps: <span v-if="designSelectedModule.softDeps?.length">{{ designSelectedModule.softDeps.join(', ') }}</span><span v-else>none</span></p>
            <p class="ds-label">Functions: {{ designSelectedModule.functions?.length || 0 }}</p>
            <div v-if="designModuleAdapters.length" class="ds-adapters">
              <p class="ds-label" style="margin-top:10px">Available adapters:</p>
              <span v-for="a in designModuleAdapters" :key="a.name" class="ds-adapter-badge" :class="{ selected: designAdapter === a.name }" @click="designAdapter = a.name">{{ a.name }}</span>
            </div>
            <p v-if="designAdapter && designSelected" class="ds-label" style="margin-top:8px">Selected: <strong>{{ designAdapter }}</strong></p>
          </template>
          <template v-else>
            <p class="ds-label" v-if="designModules.length">Click a module to inspect it</p>
            <p class="ds-label" v-else>No modules on canvas</p>
          </template>
          <div class="ds-stats" v-if="designModules.length">
            <p>Modules: {{ designModules.length }} ({{ designModules.filter(d => d.auto).length }} auto-resolved)</p>
            <p>Hard connections: {{ designConnections.filter(c => c.type==='hard').length }}</p>
            <p>Topology: {{ designTopology }}</p>
          </div>
          <button class="ds-export" @click="exportDesign">Generate Implementation Prompt</button>
        </div>
      </div>
    </template>

    <!-- MODULES -->
    <template v-if="state.view === 'modules'">
      <div class="main">
        <h2 class="section-title">Modules</h2>
        <p class="section-sub">Browse all {{ catalog?.modules?.length || 0 }} contracts. Click any module to see its functions, types, invariants, and dependencies.</p>

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

        <section v-if="currentEntities.length">
          <h3>Entities</h3>
          <div v-for="ent in currentEntities" :key="ent.entity" class="ent-block">
            <div class="ent-header">{{ ent.entity }}</div>
            <div class="ent-fields">
              <div v-for="f in ent.fields" :key="f.name" class="ent-field">
                <span class="ent-field-name">{{ f.name }}</span>
                <span class="ent-field-type">{{ f.type }}</span>
                <span v-if="f.primaryKey" class="ent-badge pk">PK</span>
                <span v-if="f.foreignKey" class="ent-badge fk">FK&rarr;{{ f.refEntity }}</span>
                <span v-if="f.optional" class="ent-badge opt">optional</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3>Dependencies</h3>
          <div class="dep-tree">
            <div v-for="node in depTree" :key="node.name + node.depth" class="dep-row" :style="{ paddingLeft: (node.depth * 20 + 8) + 'px' }" @click="jumpTo(node.name)">
              <span v-if="node.hasChildren" class="dep-toggle" @click.stop="toggleDep(node.key)">{{ node.open ? '▾' : '▸' }}</span>
              <span v-else class="dep-toggle" style="visibility:hidden">▸</span>
              <span class="dep-name">{{ node.name }}</span>
              <span v-if="node.depth === 0" class="dep-badge root-badge">selected</span>
              <span v-else class="dep-badge" :class="{ 'dep-hard': node.type === 'hard' }">{{ node.type }}</span>
            </div>
          </div>
          <p v-if="!state.currentModule.hardDeps?.length && !state.currentModule.softDeps?.length" style="color:var(--fog);font-size:13px;margin-top:8px">No dependencies</p>
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
      { action: "validate_cart(cart_id) verify items available" },
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
      { action: "initiate_offboarding(user_id, reason) lock account", compensation: "reactivate_user" },
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
  data() { return { adaptersData: [], depOpen: {}, designQuery: "", designModules: [], designSelected: null, designAdapter: null, canvasPan: { x: 0, y: 0 }, dragCard: null, dragOffs: { x: 0, y: 0 }, panning: false, panStart: { x: 0, y: 0 } }; },
  computed: {
    catalog() { return this.state?.catalog || { modules: [], core: [] }; },
    filteredModules() {
      try {
        const cat = this.state?.catalog;
        if (!cat?.modules) return [];
        const q = (this.state.query || "").toLowerCase();
        return cat.modules.filter(m =>
          m?.name?.toLowerCase().includes(q) ||
          (m?.summary || "").toLowerCase().includes(q) ||
          (m?.functions || []).some(f => f?.name?.toLowerCase().includes(q))
        );
      } catch { return []; }
    },
    totalFunctions() {
      const cat = this.catalog;
      if (!cat?.modules) return 0;
      return cat.modules.reduce((s, m) => s + (m.functions?.length || 0), 0);
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
    depTree() { /* ... existing depTree code stays the same ... */
      try {
        const m = this.state?.currentModule;
        const cat = this.state?.catalog;
        if (!m || !cat?.modules) return [];
        const result = [];
        const visited = new Set();
        const walk = (name, depth, type) => {
          if (visited.has(name)) return;
          visited.add(name);
          const key = name + depth;
          const mod = cat.modules.find(mm => mm.name === name);
          if (!mod) return;
          const hard = (mod.hardDeps || []).filter(d => d && !visited.has(d));
          const soft = (mod.softDeps || []).filter(d => d && !visited.has(d));
          const children = [...hard.map(d => ({ name: d, type: 'hard' })), ...soft.map(d => ({ name: d, type: 'soft' }))];
          result.push({ name, depth, type, key, hasChildren: children.length > 0, open: this.depOpen?.[key] !== false });
          if (this.depOpen?.[key] !== false) { for (const c of children) if (c?.name) walk(c.name, depth + 1, c.type); }
        };
        walk(m.name, 0, 'hard');
        return result;
      } catch (e) { return []; }
    },
    designAvailable() {
      const q = (this.designQuery || '').toLowerCase();
      const cat = this.state.catalog;
      if (!cat?.modules) return [];
      return cat.modules.filter(m => m.name.toLowerCase().includes(q) || (m.summary || '').toLowerCase().includes(q)).map(m => {
        const mod = cat.modules.find(mm => mm.name === m.name);
        const vis = new Set(); const walk = (n) => { if (vis.has(n)) return; vis.add(n); const mm = cat.modules.find(x => x.name === n); if (mm) for (const d of mm.hardDeps || []) walk(d); };
        walk(m.name);
        return { ...m, transitiveCount: vis.size - 1 };
      }).slice(0, 100);
    },
    designSelectedModule() { if (!this.designSelected) return null; return this.state.catalog?.modules?.find(m => m.name === this.designSelected); },
    designConnections() {
      const lines = []; const placed = new Set(this.designModules.map(d => d.name));
      for (const dm of this.designModules) {
        const mod = this.state.catalog?.modules?.find(m => m.name === dm.name); if (!mod) continue;
        (mod.hardDeps || []).forEach(dep => {
          if (placed.has(dep)) { const target = this.designModules.find(d => d.name === dep); if (target) lines.push({ x1: dm.x + 90, y1: dm.y + 20, x2: target.x + 90, y2: target.y + 20, type: 'hard' }); }
        });
        (mod.softDeps || []).forEach(dep => {
          if (placed.has(dep)) { const target = this.designModules.find(d => d.name === dep); if (target) lines.push({ x1: dm.x + 90, y1: dm.y + 20, x2: target.x + 90, y2: target.y + 20, type: 'soft' }); }
        });
      } return lines;
    },
    designTopology() {
      const n = this.designModules.length; if (n === 0) return '';
      const depCount = this.designConnections.length;
      if (n <= 5) return 'Monolith'; if (n <= 15 && depCount <= 20) return 'Modular Monolith'; if (depCount > 20) return 'Microservices'; return 'Modular Monolith';
    },
    designModuleAdapters() {
      if (!this.designSelected) return [];
      return this.state.adapters.filter(a => a.module === this.designSelected);
    },
    currentEntities() {
      if (!this.state.currentModule) return [];
      return (this.state.entities || []).filter(e => e.module === this.state.currentModule.name);
    },
  },
  methods: {
    toggleDep(key) { this.depOpen[key] = this.depOpen[key] === false ? true : false; this.$forceUpdate(); },
    goHome() { window.scrollTo(0,0); this.state.view = "home"; this.state.currentModule = null; },
    goModules() { window.scrollTo(0,0); this.state.view = "modules"; this.state.currentModule = null; this.state.query = ""; },
    goAdapters() { window.scrollTo(0,0); this.state.view = "adapters"; this.state.currentModule = null; },
    goSagas() { window.scrollTo(0,0); this.state.view = "sagas"; this.state.currentModule = null; },
    goQuickstart() { window.scrollTo(0,0); this.state.view = "quickstart"; this.state.currentModule = null; },
    goMcp() { window.scrollTo(0,0); this.state.view = "mcp"; this.state.currentModule = null; },
    goArchitecture() { window.scrollTo(0,0); this.state.view = "architecture"; this.state.currentModule = null; },
    goDesign() { window.scrollTo(0,0); this.state.view = "design"; this.state.currentModule = null; },
    addToDesign(m) {
      if (!m) return;
      const cat = this.state.catalog;
      if (!cat?.modules) return;
      const placed = new Set(this.designModules.map(d => d.name));
      const manuallyAdded = m.name;
      const queue = [m.name];
      const allNames = new Set();
      const depthMap = { [m.name]: 0 };

      while (queue.length) {
        const name = queue.shift();
        if (allNames.has(name)) continue;
        allNames.add(name);
        const mod = cat.modules.find(mm => mm.name === name);
        if (!mod) continue;
        for (const dep of mod.hardDeps || []) {
          if (!allNames.has(dep)) { queue.push(dep); depthMap[dep] = (depthMap[name] || 0) + 1; }
        }
      }

      const byDepth = {};
      for (const name of allNames) { const d = depthMap[name] || 0; if (!byDepth[d]) byDepth[d] = []; byDepth[d].push(name); }
      const maxDepth = Math.max(...Object.keys(byDepth).map(Number));
      for (let d = 0; d <= maxDepth; d++) {
        const names = byDepth[d] || [];
        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          if (placed.has(name)) continue;
          placed.add(name);
          this.designModules.push({
            name, x: 40 + i * 200, y: 40 + d * 90,
            fnCount: cat.modules.find(mm => mm.name === name)?.functions?.length || 0,
            auto: name !== manuallyAdded,
          });
        }
      }
      this.designSelected = m.name;
      this.designAdapter = null;
    },
    removeFromDesign(name) {
      this.designModules = this.designModules.filter(d => d.name !== name);
      if (this.designSelected === name) { this.designSelected = null; this.designAdapter = null; }
    },
    isOnCanvas(name) { return !!this.designModules.find(d => d.name === name); },
    onCardMouseDown(e, dm) {
      this.dragCard = dm;
      this.dragOffs = { x: e.clientX - dm.x, y: e.clientY - dm.y };
    },
    onCanvasMouseDown(e) {
      if (e.target.closest('.ds-card')) return;
      this.panning = true;
      this.panStart = { x: e.clientX - this.canvasPan.x, y: e.clientY - this.canvasPan.y };
    },
    onCanvasMouseMove(e) {
      if (this.dragCard) {
        this.dragCard.x = e.clientX - this.dragOffs.x;
        this.dragCard.y = e.clientY - this.dragOffs.y;
      } else if (this.panning) {
        this.canvasPan = { x: e.clientX - this.panStart.x, y: e.clientY - this.panStart.y };
      }
    },
    onCanvasMouseUp() { this.dragCard = null; this.panning = false; },
    exportDesign() {
      const names = this.designModules.map(d => d.name);
      const lines = [
        "# Blueprint Design Export",
        "",
        "## Modules",
        ...names.map(n => `- ${n}`),
        "",
        "## Topology",
        this.designTopology,
        "",
        "## Adapters",
      ];
      const adapterLines = [];
      for (const dm of this.designModules) {
        const adps = this.state.adapters.filter(a => a.module === dm.name);
        if (adps.length) adapterLines.push(`- ${dm.name}: ${adps.map(a => a.name).join(', ')}`);
      }
      lines.push(...(adapterLines.length ? adapterLines : ['(none selected)']));
      lines.push("", "## Prompt for AI Agent");
      lines.push(`Design a ${this.designTopology.toLowerCase()} system with these modules: ${names.join(', ')}.`);
      if (adapterLines.length) lines.push(`Use these providers: ${this.state.adapters.filter(a => names.includes(a.module)).map(a => a.name).join(', ')}.`);
      lines.push("Generate the full implementation with interfaces, types, and adapter stubs.");
      navigator.clipboard.writeText(lines.join('\n')).then(() => alert('Prompt copied to clipboard!')).catch(() => alert(lines.join('\n')));
    },
    openModule(m) { window.scrollTo(0,0); this.state.currentModule = m; this.state.view = "contract"; },
    jumpTo(name) {
      const cat = this.catalog;
      if (!cat?.modules) return;
      const m = cat.modules.find(mm => mm.name === name);
      if (m) this.openModule(m);
    },
  },
  mounted() {
    this.adaptersData = this.state.adapters;
  },
};
</script>
