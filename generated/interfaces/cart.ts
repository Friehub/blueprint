// cart.ts
// Auto-generated from contracts/cart.md
// Do not edit manually

export interface Cart {
  id: string;
  items: unknown;
  expiresAt: Timestamp;
}

export interface Cartitem {
  id: string;
  variantId: string;
  quantity: unknown;
  unitPrice: number;
  totalPrice: number;
}

export interface Carttotal {
  subtotal: unknown;
  discount: unknown;
  tax: unknown;
  total: unknown;
  currency: unknown;
}

export interface CartContract {
  getCart(cartId: unknown): Promise<Cart>;
  createCart(userId?: unknown): Promise<Cart>;
  addToCart(cartId: unknown, variantId: unknown, quantity: unknown): Promise<CartItem>;
  updateCartItem(cartId: unknown, itemId: unknown, quantity: unknown): Promise<CartItem>;
  removeCartItem(cartId: unknown, itemId: unknown): Promise<void>;
  clearCart(cartId: unknown): Promise<void>;
  applyCoupon(cartId: unknown, code: unknown): Promise<Cart>;
  removeCoupon(cartId: unknown): Promise<Cart>;
  getCartTotal(cartId: unknown, context?: unknown): Promise<CartTotal>;
  mergeCart(anonymousCartId: unknown, userCartId: unknown): Promise<Cart>;
}
