import { Routes } from '@angular/router';
// 各画面の雛形コンポーネントを直接 import（eager loading: 起動時に全部読み込む）
// 後でアプリが大きくなったら loadComponent を使った lazy loading に切り替え可能
import { ProductList } from './features/product-list/product-list';
import { ProductDetail } from './features/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';
import { OrderHistory } from './features/order-history/order-history';
import { UserSettings } from './features/user-settings/user-settings';
import { PasswordChange } from './features/password-change/password-change';

export const routes: Routes = [
  { path: '', component: ProductList }, // トップ = 商品一覧画面
  // :id はルートパラメータ。/products/5 でアクセスされると id="5" として取り出せる
  { path: 'products/:id', component: ProductDetail },
  { path: 'cart', component: Cart },
  { path: 'checkout', component: Checkout },
  { path: 'orders', component: OrderHistory },
  { path: 'user/settings', component: UserSettings },
  { path: 'user/password', component: PasswordChange },
  // ** はワイルドカード。どのパスにも一致しなかった場合（typo等）にトップへ戻す
  { path: '**', redirectTo: '' },
];
