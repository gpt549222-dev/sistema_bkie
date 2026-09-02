export type OfferType = 'percentage' | 'fixed_discount' | 'special_price';
export type OfferStatus = 'scheduled' | 'active' | 'paused' | 'finished';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  category_id: string | null;
  category?: Category | null;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  name: string;
  description: string | null;
  type: OfferType;
  value: number;
  priority: number;
  start_date: string;
  end_date: string;
  status: OfferStatus;
  is_global: boolean;
  product_ids?: string[];
  category_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface PriceCalculation {
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercentage: number;
  appliedOffer: Offer | null;
}

export interface Customer {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  identification_number: string | null;
  created_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod =
  | 'efectivo'
  | 'pago_movil'
  | 'binance'
  | 'punto_venta'
  | 'transferencia';

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  original_unit_price: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  client_request_id?: string | null;
  customer_id: string | null;
  user_id?: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_address: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  history?: OrderStatusHistory[];
  payments?: Payment[];
}

export type InvoiceStatus = 'issued' | 'paid' | 'cancelled';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  original_unit_price: number;
  unit_price: number;
  discount_amount: number;
  total: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_id_doc: string | null;
  customer_phone: string;
  customer_address: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  items?: InvoiceItem[];
}

export interface Sale {
  id: string;
  sale_number: string;
  order_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  customer_name: string;
  total_amount: number;
  payment_method: PaymentMethod;
  cashier_name: string;
  created_at: string;
  invoice?: Invoice | null;
}

export type NotificationType =
  | 'new_order'
  | 'order_accepted'
  | 'order_preparing'
  | 'order_ready'
  | 'order_shipped'
  | 'order_delivered'
  | 'payment_received'
  | 'invoice_created'
  | 'low_stock'
  | 'offer_created';

export interface AppNotification {
  id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  order_id: string | null;
  invoice_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type InventoryMovementType =
  | 'sale'
  | 'refund'
  | 'purchase'
  | 'adjustment'
  | 'loss'
  | 'correction';

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name?: string;
  type: InventoryMovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  order_id: string | null;
  note: string | null;
  created_at: string;
}

export interface CashShift {
  id: string;
  opened_by: string;
  opened_at: string;
  closed_at: string | null;
  initial_amount: number;
  final_amount: number | null;
  total_sales: number;
  status: 'open' | 'closed';
  notes: string | null;
}

export interface CashMovement {
  id: string;
  cash_register_id: string | null;
  type: 'sale_in' | 'deposit' | 'withdrawal' | 'refund_out';
  amount: number;
  description: string;
  payment_id: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface BusinessSettings {
  business_name: string;
  rif_tax_id: string;
  phone: string;
  whatsapp: string;
  address: string;
  currency: string;
  currency_symbol: string;
  tax_rate: number;
  pago_movil_info: string;
  binance_info: string;
  bank_transfer_info: string;
  invoice_prefix: string;
  sound_notifications_enabled: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  calculation: PriceCalculation;
}

export type ServiceCategory =
  | 'copias'
  | 'impresiones'
  | 'redaccion'
  | 'plastificado'
  | 'encuadernacion'
  | 'bebidas'
  | 'digitalizacion'
  | 'otros';

export interface AdditionalService {
  id: string;
  code: string;
  name: string;
  category: ServiceCategory | string;
  price: number; // in XAF / FCFA
  unit_label: string; // 'por hoja', 'por documento', 'por unidad', 'por servicio', etc.
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string | null; // e.g. 'Papelería General', 'Equipos', 'Bebidas', 'Consumibles'
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AiScannedItem {
  id: string;
  raw_text: string;
  item_name: string;
  quantity: number;
  unit?: string;
  matched_product_id?: string | null;
  matched_product?: Product | null;
  match_confidence?: number; // 0 to 1
  selected?: boolean;
}

export interface AiScanMatchResult {
  raw_extracted: {
    item_name: string;
    quantity: number;
    notes?: string;
  }[];
  items: AiScannedItem[];
  unmatched_items: string[];
}
