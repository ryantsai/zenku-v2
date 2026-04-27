# 視圖型態與欄位控制項 (View Types & Field Controls)

> 本文件定義了 Zenku 支援的 UI 表現形式與資料輸入規範，確保 AI 能生成符合業務邏輯的介面。

---

## 1. 視圖型態 (View Types)

Zenku 提供多種畫布型態來呈現不同維度的資料：

| 型態 | 適用場景 | 關鍵配置參數 |
| :--- | :--- | :--- |
| `table` | 基礎 CRUD 列表。 | `columns`, `actions` |
| `master-detail` | 主從表管理（如訂單+明細）。 | `detail_views` (陣列) |
| `dashboard` | 數據視覺化與統計。 | `widgets` (stat, bar, line, pie) |
| `kanban` | 流程管理與狀態追蹤。 | `group_field`, `title_field` |
| `calendar` | 時間維度排程。 | `date_field`, `title_field` |
| `timeline` | 事件演進歷程。 | `date_field`, `icon_field` |
| `gallery` | 卡片式圖片展示。 | `image_field`, `title_field` |
| `tree` | 層級結構（如組織架構）。 | `parent_field` |
| `gantt` | 專案進度與排程。 | `start_field`, `end_field`, `progress` |
| `form-only` | 純表單模式，用於特定流程。 | `form.fields` |

---

## 2. 欄位型態與控制項 (Field Types)

系統支援豐富的控制項，透過 `FieldDef.type` 指定：

### 基礎輸入
*   `text`, `number`, `textarea`：基礎文字、數字與長文本。
*   `boolean`：切換開關 (Switch)。
*   `date`, `datetime`, `time`：日期時間選擇器。

### 進階控制項
*   `select`, `multiselect`：下拉選單（支援靜態 `options` 或動態 `source`）。
*   `currency`：金額輸入，支援自動格式化。
*   `richtext`, `markdown`：富文本與 Markdown 編輯器 (Tiptap / CodeMirror)。
*   `phone`, `email`, `url`：具備基礎格式驗證的輸入框。
*   `rating`, `progress`, `color`：星級、進度條、顏色選擇器。

---

## 3. 特殊欄位配置

### 關聯欄位 (`relation`)
專用於選取其他資料表的記錄（外鍵映射）：
*   `table`：關聯的目標表。
*   `value_field`：存入 DB 的值（通常為 `id`）。
*   `display_field`：顯示在介面上的欄位（如 `name`）。
*   `display_format`：支援組合顯示，例如 `{name} ({phone})`。

### 自動編號 (`auto_number`)
用於生成唯一編碼（如單號）：
*   `prefix`：前綴（如 `ORD-`）。
*   `date_format`：日期段（如 `YYYYMMDD`）。
*   `padding`：流水號長度。
*   `reset`：重置週期（每日、每月、每年或從不）。

### 計算欄位 (`computed`)
前端即時計算的欄位：
*   `formula`：運算公式（如 `quantity * price`）。
*   `dependencies`：依賴的欄位清單，當依賴項變動時自動重算。
