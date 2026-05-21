// Paged<T>: ページング API の共通レスポンス形
//   サーバーが {items: [...], total: N} の形で返してくるのに対応する型。
//   T はジェネリクス (型変数) で、Category / Product / User などを当てはめて使いまわせる。
//   例) Paged<Category> = { items: Category[]; total: number }

export interface Paged<T> {
  items: T[];    // ページ内のレコード (最大 pageSize 件)
  total: number; // 検索条件にマッチする総件数 (mat-paginator の length に渡す)
}
