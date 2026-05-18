import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
// ActivatedRoute: 現在のルートの情報(パラメータ等)を取得するサービス
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Product } from 'shared';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-product-detail',
  imports: [
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);

  // 商品データの状態。最初は null(未取得)、API取得後にセットされる
  // テンプレート側で @if (product()) { ... } で「取得済みかどうか」を判定する
  protected readonly product = signal<Product | null>(null);

  // 数量の状態。+/- ボタンと連動
  protected readonly quantity = signal<number>(1);

  ngOnInit(): void {
    // URL `/products/5` の場合、id には "5" (文字列) が入る
    // snapshot.paramMap は「現在のパラメータの瞬間値」を取得する一番シンプルな方法
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);

    //詳細画面が開いた際にidに沿った商品情報を取得する
    this.productService.getById(id).subscribe({
      next: (data) => this.product.set(data),
      error: (err) => console.error('商品取得に失敗',err),
    })
  }

  // 数量を1増やす。在庫を超えないように上限制御も入れる
  protected increment(): void {
    const p = this.product();
    if (!p) return; // 商品データ未取得なら何もしない
    if (this.quantity() >= p.stock) return; // 在庫を超えるなら何もしない
    this.quantity.set(this.quantity() + 1);
  }

  // 数量を1減らす(1未満にはならない)
  protected decrement(): void {
    if (this.quantity() <= 1) return;
    this.quantity.set(this.quantity() - 1);
  }

  // カートに数量分追加する
  protected addToCart(): void {
    const p = this.product();
    if (!p) return;
    this.cartService.add(p, this.quantity());
    alert(`${p.name} を ${this.quantity()} 個 カートに追加しました`);
  }
}
