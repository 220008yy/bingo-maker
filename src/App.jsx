import React, { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";

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

const SAMPLE_CSV = `/img/アイテム (1).png,1000,桃
/img/アイテム (2).png,1000,大草原
/img/アイテム (3).png,10000,大漁丸
/img/アイテム (4).png,10000,赤フラッグ
/img/アイテム (5).png,100000,推し勝た
/img/アイテム (6).png,30000,神輿
/img/アイテム (7).png,10000,高級車
/img/アイテム (8).png,1000,掛け声
/img/アイテム (10).png,1000,リムジン
/img/アイテム (11).png,999,リトボ
/img/アイテム (12).png,300000,ランタン
/img/アイテム (13).png,30000,フラワーランウェイ
/img/アイテム (14).png,30000,もじもじ
/img/アイテム (15).png,20000,ラグジュアリーケーキ
/img/アイテム (16).png,2000,ラキボ
/img/アイテム (17).png,500,メガホン
/img/アイテム (18).png,30000,ボンボン
/img/アイテム (19).png,2000,ミックマバースデー
/img/アイテム (20).png,50000,トロフィー
/img/アイテム (21).png,300,ミックマキッス
/img/アイテム (22).png,3000,AWARD
/img/アイテム (23).png,1000,バースデー
/img/アイテム (24).png,10000,ヘリコプター
/img/アイテム (27).png,50000,ぶりちゃん軍団
/img/アイテム (28).png,500,ぶりちゃん
/img/アイテム (29).png,500,ぶりぶりミックマ
/img/アイテム (30).png,3000,アーチ
/img/アイテム (32).png,2000,ブーケ
/img/アイテム (34).png,30000,ナビネオン
/img/アイテム (35).png,30000,ドリラン
/img/アイテム (36).png,1000,ティンカー
/img/アイテム (37).png,500,チョアヨ
/img/アイテム (38).png,1000,ちゅきとま
/img/アイテム (39).png,20000,ステンドグラス
/img/アイテム (41).png,10000,スターラッシュ
/img/アイテム (42).png,30000,シンデレラステージ
/img/アイテム (43).png,20000,シャンパンタワー
/img/アイテム (44).png,3000,シャンパン
/img/アイテム (45).png,200000,シャンパンスワン
/img/アイテム (46).png,80000,シャンパンゴールド
/img/アイテム (47).png,60000,ゴジャボ
/img/アイテム (48).png,35000,グラボ
/img/アイテム (49).png,500,クラッカー
/img/アイテム (50).png,50000,ミックマキングダム
/img/アイテム (51).png,800,キャンボイ
/img/アイテム (52).png,1000,ギタートリオ
/img/アイテム (54).png,5000,インゴット
/img/アイテム (56).png,500,TKG
/img/アイテム (58).png,10000,クラシック大
/img/アイテム (59).png,1000,クラシック小
/img/アイテム (61).png,20000,ミスコンフレーム
/img/アイテム (64).png,300,ミックマ雪だるま
/img/アイテム (65).png,777,ミクチャスロット
/img/アイテム (66).png,2000,お正月ックマ
/img/アイテム (80).png,20000,ミスターコンフレーム
/img/アイテム (83).png,200,ガチックマ
/img/アイテム (87).png,5000,ドットミックマ
/img/アイテム (88).png,1000,ミックマゲーム
/img/アイテム (94).png,10000,ジュエリーローズ
/img/アイテム (95).png,1000,キャンパスアワード
/img/アイテム (96).png,30000,ブリシャン
/img/アイテム (99).png,5000,ヒッチハイク
/img/アイテム (100).png,2000,ヴァンパイア
/img/アイテム (101).png,500,キンモクセイ
/img/アイテム (102).png,500,サクラバシ
/img/アイテム (108).png,5000,アリーナ
/img/アイテム (109).png,1000,ミューコレ
/img/アイテム (110).png,10000,あつまれミクメイト
/img/アイテム (111).png,10000,ミクチャリーグ
/img/アイテム (112).png,800,キャンガル
/img/アイテム (113).png,300,TGCキャンパス
/img/アイテム (115).png,10000,KAWAIIマイク
/img/アイテム (116).png,300,キレチョフ
/img/アイテム (117).png,300,ティアラ
/img/アイテム (118).png,300,マルデ・スター
/img/アイテム (119).png,300,いたずら三兄弟
/img/アイテム (120).png,300,ファンファン
/img/アイテム (121).png,300,ケン太
/img/アイテム (122).png,300,きの人
/img/アイテム (123).png,300,ピンキー
/img/アイテム (124).png,300,チャー・リー
/img/アイテム (125).png,20000,セレブレーション
/img/アイテム (127).png,2000,ミックマキャッチ
/img/アイテム (128).png,200,ミックマアイス
/img/アイテム (129).png,100000,ミクチャスクール
/img/アイテム (130).png,10000,ミックマBOYGIRL
/img/アイテム (131).png,500,おでかけミックマ
/img/アイテム (135).png,200,CF
/img/アイテム (136).png,200000,キャンボイランウェイ
/img/アイテム (137).png,2000,美少女図鑑ダイヤ
/img/アイテム (138).png,5000,ジャックオランタン
/img/アイテム (139).png,50000,ジュエリーボックス
/img/アイテム (140).png,12000,ミニボ
/img/アイテム (141).png,3500,プチボ`;

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

function parseCsv(csv) {
  return csv
    .split(/\r?\n/) // 改行で行ごとに分割

    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, id) => {
      const [img, score, label] = l.split(",");
      return {
        id,
        img: (img || "").trim(),
        score: Number(score) || 0,
        label: (label || "").trim(),
      };
    });
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
  const [csv, setCsv] = useState("");
  const data = useMemo(() => parseCsv(csv), [csv]);

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

  const handleSample = () => setCsv(SAMPLE_CSV);

  const placeAt = (idx) => {
    if (selected == null) return;
    const item = data.find((d) => d.id === selected);
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
    if (data.length === 0) return;

    // 上限が指定されている場合は絞り込む
    const poolAll =
      maxScore != null
        ? data.filter((d) => (Number(d.score) || 0) <= maxScore)
        : data.slice();

    if (poolAll.length === 0) {
      alert("指定した上限以下のアイテムがありません");
      return;
    }

    // 重複許可/禁止のロジック
    let pool = shuffle(poolAll);
    const filled = Array(25)
      .fill(null)
      .map((_, i) => {
        if (useUnique) {
          // プールが25未満なら循環利用（それでも “重複しない” を厳密に保つならデータを増やしてね）
          const idx = i % pool.length;
          return pool[idx];
        } else {
          return pool[i % pool.length];
        }
      });

    setBoard(filled);
  };

  const savePng = async () => {
    if (!bingoRef.current) return;
    const url = await toPng(bingoRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      filter: (node) =>
        !(node.classList && node.classList.contains("no-export")),
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "bingo.png";
    a.click();
  };

  const bgCss = bgCustom?.trim() ? bgCustom : bg;

  return (
    <div className="min-h-screen p-6 md:p-10 bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto grid gap-6">
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
              className="px-3 py-2 rounded-xl bg-slate-900 text-white"
              onClick={handleSample}
            >
              サンプルを入れる
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white"
              onClick={randomFill}
              disabled={data.length === 0}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 設定 */}
          <section className="grid gap-3">
            <label className="text-sm font-semibold">
              CSV（画像URL,点数,ラベル）
            </label>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              className="min-h-[220px] w-full rounded-xl border border-slate-300 p-3 font-mono text-sm"
              placeholder="https://example/icon.png,500,ラベル"
            />
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
                <label className="text-xs font-semibold">セルの一辺(px)</label>
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
              <div className="text-xs text-slate-500">{data.length}件</div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-[520px] overflow-auto pr-1">
              {data.map((it, i) => (
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
                    alt={it.label || `item${i + 1}`}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "contain",
                      borderRadius: 8,
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
              {data.length === 0 && (
                <div className="text-slate-500 text-sm">
                  CSVを入力すると一覧が表示されます。
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
  const size = cellSize;
  const hasScore = !!showScore;
  const scoreLinePx = showScore ? Math.round(18 * fontScale) + 16 : 0;

  // ← 追加：セルを2行グリッド（上：画像エリア / 下：点数バー）
  const cellGridStyle = {
    width: size,
    height: size,
    display: "grid",
    gridTemplateRows: hasScore
      ? `${size - scoreLinePx}px ${scoreLinePx}px`
      : `${size}px`, // スコア非表示なら1行
  };

  // 画像の最大サイズ（画像エリアの内側paddingぶんを差し引き）
  const imgAreaMax = size - scoreLinePx - 16;
  const imgPx = Math.min(Math.round(cellSize * (imgScale ?? 0.8)), imgAreaMax);

  const cardStyle = { background: bg, width: size * 5 + 80 };

  return (
    <div
      ref={refEl}
      className="rounded-2xl shadow-lg border border-slate-200 p-6 bg-white/70 mx-auto"
      style={cardStyle}
    >
      <div className="text-center mb-4">
        <div
          className="font-extrabold drop-shadow-sm tracking-widest"
          style={{ fontSize: `${64 * fontScale}px`, color: titleColor }}
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
        className="grid grid-cols-5 bg-white/30 rounded-xl p-3"
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
