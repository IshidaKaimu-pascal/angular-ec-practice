// ProductService: 商品関連のAPI呼び出しを集約するサービス
// コンポーネントから直接 HttpClient を使うのではなく、サービス経由にすることで
//   - コンポーネントが「どこから取得するか」を知らなくて済む（疎結合）
//   - 同じAPI呼び出しを複数コンポーネントで共有しやすい
//   - 後でモック実装に差し替えやすい（テスト時）
// という設計上のメリットがある。

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from 'shared';

// @Injectable: このクラスを Angular の DI(依存注入) システムに登録するデコレータ
// providedIn: 'root' は「アプリ全体で1つのインスタンスを共有」(シングルトン)の意味
@Injectable({ providedIn: 'root' })
export class ProductService {
  // inject() 関数で HttpClient を取得（旧 constructor(private http: HttpClient) の新スタイル）
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/products';

  // 全商品一覧を取得
  // 戻り値の Observable<Product[]> は「将来的に Product[] が流れてくるストリーム」
  // 呼び出し側で .subscribe(...) するか、async pipe (template内 | async) で受け取る
  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  // 商品1件取得
  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`)
  }
}

























