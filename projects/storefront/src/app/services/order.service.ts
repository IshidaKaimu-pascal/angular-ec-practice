// OrderService: 注文関連のAPI呼び出しを集約するサービス
// POST /orders で注文確定、GET /orders で履歴取得。

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, PaymentMethod } from 'shared';
import { environment } from '../../environments/environment';

// 注文と支払い情報をまとめた型（POST /orders のリクエストボディ）
// PaymentMethod は shared 側で定義しているのを再利用 → Order レスポンス型と整合する
export interface CreateOrderPayload {
  userId: number;
  paymentMethod: PaymentMethod;
  shippingAddress: string;
  items: { productId: number; quantity: number }[];
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/orders`;

  // 注文を新規作成。サーバー側で Order + OrderItem がネステッドwriteで一括作成される。
  // 引数の型は CreateOrderPayload を利用する
  create(payload: CreateOrderPayload): Observable<Order> {
    return this.http.post<Order>(this.baseUrl, payload);
  }

  // 注文一覧を取得（userId で絞り込み可能）
  getAll(userId?: number): Observable<Order[]> {
    // userId があれば ?userId=X というクエリ文字列を付ける
    const url = userId !== undefined ? `${this.baseUrl}?userId=${userId}` : this.baseUrl;
    return this.http.get<Order[]>(url);
  }

  // 注文1件取得（履歴詳細画面用）
  getById(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/${id}`);
  }
}
