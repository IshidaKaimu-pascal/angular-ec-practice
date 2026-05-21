import { Component, inject } from '@angular/core';
// RouterOutlet: ルートに応じたコンポーネントを差し込む場所 (<router-outlet />)
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (ページリロードなし)
// RouterLinkActive: 現在のURLがリンクと一致した時にCSSクラスを付与（ナビのアクティブ表示用）
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
// Material のツールバー (画面上部の横長ナビゲーションバー)
import { MatToolbarModule } from '@angular/material/toolbar';
// MatButton: Material のボタン
import { MatButtonModule } from '@angular/material/button';
// MatIcon: Material Icons のアイコン表示
import { MatIconModule } from '@angular/material/icon';
// MatMenu: クリックで開くプルダウンメニュー (右上の管理者名 → サインアウト用)
import { MatMenuModule } from '@angular/material/menu';
// MatDivider: メニュー内の区切り線
import { MatDividerModule } from '@angular/material/divider';
// MatSidenav: 画面サイドに開閉できるナビゲーションパネルを表示するモジュール
//   mat-sidenav-container (全体ラッパー) / mat-sidenav (サイド部分) / mat-sidenav-content (本文) の3要素構成
import { MatSidenavModule } from '@angular/material/sidenav';
// MatList: 縦並びのリストUI。 mat-nav-list は項目をリンクとして扱える派生形 (サイドメニューの3項目に使う)
import { MatListModule } from '@angular/material/list';
// AuthService: 管理者の認証状態 (currentAdmin / signedIn) と signOut() を提供
//   Step 7-D-6 でハードコードの currentAdmin を撤去し、これを参照する形に変更
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatSidenavModule,
    MatListModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // ─────────────────────────────────────────────────────
  // AuthService をテンプレートで使うために protected で公開
  //   テンプレートからは authService.signedIn() / authService.currentAdmin() で参照する
  //   currentAdmin は Admin | null の signal なので、テンプレート側で ?. (Optional chaining)
  //   を使って null チェックすること
  // ─────────────────────────────────────────────────────
  protected readonly authService = inject(AuthService);

  // ─────────────────────────────────────────────────────
  // サインアウト処理: AuthService.signOut() に委譲
  //   AuthService 側で:
  //     - localStorage から token / admin を削除
  //     - currentAdmin / signedIn signal を未ログイン状態にリセット
  //     - /sign-in へリダイレクト
  //   までまとめて行う。app.ts 側は単に呼ぶだけ。
  // ─────────────────────────────────────────────────────
  signOut(): void {
    this.authService.signOut();
  }
}
