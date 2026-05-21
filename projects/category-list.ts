import { Component, OnInit, inject, signal } from '@angular/core';
// DatePipe: テンプレート内の `{{ value | date }}` で日時を整形表示するためのパイプ
import { DatePipe } from '@angular/common';
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (新規作成/詳細/編集画面への遷移)
import { RouterLink } from '@angular/router';
// MatTable: Material のデータテーブル。列定義 (matColumnDef) と表示順 (displayedColumns) で構成
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
// 検索 UI で使う Material モジュール (mat-form-field + matInput)
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
// MatPaginatorModule: Material のページ送り UI (mat-paginator) を使うため
// PageEvent: paginator がページ変更時に発火する (page) イベントの型
//   { pageIndex, pageSize, previousPageIndex, length } を持つ
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
// FormControl: Reactive Forms の最小単位。1 つの入力欄の値と状態 (touched, dirty 等) を管理する
// ReactiveFormsModule: テンプレートで [formControl] ディレクティブを使うのに必要
import { FormControl, ReactiveFormsModule } from '@angular/forms';
// debounceTime: 連続して流れてくる値を一定時間 (ms) 静まったら最後の値だけ通す RxJS オペレーター
// switchMap: 上流から新しい値が来たら「前回の Observable は破棄」して新しい Observable に切り替える
//   → 連続検索で「古い結果が遅れて返ってきて画面が混ざる」事故を防ぐ
// Subject: 自分で .next() を呼んで値を流せる Observable (発行元と受け取り元を兼ねる)
//   → 「検索変更」「ページ変更」「初回読み込み」など複数の引き金を 1 本のパイプにまとめるのに便利
import { Subject, debounceTime, switchMap } from 'rxjs';
import { Category } from 'shared';
import { CategoryService } from '../../../services/category.service';

@Component({
  selector: 'app-category-list',
  imports: [
    DatePipe,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    ReactiveFormsModule,
  ],
  templateUrl: './category-list.html',
  styleUrl: './category-list.scss',
})
export class CategoryList implements OnInit {
  // CategoryService をフィールド注入
  private readonly categoryService = inject(CategoryService);

  // カテゴリ一覧の状態を signal で管理 (初期値は空配列)
  protected readonly categories = signal<Category[]>([]);
  // 通信中フラグ。テンプレート側で「読み込み中…」を出すために使う
  protected readonly loading = signal<boolean>(false);

  // 検索欄とバインドする FormControl
  //   テンプレート側で <input matInput [formControl]="searchControl"> として使う
  //   FormGroup を使わず単体で持てるのが FormControl の手軽さ
  //   protected にすることでテンプレートからアクセス可
  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });

  // ─────────────────────────────────────────────────────
  // ページング用の signal 群
  //   pageIndex: 現在のページ番号 (0 起点。0 = 1ページ目)
  //   pageSize:  1 ページあたりの件数 (paginator の [９s] と連動)
  //   total:     検索条件にマッチする全件数 (API レスポンスの total から)
  // ─────────────────────────────────────────────────────
  protected readonly pageIndex = signal<number>(0);
  protected readonly pageSize = signal<number>(10);
  protected readonly total = signal<number>(0);

  // ─────────────────────────────────────────────────────
  // mat-table 用: 表示する列の順序と識別子の配列
  //   テンプレート側の <ng-container matColumnDef="..."> の文字列と一致させる必要がある
  //   配列の順番が画面上の列の順番になる
  // ─────────────────────────────────────────────────────
  // 配列の順番がそのまま画面の列順になる。表示順は id とカテゴリ名の次に表示する。
  protected readonly displayedColumns = ['id', 'name', 'displayOrder', 'createdAt', 'actions'];

  // reload$: 「再取得してほしい」という合図を流すための Subject
  //   検索 / ページ変更 / 初回 / 削除後 などのどこからでも reload$.next() を呼べば
  //   下の switchMap が現在の signal を読んで getPage() を発行する仕組み
  //   → 複数の引き金を 1 本のパイプに集約できるので、状態の整合性が取りやすい
  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    // ① reload$ のパイプライン (完成形)
    //    next() が呼ばれるたびに現在の pageIndex / pageSize / 検索文字列を読み取って getPage() 発行
    //    switchMap なので、新しい reload が来たら前回の HTTP は破棄される (古い結果の混入防止)
    this.reload$
      .pipe(
        switchMap(() =>
          this.categoryService.getPage({
            page: this.pageIndex(),
            pageSize: this.pageSize(),
            // 空文字 / null は undefined に正規化 (API 側で q なしと同じ扱いにするため)
            q: this.searchControl.value || undefined,
          }),
        ),
      )
      .subscribe({
        next: (data) => {
          // 取得成功: items を一覧 signal に、total を total signal に詰める
          this.categories.set(data.items);
          this.total.set(data.total);
          this.loading.set(false);
        },
        error: (err) => {
          // 失敗時もローディングは消す (ずっと「読み込み中…」のままにしないため)
          console.error('カテゴリ取得に失敗:', err);
          this.loading.set(false);
        },
      });

    // ② 検索欄の値変更を監視
    //    debounceTime で連続入力を 300ms に間引いた後、
    //    pageIndex を 0 にリセット (3ページ目で検索したら 0 件、を防ぐ標準的 UX)
    //    最後に reload$.next() を呼んで上のパイプラインに発火させる
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.pageIndex.set(0);
      this.reload$.next();
    });

    // ③ 初回読み込み: loadCategories() 経由で reload$.next() を発火
    this.loadCategories();
  }

  // ─────────────────────────────────────────────────────
  // loadCategories(): 一覧を再取得する共通エントリポイント
  //   旧バージョンでは getAll() を直接呼んでいたが、Phase 9 で Subject トリガー方式に変更。
  //   現在の役割: loading 表示を立てて、reload$ にトリガーを流すだけ。
  //   実際の HTTP 発行は ngOnInit で組んだ reload$ のパイプラインが担う。
  // ─────────────────────────────────────────────────────
  loadCategories(): void {
    this.loading.set(true);
    this.reload$.next();
  }

  // ─────────────────────────────────────────────────────
  // ★ 穴埋め ToDo-1: onPageChange(event: PageEvent)
  //   役割: mat-paginator のページ変更イベントを受けて、signal を更新し reload$ に通知する
  //   PageEvent の主なフィールド:
  //     event.pageIndex … 新しいページ番号 (0 起点)
  //     event.pageSize  … 新しいページサイズ
  //   実装手順:
  //     1) this.pageIndex.set(event.pageIndex)
  //     2) this.pageSize.set(event.pageSize)
  //     3) this.reload$.next()  ← これで上のパイプラインが再発火して新ページを取得
  // ─────────────────────────────────────────────────────
  onPageChange(event: PageEvent): void {
    // TODO: ここに ① pageIndex 更新 ② pageSize 更新 ③ reload$.next() を書く
  }


  // ─────────────────────────────────────────────────────
  // TODO B: onDelete(category: Category) を実装する
  //   確認ダイアログ → 削除API呼び出し → 一覧再取得 の流れ
  //   1. window.confirm(...) で確認ダイアログを出す
  //      - 戻り値: OK→true, キャンセル→false
  //      - メッセージ例: `カテゴリ "${category.name}" を削除しますか？`
  //   2. true でなければ何もしないで return
  //   3. this.categoryService.delete(category.id).subscribe({ next, error })
  //   4. next の中で this.loadCategories() を呼んで一覧を再取得
  //   5. error の中で console.error
  onDelete(category: Category): void {
    // ① 削除前の確認ダイアログ: ブラウザ標準の confirm() で OK/キャンセルを問う
    //    バッククォート (テンプレートリテラル) なので ${category.name} が実際のカテゴリ名に置換される
    //    例: カテゴリ"毛糸"を削除しますか?
    const ok = window.confirm(`カテゴリ"${category.name}"を削除しますか?`);

    // ② キャンセル時 (ok=false) は何もせず関数を抜ける (早期 return)
    if (!ok) return;

    // ③ 削除APIを呼ぶ: DELETE /categories/:id
    //    Observable<void> なので next の引数も受け取らない (() の中身は空)
    this.categoryService.delete(category.id).subscribe({
      next: () => this.loadCategories(),                          // ④ 成功: 一覧を再取得して画面を最新化
      error: (err) => console.error('カテゴリ削除に失敗:', err),   // ⑤ 失敗: 原因を Console に出力
    });
  }

}
