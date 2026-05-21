// /uploads エンドポイントの定義。
// ============================================================
// 役割: クライアント (backoffice の商品編集画面) から送られてきた
//       画像ファイルを受け取り、api/public/uploads/ に保存して
//       公開URL (`/static/uploads/...`) を返す。
//
// 関連: index.ts で express.static('/static', api/public) を設定済み。
//       ここで保存したファイルは即座に /static/uploads/xxx.jpg として
//       ブラウザから取得できる。
//
// 学習メモ:
//   - multipart/form-data: ファイルとフォーム値を 1 リクエストで送る形式。
//     普通の JSON POST と違い、ブラウザの <form enctype="multipart/form-data">
//     や FormData オブジェクトで送られる。Express の express.json() では
//     パースできないため、multer ミドルウェアを使う。
//   - multer は「ディスクに保存する disk storage」「メモリに置く memory storage」
//     を選べる。ここでは練習用にシンプルな disk storage を使う。
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const router = Router();

// ────────────────────────────────────────────────
// 保存先のフォルダパス
//   __dirname は dev (tsx で api/src/routes/uploads.ts を実行) では
//   api/src/routes、build後 (dist/routes/uploads.js) では api/dist/routes。
//   どちらからでも api/public/uploads にたどり着くよう「3階層上 + public/uploads」を解決する。
// ────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads');

// 起動時にフォルダが無ければ作成 (multer は destination が無いとエラーになるため)
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ────────────────────────────────────────────────
// multer の disk storage 設定
// ────────────────────────────────────────────────
const storage = multer.diskStorage({
  // 保存先のフォルダを返す callback
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  // 保存時のファイル名を決める callback
  filename: (_req, file, cb) => {
    //ファイル名の重複・衝突を防ぐため、ファイル名に日付とランダムな文字列を入れる
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

// ────────────────────────────────────────────────
// 受け付ける MIME タイプの許可リスト
//   ※ ブラウザは拡張子で判定するので 100% 信頼はできない (拡張子偽装可能)
//      本格運用なら magic bytes (ファイル先頭の数バイト) で判定する。
//      ここは練習なので allowlist のみ。
// ────────────────────────────────────────────────
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// multer インスタンス: storage + ファイルサイズ上限 + MIME フィルタ
const upload = multer({
  storage,
  // 5MB を超えるファイルは MulterError ('LIMIT_FILE_SIZE') で拒否される
  limits: { fileSize: 5 * 1024 * 1024 },
  // ファイルが届くたびに呼ばれる検査 callback
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true); // 受け入れる
    } else {
      cb(new Error(`許可されていない MIME タイプです: ${file.mimetype}`));
    }
  },
});

// ────────────────────────────────────────────────
// POST /uploads
//   フィールド名 "file" の単一ファイルを受け取る (form-data 必須)
//   レスポンス: { url: "http://localhost:3000/static/uploads/xxx.jpg" }
//
//   TODO (将来課題): admin 認証を追加 (現状は誰でもアップロード可)
// ────────────────────────────────────────────────
router.post(
  '/',
  upload.single('file'), // ← 'file' という名前で 1 個受け取る
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // multer がファイルを受け取れていない (フィールド名違い等)
      if (!req.file) {
        res.status(400).json({ error: 'ファイルがありません (field 名は "file")' });
        return;
      }

      // URL を組み立てて返す
      const url = `http://localhost:3000/static/uploads/${req.file.filename}`;
      res.status(201).json({ url });
      
    } catch (err) {
      next(err); // Express の共通エラーハンドラ (index.ts) に渡す
    }
  }
);

// ────────────────────────────────────────────────
// このルート専用のエラーハンドラ
//   multer が投げる MulterError (サイズ超過等) と fileFilter で throw した Error をここで捕捉。
//   index.ts の汎用ハンドラより前にマッチさせるため、ルーター末尾に置く。
// ────────────────────────────────────────────────
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    // multer 由来 (サイズ超過、想定外フィールド名 等)
    res.status(400).json({ error: 'アップロード失敗', code: err.code, message: err.message });
    return;
  }
  if (err instanceof Error) {
    // fileFilter で throw した Error (MIME 拒否 等)
    res.status(400).json({ error: 'アップロード失敗', message: err.message });
    return;
  }
  res.status(500).json({ error: '不明なエラー' });
});

export default router;
