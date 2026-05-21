// ProductService: 商品関連の API 呼び出しを集約するサービス
// コンポーネントから直接 HttpClient を使うのではなく、サービス経由にすることで
//   - コンポーネントが「どこから取得するか」を知らなくて済む（疎結合）
//   - 同じ API 呼び出しを複数コンポーネントで共有しやすい
//   - 後でモック実装に差し替えやすい（テスト時）
// という設計上のメリットがある。

import { Injectable, inject } from '@angular/core';
// HttpParams: URL のクエリパラメータ (?q=xxx&categoryId=1 など) を安全に組み立てるためのクラス
//   文字列結合 (`${url}?q=${q}`) と違い、特殊文字 (空白・&・? 等) を自動でエスケープしてくれる
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, Paged } from 'shared';

// ─────────────────────────────────────────────────────
// Payload 型 (API への送信 body の形)
//   shared 側の Product 型から id / createdAt / updatedAt / category を除いた、
//   フォームで入力する部分だけの型。
//
//   description / imageUrl は string | null:
//     未入力は null として送る (空文字ではなく null にすることで DB 側も NULL になる)
//
//   Create と Update で別の型にする理由:
//     - Create: 必須項目 (name/price/stock/categoryId) を「必須」として扱いたい
//     - Update: 部分更新 (一部のフィールドだけ変える) も許したいので全て optional に
// ─────────────────────────────────────────────────────
export interface CreateProductPayload {
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  stock: number;
  categoryId: number;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  stock?: number;
  categoryId?: number;
}

// @Injectable: このクラスを Angular の DI(依存注入) システムに登録するデコレータ
// providedIn: 'root' は「アプリ全体で1つのインスタンスを共有」(シングルトン)の意味
@Injectable({ providedIn: 'root' })
export class ProductService {
  // inject() 関数で HttpClient を取得（旧 constructor(private http: HttpClient) の新スタイル）
  private readonly http = inject(HttpClient);
  // API ベース URL (Express サーバーの /products エンドポイント)
  private readonly baseUrl = 'http://localhost:3000/products';


  // 全商品一覧を取得して Observable<Product[]> を返す
  //   引数なし    : SELECT * FROM products;
  //   categoryId のみ: SELECT * FROM products WHERE categoryId = :categoryId;
  //   q のみ      : SELECT * FROM products WHERE name LIKE '%q%';
  //   両方指定    : SELECT * FROM products WHERE categoryId = :categoryId AND name LIKE '%q%';
  //   ※ AND 結合は API 側 (Step 8-1) で実装済み。フロントは両方をクエリに乗せるだけ。
  // HTTP メソッド: GET
  getAll(categoryId?: number, q?: string): Observable<Product[]> {
    // HttpParams はイミュータブル: .set() は新しいインスタンスを返すので必ず代入で受け直す
    //   undefined / null / 空文字のときはそのキー自体を付けない (= サーバー側で「未指定」と判定)
    let params = new HttpParams();
    if (categoryId != null) {
      // != null は「null と undefined の両方を弾く」TypeScript の慣用句 (=== ではない点に注意)
      params = params.set('categoryId', String(categoryId));
    }
    if (q) {
      params = params.set('q', q);
    }
    return this.http.get<Product[]>(this.baseUrl, { params });
  }


  // ページング版: ?page=N&pageSize=M(&categoryId=...)(&q=...) を付けて API を呼び、Paged<Product> を返す
  //   getAll() との違い: レスポンスが配列ではなく {items, total} のオブジェクト形
  //   サーバー側は ?page= の有無で配列 / オブジェクトを切り替える後方互換設計 (Step 9-1)
  //   categoryId / q は両方とも optional、両方指定すれば API 側で AND 結合される
  // HTTP メソッド: GET
  getPage(params: {
    page: number;
    pageSize: number;
    categoryId?: number;
    q?: string;
  }): Observable<Paged<Product>> {
    // page と pageSize は必須なので最初にセット (HttpParams は immutable: set すると新インスタンスを返す)
    //   String(...) で数値を文字列化: URL クエリは文字列しか持てないため
    let httpParams = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    // categoryId が指定されていれば追加 (null/undefined は除外)
    //   != null は「null と undefined の両方を弾く」TypeScript の慣用句
    if (params.categoryId != null) {
      httpParams = httpParams.set('categoryId', String(params.categoryId));
    }
    // q が指定されていれば検索クエリも追加 (空文字 / undefined / null は除外)
    if (params.q) {
      httpParams = httpParams.set('q', params.q);
    }
    return this.http.get<Paged<Product>>(this.baseUrl, { params: httpParams });
  }


  // 指定IDの商品1件を取得して Observable<Product> を返す (SELECT * FROM products WHERE id = :id;)
  // HTTP メソッド: GET
  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }


  // 商品を新規作成し、作成された商品を Observable<Product> で返す
  // (INSERT INTO products (...) VALUES (...);)
  // HTTP メソッド: POST
  create(payload: CreateProductPayload): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, payload);
  }


  // 指定IDの商品を更新し、更新後の商品を Observable<Product> で返す
  // (UPDATE products SET ... WHERE id = :id;)
  // HTTP メソッド: PUT
  update(id: number, payload: UpdateProductPayload): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/${id}`, payload);
  }


  // 指定IDの商品を削除する。レスポンスは無し (DELETE FROM products WHERE id = :id)
  // ジェネリクスに void を指定するのは「レスポンスボディなし」の表明
  // HTTP メソッド: DELETE
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
