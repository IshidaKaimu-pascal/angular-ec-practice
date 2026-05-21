import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { CartService } from '../../services/cart.service';
// Step 7-E-3: 「購入手続きへ」ボタンの分岐に必要
//   AuthService → サインイン状態の判定 (signedIn シグナル) と HTML 側のラベル出し分けで使う
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cart',
  imports: [
    DecimalPipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  // protected にすることでテンプレートから cartService.items() などを直接呼べる
  protected readonly cartService = inject(CartService);
  // Step 7-E-3: 「購入手続きへ」ボタンの遷移先を分岐するため AuthService と Router を inject
  //   authService は HTML 側 (ラベルの @if) でも使うので protected で公開する
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ─────────────────────────────────────────────────────
  // ラッパーメソッド: テンプレート(.html)から呼ばれる
  // ロジック自体は CartService 側にあるので、ここは「クリック → サービス呼び出し」の薄い橋渡し役
  // ─────────────────────────────────────────────────────

  // 数量を1増やす
  protected increment(productId: number, currentQty: number): void {
    this.cartService.updateQuantity(productId, currentQty + 1);
  }

  // 数量を1減らす（0以下になったらサービス側が自動で削除してくれる）
  protected decrement(productId: number, currentQty: number): void {
    this.cartService.updateQuantity(productId, currentQty - 1);
  }

  // 削除（数量に関わらず即削除）
  protected remove(productId: number): void {
    this.cartService.remove(productId);
  }

  // ============================================================
  // proceedToCheckout: 「購入手続きへ」ボタンを押したときの遷移処理 (Step 7-E-3)
  // ------------------------------------------------------------
  // 背景:
  //   /checkout は authGuard で保護されており、未サインインなら開けない。
  //   ボタンを押した時点で signedIn() を見て、
  //     - サインイン済   → そのまま /checkout
  //     - 未サインイン   → /sign-in?returnUrl=/checkout (サインイン後に戻ってくる)
  //   と分岐させる。
  //
  // ============================================================
  // 穴埋め ToDo-3: proceedToCheckout の分岐ロジックを完成させてください
  // ------------------------------------------------------------
  // やること:
  //   this.authService.signedIn() の真偽で if/else 分岐し、それぞれの遷移を書く。
  //
  // ヒント1 (サインイン済):
  //   - this.router.navigate(['/checkout']) で /checkout に飛ばす
  //
  // ヒント2 (未サインイン):
  //   - this.router.navigate(['/sign-in'], { queryParams: { returnUrl: '/checkout' } })
  //   - これで URL は /sign-in?returnUrl=/checkout になる
  //   - サインイン画面側 (sign-in.ts) は ToDo-2 で returnUrl を読む実装済 → 自動で /checkout に飛ぶ
  //
  // 参考: sign-in.ts の subscribe.next 内の navigateByUrl との対比で
  //   ・URL 文字列を直接渡す → navigateByUrl
  //   ・配列 + queryParams オプション → navigate
  //   の使い分けを意識すると理解が深まる。
  // ============================================================
  protected proceedToCheckout(): void {
    if(this.authService.signedIn()) {
        //サインイン済の状態での処理(そのままcheckout画面に飛ぶ)
        this.router.navigate(['/checkout']);
    }else{
      //未サインインの状態での処理(サインイン後にcheckout画面にそのまま飛ぶ)
      this.router.navigate(['/sign-in'],{queryParams:{returnUrl:'/checkout'}});
    }    
  }
}
