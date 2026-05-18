// AuthService: サインイン中のユーザー情報を一元管理するサービス
// 今は固定ユーザーのダミー実装。後で本物の認証(JWT)を入れる際は、ここを
// 「APIから取得 / ログアウト / トークン管理」のロジックに差し替える予定。

import { Injectable, signal } from '@angular/core';
import { User } from 'shared';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // 仮のサインイン中ユーザー。住所も設定済(購入手続き画面の表示用)。
  // signal で持つことで「将来 setCurrentUser(user) で差し替えた時に画面が自動更新」される。
  private readonly _currentUser = signal<User>({
  id: 4,
  name: '田中ゆうこ',
  email: 'yuko@example.com',
  role: 'customer',
  address: null,                    // ← TODO H の警告表示確認用
  phone: '090-5555-6666',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});


  // 外部公開用: 読み取り専用ビュー（書き換えは AuthService 経由のみ）
  readonly currentUser = this._currentUser.asReadonly();

  // サインアウト処理。今はログ出力だけ。
  // 後で AuthService が本格化したら、トークン破棄・/sign-in へリダイレクト等を行う。
  signOut(): void {
    console.log('サインアウトが押されました');
  }
}
