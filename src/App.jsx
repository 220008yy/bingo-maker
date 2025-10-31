import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
import { toPng } from "html-to-image";

function useContainerWidth(ref, fallback = 1200) {
  const [w, setW] = useState(fallback);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setW(rect.width);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return w;
}

// Vite の公開環境変数。未設定なら空文字
const CSV_URL =
  import.meta.env.VITE_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8pNlLicJUxrBmaemHVE_5C-Eq5d6JLoRZnVU16n2Cguxk6vw-ZJZ_E8A5wzpRMFgAVoa8_MVoCObH/pub?output=csv";

/**
 * ビンゴカード自動生成（ギャラリー選択 & クリック配置 対応版）
 * - 5x5 固定
 * - ギャラリーからアイテムを選び、盤面セルをクリックして配置
 * - ランダム配置ボタン
 * - 背景の色/模様（プリセット or CSSカスタム）
 * - PNGとしてダウンロード
 *
 * 使い方
 * 1) 左のCSV欄に「画像URL,点数,ラベル」を1行1アイテムで貼る
 * 2) 右のギャラリーに一覧表示 → クリックで選択（縁が太くなります）
 * 3) 盤面のセルをクリックするとそのアイテムを配置
 * 4) ランダム配置 / 全消去 / PNG保存 ボタンを利用
 */

const PRESET_BACKGROUNDS = [
  {
    name: "やわらかグラデ",
    css: "linear-gradient(180deg,#f8fafc 0%,#eef2ff 100%)",
  },
  {
    name: "パール",
    css: "radial-gradient(circle at 30% 20%,#ffffff,#eef2ff 60%,#e2e8f0)",
  },
  {
    name: "ミント",
    css: "linear-gradient(135deg,#ecfeff 0%,#cffafe 50%,#a7f3d0 100%)",
  },
  {
    name: "ピンク",
    css: "linear-gradient(135deg,#fff1f2 0%,#ffe4e6 50%,#fecdd3 100%)",
  },
  {
    name: "市松(薄)",
    css: "repeating-linear-gradient(45deg,#fff 0 20px,#f1f5f9 20px 40px),repeating-linear-gradient(-45deg,#0000 0 20px,#f1f5f980 20px 40px)",
  },

  // 追加プリセット
  {
    name: "夏空",
    css: "linear-gradient(180deg,#93c5fd 0%,#bfdbfe 50%,#e0f2fe 100%)",
  },
  { name: "夕焼け", css: "linear-gradient(180deg,#fda4af 0%,#fbbf24 100%)" },
  {
    name: "星砂",
    css: "radial-gradient(#fff2 1px, transparent 1px), radial-gradient(#fff2 1px, transparent 1px), linear-gradient(180deg,#0ea5e9 0%,#1e293b 100%)",
  },
  {
    name: "紙",
    css: "repeating-linear-gradient(0deg,#fff 0 3px,#f8fafc 3px 6px)",
  },
  {
    name: "ドット",
    css: "radial-gradient(circle,#e2e8f0 1px,transparent 1px) 0 0/20px 20px, radial-gradient(circle,#e2e8f0 1px,transparent 1px) 10px 10px/20px 20px, #ffffff",
  },
];

// 既存の parseCsv はそのまま残してOK（手入力CSV用）
// ↓ これを parseCsv の後ろなどに追加

function parseCsvLoose(csv) {
  const lines = (csv || "").trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const first = (lines[0] || "").toLowerCase();
  const hasHeader = ["img", "score", "label"].every((k) => first.includes(k));
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows.map((l, id) => {
    const [img, score, label, active, startAt, endAt, tags] = (l || "").split(
      ","
    );
    return {
      id,
      img: (img || "").trim(),
      score: Number(score) || 0,
      label: (label || "").trim(),
      active: String(active ?? "true").toLowerCase() !== "false",
      startAt: (startAt || "").trim() || null,
      endAt: (endAt || "").trim() || null,
      tags: (tags || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  });
}

function isAvailable(item, now = new Date()) {
  if (item.active === false) return false;
  const start = item.startAt ? new Date(item.startAt) : null;
  const end = item.endAt ? new Date(item.endAt) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

export default function BingoMaker() {
  // ▼ 運営向け設定UIを出すかどうか（?dev=1 のときだけ表示）
  // どれを表示するかの切替（運営はクエリ ?dev=1 で管理UIを出す想定）
  const isDev =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("dev") === "1";

  // 外部CSV利用フラグ & 取得データ
  const [useRemote, setUseRemote] = useState(true);
  const [remoteCsv, setRemoteCsv] = useState("");

  // 外部CSVを取得
  useEffect(() => {
    if (!useRemote) return;
    (async () => {
      try {
        const res = await fetch(CSV_URL, { cache: "no-store" });
        const text = await res.text();
        setRemoteCsv(text);
      } catch (e) {
        console.error("CSV fetch failed", e);
      }
    })();
  }, [useRemote]);

  // CSV_URLは定数なので依存配列に入れなくてOK

  const [csv, setCsv] = useState("");
  const csvData = useMemo(() => parseCsvLoose(csv), [csv]);
  const remoteData = useMemo(() => parseCsvLoose(remoteCsv), [remoteCsv]);
  const now = new Date();
  const items = (useRemote ? remoteData : csvData).filter((it) =>
    isAvailable(it, now)
  );

  const title = "BINGO";
  const [subTitle, setSubTitle] = useState("");
  const [imgScale, setImgScale] = useState(0.8); // セルに対する画像サイズの比率（0.6〜1.0）
  const [fitMode, setFitMode] = useState("contain"); // contain=余白あり / cover=トリミング
  const [bg, setBg] = useState(PRESET_BACKGROUNDS[0].css);
  const [bgCustom, setBgCustom] = useState("");
  const [cellSize, setCellSize] = useState(180);
  const [showScore, setShowScore] = useState(true);
  const [roundImg, setRoundImg] = useState(true);
  const [useUnique, setUseUnique] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [titleColor, setTitleColor] = useState("#111827"); // BINGO文字色 (初期: slate-900)
  const [gridGap, setGridGap] = useState(12); // px（お好みで初期値を増減）
  const [maxScore, setMaxScore] = useState(null); // 例: 10000 を入れたら 10000 以下だけ
  const [subTitleColor, setSubTitleColor] = useState("#475569"); // 初期: slate-600
  const [subTitleSize, setSubTitleSize] = useState(16); // px（fontScaleと乗算される）
  const [selected, setSelected] = useState(null); // ギャラリーで選択されたアイテムid
  const emptyBoard = useMemo(() => Array(25).fill(null), []);
  const [board, setBoard] = useState(emptyBoard);

  const bingoRef = useRef(null);

  const placeAt = (idx) => {
    if (selected == null) return;
    const item = items.find((d) => d.id === selected);
    if (!item) return;
    if (useUnique) {
      // 既に盤面に存在していないかチェック
      const exists = board.some((b) => b?.id === item.id);
      if (exists)
        return alert("このアイテムは既に使われています（重複禁止ON）");
    }
    const next = board.slice();
    next[idx] = item;
    setBoard(next);
  };

  const clearAt = (idx) => {
    const next = board.slice();
    next[idx] = null;
    setBoard(next);
  };

  const clearAll = () => setBoard(emptyBoard);

  const randomFill = () => {
    if (items.length === 0) return;

    const poolAll =
      maxScore != null
        ? items.filter((d) => (Number(d.score) || 0) <= maxScore)
        : items.slice();

    if (poolAll.length === 0) {
      alert("指定した上限以下のアイテムがありません");
      return;
    }

    const pool = shuffle(poolAll);

    let filled = [];
    if (useUnique) {
      // まずユニークで可能なだけ埋める
      filled = pool.slice(0, Math.min(25, pool.length));
      // まだ足りない分はランダム補完（重複可）
      while (filled.length < 25) {
        filled.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    } else {
      // 重複あり：ランダムに25個
      for (let i = 0; i < 25; i++) {
        filled.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }

    setBoard(filled);
  };
  // iOS / iOS版Chrome(CriOS) 判定（ビルド/SSR対策のガード付き）
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iP(hone|ad|od)/.test(ua);
  const isIOSChrome = /\bCriOS\//.test(ua);

  const savePng = async () => {
    if (!bingoRef.current) return;

    // iOSのポップアップブロック対策：先に空タブを開いておく
    let preOpenedWin = null;
    if (isIOS || isIOSChrome) {
      preOpenedWin = window.open("", "_blank");
    }

    const dataUrl = await toPng(bingoRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      filter: (node) =>
        !(node.classList && node.classList.contains("no-export")),
    });

    // まずは Web Share Level 2（ファイル共有）が使えるならそれで保存
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "bingo.png", { type: "image/png" });

      // 型チェック回避しつつ実体で判定
      /** @type {any} */ const nav = navigator;

      if (
        typeof nav.share === "function" &&
        typeof nav.canShare === "function" &&
        nav.canShare({ files: [file] })
      ) {
        await nav.share({ files: [file], title: "Bingo" });
        if (preOpenedWin && !preOpenedWin.closed) preOpenedWin.close();
        return;
      }
    } catch {
      // 共有できなければ下のフォールバックへ
    }

    // iOS系は <a download> が効かないことがある → 新規タブで開いて長押し保存してもらう
    if (isIOS || isIOSChrome) {
      const w = preOpenedWin || window.open("", "_blank");
      if (w) {
        w.document.write(`
        <html><head>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>画像を保存</title>
          <style>
            body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh}
            img{max-width:100%;height:auto}
            .hint{position:fixed;left:0;right:0;bottom:12px;color:#fff;text-align:center;font:14px -apple-system,system-ui,Segoe UI}
          </style>
        </head>
        <body>
          <img id="img" alt="bingo"/>
          <div class="hint">画像を<strong>長押し</strong>→「写真に追加」で保存</div>
          <script>document.getElementById('img').src='${dataUrl}';</script>
        </body></html>
      `);
        w.document.close();
        return;
      }
    }

    // それ以外のブラウザは通常のダウンロードが有効
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "bingo.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const bgCss = bgCustom?.trim() ? bgCustom : bg;

  return (
    <div className="min-h-screen p-6 md:p-10 bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto grid gap-6 px-3 place-items-center">
        <header className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              ビンゴカード自動生成
            </h1>
            <p className="text-sm text-slate-600">
              ギャラリーから選択して盤面に配置 / ランダム配置 / PNG保存
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white"
              onClick={randomFill}
              disabled={items.length === 0}
            >
              ランダム配置
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-rose-600 text-white"
              onClick={clearAll}
            >
              全消去
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
              onClick={savePng}
            >
              PNG保存
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 place-items-center">
          {/* 設定（CSVだけ運営向け、他は常時表示） */}
          <section className="grid gap-3">
            {/* ▼▼▼ ここ（CSV関連ブロック）だけ isDev で隠す ▼▼▼ */}
            {isDev && (
              <div className="grid gap-3">
                <label className="text-sm font-semibold">
                  CSV（画像URL,点数,ラベル）
                </label>

                {/* 外部CSVモードトグル（運営だけ） */}
                <label className="px-2 py-2 text-xs flex items-center gap-2 border rounded-xl">
                  <input
                    type="checkbox"
                    checked={useRemote}
                    onChange={(e) => setUseRemote(e.target.checked)}
                  />
                  外部CSVモード
                </label>

                {/* 手動CSVテキストエリア（運営だけ） */}
                <textarea
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  className="min-h-[220px] w-full rounded-xl border border-slate-300 p-3 font-mono text-sm"
                  placeholder="https://example/icon.png,500,ラベル"
                />
              </div>
            )}
            {/* ▲▲▲ CSV関連はここまで（ユーザーから隠れる） ▲▲▲ */}

            {/* ここから下の“色/スライダー/ドロップダウン”は常に表示 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label className="text-xs font-semibold">BINGO文字色</label>
                <input
                  type="color"
                  value={titleColor}
                  onChange={(e) => setTitleColor(e.target.value)}
                  className="h-9 w-16 p-1 rounded-md border border-slate-300"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">サブタイトル</label>
                <input
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  className="rounded-xl border border-slate-300 p-2"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">サブタイトル色</label>
                <input
                  type="color"
                  value={subTitleColor}
                  onChange={(e) => setSubTitleColor(e.target.value)}
                  className="h-9 w-16 p-1 rounded-md border border-slate-300"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">
                  サブタイトル文字サイズ（px）
                </label>
                <input
                  type="number"
                  min={8}
                  max={64}
                  value={subTitleSize}
                  onChange={(e) => setSubTitleSize(Number(e.target.value))}
                  className="rounded-xl border border-slate-300 p-2"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">
                  セルの一辺（px）
                </label>
                <input
                  type="number"
                  min={120}
                  max={360}
                  value={cellSize}
                  onChange={(e) => setCellSize(Number(e.target.value))}
                  className="rounded-xl border border-slate-300 p-2"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">マス間隔（px）</label>
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={gridGap}
                  onChange={(e) => setGridGap(Number(e.target.value))}
                  className="rounded-xl border border-slate-300 p-2"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">点数を表示</label>
                <select
                  value={showScore ? "on" : "off"}
                  onChange={(e) => setShowScore(e.target.value === "on")}
                  className="rounded-xl border border-slate-300 p-2"
                >
                  <option value="on">表示する</option>
                  <option value="off">表示しない</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">画像の角丸</label>
                <select
                  value={roundImg ? "on" : "off"}
                  onChange={(e) => setRoundImg(e.target.value === "on")}
                  className="rounded-xl border border-slate-300 p-2"
                >
                  <option value="on">角丸</option>
                  <option value="off">四角</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">
                  重複を許可しない
                </label>
                <select
                  value={useUnique ? "on" : "off"}
                  onChange={(e) => setUseUnique(e.target.value === "on")}
                  className="rounded-xl border border-slate-300 p-2"
                >
                  <option value="off">許可する</option>
                  <option value="on">許可しない</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">フォント倍率</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.6}
                  max={2}
                  value={fontScale}
                  onChange={(e) => setFontScale(Number(e.target.value))}
                  className="rounded-xl border border-slate-300 p-2"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">
                  画像サイズ（セル比）
                </label>
                <input
                  type="range"
                  min={0.6}
                  max={1}
                  step={0.05}
                  value={imgScale}
                  onChange={(e) => setImgScale(Number(e.target.value))}
                />
                <div className="text-[11px] text-slate-500">
                  {Math.round(imgScale * 100)}%
                </div>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">
                  ランダムのスコア上限（空で無制限）
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="例: 10000"
                  value={maxScore ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setMaxScore(v === "" ? null : Number(v));
                  }}
                  className="rounded-xl border border-slate-300 p-2"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold">画像のフィット</label>
                <select
                  value={fitMode}
                  onChange={(e) => setFitMode(e.target.value)}
                  className="rounded-xl border border-slate-300 p-2"
                >
                  <option value="contain">余白あり（全部見せる）</option>
                  <option value="cover">トリミングしてピッタリ</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-semibold">
                背景（プリセット）
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_BACKGROUNDS.map((p) => (
                  <button
                    key={p.name}
                    className={`px-3 py-1.5 rounded-full border ${
                      bg === p.css ? "border-indigo-600" : "border-slate-300"
                    }`}
                    style={{ background: p.css }}
                    onClick={() => setBg(p.css)}
                  >
                    <span className="backdrop-blur-sm text-slate-800 text-xs font-semibold">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>

              <label className="text-xs font-semibold mt-2">
                背景（CSS手入力）
              </label>
              <input
                value={bgCustom}
                onChange={(e) => setBgCustom(e.target.value)}
                className="rounded-xl border border-slate-300 p-2"
                placeholder="linear-gradient(135deg,#fff,#f0f4ff)"
              />
            </div>
          </section>

          {/* ギャラリー */}
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                アイテム ギャラリー（クリックで選択）
              </h2>
              <div className="text-xs text-slate-500">{items.length}件</div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-[520px] overflow-auto pr-1 justify-items-center">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  onClick={() => setSelected(it.id)}
                  className={`group rounded-xl border ${
                    selected === it.id
                      ? "border-indigo-600 ring-2 ring-indigo-200"
                      : "border-slate-200"
                  } bg-white shadow-sm p-2 flex flex-col items-center gap-2`}
                >
                  <img
                    src={it.img}
                    crossOrigin="anonymous"
                    alt={it.label || `item${i + 1}`}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "contain",
                      borderRadius: 8,
                    }}
                    onError={(e) => {
                      e.currentTarget.style.opacity = 0.3;
                    }}
                  />

                  <div className="text-xs text-slate-700 font-medium line-clamp-1">
                    {it.label || ""}
                  </div>
                  <div className="text-[11px]" style={{ color: titleColor }}>
                    {it.score}
                  </div>
                </button>
              ))}
              {items.length === 0 && (
                <div className="text-slate-500 text-sm">
                  {useRemote
                    ? "公開中のアイテムがまだありません。"
                    : "CSVを入力すると一覧が表示されます。"}
                </div>
              )}
            </div>
          </section>
          {/* プレビュー / 盤面 */}
          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">
              盤面（セルをクリックで配置 / 右下×で消去）
            </h2>
            <BingoCard
              refEl={bingoRef}
              items={board}
              title={title}
              subTitle={subTitle}
              cellSize={cellSize}
              showScore={showScore}
              roundImg={roundImg}
              fontScale={fontScale}
              bg={bgCss}
              onCellClick={placeAt}
              onCellClear={clearAt}
              imgScale={imgScale}
              fitMode={fitMode}
              titleColor={titleColor}
              gridGap={gridGap}
              subTitleColor={subTitleColor}
              subTitleSize={subTitleSize}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function BingoCard({
  items,
  title,
  subTitle,
  cellSize,
  showScore,
  roundImg,
  fontScale,
  bg,
  onCellClick,
  onCellClear,
  refEl,
  imgScale,
  fitMode,
  titleColor,
  gridGap,
  subTitleColor,
  subTitleSize,
}) {
  // BingoCard 冒頭に追加：盤面ラッパ参照
  const wrapRef = useRef(null);

  // ラッパ実幅を取得（ウィンドウ幅じゃなく実際の列幅）
  const wrapW = useContainerWidth(wrapRef, 1200);

  const columns = 5;

  // 盤面内側の padding（p-3 ≒ 12px）
  const innerPadding = 12;

  // グリッドが使える実効幅
  const gridAreaWidth = Math.max(0, wrapW - innerPadding * 2);

  // 1セルの候補（gapも考慮）
  const sizeCandidate = (gridAreaWidth - gridGap * (columns - 1)) / columns;

  // 小さくなり過ぎ防止の下限（お好みで調整）
  const MIN_CELL = 110;
  // ユーザー指定 cellSize を上限に、最小値は MIN_CELL を保証
  const size = Math.floor(
    Math.max(MIN_CELL, Math.min(cellSize, sizeCandidate))
  );

  const hasScore = !!showScore;
  const scoreLinePx = showScore ? Math.round(18 * fontScale) + 16 : 0;

  const cellGridStyle = {
    width: size,
    height: size,
    display: "grid",
    gridTemplateRows: hasScore
      ? `${size - scoreLinePx}px ${scoreLinePx}px`
      : `${size}px`,
  };

  const imgAreaMax = size - scoreLinePx - 16;
  const imgPx = Math.min(Math.round(size * (imgScale ?? 0.8)), imgAreaMax);

  // 収まり優先：横は100%、ただし上限は「盤面がちょうど収まる幅」
  const cardStyle = {
    background: bg,
    width: "100%",
    maxWidth: size * 5 + 80, // px
  };

  // タイトルも大きすぎないようクランプ
  const titlePx = Math.min(64 * fontScale, Math.floor(size * 0.9));

  const setRefs = (node) => {
    if (wrapRef) wrapRef.current = node;
    if (refEl) refEl.current = node; // 画像書き出し用の参照も生かす
  };
  return (
    <div
      ref={setRefs}
      className="rounded-2xl shadow-lg border border-slate-200 p-6 bg-white/70 mx-auto"
      style={cardStyle}
    >
      <div className="text-center mb-4">
        <div
          className="font-extrabold drop-shadow-sm tracking-widest"
          style={{ fontSize: `${titlePx}px`, color: titleColor }}
        >
          {title}
        </div>

        {subTitle && (
          <div
            className="font-medium"
            style={{
              fontSize: `${subTitleSize * fontScale}px`,
              color: subTitleColor,
            }}
          >
            {subTitle}
          </div>
        )}
      </div>

      <div
        className="grid grid-cols-5 bg-white/30 rounded-xl p-3 overflow-x-auto"
        style={{ gap: gridGap }}
      >
        {Array(25)
          .fill(null)
          .map((_, i) => {
            const it = items[i];
            return (
              <div
                key={i}
                className="relative rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden"
                style={cellGridStyle}
              >
                {/* 画像エリア（上段） */}
                <button
                  onClick={() => onCellClick?.(i)}
                  className="flex items-center justify-center p-3 overflow-hidden"
                >
                  {it?.img ? (
                    <img
                      src={it.img}
                      alt={it.label || `item${i + 1}`}
                      style={{
                        width: imgPx,
                        height: imgPx,
                        objectFit: fitMode || "contain",
                        borderRadius: roundImg ? 16 : 0, // 角丸OFFにしたい時はUIで切替
                      }}
                    />
                  ) : (
                    <span className="text-slate-300">クリックで配置</span>
                  )}
                </button>

                {/* 点数バー（下段） */}
                {showScore && (
                  <div
                    className="w-full text-center font-bold leading-none border-t border-slate-200 flex items-center justify-center"
                    style={{
                      fontSize: `${18 * fontScale}px`,
                      color: titleColor,
                    }}
                  >
                    {it?.score ?? ""}
                  </div>
                )}

                {/* 右上の×（← ここだけ no-export を付ける） */}
                <button
                  onClick={() => onCellClear?.(i)}
                  className="absolute -right-2 -top-2 bg-white/90 border border-slate-300 rounded-full text-xs px-1.5 no-export"
                >
                  ×
                </button>
              </div>
            );
          })}
      </div>
      <div className="text-center text-xs text-slate-500 mt-3">
        BingoMaker with team y
      </div>
    </div>
  );
}
