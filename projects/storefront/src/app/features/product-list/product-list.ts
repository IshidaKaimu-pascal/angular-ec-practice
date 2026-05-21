import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
// DecimalPipe: テンプレート内の `{{ value | number }}` で数値を3桁区切り表示するためのパイプ
// Angular の標準パイプは standalone component の imports に明示登録が必要
import { DecimalPipe } from '@angular/common';
// RouterLink: <a [routerLink]="..."> で SPA 内ナビゲーション(商品詳細画面へ飛ばす)
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
// 検索ボックス用の Material 入力フィールド
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
// MatPaginator: ページング用のMaterial標準UI部品(ページ番号、ページサイズ選択、前後ナビ)
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Product } from 'shared';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-product-list',
  imports: [
    DecimalPipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatPaginatorModule,
  ],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductList implements OnInit {
  // ProductService をフィールドに注入
  private readonly productService = inject(ProductService);
  // CartService をフィールドに注入（テンプレート内で参照する必要があれば protected にする）
  private readonly cartService = inject(CartService);

  // 商品一覧の状態を signal で管理。
  protected readonly products = signal<Product[]>([]);

  // 検索文字列の状態。input イベントから .set() で更新される。
  protected readonly searchQuery = signal<string>('');

  // 検索結果の状態
  protected readonly filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.products().filter((p) => p.name.toLowerCase().includes(query));
  });

  // ─────────────────────────────────────────────────────
  // ページング状態
  //   pageIndex: 現在のページ番号(0始まり。0が1ページ目)
  //   pageSize:  1ページに表示する件数
  // ─────────────────────────────────────────────────────
  protected readonly pageIndex = signal<number>(0);
  // pageSize は 3 の倍数にしておくと、カテゴリ (毛糸/布地/道具) ごとに 3 枚ずつ並びやすい
  protected readonly pageSize = signal<number>(6);

  // ─────────────────────────────────────────────────────
  // ページング処理
  //   - 開始インデックス: pageIndex() * pageSize()
  //     (例: 2ページ目, 4件ずつ → 2 * 4 = 8番目から)
  //   - 終了インデックス: 開始 + pageSize()
  //   - 配列の部分取り出しは .slice(start, end) を使う
  //     (.slice は元配列を変えない。end は「含まない」位置)
  // ここに paginatedProducts を実装する
    protected readonly paginatedProducts = computed(() =>{
      //開始インデックス(ページ番号 * 1ページの件数)
      const start = this.pageIndex() * this.pageSize();
      return this.filteredProducts().slice(start, start + this.pageSize());
    })

  // ─────────────────────────────────────────────────────
  // TODO CC: groupedProducts を実装する
  //   役割: 現在ページの商品 (paginatedProducts()) をカテゴリごとにグループ化する
  //
  //   戻り値の型 (イメージ):
  //     { categoryName: string; products: Product[] }[]
  //
  //   なぜグループ化が必要?
  //     - テンプレートで「カテゴリ見出し → そのカテゴリの商品」を順に並べたい
  //     - Angular の @for は「配列」を順に回す仕組みなので、
  //       事前に「カテゴリごとの配列の配列」に変形しておくと描画が素直になる
  //
  //   ヒント:
  //     - product.category?.name でカテゴリ名を取り出せる
  //       (? は optional chaining: category が undefined の時は undefined を返す)
  //     - category が無い商品は '未分類' などにフォールバックすると安全
  //     - 元の並び順 (id 昇順) を維持しながら「初めて出てきたカテゴリ順」で並べたいので、
  //       Map<string, Product[]> を使うと挿入順が保たれて便利
  //       (通常のオブジェクトは挿入順保証がブラウザ依存になるケースがある)
  //
  //   完成形のヒント (構造):
  //     protected readonly groupedProducts = computed(() => {
  //       const map = new Map<string, Product[]>();
  //       for (const p of this.paginatedProducts()) {
  //         const name = p.category?.name ?? '未分類';
  //         // map に name キーが無ければ空配列を作る → push する
  //         // ...
  //       }
  //       // Map → 配列形式に変換して return
  //       // return Array.from(map, ([categoryName, products]) => ({ categoryName, products }));
  //     });
  // ─────────────────────────────────────────────────────
  // ここに groupedProducts を実装する
  protected readonly groupedProducts = computed(() => {
    const map =  new Map<String,Product[]>();
    for(const p of this.paginatedProducts()){
      const name = p.category?.name ?? '未分類';
      if(!map.has(name)){
        map.set(name,[]);
      }
      map.get(name)?.push(p);
      }
    return Array.from(map, ([categoryName, products]) => ({ categoryName, products }));
  })


  // ─────────────────────────────────────────────────────
  // effect: signal の変化を検知して「副作用」(画面外の処理)を走らせる仕組み
  //   computed は「値を返す」のに対し、effect は「処理を実行する」のが違い。
  //   constructor 内でしか呼べない(Angular の DI コンテキストが必要なため)。
  //
  // ここでは「検索文字列が変わったら現在ページを 0 に戻す」処理を仕込む。
  // 理由: 例えば3ページ目を見ている時に検索して結果が1ページ分しかなくなると、
  //       3ページ目には何も表示されない状態になってしまう。
  // ─────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      this.searchQuery(); // ← この signal を「読む」ことで、変化検知の依存に登録される
      this.pageIndex.set(0); // 検索が変わるたびにページを先頭に戻す
    });
  }

  ngOnInit(): void {
    this.productService.getAll().subscribe({
      next: (data) => this.products.set(data),
      error: (err) => console.error('商品取得に失敗:', err),
    });
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  // ─────────────────────────────────────────────────────
  // TODO BB: onPageChange(event: PageEvent) メソッドを実装する
  //   役割: paginator のページ変更イベントを受けて、pageIndex/pageSize の signal を更新
  //
  //   ヒント:
  //   - event は PageEvent 型(@angular/material/paginator から import 済み)
  //   - event.pageIndex (新しいページ番号), event.pageSize (新しいページサイズ) を持つ
  //
  //   完成形のヒント(構造):
  //   protected onPageChange(event: PageEvent): void {
  //     this.pageIndex.set(event.pageIndex);
  //     this.pageSize.set(event.pageSize);
  //   }
  // ─────────────────────────────────────────────────────
  // ここに onPageChange を実装する
    protected onPageChange(event:PageEvent):void{
      this.pageIndex.set(event.pageIndex);
      this.pageSize.set(event.pageSize);
    }


  protected addToCart(product: Product): void {
    this.cartService.add(product);
  }
}
