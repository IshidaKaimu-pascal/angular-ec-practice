// Product（商品）の型定義
// API(/products)のレスポンス形と一致させる。

import { Category } from './category.model';

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number; // 円単位の整数
  imageUrl: string | null;
  stock: number;
  categoryId: number;
  // category は API 側で include した場合のみ含まれる。
  // ? は「省略可能(optional)」を表し、プロパティ自体が存在しないケースを許容する。
  category?: Category;
  createdAt: string;
  updatedAt: string;
}
