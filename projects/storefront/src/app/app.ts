import { Component, signal,inject } from '@angular/core';
// RouterLink: <a routerLink="/cart"> で SPA 内ナビゲーション（ページリロードなし）
// RouterLinkActive: 現在のURLがリンクと一致した時にCSSクラスを付与（ハイライト用、今は未使用）
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
// Material のボタンコンポーネント（Standalone componentでは imports 配列に追加して使う）
import { MatButtonModule } from '@angular/material/button';
// MatToolbar: 画面上部の横長ナビゲーションバー
import { MatToolbarModule } from '@angular/material/toolbar';
// MatMenu: クリックで開くプルダウンメニュー
import { MatMenuModule } from '@angular/material/menu';
// MatIcon: Material Icons フォントのアイコンを表示
import { MatIconModule } from '@angular/material/icon';
// MatDivider: メニュー内などで使う区切り線
import { MatDividerModule } from '@angular/material/divider';
//MatBadge:未読の通知などに使用される数字
import { MatBadge } from '@angular/material/badge';

import { CartService } from './services/cart.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatToolbarModule,
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    MatBadge,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('storefront');

  // サービスを注入。テンプレートから直接 cartService.totalQuantity() などを参照する
  protected readonly cartService = inject(CartService);
  // AuthService 経由で signedIn() / currentUser() を参照する設計
  //   currentUser は Signal<User | null>。未ログイン時は null になるため、
  //   テンプレートでは signedIn() で表示制御し、参照時は ?. を付ける。
  protected readonly authService = inject(AuthService);

  // サインアウト処理: ロジックは AuthService に集約。コンポーネント側は委譲するだけ。
  signOut(): void {
    this.authService.signOut();
  }
}
