import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
// 各画面の雛形コンポーネントを直接 import（eager loading: 起動時に全部読み込む）
// 後でアプリが大きくなったら loadComponent を使った lazy loading に切り替え可能
import { ProductList } from './features/product-list/product-list';
import { ProductDetail } from './features/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';
import { OrderHistory } from './features/order-history/order-history';
import { UserSettings } from './features/user-settings/user-settings';
import { PasswordChange } from './features/password-change/password-change';
import { SignIn } from './features/sign-in/sign-in';
import { SignUp } from './features/sign-up/sign-up';
// authGuard: 未サインインで保護ルートを開こうとした時に /sign-in へリダイレクト (Step 7-C-4)
import { authGuard } from './guards/auth.guard';
// AuthService: 下の homeRedirect で signedIn() を参照するために使う (Step 7-E-1)
import { AuthService } from './services/auth.service';

// ─────────────────────────────────────────────────────
// homeRedirect: ルート '/' を開いた時の振り分けガード (Step 7-E-1)
//   - サインイン済   → そのまま ProductList を表示 (true を返す)
//   - 未サインイン   → /sign-in に飛ばす (UrlTree を返すと Router がリダイレクト扱いにする)
//
// CanActivateFn は関数型ガード (Angular 15+)。
//   戻り値が true なら通過、false なら遮断、UrlTree ならその URL にリダイレクト。
// ─────────────────────────────────────────────────────
const homeRedirect: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  // サインイン済なら ProductList を表示、未サインインなら /sign-in にリダイレクト
  const result = authService.signedIn() ? true :  router.parseUrl('/sign-in');
  return result;
};

export const routes: Routes = [
  // トップ ('/') は homeRedirect で振り分け。
  // pathMatch: 'full' を付けないと前方一致になり、全パスにこのルートが適用されてしまう。
  { path: '', component: ProductList, canActivate: [homeRedirect], pathMatch: 'full' },
  // 公開直リンク用の商品一覧。SNS や検索エンジンからの導線で「未サインインでも商品が見える」入口
  { path: 'products', component: ProductList },
  // :id はルートパラメータ。/products/5 でアクセスされると id="5" として取り出せる
  { path: 'products/:id', component: ProductDetail }, // 商品詳細 (公開)
  // canActivate: [authGuard] を付けたルートは「サインイン中のユーザー」だけが開ける
  // 未サインインなら authGuard が /sign-in に飛ばす
  // ⚠️ /cart は Step 7-E-1 で authGuard を撤去 (未サインインでもカートを試せるようにするため)
  { path: 'cart', component: Cart },
  { path: 'checkout', component: Checkout, canActivate: [authGuard] },
  { path: 'orders', component: OrderHistory, canActivate: [authGuard] },
  { path: 'user/settings', component: UserSettings, canActivate: [authGuard] },
  { path: 'user/password', component: PasswordChange, canActivate: [authGuard] },
  { path: 'sign-in', component: SignIn }, // サインイン画面 (公開)
  { path: 'sign-up', component: SignUp }, // 新規登録画面 (公開)
  // ** はワイルドカード。どのパスにも一致しなかった場合（typo等）にトップへ戻す
  { path: '**', redirectTo: '' },
];
