import { Component, OnInit, inject, signal } from '@angular/core';
// ActivatedRoute: 現在の URL に紐付くルート情報を取得するサービス
//   snapshot.paramMap.get('id') で URL の :id 部分を文字列として取り出せる
// Router: 画面遷移をプログラムから行うためのオブジェクト
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (編集/一覧ボタン用)
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// Angular Material のボタン部品
import { MatButtonModule } from '@angular/material/button';
// MatProgressSpinnerModule: ローディング中のクルクル表示用
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
// DatePipe: テンプレート内で日付フォーマット ({{ value | date:'yyyy-MM-dd' }})
// DecimalPipe: 価格の桁区切り表示 ({{ 1000 | number }} → "1,000")
import { DatePipe, DecimalPipe } from '@angular/common';
import { ProductService } from '../../../services/product.service';
// Product: shared ライブラリで定義された型
//   (id/name/description/price/imageUrl/stock/categoryId/category?/createdAt/updatedAt)
import { Product } from 'shared';

@Component({
  selector: 'app-product-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressSpinnerModule,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail implements OnInit {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  // ─────────────────────────────────────────────────────
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  // ActivatedRoute: URL の :id を読み取るために使う
  private readonly route = inject(ActivatedRoute);

  // ─────────────────────────────────────────────────────
  // 詳細表示中の商品ID (テンプレートからも使うため protected)
  // ! は definite assignment assertion: 「ngOnInit で必ず代入される」と TS に伝える
  // ─────────────────────────────────────────────────────
  protected productId!: number;

  // ─────────────────────────────────────────────────────
  // loading signal: 初回データ取得中フラグ
  //   true の間はスピナーを表示し、取得完了で false にする
  // ─────────────────────────────────────────────────────
  protected readonly loading = signal<boolean>(true);

  // ─────────────────────────────────────────────────────
  // product signal: 取得した1件の商品情報
  //   初期値は null (まだ未取得を表す)
  //   テンプレート側で @if (product()) ガードしてから値を参照する
  // ─────────────────────────────────────────────────────
  protected readonly product = signal<Product | null>(null);

  // ─────────────────────────────────────────────────────
  // ngOnInit: コンポーネント生成直後 (テンプレート描画前) に呼ばれる Angular ライフサイクル
  //   流れ: URLから:id取得 → 数値化 → API取得 → product signal にセット → loading 解除
  // ─────────────────────────────────────────────────────
  ngOnInit(): void {
    // ① URL から :id を取り出す
    //   snapshot.paramMap.get('id') は string | null を返す
    //   null だった場合は不正な URL なので一覧へ戻す
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam === null) {
      this.router.navigate(['/products']);
      return;
    }

    // ② string → number に変換
    this.productId = Number(idParam);

    //productIdが数字以外の不正なデータだった場合リダイレクトする
    // 補足: Number.isNaN() は「値が NaN そのものか」を厳密に判定する。
    //   グローバルの isNaN() は文字列等を数値変換してから判定するため、
    //   isNaN("abc") → true / isNaN("123") → false と紛らわしい挙動になる。
    //   Number(...) の結果を判定する用途では Number.isNaN() を使うのが安全。
    if(Number.isNaN(this.productId)){
      this.router.navigate(['/products']);
      return;
    }

    //API から商品情報を取得する
    this.productService.getById(this.productId).subscribe({
      next: (p) => {
        //商品情報をsignal(product)に保存
        this.product.set(p);
        //読み込み中を消す
        this.loading.set(false);
      },

      error: (err) => {
        // エラー時の作法 (3点セット):
        //   ① ログ出力 ... 原因調査用。本番では Sentry 等の監視サービスに送ることもある
        //   ② state クリーンアップ ... loading 解除でスピナーが残り続けるのを防ぐ
        //   ③ 安全な画面へ退避 ... 詳細表示できないので一覧画面に戻す (画面が真っ白にならないように)
        //失敗した場合エラー文を出力し、読み込み中を消す
        console.error('商品取得に失敗:',err);
        this.loading.set(false);
        //詳細表示不能のため一覧画面へリダイレクト
        this.router.navigate(['/products']);
      }
    });
  }
}
