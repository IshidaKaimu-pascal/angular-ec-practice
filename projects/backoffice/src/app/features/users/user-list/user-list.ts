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
// Subject: 自分で .next() を呼んで値を流せる Observable (発行元と受け取り元を兼ねる)
//   → 「検索変更」「ページ変更」「初回読み込み」「削除後」など複数の引き金を 1 本のパイプにまとめる
// debounceTime: 連続して流れてくる値を一定時間 (ms) 静まったら最後の値だけ通す RxJS オペレーター
// switchMap : 新しい値が来たら「前回の Observable は破棄」して新しい Observable に切り替える
import { Subject, debounceTime, switchMap } from 'rxjs';
import { User } from 'shared';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-user-list',
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
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList implements OnInit {
  // UserService をフィールド注入
  private readonly userService = inject(UserService);

  // ユーザー一覧の状態を signal で管理 (初期値は空配列)
  protected readonly users = signal<User[]>([]);
  // 通信中フラグ。テンプレート側で「読み込み中…」を出すために使う
  protected readonly loading = signal<boolean>(false);

  // 検索欄とバインドする FormControl
  //   テンプレート側で <input matInput [formControl]="searchControl"> として使う
  //   氏名 + メールアドレスの OR 検索 (API 側で対応済み: Step 8-1)
  //   nonNullable: true で型を string に固定 (デフォルトは null も含む string | null)
  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });

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
  // 'role' 列は削除済み: User テーブルは customer 一色として扱う設計 (admin は別テーブル管理予定)
  protected readonly displayedColumns = ['id', 'name', 'email', 'phone', 'createdAt', 'actions'];

  // reload$: 「再取得してほしい」という合図を流すための Subject
  //   検索 / ページ変更 / 初回 / 削除後 などのどこからでも reload$.next() を呼べば
  //   下の switchMap が現在の signal を読んで getPage() を発行する仕組み
  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    // ① reload$ のパイプライン (完成形)
    //    next() が呼ばれるたびに現在の pageIndex / pageSize / 検索文字列を読み取って getPage() 発行
    //    switchMap なので、新しい reload が来たら前回の HTTP は破棄される (古い結果の混入防止)
    this.reload$
      .pipe(
        switchMap(() =>
          this.userService.getPage({
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
          this.users.set(data.items);
          this.total.set(data.total);
          this.loading.set(false);
        },
        error: (err) => {
          // 失敗時もローディングは消す (ずっと「読み込み中…」のままにしないため)
          console.error('ユーザー取得に失敗:', err);
          this.loading.set(false);
        },
      });

    // ② 検索欄の valueChanges 監視 (debounceTime + page=0 リセット)
    //    検索条件が変わったら必ず先頭あｑ２あｗ３せｒｔふｙｈじおｋぴ０うｙ７れｔｗ３ｙ６７う８９い０おー＾￥^^－０
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.pageIndex.set(0);
      this.reload$.next();
    });

    // ③ 初回読み込み: loadUsers() 経由で reload$.next() を発火
    this.loadUsers();
  }

  // ─────────────────────────────────────────────────────
  // loadUsers(): 一覧を再取得する共通エントリポイント
  //   Phase 9 で Subject トリガー方式に変更。
  //   現在の役割: loading 表示を立てて、reload$ にトリガーを流すだけ。
  //   実際の HTTP 発行は ngOnInit で組んだ reload$ のパイプラインが担う。
  // ─────────────────────────────────────────────────────
  loadUsers(): void {
    this.loading.set(true);
    this.reload$.next();
  }

  //ページ変更に伴い、signal を更新し reload$ に通知する
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.reload$.next();
  }

  // ─────────────────────────────────────────────────────
  // onDelete(user: User): 削除ボタン押下で呼ばれる
  //   確認ダイアログ → 削除API呼び出し → 一覧再取得 の流れ
  // ─────────────────────────────────────────────────────
  onDelete(user: User): void {
    const ok = window.confirm(`ユーザー${user.name}を削除しますか?`);
    // キャンセルの場合何もしない
    if (!ok) return;

    // 削除
    this.userService.delete(user.id).subscribe({
      // 成功の場合一覧を更新する
      next: () => this.loadUsers(),
      error: (err) => console.error('ユーザー削除に失敗:', err),
    });
  }
}
