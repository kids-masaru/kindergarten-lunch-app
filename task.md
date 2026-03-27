# 実装タスク：日次注文確認・配送計画ビュー

作成日: 2026-03-27
参照仕様: spec.md

---

## フェーズ構成

| フェーズ | 内容 | 優先度 |
|---|---|---|
| Phase 1 | エリアフィールド追加（基盤） | 高 |
| Phase 2 | バックエンドAPI追加 | 高 |
| Phase 3 | 注文一覧ビュー（フロントエンド） | 高 |
| Phase 4 | 配送リストビュー（フロントエンド） | 中 |

---

## Phase 1：エリアフィールド追加

### T-1-1：`KindergartenMaster` モデルに `area` フィールド追加
- **ファイル:** `backend/models.py`
- **変更:** `area: str = ""` を `KindergartenMaster` クラスに追加（`plan_type` の近くに配置）
- **確認:** 既存コードへの影響なし（デフォルト空文字なので後方互換）

### T-1-2：`get_kindergartens()` に `area` の読み込みを追加
- **ファイル:** `backend/sheets.py`
- **変更:** `data` ディクショナリに `"area": str(r.get("area", ""))` を追加（`plan_type` の下）
- **確認:** スプレッドシートに `area` カラムがなくてもエラーにならないこと

### T-1-3：`update_kindergarten_master()` に `area` を追加
- **ファイル:** `backend/sheets.py`
- **変更①:** `mapping` ディクショナリに `"area": "area"` を追加
- **変更②:** auto-create リストに `"area"` を追加
- **確認:** 保存時にスプレッドシートへ `area` が書き込まれること

### T-1-4：管理画面の幼稚園編集UIに `area` 入力欄を追加
- **ファイル:** `frontend/src/app/admin/menu/page.tsx`
- **対象:** `KindergartenEditor` コンポーネントの設定フォーム部分
- **変更:** `area` のテキスト入力フィールドを追加（エリア名・自由入力、プレースホルダー「例：北区、中央エリア」）
- **確認:** 入力・保存後に値が保持されること

---

## Phase 2：バックエンドAPI追加

### T-2-1：`GET /admin/daily-orders/{date}` エンドポイントを追加
- **ファイル:** `backend/api.py`
- **処理内容:**
  1. 全幼稚園を `get_kindergarten_master()` で取得
  2. 各園の当日の注文を `get_orders_for_month(kid_id, year, month)` で取得し `date` でフィルタ
  3. 注文ありの園・なしの園を含めて全園レスポンスを組み立てる
  4. 各園に `totals`（student/allergy/teacher/grand_total の合計）を計算して付与
  5. `area` フィールドも含める
- **レスポンス形式:** spec.md の「新バックエンドAPI」セクション参照
- **配置:** `/admin/orders/{year}/{month}` エンドポイントの下に追加

### T-2-2：`frontend/src/lib/api.ts` に API関数追加
- **変更:** `getDailyOrders(date: string)` 関数を追加
  ```typescript
  export const getDailyOrders = async (date: string) => {
      const res = await api.get(`/admin/daily-orders/${date}`);
      return res.data;
  };
  ```

---

## Phase 3：注文一覧ビュー（フロントエンド）

### T-3-1：`activeSection` に `'daily'` を追加
- **ファイル:** `frontend/src/app/admin/menu/page.tsx`
- **変更:** `useState` の型定義に `'daily'` を追加

### T-3-2：ダッシュボードに「今日の注文」カードを追加
- **ファイル:** `frontend/src/app/admin/menu/page.tsx`
- **対象:** ダッシュボードのカードグリッド部分（`activeSection === null` のブロック）
- **変更:** 新カード「今日の注文 / 注文確認・配送計画」を追加（`setActiveSection('daily')`）
- **デザイン:** 他の有効カードと同スタイル

### T-3-3：日次注文ステート変数を追加
- **ファイル:** `frontend/src/app/admin/menu/page.tsx`
- **追加するstate:**
  ```typescript
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dailyData, setDailyData] = useState<any | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyTab, setDailyTab] = useState<'list' | 'delivery'>('list');
  const [dailyShowAll, setDailyShowAll] = useState(false);
  ```

### T-3-4：注文一覧セクションのJSXを追加
- **ファイル:** `frontend/src/app/admin/menu/page.tsx`
- **対象:** `activeSection === 'daily'` の条件分岐ブロック（`activeSection === 'orders'` ブロックの後）
- **構成:**
  - ヘッダー：日付ピッカー（`<input type="date">`） + 読み込みボタン
  - タブ切り替え：「注文一覧」「配送リスト」
  - 注文一覧テーブル（T-3-5）
  - 配送リスト（Phase 4）

### T-3-5：注文一覧テーブルコンポーネントの実装
- **ファイル:** `frontend/src/app/admin/menu/page.tsx`（インライン or 同ファイル内関数コンポーネント）
- **表示内容:**
  - エリアでグループ化（`area` が空の場合は「エリア未設定」）
  - 各行：エリア・園名・クラス名・給食タイプ・園児数・アレルギー数・先生数・合計・メモ
  - クラスあり園：クラスごとに複数行
  - クラスなし園：1行
  - 注文なし園：`dailyShowAll` が true の場合のみ表示（グレーアウト）
  - 注文ありのみ/全園 切り替えボタン
  - 行ホバー時に園名をハイライト
- **スタイル:** 既存テーブルデザイン（印刷ビューのクラステーブル）に準拠

---

## Phase 4：配送リストビュー（フロントエンド）

### T-4-1：配送リスト表示の実装
- **ファイル:** `frontend/src/app/admin/menu/page.tsx`
- **表示内容（dailyTab === 'delivery' のとき）:**
  - エリアごとにブロック分け（エリア名をヘッダーとして太字）
  - 各行：番号・園名・合計食数（太字）・内訳（園児/先生）・給食タイプ
  - 最下部に当日の全体合計食数を表示
  - 注文なし園は非表示

### T-4-2：配送リストの印刷対応
- **変更:** 配送リストに「印刷」ボタンを追加
- **印刷用CSS:** A4縦、`.delivery-print-page` クラスにページ設定
- **印刷時の表示:** 日付ヘッダー・エリア別リスト・合計のみ表示（ボタン類は非表示）

---

## 実装順序と依存関係

```
T-1-1 → T-1-2 → T-1-3 → T-1-4   （エリア基盤）
                              ↓
T-2-1 → T-2-2                      （API）
                              ↓
T-3-1 → T-3-2 → T-3-3 → T-3-4 → T-3-5  （注文一覧UI）
                              ↓
T-4-1 → T-4-2                      （配送リストUI）
```

Phase 1 と Phase 2 はバックエンド中心なので、先に完成させてから Phase 3 に進む。

---

## 完了条件（Definition of Done）

### Phase 1
- [ ] 幼稚園マスター編集画面でエリアを入力・保存できる
- [ ] 保存後に画面を再表示してもエリアが消えない

### Phase 2
- [ ] `/admin/daily-orders/2026-03-27` を叩いて全園の当日注文が返ってくる
- [ ] `totals` が正しく計算されている（student + allergy + teacher = grand_total）

### Phase 3
- [ ] ダッシュボードに「今日の注文」カードが表示される
- [ ] 日付を選んで読み込むと注文テーブルが表示される
- [ ] エリアでグループ化されている
- [ ] 注文なし園の表示/非表示が切り替えられる

### Phase 4
- [ ] 配送リストタブに切り替えるとエリア別一覧が表示される
- [ ] 合計食数が正しく表示される
- [ ] 印刷ボタンでA4縦に印刷できる

---

## 備考

- エリアフィールドはスプレッドシートへの auto-create で対応するため、既存データへの影響なし
- 日付フィルタリングはバックエンドで実施（月次データ取得後にフィルタ）
- 配送順の固定・並び替えは今回スコープ外（将来タスク）
