# Module Contract: `localization`

---

### `localization`
Internationalisation and content translation.

**Functions**
```
getTranslation(key, locale, variables?) → string
getTranslations(keys, locale) → Record<string, string>
setTranslation(key, locale, value) → void
listLocales() → Locale[]
getLocale(locale_code) → Locale
detectLocale(accept_language) → string
formatCurrency(amount, currency, locale) → string
formatDate(date, format, locale) → string
formatNumber(number, locale, options?) → string
```

**Types**
```
Locale { code, name, direction: ltr|rtl, number_format, date_format, currency }
```

**Providers:** i18next, custom database, Crowdin, Phrase

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for translation updates where supported.
* **Details:** Duplicate updates must not corrupt the source of truth for a locale key.

### Worker Scaling
* **Policy:** Translation import and formatting workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether localization data is single-region or multi-region replicated.
* **Details:** Locale data must converge deterministically across regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If translation sync is saturated, writes must be deferred or rejected predictably rather than leaving mixed locale state.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Translation cache:
    max_age:           configurable per deployment
    on_expiry:         refresh from source
```

### Storage Model
* **Model:** Durable locale/translation store with cache.
* **Details:** Source translations must be durable; formatted values are derived and not stored as source of truth.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `localization.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — infrastructure primitive / wraps external provider)
* **Emits To:** (none)
* **Recommends:** (none)
