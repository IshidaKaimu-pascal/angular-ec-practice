// CartService: カートの状態（中身・合計）を管理する singleton サービス
// Signals ベースで状態を持ち、画面側は items() を読むだけで自動再描画される。
//
// Step 7-E-1 で localStorage 永続化を追加 (リロード後・サインイン跨ぎでカート内容を保持)。

import { Injectable, computed, signal } from '@angular/core';
import { Product } from 'shared';

// localStorage の保存キー (他の用途と衝突しないようプレフィックス付き)
const CART_STORAGE_KEY = 'storefront_cart';

// CartItem: カート内の1商品分（商品本体 + 数量）
// 「商品 ID + 数量」だけ持つ設計もあり得るが、画面表示で商品名・価格を毎回API取得するのは無駄なので
// ここでは Product オブジェクトをまるごと保持する設計にする。
export interface CartItem {
  product: Product;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  // private な書き込み可能 signal を内部で保持。
  // 外部にはこの後 readonly 版を公開して「サービス経由でしか書き換えられない」設計にする（カプセル化）。
  // 初期値は loadFromStorage() で localStorage から復元する (空なら []) → サインイン跨ぎ + リロード耐性
  private readonly _items = signal<CartItem[]>(this.loadFromStorage());

  // 外部公開用: 読み取り専用ビュー（呼び出し側からは items.set() などが見えない）
  readonly items = this._items.asReadonly();

  // computed: 元の signal が変わったら自動で再計算される派生 signal。
  // Toolbar のバッジで件数を表示する時にこれを使う。
  readonly totalQuantity = computed(() =>
    this._items().reduce((sum, item) => sum + item.quantity, 0)
  );

  // 合計金額（カート画面・購入確認画面で使う）
  readonly totalPrice = computed(() =>
    this._items().reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

  // 商品をカートに追加。既にあれば数量を加算する。
  add(product: Product, quantity: number = 1): void {
    const current = this._items();
    const existing = current.find((i) => i.product.id === product.id);

    if (existing) {
      // 既存項目の数量を増やす。新しい配列を作って渡す(イミュータブル更新)
      // signal は「参照が変わった」ことで変更検出するので、元配列を mutate せずに新配列を作るのが鉄則
      this._items.set(
        current.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      );
    } else {
      // スプレッド構文 [...current, newItem] で末尾に追加した新配列を作る
      this._items.set([...current, { product, quantity }]);
    }
    this.saveToStorage(); // Step 7-E-1: 永続化
  }

  // 指定商品をカートから完全削除
  remove(productId: number): void {
    this._items.set(this._items().filter((i) => i.product.id !== productId));
    this.saveToStorage(); // Step 7-E-1: 永続化
  }

  // 数量を直接変更。0以下が来たら削除扱い（マイナス在庫を防ぐ）
  updateQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) {
      // remove() 内で saveToStorage が呼ばれるのでここでは不要
      this.remove(productId);
      return;
    }
    this._items.set(
      this._items().map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
    this.saveToStorage(); // Step 7-E-1: 永続化
  }

  // カートを空にする（購入確定後に呼ぶ予定）
  clear(): void {
    this._items.set([]);
    this.saveToStorage(); // Step 7-E-1: 永続化 (空 [] を保存することで localStorage も空配列に置き換わる)
  }

  // ─────────────────────────────────────────────────────
  // 以下は Step 7-E-1 で追加した localStorage 連携の private メソッド
  // ─────────────────────────────────────────────────────

  // カートの中身を localStorage に書き込む (signal が変わるたびに呼ぶ)
  private saveToStorage(): void {
    //signal(items)をJSON化してlocalStorage(CART_STORAGE_KEY)に保存
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this._items()));
  }

  // localStorage からカートを復元 (constructor 相当のタイミングで _items の初期値に使う)
  // try/catch で「JSON が壊れていた」「ブラウザが localStorage を無効化している」等のケースに備える。
  private loadFromStorage(): CartItem[] {
    const json = localStorage.getItem(CART_STORAGE_KEY);
    if (!json) return []; // 初回アクセス時は何も入っていない
    try {
      return JSON.parse(json) as CartItem[];
    } catch {
      // パース失敗 → 壊れたデータを掃除して空カートにフォールバック
      // (前バージョンとの非互換等でデータが読めなくなった場合の保険)
      localStorage.removeItem(CART_STORAGE_KEY);
      return [];
    }
  }
}
