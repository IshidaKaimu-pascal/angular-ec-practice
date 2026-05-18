// Category（商品カテゴリ）の型定義
// API(/categories)のレスポンス形と一致させる。

export interface Category {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}
