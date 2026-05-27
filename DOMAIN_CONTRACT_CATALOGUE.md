# Domain Contract Catalogue
## A Provider-Agnostic Interface Specification for AI-Assisted Backend Development

---

## What This Is

Every backend system ever built is an assembly of the same recurring domain problems. The database changes. The provider changes. The language changes. The domain problems do not.

A notification system for a fintech startup and a notification system for a healthcare platform both need `sendEmail`, `sendSMS`, `getNotificationHistory`, and `updatePreferences`. The implementations differ. The interface does not.

This catalogue formally defines those interfaces -- function signatures, type shapes, and error contracts -- for every recurring backend domain problem. Each definition is:

- **Provider-agnostic** -- the contract does not name Stripe, Twilio, or S3
- **Language-portable** -- the contract transpiles to TypeScript types, Rust traits, Python protocols, Go interfaces
- **AI-consumable** -- an agent given the contract cannot invent a wrong interface
- **Versioned** -- contracts change with semver discipline; adapters declare which version they implement

The boundary rule for inclusion: a module belongs in this catalogue if and only if it represents a domain problem that recurs across at least three different application types and whose interface is stable across provider implementations. Infrastructure configuration (how you deploy, how you scale) does not belong here. Domain operations (what your system does) do.

---

## How to Read Each Module

Each module lists:
- **Functions** -- the operations the module exposes
- **Types** -- the data structures the module owns
- **Invariants** -- behavioral constraints an implementation must satisfy
- **Providers** -- examples of things an adapter might wrap (not exhaustive)

---

## Part I -- Identity and Access

### `auth`
Authentication -- who you are.

**Functions**
```
signUp(email, password, metadata?) → Session
signIn(email, password) → Session
signInWithProvider(provider, token) → Session
signOut(session_token) → void
refreshToken(refresh_token) → Session
verifyToken(token) → TokenClaims
requestPasswordReset(email) → void
confirmPasswordReset(token, new_password) → void
verifyEmail(token) → void
resendVerification(email) → void
```

**Types**
```
Session { access_token, refresh_token, expires_at, user_id }
TokenClaims { user_id, email, roles, expires_at, issued_at }
AuthProvider = email | google | github | apple | microsoft | phone
```

**Invariants**
- `signIn` must not return a Session for unverified accounts when verification is required
- `refreshToken` must reject expired or revoked refresh tokens
- `requestPasswordReset` must not reveal whether an email exists in the system

**Providers:** Supabase Auth, Auth0, Clerk, Firebase Auth, custom JWT

---

### `users`
User identity and profile management.

**Functions**
```
getUser(user_id) → User
getUserByEmail(email) → User?
createUser(data) → User
updateUser(user_id, data) → User
deleteUser(user_id) → void
searchUsers(query, options?) → PaginatedResult<User>
getUsersByRole(role) → User[]
assignRole(user_id, role) → void
revokeRole(user_id, role) → void
getUserRoles(user_id) → Role[]
banUser(user_id, reason) → void
unbanUser(user_id) → void
```

**Types**
```
User { id, email, name, avatar_url?, roles, status, created_at, metadata }
Role { id, name, permissions }
UserStatus = active | banned | suspended | pending_verification
```

**Invariants**
- `deleteUser` must not physically delete -- it must mark the record as deleted and anonymise PII
- `getUserByEmail` must be case-insensitive

**Providers:** any user table, Clerk, Auth0 Management API

---

### `permissions`
Fine-grained access control.

**Functions**
```
can(user_id, action, resource) → boolean
canAll(user_id, actions, resource) → boolean
canAny(user_id, actions, resource) → boolean
grantPermission(user_id, action, resource) → void
revokePermission(user_id, action, resource) → void
getPermissions(user_id) → Permission[]
createRole(name, permissions) → Role
assignRole(user_id, role_id) → void
```

**Types**
```
Permission { action, resource, conditions? }
Role { id, name, permissions }
AccessDecision = allowed | denied
```

**Invariants**
- `can` must be deterministic for the same inputs at the same instant
- Role inheritance must be acyclic

**Providers:** Casbin, custom RBAC, AWS IAM, OPA

---

### `sessions`
Session lifecycle management separate from auth tokens.

**Functions**
```
createSession(user_id, device_info?) → Session
getSession(session_id) → Session?
getSessions(user_id) → Session[]
revokeSession(session_id) → void
revokeAllSessions(user_id) → void
extendSession(session_id) → Session
```

**Types**
```
Session { id, user_id, device, ip_address?, created_at, last_active_at, expires_at }
```

**Invariants**
- Revoked sessions must not be reactivated
- `getSessions` must return active sessions only unless `include_revoked: true` is passed

**Providers:** Redis, database, JWT stores

---

### `api_keys`
Programmatic access credentials.

**Functions**
```
createApiKey(user_id, name, scopes, expires_at?) → ApiKey
getApiKey(key_id) → ApiKey
listApiKeys(user_id) → ApiKey[]
revokeApiKey(key_id) → void
validateApiKey(raw_key) → ApiKeyValidation
rotateApiKey(key_id) → ApiKey
```

**Types**
```
ApiKey { id, user_id, name, prefix, scopes, last_used_at?, expires_at?, created_at }
ApiKeyValidation { valid, user_id?, scopes?, reason? }
```

**Invariants**
- The raw key must only be returned at creation time, never again
- `validateApiKey` must update `last_used_at` without blocking the response

---

## Part II -- Communication

### `notifications`
Multi-channel message delivery.

**Functions**
```
sendEmail(to, template_id, variables, options?) → DeliveryResult
sendSMS(to, body, options?) → DeliveryResult
sendPush(user_id, title, body, data?) → DeliveryResult
sendInApp(user_id, notification) → Notification
getNotifications(user_id, options?) → PaginatedResult<Notification>
markRead(notification_id) → void
markAllRead(user_id) → void
getUnreadCount(user_id) → number
updatePreferences(user_id, preferences) → NotificationPreferences
getPreferences(user_id) → NotificationPreferences
```

**Types**
```
Notification { id, user_id, title, body, data?, read, created_at }
DeliveryResult { message_id, status, provider_reference }
NotificationChannel = email | sms | push | in_app
NotificationPreferences { channels: Record<NotificationChannel, boolean>, quiet_hours? }
DeliveryStatus = queued | sent | delivered | failed | bounced
```

**Invariants**
- `sendEmail` must respect `NotificationPreferences` -- if email is disabled, it must not deliver
- `sendPush` must not throw if the user has no registered push tokens -- it must return a no-op result

**Providers:** Resend/SendGrid (email), Twilio/Termii (SMS), FCM/APNs (push)

---

### `messaging`
Threaded conversation between users or entities.

**Functions**
```
createThread(participants, metadata?) → Thread
getThread(thread_id) → Thread
getThreads(user_id, options?) → PaginatedResult<Thread>
sendMessage(thread_id, sender_id, content) → Message
getMessages(thread_id, options?) → PaginatedResult<Message>
editMessage(message_id, content) → Message
deleteMessage(message_id) → void
markRead(thread_id, user_id) → void
getUnreadCount(user_id) → number
addParticipant(thread_id, user_id) → void
removeParticipant(thread_id, user_id) → void
```

**Types**
```
Thread { id, participants, last_message?, unread_count, created_at }
Message { id, thread_id, sender_id, content, edited, deleted, created_at }
MessageContent { type: text | image | file | system, body, attachments? }
```

**Invariants**
- Deleted messages must show a tombstone, not disappear -- the thread history must remain intact
- A user cannot send a message to a thread they are not a participant of

**Providers:** custom database, Stream Chat, Sendbird

---

### `emails`
Transactional email with template management.

**Functions**
```
sendTransactional(to, template_id, variables, options?) → DeliveryResult
sendBulk(recipients, template_id, variables) → BulkDeliveryResult
createTemplate(name, subject, html, text?) → EmailTemplate
updateTemplate(template_id, data) → EmailTemplate
getTemplate(template_id) → EmailTemplate
listTemplates() → EmailTemplate[]
getDeliveryStatus(message_id) → DeliveryStatus
getDeliveryEvents(message_id) → DeliveryEvent[]
```

**Types**
```
EmailTemplate { id, name, subject, html, text?, variables: string[] }
DeliveryEvent { type: sent|delivered|opened|clicked|bounced|complained, timestamp }
```

**Providers:** Resend, SendGrid, Mailgun, Postmark, AWS SES

---

### `sms`
Programmatic SMS delivery.

**Functions**
```
send(to, body, sender_id?, options?) → DeliveryResult
sendBulk(recipients, body) → BulkDeliveryResult
getDeliveryStatus(message_id) → DeliveryStatus
getBalance() → SMSBalance
lookupNumber(phone) → NumberLookup
```

**Types**
```
SMSBalance { amount, currency, units }
NumberLookup { valid, carrier?, country_code, line_type: mobile | landline | voip }
```

**Providers:** Twilio, Termii, Africa's Talking, Vonage

---

### `webhooks`
Outbound event delivery to external endpoints.

**Functions**
```
registerEndpoint(url, events, secret, metadata?) → WebhookEndpoint
updateEndpoint(endpoint_id, data) → WebhookEndpoint
removeEndpoint(endpoint_id) → void
listEndpoints(owner_id) → WebhookEndpoint[]
dispatchEvent(event_type, payload, owner_id) → void
retryDelivery(delivery_id) → WebhookDelivery
getDeliveries(endpoint_id, options?) → PaginatedResult<WebhookDelivery>
getDelivery(delivery_id) → WebhookDelivery
```

**Types**
```
WebhookEndpoint { id, url, events, status, created_at }
WebhookDelivery { id, endpoint_id, event_type, payload, status, attempts, next_retry_at? }
WebhookStatus = active | disabled | failing
DeliveryStatus = pending | success | failed
```

**Invariants**
- Failed deliveries must be retried with exponential backoff up to a configurable maximum
- Payloads must be signed with the endpoint secret using HMAC-SHA256

**Providers:** custom implementation, Svix, Hookdeck

---

## Part III -- Data and State

### `storage`
File and object storage.

**Functions**
```
uploadFile(bucket, key, content, options?) → FileObject
downloadFile(bucket, key) → FileStream
deleteFile(bucket, key) → void
getSignedUrl(bucket, key, expires_in) → SignedUrl
getSignedUploadUrl(bucket, key, options?) → SignedUrl
listFiles(bucket, prefix?, options?) → PaginatedResult<FileObject>
moveFile(source_bucket, source_key, dest_bucket, dest_key) → FileObject
copyFile(source_bucket, source_key, dest_bucket, dest_key) → FileObject
getMetadata(bucket, key) → FileMetadata
```

**Types**
```
FileObject { key, bucket, size, content_type, url, created_at, metadata? }
FileMetadata { size, content_type, last_modified, etag, custom }
SignedUrl { url, expires_at, method: GET | PUT }
```

**Invariants**
- Signed upload URLs must enforce `content_type` and `max_size` constraints when provided
- `deleteFile` must be idempotent -- deleting a non-existent key must not throw

**Providers:** AWS S3, Cloudflare R2, Supabase Storage, MinIO, local disk

---

### `caching`
Key-value caching with TTL and tag-based invalidation.

**Functions**
```
get<T>(key) → T?
set<T>(key, value, options?) → void
del(key) → void
getOrSet<T>(key, factory, options?) → T
invalidateByTag(tag) → void
invalidateByPrefix(prefix) → void
mget<T>(keys) → Record<string, T?>
mset(entries, options?) → void
increment(key, by?) → number
decrement(key, by?) → number
```

**Types**
```
CacheOptions { ttl?, tags?, compress? }
CacheStats { hits, misses, keys, memory_used }
```

**Invariants**
- `getOrSet` must be atomic -- concurrent calls with the same key must not invoke `factory` more than once (cache stampede prevention)

**Providers:** Redis, Memcached, Upstash, in-memory (node-cache)

---

### `search`
Full-text and faceted search across documents.

**Functions**
```
indexDocument(index, id, document) → void
indexBulk(index, documents) → BulkIndexResult
removeDocument(index, id) → void
search(index, query, options?) → SearchResult
suggest(index, partial, field, options?) → Suggestion[]
reindex(index) → ReindexJob
getIndexStats(index) → IndexStats
createIndex(name, config) → Index
deleteIndex(name) → void
```

**Types**
```
SearchResult { hits: Hit[], total, facets?, took_ms }
Hit { id, document, score, highlights? }
SearchOptions { filters?, facets?, sort?, page?, per_page?, geo? }
IndexStats { document_count, index_size, last_updated }
```

**Invariants**
- `indexDocument` must be idempotent -- re-indexing the same document must update, not duplicate

**Providers:** Typesense, Algolia, Meilisearch, Elasticsearch, PostgreSQL full-text

---

### `queues`
Async job processing and task scheduling.

**Functions**
```
enqueue(queue_name, payload, options?) → Job
enqueueBulk(queue_name, payloads) → Job[]
scheduleJob(queue_name, payload, run_at) → Job
cancelJob(job_id) → void
getJob(job_id) → Job
getJobStatus(job_id) → JobStatus
retryJob(job_id) → Job
getQueueStats(queue_name) → QueueStats
purgeQueue(queue_name) → void
```

**Types**
```
Job { id, queue_name, payload, status, attempts, max_attempts, run_at, completed_at? }
JobStatus = waiting | active | completed | failed | cancelled | delayed
QueueStats { waiting, active, completed, failed, delayed }
JobOptions { delay?, priority?, max_attempts?, backoff? }
```

**Invariants**
- A failed job must not be lost -- it must transition to `failed` state with the error recorded
- `cancelJob` on an active job must be a best-effort operation, not a guarantee

**Providers:** BullMQ, Inngest, Quirrel, AWS SQS, Sidekiq

---

### `feature_flags`
Runtime feature control and progressive rollout.

**Functions**
```
isEnabled(flag_key, user_id?, context?) → boolean
getVariant(flag_key, user_id?, context?) → Variant
setFlag(flag_key, enabled, rules?) → Flag
archiveFlag(flag_key) → void
listFlags() → Flag[]
getFlag(flag_key) → Flag
rolloutToPercent(flag_key, percentage) → Flag
evaluateAll(user_id, context?) → Record<string, boolean>
```

**Types**
```
Flag { key, enabled, rollout_percentage?, rules?, variants? }
Variant { key, value, weight }
RolloutRule { attribute, operator, value, percentage }
```

**Invariants**
- Flag evaluation must be consistent for the same `(flag_key, user_id)` pair within a request
- Archived flags must always return `false` without error

**Providers:** LaunchDarkly, Unleash, Flagsmith, Growthbook, custom database

---

### `rate_limiting`
Request throttling and quota enforcement.

**Functions**
```
checkLimit(key, limit, window) → RateLimitResult
consumeToken(key, limit, window, cost?) → RateLimitResult
resetLimit(key) → void
getLimitStatus(key) → LimitStatus
setCustomLimit(key, limit, window) → void
```

**Types**
```
RateLimitResult { allowed, remaining, reset_at, retry_after? }
LimitStatus { current, limit, window, reset_at }
LimitWindow = second | minute | hour | day
```

**Invariants**
- `checkLimit` must not consume a token -- it must be a read-only check
- Limits must be enforced atomically -- race conditions must not allow over-consumption

**Providers:** Redis (sliding window, token bucket), Upstash, custom

---

### `audit_log`
Immutable record of system events for compliance and debugging.

**Functions**
```
recordEvent(event) → AuditEvent
queryEvents(filters, options?) → PaginatedResult<AuditEvent>
getEventsByActor(actor_id, options?) → PaginatedResult<AuditEvent>
getEventsByResource(resource_type, resource_id) → AuditEvent[]
exportAuditLog(filters, format) → ExportJob
getEvent(event_id) → AuditEvent
```

**Types**
```
AuditEvent { id, actor, action, resource, changes?, ip_address?, metadata, created_at }
AuditActor { type: user | system | api_key, id, name? }
AuditResource { type, id, name? }
ExportFormat = json | csv
```

**Invariants**
- Audit events must never be deleted or modified after creation
- `recordEvent` must be non-blocking -- it must not add latency to the calling operation

**Providers:** custom append-only table, Axiom, Datadog, custom event stream

---

## Part IV -- Commerce

### `catalog`
Product and variant management.

**Functions**
```
getProduct(product_id) → Product
getProducts(ids) → Product[]
searchProducts(query, options?) → PaginatedResult<Product>
createProduct(data) → Product
updateProduct(product_id, data) → Product
archiveProduct(product_id) → void
getVariant(variant_id) → Variant
getVariantsByProduct(product_id) → Variant[]
createVariant(product_id, data) → Variant
updateVariant(variant_id, data) → Variant
getPricing(variant_id, context?) → Price
```

**Types**
```
Product { id, name, description, images, status, variants, metadata }
Variant { id, product_id, sku, options, price, compare_at_price?, weight? }
Price { amount, currency, compare_at?, tax_inclusive }
ProductStatus = active | draft | archived
```

**Providers:** custom database, Medusa, Shopify API, Saleor

---

### `inventory`
Stock tracking with reservation lifecycle.

**Functions**
```
getStockLevel(variant_id, location_id?) → StockLevel
getStockLevels(variant_ids) → StockLevel[]
reserveStock(variant_id, quantity, order_id) → StockReservation
releaseStock(reservation_token) → void
confirmStock(reservation_token) → void
updateStockOnHand(variant_id, quantity, location_id?) → void
adjustStock(variant_id, delta, reason) → StockAdjustment
getStockHistory(variant_id) → StockAdjustment[]
getLowStockAlerts(threshold?) → StockLevel[]
```

**Types**
```
StockLevel { variant_id, on_hand, reserved, available, location_id? }
StockReservation { token, variant_id, quantity, expires_at }
ReservationToken = string (opaque)
StockAdjustment { id, variant_id, delta, reason, created_at }
```

**Invariants**
- `available = on_hand - reserved` at all times
- `confirmStock` must be idempotent -- confirming twice must not double-decrement
- Reservations must expire automatically if not confirmed

---

### `cart`
Session-based shopping cart.

**Functions**
```
getCart(cart_id) → Cart
createCart(user_id?) → Cart
addToCart(cart_id, variant_id, quantity) → CartItem
updateCartItem(cart_id, item_id, quantity) → CartItem
removeCartItem(cart_id, item_id) → void
clearCart(cart_id) → void
applyCoupon(cart_id, code) → Cart
removeCoupon(cart_id) → Cart
getCartTotal(cart_id, context?) → CartTotal
mergeCart(anonymous_cart_id, user_cart_id) → Cart
```

**Types**
```
Cart { id, user_id?, items, coupon?, expires_at }
CartItem { id, variant_id, quantity, unit_price, total_price }
CartTotal { subtotal, discount, tax, shipping?, total, currency }
```

**Invariants**
- Adding an item that already exists must increment quantity, not create a duplicate
- `getCartTotal` must reflect current prices, not prices at time of add-to-cart

---

### `promotions`
Discount and promotion engine.

**Functions**
```
validateCoupon(code, cart_id, user_id?) → CouponValidation
markCouponUsed(code, order_id, user_id) → void
getActiveFlashSales() → FlashSale[]
getFlashSaleForVariant(variant_id) → FlashSale?
applyPromotionToCart(cart_id, promotion_id) → Cart
getEligiblePromotions(cart_id, user_id?) → Promotion[]
createPromotion(data) → Promotion
archivePromotion(promotion_id) → void
```

**Types**
```
Promotion { id, type, value, conditions, start_at, end_at, usage_limit? }
Coupon { code, promotion_id, used_count, usage_limit? }
FlashSale { variant_id, sale_price, start_at, end_at, stock_limit? }
CouponValidation { valid, discount_amount?, reason? }
PromotionType = percentage | fixed_amount | free_shipping | buy_x_get_y
```

**Invariants**
- `validateCoupon` must not mark the coupon as used -- that is `markCouponUsed`'s job
- `markCouponUsed` must be idempotent for the same `(code, order_id)` pair

---

### `orders`
Order lifecycle management.

**Functions**
```
createOrder(cart_id, user_id, shipping_address, payment_method) → Order
getOrder(order_id) → Order
getOrdersByUser(user_id, options?) → PaginatedResult<Order>
getSellerOrders(seller_id, options?) → PaginatedResult<Order>
getPackagesByOrder(order_id) → OrderPackage[]
getOrderLinesByPackage(package_id) → OrderLine[]
transitionOrderStatus(order_id, status, metadata?) → Order
transitionPackageStatus(package_id, status, metadata?) → OrderPackage
cancelOrder(order_id, reason) → Order
requestReturn(order_id, lines, reason) → ReturnRequest
approveReturn(return_id) → ReturnRequest
```

**Types**
```
Order { id, user_id, lines, packages, status, total, created_at }
OrderPackage { id, order_id, seller_id, lines, status, tracking_number? }
OrderLine { id, variant_id, quantity, unit_price }
OrderStatus = pending | confirmed | processing | shipped | delivered | cancelled | returned
PackageStatus = pending | packed | shipped | delivered | returned
ReturnRequest { id, order_id, lines, reason, status }
```

**Invariants**
- Status transitions must follow the defined state machine -- invalid transitions must throw
- A cancelled order must release all stock reservations

---

### `payments`
Payment processing and wallet management.

**Functions**
```
initiatePayment(order_id, amount, currency, method) → Payment
verifyPayment(payment_id) → Payment
getPaymentByOrder(order_id) → Payment?
getWallet(user_id) → Wallet
creditWallet(user_id, amount, currency, reference) → WalletTransaction
debitWallet(user_id, amount, currency, reference) → WalletTransaction
getWalletTransactions(user_id, options?) → PaginatedResult<WalletTransaction>
initiateRefund(payment_id, amount?, reason) → Refund
getRefundByOrder(order_id) → Refund?
getRefund(refund_id) → Refund
```

**Types**
```
Payment { id, order_id, amount, currency, status, method, provider_reference, created_at }
Wallet { user_id, balance, currency, locked_balance }
WalletTransaction { id, type: credit|debit, amount, balance_after, reference, created_at }
Refund { id, payment_id, amount, status, reason, created_at }
PaymentMethod = card | bank_transfer | wallet | ussd | qr_code
PaymentStatus = pending | processing | completed | failed | refunded | disputed
```

**Invariants**
- `creditWallet` with the same `reference` must be idempotent -- double-crediting must not occur
- `debitWallet` must not reduce balance below zero unless `allow_negative: true` is explicitly passed

---

### `shipping`
Shipment creation and tracking.

**Functions**
```
getRates(origin, destination, parcels) → ShippingRate[]
createShipment(order_id, rate_id, parcels) → Shipment
getShipment(shipment_id) → Shipment
trackShipment(tracking_number, carrier?) → TrackingResult
cancelShipment(shipment_id) → void
createLabel(shipment_id) → ShippingLabel
getLabel(shipment_id) → ShippingLabel
validateAddress(address) → AddressValidation
```

**Types**
```
ShippingRate { carrier, service, price, currency, estimated_days }
Shipment { id, order_id, carrier, tracking_number, status, label_url? }
TrackingResult { status, events: TrackingEvent[], estimated_delivery? }
TrackingEvent { status, location, timestamp, description }
ShippingLabel { url, format: pdf|png, expires_at }
AddressValidation { valid, normalized_address?, suggestions? }
```

**Providers:** EasyPost, Shippo, DHL API, custom last-mile carriers

---

### `reviews`
Product and seller review system.

**Functions**
```
createReview(reviewer_id, subject_type, subject_id, rating, content) → Review
getReview(review_id) → Review
getReviews(subject_type, subject_id, options?) → PaginatedResult<Review>
getAggregateRating(subject_type, subject_id) → AggregateRating
updateReview(review_id, data) → Review
deleteReview(review_id) → void
moderateReview(review_id, decision, reason?) → Review
flagReview(review_id, reason) → void
getUserReviews(user_id) → PaginatedResult<Review>
```

**Types**
```
Review { id, reviewer_id, subject_type, subject_id, rating, content, status, created_at }
AggregateRating { average, count, distribution: Record<1|2|3|4|5, number> }
ReviewStatus = pending | published | rejected | flagged
ReviewSubjectType = product | seller | service
```

---

## Part V -- Real-Time and Social

### `presence`
Online/offline state tracking.

**Functions**
```
setOnline(user_id, channel?, metadata?) → void
setOffline(user_id, channel?) → void
getPresence(user_id) → PresenceState
getPresenceMultiple(user_ids) → Record<string, PresenceState>
subscribeToPresence(user_id, callback) → Unsubscribe
setCustomStatus(user_id, status) → void
```

**Types**
```
PresenceState { user_id, online, last_seen_at, channel?, custom_status? }
Unsubscribe = () => void
```

**Invariants**
- A user who disconnects without calling `setOffline` must eventually be marked offline via TTL

**Providers:** Redis Pub/Sub, Ably, Pusher, Supabase Realtime

---

### `events` (pubsub)
Internal event bus for decoupled module communication.

**Functions**
```
publish(topic, event) → void
subscribe(topic, handler) → Subscription
unsubscribe(subscription_id) → void
publishBulk(topic, events) → void
getTopics() → string[]
replay(topic, from, to, handler) → void
```

**Types**
```
Event<T> { id, topic, payload: T, timestamp, version }
Subscription { id, topic, handler }
```

**Invariants**
- `subscribe` must receive all events published after subscription, not before (unless `replay` is used)
- Event IDs must be globally unique and monotonically increasing within a topic

**Providers:** Redis Pub/Sub, Kafka, NATS, AWS EventBridge, in-process

---

### `posts`
User-generated content publishing.

**Functions**
```
createPost(author_id, content, options?) → Post
getPost(post_id) → Post
updatePost(post_id, content) → Post
deletePost(post_id) → void
getFeed(user_id, options?) → PaginatedResult<FeedItem>
getPostsByUser(user_id, options?) → PaginatedResult<Post>
pinPost(post_id) → void
unpinPost(post_id) → void
moderatePost(post_id, decision, reason?) → Post
```

**Types**
```
Post { id, author_id, content, media?, status, pinned, created_at, metadata }
PostContent { text?, media?: Media[], links?: string[] }
FeedItem { post, engagement_score, reason? }
PostStatus = published | draft | archived | removed
PostVisibility = public | followers | private
```

---

### `comments`
Threaded comment system on any entity.

**Functions**
```
createComment(author_id, subject_type, subject_id, content, parent_id?) → Comment
getComment(comment_id) → Comment
getComments(subject_type, subject_id, options?) → PaginatedResult<Comment>
getReplies(comment_id, options?) → PaginatedResult<Comment>
updateComment(comment_id, content) → Comment
deleteComment(comment_id) → void
moderateComment(comment_id, decision) → Comment
getCommentCount(subject_type, subject_id) → number
```

**Types**
```
Comment { id, author_id, subject_type, subject_id, parent_id?, content, status, created_at }
CommentStatus = published | deleted | moderated
```

**Invariants**
- Deleted comments must show a tombstone in thread context
- Nesting depth must be enforceable via configuration

---

### `reactions`
Emoji/like reactions on any entity.

**Functions**
```
addReaction(user_id, subject_type, subject_id, type) → Reaction
removeReaction(user_id, subject_type, subject_id, type) → void
getReactions(subject_type, subject_id) → ReactionSummary
getUserReaction(user_id, subject_type, subject_id) → Reaction?
getTopReacted(subject_type, options?) → ReactionLeaderboard
```

**Types**
```
Reaction { user_id, subject_type, subject_id, type, created_at }
ReactionSummary { total, by_type: Record<ReactionType, number>, user_reaction? }
ReactionType = like | love | laugh | angry | sad | fire | clap (configurable)
```

**Invariants**
- A user can have at most one reaction of each type per subject
- `addReaction` must be upsert -- calling it twice must not create a duplicate

---

### `follows`
Directed follow relationships between entities.

**Functions**
```
follow(follower_id, followee_id) → FollowRelation
unfollow(follower_id, followee_id) → void
isFollowing(follower_id, followee_id) → boolean
getFollowers(user_id, options?) → PaginatedResult<User>
getFollowing(user_id, options?) → PaginatedResult<User>
getFollowCounts(user_id) → FollowCounts
getMutualFollowers(user_id_a, user_id_b) → User[]
```

**Types**
```
FollowRelation { follower_id, followee_id, created_at }
FollowCounts { followers, following }
```

**Invariants**
- `follow` must be idempotent -- following twice must not create a duplicate relation
- Self-follows must be rejected

---

## Part VI -- Platform Operations

### `billing`
Subscription and plan management.

**Functions**
```
createSubscription(user_id, plan_id, payment_method) → Subscription
getSubscription(user_id) → Subscription?
upgradeSubscription(user_id, plan_id) → Subscription
downgradeSubscription(user_id, plan_id, at_period_end?) → Subscription
cancelSubscription(user_id, at_period_end?) → Subscription
reactivateSubscription(user_id) → Subscription
getInvoices(user_id, options?) → PaginatedResult<Invoice>
getInvoice(invoice_id) → Invoice
getPlans() → Plan[]
getPlan(plan_id) → Plan
```

**Types**
```
Subscription { id, user_id, plan_id, status, current_period_start, current_period_end, cancel_at? }
Plan { id, name, price, currency, interval, features, limits }
Invoice { id, user_id, amount, currency, status, line_items, due_at, paid_at? }
SubscriptionStatus = active | trialing | past_due | cancelled | paused
```

**Providers:** Stripe, Paddle, Lemonsqueezy, custom

---

### `usage_metering`
Track and enforce resource consumption quotas.

**Functions**
```
recordUsage(user_id, metric, quantity, timestamp?) → UsageRecord
getUsageSummary(user_id, metric, period) → UsageSummary
checkQuota(user_id, metric) → QuotaCheck
getOverage(user_id, metric, period) → Overage?
setQuota(user_id, metric, limit) → void
resetUsage(user_id, metric) → void
getUsageHistory(user_id, metric, options?) → PaginatedResult<UsageRecord>
```

**Types**
```
UsageRecord { id, user_id, metric, quantity, timestamp }
UsageSummary { metric, total, limit, period_start, period_end }
QuotaCheck { allowed, used, limit, remaining }
Overage { amount, metric, period }
```

**Invariants**
- `recordUsage` must be eventually consistent but `checkQuota` must reflect all committed records

---

### `tenants`
Multi-tenancy management for SaaS products.

**Functions**
```
createTenant(name, owner_id, plan_id?) → Tenant
getTenant(tenant_id) → Tenant
getTenantBySlug(slug) → Tenant?
updateTenant(tenant_id, data) → Tenant
suspendTenant(tenant_id, reason) → Tenant
reactivateTenant(tenant_id) → Tenant
deleteTenant(tenant_id) → void
getTenantMembers(tenant_id) → TenantMember[]
inviteMember(tenant_id, email, role) → TenantInvite
removeMember(tenant_id, user_id) → void
getTenantConfig(tenant_id) → TenantConfig
updateTenantConfig(tenant_id, config) → TenantConfig
```

**Types**
```
Tenant { id, name, slug, plan_id, status, owner_id, created_at }
TenantMember { user_id, tenant_id, role, joined_at }
TenantInvite { id, email, role, expires_at, accepted }
TenantConfig { settings: Record<string, unknown>, feature_flags, limits }
TenantStatus = active | suspended | deleted
```

---

### `analytics`
Event tracking and behavioral analytics.

**Functions**
```
trackEvent(event_name, user_id?, properties?, context?) → void
identifyUser(user_id, traits) → void
trackPageView(user_id?, url, properties?) → void
getMetrics(metric, period, filters?) → MetricResult
getFunnel(steps, period, filters?) → FunnelResult
getCohort(definition, period) → CohortResult
getRetention(cohort_start, periods) → RetentionResult
```

**Types**
```
AnalyticsEvent { name, user_id?, properties, context, timestamp }
MetricResult { value, previous_value?, change_percent?, series: DataPoint[] }
FunnelResult { steps: FunnelStep[], conversion_rate }
FunnelStep { name, count, conversion_rate }
DataPoint { timestamp, value }
```

**Invariants**
- `trackEvent` must never throw -- analytics must not cause application errors
- Events must be buffered and sent asynchronously

**Providers:** PostHog, Mixpanel, Amplitude, custom ClickHouse

---

### `media`
Image and video processing pipeline.

**Functions**
```
uploadMedia(file, options?) → MediaAsset
processMedia(asset_id, transformations) → ProcessingJob
getMediaAsset(asset_id) → MediaAsset
getVariants(asset_id) → MediaVariant[]
deleteMediaAsset(asset_id) → void
generateThumbnail(asset_id, options?) → MediaVariant
transcodeVideo(asset_id, format, options?) → ProcessingJob
getProcessingJob(job_id) → ProcessingJob
```

**Types**
```
MediaAsset { id, type: image|video|audio|document, url, size, metadata, created_at }
MediaVariant { id, asset_id, transformation, url, size }
ProcessingJob { id, asset_id, status, result_url?, created_at }
Transformation { width?, height?, format?, quality?, crop? }
```

**Providers:** Cloudinary, AWS MediaConvert + S3, Uploadcare, imgix

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

### `consent`
Privacy consent and GDPR compliance.

**Functions**
```
recordConsent(user_id, purposes, version) → ConsentRecord
getConsent(user_id) → ConsentRecord?
withdrawConsent(user_id, purposes?) → void
hasConsented(user_id, purpose) → boolean
getConsentHistory(user_id) → ConsentRecord[]
exportUserData(user_id) → DataExportJob
deleteUserData(user_id) → DataDeletionJob
getJob(job_id) → ExportOrDeletionJob
```

**Types**
```
ConsentRecord { user_id, purposes: ConsentPurpose[], version, created_at }
ConsentPurpose = analytics | marketing | personalisation | functional
DataExportJob { id, user_id, status, download_url?, expires_at? }
DataDeletionJob { id, user_id, status, completed_at? }
```

**Invariants**
- Consent must be recorded with the policy version at time of consent
- `withdrawConsent` must trigger cascading effects in analytics and marketing modules

---

### `health`
Application health checks and status reporting.

**Functions**
```
check(service?) → HealthReport
checkAll() → HealthReport
registerCheck(name, check_fn, options?) → void
getStatus() → SystemStatus
getHistory(service, options?) → HealthEvent[]
```

**Types**
```
HealthReport { status, checks: Record<string, CheckResult>, timestamp }
CheckResult { status: healthy|degraded|unhealthy, message?, latency_ms? }
SystemStatus = operational | degraded | partial_outage | major_outage
HealthEvent { service, status, message, timestamp }
```

---

## Part VII -- Security and Compliance

### `encryption`
Data encryption and key management.

**Functions**
```
encrypt(data, key_id?) → EncryptedData
decrypt(encrypted_data) → string
generateKey(algorithm?) → Key
rotateKey(key_id) → Key
listKeys() → Key[]
archiveKey(key_id) → void
hashPassword(password) → string
verifyPassword(password, hash) → boolean
generateSecret(length?) → string
```

**Types**
```
EncryptedData { ciphertext, key_id, algorithm, iv }
Key { id, algorithm, status, created_at, rotated_at? }
KeyStatus = active | archived | compromised
```

**Invariants**
- `decrypt` must use the `key_id` embedded in `EncryptedData` -- key rotation must not break old data
- `hashPassword` must use a memory-hard algorithm (Argon2, bcrypt, scrypt)

**Providers:** AWS KMS, HashiCorp Vault, libsodium, custom

---

### `fraud_detection`
Risk scoring for transactions and user actions.

**Functions**
```
scoreTransaction(transaction, context) → RiskScore
scoreSignUp(data, context) → RiskScore
scoreLogin(user_id, context) → RiskScore
reportFraud(transaction_id, reason) → FraudReport
blockEntity(entity_type, entity_id, reason) → void
unblockEntity(entity_type, entity_id) → void
isBlocked(entity_type, entity_id) → boolean
getRiskHistory(entity_type, entity_id) → RiskScore[]
```

**Types**
```
RiskScore { score, level: low|medium|high|critical, signals, recommendation: allow|review|block }
FraudReport { id, entity_type, entity_id, reason, reporter_id, created_at }
RiskContext { ip_address, device_fingerprint?, geo?, user_agent? }
```

**Providers:** Sift, Sardine, custom ML, rules engine

---

### `ip_intelligence`
IP-based geolocation, VPN detection, and threat assessment.

**Functions**
```
lookup(ip_address) → IpIntelligence
isVpn(ip_address) → boolean
isTor(ip_address) → boolean
isDatacenter(ip_address) → boolean
getGeolocation(ip_address) → Geolocation
getThreatScore(ip_address) → ThreatScore
```

**Types**
```
IpIntelligence { ip, geo, vpn, tor, datacenter, threat_score, isp }
Geolocation { country, region, city, latitude, longitude, timezone }
ThreatScore { score, level, signals }
```

**Providers:** MaxMind, IPinfo, IP2Location

---

## Part VIII -- Industry Verticals

### `appointments` (Healthcare, Services)
Booking and scheduling management.

**Functions**
```
getAvailability(provider_id, date_range) → Slot[]
bookAppointment(patient_id, provider_id, slot_id, data) → Appointment
getAppointment(appointment_id) → Appointment
getAppointmentsByUser(user_id, options?) → PaginatedResult<Appointment>
cancelAppointment(appointment_id, reason) → Appointment
rescheduleAppointment(appointment_id, slot_id) → Appointment
confirmAppointment(appointment_id) → Appointment
getWaitlist(provider_id, service_id) → WaitlistEntry[]
joinWaitlist(user_id, provider_id, service_id) → WaitlistEntry
```

**Types**
```
Slot { id, provider_id, start_at, end_at, available, service_id }
Appointment { id, patient_id, provider_id, slot, status, notes?, created_at }
AppointmentStatus = requested | confirmed | completed | cancelled | no_show
WaitlistEntry { id, user_id, position, estimated_wait? }
```

---

### `kyc` (Fintech, Regulated Industries)
Know Your Customer identity verification.

**Functions**
```
submitVerification(user_id, documents, data) → VerificationRequest
getVerification(request_id) → VerificationRequest
getUserVerification(user_id) → VerificationRequest?
getVerificationStatus(user_id) → VerificationStatus
updateVerification(request_id, data) → VerificationRequest
rejectVerification(request_id, reason) → VerificationRequest
approveVerification(request_id) → VerificationRequest
listPendingVerifications(options?) → PaginatedResult<VerificationRequest>
```

**Types**
```
VerificationRequest { id, user_id, status, documents, submitted_at, reviewed_at? }
VerificationStatus = not_started | pending | approved | rejected | expired
DocumentType = passport | national_id | drivers_license | utility_bill | selfie
```

**Providers:** Smile ID, Onfido, Jumio, Sumsub

---

### `loyalty` (Retail, Hospitality)
Points, rewards, and loyalty tier management.

**Functions**
```
getBalance(user_id) → LoyaltyBalance
earnPoints(user_id, amount, reason, reference) → LoyaltyTransaction
redeemPoints(user_id, amount, reference) → LoyaltyTransaction
getTransactions(user_id, options?) → PaginatedResult<LoyaltyTransaction>
getTier(user_id) → LoyaltyTier
calculateTierProgress(user_id) → TierProgress
getRewards(tier?) → Reward[]
redeemReward(user_id, reward_id) → RewardRedemption
```

**Types**
```
LoyaltyBalance { user_id, points, lifetime_points, tier, expiring_soon? }
LoyaltyTier { name, minimum_points, multiplier, benefits }
LoyaltyTransaction { id, type: earn|redeem|expire|adjust, amount, balance_after, reference }
TierProgress { current_tier, next_tier?, points_needed? }
```

---

### `subscriptions` (Media, SaaS, Content)
Access entitlement and content gating separate from billing.

**Functions**
```
getEntitlements(user_id) → Entitlement[]
hasAccess(user_id, resource_id) → boolean
grantEntitlement(user_id, entitlement_type, expires_at?) → Entitlement
revokeEntitlement(user_id, entitlement_type) → void
getAccessHistory(user_id, resource_id) → AccessEvent[]
```

**Types**
```
Entitlement { user_id, type, granted_at, expires_at?, source: plan|gift|trial|purchase }
AccessEvent { user_id, resource_id, granted, reason, timestamp }
```

---

### `donations` (Non-profit, Crowdfunding)
Charitable giving and campaign management.

**Functions**
```
createCampaign(data) → Campaign
getCampaign(campaign_id) → Campaign
listCampaigns(filters?) → PaginatedResult<Campaign>
donate(campaign_id, donor_id, amount, currency, method) → Donation
getDonation(donation_id) → Donation
getDonationsByCampaign(campaign_id, options?) → PaginatedResult<Donation>
getCampaignStats(campaign_id) → CampaignStats
issueCertificate(donation_id) → Certificate
```

**Types**
```
Campaign { id, title, goal, currency, raised, status, end_at }
Donation { id, campaign_id, donor_id?, amount, currency, anonymous, created_at }
CampaignStats { raised, donor_count, goal, percentage_funded }
```

---

## The Boundary

The catalogue stops at the domain operation layer. A module belongs here if it satisfies four conditions simultaneously:

**It is a named domain problem** -- `payments`, not `database transactions`. The name describes what it does for the business, not how it does it technically.

**It recurs across at least three different application types** -- `notifications` appears in e-commerce, healthcare, social, SaaS, and fintech. `donations` appears in non-profit, crowdfunding, and community platforms. `kyc` appears in fintech, hiring platforms, and regulated marketplaces.

**Its interface is stable across providers** -- `sendEmail` takes the same inputs whether the provider is Resend, SendGrid, or Mailgun. `initiatePayment` takes the same inputs whether the adapter wraps Stripe or Paystack.

**It cannot be trivially derived from a CRUD operation on a single table** -- `getUser` is not in this catalogue because it is just a database read. `transitionOrderStatus` is in this catalogue because it enforces a state machine with business rules.

What is excluded: infrastructure configuration, deployment, database schema design, ORM setup, HTTP routing, middleware, and anything that is framework-specific. The catalogue defines what your system does. How it runs is out of scope.

---

## Connection to AI Reliability

Each module in this catalogue represents a fixed interface. When an AI agent is given the contract for `payments` before generating an adapter, three things change:

The function names are fixed. The AI cannot invent `processPayment` or `makePayment` -- the contract says `initiatePayment`.

The type shapes are fixed. The AI cannot return `{ success: true, data: ... }` -- the contract says `Payment`.

The invariants are enforceable. The AI's implementation can be checked by GenSense's CSA rules against the contract it claims to fulfill. A `validateCoupon` implementation that cannot return an invalid state violates the contract and is caught automatically.

The reliability gain is not that AI becomes smarter. It is that the creative surface collapses from designing and implementing an interface to only implementing one. That is a fundamentally smaller and more reliable task.

---

*Version 0.1 -- Domain Contract Catalogue*
*This document is the specification. Adapters, language bindings, and tooling are separate artifacts.*
