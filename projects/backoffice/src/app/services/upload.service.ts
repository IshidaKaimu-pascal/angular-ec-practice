// UploadService: ファイルアップロード API (POST /uploads) を呼び出すサービス
// 商品画像だけでなく、将来カテゴリ画像など他リソースでも使えるよう
// ProductService から独立した汎用サービスとして切り出している。
//
// API 仕様 (Phase 2 で実装済み):
//   POST http://localhost:3000/uploads
//     Content-Type: multipart/form-data  (手動指定不要・後述)
//     field 名: file
//     許可 MIME: image/jpeg | image/png | image/webp
//     サイズ上限: 5MB
//   レスポンス: 201 + { url: "http://localhost:3000/static/uploads/xxx.jpg" }

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// @Injectable: このクラスを Angular の DI(依存注入) システムに登録するデコレータ
// providedIn: 'root' は「アプリ全体で1つのインスタンスを共有」(シングルトン)の意味
@Injectable({ providedIn: 'root' })
export class UploadService {
  // inject() 関数で HttpClient を取得（旧 constructor(private http: HttpClient) の新スタイル）
  private readonly http = inject(HttpClient);
  // API のエンドポイント URL (Express サーバーの /uploads)
  private readonly baseUrl = 'http://localhost:3000/uploads';

  // ─────────────────────────────────────────────────────
  // upload(): File オブジェクトをサーバーに送信し、保存後の URL を受け取る
  //   引数 file: <input type="file"> から取り出した File オブジェクト
  //   戻り値: Observable<{ url: string }> — subscribe で URL を取得して使う
  //
  // multipart/form-data の送信は FormData オブジェクトを使う:
  //   - HttpClient.post に FormData を渡すと「multipart/form-data; boundary=...」が
  //     自動で付与される (手動で Content-Type を指定すると boundary が抜けて壊れるので注意)
  //   - field 名 'file' は サーバー側 multer の upload.single('file') と一致させる必要がある
  // ─────────────────────────────────────────────────────
  upload(file: File): Observable<{ url: string }> {
    const form = new FormData();

    // FormData に 'file' という名前でファイル本体を追加 (この時点ではまだ送信していない)
    //   ※ サーバー側 multer の upload.single('file') と名前を合わせる必要がある
    form.append('file', file);

    // multipart/form-data として POST 送信。実際のアップロードはここで発生する
    return this.http.post<{ url: string }>(this.baseUrl, form);
  }
}
