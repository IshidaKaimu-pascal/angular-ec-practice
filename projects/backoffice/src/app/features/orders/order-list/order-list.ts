// OrderList: 注文履歴一覧画面 (Phase 11 本実装)
//
// Phase 9 で確立した Subject トリガー方式 + mat-paginator パターンを踏襲。
// 新概念は以下の 3 つ:
//   1. MatDatepickerModule / MatNativeDateModule で期間 from/to を入力
//   2. mat-select でユーザー / 支払い方法のドロップダウン選択
//   3. Date オブジェクト → ISO 文字列 (.toISOString()) で API に送る
//
// 穴埋め ToDo は 2 箇所:
//   ToDo-1: ngOnInit 内の「フィルタ 4 軸の valueChanges 監視」
//   ToDo-2: itemsSummary() メソッドの中身

import { Component, OnInit, inject, signal } from '@angular/core';
// ActivatedRoute: 現在の URL に紐付くルート情報 (パラメータ・クエリ等) を取得する Angular サービス
//   今回は queryParams (URL の ?xxx=yyy 部) を購読して購入者フィルタを自動セットするのに使う
import { ActivatedRoute } from '@angular/router';
// DatePipe:    テンプレートで {{ value | date:'yyyy-MM-dd HH:mm' }} の整形に使う
// DecimalPipe: テンプレートで {{ value | number }} の 3 桁カンマ整形に使う (合計金額表示用)
import { DatePipe, DecimalPipe } from '@angular/common';

// Material modules
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
// MatSelectModule: <mat-select> + <mat-option> でドロップダウン UI を作る
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
// MatDatepickerModule: <input matDatepicker> でカレンダー UI を提供する (新概念)
import { MatDatepickerModule } from '@angular/material/datepicker';
// MatNativeDateModule: JS の Date オブジェクトを扱う DateAdapter を提供 (Datepicker の動作に必須)
//   これがないと「No provider found for DateAdapter」エラーで Datepicker が動かない
//   英語ロケールで日付を表示するが、Phase 11 では一旦これで進める (日本語化は将来の課題)
import { MatNativeDateModule } from '@angular/material/core';

// Forms
import { FormControl, ReactiveFormsModule } from '@angular/forms';

// RxJS
// Subject: 「再取得して」の合図を流す呼び鈴
// switchMap: 新しい合図が来たら前回の HTTP は破棄して新しい HTTP に切り替える
import { Subject, switchMap } from 'rxjs';

// 型 (shared から)
//   PaymentMethod は 'cash_on_delivery' | 'convenience_store_payment' のリテラルユニオン
import { Order, PaymentMethod, User } from 'shared';

// Services
import { OrderService } from '../../../services/order.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-order-list',
  imports: [
    DatePipe,
    DecimalPipe,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatDatepickerModule,
    MatNativeDateModule,    // Datepicker の DateAdapter を提供 (必須)
    ReactiveFormsModule,
  ],
  templateUrl: './order-list.html',
  styleUrl: './order-list.scss',
})
export class OrderList implements OnInit {
  // ─── DI ───
  private readonly orderService = inject(OrderService);
  private readonly userService = inject(UserService);
  // ActivatedRoute: URL のクエリ (?userId=N 等) を読むために inject (Step 11-4)
  private readonly route = inject(ActivatedRoute);

  // ─── 注文一覧の状態 (signal) ───
  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal<boolean>(false);

  // ─── ユーザー一覧 (購入者 select の選択肢) ───
  // 初期表示時に UserService.getAll() で 1 回取得し、以降は再フェッチしない
  protected readonly users = signal<User[]>([]);

  // ─── ページング状態 ───
  protected readonly pageIndex = signal<number>(0);
  protected readonly pageSize = signal<number>(10);
  protected readonly total = signal<number>(0);

  // ─── フィルタ 4 軸の FormControl ───
  //   userControl:          選択中のユーザーID (null = 全ユーザー)
  //   dateFromControl:      期間の開始日 (Datepicker は Date オブジェクトを直接持つ)
  //   dateToControl:        期間の終了日
  //   paymentMethodControl: 支払い方法 (null = すべて)
  protected readonly userControl = new FormControl<number | null>(null);
  protected readonly dateFromControl = new FormControl<Date | null>(null);
  protected readonly dateToControl = new FormControl<Date | null>(null);
  protected readonly paymentMethodControl = new FormControl<PaymentMethod | null>(null);

  // ─── mat-table 用: 表示する列の順序と識別子 ───
  // テンプレート側の <ng-container matColumnDef="..."> の文字列と一致させる必要がある
  protected readonly displayedColumns = [
    'id',
    'orderedAt',
    'userName',
    'itemsSummary',
    'totalAmount',
    'paymentMethod',
  ];

  // ─── 支払い方法の select 用 options ───
  // value: API で使う英語キー / label: 画面表示用の日本語
  protected readonly paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'cash_on_delivery',           label: '代金引換' },
    { value: 'convenience_store_payment',  label: 'コンビニ払い' },
  ];

  // ─── reload$ Subject (Phase 9 パターン) ───
  // フィルタ変更 / ページ変更 / 初回読み込み のすべてから .next() を呼ぶ
  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    // ① reload$ パイプライン (完成形)
    //    next() のたびに現在の signal + FormControl 値を読み取って getPage() を発行
    //    switchMap なので、新しい reload が来たら前回の HTTP は破棄される (古い結果の混入防止)
    this.reload$
      .pipe(
        switchMap(() =>
          this.orderService.getPage({
            page: this.pageIndex(),
            pageSize: this.pageSize(),
            // null は undefined に正規化 (API 側で条件追加されない扱いになる)
            userId: this.userControl.value ?? undefined,
            // Date → ISO 文字列に変換 (.toISOString() は UTC の Z 付き文字列を返す)
            //   フロントは Datepicker の Date を持ち、送信時に文字列化するパターン
            //   ?. (optional chaining) で null のときは undefined になる
            dateFrom: this.dateFromControl.value?.toISOString(),
            dateTo: this.dateToControl.value?.toISOString(),
            paymentMethod: this.paymentMethodControl.value ?? undefined,
          }),
        ),
      )
      .subscribe({
        next: (data) => {
          // 取得成功: items を一覧 signal に、total を total signal に詰める
          this.orders.set(data.items);
          this.total.set(data.total);
          this.loading.set(false);
        },
        error: (err) => {
          // 失敗時もローディングは消す (ずっと「読み込み中…」のままにしないため)
          console.error('注文取得に失敗:', err);
          this.loading.set(false);
        },
      });

    // ② ユーザー一覧の取得 (購入者 select の選択肢用)
    this.userService.getAll().subscribe({
      next: (users) => this.users.set(users),
      error: (err) => console.error('ユーザー一覧取得に失敗:', err),
    });

    //変更が入った場合ページを最初に戻す
  
    //選択ユーザー
    this.userControl.valueChanges.subscribe(() => {
      this.pageIndex.set(0);
      this.reload$.next();
    });

    //期間の最初
    this.dateFromControl.valueChanges.subscribe(() => {
        this.pageIndex.set(0);
        this.reload$.next();  
    });

    //期間の最後
    this.dateToControl.valueChanges.subscribe(() => {
      this.pageIndex.set(0);
      this.reload$.next();
    });

    //支払方法
    this.paymentMethodControl.valueChanges.subscribe(() => {
      this.pageIndex.set(0);
      this.reload$.next();
    });

    //この画面に入った時点でのURLのクエリパラメータをチェック
    this.route.queryParams.subscribe((params) => {

      // userIdを取得し、数値に変換
      const userIdParam = params['userId'];
      if(userIdParam !== undefined){
        const userId = Number(userIdParam);
        //変換に成功したときsignalにセットする
        if(!Number.isNaN(userId)){
          this.userControl.setValue(userId);
        }
      }

      // ↑ ここまで ↑
    });

    // ⑤ 初回読み込み
    //    queryParams で userId が来た場合は setValue 経由でも reload が走るため、
    //    厳密には二重リクエストになる。簡潔さのため Phase 11 では許容 (実害は HTTP が 1 回多いだけ)。
    this.loadOrders();
  }

  // ─────────────────────────────────────────────────────
  // loadOrders(): 一覧を再取得する共通エントリポイント
  //   loading 表示を立てて、reload$ にトリガーを流すだけ。
  //   実際の HTTP 発行は ngOnInit で組んだ reload$ パイプラインが担う。
  // ─────────────────────────────────────────────────────
  loadOrders(): void {
    this.loading.set(true);
    this.reload$.next();
  }

  // ─── ページ変更ハンドラ (mat-paginator の (page) イベントから呼ばれる) ───
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.reload$.next();
  }

  // ─── 商品サマリを 1 行のテキストにまとめるヘルパー ───
  // テーブルの「商品」列で {{ itemsSummary(order) }} として呼ばれる。
  // 3 通りの分岐:
  //   商品 0 件      → '—' (フォールバック表示)
  //   商品 1 件      → 商品名そのまま
  //   商品 2 件以上  → 「商品名 ほか N 件」(N = items.length - 1)
  itemsSummary(order: Order): string {
    //商品の配列
    // ?? は null/undefined のフォールバック演算子。API の include 漏れ等で items が無い時の防御
    const items = order.items ?? [];
    // 0 件は早期 return で別扱い (空配列のまま items[0] にアクセスすると undefined でエラーになる)
    if(items.length === 0) return '—';

    // 代表となる 1 件目の商品名。product が未 include なら '(不明)' でフォールバック
    //   ?. (optional chaining): product が undefined でも .name アクセスでエラーにならない構文
    const firstName = items[0].product?.name ?? '(不明)';
    // 1 件だけならそのまま商品名を返す (「ほか 0 件」と表示されないように分岐)
    if(items.length === 1) return firstName;
    // 2 件以上は「商品名 ほか N 件」形式で要約
    //   テンプレートリテラル: バッククォート (` `) で囲み、`${変数}` で値を埋め込む文字列リテラル
    //   N は items.length - 1 (代表 1 件を除いた残り件数)
    return `${firstName} ほか ${items.length - 1} 件`;
  }

  // ─── 支払い方法の英語キー → 日本語ラベルに変換するヘルパー ───
  // テーブル表示で {{ paymentMethodLabel(order.paymentMethod) }} のように使う
  paymentMethodLabel(method: string): string {
    // find() で options から該当行を検索し、見つからなければ元の文字列を返す
    const option = this.paymentMethodOptions.find((opt) => opt.value === method);
    return option?.label ?? method;
  }
}
