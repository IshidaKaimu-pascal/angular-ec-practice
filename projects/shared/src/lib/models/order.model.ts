// Order（注文1件）の型定義
// API(/orders)のレスポンス形と一致させる。OrderItem の親レコード。

import { OrderItem } from './order-item.model';
import { User } from './user.model';

// 支払い方法もリテラルユニオンで取りうる値を制限。
// 必要に応じて値を追加する（例: 'bank_transfer', 'credit_card'）。
export type PaymentMethod = 'cash_on_delivery' | 'convenience_store_payment';

export interface Order {
  id: number;
  userId: number;
  totalAmount: number; // 円単位の整数
  paymentMethod: PaymentMethod;
  shippingAddress: string;
  orderedAt: string; // ISO8601 文字列（APIがJSONで返すため）
  // user/items は API 側で include した場合のみ含まれる
  user?: User;
  items?: OrderItem[];
}
