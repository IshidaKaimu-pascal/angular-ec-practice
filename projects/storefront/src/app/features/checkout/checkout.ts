import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
// ReactiveFormsModule: Reactive Forms (TypeScript側でフォーム構造を組み立てる方式)用のモジュール
// FormGroup/FormControl/Validators をテンプレートに紐付けるために必要
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { PaymentMethod } from 'shared';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { OrderService, CreateOrderPayload } from '../../services/order.service';

@Component({
  selector: 'app-checkout',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatRadioModule,
    MatDividerModule,
    MatIconModule,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  // テンプレートから参照できるようにサービスを公開
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);
  // Router: プログラム的なページ遷移用（注文確定後に /orders へ飛ばす）
  private readonly router = inject(Router);

  // ─────────────────────────────────────────────────────
  // Reactive Forms: FormGroup でフォーム全体を、FormControl で各入力を定義
  // 今回はラジオボタン1つだけのシンプル構成。
  // FormControl の第2引数 nonNullable: true は「null を許さない＝必ず値が入る」設定。
  // 第3引数の validators: バリデーションルールの配列。
  // ─────────────────────────────────────────────────────
  protected readonly form = new FormGroup({
    paymentMethod: new FormControl<PaymentMethod>('cash_on_delivery', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  // 送信中フラグ。ボタン二重押し防止やローディング表示に使う。
  // signal の代わりに boolean プロパティでも良いが、画面反映の即時性を優先して signal にしても可。
  protected submitting = false;

  // 注文確定ボタンのハンドラ
  protected onSubmit(): void {
    // バリデーションNG または カート空 なら何もしない
    if (this.form.invalid || this.cartService.items().length === 0) {
      return;
    }

    // currentUser() は Signal<User | null>。AuthGuard で /checkout を保護しているので
    // 実行時には null にならないが、型上の null ガードを入れる。
    const user = this.authService.currentUser();
    if (!user) return;

    // 住所が未登録だと注文できない（API側でも shippingAddress は必須）
    if (!user.address) {
      alert('お届け先住所が未登録です。設定画面から住所を登録してください。');
      return;
    }

    // 送信用ペイロードを組み立てる
    // CartItem(product+quantity) を API が期待する {productId, quantity} に変換
    const payload: CreateOrderPayload = {
      userId: user.id,
      paymentMethod: this.form.controls.paymentMethod.value,
      shippingAddress: user.address,
      items: this.cartService.items().map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
      })),
    };

    this.submitting = true;
    this.orderService.create(payload).subscribe({
      next: () => {
        // 成功: カートを空にして購入履歴画面へ遷移
        this.cartService.clear();
        this.router.navigate(['/orders']);
      },
      error: (err) => {
        console.error('注文確定に失敗:', err);
        alert('注文の処理中にエラーが発生しました。');
        this.submitting = false;
      },
    });
  }
}
