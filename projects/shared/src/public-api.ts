/*
 * Public API Surface of shared
 */

// API レスポンスや画面で使う共通型を外部公開
// storefront / backoffice 側で `import { User } from 'shared'` のように使う
export * from './lib/models/user.model';
export * from './lib/models/admin.model';
export * from './lib/models/category.model';
export * from './lib/models/paged.model';
export * from './lib/models/product.model';
export * from './lib/models/order-item.model';
export * from './lib/models/order.model';

// 既存の Shared コンポーネント（雛形）
export * from './lib/shared';
