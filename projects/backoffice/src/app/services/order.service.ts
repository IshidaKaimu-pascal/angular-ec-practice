// OrderService: 注文関連の API 呼び出しを集約するサービス
// user.service.ts / product.service.ts / category.service.ts と同じパターンで実装。
// (Phase 9 で確立した getPage() パターンを踏襲)
//
// Phase 11 では一覧画面でのページング + 絞り込みしか使わないので、まずは getPage() のみ実装。
// 詳細画面や削除など必要になったら順次メソッドを追加していく方針 (YAGNI)。

import { Injectable, inject } from '@angular/core';
// HttpParams: URL のクエリパラメータ (?page=N&dateFrom=... など) を安全に組み立てるクラス
//   文字列結合 (`${url}?...`) と違い、特殊文字 (空白・&・? 等) を自動でエスケープしてくれる
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
// shared から型を import: Order = 注文1件 / Paged<T> = { items: T[]; total: number }
import { Order, Paged } from 'shared';
import { environment } from '../../environments/environment';

// @Injectable: このクラスを Angular の DI(依存注入) システムに登録するデコレータ
// providedIn: 'root' は「アプリ全体で1つのインスタンスを共有」(シングルトン) の意味
@Injectable({ providedIn: 'root' })
export class OrderService {
  // inject() 関数で HttpClient を取得 (旧 constructor(private http: HttpClient) の新スタイル)
  private readonly http = inject(HttpClient);
  // API ベース URL (Express サーバーの /orders エンドポイント)
  private readonly baseUrl = `${environment.apiUrl}/orders`;


  // ページング + 絞り込み付きで注文一覧を取得
  //   サーバー側 (Step 11-1) は ?page= の有無で配列 / {items,total} を切り替える後方互換設計だが、
  //   この getPage() は常に ?page= を付けて呼ぶので必ず Paged<Order> が返る。
  //
  //   絞り込み軸:
  //     userId         … 特定ユーザーの履歴のみ取得 (Step 11-4 のユーザー詳細からの導線で使用)
  //     dateFrom/dateTo … 売上日時の範囲 (Datepicker の Date → ISO 文字列で送る想定)
  //     paymentMethod  … 'cash_on_delivery' / 'convenience_store_payment' など
  // HTTP メソッド: GET
  getPage(params: {
    page: number;
    pageSize: number;
    userId?: number;
    dateFrom?: string;        // ISO 文字列 ('2026-05-21T00:00:00Z') or 'YYYY-MM-DD'
    dateTo?: string;          // 同上
    paymentMethod?: string;   // 'cash_on_delivery' など
  }): Observable<Paged<Order>> {
    // HttpParams は immutable: .set() は新しいインスタンスを返すので再代入で連鎖させる
    //   String(...) で数値を文字列化: URL クエリは文字列しか持てないため
    let httpParams = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    // optional パラメータは「値があるときだけ」追加する
    //   userId は数値型なので !== undefined で判定 (0 を有効値として扱える)
    //   他は string なので truthy 判定 (空文字も除外したい)
    if (params.userId !== undefined) httpParams = httpParams.set('userId', String(params.userId));
    if (params.dateFrom)             httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo)               httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.paymentMethod)        httpParams = httpParams.set('paymentMethod', params.paymentMethod);
    return this.http.get<Paged<Order>>(this.baseUrl, { params: httpParams });
  }
}
