// Basic shared types that mirror your backend models / API responses.

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  title: string;
  price: number;           // minor units
  currency: string;        // e.g., "USD"
  stock: number;
  isActive: boolean;
  photoUrl?: string | null;
  description?: string | null;
}

export interface PagedProducts {
  items: Product[];
  total: number;
  pages: number;
  page: number;
  perPage: number;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  qty: number;
  product: Product;        // CartService.list should include product relation
}

export interface Cart {
  id: string | null;
  userId: string;
  items: CartItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string;
  title: string;
  price: number;           // minor units
  qty: number;
}

export interface Order {
  id: string;
  userId?: string;
  total: number;
  currency: string;
  status: string;          // pending/confirmed/shipped/delivered/canceled
  paymentMethod?: string;
  paymentStatus?: string;
  externalPaymentRef?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface Profile {
  tgId: string;
  username: string | null;
  name: string | null;
  phone: string | null;

  city: string | null;
  place: string | null;
  specialReference: string | null;
}
