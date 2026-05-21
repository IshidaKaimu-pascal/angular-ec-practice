import { Component, OnInit, inject, signal } from '@angular/core';
// DatePipe: テンプレート内の `{{ value | date }}` で日時を整形表示するパイプ
// DecimalPipe: 価格の桁区切り表示 `{{ 1000 | number }}` → "1,000"
import { DatePipe, DecimalPipe } from '@angular/common';
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (新規作成/詳細/編集画面への遷移)
import { RouterLink } from '@angular/router';
// MatTable: Material のデータテーブル。列定義 (matColumnDef) と表示順 (displayedColumns) で構成
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
// 検索 UI で使う Material モジュール
//   MatFormFieldModule / MatInputModule: テキスト入力欄 (商品名検索)
//   MatSelectModule                    : カテゴリのドロップダウン
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
// MatPaginatorModule: Material のページ送り UI (mat-paginator) を使うため
// PageEvent: paginator がページ変更時に発火する (page) イベントの型
//   { pageIndex, pageSize, previousPageIndex, length } を持つ
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
// FormControl: Reactive Forms の最小単位。1 つの入力欄の値と状態 (touched, dirty 等) を管理する
// ReactiveFormsModule: テンプレートで [formControl] ディレクティブを使うのに必要
import { FormControl, ReactiveFormsModule } from '@angular/forms';
// Subject: 自分で .next() を呼んで値を流せる Observable (発行元と受け取り元を兼ねる)
//   → 「検索変更」「カテゴリ変更」「ページ変更」「初回読み込み」「削除後」など
//      複数の引き金を 1 本のパイプにまとめるのに便利
// debounceTime: 連続して流れてくる値を一定時間 (ms) 静まったら最後の値だけ通す RxJS オペレーター
// switchMap : 新しい値が来たら「前回の Observable は破棄」して新しい Observable に切り替える
//             → 古い API レスポンスが遅れて返ってきて画面が混ざる事故を防ぐ
import { Subject, debounceTime, switchMap } from 'rxjs';
import { Category, Product } from 'shared';
import { ProductService } from '../../../services/product.service';
import { CategoryService } from '../../../services/category.service';

@Component({
  selector: 'app-product-list',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    ReactiveFormsModule,
  ],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductList implements OnInit {
  // ProductService をフィールド注入
  private readonly productService = inject(ProductService);
  // CategoryService: カテゴリ select の選択肢を取得するために追加
  private readonly categoryService = inject(CategoryService);

  // 商品一覧の状態を signal で管理 (初期値は空配列)
  protected readonly products = signal<Product[]>([]);
  // 通信中フラグ。テンプレート側で「読み込み中…」を出すために使う
  protected readonly loading = signal<boolean>(false);
  // カテゴリ select の選択肢として表示するカテゴリ一覧
  //   ngOnInit で CategoryService から取得して詰める
  protected readonly categories = signal<Category[]>([]);

  // 検索欄 (商品名) の FormControl
  //   nonNullable: true で型を string に固定 (デフォルトは null も含む string | null)
  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });

  // カテゴリ select の FormControl
  //   値は categoryId (number) または null (= 「すべて」を選択中)
  //   nonNullable を付けない → null も許容することで「すべて」を表現できる
  protected readonly categoryControl = new FormControl<number | null>(null);

  // ─────────────────────────────────────────────────────
  // ページング用の signal 群
  //   pageIndex: 現在のページ番号 (0 起点。0 = 1ページ目)
  //   pageSize:  1 ページあたりの件数 (paginator の [pageSizeOptions] と連動)
  //   total:     検索条件にマッチする全件数 (API レスポンスの total から)
  // ─────────────────────────────────────────────────────
  protected readonly pageIndex = signal<number>(0);
  protected readonly pageSize = signal<number>(10);
  protected readonly total = signal<number>(0);

  // ─────────────────────────────────────────────────────
  // mat-table 用: 表示する列の順序と識別子の配列
  //   テンプレート側の <ng-container matColumnDef="..."> の文字列と一致させる必要がある
  //   配列の順番がそのまま画面の列順になる
  // ─────────────────────────────────────────────────────
  protected readonly displayedColumns = [
    'id',
    'thumbnail',
    'name',
    'price',
    'stock',
    'category',
    'createdAt',
    'actions',
  ];

  // reload$: 「再取得してほしい」という合図を流すための Subject
  //   検索 / カテゴリ変更 / ページ変更 / 初回 / 削除後 などのどこからでも reload$.next() を呼べば
  //   下の switchMap が現在の signal を読んで getPage() を発行する仕組み
  //   → 複数の引き金を 1 本のパイプに集約できるので、状態の整合性が取りやすい
  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    // ① reload$ のパイプライン (完成形)
    //    next() が呼ばれるたびに現在の pageIndex / pageSize / 検索文字列 / カテゴリ ID を読み取って getPage() 発行
    //    switchMap なので、新しい reload が来たら前回の HTTP は破棄される (古い結果の混入防止)
    this.reload$
      .pipe(
        switchMap(() =>
          this.productService.getPage({
            page: this.pageIndex(),
            pageSize: this.pageSize(),
            // null は undefined に正規化 (API 側で「未指定」扱いにするため)
            //   ?? は null/undefined の時に右辺を使う Null 合体演算子
            categoryId: this.categoryControl.value ?? undefined,
            // 空文字 / null は undefined に正規化 (API 側で q なしと同じ扱いにするため)
            q: this.searchControl.value || undefined,
          }),
        ),
      )
      .subscribe({
        next: (data) => {
          // 取得成功: items を一覧 signal に、total を total signal に詰める
          this.products.set(data.items);
          this.total.set(data.total);
          this.loading.set(false);
        },
        error: (err) => {
          // 失敗時もローディングは消す (ずっと「読み込み中…」のままにしないため)
          console.error('商品取得に失敗:', err);
          this.loading.set(false);
        },
      });

    // ② カテゴリ select の選択肢を取得して signal に詰める
    //    失敗してもアプリは止めない (select が空になるだけ)
    //    引数なしの getAll() を呼ぶため、サーバー側は配列を返す (後方互換: Step 9-1)
    this.categoryService.getAll().subscribe({
      next: (data) => this.categories.set(data),
      error: (err) => console.error('カテゴリ一覧取得に失敗:', err),
    });

    //検索欄の値の変更を監視し、ページを0に戻す

    //検索欄の変更を監視し続ける(入力から300ms後に呼び出す)
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.pageIndex.set(0);
      this.reload$.next();
    });

    //カテゴリ選択欄に変更があればページを0に戻す
    this.categoryControl.valueChanges.subscribe(() => {
      this.pageIndex.set(0);
      this.reload$.next();
    });
    

    // ④ 初回読み込み: loadProducts() 経由で reload$.next() を発火
    this.loadProducts();
  }

  // ─────────────────────────────────────────────────────
  // loadProducts(): 一覧を再取得する共通エントリポイント
  //   旧バージョンでは getAll() を直接呼んでいたが、Phase 9 で Subject トリガー方式に変更。
  //   現在の役割: loading 表示を立てて、reload$ にトリガーを流すだけ。
  //   実際の HTTP 発行は ngOnInit で組んだ reload$ のパイプラインが担う。
  // ─────────────────────────────────────────────────────
  loadProducts(): void {
    this.loading.set(true);
    this.reload$.next();
  }

  // ─────────────────────────────────────────────────────
  // onPageChange(event): ページ変更時に発火
  //   mat-paginator の (page)="onPageChange($event)" から呼ばれる。
  //   PageEvent は Material が組み立てて渡してくれる「ページ変更の通知オブジェクト」。
  //   この関数の責務は「state(signal) を更新する → 再取得の合図を出す」の 2 段だけ。
  //   実際の HTTP 発行は ngOnInit の reload$ パイプラインが担当する (関心の分離)。
  // ─────────────────────────────────────────────────────
  onPageChange(event: PageEvent): void {
    // ① 新しいページ番号 (0 起点) を signal に反映
    this.pageIndex.set(event.pageIndex);
    // ② 新しいページサイズを signal に反映
    //    HTML 側の [pageSizeOptions] のうちユーザーが選んだ値が入る
    this.pageSize.set(event.pageSize);
    // ③ reload$ に「再取得して！」の合図を流す
    //    ★ 順序ポイント: ①② で signal を更新してから ③ で next() を呼ぶこと。
    //       逆順だと switchMap が「更新前の古い state」で API を呼んでしまう。
    this.reload$.next();
  }

  // ─────────────────────────────────────────────────────
  // onDelete(product): 確認ダイアログ → 削除API → 一覧再取得
  //   1. window.confirm() で OK/キャンセル
  //   2. キャンセル時は early return
  //   3. ProductService.delete(id) → 成功時 loadProducts() で再取得
  //   4. 失敗時は console.error (外部キー制約エラー等の可能性あり)
  // ─────────────────────────────────────────────────────
  onDelete(product: Product): void {
    // ① 削除前の確認ダイアログ: ブラウザ標準の confirm() で OK/キャンセル
    //    バッククォート (テンプレートリテラル) なので ${product.name} が実際の商品名に置換される
    const ok = window.confirm(`商品"${product.name}"を削除しますか?`);

    // ② キャンセル時 (ok=false) は何もせず関数を抜ける (早期 return)
    if (!ok) return;

    // ③ 削除APIを呼ぶ: DELETE /products/:id
    //    Observable<void> なので next の引数も受け取らない (() の中身は空)
    this.productService.delete(product.id).subscribe({
      next: () => {
        // 削除後の一覧を再取得して最新の状態にする
        this.loadProducts();
      },
      error: (err) => {
        console.error('商品削除に失敗:', err);
        this.loadProducts();
      },
    });
  }
}
