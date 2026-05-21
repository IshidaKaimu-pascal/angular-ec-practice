// Category（商品カテゴリ）の型定義
// API(/categories)のレスポンス形と一致させる。

export interface Category {
  id: number;
  name: string;
  // displayOrder: 商品一覧画面でカテゴリを並べる際の表示順（小さい値ほど先に表示）
  // DB 側は @default(0) が入っているため、既存データは 0 で埋まる。
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}
