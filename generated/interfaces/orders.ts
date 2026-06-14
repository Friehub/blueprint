// orders.ts
// Auto-generated from contracts/orders.md
// Do not edit manually

export interface Order {
  id: string;
  userId: string;
  lines: unknown;
  packages: unknown;
  status: unknown;
  total: unknown;
  createdAt: Timestamp;
}

export interface Orderpackage {
  id: string;
  orderId: string;
  sellerId: string;
  lines: unknown;
  status: unknown;
}

export interface Orderline {
  id: string;
  variantId: string;
  quantity: unknown;
  unitPrice: number;
}

export type Orderstatus = OrderStatus = pending | confirmed | processing | shipped | delivered | cancelled | returned;

export type Packagestatus = PackageStatus = pending | packed | shipped | delivered | returned;

export interface Returnrequest {
  id: string;
  orderId: string;
  lines: unknown;
  reason: unknown;
  status: unknown;
}

export interface OrdersContract {
  createOrder(cartId: unknown, userId: unknown, shippingAddress: unknown, paymentMethod: unknown): Promise<Order>;
  getOrder(orderId: unknown): Promise<Order>;
  getOrdersByUser(userId: unknown, options?: unknown): Promise<PaginatedResult<Order>>;
  getSellerOrders(sellerId: unknown, options?: unknown): Promise<PaginatedResult<Order>>;
  getPackagesByOrder(orderId: unknown): Promise<OrderPackage[]>;
  getOrderLinesByPackage(packageId: unknown): Promise<OrderLine[]>;
  transitionOrderStatus(orderId: unknown, status: unknown, metadata?: unknown): Promise<Order>;
  transitionPackageStatus(packageId: unknown, status: unknown, metadata?: unknown): Promise<OrderPackage>;
  cancelOrder(orderId: unknown, reason: unknown): Promise<Order>;
  requestReturn(orderId: unknown, lines: unknown, reason: unknown): Promise<ReturnRequest>;
  approveReturn(returnId: unknown): Promise<ReturnRequest>;
}
