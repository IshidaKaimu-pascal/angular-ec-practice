// OrderItem（注文明細1行）の型定義
// API(/orders)のレスポンス形と一致させる。Order に紐づく子レコード。

import { Product } from './product.model';

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  // unitPrice は注文時点の単価をスナップショット保存している（後で商品価格を変えても変わらない）
  unitPrice: number;
  // product は API 側で include した場合のみ含まれる
  product?: Product;
}
