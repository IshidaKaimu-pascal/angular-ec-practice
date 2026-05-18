// User（顧客・管理者）の型定義
// API(/users)のレスポンス形と一致させる。role で「顧客」と「管理者」を区別。

// 'customer' | 'admin' のような書き方は「リテラルユニオン型」と呼び、
// 取りうる値を文字列レベルで制限できる。これにより `user.role === 'admins'` のような
// typo がコンパイル時にエラーになる。
export type UserRole = 'customer' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  // address/phone は schema.prisma で String? なので null になる可能性がある
  address: string | null;
  phone: string | null;
  // API は Date を JSON 化するため string(ISO8601) として届く
  createdAt: string;
  updatedAt: string;
}
