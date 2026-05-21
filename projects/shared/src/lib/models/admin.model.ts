// Admin（管理者）の型定義
// API(/admin など 将来追加予定) のレスポンス形と一致させる。
//
// User との違い:
//   - role を持たない（このテーブル全員が管理者のため）
//   - address / phone なし（連絡先不要）
//   - orders リレーションなし（管理者は購入しない）
//
// schema.prisma の model Admin と必ず対応させること。

export interface Admin {
  id: number;
  name: string;
  email: string;
  createdAt: string;//本来Date型だがJsonで返すため
  updatedAt: string;//本来Date型だがJsonで返すため
}
