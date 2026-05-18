import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { CartService } from '../../services/cart.service';

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
}
